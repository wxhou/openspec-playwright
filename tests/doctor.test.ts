import { describe, it, expect } from "vitest";

// ─── Doctor check logic tests ─────────────────────────────────────────────────
// Test the structured data that doctor collects (pure logic, no mocks needed)
//
// The doctor command is tested via smoke tests (CLI runs correctly).
// These tests verify the data structure and logic independently.

describe("doctor check logic", () => {
  // Simulate the check-building logic from doctor.ts
  function buildChecks(opts: {
    nodeOk: boolean;
    npmOk: boolean;
    openspecOk: boolean;
    playwrightOk: boolean;
    pwTestOk: boolean;
    mcpOk: boolean;
    skillOk: boolean;
    seedOk: boolean;
  }) {
    const checks = [];

    checks.push({ category: "Node.js", name: "node", ok: opts.nodeOk, message: opts.nodeOk ? "v20.0.0" : "not found" });
    checks.push({ category: "npm", name: "npm", ok: opts.npmOk, message: opts.npmOk ? "11.0.0" : "not found" });
    checks.push({ category: "OpenSpec", name: "openspec", ok: opts.openspecOk, message: opts.openspecOk ? "initialized" : "not initialized" });
    checks.push({ category: "Playwright Browsers", name: "playwright", ok: opts.playwrightOk, message: opts.playwrightOk ? "v20.0.0" : "not installed" });
    checks.push({ category: "Playwright Test", name: "playwright-test", ok: opts.pwTestOk, message: opts.pwTestOk ? "installed" : "not installed" });
    checks.push({ category: "Playwright MCP", name: "playwright-mcp", ok: opts.mcpOk, message: opts.mcpOk ? "installed" : "not configured" });
    checks.push({ category: "Claude Code Skill", name: "skill", ok: opts.skillOk, message: opts.skillOk ? "installed" : "not installed" });
    checks.push({ category: "Seed Test", name: "seed", ok: opts.seedOk, message: opts.seedOk ? "found" : "not found (optional)" });

    const allOk = checks.filter((c) => !c.ok && c.category !== "Seed Test").length === 0;
    return { ok: allOk, checks };
  }

  it("all checks pass → ok is true", () => {
    const result = buildChecks({
      nodeOk: true, npmOk: true, openspecOk: true,
      playwrightOk: true, pwTestOk: true, mcpOk: true, skillOk: true, seedOk: true,
    });
    expect(result.ok).toBe(true);
  });

  it("node fails → ok is false", () => {
    const result = buildChecks({
      nodeOk: false, npmOk: true, openspecOk: true,
      playwrightOk: true, pwTestOk: true, mcpOk: true, skillOk: true, seedOk: true,
    });
    expect(result.ok).toBe(false);
  });

  it("npm fails → ok is false", () => {
    const result = buildChecks({
      nodeOk: true, npmOk: false, openspecOk: true,
      playwrightOk: true, pwTestOk: true, mcpOk: true, skillOk: true, seedOk: true,
    });
    expect(result.ok).toBe(false);
  });

  it("openspec missing → ok is false", () => {
    const result = buildChecks({
      nodeOk: true, npmOk: true, openspecOk: false,
      playwrightOk: true, pwTestOk: true, mcpOk: true, skillOk: true, seedOk: true,
    });
    expect(result.ok).toBe(false);
  });

  it("playwright missing → ok is false", () => {
    const result = buildChecks({
      nodeOk: true, npmOk: true, openspecOk: true,
      playwrightOk: false, pwTestOk: true, mcpOk: true, skillOk: true, seedOk: true,
    });
    expect(result.ok).toBe(false);
  });

  it("mcp missing → ok is false", () => {
    const result = buildChecks({
      nodeOk: true, npmOk: true, openspecOk: true,
      playwrightOk: true, pwTestOk: true, mcpOk: false, skillOk: true, seedOk: true,
    });
    expect(result.ok).toBe(false);
  });

  it("skill missing → ok is false", () => {
    const result = buildChecks({
      nodeOk: true, npmOk: true, openspecOk: true,
      playwrightOk: true, pwTestOk: true, mcpOk: true, skillOk: false, seedOk: true,
    });
    expect(result.ok).toBe(false);
  });

  it("seed missing is optional → ok is still true", () => {
    const result = buildChecks({
      nodeOk: true, npmOk: true, openspecOk: true,
      playwrightOk: true, pwTestOk: true, mcpOk: true, skillOk: true, seedOk: false,
    });
    expect(result.ok).toBe(true);
  });

  it("multiple failures → ok is false", () => {
    const result = buildChecks({
      nodeOk: false, npmOk: false, openspecOk: false,
      playwrightOk: false, pwTestOk: true, mcpOk: false, skillOk: false, seedOk: false,
    });
    expect(result.ok).toBe(false);
  });

  it("has all 7 check categories", () => {
    const result = buildChecks({
      nodeOk: true, npmOk: true, openspecOk: true,
      playwrightOk: true, pwTestOk: true, mcpOk: true, skillOk: true, seedOk: true,
    });
    expect(result.checks).toHaveLength(8);
    const categories = result.checks.map((c) => c.category);
    expect(categories).toContain("Node.js");
    expect(categories).toContain("npm");
    expect(categories).toContain("OpenSpec");
    expect(categories).toContain("Playwright Browsers");
    expect(categories).toContain("Playwright MCP");
    expect(categories).toContain("Claude Code Skill");
    expect(categories).toContain("Playwright Test");
    expect(categories).toContain("Seed Test");
  });

  it("every check has ok, message, name, category fields", () => {
    const result = buildChecks({
      nodeOk: true, npmOk: true, openspecOk: true,
      playwrightOk: true, pwTestOk: true, mcpOk: true, skillOk: true, seedOk: true,
    });
    for (const check of result.checks) {
      expect(check).toHaveProperty("ok");
      expect(check).toHaveProperty("message");
      expect(check).toHaveProperty("name");
      expect(check).toHaveProperty("category");
      expect(typeof check.ok).toBe("boolean");
      expect(typeof check.message).toBe("string");
    }
  });
});

