import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
} from "fs";
import { dirname, join } from "path";
import { tmpdir } from "os";
import { fileURLToPath } from "url";

// The CLI probe is stubbed: the default is 1.x, matching this file's
// fixtures; the tests that exercise 2.x override it per case.
vi.mock("../src/shared/openspec-version.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../src/shared/openspec-version.js")>();
  return {
    ...actual,
    openSpecCliStatus: vi.fn(() => ({ ok: true, major: 1 })),
  };
});

// Complete §0–§7 body: syncEmployeeStandards rejects an English SSOT that is
// missing any of those sections, so fixtures must look like the real file.
const EN_STANDARDS_STUB = ["0", "1", "2", "3", "4", "5", "6", "7"]
  .map((n) => `## ${n}. Section ${n}`)
  .join("\n\n");

// ─── syncCredentials ──────────────────────────────────────────────────────────

describe("syncCredentials", () => {
  const tmpDir = join(tmpdir(), "openspec-pw-credentials-test-" + Date.now());

  beforeEach(() => {
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("skips when source template does not exist", async () => {
    const { syncCredentials } = await import("../../src/commands/update.js");
    // Should not throw
    syncCredentials(tmpDir, join(tmpdir(), "some-project"));
  });

  it("generates credentials.yaml when destination does not exist", async () => {
    const projectDir = join(tmpdir(), "creds-gen-project-" + Date.now());
    const src = join(tmpDir, "templates");
    mkdirSync(src, { recursive: true });
    writeFileSync(join(src, "credentials.yaml"), "users: []");

    const { syncCredentials } = await import("../../src/commands/update.js");
    syncCredentials(tmpDir, projectDir);

    expect(existsSync(join(projectDir, "tests", "playwright", "credentials.yaml"))).toBe(true);
    rmSync(projectDir, { recursive: true, force: true });
  });

  it("preserves user credentials when updating existing file", async () => {
    const projectDir = join(tmpdir(), "creds-preserve-project-" + Date.now());
    mkdirSync(join(projectDir, "tests", "playwright"), { recursive: true });

    // Existing credentials with user data
    const existingCreds = `users:
  - name: admin
    username: admin@test.com
    password: secret123
`;
    writeFileSync(join(projectDir, "tests", "playwright", "credentials.yaml"), existingCreds);

    // New template - must include `# Multi-user` comment for replace pattern
    const src = join(tmpDir, "templates");
    mkdirSync(src, { recursive: true });
    writeFileSync(join(src, "credentials.yaml"), `# Multi-user test credentials
users:
  - name: CHANGE_ME
    username: CHANGE_ME
    password: CHANGE_ME

  # Multi-user example (uncomment for role-based tests)
`);

    const { syncCredentials } = await import("../../src/commands/update.js");
    syncCredentials(tmpDir, projectDir);

    const updated = readFileSync(join(projectDir, "tests", "playwright", "credentials.yaml"), "utf-8");
    expect(updated).toContain("admin@test.com"); // preserved user
    expect(updated).toContain("secret123"); // preserved password
    rmSync(projectDir, { recursive: true, force: true });
  });

  it("preserves $ sequences in user data without replacement expansion", async () => {
    const projectDir = join(tmpdir(), "creds-dollar-project-" + Date.now());
    mkdirSync(join(projectDir, "tests", "playwright"), { recursive: true });

    const existingCreds = `users:
  - name: admin
    username: a$1b@test.com
    password: pa$$word
`;
    writeFileSync(join(projectDir, "tests", "playwright", "credentials.yaml"), existingCreds);

    const src = join(tmpDir, "templates");
    mkdirSync(src, { recursive: true });
    writeFileSync(join(src, "credentials.yaml"), `users:
  - name: CHANGE_ME
    username: CHANGE_ME
    password: CHANGE_ME
`);

    const { syncCredentials } = await import("../../src/commands/update.js");
    syncCredentials(tmpDir, projectDir);

    const updated = readFileSync(join(projectDir, "tests", "playwright", "credentials.yaml"), "utf-8");
    expect(updated).toContain("a$1b@test.com");
    expect(updated).toContain("pa$$word");
    expect(updated.match(/a\$1b@test\.com/g)).toHaveLength(1);
    rmSync(projectDir, { recursive: true, force: true });
  });

  it("preserves a valid users block with different indentation", async () => {
    const projectDir = join(tmpdir(), "creds-indent-project-" + Date.now());
    mkdirSync(join(projectDir, "tests", "playwright"), { recursive: true });

    const existingCreds = `users:
    - name: admin
      username: admin@test.com
      password: secret123
    # keep this comment
`;
    writeFileSync(join(projectDir, "tests", "playwright", "credentials.yaml"), existingCreds);

    const src = join(tmpDir, "templates");
    mkdirSync(src, { recursive: true });
    writeFileSync(join(src, "credentials.yaml"), `users:
  - name: CHANGE_ME
    username: CHANGE_ME
    password: CHANGE_ME
`);

    const { syncCredentials } = await import("../../src/commands/update.js");
    syncCredentials(tmpDir, projectDir);

    const updated = readFileSync(join(projectDir, "tests", "playwright", "credentials.yaml"), "utf-8");
    expect(updated).toContain("    - name: admin");
    expect(updated).toContain("      username: admin@test.com");
    expect(updated).toContain("    # keep this comment");
    rmSync(projectDir, { recursive: true, force: true });
  });

  it("creates backup of existing credentials before update", async () => {
    const projectDir = join(tmpdir(), "creds-backup-project-" + Date.now());
    mkdirSync(join(projectDir, "tests", "playwright"), { recursive: true });

    const existingCreds = `users:
  - name: admin
    username: admin@test.com
    password: secret123
`;
    writeFileSync(join(projectDir, "tests", "playwright", "credentials.yaml"), existingCreds);

    const src = join(tmpDir, "templates");
    mkdirSync(src, { recursive: true });
    writeFileSync(join(src, "credentials.yaml"), `users:
  - name: NEW_USER
    username: new@test.com
    password: newpass

  # Multi-user example
`);

    const { syncCredentials } = await import("../../src/commands/update.js");
    syncCredentials(tmpDir, projectDir);

    // Backup should exist with original content
    expect(existsSync(join(projectDir, "tests", "playwright", "credentials.yaml.bak"))).toBe(true);
    expect(readFileSync(join(projectDir, "tests", "playwright", "credentials.yaml.bak"), "utf-8")).toBe(existingCreds);
    rmSync(projectDir, { recursive: true, force: true });
  });

  it("skips when credentials file already matches template", async () => {
    const projectDir = join(tmpdir(), "creds-identical-project-" + Date.now());
    mkdirSync(join(projectDir, "tests", "playwright"), { recursive: true });

    const templateContent = `users:
  - name: CHANGE_ME
    username: CHANGE_ME
    password: CHANGE_ME
`;
    writeFileSync(join(projectDir, "tests", "playwright", "credentials.yaml"), templateContent);

    const src = join(tmpDir, "templates");
    mkdirSync(src, { recursive: true });
    writeFileSync(join(src, "credentials.yaml"), templateContent);

    const { syncCredentials } = await import("../../src/commands/update.js");
    syncCredentials(tmpDir, projectDir);

    // No backup should be created when content matches
    expect(existsSync(join(projectDir, "tests", "playwright", "credentials.yaml.bak"))).toBe(false);
    rmSync(projectDir, { recursive: true, force: true });
  });
});

// ─── syncCredentials: credentials ignore hint ─────────────────────────

describe("syncCredentials: credentials ignore hint", () => {
  const tplDir = join(tmpdir(), "ospw-cred-hint-tpl-" + Date.now());

  beforeEach(() => {
    mkdirSync(join(tplDir, "templates"), { recursive: true });
    writeFileSync(
      join(tplDir, "templates", "credentials.yaml"),
      "users: []\n",
    );
  });

  afterEach(() => {
    rmSync(tplDir, { recursive: true, force: true });
  });

  async function runSync(projectDir: string) {
    const { syncCredentials } = await import("../../src/commands/update.js");
    const logs: string[] = [];
    const spy = vi
      .spyOn(console, "log")
      .mockImplementation((...args: unknown[]) => {
        logs.push(args.join(" "));
      });
    try {
      syncCredentials(tplDir, projectDir);
    } finally {
      spy.mockRestore();
    }
    return logs;
  }

  it("stays silent on fresh generation — coverage advisory moved to the managed-block degradation branch (review S3)", async () => {
    const projectDir = join(tmpdir(), "ospw-cred-hint-gen-" + Date.now());
    mkdirSync(projectDir, { recursive: true });
    try {
      const logs = await runSync(projectDir);
      expect(
        logs.some((l) => l.includes("Test credentials are not git-ignored")),
      ).toBe(false);
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
    }
  });

  it("stays silent on the rewrite path — no .bak hint from syncCredentials (review S3)", async () => {
    const projectDir = join(tmpdir(), "ospw-cred-hint-bak-" + Date.now());
    mkdirSync(join(projectDir, "tests", "playwright"), { recursive: true });
    // .gitignore covers credentials.yaml but NOT the .bak update is about
    // to write — since the managed-block change, coverage advisory lives
    // in update's degradation branch, not here.
    writeFileSync(
      join(projectDir, ".gitignore"),
      "tests/playwright/credentials.yaml\n",
    );
    writeFileSync(
      join(projectDir, "tests", "playwright", "credentials.yaml"),
      "users: []\n",
    );
    try {
      const logs = await runSync(projectDir);
      expect(
        logs.some((l) => l.includes("not git-ignored")),
      ).toBe(false);
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
    }
  });

  it("no hint when .gitignore covers both credential files", async () => {
    const projectDir = join(tmpdir(), "ospw-cred-hint-ok-" + Date.now());
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(
      join(projectDir, ".gitignore"),
      "tests/playwright/credentials.yaml\ntests/playwright/credentials.yaml.bak\n",
    );
    try {
      const logs = await runSync(projectDir);
      expect(logs.some((l) => l.includes("not git-ignored"))).toBe(false);
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
    }
  });

  it("never edits the project .gitignore", async () => {
    const projectDir = join(tmpdir(), "ospw-cred-hint-git-" + Date.now());
    mkdirSync(projectDir, { recursive: true });
    const gitignore = "# my rules\ntests/playwright/credentials.yaml\n";
    writeFileSync(join(projectDir, ".gitignore"), gitignore);
    try {
      await runSync(projectDir);
      expect(readFileSync(join(projectDir, ".gitignore"), "utf-8")).toBe(
        gitignore,
      );
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
    }
  });
});

// ─── command execution: shared/exec wrapper ───────────────────────────────
// Verifies the npm calls in update.ts use the cross-spawn wrapper with an
// explicit args array, never shell: true.

describe("update.ts: npm calls use shared/exec wrapper", () => {
  it("calls npm with install -g openspec-playwright@latest (not a shell string)", async () => {
    // Read the source and confirm: no execSync string interpolation,
    // wrapper used with an explicit args array.
    const src = readFileSync(
      fileURLToPath(new URL("../src/commands/update.ts", import.meta.url)),
      "utf-8",
    );

    // No `execSync("npm install -g ...` strings remain
    expect(src).not.toMatch(/execSync\(\s*["']npm install -g openspec/);
    // No `execAsync(` / `promisify(exec)` for npm commands
    expect(src).not.toMatch(/promisify\(exec\)/);
    // Commands go through the cross-spawn wrapper
    expect(src).toMatch(/from "\.\.\/shared\/exec\.js"/);
    expect(src).toMatch(/execFileAsync\s*\(\s*"npm"/);
    // No shell option remains
    expect(src).not.toMatch(/shell:\s*needsShell/);
  });

  it("npm pack uses args array (safe for Windows paths with spaces)", async () => {
    const src = readFileSync(
      fileURLToPath(new URL("../src/commands/update.ts", import.meta.url)),
      "utf-8",
    );
    // The old form: `npm pack openspec-playwright --pack-destination ${tmpDir}`
    expect(src).not.toMatch(/npm pack openspec-playwright --pack-destination \$\{/);
    // The new form: execFile with arg array
    expect(src).toMatch(/\["pack",\s*"openspec-playwright",\s*"--pack-destination",\s*tmpDir\]/);
  });

  it("catch blocks print err.message so users see real errors", async () => {
    const src = readFileSync(
      fileURLToPath(new URL("../src/commands/update.ts", import.meta.url)),
      "utf-8",
    );
    // New form: `catch (err)` that uses err.message
    const errCatches = (
      src.match(/catch\s*\(\s*err[^)]*\)\s*\{[\s\S]{0,200}err\.message/g) || []
    ).length;

    // At least 3 err.message uses (one per npm call site: cli update,
    // devDep sync, retry install).
    expect(errCatches).toBeGreaterThanOrEqual(3);
  });
});
describe("update.ts: checklist refresh source", () => {
  it("forwards the fetched tarball's checklist to installOrRefreshChecklist", () => {
    const src = readFileSync(
      fileURLToPath(new URL("../src/commands/update.ts", import.meta.url)),
      "utf-8",
    );
    // Captured from the extracted bundle in both sync branches...
    const captures = (
      src.match(/join\(\s*tmpDir,\s*"templates",\s*"lint-guidelines\.md"\s*\)/g) || []
    ).length;
    expect(captures).toBeGreaterThanOrEqual(2);
    // ...and handed to the checklist writer instead of letting it fall back to
    // the running (possibly older) package's bundled template.
    expect(src).toMatch(
      /installOrRefreshChecklist\(\s*projectRoot,\s*checklistTemplate/,
    );
  });
});

describe("update.ts: lint config ownership", () => {
  it("never references or rewrites ESLint/ruff config files (config belongs to the user)", () => {
    const src = readFileSync(
      fileURLToPath(new URL("../src/commands/update.ts", import.meta.url)),
      "utf-8",
    );
    expect(src).not.toMatch(/installLintConfig|LINT_ESLINT_CONFIG_FILE|LINT_RUFF_BLOCK/);
    expect(src).not.toMatch(/eslint\.config\.|ruff\.toml/);
  });
});

// ─── Drift-aware no-op behavior ───────────────────────────────────────────

describe("update.ts: drift-aware no-op", () => {
  const tmpDir = join(tmpdir(), "openspec-pw-noop-test-" + Date.now());
  const testsDir = join(tmpDir, "tests", "playwright");

  beforeEach(() => {
    mkdirSync(join(testsDir, "pages"), { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("BasePage.ts mtime unchanged when content already matches template", async () => {
    const { syncProjectTemplates } = await import("../../src/commands/update.js");
    const { statSync } = await import("fs");

    // Simulate a bundled template in a tmp dir
    const basePageSrc = join(tmpDir, "templates", "pages", "BasePage.ts");
    mkdirSync(join(tmpDir, "templates", "pages"), { recursive: true });
    const basePageContent = "export class BasePage {}";
    writeFileSync(basePageSrc, basePageContent);

    const basePageDest = join(testsDir, "pages", "BasePage.ts");
    writeFileSync(basePageDest, basePageContent);

    // Give the file a distinct mtime
    const before = statSync(basePageDest).mtimeMs;

    // Wait a few ms so a rewrite would be detectable
    await new Promise((r) => setTimeout(r, 20));

    syncProjectTemplates(tmpDir, tmpDir);

    const after = statSync(basePageDest).mtimeMs;
    expect(after).toBe(before); // no-op: mtime unchanged
  });

  it("BasePage.ts is rewritten when content differs", async () => {
    const { syncProjectTemplates } = await import("../../src/commands/update.js");
    const { statSync } = await import("fs");

    const basePageSrc = join(tmpDir, "templates", "pages", "BasePage.ts");
    mkdirSync(join(tmpDir, "templates", "pages"), { recursive: true });
    writeFileSync(basePageSrc, "export class BasePage {}");

    const basePageDest = join(testsDir, "pages", "BasePage.ts");
    writeFileSync(basePageDest, "export class OldBasePage {}");

    const before = statSync(basePageDest).mtimeMs;
    await new Promise((r) => setTimeout(r, 20));

    syncProjectTemplates(tmpDir, tmpDir);

    const after = statSync(basePageDest).mtimeMs;
    expect(after).not.toBe(before); // updated
    expect(readFileSync(basePageDest, "utf-8")).toBe("export class BasePage {}");
  });

  it("test-plan.template.md is generated when missing and refreshed on drift", async () => {
    const { syncProjectTemplates } = await import("../../src/commands/update.js");

    const planSrc = join(tmpDir, "templates", "test-plan.md");
    mkdirSync(join(tmpDir, "templates"), { recursive: true });
    writeFileSync(planSrc, "# Test Plan playbook v1");

    syncProjectTemplates(tmpDir, tmpDir);
    const dest = join(testsDir, "test-plan.template.md");
    expect(readFileSync(dest, "utf-8")).toBe("# Test Plan playbook v1");

    // Drift → refreshed.
    writeFileSync(planSrc, "# Test Plan playbook v2");
    syncProjectTemplates(tmpDir, tmpDir);
    expect(readFileSync(dest, "utf-8")).toBe("# Test Plan playbook v2");
  });
});

describe("update.ts: --no-mcp registered + --no-cli recursion", () => {
  it("index.ts registers --no-mcp for the update command", () => {
    const src = readFileSync(
      fileURLToPath(new URL("../src/index.ts", import.meta.url)),
      "utf-8",
    );
    expect(src).toMatch(/\.option\("--no-mcp",/);
  });

  it("update re-executes with --no-cli after a CLI update (self-restart)", () => {
    const src = readFileSync(
      fileURLToPath(new URL("../src/commands/update.ts", import.meta.url)),
      "utf-8",
    );
    // The self-restart must spawn `openspec-pw update --no-cli` so the new
    // binary runs the remaining phases without re-updating the CLI (no loop).
    expect(src).toMatch(/execFileSync\(\s*"openspec-pw",\s*reExecArgs/);
    // --no-mcp / --no-skill / --lang are forwarded to the restart so the
    // restarted process honors the user's flags (regression guard).
    expect(src).toMatch(/if \(options\.mcp === false\) reExecArgs\.push\("--no-mcp"\)/);
    expect(src).toMatch(/if \(options\.skill === false\) reExecArgs\.push\("--no-skill"\)/);
    expect(src).toMatch(/if \(options\.lang\) reExecArgs\.push\("--lang", options\.lang\)/);
    // Internal flow narration is not user-facing output.
    expect(src).not.toMatch(/Re-executing remaining steps/);
    expect(src).not.toMatch(/Post-update tasks completed/);
  });
});

describe("update.ts: drift coverage regression guards", () => {
  it("AGENTS.md is always evaluated per its own territory markers — not via detected adapters", () => {
    const src = readFileSync(
      fileURLToPath(new URL("../src/commands/update.ts", import.meta.url)),
      "utf-8",
    );
    // AGENTS.md path is always evaluated for staleness
    expect(src).toMatch(/const agentsPath = join\(projectRoot, "AGENTS\.md"\)/);
    // 标记即领土: no-marker AGENTS.md skips the write-back (no detected gate)
    expect(src).toMatch(/agentsInTerritory/);
    expect(src).toMatch(/already in sync/);
    // CLAUDE.md wrapper is gated on claude command-artifact authorization,
    // resolved in the current artifact style (1.x paths after a 2.x upgrade
    // are gone by the time the gate runs).
    expect(src).toMatch(/const claude = getAdapter\("claude"\) \?\? claudeAdapter/);
    expect(src).toMatch(/hasCommandArtifacts\(projectRoot, claude\)/);
  });

  it("no-marker AGENTS.md is skipped, not appended (标记即领土)", () => {
    const src = readFileSync(
      fileURLToPath(new URL("../src/commands/update.ts", import.meta.url)),
      "utf-8",
    );
    // The no-marker branch prints the init hint and never falls into the
    // stale-write path (which requires markers to be present).
    expect(src).toMatch(/has no OPENSPEC block/);
    expect(src).not.toMatch(
      /!fileContent\.includes\(OPENSPEC_START\) \|\|/,
    );
  });

  it("command and MCP phases gate on artifact authorization, not detection", () => {
    const src = readFileSync(
      fileURLToPath(new URL("../src/commands/update.ts", import.meta.url)),
      "utf-8",
    );
    expect(src).toMatch(/hasCommandArtifacts\(projectRoot, adapter\)/);
    // Unconfigured editors are skipped silently — no per-editor init hint.
    expect(src).not.toMatch(/not configured in this project/);
  });

  it("frontend-signal skip announces itself (no silent MCP skip in update)", () => {
    const src = readFileSync(
      fileURLToPath(new URL("../src/commands/update.ts", import.meta.url)),
      "utf-8",
    );
    expect(src).toMatch(
      /No frontend signal detected — skipping Playwright MCP/,
    );
  });

  it("zero-authorized Summary says configured, not detected (授权集不用检测措辞)", () => {
    const src = readFileSync(
      fileURLToPath(new URL("../src/commands/update.ts", import.meta.url)),
      "utf-8",
    );
    // editorsForHint is the AUTHORIZED set (hasCommandArtifacts) — the
    // zero-case line must not claim "detected" (a hand-created .claude/
    // marker dir can still be detectable with zero command artifacts).
    expect(src).toMatch(/No configured editors — nothing to restart/);
    expect(src).not.toMatch(/No supported editor detected — nothing to restart/);
  });

  it("Cursor skill extraArtifacts are included in command drift check", () => {
    const src = readFileSync(
      fileURLToPath(new URL("../src/commands/update.ts", import.meta.url)),
      "utf-8",
    );
    expect(src).toMatch(/adapter\.extraArtifacts\?\.\(meta\)/);
    expect(src).toMatch(/extra\.relativePath/);
  });
});

describe("update.ts: CodeGraph gap-aware hints", () => {
  it("renders hints via shared codegraphHintLines (single source of truth)", () => {
    const src = readFileSync(
      fileURLToPath(new URL("../src/commands/update.ts", import.meta.url)),
      "utf-8",
    );
    // The hint content lives in shared/codegraph.ts — update.ts must not
    // inline its own copy (drift guard).
    expect(src).toMatch(/codegraphHintLines\(cg\)/);
    expect(src).not.toMatch(/Refresh code index: codegraph sync/);
  });
});

describe("update.ts: single MCP server install (playwright-test)", () => {
  it("MCP phase installs the official test-runner server with frontend gate", () => {
    const src = readFileSync(
      fileURLToPath(new URL("../src/commands/update.ts", import.meta.url)),
      "utf-8",
    );
    // The official test-runner server is the only installed MCP server
    expect(src).toMatch(/ensureTestRunnerMcp/);
    expect(src).toMatch(/isTestRunnerMcpInstalled/);
    // Single-server layout: the legacy browser-control server is NOT
    // installed by update (it's a superset — 78 browser_* tools duplicated).
    expect(src).not.toMatch(/ensurePlaywrightMcp/);
    // Frontend gate mirrors init: API-only projects skip MCP install —
    // and the skip is announced, not silent.
    expect(src).toMatch(/hasFrontendSignal\(projectRoot\) !== true/);
    expect(src).toMatch(
      /No frontend signal detected — skipping Playwright MCP/,
    );
  });
});

// ─── minimal-mode first-class sync (init-minimal-mode) ────────────────────────

describe("update.ts: minimal-mode first-class sync", () => {
  const bundleDir = join(tmpdir(), "ospw-pw-minimal-bundle-" + Date.now());
  const tmpRoot = join(tmpdir(), "ospw-pw-minimal-root-" + Date.now());

  beforeEach(() => {
    mkdirSync(join(bundleDir, "templates"), { recursive: true });
    mkdirSync(join(bundleDir, "standards"), { recursive: true });
    mkdirSync(tmpRoot, { recursive: true });
    // Bundled templates in the fetched bundle dir.
    writeFileSync(join(bundleDir, "standards", "employee-standards.md"), "# Standards v2");
    writeFileSync(join(bundleDir, "standards", "employee-standards.en.md"), EN_STANDARDS_STUB);
    writeFileSync(join(bundleDir, "templates", "tests-readme.md"), "# Acceptance Tests v2\n");
  });

  afterEach(() => {
    rmSync(bundleDir, { recursive: true, force: true });
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("hasRuleFileMarkers: wrapper marker alone proves territory without command artifacts", async () => {
    const { hasRuleFileMarkers } = await import("../../src/commands/editors/project-rules.js");
    expect(hasRuleFileMarkers(tmpRoot)).toBe(false);
    writeFileSync(join(tmpRoot, "CLAUDE.md"), "<!-- OPENSPEC-PW:START -->\nwrapper\n<!-- OPENSPEC-PW:END -->");
    expect(hasRuleFileMarkers(tmpRoot)).toBe(true);
  });

  it("wrapperHasMarkers: bare @AGENTS.md import never counts", async () => {
    const { wrapperHasMarkers } = await import("../../src/commands/editors/project-rules.js");
    const { claudeAdapter } = await import("../../src/commands/editors.js");
    writeFileSync(join(tmpRoot, "CLAUDE.md"), "@AGENTS.md\n");
    expect(wrapperHasMarkers(claudeAdapter, tmpRoot)).toBe(false);
  });

  it("hasRuleFileMarkers: a bare signature mention in user prose is not territory", async () => {
    const { hasRuleFileMarkers } = await import("../../src/commands/editors/project-rules.js");
    // No markers at all — the phrase alone must not claim the file.
    writeFileSync(join(tmpRoot, "AGENTS.md"), "# My own AI Coding Assistant Employee-Grade Standards\n");
    expect(hasRuleFileMarkers(tmpRoot)).toBe(false);
    // Legacy block WITH the containment gate (legacy START) does count.
    writeFileSync(
      join(tmpRoot, "AGENTS.md"),
      "preamble\n<!-- OPENSPEC:START -->\n# Employee-Grade Standards\n<!-- OPENSPEC:END -->\n",
    );
    expect(hasRuleFileMarkers(tmpRoot)).toBe(true);
  });

  it("syncEmployeeStandards: refreshes the wrapper of a standards-only project", async () => {
    const { syncEmployeeStandards } = await import("../../src/commands/update.js");
    const { wrapperHasMarkers } = await import("../../src/commands/editors/project-rules.js");
    const { claudeAdapter } = await import("../../src/commands/editors.js");
    const { installClaudeWrapper, claudeWrapperStandardsContent } = await import("../../src/commands/editors.js");
    writeFileSync(join(tmpRoot, "AGENTS.md"), "# project agents");
    installClaudeWrapper(tmpRoot);
    expect(wrapperHasMarkers(claudeAdapter, tmpRoot)).toBe(true);
    // Simulate version drift: overwrite the marker block with outdated text.
    const claudePath = join(tmpRoot, "CLAUDE.md");
    writeFileSync(claudePath, "preamble\n<!-- OPENSPEC-PW:START -->\noutdated\n<!-- OPENSPEC-PW:END -->\n");

    // claudeAuthorized is computed by the caller as
    // hasCommandArtifacts(claude) || wrapperHasMarkers(claude, root) — this
    // fixture has no command artifacts, so the wrapper marker gates the sync.
    syncEmployeeStandards(bundleDir, tmpRoot, true, true, false, "zh");
    const refreshed = readFileSync(claudePath, "utf-8");
    // Marker block replaced with the bundled wrapper content; block-external
    // content (the preamble) is preserved.
    expect(refreshed).toContain("preamble\n");
    expect(refreshed).toContain("<!-- OPENSPEC-PW:START -->");
    expect(refreshed).toContain(claudeWrapperStandardsContent().trim());
    expect(refreshed).not.toContain("outdated");
  });

  it("syncEmployeeStandards: an unrecorded missing wrapper is still created", async () => {
    const { syncEmployeeStandards } = await import("../../src/commands/update.js");
    syncEmployeeStandards(bundleDir, tmpRoot, true, true, false, "zh");
    expect(existsSync(join(tmpRoot, "CLAUDE.md"))).toBe(true);
  });

  it("syncEmployeeStandards: a recorded rule-copy opt-out is not recreated", async () => {
    const { syncEmployeeStandards } = await import("../../src/commands/update.js");
    const { ensureGitignoreEntries } = await import("../../src/shared/gitignore-managed.js");
    writeFileSync(
      join(tmpRoot, "AGENTS.md"),
      "<!-- OPENSPEC-PW:START -->\nold\n<!-- OPENSPEC-PW:END -->\n",
    );
    ensureGitignoreEntries(tmpRoot, { skip: ["CLAUDE.md"] });
    syncEmployeeStandards(bundleDir, tmpRoot, true, true, false, "zh");
    expect(existsSync(join(tmpRoot, "CLAUDE.md"))).toBe(false);
  });

  it("syncProjectTemplates: hints on tests/README drift without overwriting (user README safe)", async () => {
    const { syncProjectTemplates } = await import("../../src/commands/update.js");
    mkdirSync(join(tmpRoot, "tests"), { recursive: true });
    writeFileSync(join(tmpRoot, "tests", "README.md"), "# my own readme\n");
    const logs: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      logs.push(args.join(" "));
    });
    try {
      syncProjectTemplates(bundleDir, tmpRoot);
    } finally {
      spy.mockRestore();
    }
    expect(readFileSync(join(tmpRoot, "tests", "README.md"), "utf-8")).toBe("# my own readme\n");
    expect(logs.some((l) => l.includes("tests/README.md differs from the bundled template"))).toBe(true);
  });

  it("syncProjectTemplates: README matching the template is a silent no-op", async () => {
    const { syncProjectTemplates } = await import("../../src/commands/update.js");
    mkdirSync(join(tmpRoot, "tests"), { recursive: true });
    writeFileSync(join(tmpRoot, "tests", "README.md"), "# Acceptance Tests v2\n");
    const logs: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      logs.push(args.join(" "));
    });
    try {
      syncProjectTemplates(bundleDir, tmpRoot);
    } finally {
      spy.mockRestore();
    }
    expect(logs.some((l) => l.includes("tests/README.md differs"))).toBe(false);
  });
});

describe("update.ts: minimal-mode block-removed alarm", () => {
  const bundleDir = join(tmpdir(), "ospw-pw-minimal-alarm-b-" + Date.now());
  const tmpRoot = join(tmpdir(), "ospw-pw-minimal-alarm-r-" + Date.now());

  beforeEach(() => {
    mkdirSync(bundleDir, { recursive: true });
    mkdirSync(join(bundleDir, "standards"), { recursive: true });
    mkdirSync(tmpRoot, { recursive: true });
    writeFileSync(join(bundleDir, "standards", "employee-standards.md"), "# Standards v2");
    writeFileSync(join(bundleDir, "standards", "employee-standards.en.md"), EN_STANDARDS_STUB);
    // Minimal-mode project whose AGENTS.md block was wiped externally, but
    // the CLAUDE.md wrapper marker survives → territory proven by markers.
    writeFileSync(
      join(tmpRoot, "CLAUDE.md"),
      "preamble\n<!-- OPENSPEC-PW:START -->\nwrapper\n<!-- OPENSPEC-PW:END -->\n",
    );
    writeFileSync(join(tmpRoot, "AGENTS.md"), "# project agents — block removed");
  });

  afterEach(() => {
    rmSync(bundleDir, { recursive: true, force: true });
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("prints the block-removed alarm for a minimal-mode project (no command artifacts)", async () => {
    const { syncEmployeeStandards } = await import("../../src/commands/update.js");
    const { wrapperHasMarkers, hasRuleFileMarkers } = await import(
      "../../src/commands/editors/project-rules.js"
    );
    const { claudeAdapter } = await import("../../src/commands/editors.js");
    expect(hasRuleFileMarkers(tmpRoot)).toBe(true);
    // Caller computes: claudeAuthorized = ... || wrapperHasMarkers(claude, root),
    // hasPwArtifacts = ... || hasRuleFileMarkers(root) — both true here with
    // zero command artifacts.
    const logs: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      logs.push(args.join(" "));
    });
    try {
      syncEmployeeStandards(
        bundleDir,
        tmpRoot,
        wrapperHasMarkers(claudeAdapter, tmpRoot),
        true,
        false,
        "zh",
      );
    } finally {
      spy.mockRestore();
    }
    expect(
      logs.some((l) =>
        l.includes("AGENTS.md has no OPENSPEC-PW block — the employee-grade standards block is missing"),
      ),
    ).toBe(true);
  });
});

// ─── syncCommandArtifacts (update refresh, per-adapter) ──────────────────────

describe("staleFullRulesAdapters", () => {
  let projectDir: string;

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), "ospw-pw-stale-full-rules-"));
  });

  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true });
  });

  it("does not read a full-rules file beyond the ownership cap", async () => {
    const { staleFullRulesAdapters } = await import(
      "../../src/commands/update.js"
    );
    const big =
      "<!-- OPENSPEC-PW:START -->\n" +
      "x".repeat(1024 * 1024) +
      "\n<!-- OPENSPEC-PW:END -->\n";
    writeFileSync(join(projectDir, "GEMINI.md"), big);

    expect(staleFullRulesAdapters(projectDir, "standards")).toEqual([]);
  });
});

describe("syncCommandArtifacts", () => {
  let projectDir: string;

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), "openspec-pw-sync-cmd-"));
  });

  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true });
  });

  it("refreshes a stale MiniMax Code skill to the latest template", async () => {
    const { syncCommandArtifacts } = await import("../../src/commands/update.js");
    const { getMinimaxSkillPath } = await import(
      "../../src/commands/editors.js"
    );

    // A stale skill from an earlier install — the artifact exists, so the
    // editor is authorized and update maintains (not expands) its territory.
    const skillPath = join(projectDir, getMinimaxSkillPath("e2e"));
    mkdirSync(join(projectDir, ".agents", "skills", "opsx-e2e"), {
      recursive: true,
    });
    writeFileSync(skillPath, "---\nname: opsx-e2e\n---\n\nstale body\n");

    syncCommandArtifacts(projectDir, "fresh body with /opsx:e2e reference\n");

    const updated = readFileSync(skillPath, "utf-8");
    expect(updated).toContain("fresh body with /opsx-e2e reference");
    expect(updated).not.toContain("stale body");
  });

  it("leaves an up-to-date skill untouched", async () => {
    const { syncCommandArtifacts } = await import("../../src/commands/update.js");
    const { getMinimaxSkillPath, formatMinimaxSkill, buildCommandMeta } =
      await import("../../src/commands/editors.js");

    const body = "current body\n";
    const skillPath = join(projectDir, getMinimaxSkillPath("e2e"));
    mkdirSync(join(projectDir, ".agents", "skills", "opsx-e2e"), {
      recursive: true,
    });
    writeFileSync(skillPath, formatMinimaxSkill(buildCommandMeta(body)));

    syncCommandArtifacts(projectDir, body);

    expect(readFileSync(skillPath, "utf-8")).toBe(
      formatMinimaxSkill(buildCommandMeta(body)),
    );
  });

  it("does not create a skill for an editor that has no artifacts", async () => {
    const { syncCommandArtifacts } = await import("../../src/commands/update.js");
    const { getMinimaxSkillPath } = await import(
      "../../src/commands/editors.js"
    );

    syncCommandArtifacts(projectDir, "body\n");

    expect(existsSync(join(projectDir, getMinimaxSkillPath("e2e")))).toBe(
      false,
    );
  });

  it("reports the unchanged count and stays silent about unconfigured editors", async () => {
    const { syncCommandArtifacts } = await import("../../src/commands/update.js");
    const { getAdapter, buildCommandMeta } = await import(
      "../../src/commands/editors.js"
    );

    const body = "current body\n";
    const meta = buildCommandMeta(body);
    const adapter = getAdapter("minimax")!;
    const skillPath = join(projectDir, adapter.commandFilePath(meta.id));
    mkdirSync(dirname(skillPath), { recursive: true });
    writeFileSync(skillPath, adapter.formatCommand(meta));

    const logs: string[] = [];
    const logSpy = vi
      .spyOn(console, "log")
      .mockImplementation((...args: unknown[]) => logs.push(args.join(" ")));
    try {
      const unchanged = syncCommandArtifacts(projectDir, body);
      // MiniMax and Codex share the same skill file, so both read as current.
      expect(unchanged).toBe(2);
      expect(logs.some((l) => l.includes("not configured in this project"))).toBe(false);
      expect(logs.some((l) => l.includes("already current"))).toBe(false);
    } finally {
      logSpy.mockRestore();
    }
  });
});

