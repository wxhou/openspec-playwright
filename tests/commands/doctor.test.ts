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
  lstatSync: vi.fn(),
}));

// Mock the shared CodeGraph detection so doctor's CodeGraph category is
// deterministic without probing the real CLI / index / editor configs.
vi.mock("../../src/shared/index.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/shared/index.js")>();
  return {
    ...actual,
    detectCodeGraphStatus: vi.fn(),
  };
});

// Mock editor detection so the Playwright MCP check sees a healthy editor
// (otherwise "no editors detected" fails the hard playwright-mcp check).
vi.mock("../../src/commands/editors.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/commands/editors.js")>();
  return {
    ...actual,
    detectAdapters: vi.fn(),
  };
});

// Mock standards drift so the Sync checks pass when running the full doctor()
// (AGENTS.md / CLAUDE.md are treated as in-sync).
vi.mock("../../src/shared/drift.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/shared/drift.js")>();
  return {
    ...actual,
    compareBlock: vi.fn(() => ({ stale: false })),
    bundledStandardsPath: vi.fn(() => "/bundled/employee-standards.md"),
  };
});

import { execFileSync } from "child_process";
import { readFileSync, existsSync, readdirSync, lstatSync } from "fs";
import { claudeAdapter, detectAdapters } from "../../src/commands/editors.js";
import { isPlaywrightMcpInstalled } from "../../src/shared/mcp.js";
import { detectCodeGraphStatus } from "../../src/shared/index.js";
import { doctor } from "../../src/commands/doctor.js";

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
  const readFileSyncMock = vi.mocked(readFileSync);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true when the project .mcp.json contains playwright", () => {
    readFileSyncMock.mockReturnValue(
      JSON.stringify({ mcpServers: { playwright: { command: "npx" } } }),
    );
    expect(isPlaywrightMcpInstalled(claudeAdapter)).toBe(true);
    // Project-scope check reads the file; it never calls the claude CLI.
    expect(execFileSync).not.toHaveBeenCalled();
  });

  it("returns false when .mcp.json has other servers only", () => {
    readFileSyncMock.mockReturnValue(
      JSON.stringify({ mcpServers: { other: { command: "x" } } }),
    );
    expect(isPlaywrightMcpInstalled(claudeAdapter)).toBe(false);
  });

  it("returns false when .mcp.json is missing (read fails)", () => {
    readFileSyncMock.mockImplementation(() => {
      throw new Error("ENOENT: no such file .mcp.json");
    });
    expect(isPlaywrightMcpInstalled(claudeAdapter)).toBe(false);
  });

  it("returns false on unparseable .mcp.json", () => {
    readFileSyncMock.mockReturnValue("{ not json");
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

// ─── CodeGraph category ─────────────────────────────────────────────────────
// Runs the real doctor() with detectCodeGraphStatus mocked. CodeGraph is an
// optional third-party tool: its checks are warnings (yellow ⚠) and must never
// flip allOk / the --json exit code.

describe("doctor CodeGraph category", () => {
  const detectMock = vi.mocked(detectCodeGraphStatus);
  const execMock = vi.mocked(execFileSync);
  const existsMock = vi.mocked(existsSync);
  const readdirMock = vi.mocked(readdirSync);
  const readFileMock = vi.mocked(readFileSync);
  const lstatMock = vi.mocked(lstatSync);
  const detectAdaptersMock = vi.mocked(detectAdapters);

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: everything else healthy so only CodeGraph state drives the result.
    detectMock.mockReturnValue({
      cliInstalled: false,
      indexed: false,
      mcpInstalledAdapters: [],
    });
    // Healthy hard prerequisites: node/npm/playwright CLIs, config, openspec,
    // tests dir, and a detected editor so the Playwright MCP check passes.
    execMock.mockImplementation((cmd: string) => {
      if (cmd === "node" || cmd === "npm" || cmd === "npx") return "v22.0.0";
      return "";
    });
    existsMock.mockImplementation((p: Parameters<typeof existsSync>[0]) => {
      const s = String(p);
      return (
        s.endsWith("playwright.config.ts") ||
        s.endsWith("openspec") ||
        s.endsWith("tests/playwright") ||
        s.endsWith("AGENTS.md") ||
        s.endsWith("CLAUDE.md")
      );
    });
    readdirMock.mockReturnValue([] as never);
    // .mcp.json → playwright MCP installed; AGENTS.md/CLAUDE.md → in-sync
    // (compareBlock is mocked to stale:false, so content just needs markers).
    readFileMock.mockImplementation((p: Parameters<typeof readFileSync>[0]) => {
      const s = String(p);
      if (s.endsWith(".mcp.json")) {
        return JSON.stringify({ mcpServers: { playwright: { command: "npx" } } });
      }
      return "<!-- OPENSPEC:START -->\ncontent\n<!-- OPENSPEC:END -->";
    });
    lstatMock.mockReturnValue({ isSymbolicLink: () => false } as never);
    detectAdaptersMock.mockReturnValue([claudeAdapter]);
  });

  it("emits the CodeGraph category with cli/index/mcp checks in text output", async () => {
    const logs: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((...args) => {
      logs.push(args.join(" "));
    });
    try {
      await doctor();
    } finally {
      spy.mockRestore();
    }
    const text = logs.join("\n");
    expect(text).toContain("─── CodeGraph ───");
    expect(text).toContain("codegraph-cli: not found");
    expect(text).toContain("codegraph-index: not used");
    expect(text).toContain("codegraph-mcp: n/a");
  });

  it("reports version, initialized index, and installed adapters when present", async () => {
    detectMock.mockReturnValue({
      cliInstalled: true,
      indexed: true,
      mcpInstalledAdapters: ["claude", "cursor"],
    });
    execMock.mockImplementation((cmd: string) => {
      if (cmd === "codegraph") return "v1.2.3";
      return "v22.0.0";
    });
    const logs: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((...args) => {
      logs.push(args.join(" "));
    });
    try {
      await doctor();
    } finally {
      spy.mockRestore();
    }
    const text = logs.join("\n");
    expect(text).toContain("codegraph-cli: v1.2.3");
    expect(text).toContain("codegraph-index: initialized");
    expect(text).toContain("codegraph-mcp: installed: claude, cursor");
  });

  it("warns with remediation when CLI present but no index", async () => {
    detectMock.mockReturnValue({
      cliInstalled: true,
      indexed: false,
      mcpInstalledAdapters: [],
    });
    const logs: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((...args) => {
      logs.push(args.join(" "));
    });
    try {
      await doctor();
    } finally {
      spy.mockRestore();
    }
    const text = logs.join("\n");
    expect(text).toContain("codegraph-index: not initialized (run: codegraph init)");
  });

  it("warns with remediation when indexed but MCP missing", async () => {
    detectMock.mockReturnValue({
      cliInstalled: true,
      indexed: true,
      mcpInstalledAdapters: [],
    });
    const logs: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((...args) => {
      logs.push(args.join(" "));
    });
    try {
      await doctor();
    } finally {
      spy.mockRestore();
    }
    const text = logs.join("\n");
    expect(text).toContain(
      "codegraph-mcp: missing (run: codegraph install --target=auto --location=local)",
    );
  });

  it("--json includes the CodeGraph checks", async () => {
    detectMock.mockReturnValue({
      cliInstalled: true,
      indexed: true,
      mcpInstalledAdapters: ["claude"],
    });
    const logs: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((...args) => {
      logs.push(args.join(" "));
    });
    try {
      await doctor({ json: true });
    } finally {
      spy.mockRestore();
    }
    const parsed = JSON.parse(logs.join("\n"));
    const cg = parsed.checks.filter((c: { category: string }) => c.category === "CodeGraph");
    expect(cg.map((c: { name: string }) => c.name)).toEqual([
      "codegraph-cli",
      "codegraph-index",
      "codegraph-mcp",
    ]);
  });

  it("--json exit code stays 0 when CodeGraph is missing (allOk unaffected)", async () => {
    // Indexed but MCP empty → codegraph-mcp is a failing optional check.
    detectMock.mockReturnValue({
      cliInstalled: true,
      indexed: true,
      mcpInstalledAdapters: [],
    });
    const logs: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((...args) => {
      logs.push(args.join(" "));
    });
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    try {
      await doctor({ json: true });
    } finally {
      spy.mockRestore();
      exitSpy.mockRestore();
    }
    const parsed = JSON.parse(logs.join("\n"));
    expect(parsed.ok).toBe(true);
    expect(exitSpy).not.toHaveBeenCalled();
  });
});
