import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  buildCommandMeta,
  formatQwenCommand,
  getQwenCommandPath,
  hasQwen,
  qwenAdapter,
} from "../src/commands/editors.js";

const META = buildCommandMeta("Run /opsx:e2e for the change.\n");

let root: string;
let home: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "ospw-qwen-"));
  home = mkdtempSync(join(tmpdir(), "ospw-qwen-home-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  rmSync(home, { recursive: true, force: true });
});

describe("Qwen Code adapter", () => {
  it("writes a markdown command with a description frontmatter", () => {
    expect(getQwenCommandPath("e2e").replace(/\\/g, "/")).toBe(
      ".qwen/commands/opsx-e2e.md",
    );
    const output = formatQwenCommand(META);
    expect(output.startsWith("---\n")).toBe(true);
    expect(output).toContain(
      "description: Run Playwright E2E verification for an OpenSpec change",
    );
    expect(output).toContain("Run /opsx-e2e for the change.");
  });

  it("detects the project marker and the global home directory separately", () => {
    expect(hasQwen(root, home)).toBe(false);
    mkdirSync(join(home, ".qwen"), { recursive: true });
    expect(hasQwen(root, home)).toBe(true);
    expect(qwenAdapter.projectSignal(root)).toBe(false);
    mkdirSync(join(root, ".qwen"), { recursive: true });
    expect(qwenAdapter.projectSignal(root)).toBe(true);
  });

  it("installs and removes MCP in .qwen/settings.json", () => {
    qwenAdapter.installMcp(root, "playwright-test", ["npx", "pw"]);
    const settings = JSON.parse(
      readFileSync(join(root, ".qwen", "settings.json"), "utf-8"),
    );
    expect(settings.mcpServers["playwright-test"]).toEqual({
      command: "npx",
      args: ["pw"],
    });
    qwenAdapter.removeMcp(root, "playwright-test");
    expect(qwenAdapter.isMcpInstalled(root, "playwright-test")).toBe(false);
  });

  it("uses QWEN.md in full-standards mode", () => {
    expect(qwenAdapter.projectRulesPath(root)).toBe(join(root, "QWEN.md"));
    expect(qwenAdapter.declaration?.rules?.mode).toBe("full");
  });
});