describe("update: OpenSpec CLI version", () => {
  it("does not warn about a healthy 2.x CLI", async () => {
    const { openSpecCliStatus } = await import(
      "../src/shared/openspec-version.js"
    );
    vi.mocked(openSpecCliStatus).mockReturnValue({ ok: true, major: 2 });
    const projectDir = mkdtempSync(join(tmpdir(), "ospw-update-cli2-"));
    mkdirSync(join(projectDir, "openspec"), { recursive: true });
    const cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(projectDir);
    const logs: string[] = [];
    const logSpy = vi.spyOn(console, "log").mockImplementation((...args) => {
      logs.push(args.join(" "));
    });
    try {
      const { update } = await import("../../src/commands/update.js");
      await update({ cli: false, skill: false, mcp: false });
    } finally {
      logSpy.mockRestore();
      cwdSpy.mockRestore();
      vi.mocked(openSpecCliStatus).mockReset();
      rmSync(projectDir, { recursive: true, force: true });
    }
    expect(logs.join("\n")).not.toContain("⚠ OpenSpec");
  });
});

// ─── 1.x → 2.x migration during update ────────────────────────────────────

describe("update: 1.x → 2.x e2e migration", () => {
  it("replaces a pristine 1.x command with the 2.x artifact", async () => {
    const { openSpecCliStatus } = await import(
      "../src/shared/openspec-version.js"
    );
    vi.mocked(openSpecCliStatus).mockReturnValue({ ok: true, major: 2 });
    const { syncE2eCommands } = await import("../../src/commands/update.js");
    const { buildCommandMeta, getAdapter, installCommand } = await import(
      "../../src/commands/editors.js"
    );
    const projectDir = mkdtempSync(join(tmpdir(), "ospw-update-migrate-"));
    const body = readFileSync(
      join(
        fileURLToPath(import.meta.url),
        "..",
        "..",
        "templates",
        "e2e-command.md",
      ),
      "utf-8",
    );
    const meta = buildCommandMeta(body);
    const old = getAdapter("claude", "opsx")!;
    const next = getAdapter("claude", "openspec")!;
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      installCommand(old, meta, projectDir);
      const installed = syncE2eCommands(projectDir, body);
      expect(installed).toBe(true);
      expect(existsSync(join(projectDir, old.commandFilePath("e2e")))).toBe(
        false,
      );
      expect(
        readFileSync(join(projectDir, next.commandFilePath("e2e")), "utf-8"),
      ).toContain("/openspec-e2e");
    } finally {
      logSpy.mockRestore();
      vi.mocked(openSpecCliStatus).mockReset();
      rmSync(projectDir, { recursive: true, force: true });
    }
  });

  it("migrates the shared .agents skill, which never authorizes a write", async () => {
    const { openSpecCliStatus } = await import(
      "../src/shared/openspec-version.js"
    );
    vi.mocked(openSpecCliStatus).mockReturnValue({ ok: true, major: 2 });
    const { syncE2eCommands } = await import("../../src/commands/update.js");
    const { buildCommandMeta, getAdapter, installCommand } = await import(
      "../../src/commands/editors.js"
    );
    const projectDir = mkdtempSync(join(tmpdir(), "ospw-update-shared-"));
    const body = readFileSync(
      join(
        fileURLToPath(import.meta.url),
        "..",
        "..",
        "templates",
        "e2e-command.md",
      ),
      "utf-8",
    );
    const meta = buildCommandMeta(body);
    const oldShared = join(projectDir, ".agents", "skills", "opsx-e2e", "SKILL.md");
    const newShared = join(
      projectDir,
      ".agents",
      "skills",
      "openspec-e2e",
      "SKILL.md",
    );
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      installCommand(getAdapter("codex", "opsx")!, meta, projectDir);
      expect(syncE2eCommands(projectDir, body)).toBe(true);
      expect(existsSync(oldShared)).toBe(false);
      expect(readFileSync(newShared, "utf-8")).toContain("/openspec-e2e");
    } finally {
      logSpy.mockRestore();
      vi.mocked(openSpecCliStatus).mockReset();
      rmSync(projectDir, { recursive: true, force: true });
    }
  });
});

