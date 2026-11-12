import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

// Mock the command wrapper so claude CLI calls never run for real.
vi.mock("../../src/shared/exec.js", () => ({
  execFileAsync: vi.fn(),
  execFileSync: vi.fn(),
  spawnSync: vi.fn(),
}));

import { execFileSync } from "../../src/shared/exec.js";
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
    removePlaywrightMcp(claudeAdapter, tmp);
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
    removePlaywrightMcp(claudeAdapter, tmp);
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
    expect(() => removePlaywrightMcp(claudeAdapter, tmp)).not.toThrow();
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
    expect(isTestRunnerMcpInstalled(claudeAdapter, tmp)).toBe(true);
    expect(mockedExecFileSync).not.toHaveBeenCalled();
  });

  it("ensureTestRunnerMcp backfills idempotently into .cline/mcp.json", () => {
    mkdirSync(join(tmp, ".cline"), { recursive: true });
    writeFileSync(
      join(tmp, ".cline", "mcp.json"),
      JSON.stringify({ mcpServers: { playwright: { command: "npx" } } }, null, 2),
    );
    ensureTestRunnerMcp(clineAdapter, tmp);
    ensureTestRunnerMcp(clineAdapter, tmp); // second call: already installed

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
    removeTestRunnerMcp(clineAdapter, tmp);
    const cfg = JSON.parse(
      readFileSync(join(tmp, ".cline", "mcp.json"), "utf-8"),
    );
    expect(cfg.mcpServers["playwright-test"]).toBeUndefined();
    expect(cfg.mcpServers.playwright).toBeDefined();
    expect(cfg.mcpServers.codegraph).toBeDefined();
  });

  it("operates on the given projectRoot, not the cwd (batch mode)", () => {
    const otherRoot = mkdtempSync(join(tmpdir(), "ospw-pw-mcp-other-"));
    try {
      mkdirSync(join(otherRoot, ".cline"), { recursive: true });
      writeFileSync(
        join(otherRoot, ".cline", "mcp.json"),
        JSON.stringify({
          mcpServers: { "playwright-test": { command: "npx" } },
        }),
      );
      // cwd (tmp) has its own config that must stay untouched.
      mkdirSync(join(tmp, ".cline"), { recursive: true });
      writeFileSync(
        join(tmp, ".cline", "mcp.json"),
        JSON.stringify({
          mcpServers: { "playwright-test": { command: "npx" } },
        }),
      );

      expect(isTestRunnerMcpInstalled(clineAdapter, otherRoot)).toBe(true);
      removeTestRunnerMcp(clineAdapter, otherRoot);

      const otherCfg = JSON.parse(
        readFileSync(join(otherRoot, ".cline", "mcp.json"), "utf-8"),
      );
      expect(otherCfg.mcpServers["playwright-test"]).toBeUndefined();
      const cwdCfg = JSON.parse(
        readFileSync(join(tmp, ".cline", "mcp.json"), "utf-8"),
      );
      expect(cwdCfg.mcpServers["playwright-test"]).toBeDefined();
    } finally {
      rmSync(otherRoot, { recursive: true, force: true });
    }
  });
});
