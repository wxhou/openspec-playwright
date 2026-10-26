import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  ALL_CHECKS,
  DEFAULT_CHECKS,
  computeVerdict,
  countScenarios,
  exitCodeForVerdict,
  gate,
  isCheckConfigFile,
  selectChecks,
  type ExecResult,
  type Executor,
} from "../src/commands/gate.js";

// ─── Pure helpers ────────────────────────────────────────────────────────

describe("check selection", () => {
  it("defaults to the documented order", () => {
    expect(DEFAULT_CHECKS).toEqual([
      "validate",
      "lint",
      "typecheck",
      "test",
      "flake",
      "e2e",
    ]);
    expect(ALL_CHECKS).toContain("coverage");
    expect(ALL_CHECKS).toContain("audit");
    expect(DEFAULT_CHECKS).not.toContain("coverage");
  });

  it("honours --only", () => {
    const r = selectChecks("lint,typecheck");
    expect("checks" in r && r.checks).toEqual(["lint", "typecheck"]);
  });

  it("honours --skip", () => {
    const r = selectChecks(undefined, "e2e,flake");
    expect("checks" in r && r.checks).toEqual([
      "validate",
      "lint",
      "typecheck",
      "test",
    ]);
  });

  it("rejects unknown names with the valid list", () => {
    const r = selectChecks("lint,typo");
    expect("error" in r && r.error).toContain("typo");
    expect("error" in r && r.error).toContain("validate");
  });

  it("rejects an empty result set", () => {
    const r = selectChecks(undefined, "validate,lint,typecheck,test,flake,e2e");
    expect("error" in r).toBe(true);
  });

  it("rejects an empty --only", () => {
    expect("error" in selectChecks("  ")).toBe(true);
  });
});

describe("verdict and exit codes", () => {
  const res = (status: "pass" | "fail" | "skipped" | "error") => ({
    name: "lint" as const,
    status,
    exitCode: status === "pass" ? 0 : 1,
    durationMs: 1,
  });

  it("maps pass → 0, fail → 1, undecidable → 2", () => {
    expect(exitCodeForVerdict(computeVerdict([res("pass")]))).toBe(0);
    expect(exitCodeForVerdict(computeVerdict([res("fail")]))).toBe(1);
    expect(exitCodeForVerdict(computeVerdict([res("error")]))).toBe(2);
  });

  it("skipped never fails and never counts as passing", () => {
    expect(computeVerdict([res("pass"), res("skipped")])).toBe("pass");
  });

  it("one undecidable check beats everything else", () => {
    expect(computeVerdict([res("pass"), res("fail"), res("error")])).toBe(
      "inconclusive",
    );
  });
});

describe("check config detection", () => {
  it("matches the files that loosen a check", () => {
    expect(isCheckConfigFile("eslint.config.js")).toBe(true);
    expect(isCheckConfigFile("packages/app/.eslintrc.json")).toBe(true);
    expect(isCheckConfigFile("tsconfig.build.json")).toBe(true);
    expect(isCheckConfigFile("tests/playwright/playwright.config.ts")).toBe(true);
    expect(isCheckConfigFile("vitest.config.mts")).toBe(true);
  });

  it("does not match ordinary source or unrelated json", () => {
    expect(isCheckConfigFile("src/commands/gate.ts")).toBe(false);
    expect(isCheckConfigFile("package.json")).toBe(false);
    expect(isCheckConfigFile("docs/tsconfig-guide.md")).toBe(false);
  });
});

// ─── Gate end-to-end with an injected executor ───────────────────────────

let root: string;

function write(rel: string, content: string) {
  const full = join(root, rel);
  mkdirSync(join(full, ".."), { recursive: true });
  writeFileSync(full, content);
}

const CHANGES = (names: string[]): ExecResult => ({
  exitCode: 0,
  stdout: JSON.stringify({
    root: { path: root },
    changes: names.map((name) => ({ name })),
  }),
  stderr: "",
});

