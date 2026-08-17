import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

// Capture claude CLI invocations without running them.
vi.mock("node:child_process", () => ({
  execFileSync: vi.fn(),
}));
import { execFileSync } from "node:child_process";
import { claudeAdapter } from "../src/commands/editors.js";
import { TIMEOUT } from "../src/shared/constants.js";

const mockedExecFileSync = vi.mocked(execFileSync);

// ─── Claude adapter MCP (project scope) ────────────────────────────────

describe("claudeAdapter MCP project scope", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "ospw-pw-claude-mcp-"));
    mockedExecFileSync.mockReset();
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  describe("isMcpInstalled", () => {
    it("reads the project-root .mcp.json — no CLI call", () => {
      writeFileSync(
        join(root, ".mcp.json"),
        JSON.stringify({
          mcpServers: { playwright: { command: "npx" } },
        }),
      );
      expect(claudeAdapter.isMcpInstalled(root, "playwright")).toBe(true);
      // Project-scope check must never consult `claude mcp list`.
      expect(mockedExecFileSync).not.toHaveBeenCalled();
    });

    it("returns false when .mcp.json is missing", () => {
      expect(claudeAdapter.isMcpInstalled(root, "playwright")).toBe(false);
    });

    it("returns false when .mcp.json has other servers only", () => {
      writeFileSync(
        join(root, ".mcp.json"),
        JSON.stringify({ mcpServers: { other: { command: "x" } } }),
      );
      expect(claudeAdapter.isMcpInstalled(root, "playwright")).toBe(false);
    });

    it("returns false (not throw) on unparseable .mcp.json", () => {
      writeFileSync(join(root, ".mcp.json"), "{ not json");
      expect(claudeAdapter.isMcpInstalled(root, "playwright")).toBe(false);
    });
  });

  describe("installMcp / removeMcp", () => {
    it("passes --scope project to claude mcp add", () => {
      claudeAdapter.installMcp(root, "playwright", [
        "npx",
        "@playwright/mcp@latest",
      ]);
      expect(mockedExecFileSync).toHaveBeenCalledWith(
        "claude",
        [
          "mcp",
          "add",
          "--scope",
          "project",
          "playwright",
          "npx",
          "@playwright/mcp@latest",
        ],
        expect.objectContaining({ timeout: TIMEOUT.MCP_LIST }),
      );
    });

    it("passes --scope project to claude mcp remove", () => {
      claudeAdapter.removeMcp(root, "playwright");
      expect(mockedExecFileSync).toHaveBeenCalledWith(
        "claude",
        ["mcp", "remove", "--scope", "project", "playwright"],
        expect.objectContaining({ timeout: TIMEOUT.MCP_LIST }),
      );
    });
  });
});