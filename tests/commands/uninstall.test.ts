import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock child_process
vi.mock("child_process", () => ({
  execFileSync: vi.fn(),
}));

// Mock fs modules
vi.mock("fs", () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  rmSync: vi.fn(),
  readdirSync: vi.fn(),
  rmdirSync: vi.fn(),
}));

import { execFileSync } from "child_process";
import { readFileSync } from "fs";
import { claudeAdapter } from "../../src/commands/editors.js";
import { removePlaywrightMcp } from "../../src/shared/mcp.js";

describe("removePlaywrightMcp", () => {
  const readFileSyncMock = vi.mocked(readFileSync);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("removes MCP when installed", () => {
    readFileSyncMock.mockReturnValue(
      JSON.stringify({ mcpServers: { playwright: { command: "npx" } } }),
    );

    const consoleSpy = vi.spyOn(console, "log");
    removePlaywrightMcp(claudeAdapter);
    expect(consoleSpy).toHaveBeenCalledWith("  ✓ claude: playwright MCP removed");
    consoleSpy.mockRestore();

    expect(execFileSync).toHaveBeenCalledWith(
      "claude",
      ["mcp", "remove", "--scope", "project", "playwright"],
      expect.objectContaining({ timeout: 10000 }),
    );
  });

  it("does nothing when not installed", () => {
    readFileSyncMock.mockImplementation(() => {
      throw new Error("ENOENT: no such file .mcp.json");
    });

    const consoleSpy = vi.spyOn(console, "log");
    removePlaywrightMcp(claudeAdapter);
    expect(consoleSpy).toHaveBeenCalledWith("  - claude: playwright MCP not installed (nothing to remove)");
    consoleSpy.mockRestore();
    expect(execFileSync).not.toHaveBeenCalled();
  });

  it("handles removal failure gracefully", () => {
    readFileSyncMock.mockReturnValue(
      JSON.stringify({ mcpServers: { playwright: { command: "npx" } } }),
    );
    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error("Removal failed");
    });

    const consoleSpy = vi.spyOn(console, "warn");
    removePlaywrightMcp(claudeAdapter);
    expect(consoleSpy).toHaveBeenCalledWith("  ⚠ claude: failed to remove playwright MCP");
    consoleSpy.mockRestore();
  });
});

// ─── Test-runner MCP removal (playwright-test) ─────────────────────────────

import { removeTestRunnerMcp } from "../../src/shared/mcp.js";

describe("removeTestRunnerMcp", () => {
  const readFileSyncMock = vi.mocked(readFileSync);

  beforeEach(() => {
    vi.clearAllMocks();
    // clearAllMocks keeps implementations — reset the CLI mock fully so an
    // earlier failing-removal mockImplementation doesn't leak into here.
    vi.mocked(execFileSync).mockReset();
  });

  it("removes the playwright-test entry when installed", () => {
    readFileSyncMock.mockReturnValue(
      JSON.stringify({
        mcpServers: {
          playwright: { command: "npx" },
          "playwright-test": {
            command: "npx",
            args: ["playwright", "run-test-mcp-server"],
          },
        },
      }),
    );

    const consoleSpy = vi.spyOn(console, "log");
    removeTestRunnerMcp(claudeAdapter);
    expect(consoleSpy).toHaveBeenCalledWith(
      "  ✓ claude: playwright-test MCP removed",
    );
    consoleSpy.mockRestore();

    expect(execFileSync).toHaveBeenCalledWith(
      "claude",
      ["mcp", "remove", "--scope", "project", "playwright-test"],
      expect.objectContaining({ timeout: 10000 }),
    );
  });

  it("does nothing when playwright-test is not installed", () => {
    readFileSyncMock.mockReturnValue(
      JSON.stringify({ mcpServers: { playwright: { command: "npx" } } }),
    );

    const consoleSpy = vi.spyOn(console, "log");
    removeTestRunnerMcp(claudeAdapter);
    expect(consoleSpy).toHaveBeenCalledWith(
      "  - claude: playwright-test MCP not installed (nothing to remove)",
    );
    consoleSpy.mockRestore();
    expect(execFileSync).not.toHaveBeenCalled();
  });
});
