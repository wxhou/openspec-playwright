import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock shared/exec command wrapper
vi.mock("../../src/shared/exec.js", () => ({
  execFileAsync: vi.fn(),
  execFileSync: vi.fn(),
  spawnSync: vi.fn(),
}));

// Mock the OpenSpec version probe — a healthy 1.x install unless a test
// overrides it.
vi.mock("../../src/shared/openspec-version.js", () => ({
  OPENSPEC_LATEST_MAJOR: 2,
  openSpecCliStatus: vi.fn(() => ({ ok: true, major: 1 })),
}));

// Mock fs modules
vi.mock("fs", () => ({
  existsSync: vi.fn(),
  readdirSync: vi.fn(),
  readFileSync: vi.fn(),
  lstatSync: vi.fn(),
}));

// Mock the shared CodeGraph detection so the rest of doctor's categories are
// deterministic.
vi.mock("../../src/shared/index.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../src/shared/index.js")>();
  return { ...actual, detectCodeGraphStatus: vi.fn() };
});

// Mock editor detection so the Playwright MCP check sees a healthy editor.
vi.mock("../../src/commands/editors.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../src/commands/editors.js")>();
  return { ...actual, detectAdapters: vi.fn() };
});

// Mock standards drift so the Sync checks pass.
vi.mock("../../src/shared/drift.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../src/shared/drift.js")>();
  return {
    ...actual,
    compareBlock: vi.fn(() => ({ stale: false })),
    bundledStandardsPath: vi.fn(() => "/bundled/employee-standards.md"),
  };
});

import { execFileSync } from "../../src/shared/exec.js";
import { existsSync, readdirSync, readFileSync, lstatSync } from "fs";
import { claudeAdapter, detectAdapters } from "../../src/commands/editors.js";
import { detectCodeGraphStatus } from "../../src/shared/index.js";
import { openSpecCliStatus } from "../../src/shared/openspec-version.js";
import { doctor } from "../../src/commands/doctor.js";

describe("doctor OpenSpec CLI version", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(detectCodeGraphStatus).mockReturnValue({
      cliInstalled: true,
      indexed: true,
      mcpInstalledAdapters: [],
    });
    vi.mocked(execFileSync).mockImplementation(((cmd: string) => {
      if (cmd === "node" || cmd === "npm" || cmd === "npx") return "v22.0.0";
      return "";
    }) as never);
    vi.mocked(existsSync).mockImplementation(((p: unknown) => {
      // Normalize separators — join() emits backslashes on Windows.
      const s = String(p).replace(/\\/g, "/");
      return (
        s.endsWith("playwright.config.ts") ||
        s.endsWith("openspec") ||
        s.endsWith("tests/playwright") ||
        s.endsWith("AGENTS.md") ||
        s.endsWith("CLAUDE.md")
      );
    }) as never);
    vi.mocked(readdirSync).mockReturnValue([] as never);
    vi.mocked(readFileSync).mockImplementation(((p: unknown) => {
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
    }) as never);
    vi.mocked(lstatSync).mockReturnValue({
      isSymbolicLink: () => false,
    } as never);
    vi.mocked(detectAdapters).mockReturnValue([claudeAdapter]);
  });

  it("accepts a 2.x OpenSpec CLI and reports 2.x", async () => {
    vi.mocked(openSpecCliStatus).mockReturnValue({ ok: true, major: 2 });
    const logs: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((...args) => {
      logs.push(args.join(" "));
    });
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit called");
    }) as never);
    try {
      await doctor({ json: true });
    } catch {
      // other checks may fail in this fixture; the row is what this test reads
    } finally {
      spy.mockRestore();
      exitSpy.mockRestore();
      // clearAllMocks does not undo mockReturnValue; later tests assert the
      // 1.x default.
      vi.mocked(openSpecCliStatus).mockReturnValue({ ok: true, major: 1 });
    }
    const parsed = JSON.parse(logs.join("\n"));
    const row = parsed.checks.find(
      (c: { name: string }) => c.name === "cli-version",
    );
    expect(row.ok).toBe(true);
    expect(row.message).toBe("2.x");
  });

  it("reports a 3.x OpenSpec CLI as unsupported and exits 1", async () => {
    vi.mocked(openSpecCliStatus).mockReturnValueOnce({
      ok: false,
      kind: "unsupported",
      message:
        "OpenSpec 3.x detected — this tool supports 1.x and 2.x — install 2.x: npm install -g @fission-ai/openspec@2",
    });
    const logs: string[] = [];
    let exitCode: number | undefined;
    const spy = vi.spyOn(console, "log").mockImplementation((...args) => {
      logs.push(args.join(" "));
    });
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      exitCode = code;
      throw new Error("process.exit called");
    }) as never);
    try {
      await doctor({ json: true });
      throw new Error("doctor should exit 1");
    } catch (err) {
      expect((err as Error).message).toContain("process.exit called");
    } finally {
      spy.mockRestore();
      exitSpy.mockRestore();
    }
    const parsed = JSON.parse(logs.join("\n"));
    const row = parsed.checks.find(
      (c: { name: string }) => c.name === "cli-version",
    );
    expect(row.ok).toBe(false);
    expect(row.message).toContain("3.x detected");
    expect(parsed.ok).toBe(false);
    expect(exitCode).toBe(1);
  });

  it("prints the 2.x install hint and no init hint when the CLI is unsupported", async () => {
    vi.mocked(openSpecCliStatus).mockReturnValueOnce({
      ok: false,
      kind: "unsupported",
      message:
        "OpenSpec 3.x detected — this tool supports 1.x and 2.x — install 2.x: npm install -g @fission-ai/openspec@2",
    });
    const logs: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((...args) => {
      logs.push(args.join(" "));
    });
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    try {
      await doctor();
    } catch {
      // exits 1 — the row and the hint are what this test reads
    } finally {
      spy.mockRestore();
      exitSpy.mockRestore();
    }
    const out = logs.join("\n");
    expect(out).toContain("cli-version");
    expect(out).toContain("npm install -g @fission-ai/openspec@2");
    expect(out).not.toContain("openspec@1");
    // init aborts on an unsupported CLI, so offering it would be a dead end.
    expect(out).not.toContain("openspec-pw init to fix");
  });
});