const OK: ExecResult = { exitCode: 0, stdout: "", stderr: "" };
const FAIL: ExecResult = { exitCode: 1, stdout: "", stderr: "boom: assertion failed" };
const MISSING: ExecResult = {
  exitCode: null,
  stdout: "",
  stderr: "",
  failure: { kind: "missing", message: "command not found: openspec" },
};

function makeExec(overrides: Record<string, ExecResult> = {}): Executor {
  const calls: string[] = [];
  const exec: Executor = (cmd, args) => {
    const key = [cmd, ...args].join(" ");
    calls.push(key);
    for (const [prefix, result] of Object.entries(overrides)) {
      if (key.startsWith(prefix)) return result;
    }
    if (key.startsWith("openspec list")) return CHANGES(["demo"]);
    if (key.startsWith("git diff --numstat")) return OK;
    if (key.startsWith("git ls-files")) return OK;
    if (key.startsWith("git diff -U0")) return OK;
    return OK;
  };
  (exec as unknown as { calls: string[] }).calls = calls;
  return exec;
}

function capture() {
  const lines: string[] = [];
  return { lines, out: (l: string) => lines.push(l) };
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "gate-test-"));
  write(
    "package.json",
    JSON.stringify({ scripts: { lint: "eslint .", typecheck: "tsc", "test:run": "vitest run" } }),
  );
  write(
    "openspec/changes/demo/specs/demo/spec.md",
    "# Demo\n\n## ADDED Requirements\n\n### Requirement: x\n\n#### Scenario: one\n- **WHEN** a\n- **THEN** b\n",
  );
  write("tests/playwright/changes/demo/demo.spec.ts", "test('one', async () => {});\n");
  write("playwright.config.ts", "export default {};\n");
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("gate", () => {
  it("passes when every check is green", async () => {
    const exec = makeExec();
    const code = await gate("demo", { json: true }, { cwd: root, exec, out: () => {} });
    expect(code).toBe(0);
  });

  it("stops at the first failure by default", async () => {
    const exec = makeExec({ "npm run lint": FAIL });
    const code = await gate(
      "demo",
      { json: true },
      { cwd: root, exec, out: () => {} },
    );
    expect(code).toBe(1);
    const calls = (exec as unknown as { calls: string[] }).calls;
    expect(calls.some((c) => c.startsWith("npm run typecheck"))).toBe(false);
  });

  it("keeps going and reports every failure with --keep-going", async () => {
    const exec = makeExec({ "npm run lint": FAIL, "npm run test:run": FAIL });
    const lines = capture();
    const code = await gate(
      "demo",
      { json: true, keepGoing: true },
      { cwd: root, exec, out: lines.out },
    );
    expect(code).toBe(1);
    const report = JSON.parse(lines.lines.join("\n"));
    expect(report.checks.filter((c: { status: string }) => c.status === "fail")).toHaveLength(2);
  });

  it("returns 2 when a tool is missing", async () => {
    const exec = makeExec({ "openspec validate": MISSING });
    const lines = capture();
    const code = await gate(
      "demo",
      { json: true },
      { cwd: root, exec, out: lines.out },
    );
    expect(code).toBe(2);
    const report = JSON.parse(lines.lines.join("\n"));
    expect(report.verdict).toBe("inconclusive");
    expect(report.checks[0].status).toBe("error");
  });

  it("returns 2 when a check times out", async () => {
    const exec = makeExec({
      "openspec validate": {
        exitCode: null,
        stdout: "",
        stderr: "",
        failure: { kind: "timeout", message: "timed out after 60s" },
      },
    });
    const lines = capture();
    const code = await gate(
      "demo",
      { json: true, only: "validate" },
      { cwd: root, exec, out: lines.out },
    );
    expect(code).toBe(2);
    expect(JSON.parse(lines.lines[0]).checks[0].reason).toContain("timed out");
  });

  it("also validates the main spec of a capability the delta touches", async () => {
    write("openspec/specs/demo/spec.md", "# Demo Specification\n");
    const exec = makeExec({ "openspec validate demo --type spec": FAIL });
    const lines = capture();
    const code = await gate(
      "demo",
      { json: true, only: "validate" },
      { cwd: root, exec, out: lines.out },
    );
    expect(code).toBe(1);
    const report = JSON.parse(lines.lines[0]);
    expect(report.checks[0].status).toBe("fail");
  });

  it("returns 2 when several changes are active and none is named", async () => {
    const exec: Executor = (cmd, args) => {
      const key = [cmd, ...args].join(" ");
      if (key.startsWith("openspec list")) return CHANGES(["a", "b"]);
      return OK;
    };
    const errors = capture();
    const code = await gate(undefined, {}, { cwd: root, exec, err: errors.out });
    expect(code).toBe(2);
    expect(errors.lines.join("\n")).toContain("multiple active changes");
  });

  it("runs checks that need no change even when several changes are active", async () => {
    // A PR job runs `--only lint,typecheck,test,flake`; none of those reads a
    // change, so an open second change must not turn the job red.
    const exec: Executor = (cmd, args) => {
      const key = [cmd, ...args].join(" ");
      if (key.startsWith("openspec list")) return CHANGES(["a", "b"]);
      return OK;
    };
    const errors = capture();
    const code = await gate(
      undefined,
      { only: "lint,typecheck" },
      { cwd: root, exec, err: errors.out },
    );
    expect(code).toBe(0);
    expect(errors.lines.join("\n")).not.toContain("multiple active changes");
  });

  it("runs flake and audit without naming a change", async () => {
    // Both take an optional change name; the PR job selects them without one.
    const exec = makeExec({ "openspec list": CHANGES(["a", "b"]) });
    const errors = capture();
    const code = await gate(
      undefined,
      { only: "flake,audit" },
      { cwd: root, exec, err: errors.out },
    );
    expect(code).toBe(0);
    expect(errors.lines.join("\n")).not.toContain("multiple active changes");
    const calls = (exec as unknown as { calls: string[] }).calls;
    expect(calls.some((c) => /flake --gate HIGH$/.test(c))).toBe(true);
    expect(calls.some((c) => c.endsWith("audit --gate"))).toBe(true);
  });

  it("emits a single JSON object with the documented shape", async () => {
    const exec = makeExec();
    const lines = capture();
    await gate("demo", { json: true }, { cwd: root, exec, out: lines.out });
    expect(lines.lines).toHaveLength(1);
    const report = JSON.parse(lines.lines[0]);
    expect(report).toMatchObject({
      verdict: "pass",
      change: "demo",
      totals: { pass: expect.any(Number), fail: 0, skipped: expect.any(Number), error: 0 },
    });
    expect(Array.isArray(report.checks)).toBe(true);
    expect(Array.isArray(report.flags)).toBe(true);
    for (const check of report.checks) {
      expect(check).toHaveProperty("name");
      expect(check).toHaveProperty("status");
      expect(check).toHaveProperty("exitCode");
      expect(check).toHaveProperty("durationMs");
    }
  });

  it("runs coverage and audit only when asked for", async () => {
    const exec = makeExec();
    const lines = capture();
    const code = await gate(
      "demo",
      { json: true, only: "coverage,audit" },
      { cwd: root, exec, out: lines.out },
    );
    expect(code).toBe(0);
    const report = JSON.parse(lines.lines[0]);
    expect(report.checks.map((c: { name: string }) => c.name)).toEqual([
      "coverage",
      "audit",
    ]);
    // Without --coverage-min there is no threshold to judge against.
    expect(report.checks[0].status).toBe("skipped");
    expect(report.checks[1].status).toBe("pass");
  });

  it("passes a coverage threshold through when given one", async () => {
    const exec = makeExec();
    const lines = capture();
    await gate(
      "demo",
      { json: true, only: "coverage", coverageMin: "80" },
      { cwd: root, exec, out: lines.out },
    );
    const calls = (exec as unknown as { calls: string[] }).calls;
    expect(calls.some((c) => c.includes("coverage demo --fail-under 80"))).toBe(true);
  });

  it("skips lint when package.json has no such script, and says why", async () => {
    write("package.json", JSON.stringify({ scripts: { "test:run": "vitest run" } }));
    const exec = makeExec();
    const lines = capture();
    const code = await gate(
      "demo",
      { json: true, only: "lint" },
      { cwd: root, exec, out: lines.out },
    );
    expect(code).toBe(0);
    const report = JSON.parse(lines.lines[0]);
    expect(report.checks[0].status).toBe("skipped");
    expect(report.checks[0].reason).toContain("no `lint` script");
  });
});

