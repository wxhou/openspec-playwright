import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  buildCommandMeta,
  formatRooCodeCommand,
  getRooCodeCommandPath,
  getRooCodeRulesPath,
  hasRooCode,
  roocodeAdapter,
} from "../src/commands/editors.js";

const META = buildCommandMeta("Run /opsx:e2e for the change.\n");

let root: string;
let home: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "ospw-roocode-"));
  home = mkdtempSync(join(tmpdir(), "ospw-roocode-home-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  rmSync(home, { recursive: true, force: true });
});

describe("Roo Code adapter", () => {
  it("writes a heading-style markdown command", () => {
    expect(getRooCodeCommandPath("e2e").replace(/\\/g, "/")).toBe(
      ".roo/commands/opsx-e2e.md",
    );
    const output = formatRooCodeCommand(META);
    expect(output.startsWith("# OPSX: E2E\n\n")).toBe(true);
    expect(output).toContain(
      "Run Playwright E2E verification for an OpenSpec change",
    );
    expect(output).toContain("Run /opsx-e2e for the change.");
  });

  it("detects the project marker and the global home directory separately", () => {
    expect(hasRooCode(root, home)).toBe(false);
    mkdirSync(join(home, ".roo"), { recursive: true });
    expect(hasRooCode(root, home)).toBe(true);
    expect(roocodeAdapter.projectSignal(root)).toBe(false);
    mkdirSync(join(root, ".roo"), { recursive: true });
    expect(roocodeAdapter.projectSignal(root)).toBe(true);
  });

  it("installs and removes MCP in .roo/mcp.json", () => {
    roocodeAdapter.installMcp(root, "playwright-test", ["npx", "pw"]);
    const config = JSON.parse(
      readFileSync(join(root, ".roo", "mcp.json"), "utf-8"),
    );
    expect(config.mcpServers["playwright-test"]).toEqual({
      command: "npx",
      args: ["pw"],
    });
    roocodeAdapter.removeMcp(root, "playwright-test");
    expect(roocodeAdapter.isMcpInstalled(root, "playwright-test")).toBe(false);
  });

  it("uses the tool-owned rules file under .roo/rules in full mode", () => {
    expect(roocodeAdapter.projectRulesPath(root)).toBe(
      join(root, getRooCodeRulesPath()),
    );
    expect(roocodeAdapter.declaration?.rules?.mode).toBe("full");
  });
});
