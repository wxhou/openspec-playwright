import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  buildCommandMeta,
  dshAdapter,
  formatDshSkill,
  getDshSkillPath,
  hasCommandArtifacts,
  hasDsh,
  hasDshProjectSignal,
  installCommand,
  slashCommandForAdapter,
} from "../src/commands/editors.js";

let tmpRoot: string;
let home: string;
beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), "openspec-pw-dsh-"));
  home = mkdtempSync(join(tmpdir(), "openspec-pw-dsh-home-"));
});
afterEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
  rmSync(home, { recursive: true, force: true });
});

// ─── DeepSeek Harness adapter ───────────────────────────────────────────

describe("dshAdapter", () => {
  it("has correct metadata", () => {
    expect(dshAdapter.id).toBe("dsh");
    expect(dshAdapter.label).toBe("dsh");
    expect(dshAdapter.displayName).toBe("DeepSeek Harness");
    expect(slashCommandForAdapter(dshAdapter)).toBe("/opsx-e2e");
  });

  it("command path is .dsh/skills/opsx-<id>/SKILL.md", () => {
    expect(getDshSkillPath("e2e")).toBe(
      join(".dsh", "skills", "opsx-e2e", "SKILL.md"),
    );
  });

  it("uses AGENTS.md as the project rules file — no wrapper", () => {
    expect(dshAdapter.projectRulesPath(tmpRoot)).toBe(join(tmpRoot, "AGENTS.md"));
  });

  it("declares no MCP carrier", () => {
    // dsh keeps MCP servers in per-user profile patch layers under $DSH_HOME.
    expect(dshAdapter.supportsMcp).toBe(false);
    expect(dshAdapter.mcpConfigPath).toBeUndefined();
  });
});

// ─── Skill artifact ─────────────────────────────────────────────────────

describe("formatDshSkill", () => {
  const meta = buildCommandMeta(
    "Run /opsx:e2e for the change.\nSee /opsx:propose for planning.",
  );

  it("emits kebab-case name and description frontmatter", () => {
    const out = formatDshSkill(meta);
    expect(out.startsWith("---\n")).toBe(true);
    expect(out).toContain("name: opsx-e2e");
    expect(out).toContain(
      "description: Run Playwright E2E verification for an OpenSpec change",
    );
    // dsh discards a skill whose name is missing or not kebab-case.
    expect(/^name:\s*([a-z0-9]+(-[a-z0-9]+)*)$/m.test(out)).toBe(true);
  });

  it("rewrites /opsx: references to /opsx-", () => {
    const out = formatDshSkill(meta);
    expect(out).not.toContain("/opsx:");
    expect(out).toContain("/opsx-e2e");
    expect(out).toContain("/opsx-propose");
  });

  it("installs to .dsh/skills/opsx-e2e/SKILL.md", () => {
    installCommand(dshAdapter, meta, tmpRoot);
    const dest = join(tmpRoot, ".dsh", "skills", "opsx-e2e", "SKILL.md");
    expect(existsSync(dest)).toBe(true);
    expect(readFileSync(dest, "utf-8")).toContain("name: opsx-e2e");
    expect(hasCommandArtifacts(tmpRoot, dshAdapter)).toBe(true);
    // The shared skill root stays untouched.
    expect(existsSync(join(tmpRoot, ".agents"))).toBe(false);
  });
});

// ─── Detection ──────────────────────────────────────────────────────────

describe("dsh detection", () => {
  it("detects the project .dsh/ marker dir", () => {
    expect(hasDsh(tmpRoot, home)).toBe(false);
    mkdirSync(join(tmpRoot, ".dsh"));
    expect(hasDsh(tmpRoot, home)).toBe(true);
    expect(dshAdapter.detect(tmpRoot, home)).toBe(true);
    expect(dshAdapter.projectSignal(tmpRoot)).toBe(true);
  });

  it("detects the global DSH_HOME without authorizing a project write", () => {
    mkdirSync(join(home, ".dsh"));
    expect(hasDsh(tmpRoot, home)).toBe(true);
    expect(dshAdapter.detect(tmpRoot, home)).toBe(true);
    expect(hasDshProjectSignal(tmpRoot)).toBe(false);
  });

  it("does not take the shared .agents/skills root as a project signal", () => {
    // `.agents/skills` belongs to the MiniMax adapter; dsh reads it too, but
    // owning that directory must not make a project look dsh-configured.
    mkdirSync(join(tmpRoot, ".agents", "skills", "opsx-e2e"), { recursive: true });
    expect(hasDshProjectSignal(tmpRoot)).toBe(false);
  });
});