describe("false-green guards", () => {
  it("fails e2e when the delta spec has scenarios but no tests", async () => {
    rmSync(join(root, "tests/playwright/changes/demo"), { recursive: true, force: true });
    const exec = makeExec();
    const lines = capture();
    const code = await gate(
      "demo",
      { json: true, only: "e2e" },
      { cwd: root, exec, out: lines.out },
    );
    expect(code).toBe(1);
    const report = JSON.parse(lines.lines[0]);
    expect(report.checks[0].status).toBe("fail");
    expect(report.checks[0].reason).toContain("no test files");
  });

  it("skips e2e when the change has no scenarios at all", async () => {
    write(
      "openspec/changes/demo/specs/demo/spec.md",
      "# Demo\n\n## ADDED Requirements\n\n### Requirement: x\n",
    );
    rmSync(join(root, "tests/playwright/changes/demo"), { recursive: true, force: true });
    const exec = makeExec();
    const lines = capture();
    const code = await gate(
      "demo",
      { json: true, only: "e2e" },
      { cwd: root, exec, out: lines.out },
    );
    expect(code).toBe(0);
    const report = JSON.parse(lines.lines[0]);
    expect(report.checks[0].status).toBe("skipped");
    expect(report.checks[0].reason).toContain("no scenarios");
  });

  it("does not fail when the project has no Playwright config at all", async () => {
    rmSync(join(root, "playwright.config.ts"), { force: true });
    rmSync(join(root, "tests/playwright/changes/demo"), { recursive: true, force: true });
    const exec = makeExec();
    const lines = capture();
    const code = await gate(
      "demo",
      { json: true, only: "e2e" },
      { cwd: root, exec, out: lines.out },
    );
    expect(code).toBe(0);
    const report = JSON.parse(lines.lines[0]);
    expect(report.checks[0].status).toBe("skipped");
    expect(report.checks[0].reason).toContain("no playwright config");
  });

  it("fails when the diff adds a test.fixme", async () => {
    const exec = makeExec({
      "git diff -U0": {
        exitCode: 0,
        stdout: [
          "diff --git a/tests/playwright/changes/demo/demo.spec.ts b/tests/playwright/changes/demo/demo.spec.ts",
          "--- a/tests/playwright/changes/demo/demo.spec.ts",
          "+++ b/tests/playwright/changes/demo/demo.spec.ts",
          "@@ -10,0 +11,2 @@",
          "+test.fixme('broken', async () => {});",
          "+",
        ].join("\n"),
        stderr: "",
      },
    });
    const lines = capture();
    const code = await gate(
      "demo",
      { json: true, only: "e2e" },
      { cwd: root, exec, out: lines.out },
    );
    expect(code).toBe(1);
    const report = JSON.parse(lines.lines[0]);
    expect(report.checks[0].reason).toContain("demo.spec.ts:11");
  });

  it("flags a loosened check config without failing the gate", async () => {
    const exec = makeExec({
      "git diff --numstat": {
        exitCode: 0,
        stdout: "2\t0\teslint.config.js\n5\t1\tsrc/gate.ts\n",
        stderr: "",
      },
    });
    const lines = capture();
    const code = await gate(
      "demo",
      { json: true, only: "lint" },
      { cwd: root, exec, out: lines.out },
    );
    expect(code).toBe(0);
    const report = JSON.parse(lines.lines[0]);
    expect(report.flags).toEqual([{ path: "eslint.config.js", added: 2, removed: 0 }]);
  });

  it("flags a raised test timeout without failing the gate", async () => {
    const exec = makeExec({
      "git diff -U0": {
        exitCode: 0,
        stdout: [
          "--- a/tests/playwright/changes/demo/a.spec.ts",
          "+++ b/tests/playwright/changes/demo/a.spec.ts",
          "@@ -7,1 +7,1 @@",
          "-  await page.waitForSelector('#x', { timeout: 5000 });",
          "+  await page.waitForSelector('#x', { timeout: 30000 });",
        ].join("\n"),
        stderr: "",
      },
    });
    const lines = capture();
    const code = await gate(
      "demo",
      { json: true, only: "lint" },
      { cwd: root, exec, out: lines.out },
    );
    expect(code).toBe(0);
    const report = JSON.parse(lines.lines[0]);
    expect(report.flags).toEqual([
      {
        path: "tests/playwright/changes/demo/a.spec.ts",
        added: 0,
        removed: 0,
        reason: "timeout 5000 → 30000 at line 7",
      },
    ]);
  });
});

