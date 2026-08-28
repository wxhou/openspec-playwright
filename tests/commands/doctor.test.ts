import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { tmpdir } from "os";
import { join } from "path";
// "fs" is file-wide mocked below — pull the real fns for test fixtures via
// importActual (vitest aliases node:fs onto the same mock).
const realFs = await vi.importActual<typeof import("node:fs")>("node:fs");
const mkdtempSync = realFs.mkdtempSync;
const rmSync = realFs.rmSync;

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
import { detectCodeGraphStatus } from "../../src/shared/index.js";
import { doctor, isOptionalCheck } from "../../src/commands/doctor.js";

// ─── allOk computation (uses the real isOptionalCheck from doctor.ts) ───────

function computeAllOk(
  checks: Array<{ ok: boolean; name: string }>,
): boolean {
  return (
    checks.filter((c) => !c.ok && !isOptionalCheck(c.name)).length === 0
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

  it("test-runner MCP missing is optional → ok is still true", () => {
    const checks = buildChecks().concat([
      {
        category: "Playwright MCP",
        name: "test-runner-mcp-claude",
        ok: false,
        message: "not configured for claude (run openspec-pw update)",
      },
    ]);
    expect(computeAllOk(checks)).toBe(true);
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
      // Normalize separators — join() emits backslashes on Windows.
      const s = String(p).replace(/\\/g, "/");
      return (
        s.endsWith("playwright.config.ts") ||
        s.endsWith("openspec") ||
        s.endsWith("tests/playwright") ||
        s.endsWith("AGENTS.md") ||
        s.endsWith("CLAUDE.md")
      );
    });
    readdirMock.mockReturnValue([] as never);
    // .mcp.json → test-runner MCP installed; AGENTS.md/CLAUDE.md → in-sync
    // (compareBlock is mocked to stale:false, so content just needs markers).
    readFileMock.mockImplementation((p: Parameters<typeof readFileSync>[0]) => {
      const s = String(p);
      if (s.endsWith(".mcp.json")) {
        return JSON.stringify({
          mcpServers: {
            "playwright-test": {
              command: "npx",
              args: ["playwright", "run-test-mcp-server"],
            },
          },
        });
      }
      return "<!-- OPENSPEC-PW:START -->\ncontent\n<!-- OPENSPEC-PW:END -->";
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

// ─── Tests: new optional checks (test-runner MCP + playwright-cli) ──────────

describe("doctor new optional checks (allOk mirror)", () => {
  it("missing test-runner MCP for an adapter is optional → ok stays true", () => {
    const checks = buildChecks().concat([
      {
        category: "Playwright MCP",
        name: "test-runner-mcp-claude",
        ok: false,
        message: "not configured for claude (run openspec-pw update)",
      },
    ]);
    expect(computeAllOk(checks)).toBe(true);
  });

  it("missing playwright-cli is optional → ok stays true", () => {
    const checks = buildChecks().concat([
      {
        category: "Playwright MCP",
        name: "playwright-cli",
        ok: false,
        message: "not installed (optional token-efficient browser CLI for agents)",
      },
    ]);
    expect(computeAllOk(checks)).toBe(true);
  });

  it("required checks failing alongside optional ones still fails", () => {
    const checks = buildChecks({ npm: false }).concat([
      {
        category: "Playwright MCP",
        name: "test-runner-mcp-claude",
        ok: false,
        message: "not configured",
      },
    ]);
    expect(computeAllOk(checks)).toBe(false);
  });
});

// ─── Tests: doctor integration for the new checks ───────────────────────────

describe("doctor integration: test-runner + playwright-cli checks", () => {
  it("reports test-runner-mcp and playwright-cli without affecting exit code", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      await doctor({ json: true });
    } catch {
      // optional — the assertion below is the real check
    }
    const logged = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
    // Both new check names appear in the JSON output
    expect(logged).toContain("test-runner-mcp-");
    expect(logged).toContain("playwright-cli");
    // Missing optional checks must not trip the exit
    expect(logged).toContain('"ok": true');
    exitSpyCleanup();
    logSpy.mockRestore();

    function exitSpyCleanup() {
      exitSpy.mockRestore();
    }
  });
});

// ─── doctor authorization tiers (scope-editor-writes) ───────────────────────

describe("doctor authorization tiers", () => {
  const execMock = vi.mocked(execFileSync);
  const existsMock = vi.mocked(existsSync);
  const readdirMock = vi.mocked(readdirSync);
  const readFileMock = vi.mocked(readFileSync);
  const lstatMock = vi.mocked(lstatSync);
  const detectAdaptersMock = vi.mocked(detectAdapters);

  let fixtureRoot: string;
  let existingPaths: Set<string>;
  let cwdSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    fixtureRoot = mkdtempSync(join(tmpdir(), "ospw-pw-doctor-tier-"));
    existingPaths = new Set();
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(fixtureRoot);
    detectAdaptersMock.mockReturnValue([claudeAdapter]);
    execMock.mockImplementation((cmd: string) => {
      if (cmd === "node" || cmd === "npm" || cmd === "npx") return "v22.0.0";
      return "";
    });
    existsMock.mockImplementation((p: Parameters<typeof existsSync>[0]) =>
      existingPaths.has(String(p).replace(/\\/g, "/")),
    );
    readFileMock.mockImplementation((p: Parameters<typeof readFileSync>[0]) => {
      const s = String(p);
      if (s.endsWith(".mcp.json")) {
        return JSON.stringify({
          mcpServers: {
            "playwright-test": {
              command: "npx",
              args: ["playwright", "run-test-mcp-server"],
            },
          },
        });
      }
      if (s.endsWith("AGENTS.md") || s.endsWith("CLAUDE.md")) {
        return "<!-- OPENSPEC-PW:START -->\ncontent\n<!-- OPENSPEC-PW:END -->";
      }
      return "";
    });
    readdirMock.mockReturnValue([] as never);
    lstatMock.mockReturnValue({ isSymbolicLink: () => false } as never);
  });

  afterEach(() => {
    cwdSpy?.mockRestore();
    rmSync(fixtureRoot, { recursive: true, force: true });
  });

  async function doctorJsonChecks(): Promise<
    Array<{
      category: string;
      name: string;
      ok: boolean;
      message?: string;
      authorized?: boolean;
    }>
  > {
    const logs: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((...args) => {
      logs.push(args.join(" "));
    });
    try {
      await doctor({ json: true });
    } catch {
      // optional — assertions below are the real checks
    } finally {
      spy.mockRestore();
    }
    return JSON.parse(logs.join("\n")).checks;
  }

  it("unauthorized editor MCP check is an ok:true info line pointing at init", async () => {
    // claude detected but no command artifacts → not authorized
    const checks = await doctorJsonChecks();
    const mcp = checks.find((c) => c.name === "test-runner-mcp-claude");
    expect(mcp?.ok).toBe(true);
    expect(mcp?.authorized).toBe(false);
    expect(mcp?.message).toContain("init --tools claude");
    expect(mcp?.message).not.toContain("run openspec-pw update");
  });

  it("authorized editor with missing MCP keeps the run-update hint (self-healable)", async () => {
    existingPaths.add(join(fixtureRoot, ".claude", "commands", "opsx", "e2e.md").replace(/\\/g, "/"));
    // .mcp.json exists but has no servers → playwright-test not installed
    readFileMock.mockImplementation((p: Parameters<typeof readFileSync>[0]) => {
      const s = String(p);
      if (s.endsWith(".mcp.json")) return "{}";
      return "";
    });
    const checks = await doctorJsonChecks();
    const mcp = checks.find((c) => c.name === "test-runner-mcp-claude");
    expect(mcp?.ok).toBe(false);
    expect(mcp?.authorized).toBe(true);
    expect(mcp?.message).toContain("run openspec-pw update");
  });

  it("authorized editor with MCP installed is ok:true + authorized", async () => {
    existingPaths.add(join(fixtureRoot, ".claude", "commands", "opsx", "e2e.md").replace(/\\/g, "/"));
    existingPaths.add(join(fixtureRoot, ".mcp.json").replace(/\\/g, "/"));
    const checks = await doctorJsonChecks();
    const mcp = checks.find((c) => c.name === "test-runner-mcp-claude");
    expect(mcp?.ok).toBe(true);
    expect(mcp?.authorized).toBe(true);
  });

  it("wiped-marker AGENTS.md with pw artifacts is ok:false and points at init (not update)", async () => {
    existingPaths.add(join(fixtureRoot, "AGENTS.md").replace(/\\/g, "/"));
    existingPaths.add(join(fixtureRoot, ".claude", "commands", "opsx", "e2e.md").replace(/\\/g, "/"));
    readFileMock.mockImplementation((p: Parameters<typeof readFileSync>[0]) => {
      const s = String(p);
      if (s.endsWith(".mcp.json")) return "{}";
      if (s.endsWith("AGENTS.md")) return "user rules without markers";
      return "";
    });
    const checks = await doctorJsonChecks();
    const agents = checks.find((c) => c.name === "standards-agents");
    // Territorial check flipped (marker-namespace): an authorized project whose
    // AGENTS.md lost the block is a failure — repairable by init (loop closes).
    expect(agents?.ok).toBe(false);
    expect(agents?.message).toContain("restore via");
    expect(agents?.message).not.toContain("run openspec-pw update");
  });

  it("surviving legacy OPENSPEC block stays ok:true with a migration info line", async () => {
    existingPaths.add(join(fixtureRoot, "AGENTS.md").replace(/\\/g, "/"));
    existingPaths.add(join(fixtureRoot, ".claude", "commands", "opsx", "e2e.md").replace(/\\/g, "/"));
    readFileMock.mockImplementation((p: Parameters<typeof readFileSync>[0]) => {
      const s = String(p);
      if (s.endsWith(".mcp.json")) return "{}";
      if (s.endsWith("AGENTS.md")) {
        return "preamble\n<!-- OPENSPEC:START -->\nofficial legacy guidance\n<!-- OPENSPEC:END -->";
      }
      return "";
    });
    const checks = await doctorJsonChecks();
    const agents = checks.find((c) => c.name === "standards-agents");
    expect(agents?.ok).toBe(true);
    expect(agents?.message).toContain("migrate markers");
  });

  it("missing AGENTS.md with no command artifacts → not initialized, ok:true", async () => {
    // no AGENTS.md, no commands, no openspec dir → the aggregate standards check
    const checks = await doctorJsonChecks();
    const std = checks.find((c) => c.name === "standards");
    expect(std?.ok).toBe(true);
    expect(std?.message).toContain("not initialized");
  });

  it("AGENTS.md with markers but stale content is ok:false and fixable by update", async () => {
    const drift = await import("../../src/shared/drift.js");
    vi.mocked(drift.compareBlock).mockReturnValueOnce({ stale: true });
    existingPaths.add(join(fixtureRoot, "AGENTS.md").replace(/\\/g, "/"));
    existingPaths.add(join(fixtureRoot, "openspec").replace(/\\/g, "/"));
    readFileMock.mockImplementation((p: Parameters<typeof readFileSync>[0]) => {
      const s = String(p);
      if (s.endsWith(".mcp.json")) return "{}";
      if (s.endsWith("AGENTS.md")) {
        return "preamble\n<!-- OPENSPEC-PW:START -->\noutdated content\n<!-- OPENSPEC-PW:END -->";
      }
      return "";
    });
    const checks = await doctorJsonChecks();
    const agents = checks.find((c) => c.name === "standards-agents");
    expect(agents?.ok).toBe(false);
    expect(agents?.message).toContain("run openspec-pw update");
  });
});
