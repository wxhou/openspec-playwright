import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

// Mock child_process.execFileSync so claude CLI calls never run for real.
vi.mock("child_process", () => ({
  execFileSync: vi.fn(),
}));

import { execFileSync } from "child_process";
import {
  claudeAdapter,
  clineAdapter,
} from "../../src/commands/editors.js";
import {
  removePlaywrightMcp,
} from "../../src/shared/mcp.js";

const mockedExecFileSync = vi.mocked(execFileSync);

// Sandboxed project dir: adapter MCP checks read project-root files via
// process.cwd(), so chdir into a temp dir per test.
let tmp: string;
let originalCwd: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "ospw-pw-mcp-"));
  originalCwd = process.cwd();
  process.chdir(tmp);
  mockedExecFileSync.mockReset();
});

afterEach(() => {
  process.chdir(originalCwd);
  rmSync(tmp, { recursive: true, force: true });
});

function writeMcpJson(servers: Record<string, unknown>) {
  writeFileSync(
    join(tmp, ".mcp.json"),
    JSON.stringify({ mcpServers: servers }, null, 2),
  );
}

describe("removePlaywrightMcp", () => {
  it("removes with --scope project when installed", () => {
    writeMcpJson({ playwright: { command: "npx" } });
    const consoleSpy = vi.spyOn(console, "log");
    removePlaywrightMcp(claudeAdapter);
    expect(mockedExecFileSync).toHaveBeenCalledWith(
      "claude",
      ["mcp", "remove", "--scope", "project", "playwright"],
      expect.objectContaining({ timeout: 10000 }),
    );
    expect(consoleSpy).toHaveBeenCalledWith("  ✓ claude: playwright MCP removed");
    consoleSpy.mockRestore();
  });

  it("does nothing when not installed (no .mcp.json)", () => {
    const consoleSpy = vi.spyOn(console, "log");
    removePlaywrightMcp(claudeAdapter);
    expect(consoleSpy).toHaveBeenCalledWith(
      "  - claude: playwright MCP not installed (nothing to remove)",
    );
    consoleSpy.mockRestore();
    expect(mockedExecFileSync).not.toHaveBeenCalled();
  });

  it("handles removal failure gracefully, still no throw", () => {
    writeMcpJson({ playwright: { command: "npx" } });
    mockedExecFileSync.mockImplementation(() => {
      throw new Error("Removal failed");
    });
    const consoleSpy = vi.spyOn(console, "warn");
    expect(() => removePlaywrightMcp(claudeAdapter)).not.toThrow();
    expect(consoleSpy).toHaveBeenCalledWith(
      "  ⚠ claude: failed to remove playwright MCP",
    );
    consoleSpy.mockRestore();
  });
});
// ─── Test-runner MCP (playwright-test) ──────────────────────────────────────

import {
  TEST_RUNNER_MCP_SERVER,
  isTestRunnerMcpInstalled,
  ensureTestRunnerMcp,
  removeTestRunnerMcp,
} from "../../src/shared/mcp.js";

// claudeAdapter.installMcp shells out to `claude mcp add` (mocked above), so
// file-level ensure/remove assertions use clineAdapter, which writes
// .cline/mcp.json directly.
describe("test-runner MCP (playwright-test)", () => {
  it("exposes the official server name and command", () => {
    expect(TEST_RUNNER_MCP_SERVER).toBe("playwright-test");
  });

  it("detects an existing playwright-test entry without touching the CLI", () => {
    writeMcpJson({
      "playwright-test": {
        command: "npx",
        args: ["playwright", "run-test-mcp-server"],
      },
    });
    expect(isTestRunnerMcpInstalled(claudeAdapter)).toBe(true);
    expect(mockedExecFileSync).not.toHaveBeenCalled();
  });

  it("ensureTestRunnerMcp backfills idempotently into .cline/mcp.json", () => {
    mkdirSync(join(tmp, ".cline"), { recursive: true });
    writeFileSync(
      join(tmp, ".cline", "mcp.json"),
      JSON.stringify({ mcpServers: { playwright: { command: "npx" } } }, null, 2),
    );
    ensureTestRunnerMcp(clineAdapter);
    ensureTestRunnerMcp(clineAdapter); // second call: already installed

    const cfg = JSON.parse(
      readFileSync(join(tmp, ".cline", "mcp.json"), "utf-8"),
    );
    expect(Object.keys(cfg.mcpServers).sort()).toEqual([
      "playwright",
      "playwright-test",
    ]);
    expect(cfg.mcpServers["playwright-test"]).toEqual({
      command: "npx",
      args: ["playwright", "run-test-mcp-server"],
    });
    // playwright entry untouched by the backfill
    expect(cfg.mcpServers.playwright).toEqual({ command: "npx" });
  });

  it("removeTestRunnerMcp removes only the playwright-test entry", () => {
    mkdirSync(join(tmp, ".cline"), { recursive: true });
    writeFileSync(
      join(tmp, ".cline", "mcp.json"),
      JSON.stringify(
        {
          mcpServers: {
            playwright: { command: "npx" },
            "playwright-test": { command: "npx" },
            codegraph: { command: "x" },
          },
        },
        null,
        2,
      ),
    );
    removeTestRunnerMcp(clineAdapter);
    const cfg = JSON.parse(
      readFileSync(join(tmp, ".cline", "mcp.json"), "utf-8"),
    );
    expect(cfg.mcpServers["playwright-test"]).toBeUndefined();
    expect(cfg.mcpServers.playwright).toBeDefined();
    expect(cfg.mcpServers.codegraph).toBeDefined();
  });
});