describe("stop-hook mode", () => {
  const lintCalls = (exec: Executor) =>
    (exec as unknown as { calls: string[] }).calls.filter((c) =>
      c.startsWith("npm run lint"),
    ).length;

  it("never blocks twice in a row (stop_hook_active)", async () => {
    const exec = makeExec({ "npm run lint": FAIL });
    const lines = capture();
    const code = await gate(
      "demo",
      { hook: true, only: "lint" },
      { cwd: root, exec, err: lines.out, hookPayload: { stop_hook_active: true } },
    );
    expect(code).toBe(0);
    expect(lintCalls(exec)).toBe(0);
    expect(lines.lines.join("\n")).toContain("already blocked");
  });

  it("blocks with exit 2 when the gate is red", async () => {
    const exec = makeExec({ "npm run lint": FAIL });
    const lines = capture();
    const code = await gate(
      "demo",
      { hook: true, only: "lint" },
      { cwd: root, exec, err: lines.out, hookPayload: {} },
    );
    expect(code).toBe(2);
    expect(lines.lines.join("\n")).toContain("fail");
  });

  it("writes a cache entry and reuses it when the tree is unchanged", async () => {
    const exec = makeExec();
    const lines = capture();
    const first = await gate(
      "demo",
      { hook: true, only: "lint" },
      { cwd: root, exec, err: lines.out, hookPayload: {} },
    );
    expect(first).toBe(0);
    expect(existsSync(join(root, ".claude", ".openspec-pw-gate-cache.json"))).toBe(true);

    const before = lintCalls(exec);
    const second = await gate(
      "demo",
      { hook: true, only: "lint" },
      { cwd: root, exec, err: lines.out, hookPayload: {} },
    );
    expect(second).toBe(0);
    expect(lintCalls(exec)).toBe(before);
  });

  it("reuses a cached failure without re-running", async () => {
    const exec = makeExec({ "npm run lint": FAIL });
    const lines = capture();
    await gate(
      "demo",
      { hook: true, only: "lint" },
      { cwd: root, exec, err: lines.out, hookPayload: {} },
    );
    const before = lintCalls(exec);
    const second = await gate(
      "demo",
      { hook: true, only: "lint" },
      { cwd: root, exec, err: lines.out, hookPayload: {} },
    );
    expect(second).toBe(2);
    expect(lintCalls(exec)).toBe(before);
  });
});

describe("countScenarios", () => {
  it("counts scenarios across delta spec files", () => {
    write(
      "openspec/changes/demo/specs/other/spec.md",
      "### Requirement: y\n\n#### Scenario: two\n- **WHEN** c\n- **THEN** d\n",
    );
    expect(countScenarios(join(root, "openspec/changes/demo"))).toBe(2);
  });
});
