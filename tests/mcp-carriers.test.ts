import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "fs";
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

  it("refuses to overwrite a config file that is not valid JSON", () => {
    const configPath = join(root, ".editor", "mcp.json");
    mkdirSync(join(root, ".editor"), { recursive: true });
    writeFileSync(configPath, "{ not json");

    expect(() =>
      runtime().installMcp(root, "playwright-test", COMMAND),
    ).toThrow(/not a valid MCP config/);
    expect(readFileSync(configPath, "utf-8")).toBe("{ not json");
  });

  it("refuses to remove from a config file that is not valid JSON", () => {
    const configPath = join(root, ".editor", "mcp.json");
    mkdirSync(join(root, ".editor"), { recursive: true });
    writeFileSync(configPath, "{ not json");

    expect(() =>
      runtime().removeMcp(root, "playwright-test"),
    ).toThrow(/not a valid MCP config/);
    expect(readFileSync(configPath, "utf-8")).toBe("{ not json");
  });

  it("does not write through a symlinked config file", () => {
    if (process.platform === "win32") return;
    const outside = mkdtempSync(join(tmpdir(), "ospw-carrier-outside-"));
    try {
      const external = join(outside, "mcp.json");
      writeFileSync(external, JSON.stringify({ mcpServers: {} }));
      mkdirSync(join(root, ".editor"), { recursive: true });
      symlinkSync(external, join(root, ".editor", "mcp.json"));

      expect(() =>
        runtime().installMcp(root, "playwright-test", COMMAND),
      ).toThrow(/outside the project/);
      const parsed = JSON.parse(readFileSync(external, "utf-8"));
      expect(parsed.mcpServers["playwright-test"]).toBeUndefined();
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });
});

describe("mcp-servers-file carrier with serverType", () => {
  const runtime = () =>
    buildMcpRuntime({
      kind: "mcp-servers-file",
      path: (r) => join(r, ".mcp.json"),
      serverType: "stdio",
    });

  it("writes the type field and requires it when detecting", () => {
    const mcp = runtime();
    // A typeless entry (older Claude CLI) is not counted as installed.
    writeFileSync(
      join(root, ".mcp.json"),
      JSON.stringify({ mcpServers: { "playwright-test": { command: "npx" } } }),
    );
    expect(mcp.isMcpInstalled(root, "playwright-test")).toBe(false);
    // Removal still sees the entry: a typeless legacy entry is removable.
    expect(mcp.isMcpEntryPresent(root, "playwright-test")).toBe(true);

    mcp.installMcp(root, "playwright-test", COMMAND);
    const parsed = JSON.parse(readFileSync(join(root, ".mcp.json"), "utf-8"));
    expect(parsed.mcpServers["playwright-test"]).toEqual({
      type: "stdio",
      command: "npx",
      args: ["playwright", "run-test-mcp-server"],
    });
    expect(mcp.isMcpInstalled(root, "playwright-test")).toBe(true);

    mcp.removeMcp(root, "playwright-test");
    expect(mcp.isMcpInstalled(root, "playwright-test")).toBe(false);
  });

  it("preserves user fields when upgrading a legacy entry", () => {
    writeFileSync(
      join(root, ".mcp.json"),
      JSON.stringify({
        mcpServers: {
          "playwright-test": {
            command: "npx",
            args: ["old"],
            env: { BROWSER: "firefox" },
          },
        },
      }),
    );
    const mcp = runtime();
    mcp.installMcp(root, "playwright-test", COMMAND);
    const parsed = JSON.parse(readFileSync(join(root, ".mcp.json"), "utf-8"));
    expect(parsed.mcpServers["playwright-test"]).toEqual({
      env: { BROWSER: "firefox" },
      type: "stdio",
      command: "npx",
      args: ["playwright", "run-test-mcp-server"],
    });
  });

  it("refuses an array-shaped server map instead of dropping the entry", () => {
    writeFileSync(join(root, ".mcp.json"), JSON.stringify({ mcpServers: [] }));
    expect(() =>
      runtime().installMcp(root, "playwright-test", COMMAND),
    ).toThrow(/not a valid MCP config/);
    expect(JSON.parse(readFileSync(join(root, ".mcp.json"), "utf-8"))).toEqual({
      mcpServers: [],
    });
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
    // Path is exposed for the remove plan's boundary check; no other adapter
    // shares this file, so shared-file retention never applies.
    expect(mcp.mcpConfigPath!(root)).toBe(join(root, "opencode.jsonc"));

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

  it("does not write through a symlinked opencode config", () => {
    if (process.platform === "win32") return;
    const outside = mkdtempSync(join(tmpdir(), "ospw-carrier-outside-"));
    try {
      const external = join(outside, "opencode.json");
      writeFileSync(external, JSON.stringify({ mcp: {} }));
      symlinkSync(external, join(root, "opencode.json"));

      buildMcpRuntime({ kind: "opencode-json" }).installMcp(
        root,
        "playwright-test",
        COMMAND,
      );

      expect(JSON.parse(readFileSync(external, "utf-8"))).toEqual({ mcp: {} });
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
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