// ─── npx detection: execFile migration ────────────────────────────────────
// Guards the Windows-safe form of `npx playwright --version`.

describe("doctor.ts: all child_process calls use execFileSync with shell: needsShell", () => {
  it("no execSync imports or calls remain", async () => {
    const { readFileSync } = await import("fs");
    const { fileURLToPath } = await import("url");
    const { join } = await import("path");
    const src = readFileSync(
      join(
        fileURLToPath(import.meta.url),
        "../../src/commands/doctor.ts",
      ),
      "utf-8",
    );
    // No execSync import
    expect(src).not.toMatch(/execSync/);
    // No shell string calls
    expect(src).not.toMatch(/execFileSync\([^)]*"[^"]* --/);
    // All execFileSync calls use shell: needsShell
    const callsWithShell = (src.match(/execFileSync\s*\(\s*"[^"]+",\s*\[[^\]]+\],\s*\{[^}]*shell: needsShell/g) || []).length;
    expect(callsWithShell).toBeGreaterThanOrEqual(3);
  });
});

// ─── Sync category (drift detection) ──────────────────────────────────────

describe("doctor.ts: Sync category wiring", () => {
  it("references compareBlock + bundledStandardsPath for standards drift", async () => {
    const { readFileSync } = await import("fs");
    const { fileURLToPath } = await import("url");
    const { join } = await import("path");
    const src = readFileSync(
      join(fileURLToPath(import.meta.url), "../../src/commands/doctor.ts"),
      "utf-8",
    );
    expect(src).toMatch(/import .*compareBlock.*from "\.\.\/shared\/drift\.js"/s);
    expect(src).toMatch(/import .*bundledStandardsPath.*from "\.\.\/shared\/drift\.js"/s);
    // Sync category emitted
    expect(src).toMatch(/category: "Sync"/);
    // Neutral wording (manual edit OR old template) — never blames the user
    expect(src).toMatch(/OPENSPEC block differs from bundled version/);
  });

  it("gates Sync check on 'initialized' so uninitialized projects are not blocked", async () => {
    const { readFileSync } = await import("fs");
    const { fileURLToPath } = await import("url");
    const { join } = await import("path");
    const src = readFileSync(
      join(fileURLToPath(import.meta.url), "../../src/commands/doctor.ts"),
      "utf-8",
    );
    expect(src).toMatch(/not initialized \(run openspec-pw init first\)/);
    expect(src).toMatch(/initialized\s*=\s*hasCommand\s*\|\|\s*hasOpenSpec/);
  });
});

// ─── Fallback command hint ──────────────────────────────────────────────────
// The no-editor-detected fallback is the one place a user is told the exact
// command to type, so each editor must be listed with the command form it
// actually accepts: only Claude Code and CodeBuddy CLI use the colon form.

describe("doctor.ts: fallback command hint", () => {
  it("groups every adapter by the command form it accepts", async () => {
    const { allEditorCommandHints } = await import("../src/commands/doctor.js");
    const { getAllAdapters, slashCommandForAdapter } = await import(
      "../src/commands/editors.js"
    );

    const hint = allEditorCommandHints();
    const groups = new Map<string, string[]>();
    for (const group of hint.split("  or  ")) {
      const match = /^(\/opsx[:-]e2e) \(in (.+)\)$/.exec(group);
      expect(match, `unparsable hint group: ${group}`).not.toBeNull();
      groups.set(match![1], match![2].split(/, or |, | or /));
    }

    const colon = groups.get("/opsx:e2e") ?? [];
    const hyphen = groups.get("/opsx-e2e") ?? [];
    expect(colon.sort()).toEqual(["Claude Code", "CodeBuddy CLI"]);
    expect(hyphen.sort()).toEqual([
      "Cline",
      "Cursor",
      "MiniMax Code",
      "Oh My Pi",
      "OpenCode",
      "Pi",
    ]);

    // Every registered adapter is listed exactly once, under its own form.
    const mentioned = [...colon, ...hyphen];
    expect(mentioned.length).toBe(getAllAdapters().length);
    for (const adapter of getAllAdapters()) {
      const group =
        slashCommandForAdapter(adapter) === "/opsx:e2e" ? colon : hyphen;
      expect(group).toContain(adapter.displayName);
    }
  });

  it("no longer hardcodes the colon form for every editor", async () => {
    const { readFileSync } = await import("fs");
    const { fileURLToPath } = await import("url");
    const { join } = await import("path");
    const src = readFileSync(
      join(fileURLToPath(import.meta.url), "../../src/commands/doctor.ts"),
      "utf-8",
    );
    expect(src).not.toContain("/opsx:e2e (in Claude Code, OpenCode");
  });
});
