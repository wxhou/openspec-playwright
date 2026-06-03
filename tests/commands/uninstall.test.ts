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
import { removePlaywrightMcp } from "../../src/shared/mcp.js";

describe("removePlaywrightMcp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("removes MCP when installed", () => {
    vi.mocked(execFileSync)
      .mockReturnValueOnce("playwright: npx @playwright/mcp@latest\n") // mcp list
      .mockReturnValueOnce(""); // mcp remove

    const consoleSpy = vi.spyOn(console, "log");
    removePlaywrightMcp();
    expect(consoleSpy).toHaveBeenCalledWith("  ✓ Playwright MCP removed");
    consoleSpy.mockRestore();
  });

  it("does nothing when not installed", () => {
    vi.mocked(execFileSync).mockReturnValue(""); // mcp list returns empty

    const consoleSpy = vi.spyOn(console, "log");
    removePlaywrightMcp();
    expect(consoleSpy).toHaveBeenCalledWith("  ✓ Playwright MCP not installed (nothing to remove)");
    consoleSpy.mockRestore();
  });

  it("handles removal failure gracefully", () => {
    vi.mocked(execFileSync)
      .mockReturnValueOnce("playwright: npx @playwright/mcp@latest\n") // mcp list
      .mockImplementationOnce(() => {
        throw new Error("Removal failed");
      });

    const consoleSpy = vi.spyOn(console, "warn");
    removePlaywrightMcp();
    expect(consoleSpy).toHaveBeenCalledWith("  ⚠ Failed to remove Playwright MCP");
    consoleSpy.mockRestore();
  });
});
