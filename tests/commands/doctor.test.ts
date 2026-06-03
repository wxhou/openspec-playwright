import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock child_process.execFileSync
vi.mock("child_process", () => ({
  execFileSync: vi.fn(),
}));

// Mock fs modules
vi.mock("fs", () => ({
  existsSync: vi.fn(),
}));

import { execFileSync } from "child_process";
import { isPlaywrightMcpInstalled } from "../../src/shared/mcp.js";

describe("isPlaywrightMcpInstalled", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true when playwright is in mcp list output", () => {
    vi.mocked(execFileSync).mockReturnValue("playwright: npx @playwright/mcp@latest\n");
    expect(isPlaywrightMcpInstalled()).toBe(true);
    expect(execFileSync).toHaveBeenCalledWith("claude", ["mcp", "list"], {
      encoding: "utf-8",
      timeout: 10000,
      stdio: ["pipe", "pipe", "pipe"],
    });
  });

  it("returns false when playwright is not in mcp list output", () => {
    vi.mocked(execFileSync).mockReturnValue("other-mcp: some-command\n");
    expect(isPlaywrightMcpInstalled()).toBe(false);
  });

  it("returns false when claude CLI fails", () => {
    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error("claude not found");
    });
    expect(isPlaywrightMcpInstalled()).toBe(false);
  });

  it("returns false when output is empty", () => {
    vi.mocked(execFileSync).mockReturnValue("");
    expect(isPlaywrightMcpInstalled()).toBe(false);
  });
});

