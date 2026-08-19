import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdirSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

// Mock child_process.execFileSync so the `which/where codegraph` probe never
// runs for real in tests.
vi.mock("child_process", () => ({
  execFileSync: vi.fn(),
}));

// Replace detectAdapters with a controllable stub; keep the real adapter
// objects so fixtures use realistic labels.
vi.mock("../../src/commands/editors.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../src/commands/editors.js")>();
  return {
    ...actual,
    detectAdapters: vi.fn(),
  };
});

vi.mock("../../src/shared/mcp.js", () => ({
  isMcpInstalled: vi.fn(),
}));

import { execFileSync } from "child_process";
import {
  detectAdapters,
  claudeAdapter,
  opencodeAdapter,
} from "../../src/commands/editors.js";
import { isMcpInstalled } from "../../src/shared/mcp.js";
import {
  detectCodeGraphStatus,
  codegraphHintLines,
  type CodeGraphStatus,
} from "../../src/shared/codegraph.js";

const mockedExecFileSync = vi.mocked(execFileSync);
const mockedDetectAdapters = vi.mocked(detectAdapters);
const mockedIsMcpInstalled = vi.mocked(isMcpInstalled);

// Sandboxed project dir: `.codegraph` existence is checked on the real fs.
let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "ospw-codegraph-"));
  mockedExecFileSync.mockReset();
  mockedDetectAdapters.mockReset();
  mockedIsMcpInstalled.mockReset();
  // Default: both editors detected, no MCP installed.
  mockedDetectAdapters.mockReturnValue([claudeAdapter, opencodeAdapter]);
  mockedIsMcpInstalled.mockReturnValue(false);
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("detectCodeGraphStatus — full state combinations", () => {
  const combinations: Array<{
    cli: boolean;
    indexed: boolean;
    mcp: boolean;
  }> = [
    { cli: false, indexed: false, mcp: false },
    { cli: false, indexed: false, mcp: true },
    { cli: false, indexed: true, mcp: false },
    { cli: false, indexed: true, mcp: true },
    { cli: true, indexed: false, mcp: false },
    { cli: true, indexed: false, mcp: true },
    { cli: true, indexed: true, mcp: false },
    { cli: true, indexed: true, mcp: true },
  ];

  it.each(combinations)(
    "cli=$cli indexed=$indexed mcp=$mcp",
    ({ cli, indexed, mcp }) => {
      if (cli) {
        mockedExecFileSync.mockImplementation(() => "/usr/local/bin/codegraph");
      } else {
        mockedExecFileSync.mockImplementation(() => {
          throw new Error("command not found");
        });
      }
      if (indexed) {
        mkdirSync(join(tmp, ".codegraph"));
      }
      mockedIsMcpInstalled.mockReturnValue(mcp);

      const status = detectCodeGraphStatus(tmp);

      const expected: CodeGraphStatus = {
        cliInstalled: cli,
        indexed,
        mcpInstalledAdapters: mcp ? ["claude", "opencode"] : [],
      };
      expect(status).toEqual(expected);
    },
  );
});

describe("detectCodeGraphStatus — CLI probe", () => {
  it("probes PATH with which/where codegraph", () => {
    mockedExecFileSync.mockImplementation(() => "/usr/local/bin/codegraph");
    detectCodeGraphStatus(tmp);
    expect(mockedExecFileSync).toHaveBeenCalledWith(
      process.platform === "win32" ? "where" : "which",
      ["codegraph"],
      expect.objectContaining({ stdio: "ignore" }),
    );
  });

  it("reports cliInstalled=false when the probe throws", () => {
    mockedExecFileSync.mockImplementation(() => {
      throw new Error("command not found");
    });
    expect(detectCodeGraphStatus(tmp).cliInstalled).toBe(false);
  });
});

describe("detectCodeGraphStatus — MCP detection", () => {
  it("checks the codegraph MCP server name for every detected adapter", () => {
    mockedIsMcpInstalled.mockReturnValue(true);
    detectCodeGraphStatus(tmp);
    expect(mockedIsMcpInstalled).toHaveBeenCalledWith(claudeAdapter, "codegraph");
    expect(mockedIsMcpInstalled).toHaveBeenCalledWith(opencodeAdapter, "codegraph");
  });

  it("reports only adapters with the codegraph MCP installed", () => {
    mockedIsMcpInstalled.mockImplementation(
      (adapter) => adapter.label === "claude",
    );
    const status = detectCodeGraphStatus(tmp);
    expect(status.mcpInstalledAdapters).toEqual(["claude"]);
  });

  it("returns an empty list when no adapter has the MCP", () => {
    mockedIsMcpInstalled.mockReturnValue(false);
    expect(detectCodeGraphStatus(tmp).mcpInstalledAdapters).toEqual([]);
  });
});

describe("detectCodeGraphStatus — argument passthrough", () => {
  it("passes projectRoot and homeDir through to detectAdapters", () => {
    detectCodeGraphStatus(tmp, "/fake/home");
    expect(mockedDetectAdapters).toHaveBeenCalledWith(tmp, "/fake/home");
  });

  it("works without homeDir", () => {
    detectCodeGraphStatus(tmp);
    expect(mockedDetectAdapters).toHaveBeenCalledWith(tmp, undefined);
  });
});

describe("codegraphHintLines — gap-aware hint content", () => {
  const base: CodeGraphStatus = {
    cliInstalled: true,
    indexed: true,
    mcpInstalledAdapters: [],
  };

  it("indexed + MCP missing → sync + install lines", () => {
    expect(codegraphHintLines(base)).toEqual([
      "Refresh code index: codegraph sync",
      "Install code hooks: codegraph install --target=auto --location=local",
    ]);
  });

  it("indexed + MCP installed → sync line only (no install repeat)", () => {
    expect(
      codegraphHintLines({ ...base, mcpInstalledAdapters: ["claude"] }),
    ).toEqual(["Refresh code index: codegraph sync"]);
  });

  it("no index + CLI installed → init line", () => {
    expect(
      codegraphHintLines({ ...base, indexed: false }),
    ).toEqual(["Build code index (optional): codegraph init"]);
  });

  it("no index + no CLI → no hints", () => {
    expect(
      codegraphHintLines({ ...base, indexed: false, cliInstalled: false }),
    ).toEqual([]);
  });
});