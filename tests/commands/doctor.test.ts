import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock child_process.execFileSync
vi.mock("child_process", () => ({
  execFileSync: vi.fn(),
}));

// Mock fs modules
vi.mock("fs", () => ({
  existsSync: vi.fn(),
  readdirSync: vi.fn(),
  readFileSync: vi.fn(),
}));

import { execFileSync } from "child_process";
import { claudeAdapter } from "../../src/commands/editors.js";
import { isPlaywrightMcpInstalled } from "../../src/shared/mcp.js";

// ─── allOk computation (mirrors doctor.ts logic) ─────────────────────────────

const OPTIONAL_NAMES = new Set([
  "engines",
  "specs",
  "auth-setup",
  "seed",
  "dev-script",
  "base-url",
  "reachable",
]);

function computeAllOk(
  checks: Array<{ ok: boolean; name: string }>,
): boolean {
  return (
    checks.filter((c) => !c.ok && !OPTIONAL_NAMES.has(c.name)).length === 0
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────

interface MockCheck {
  category: string;
  ok: boolean;
  message: string;
}

function buildChecks(
  overrides: Record<string, boolean> = {},
): Array<{ category: string; name: string; ok: boolean; message: string }> {
  const defaults: Record<string, MockCheck> = {
    node: { category: "Node.js", ok: true, message: "v22.0.0" },
    engines: { category: "Node.js", ok: true, message: "requires >=20" },
    npm: { category: "npm", ok: true, message: "10.0.0" },
    config: {
      category: "Playwright Config",
      ok: true,
      message: "found playwright.config.ts",
    },
    openspec: { category: "OpenSpec", ok: true, message: "initialized" },
    specs: { category: "OpenSpec", ok: true, message: "3 spec(s) found" },
    cli: { category: "Playwright Browsers", ok: true, message: "v1.50.0" },
    browsers: {
      category: "Playwright Browsers",
      ok: true,
      message: "chromium installed",
    },
    "playwright-test": {
      category: "Playwright Test",
      ok: true,
      message: "installed",
    },
    "playwright-mcp": {
      category: "Playwright MCP",
      ok: true,
      message: "installed",
    },
    directory: {
      category: "Tests",
      ok: true,
      message: "tests/playwright/ exists",
    },
    "auth-setup": { category: "Tests", ok: true, message: "found" },
    seed: { category: "Seed Test", ok: true, message: "found" },
    "dev-script": {
      category: "App Server",
      ok: true,
      message: "npm run dev",
    },
    "base-url": {
      category: "App Server",
      ok: true,
      message: "http://localhost:3000",
    },
    reachable: { category: "App Server", ok: false, message: "not reachable" },
  };

  return Object.entries(defaults).map(([name, def]) => ({
    category: def.category,
    name,
    ok: overrides[name] !== undefined ? overrides[name] : def.ok,
    message: def.message,
  }));
}

// ─── Tests: MCP install logic ──────────────────────────────────────────────

describe("isPlaywrightMcpInstalled", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true when playwright is in mcp list output", () => {
    vi.mocked(execFileSync).mockReturnValue(
      "playwright: npx @playwright/mcp@latest\n",
    );
    expect(isPlaywrightMcpInstalled(claudeAdapter)).toBe(true);
    expect(execFileSync).toHaveBeenCalledWith(
      "claude",
      ["mcp", "list"],
      {
        encoding: "utf-8",
        timeout: 10000,
        stdio: ["pipe", "pipe", "pipe"],
        shell: false,
      },
    );
  });

  it("returns false when playwright is not in mcp list output", () => {
    vi.mocked(execFileSync).mockReturnValue("other-mcp: some-command\n");
    expect(isPlaywrightMcpInstalled(claudeAdapter)).toBe(false);
  });

  it("returns false when claude CLI fails", () => {
    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error("claude not found");
    });
    expect(isPlaywrightMcpInstalled(claudeAdapter)).toBe(false);
  });

  it("returns false when output is empty", () => {
    vi.mocked(execFileSync).mockReturnValue("");
    expect(isPlaywrightMcpInstalled(claudeAdapter)).toBe(false);
  });
});

