import { describe, it, expect, vi, beforeEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

// Mock child_process.execFileSync
vi.mock("child_process", () => ({
  execFileSync: vi.fn(),
}));

import { execFileSync } from "child_process";
import { claudeAdapter, opencodeAdapter } from "../../src/commands/editors.js";
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
    expect(isPlaywrightMcpInstalled(claudeAdapter)).toBe(true);
    expect(execFileSync).toHaveBeenCalledWith("claude", ["mcp", "list"], {
      encoding: "utf-8",
      timeout: 10000,
      stdio: ["pipe", "pipe", "pipe"],
      shell: false,
    });
  });

  it("returns false when playwright is not in mcp list output", () => {
    vi.mocked(execFileSync).mockReturnValue("other-mcp: some-command\n");
    expect(isPlaywrightMcpInstalled(claudeAdapter)).toBe(false);
  });

  it("returns false when claude CLI fails", () => {
    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error("claude not found");
    });
    expect(isPlaywrightMcpInstalled(claudeAdapter)).toBe(false);
  });

  it("returns false when output is empty", () => {
    vi.mocked(execFileSync).mockReturnValue("");
    expect(isPlaywrightMcpInstalled(claudeAdapter)).toBe(false);
  });

  it("returns false when claude exits non-zero but stdout contains playwright (adapter catch → false)", () => {
    // Note: the OLD `isPlaywrightMcpInstalled()` facade used to peek at
    // err.stdout/err.stderr and return true on partial output. The new
    // `claudeAdapter.isMcpInstalled` has a generic `catch → false` —
    // matching the adapter's simpler contract.
    vi.mocked(execFileSync).mockImplementation(() => {
      const err = new Error("some MCP is unhealthy") as Error & { stdout: string };
      err.stdout = "playwright: npx @playwright/mcp@latest\nother: broken-mcp\n";
      throw err;
    });
    expect(isPlaywrightMcpInstalled(claudeAdapter)).toBe(false);
  });

  it("returns false when claude exits non-zero and stderr contains playwright (adapter catch → false)", () => {
    // See note above on the adapter's simplified catch behavior.
    vi.mocked(execFileSync).mockImplementation(() => {
      const err = new Error("some MCP is unhealthy") as Error & { stderr: string };
      err.stderr = "playwright: npx @playwright/mcp@latest\n";
      throw err;
    });
    expect(isPlaywrightMcpInstalled(claudeAdapter)).toBe(false);
  });

  it("returns false when claude exits non-zero and neither stdout/stderr has playwright", () => {
    vi.mocked(execFileSync).mockImplementation(() => {
      const err = new Error("claude not found") as Error & { stdout: string };
      err.stdout = "other-mcp: some-command\n";
      throw err;
    });
    expect(isPlaywrightMcpInstalled(claudeAdapter)).toBe(false);
  });

  it("returns false when claude exits non-zero with no output", () => {
    vi.mocked(execFileSync).mockImplementation(() => {
      const err = new Error("claude not found") as Error & { stdout: string };
      err.stdout = "";
      throw err;
    });
    expect(isPlaywrightMcpInstalled(claudeAdapter)).toBe(false);
  });

  it("returns true/false for opencodeAdapter based on a real opencode.jsonc (no shell path)", () => {
    // Exercises the JSONC parse path on opencodeAdapter (NOT the `claude mcp list` shell path).
    // The facade uses process.cwd(), so chdir into a temp dir.
    const tmp = mkdtempSync(join(tmpdir(), "opencode-mcp-"));
    const originalCwd = process.cwd();
    try {
      writeFileSync(
        join(tmp, "opencode.jsonc"),
        JSON.stringify(
          {
            mcp: {
              playwright: {
                type: "local",
                command: ["npx", "@playwright/mcp@latest"],
              },
            },
          },
          null,
          2,
        ),
      );
      process.chdir(tmp);
      expect(isPlaywrightMcpInstalled(opencodeAdapter)).toBe(true);

      // Drop the mcp key; the facade should now report false.
      writeFileSync(
        join(tmp, "opencode.jsonc"),
        JSON.stringify({ $schema: "https://opencode.ai/config.json" }, null, 2),
      );
      expect(isPlaywrightMcpInstalled(opencodeAdapter)).toBe(false);
    } finally {
      process.chdir(originalCwd);
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe("ensurePlaywrightMcp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does nothing when already installed", () => {
    vi.mocked(execFileSync).mockReturnValue("playwright: npx @playwright/mcp@latest\n");
    const consoleSpy = vi.spyOn(console, "log");
    ensurePlaywrightMcp(claudeAdapter);
    expect(consoleSpy).toHaveBeenCalledWith("  ✓ claude: playwright MCP already installed");
    consoleSpy.mockRestore();
  });

  it("installs when not installed", () => {
    vi.mocked(execFileSync)
      .mockReturnValueOnce("") // First call: mcp list (not installed)
      .mockReturnValueOnce(""); // Second call: mcp add
    const consoleSpy = vi.spyOn(console, "log");
    ensurePlaywrightMcp(claudeAdapter);
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
    expect(consoleSpy).toHaveBeenCalledWith("  ✓ claude: playwright MCP installed");
    consoleSpy.mockRestore();
  });

  it("throws when installation fails", () => {
    vi.mocked(execFileSync)
      .mockReturnValueOnce("") // First call: mcp list (not installed)
      .mockImplementationOnce(() => {
        throw new Error("Installation failed");
      });
    const consoleSpy = vi.spyOn(console, "warn");
    expect(() => ensurePlaywrightMcp(claudeAdapter)).toThrow("Installation failed");
    expect(consoleSpy).toHaveBeenCalledWith("  ⚠ claude: failed to install playwright MCP");
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
    removePlaywrightMcp(claudeAdapter);
    expect(execFileSync).toHaveBeenCalledWith("claude", ["mcp", "remove", "playwright"], {
      encoding: "utf-8",
      timeout: 10000,
      stdio: ["pipe", "pipe", "pipe"],
      shell: false,
    });
    expect(consoleSpy).toHaveBeenCalledWith("  ✓ claude: playwright MCP removed");
    consoleSpy.mockRestore();
  });

  it("does nothing when not installed", () => {
    vi.mocked(execFileSync).mockReturnValue("");
    const consoleSpy = vi.spyOn(console, "log");
    removePlaywrightMcp(claudeAdapter);
    expect(consoleSpy).toHaveBeenCalledWith("  - claude: playwright MCP not installed (nothing to remove)");
    consoleSpy.mockRestore();
  });

  it("handles removal failure gracefully", () => {
    vi.mocked(execFileSync)
      .mockReturnValueOnce("playwright: npx @playwright/mcp@latest\n") // First call: mcp list
      .mockImplementationOnce(() => {
        throw new Error("Removal failed");
      });
    const consoleSpy = vi.spyOn(console, "warn");
    removePlaywrightMcp(claudeAdapter);
    expect(consoleSpy).toHaveBeenCalledWith("  ⚠ claude: failed to remove playwright MCP");
    consoleSpy.mockRestore();
  });
});
