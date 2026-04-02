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
    mcpOk: boolean;
    skillOk: boolean;
    seedOk: boolean;
  }) {
    const checks = [];

    checks.push({ category: "Node.js", name: "node", ok: opts.nodeOk, message: opts.nodeOk ? "v20.0.0" : "not found" });
    checks.push({ category: "npm", name: "npm", ok: opts.npmOk, message: opts.npmOk ? "11.0.0" : "not found" });
    checks.push({ category: "OpenSpec", name: "openspec", ok: opts.openspecOk, message: opts.openspecOk ? "initialized" : "not initialized" });
    checks.push({ category: "Playwright Browsers", name: "playwright", ok: opts.playwrightOk, message: opts.playwrightOk ? "v20.0.0" : "not installed" });
    checks.push({ category: "Playwright MCP", name: "playwright-mcp", ok: opts.mcpOk, message: opts.mcpOk ? "installed" : "not configured" });
    checks.push({ category: "Claude Code Skill", name: "skill", ok: opts.skillOk, message: opts.skillOk ? "installed" : "not installed" });
    checks.push({ category: "Seed Test", name: "seed", ok: opts.seedOk, message: opts.seedOk ? "found" : "not found (optional)" });

    const allOk = checks.filter((c) => !c.ok && c.category !== "Seed Test").length === 0;
    return { ok: allOk, checks };
  }

  it("all checks pass → ok is true", () => {
    const result = buildChecks({
      nodeOk: true, npmOk: true, openspecOk: true,
      playwrightOk: true, mcpOk: true, skillOk: true, seedOk: true,
    });
    expect(result.ok).toBe(true);
  });

  it("node fails → ok is false", () => {
    const result = buildChecks({
      nodeOk: false, npmOk: true, openspecOk: true,
      playwrightOk: true, mcpOk: true, skillOk: true, seedOk: true,
    });
    expect(result.ok).toBe(false);
  });

  it("npm fails → ok is false", () => {
    const result = buildChecks({
      nodeOk: true, npmOk: false, openspecOk: true,
      playwrightOk: true, mcpOk: true, skillOk: true, seedOk: true,
    });
    expect(result.ok).toBe(false);
  });

  it("openspec missing → ok is false", () => {
    const result = buildChecks({
      nodeOk: true, npmOk: true, openspecOk: false,
      playwrightOk: true, mcpOk: true, skillOk: true, seedOk: true,
    });
    expect(result.ok).toBe(false);
  });

  it("playwright missing → ok is false", () => {
    const result = buildChecks({
      nodeOk: true, npmOk: true, openspecOk: true,
      playwrightOk: false, mcpOk: true, skillOk: true, seedOk: true,
    });
    expect(result.ok).toBe(false);
  });

  it("mcp missing → ok is false", () => {
    const result = buildChecks({
      nodeOk: true, npmOk: true, openspecOk: true,
      playwrightOk: true, mcpOk: false, skillOk: true, seedOk: true,
    });
    expect(result.ok).toBe(false);
  });

  it("skill missing → ok is false", () => {
    const result = buildChecks({
      nodeOk: true, npmOk: true, openspecOk: true,
      playwrightOk: true, mcpOk: true, skillOk: false, seedOk: true,
    });
    expect(result.ok).toBe(false);
  });

  it("seed missing is optional → ok is still true", () => {
    const result = buildChecks({
      nodeOk: true, npmOk: true, openspecOk: true,
      playwrightOk: true, mcpOk: true, skillOk: true, seedOk: false,
    });
    expect(result.ok).toBe(true);
  });

  it("multiple failures → ok is false", () => {
    const result = buildChecks({
      nodeOk: false, npmOk: false, openspecOk: false,
      playwrightOk: false, mcpOk: false, skillOk: false, seedOk: false,
    });
    expect(result.ok).toBe(false);
  });

  it("has all 7 check categories", () => {
    const result = buildChecks({
      nodeOk: true, npmOk: true, openspecOk: true,
      playwrightOk: true, mcpOk: true, skillOk: true, seedOk: true,
    });
    expect(result.checks).toHaveLength(7);
    const categories = result.checks.map((c) => c.category);
    expect(categories).toContain("Node.js");
    expect(categories).toContain("npm");
    expect(categories).toContain("OpenSpec");
    expect(categories).toContain("Playwright Browsers");
    expect(categories).toContain("Playwright MCP");
    expect(categories).toContain("Claude Code Skill");
    expect(categories).toContain("Seed Test");
  });

  it("every check has ok, message, name, category fields", () => {
    const result = buildChecks({
      nodeOk: true, npmOk: true, openspecOk: true,
      playwrightOk: true, mcpOk: true, skillOk: true, seedOk: true,
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