// ─── Tests: allOk computation ──────────────────────────────────────────────

describe("doctor check logic", () => {
  it("all checks pass → ok is true", () => {
    const checks = buildChecks();
    expect(computeAllOk(checks)).toBe(true);
  });

  it("node fails → ok is false", () => {
    const checks = buildChecks({ node: false });
    expect(computeAllOk(checks)).toBe(false);
  });

  it("npm fails → ok is false", () => {
    const checks = buildChecks({ npm: false });
    expect(computeAllOk(checks)).toBe(false);
  });

  it("openspec directory missing → ok is false", () => {
    const checks = buildChecks({ openspec: false });
    expect(computeAllOk(checks)).toBe(false);
  });

  it("openspec specs missing is optional → ok is still true", () => {
    const checks = buildChecks({ openspec: true, specs: false });
    expect(computeAllOk(checks)).toBe(true);
  });

  it("playwright cli missing → ok is false", () => {
    const checks = buildChecks({ cli: false });
    expect(computeAllOk(checks)).toBe(false);
  });

  it("playwright browsers missing → ok is false", () => {
    const checks = buildChecks({ browsers: false });
    expect(computeAllOk(checks)).toBe(false);
  });

  it("playwright config missing → ok is false", () => {
    const checks = buildChecks({ config: false });
    expect(computeAllOk(checks)).toBe(false);
  });

  it("playwright-test missing → ok is false", () => {
    const checks = buildChecks({ "playwright-test": false });
    expect(computeAllOk(checks)).toBe(false);
  });

  it("mcp missing → ok is false", () => {
    const checks = buildChecks({ "playwright-mcp": false });
    expect(computeAllOk(checks)).toBe(false);
  });

  it("tests directory missing → ok is false", () => {
    const checks = buildChecks({ directory: false });
    expect(computeAllOk(checks)).toBe(false);
  });

  it("auth-setup missing is optional → ok is still true", () => {
    const checks = buildChecks({ "auth-setup": false });
    expect(computeAllOk(checks)).toBe(true);
  });

  it("seed missing is optional → ok is still true", () => {
    const checks = buildChecks({ seed: false });
    expect(computeAllOk(checks)).toBe(true);
  });

  it("node engines mismatch is optional → ok is still true", () => {
    const checks = buildChecks({ engines: false });
    expect(computeAllOk(checks)).toBe(true);
  });

  it("multiple failures → ok is false", () => {
    const checks = buildChecks({
      node: false,
      npm: false,
      openspec: false,
      cli: false,
      browsers: false,
      config: false,
      "playwright-test": false,
      "playwright-mcp": false,
      directory: false,
      seed: false,
      "auth-setup": false,
      engines: false,
      specs: false,
    });
    expect(computeAllOk(checks)).toBe(false);
  });

  it("has all expected check names", () => {
    const checks = buildChecks();
    const names = checks.map((c) => c.name);
    expect(names).toContain("node");
    expect(names).toContain("engines");
    expect(names).toContain("npm");
    expect(names).toContain("config");
    expect(names).toContain("openspec");
    expect(names).toContain("specs");
    expect(names).toContain("cli");
    expect(names).toContain("browsers");
    expect(names).toContain("playwright-test");
    expect(names).toContain("playwright-mcp");
    expect(names).toContain("directory");
    expect(names).toContain("auth-setup");
    expect(names).toContain("seed");
    expect(names).toContain("dev-script");
    expect(names).toContain("base-url");
    expect(names).toContain("reachable");
    expect(checks).toHaveLength(16);
  });

  it("every check has ok, message, name, category fields", () => {
    const checks = buildChecks();
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
