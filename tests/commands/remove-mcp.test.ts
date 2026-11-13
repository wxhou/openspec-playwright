import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the command wrapper
vi.mock("../../src/shared/exec.js", () => ({
  execFileAsync: vi.fn(),
  execFileSync: vi.fn(),
  spawnSync: vi.fn(),
}));

// Mock fs modules
vi.mock("fs", () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  rmSync: vi.fn(),
  readdirSync: vi.fn(),
  rmdirSync: vi.fn(),
  realpathSync: vi.fn((path: string) => path),
  lstatSync: vi.fn(() => ({ isSymbolicLink: () => false })),
}));

import { execFileSync } from "../../src/shared/exec.js";
import { existsSync, readFileSync } from "fs";
import { claudeAdapter } from "../../src/commands/editors.js";
import { removePlaywrightMcp } from "../../src/shared/mcp.js";

// path-guard resolves the project root with the host platform's path rules;
// on Windows a POSIX "/proj" resolves onto the current drive and would never
// match the mocked realpath.
const PROJ = process.platform === "win32" ? "C:\\proj" : "/proj";

describe("removePlaywrightMcp", () => {
  const readFileSyncMock = vi.mocked(readFileSync);

  beforeEach(() => {
    vi.clearAllMocks();
    // The shared mcpServers helpers probe existsSync before reading; a real
    // `.mcp.json` would pass this. The failure case is simulated by
    // readFileSync throwing, not by a missing file.
    vi.mocked(existsSync).mockReturnValue(true);
  });

  it("removes MCP when installed", () => {
    readFileSyncMock.mockReturnValue(
      JSON.stringify({ mcpServers: { playwright: { command: "npx" } } }),
    );

    const consoleSpy = vi.spyOn(console, "log");
    removePlaywrightMcp(claudeAdapter, PROJ);
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
    removePlaywrightMcp(claudeAdapter, PROJ);
    expect(consoleSpy).toHaveBeenCalledWith("  - claude: playwright MCP not installed (nothing to remove)");
    consoleSpy.mockRestore();
    expect(execFileSync).not.toHaveBeenCalled();
  });

  it("handles removal failure gracefully", () => {
    readFileSyncMock.mockReturnValue(
      JSON.stringify({ mcpServers: { playwright: { command: "npx" } } }),
    );
    (vi.mocked(execFileSync) as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error("Removal failed");
    });

    const consoleSpy = vi.spyOn(console, "warn");
    removePlaywrightMcp(claudeAdapter, PROJ);
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
    vi.mocked(existsSync).mockReturnValue(true);
    // clearAllMocks keeps implementations — reset the CLI mock fully so an
    // earlier failing-removal mockImplementation doesn't leak into here.
    (vi.mocked(execFileSync) as unknown as ReturnType<typeof vi.fn>).mockReset();
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
    removeTestRunnerMcp(claudeAdapter, PROJ);
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
    removeTestRunnerMcp(claudeAdapter, PROJ);
    expect(consoleSpy).toHaveBeenCalledWith(
      "  - claude: playwright-test MCP not installed (nothing to remove)",
    );
    consoleSpy.mockRestore();
    expect(execFileSync).not.toHaveBeenCalled();
  });
});
