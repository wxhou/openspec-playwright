import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

// Isolate the claude CLI so init runs MCP phase without a real `claude` binary.
vi.mock("node:child_process", () => ({
  execFileSync: vi.fn(),
}));
import { execFileSync } from "node:child_process";
import { init } from "../src/commands/init.js";

const mockedExecFileSync = vi.mocked(execFileSync);

// ─── init writes Claude MCP at project scope ───────────────────────────

describe("init Claude MCP project scope", () => {
  let root: string;
  let cwdSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "ospw-pw-init-mcp-"));
    mkdirSync(join(root, "openspec"), { recursive: true });
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(root);
    mockedExecFileSync.mockReset();
  });

  afterEach(() => {
    cwdSpy.mockRestore();
    rmSync(root, { recursive: true, force: true });
  });

  it("installs Playwright MCP with --scope project for Claude", async () => {
    await init({ tools: "claude" });

    const claudeAdd = mockedExecFileSync.mock.calls.find(
      (call) =>
        call[0] === "claude" &&
        call[1]?.[0] === "mcp" &&
        call[1]?.[1] === "add",
    );
    expect(claudeAdd).toBeDefined();
    const args = claudeAdd![1] as string[];
    expect(args).toContain("--scope");
    expect(args).toContain("project");
    expect(args).toContain("playwright");
  });

  it("skips reinstall when the project .mcp.json already has playwright", async () => {
    writeFileSync(
      join(root, ".mcp.json"),
      JSON.stringify({
        mcpServers: { playwright: { command: "npx" } },
      }),
    );

    await init({ tools: "claude" });

    const claudeAdd = mockedExecFileSync.mock.calls.some(
      (call) => call[0] === "claude" && call[1]?.[1] === "add",
    );
    expect(claudeAdd).toBe(false);
  });
});