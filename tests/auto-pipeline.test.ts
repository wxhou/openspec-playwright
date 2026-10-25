import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "fs";
import { tmpdir } from "os";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import {
  AUTO_PIPELINE_REL,
  BRANCH_PROTECTION_HINT,
  generateAutoPipeline,
} from "../src/commands/pipeline.js";

const rawTemplate = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "..", "templates", "auto-pipeline.yml"),
  "utf-8",
);
// Git checks templates out with CRLF on Windows; normalize before matching
// strings that end at a line break.
const template = rawTemplate.replace(/\r\n/g, "\n");

describe("pipeline template", () => {
  it("triggers on pull_request and workflow_dispatch, never on push", () => {
    expect(template).toMatch(/^ {2}pull_request:/m);
    expect(template).toMatch(/^ {2}workflow_dispatch:/m);
    expect(template).not.toMatch(/^ {2}push:/m);
  });

  it("never uses pull_request_target", () => {
    expect(template).not.toContain("pull_request_target");
  });

  it("keeps the gate job off the label event and the agent job off plain PRs", () => {
    expect(template).toContain("github.event_name == 'pull_request' && github.event.action != 'labeled'");
    expect(template).toContain("github.event.label.name == 'openspec:auto'");
    // Fork PRs must never reach the agent job: repo hooks run before trust.
    expect(template).toContain(
      "github.event.pull_request.head.repo.full_name == github.repository",
    );
  });

  it("pins the Claude Code version and checks it before running the agent", () => {
    expect(template).toContain("CLAUDE_CODE_VERSION:");
    expect(template).toContain('claude --version | grep -q "$CLAUDE_CODE_VERSION"');
    expect(template).toContain(".claude/commands/opsx/apply.md");
  });

  it("never passes bare mode to the CLI", () => {
    // The template mentions --bare in a comment explaining why it is avoided.
    const commands = template
      .split("\n")
      .filter((line) => !line.trim().startsWith("#"))
      .join("\n");
    expect(commands).not.toMatch(/--bare\b/);
  });

  it("uses permission-rule syntax for allowlists, not the colon form", () => {
    expect(template).toContain("Bash(npx *)");
    expect(template).not.toContain("Bash(npx:*)");
    expect(template).toContain("--tools");
    expect(template).toContain("--permission-prompts none");
  });

  it("bounds cost and time", () => {
    expect(template).toContain("--max-budget-usd");
    expect(template).toContain("--max-turns");
    expect(template).toMatch(/timeout-minutes:/);
    expect(template).toContain("CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS");
  });

  it("carries the self-verification loop and the independent gate run", () => {
    // Prompt tells the agent to keep going until the gate is green...
    expect(template).toContain("revise until it exits 0");
    // ...and the job runs the gate again on its own authority.
    expect(template).toMatch(/- name: Gate[\s\S]{0,200}openspec-pw gate/);
  });

  it("judges apply by task counts, not by the CLI exit code", () => {
    expect(template).toContain("completedTasks");
    expect(template).toContain("totalTasks");
  });

  it("covers the e2e stage with the deterministic plan gate", () => {
    expect(template).toContain("--auto");
    expect(template).toContain("--plan");
  });

  it("runs verify after the gate, advisory only, and records it in the PR", () => {
    const gate = template.lastIndexOf("- name: Gate\n");
    const verify = template.indexOf("- name: Verify (advisory)");
    const pr = template.indexOf("- name: Open or update the PR");
    expect(gate).toBeGreaterThan(-1);
    expect(verify).toBeGreaterThan(gate);
    expect(pr).toBeGreaterThan(verify);
    expect(template).toContain("continue-on-error: true");
    expect(template).toContain("/opsx:verify $CHANGE");
    expect(template).toContain("--body-file pr-body.md");
    // The PR body carries per-check gate results, per-stage costs and the report.
    expect(template).toMatch(/\.checks\[\]/);
    expect(template).toMatch(/Costs: apply/);
    expect(template).toContain("### Verify (advisory)");
  });

  it("regenerates the command artifacts before asserting /opsx:apply exists", () => {
    // `.claude/` sits in init's managed gitignore block, so a check that expects
    // a committed command file could never pass — and `openspec update` alone
    // only refreshes tools already configured in the runner's global config.
    expect(template).toMatch(
      /openspec init --tools claude[\s\S]{0,200}\.claude\/commands\/opsx\/apply\.md/,
    );
    // `core` installs 6 commands and omits /opsx:verify, which stage 5 runs.
    expect(template).toContain("--profile custom");
    expect(template).not.toContain("--profile core");
  });

  it("gives the advisory verify step shell access without edit tools", () => {
    // Prefix rules like `Bash(npm *)` reject compound commands, and under
    // `--permission-prompts none` a rejected call is simply denied.
    const verifyBlock = template.slice(template.indexOf("- name: Verify (advisory)"));
    expect(verifyBlock).toContain('--tools "Bash,Read"');
    expect(verifyBlock).toContain('--allowedTools "Read" "Bash"');
    expect(verifyBlock).not.toContain("--tools \"Bash,Read,Edit,Write\"");
  });

  it("gates the cheap checks before the browser-driven stage", () => {
    // lint/typecheck/test are seconds and free; E2E needs a server and a
    // browser. A half-finished apply must not reach the expensive stage.
    const apply = template.indexOf("- name: Apply change");
    const staticGate = template.indexOf("- name: Gate (static)");
    const e2e = template.indexOf("- name: Generate E2E tests");
    // `- name: Gate` also exists in the PR job, which comes first in the file.
    const fullGate = template.lastIndexOf("- name: Gate\n");
    const verify = template.indexOf("- name: Verify (advisory)");
    expect(apply).toBeGreaterThan(-1);
    expect(staticGate).toBeGreaterThan(apply);
    expect(e2e).toBeGreaterThan(staticGate);
    expect(fullGate).toBeGreaterThan(e2e);
    expect(verify).toBeGreaterThan(fullGate);
  });

  it("keeps the apply self-check off e2e until the tests exist", () => {
    // The "scenarios but no tests" guard fails a full gate before the E2E
    // stage has run, so asking the agent for a full gate is a loop that can
    // never terminate — and an unsatisfiable check invites a stub test.
    const applyBlock = template.slice(
      template.indexOf("- name: Apply change"),
      template.indexOf("- name: Check task completion"),
    );
    expect(applyBlock).toContain("openspec-pw gate $CHANGE --skip e2e");
    expect(applyBlock).toContain("do not write them yourself");
  });

  it("does not let tee swallow a red gate", () => {
    const gateBlock = template.slice(template.lastIndexOf("- name: Gate\n"));
    expect(gateBlock).toContain("set -o pipefail");
  });

  it("skips the e2e check when E2E generation is switched off", () => {
    const gateBlock = template.slice(template.lastIndexOf("- name: Gate\n"));
    expect(gateBlock).toContain('"$E2E" = "false"');
    expect(gateBlock).toContain("--skip e2e");
  });

  it("references credentials only through secrets", () => {
    for (const line of template.split("\n")) {
      if (/(API_KEY|TOKEN)\s*:/.test(line) && !line.includes("secrets.")) {
        // Env keys are fine; assignments of literal values are not.
        expect(line, `literal credential on: ${line}`).toMatch(
          /ANTHROPIC_API_KEY: \$\{\{ secrets\.ANTHROPIC_API_KEY \}\}|GH_TOKEN: \$\{\{ secrets\.GITHUB_TOKEN \}\}|-z "\$ANTHROPIC_API_KEY"/,
        );
      }
    }
    expect(template).not.toMatch(/sk-ant-[A-Za-z0-9]/);
  });
});

