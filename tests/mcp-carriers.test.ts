import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  buildMcpRuntime,
  readOpenCodeInstructions,
  writeOpenCodeInstructions,
} from "../src/commands/editors/mcp-carriers.js";

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "ospw-carrier-"));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

const COMMAND = ["npx", "playwright", "run-test-mcp-server"];

describe("mcp-servers-file carrier", () => {
  const runtime = () =>
    buildMcpRuntime({
      kind: "mcp-servers-file",
      path: (r) => join(r, ".editor", "mcp.json"),
    });

  it("installs, detects, and removes one entry", () => {
    const mcp = runtime();
    expect(mcp.supportsMcp).toBe(true);
    expect(mcp.mcpConfigPath!(root)).toBe(join(root, ".editor", "mcp.json"));
    expect(mcp.isMcpInstalled(root, "playwright-test")).toBe(false);

    mcp.installMcp(root, "playwright-test", COMMAND);
    const parsed = JSON.parse(
      readFileSync(join(root, ".editor", "mcp.json"), "utf-8"),
    );
    expect(parsed.mcpServers["playwright-test"]).toEqual({
      command: "npx",
      args: ["playwright", "run-test-mcp-server"],
    });
    expect(mcp.isMcpInstalled(root, "playwright-test")).toBe(true);

    mcp.removeMcp(root, "playwright-test");
    expect(mcp.isMcpInstalled(root, "playwright-test")).toBe(false);
  });
});

describe("claude-cli carrier", () => {
  it("reads the shared config file without invoking the CLI", () => {
    const mcp = buildMcpRuntime({
      kind: "claude-cli",
      configPath: (r) => join(r, ".mcp.json"),
    });
    expect(mcp.supportsMcp).toBe(true);
    expect(mcp.mcpConfigPath!(root)).toBe(join(root, ".mcp.json"));
    expect(mcp.isMcpInstalled(root, "playwright-test")).toBe(false);

    writeFileSync(
      join(root, ".mcp.json"),
      JSON.stringify({ mcpServers: { "playwright-test": { command: "npx" } } }),
    );
    expect(mcp.isMcpInstalled(root, "playwright-test")).toBe(true);
  });
});

describe("opencode-json carrier", () => {
  it("installs under mcp.<server> and removes it", () => {
    const mcp = buildMcpRuntime({ kind: "opencode-json" });
    expect(mcp.supportsMcp).toBe(true);
    // Exclusive file — never a shared-retention candidate.
    expect(mcp.mcpConfigPath).toBeUndefined();

    mcp.installMcp(root, "playwright-test", COMMAND);
    const parsed = JSON.parse(
      readFileSync(join(root, "opencode.jsonc"), "utf-8"),
    );
    expect(parsed.mcp["playwright-test"]).toEqual({
      type: "local",
      command: COMMAND,
    });
    expect(mcp.isMcpInstalled(root, "playwright-test")).toBe(true);

    mcp.removeMcp(root, "playwright-test");
    expect(mcp.isMcpInstalled(root, "playwright-test")).toBe(false);
  });

  it("reads and writes the instructions array", () => {
    expect(readOpenCodeInstructions(root)).toBeUndefined();
    writeOpenCodeInstructions(root, ["AGENTS.md"]);
    expect(readOpenCodeInstructions(root)).toEqual(["AGENTS.md"]);
  });
});

describe("none carrier", () => {
  it("skips every MCP phase", () => {
    const mcp = buildMcpRuntime({ kind: "none" });
    expect(mcp.supportsMcp).toBe(false);
    expect(mcp.mcpConfigPath).toBeUndefined();
    expect(mcp.isMcpInstalled(root, "playwright-test")).toBe(false);
    expect(() => {
      mcp.installMcp(root, "playwright-test", COMMAND);
      mcp.removeMcp(root, "playwright-test");
    }).not.toThrow();
  });
});