// ─── bundle source & CLI freshness decisions ────────────────────────────────

describe("update: where the content comes from", () => {
  it("uses the running package when it is the published latest", async () => {
    const { chooseBundleSource } = await import("../../src/commands/update.js");
    expect(chooseBundleSource("1.2.3", "1.2.3", true)).toBe("local");
  });

  it("fetches the published package when the running copy is behind", async () => {
    const { chooseBundleSource } = await import("../../src/commands/update.js");
    expect(chooseBundleSource("1.2.3", "1.2.2", true)).toBe("pack");
  });

  it("falls back to the running package when the registry is unreachable", async () => {
    const { chooseBundleSource } = await import("../../src/commands/update.js");
    expect(chooseBundleSource(undefined, "1.2.2", true)).toBe("local");
  });

  it("fetches when the running package carries no templates", async () => {
    const { chooseBundleSource } = await import("../../src/commands/update.js");
    expect(chooseBundleSource("1.2.3", "1.2.3", false)).toBe("pack");
  });

  it("skips the install only when the global copy is the published latest", async () => {
    const { isCliCurrent } = await import("../../src/commands/update.js");
    expect(isCliCurrent("1.2.3", "1.2.3")).toBe(true);
    expect(isCliCurrent("1.2.2", "1.2.3")).toBe(false);
    expect(isCliCurrent(undefined, "1.2.3")).toBe(false);
    expect(isCliCurrent("1.2.3", undefined)).toBe(false);
  });
});
