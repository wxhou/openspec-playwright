import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  buildCommandMeta,
  formatKimiSkill,
  getKimiSkillPath,
  hasKimi,
  kimiAdapter,
  slashCommandForAdapter,
} from "../src/commands/editors.js";

const META = buildCommandMeta("Run /opsx:e2e for the change.\n");

let root: string;
let home: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "ospw-kimi-"));
  home = mkdtempSync(join(tmpdir(), "ospw-kimi-home-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  rmSync(home, { recursive: true, force: true });
});

describe("Kimi Code adapter", () => {
  it("writes the project skill with name and description", () => {
    expect(getKimiSkillPath("e2e").replace(/\\/g, "/")).toBe(
      ".kimi-code/skills/opsx-e2e/SKILL.md",
    );
    const output = formatKimiSkill(META);
    expect(output.startsWith("---\n")).toBe(true);
    expect(output).toContain("name: opsx-e2e");
    expect(output).toContain("Run /opsx-e2e for the change.");
  });

  it("uses the /skill: invocation hint", () => {
    expect(slashCommandForAdapter(kimiAdapter)).toBe("/skill:opsx-e2e");
  });

  it("detects project markers and the global home directory separately", () => {
    expect(hasKimi(root, home)).toBe(false);
    mkdirSync(join(home, ".kimi-code"), { recursive: true });
    expect(hasKimi(root, home)).toBe(true);
    expect(kimiAdapter.projectSignal(root)).toBe(false);
    mkdirSync(join(root, ".kimi"), { recursive: true });
    expect(kimiAdapter.projectSignal(root)).toBe(true);
  });

  it("installs and removes MCP in .kimi-code/mcp.json", () => {
    kimiAdapter.installMcp(root, "playwright-test", ["npx", "pw"]);
    const config = JSON.parse(
      readFileSync(join(root, ".kimi-code", "mcp.json"), "utf-8"),
    );
    expect(config.mcpServers["playwright-test"]).toEqual({
      command: "npx",
      args: ["pw"],
    });
    kimiAdapter.removeMcp(root, "playwright-test");
    expect(kimiAdapter.isMcpInstalled(root, "playwright-test")).toBe(false);
  });

  it("uses AGENTS.md as the project rules file", () => {
    expect(kimiAdapter.projectRulesPath(root)).toBe(join(root, "AGENTS.md"));
  });
});
