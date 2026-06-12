import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock child_process.execFileSync
vi.mock("child_process", () => ({
  execFileSync: vi.fn(),
}));

import { execFileSync } from "child_process";
import {
  isPlaywrightMcpInstalled,
  ensurePlaywrightMcp,
  removePlaywrightMcp,
} from "../../src/shared/mcp.js";

describe("isPlaywrightMcpInstalled", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true when playwright is in mcp list output", () => {
    vi.mocked(execFileSync).mockReturnValue("playwright: npx @playwright/mcp@latest\n");
    expect(isPlaywrightMcpInstalled()).toBe(true);
    expect(execFileSync).toHaveBeenCalledWith("claude", ["mcp", "list"], {
      encoding: "utf-8",
      timeout: 10000,
      stdio: ["pipe", "pipe", "pipe"],
      shell: false,
    });
  });

  it("returns false when playwright is not in mcp list output", () => {
    vi.mocked(execFileSync).mockReturnValue("other-mcp: some-command\n");
    expect(isPlaywrightMcpInstalled()).toBe(false);
  });

  it("returns false when claude CLI fails", () => {
    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error("claude not found");
    });
    expect(isPlaywrightMcpInstalled()).toBe(false);
  });

  it("returns false when output is empty", () => {
    vi.mocked(execFileSync).mockReturnValue("");
    expect(isPlaywrightMcpInstalled()).toBe(false);
  });

  it("returns true when claude exits non-zero but stdout contains playwright", () => {
    vi.mocked(execFileSync).mockImplementation(() => {
      const err = new Error("some MCP is unhealthy") as Error & { stdout: string };
      err.stdout = "playwright: npx @playwright/mcp@latest\nother: broken-mcp\n";
      throw err;
    });
    expect(isPlaywrightMcpInstalled()).toBe(true);
  });

  it("returns true when claude exits non-zero and stderr contains playwright", () => {
    vi.mocked(execFileSync).mockImplementation(() => {
      const err = new Error("some MCP is unhealthy") as Error & { stderr: string };
      err.stderr = "playwright: npx @playwright/mcp@latest\n";
      throw err;
    });
    expect(isPlaywrightMcpInstalled()).toBe(true);
  });

  it("returns false when claude exits non-zero and neither stdout/stderr has playwright", () => {
    vi.mocked(execFileSync).mockImplementation(() => {
      const err = new Error("claude not found") as Error & { stdout: string };
      err.stdout = "other-mcp: some-command\n";
      throw err;
    });
    expect(isPlaywrightMcpInstalled()).toBe(false);
  });

  it("returns false when claude exits non-zero with no output", () => {
    vi.mocked(execFileSync).mockImplementation(() => {
      const err = new Error("claude not found") as Error & { stdout: string };
      err.stdout = "";
      throw err;
    });
    expect(isPlaywrightMcpInstalled()).toBe(false);
  });
});

describe("ensurePlaywrightMcp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does nothing when already installed", () => {
    vi.mocked(execFileSync).mockReturnValue("playwright: npx @playwright/mcp@latest\n");
    const consoleSpy = vi.spyOn(console, "log");
    ensurePlaywrightMcp();
    expect(consoleSpy).toHaveBeenCalledWith("  ✓ Playwright MCP already installed");
    consoleSpy.mockRestore();
  });

  it("installs when not installed", () => {
    vi.mocked(execFileSync)
      .mockReturnValueOnce("") // First call: mcp list (not installed)
      .mockReturnValueOnce(""); // Second call: mcp add
    const consoleSpy = vi.spyOn(console, "log");
    ensurePlaywrightMcp();
    expect(execFileSync).toHaveBeenCalledWith(
      "claude",
      ["mcp", "add", "playwright", "npx", "@playwright/mcp@latest"],
      {
        encoding: "utf-8",
        timeout: 10000,
        stdio: ["pipe", "pipe", "pipe"],
        shell: false,
      }
    );
    expect(consoleSpy).toHaveBeenCalledWith("  ✓ Playwright MCP installed globally");
    consoleSpy.mockRestore();
  });

  it("throws when installation fails", () => {
    vi.mocked(execFileSync)
      .mockReturnValueOnce("") // First call: mcp list (not installed)
      .mockImplementationOnce(() => {
        throw new Error("Installation failed");
      });
    const consoleSpy = vi.spyOn(console, "warn");
    expect(() => ensurePlaywrightMcp()).toThrow("MCP installation failed");
    expect(consoleSpy).toHaveBeenCalledWith("  ⚠ Failed to install Playwright MCP");
    consoleSpy.mockRestore();
  });
});

describe("removePlaywrightMcp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("removes when installed", () => {
    vi.mocked(execFileSync)
      .mockReturnValueOnce("playwright: npx @playwright/mcp@latest\n") // First call: mcp list
      .mockReturnValueOnce(""); // Second call: mcp remove
    const consoleSpy = vi.spyOn(console, "log");
    removePlaywrightMcp();
    expect(execFileSync).toHaveBeenCalledWith("claude", ["mcp", "remove", "playwright"], {
      encoding: "utf-8",
      timeout: 10000,
      stdio: ["pipe", "pipe", "pipe"],
      shell: false,
    });
    expect(consoleSpy).toHaveBeenCalledWith("  ✓ Playwright MCP removed");
    consoleSpy.mockRestore();
  });

  it("does nothing when not installed", () => {
    vi.mocked(execFileSync).mockReturnValue("");
    const consoleSpy = vi.spyOn(console, "log");
    removePlaywrightMcp();
    expect(consoleSpy).toHaveBeenCalledWith("  ✓ Playwright MCP not installed (nothing to remove)");
    consoleSpy.mockRestore();
  });

  it("handles removal failure gracefully", () => {
    vi.mocked(execFileSync)
      .mockReturnValueOnce("playwright: npx @playwright/mcp@latest\n") // First call: mcp list
      .mockImplementationOnce(() => {
        throw new Error("Removal failed");
      });
    const consoleSpy = vi.spyOn(console, "warn");
    removePlaywrightMcp();
    expect(consoleSpy).toHaveBeenCalledWith("  ⚠ Failed to remove Playwright MCP");
    consoleSpy.mockRestore();
  });
});
