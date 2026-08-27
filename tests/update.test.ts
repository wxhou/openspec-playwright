import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { fileURLToPath } from "url";

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
    writeFileSync(join(src, "credentials.yaml"), "api: http://localhost\nusers: []");

    const { syncCredentials } = await import("../../src/commands/update.js");
    syncCredentials(tmpDir, projectDir);

    expect(existsSync(join(projectDir, "tests", "playwright", "credentials.yaml"))).toBe(true);
    rmSync(projectDir, { recursive: true, force: true });
  });

  it("preserves user credentials when updating existing file", async () => {
    const projectDir = join(tmpdir(), "creds-preserve-project-" + Date.now());
    mkdirSync(join(projectDir, "tests", "playwright"), { recursive: true });

    // Existing credentials with user data
    const existingCreds = `api: http://localhost:3000
users:
  - name: admin
    username: admin@test.com
    password: secret123
`;
    writeFileSync(join(projectDir, "tests", "playwright", "credentials.yaml"), existingCreds);

    // New template - must include `# Multi-user` comment for replace pattern
    const src = join(tmpDir, "templates");
    mkdirSync(src, { recursive: true });
    writeFileSync(join(src, "credentials.yaml"), `api: CHANGE_ME
# Multi-user test credentials
users:
  - name: CHANGE_ME
    username: CHANGE_ME
    password: CHANGE_ME

  # Multi-user example (uncomment for role-based tests)
`);

    const { syncCredentials } = await import("../../src/commands/update.js");
    syncCredentials(tmpDir, projectDir);

    const updated = readFileSync(join(projectDir, "tests", "playwright", "credentials.yaml"), "utf-8");
    expect(updated).toContain("http://localhost:3000"); // preserved api
    expect(updated).toContain("admin@test.com"); // preserved user
    expect(updated).toContain("secret123"); // preserved password
    rmSync(projectDir, { recursive: true, force: true });
  });

  it("creates backup of existing credentials before update", async () => {
    const projectDir = join(tmpdir(), "creds-backup-project-" + Date.now());
    mkdirSync(join(projectDir, "tests", "playwright"), { recursive: true });

    const existingCreds = `api: http://localhost:3000
users:
  - name: admin
    username: admin@test.com
    password: secret123
`;
    writeFileSync(join(projectDir, "tests", "playwright", "credentials.yaml"), existingCreds);

    const src = join(tmpDir, "templates");
    mkdirSync(src, { recursive: true });
    writeFileSync(join(src, "credentials.yaml"), `api: NEW_API
users:
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

    const templateContent = `api: CHANGE_ME
users:
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

// ─── User data extraction regex (testing the logic) ──────────────────────────

describe("credentials user extraction logic", () => {
  it("extracts users from yaml with multiple entries", () => {
    const yaml = `api: http://localhost
users:
  - name: admin
    username: admin@test.com
    password: secret123

  - name: user2
    username: user2@test.com
    password: pass456
`;
    // Same pattern as syncCredentials in update.ts
    const regex = /^  - name:\s*(\S+)\n    username:\s*(.+?)\n    password:\s*(.+?)(?:\n|$)/gm;
    const matches: { name: string; username: string; password: string }[] = [];
    let m;
    while ((m = regex.exec(yaml)) !== null) {
      matches.push({ name: m[1], username: m[2].trim(), password: m[3].trim() });
    }
    expect(matches).toHaveLength(2);
    expect(matches[0]).toEqual({ name: "admin", username: "admin@test.com", password: "secret123" });
    expect(matches[1]).toEqual({ name: "user2", username: "user2@test.com", password: "pass456" });
  });

  it("handles yaml with no users section", () => {
    const yaml = `api: http://localhost
other: value
`;
    const userBlockMatch = yaml.match(/^users:\n([\s\S]*?)(?=\n[^ ])/m);
    expect(userBlockMatch).toBeNull();
  });

  it("extracts api value from credentials yaml", () => {
    const yaml = `api: http://localhost:3000
users:
  - name: admin
    username: admin@test.com
    password: secret
`;
    const apiMatch = yaml.match(/^api:\s*(.+?)(?:\n|$)/m);
    expect(apiMatch).not.toBeNull();
    expect(apiMatch![1].trim()).toBe("http://localhost:3000");
  });

  it("handles yaml with api that contains CHANGE_ME placeholder", () => {
    const yaml = `api: CHANGE_ME
users:
  - name: test
    username: CHANGE_ME
    password: CHANGE_ME
`;
    const apiMatch = yaml.match(/^api:\s*(.+?)(?:\n|$)/m);
    expect(apiMatch![1].trim()).toBe("CHANGE_ME");
    expect(apiMatch![1].includes("CHANGE_ME")).toBe(true);
  });
});

// ─── execFile migration ────────────────────────────────────────────────────
// Verifies the npm/install and npm/pack calls in update.ts use execFile
// (no shell) and accept the exact same args used at runtime.

describe("update.ts: npm spawn calls (execFile, no shell)", () => {
  it("calls npm with install -g openspec-playwright@latest (not a shell string)", async () => {
    // Read the source and confirm: no execSync string interpolation,
    // execFile used with explicit args array.
    const src = readFileSync(
      fileURLToPath(new URL("../src/commands/update.ts", import.meta.url)),
      "utf-8",
    );

    // No `execSync("npm install -g ...` strings remain
    expect(src).not.toMatch(/execSync\(\s*["']npm install -g openspec/);
    // No `execAsync(` / `promisify(exec)` for npm commands
    expect(src).not.toMatch(/promisify\(exec\)/);
    // Windows-safe form: execFileAsync("npm", ..., { shell: needsShell })
    expect(src).toMatch(/execFileAsync\s*\(\s*"npm"/);
    // Every npm call includes shell: needsShell for Windows
    const npmCallsWithShell = (src.match(/execFileAsync\s*\(\s*"npm"[\s\S]{0,300}shell: needsShell/g) || []).length;
    expect(npmCallsWithShell).toBeGreaterThanOrEqual(3);
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
    // --no-mcp / --no-skill are forwarded to the restart so the restarted
    // process honors the user's skip flags (regression guard).
    expect(src).toMatch(/if \(options\.mcp === false\) reExecArgs\.push\("--no-mcp"\)/);
    expect(src).toMatch(/if \(options\.skill === false\) reExecArgs\.push\("--no-skill"\)/);
  });
});

describe("update.ts: drift coverage regression guards", () => {
  it("AGENTS.md is always checked (SSOT) — not only via detected adapters", () => {
    const src = readFileSync(
      fileURLToPath(new URL("../src/commands/update.ts", import.meta.url)),
      "utf-8",
    );
    // AGENTS.md path is always evaluated for staleness
    expect(src).toMatch(/const agentsPath = join\(projectRoot, "AGENTS\.md"\)/);
    // A claude-only project still checks AGENTS.md (SSOT)
    expect(src).toMatch(/detected\.length === 0/);
    expect(src).toMatch(/already in sync/);
  });

  it("no-marker AGENTS.md is treated as stale (needs append)", () => {
    const src = readFileSync(
      fileURLToPath(new URL("../src/commands/update.ts", import.meta.url)),
      "utf-8",
    );
    expect(src).toMatch(/!fileContent\.includes\(OPENSPEC_START\) \|\|/);
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
    // Frontend gate mirrors init: API-only projects skip MCP install
    expect(src).toMatch(/hasFrontendSignal\(projectRoot\) === true/);
  });
});