describe("BRANCH_PROTECTION_HINT", () => {
  it("names the required status check and says the tool cannot set it", () => {
    expect(BRANCH_PROTECTION_HINT).toContain("required status check");
    expect(BRANCH_PROTECTION_HINT).toContain("cannot be changed from here");
  });
});

describe("generateAutoPipeline", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "pipeline-test-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("creates the workflow on first run", () => {
    const result = generateAutoPipeline(root);
    expect("status" in result && result.status).toBe("created");
    expect(existsSync(join(root, AUTO_PIPELINE_REL))).toBe(true);
    expect(readFileSync(join(root, AUTO_PIPELINE_REL), "utf-8")).toBe(rawTemplate);
  });

  it("never overwrites an edited workflow", () => {
    mkdirSync(join(root, ".github", "workflows"), { recursive: true });
    const path = join(root, AUTO_PIPELINE_REL);
    writeFileSync(path, "# my own workflow\n");

    const result = generateAutoPipeline(root);
    expect("status" in result && result.status).toBe("exists");
    expect(readFileSync(path, "utf-8")).toBe("# my own workflow\n");
  });
});

describe("init --auto-pipeline", () => {
  let root: string;
  let cwdSpy: ReturnType<typeof import("vitest")["vi"]["spyOn"]>;
  const logs: string[] = [];

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "pipeline-init-"));
    mkdirSync(join(root, "openspec"), { recursive: true });
    writeFileSync(
      join(root, "package.json"),
      JSON.stringify({ scripts: { dev: "vite" } }),
    );
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(root);
    logs.length = 0;
    vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      logs.push(args.join(" "));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cwdSpy.mockRestore();
    rmSync(root, { recursive: true, force: true });
  });

  it("keeps the OpenSpec artifacts committable", async () => {
    // CI checks out the repository: with `openspec/` ignored there is no
    // change to apply, validate or test.
    const { init } = await import("../src/commands/init.js");
    await init({ tools: "none", autoPipeline: true });

    expect(existsSync(join(root, AUTO_PIPELINE_REL))).toBe(true);
    const gitignore = readFileSync(join(root, ".gitignore"), "utf-8");
    expect(gitignore).toContain("# openspec-pw: begin managed block");
    expect(gitignore).not.toContain("openspec/");
  });

  it("warns when a rule outside the managed block still ignores openspec/", async () => {
    writeFileSync(join(root, ".gitignore"), "openspec/\n");
    const { init } = await import("../src/commands/init.js");
    await init({ tools: "none", autoPipeline: true });

    expect(
      logs.some((l) => l.includes("is ignored outside the managed block")),
    ).toBe(true);
  });
});
