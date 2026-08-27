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
    // A real frontend project — without a frontend signal the MCP phase is
    // skipped by design (see mcp-gate-frontend).
    writeFileSync(
      join(root, "package.json"),
      JSON.stringify({ scripts: { dev: "vite" } }),
    );
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
    // Single-server layout: the installed server is the official test-runner.
    // `claude mcp add --scope project <server> <cmd...>` — server at index 4.
    expect(args[4]).toBe("playwright-test");
    // The legacy browser-control server is NOT installed alongside
    // (playwright-test is a superset — installing both would duplicate
    // 78 browser_* tools in every session).
    expect(args).not.toContain("npx @playwright/mcp@latest");
  });

  it("installs only playwright-test when a legacy playwright entry exists", async () => {
    writeFileSync(
      join(root, ".mcp.json"),
      JSON.stringify({
        mcpServers: { playwright: { command: "npx" } },
      }),
    );

    await init({ tools: "claude" });

    const addCalls = mockedExecFileSync.mock.calls.filter(
      (call) => call[0] === "claude" && call[1]?.[1] === "add",
    );
    // Only the test-runner server is installed; the legacy playwright entry
    // is neither re-added nor removed (cleanup is uninstall's job).
    // `claude mcp add --scope project <server> <cmd...>` — server at index 4.
    const servers = addCalls.map((c) => (c[1] as string[])[4]);
    expect(servers).toEqual(["playwright-test"]);
  });

  it("skips install when .mcp.json already has playwright-test", async () => {
    writeFileSync(
      join(root, ".mcp.json"),
      JSON.stringify({
        mcpServers: {
          "playwright-test": {
            command: "npx",
            args: ["playwright", "run-test-mcp-server"],
          },
        },
      }),
    );

    await init({ tools: "claude" });

    const claudeAdd = mockedExecFileSync.mock.calls.some(
      (call) => call[0] === "claude" && call[1]?.[1] === "add",
    );
    expect(claudeAdd).toBe(false);
  });
});

// ─── init MCP install gated on frontend signal ────────────────────────

describe("init MCP frontend gate", () => {
  let root: string;
  let cwdSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "ospw-pw-init-mcp-gate-"));
    mkdirSync(join(root, "openspec"), { recursive: true });
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(root);
    mockedExecFileSync.mockReset();
  });

  afterEach(() => {
    cwdSpy.mockRestore();
    rmSync(root, { recursive: true, force: true });
  });

  const claudeMcpAddCalls = () =>
    mockedExecFileSync.mock.calls.filter(
      (call) =>
        call[0] === "claude" &&
        call[1]?.[0] === "mcp" &&
        call[1]?.[1] === "add",
    );

  it("skips MCP install for a pure API project", async () => {
    writeFileSync(
      join(root, "package.json"),
      JSON.stringify({ scripts: { dev: "node server.js" } }),
    );
    const logs: string[] = [];
    const logSpy = vi
      .spyOn(console, "log")
      .mockImplementation((...args: unknown[]) => logs.push(args.join(" ")));
    try {
      await init({ tools: "claude" });
      expect(claudeMcpAddCalls()).toHaveLength(0);
      expect(logs.some((l) => l.includes("skipping Playwright MCP"))).toBe(
        true,
      );
    } finally {
      logSpy.mockRestore();
    }
  });

  it("skips MCP install when no package.json exists", async () => {
    await init({ tools: "claude" });
    expect(claudeMcpAddCalls()).toHaveLength(0);
  });

  it("installs MCP when a frontend signal is present", async () => {
    writeFileSync(
      join(root, "package.json"),
      JSON.stringify({ scripts: { dev: "vite" } }),
    );
    await init({ tools: "claude" });
    expect(claudeMcpAddCalls().length).toBeGreaterThan(0);
  });
});