import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  buildCommandMeta,
  codexAdapter,
  formatCodexSkill,
  getCodexSkillPath,
  hasCodex,
  hasCommandArtifacts,
  slashCommandForAdapter,
} from "../src/commands/editors.js";

const META = buildCommandMeta("Run /opsx:e2e for the change.\n");

let root: string;
let home: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "ospw-codex-"));
  home = mkdtempSync(join(tmpdir(), "ospw-codex-home-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  rmSync(home, { recursive: true, force: true });
});

describe("Codex adapter", () => {
  it("writes the shared .agents skill with name and description", () => {
    expect(getCodexSkillPath("e2e").replace(/\\/g, "/")).toBe(
      ".agents/skills/opsx-e2e/SKILL.md",
    );
    const output = formatCodexSkill(META);
    expect(output.startsWith("---\n")).toBe(true);
    expect(output).toContain("name: opsx-e2e");
    expect(output).toContain("Run /opsx-e2e for the change.");
  });

  it("invokes skills with the $ prefix", () => {
    expect(slashCommandForAdapter(codexAdapter)).toBe("$opsx-e2e");
  });

  it("detects .codex only — the shared .agents skill is not a signal", () => {
    mkdirSync(join(root, ".agents", "skills", "opsx-e2e"), { recursive: true });
    writeFileSync(join(root, ".agents", "skills", "opsx-e2e", "SKILL.md"), "x");
    expect(hasCodex(root, home)).toBe(false);
    expect(codexAdapter.projectSignal(root)).toBe(false);
    expect(hasCommandArtifacts(root, codexAdapter)).toBe(false);

    mkdirSync(join(root, ".codex"), { recursive: true });
    expect(hasCodex(root, home)).toBe(true);
    expect(codexAdapter.projectSignal(root)).toBe(true);
  });

  it("detects the global home directory without authorizing writes", () => {
    mkdirSync(join(home, ".codex"), { recursive: true });
    expect(hasCodex(root, home)).toBe(true);
    expect(codexAdapter.projectSignal(root)).toBe(false);
  });

  it("has no MCP carrier and uses AGENTS.md", () => {
    expect(codexAdapter.supportsMcp).toBe(false);
    expect(codexAdapter.projectRulesPath(root)).toBe(join(root, "AGENTS.md"));
  });

  it("declares its artifact as shared", () => {
    expect(codexAdapter.declaration?.artifacts[0].shared).toBe(true);
  });
});