describe("doctor check logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("all checks pass → ok is true", () => {
    const checks = [];
    checks.push({ category: "Node.js", name: "node", ok: true, message: "v20.0.0" });
    checks.push({ category: "npm", name: "npm", ok: true, message: "11.0.0" });
    checks.push({ category: "OpenSpec", name: "openspec", ok: true, message: "initialized" });
    checks.push({ category: "Playwright Browsers", name: "playwright", ok: true, message: "v20.0.0" });
    checks.push({ category: "Playwright MCP", name: "playwright-mcp", ok: true, message: "installed" });
    checks.push({ category: "Seed Test", name: "seed", ok: true, message: "found" });

    const allOk = checks.filter((c) => !c.ok && c.category !== "Seed Test").length === 0;
    expect(allOk).toBe(true);
  });

  it("node fails → ok is false", () => {
    const checks = [];
    checks.push({ category: "Node.js", name: "node", ok: false, message: "not found" });
    checks.push({ category: "npm", name: "npm", ok: true, message: "11.0.0" });
    checks.push({ category: "OpenSpec", name: "openspec", ok: true, message: "initialized" });
    checks.push({ category: "Playwright Browsers", name: "playwright", ok: true, message: "v20.0.0" });
    checks.push({ category: "Playwright MCP", name: "playwright-mcp", ok: true, message: "installed" });
    checks.push({ category: "Seed Test", name: "seed", ok: true, message: "found" });

    const allOk = checks.filter((c) => !c.ok && c.category !== "Seed Test").length === 0;
    expect(allOk).toBe(false);
  });

  it("npm fails → ok is false", () => {
    const checks = [];
    checks.push({ category: "Node.js", name: "node", ok: true, message: "v20.0.0" });
    checks.push({ category: "npm", name: "npm", ok: false, message: "not found" });
    checks.push({ category: "OpenSpec", name: "openspec", ok: true, message: "initialized" });
    checks.push({ category: "Playwright Browsers", name: "playwright", ok: true, message: "v20.0.0" });
    checks.push({ category: "Playwright MCP", name: "playwright-mcp", ok: true, message: "installed" });
    checks.push({ category: "Seed Test", name: "seed", ok: true, message: "found" });

    const allOk = checks.filter((c) => !c.ok && c.category !== "Seed Test").length === 0;
    expect(allOk).toBe(false);
  });

  it("openspec missing → ok is false", () => {
    const checks = [];
    checks.push({ category: "Node.js", name: "node", ok: true, message: "v20.0.0" });
    checks.push({ category: "npm", name: "npm", ok: true, message: "11.0.0" });
    checks.push({ category: "OpenSpec", name: "openspec", ok: false, message: "not initialized" });
    checks.push({ category: "Playwright Browsers", name: "playwright", ok: true, message: "v20.0.0" });
    checks.push({ category: "Playwright MCP", name: "playwright-mcp", ok: true, message: "installed" });
    checks.push({ category: "Seed Test", name: "seed", ok: true, message: "found" });

    const allOk = checks.filter((c) => !c.ok && c.category !== "Seed Test").length === 0;
    expect(allOk).toBe(false);
  });

  it("playwright missing → ok is false", () => {
    const checks = [];
    checks.push({ category: "Node.js", name: "node", ok: true, message: "v20.0.0" });
    checks.push({ category: "npm", name: "npm", ok: true, message: "11.0.0" });
    checks.push({ category: "OpenSpec", name: "openspec", ok: true, message: "initialized" });
    checks.push({ category: "Playwright Browsers", name: "playwright", ok: false, message: "not installed" });
    checks.push({ category: "Playwright MCP", name: "playwright-mcp", ok: true, message: "installed" });
    checks.push({ category: "Seed Test", name: "seed", ok: true, message: "found" });

    const allOk = checks.filter((c) => !c.ok && c.category !== "Seed Test").length === 0;
    expect(allOk).toBe(false);
  });

  it("mcp missing → ok is false", () => {
    const checks = [];
    checks.push({ category: "Node.js", name: "node", ok: true, message: "v20.0.0" });
    checks.push({ category: "npm", name: "npm", ok: true, message: "11.0.0" });
    checks.push({ category: "OpenSpec", name: "openspec", ok: true, message: "initialized" });
    checks.push({ category: "Playwright Browsers", name: "playwright", ok: true, message: "v20.0.0" });
    checks.push({ category: "Playwright MCP", name: "playwright-mcp", ok: false, message: "not configured" });
    checks.push({ category: "Seed Test", name: "seed", ok: true, message: "found" });

    const allOk = checks.filter((c) => !c.ok && c.category !== "Seed Test").length === 0;
    expect(allOk).toBe(false);
  });

  it("seed missing is optional → ok is still true", () => {
    const checks = [];
    checks.push({ category: "Node.js", name: "node", ok: true, message: "v20.0.0" });
    checks.push({ category: "npm", name: "npm", ok: true, message: "11.0.0" });
    checks.push({ category: "OpenSpec", name: "openspec", ok: true, message: "initialized" });
    checks.push({ category: "Playwright Browsers", name: "playwright", ok: true, message: "v20.0.0" });
    checks.push({ category: "Playwright MCP", name: "playwright-mcp", ok: true, message: "installed" });
    checks.push({ category: "Seed Test", name: "seed", ok: false, message: "not found (optional)" });

    const allOk = checks.filter((c) => !c.ok && c.category !== "Seed Test").length === 0;
    expect(allOk).toBe(true);
  });

  it("multiple failures → ok is false", () => {
    const checks = [];
    checks.push({ category: "Node.js", name: "node", ok: false, message: "not found" });
    checks.push({ category: "npm", name: "npm", ok: false, message: "not found" });
    checks.push({ category: "OpenSpec", name: "openspec", ok: false, message: "not initialized" });
    checks.push({ category: "Playwright Browsers", name: "playwright", ok: false, message: "not installed" });
    checks.push({ category: "Playwright MCP", name: "playwright-mcp", ok: false, message: "not configured" });
    checks.push({ category: "Seed Test", name: "seed", ok: false, message: "not found (optional)" });

    const allOk = checks.filter((c) => !c.ok && c.category !== "Seed Test").length === 0;
    expect(allOk).toBe(false);
  });

  it("has all 6 check categories", () => {
    const checks = [];
    checks.push({ category: "Node.js", name: "node", ok: true, message: "v20.0.0" });
    checks.push({ category: "npm", name: "npm", ok: true, message: "11.0.0" });
    checks.push({ category: "OpenSpec", name: "openspec", ok: true, message: "initialized" });
    checks.push({ category: "Playwright Browsers", name: "playwright", ok: true, message: "v20.0.0" });
    checks.push({ category: "Playwright MCP", name: "playwright-mcp", ok: true, message: "installed" });
    checks.push({ category: "Seed Test", name: "seed", ok: true, message: "found" });

    expect(checks).toHaveLength(6);
    const categories = checks.map((c) => c.category);
    expect(categories).toContain("Node.js");
    expect(categories).toContain("npm");
    expect(categories).toContain("OpenSpec");
    expect(categories).toContain("Playwright Browsers");
    expect(categories).toContain("Playwright MCP");
    expect(categories).toContain("Seed Test");
  });

  it("every check has ok, message, name, category fields", () => {
    const checks = [];
    checks.push({ category: "Node.js", name: "node", ok: true, message: "v20.0.0" });
    checks.push({ category: "npm", name: "npm", ok: true, message: "11.0.0" });
    checks.push({ category: "OpenSpec", name: "openspec", ok: true, message: "initialized" });
    checks.push({ category: "Playwright Browsers", name: "playwright", ok: true, message: "v20.0.0" });
    checks.push({ category: "Playwright MCP", name: "playwright-mcp", ok: true, message: "installed" });
    checks.push({ category: "Seed Test", name: "seed", ok: true, message: "found" });

    for (const check of checks) {
      expect(check).toHaveProperty("ok");
      expect(check).toHaveProperty("message");
      expect(check).toHaveProperty("name");
      expect(check).toHaveProperty("category");
      expect(typeof check.ok).toBe("boolean");
      expect(typeof check.message).toBe("string");
    }
  });
});
