import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

// Mock child_process.execFileSync so claude CLI calls never run for real.
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

describe("isPlaywrightMcpInstalled (claude, project scope)", () => {
  it("returns true when the project .mcp.json contains playwright", () => {
    writeMcpJson({ playwright: { command: "npx" } });
    expect(isPlaywrightMcpInstalled(claudeAdapter)).toBe(true);
    // Project scope reads the file; never consults the claude CLI.
    expect(mockedExecFileSync).not.toHaveBeenCalled();
  });

  it("returns false when .mcp.json is missing", () => {
    expect(isPlaywrightMcpInstalled(claudeAdapter)).toBe(false);
  });

  it("returns false when .mcp.json has other servers only", () => {
    writeMcpJson({ other: { command: "x" } });
    expect(isPlaywrightMcpInstalled(claudeAdapter)).toBe(false);
  });

  it("returns false (not throw) on unparseable .mcp.json", () => {
    writeFileSync(join(tmp, ".mcp.json"), "{ not json");
    expect(isPlaywrightMcpInstalled(claudeAdapter)).toBe(false);
  });

  it("returns true/false for opencodeAdapter based on a real opencode.jsonc", () => {
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
    expect(isPlaywrightMcpInstalled(opencodeAdapter)).toBe(true);

    // Drop the mcp key; the facade should now report false.
    writeFileSync(
      join(tmp, "opencode.jsonc"),
      JSON.stringify({ $schema: "https://opencode.ai/config.json" }, null, 2),
    );
    expect(isPlaywrightMcpInstalled(opencodeAdapter)).toBe(false);
  });
});

describe("ensurePlaywrightMcp", () => {
  it("does nothing when the project .mcp.json already has playwright", () => {
    writeMcpJson({ playwright: { command: "npx" } });
    const consoleSpy = vi.spyOn(console, "log");
    ensurePlaywrightMcp(claudeAdapter);
    expect(consoleSpy).toHaveBeenCalledWith(
      "  ✓ claude: playwright MCP already installed",
    );
    consoleSpy.mockRestore();
    expect(mockedExecFileSync).not.toHaveBeenCalled();
  });

  it("installs with --scope project when not installed", () => {
    // No .mcp.json → not installed → runs `claude mcp add`.
    const consoleSpy = vi.spyOn(console, "log");
    ensurePlaywrightMcp(claudeAdapter);
    expect(mockedExecFileSync).toHaveBeenCalledWith(
      "claude",
      ["mcp", "add", "--scope", "project", "playwright", "npx", "@playwright/mcp@latest"],
      expect.objectContaining({ timeout: 10000 }),
    );
    expect(consoleSpy).toHaveBeenCalledWith("  ✓ claude: playwright MCP installed");
    consoleSpy.mockRestore();
  });

  it("throws when installation fails", () => {
    mockedExecFileSync.mockImplementation(() => {
      throw new Error("Installation failed");
    });
    const consoleSpy = vi.spyOn(console, "warn");
    expect(() => ensurePlaywrightMcp(claudeAdapter)).toThrow(
      "Installation failed",
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      "  ⚠ claude: failed to install playwright MCP",
    );
    consoleSpy.mockRestore();
  });
});

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