import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  buildCommandMeta,
  formatTraeCommand,
  getTraeCommandPath,
  getTraeRulesPath,
  hasTrae,
  traeAdapter,
} from "../src/commands/editors.js";

const META = buildCommandMeta("Run /opsx:e2e for the change.\n");

let root: string;
let home: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "ospw-trae-"));
  home = mkdtempSync(join(tmpdir(), "ospw-trae-home-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  rmSync(home, { recursive: true, force: true });
});

describe("Trae adapter", () => {
  it("writes a markdown command with name and description frontmatter", () => {
    expect(getTraeCommandPath("e2e").replace(/\\/g, "/")).toBe(
      ".trae/commands/opsx-e2e.md",
    );
    const output = formatTraeCommand(META);
    expect(output.startsWith("---\n")).toBe(true);
    expect(output).toContain("name: opsx-e2e");
    expect(output).toContain(
      "description: Run Playwright E2E verification for an OpenSpec change",
    );
    expect(output).toContain("Run /opsx-e2e for the change.");
  });

  it("detects the project directory only", () => {
    expect(hasTrae(root, home)).toBe(false);
    // No global detection path is declared.
    mkdirSync(join(home, ".trae"), { recursive: true });
    expect(hasTrae(root, home)).toBe(false);
    mkdirSync(join(root, ".trae"), { recursive: true });
    expect(hasTrae(root, home)).toBe(true);
    expect(traeAdapter.projectSignal(root)).toBe(true);
  });

  it("installs and removes MCP in .trae/mcp.json", () => {
    traeAdapter.installMcp(root, "playwright-test", ["npx", "pw"]);
    const config = JSON.parse(
      readFileSync(join(root, ".trae", "mcp.json"), "utf-8"),
    );
    expect(config.mcpServers["playwright-test"]).toEqual({
      command: "npx",
      args: ["pw"],
    });
    traeAdapter.removeMcp(root, "playwright-test");
    expect(traeAdapter.isMcpInstalled(root, "playwright-test")).toBe(false);
  });

  it("uses .trae/rules/project_rules.md in full mode", () => {
    expect(traeAdapter.projectRulesPath(root)).toBe(
      join(root, getTraeRulesPath()),
    );
    expect(traeAdapter.declaration?.rules?.mode).toBe("full");
  });
});
