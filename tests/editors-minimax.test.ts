import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  buildCommandMeta,
  clineAdapter,
  detectAdapters,
  enumerateAdapterArtifacts,
  formatMinimaxSkill,
  getMinimaxSkillPath,
  hasMinimax,
  hasMinimaxProjectSignal,
  hasCommandArtifacts,
  installCommand,
  minimaxAdapter,
  removeAdapterCommandArtifacts,
  removeAdapterMcp,
  retainedMcpConfigFiles,
  slashCommandForAdapter,
} from "../src/commands/editors.js";

// Shared temp-dir lifecycle for filesystem-touching tests below.
let tmpRoot: string;
beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), "openspec-pw-minimax-"));
});
afterEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
});

// ─── MiniMax Code adapter ───────────────────────────────────────────────

describe("minimaxAdapter", () => {
  it("has correct metadata", () => {
    expect(minimaxAdapter.id).toBe("minimax");
    expect(minimaxAdapter.label).toBe("minimax");
    expect(minimaxAdapter.displayName).toBe("MiniMax Code");
    expect(slashCommandForAdapter(minimaxAdapter)).toBe("/opsx-e2e");
  });

  it("command path is .agents/skills/opsx/<id>/SKILL.md", () => {
    expect(getMinimaxSkillPath("e2e")).toBe(
      join(".agents", "skills", "opsx-e2e", "SKILL.md"),
    );
  });

  it("uses AGENTS.md as the project rules file — no wrapper", () => {
    expect(minimaxAdapter.projectRulesPath(tmpRoot)).toBe(
      join(tmpRoot, "AGENTS.md"),
    );
  });

  it("declares the project-root .mcp.json as its MCP config file", () => {
    expect(minimaxAdapter.mcpConfigPath!(tmpRoot)).toBe(
      join(tmpRoot, ".mcp.json"),
    );
  });
});

// ─── Skill artifact ─────────────────────────────────────────────────────

describe("formatMinimaxSkill", () => {
  const meta = buildCommandMeta(
    "Run /opsx:e2e for the change.\nSee /opsx:propose for planning.",
  );

  it("emits name and description frontmatter", () => {
    const out = formatMinimaxSkill(meta);
    expect(out.startsWith("---\n")).toBe(true);
    expect(out).toContain("name: opsx-e2e");
    expect(out).toContain(
      "description: Run Playwright E2E verification for an OpenSpec change",
    );
  });

  it("frontmatter name matches the containing directory name", () => {
    const out = formatMinimaxSkill(meta);
    const name = /^name:\s*(.+)$/m.exec(out)?.[1]?.trim();
    expect(name).toBe("opsx-e2e");
    expect(getMinimaxSkillPath("e2e")).toContain(
      join("opsx-e2e", "SKILL.md"),
    );
  });

  it("emits no argument-hint and no disable-model-invocation field", () => {
    const out = formatMinimaxSkill(meta);
    expect(out).not.toContain("argument-hint");
    expect(out).not.toContain("disable-model-invocation");
  });

  it("rewrites /opsx: references to /opsx-", () => {
    const out = formatMinimaxSkill(meta);
    expect(out).not.toContain("/opsx:");
    expect(out).toContain("/opsx-e2e");
    expect(out).toContain("/opsx-propose");
  });

  it("installs to .agents/skills/opsx-e2e/SKILL.md", () => {
    installCommand(minimaxAdapter, meta, tmpRoot);
    const dest = join(tmpRoot, ".agents", "skills", "opsx-e2e", "SKILL.md");
    expect(existsSync(dest)).toBe(true);
    expect(readFileSync(dest, "utf-8")).toContain("name: opsx-e2e");
    expect(hasCommandArtifacts(tmpRoot, minimaxAdapter)).toBe(true);
  });
});

// ─── Detection ──────────────────────────────────────────────────────────

describe("minimax detection", () => {
  it("detects the project .minimax/ marker dir", () => {
    expect(hasMinimax(tmpRoot, "/nonexistent-home")).toBe(false);
    mkdirSync(join(tmpRoot, ".minimax"));
    expect(hasMinimax(tmpRoot, "/nonexistent-home")).toBe(true);
    expect(minimaxAdapter.detect(tmpRoot, "/nonexistent-home")).toBe(true);
    expect(minimaxAdapter.projectSignal!(tmpRoot)).toBe(true);
  });

  it("detects the global CLI install root", () => {
    const home = mkdtempSync(join(tmpdir(), "openspec-pw-home-"));
    try {
      mkdirSync(join(home, ".minimax-code"));
      expect(hasMinimax(tmpRoot, home)).toBe(true);
      expect(minimaxAdapter.detect(tmpRoot, home)).toBe(true);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("the global signal alone never satisfies the project-level signal", () => {
    const home = mkdtempSync(join(tmpdir(), "openspec-pw-home-"));
    try {
      mkdirSync(join(home, ".minimax-code"));
      expect(hasMinimax(tmpRoot, home)).toBe(true);
      expect(hasMinimaxProjectSignal(tmpRoot)).toBe(false);
      expect(minimaxAdapter.projectSignal!(tmpRoot)).toBe(false);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("detects the installed skill artifact with no marker dir", () => {
    expect(hasMinimax(tmpRoot, "/nonexistent-home")).toBe(false);
    installCommand(minimaxAdapter, buildCommandMeta("body"), tmpRoot);
    expect(hasMinimax(tmpRoot, "/nonexistent-home")).toBe(true);
    expect(hasMinimaxProjectSignal(tmpRoot)).toBe(true);
  });

  it("a project holding only the skill artifact appears in detectAdapters", () => {
    installCommand(minimaxAdapter, buildCommandMeta("body"), tmpRoot);
    const ids = detectAdapters(tmpRoot, "/nonexistent-home").map((a) => a.id);
    expect(ids).toContain("minimax");
  });

  it("never creates a .minimax/ directory itself", () => {
    hasMinimax(tmpRoot, "/nonexistent-home");
    expect(existsSync(join(tmpRoot, ".minimax"))).toBe(false);
  });
});

// ─── MCP (project-root .mcp.json) ───────────────────────────────────────

describe("minimaxAdapter MCP", () => {
  const mcpJson = () => join(tmpRoot, ".mcp.json");

  it("isMcpInstalled returns false when .mcp.json is missing", () => {
    expect(minimaxAdapter.isMcpInstalled(tmpRoot, "playwright-test")).toBe(false);
  });

  it("installMcp writes an mcpServers entry at the project root", () => {
    minimaxAdapter.installMcp(tmpRoot, "playwright-test", [
      "npx",
      "playwright",
      "run-test-mcp-server",
    ]);
    const parsed = JSON.parse(readFileSync(mcpJson(), "utf-8"));
    expect(parsed.mcpServers["playwright-test"]).toEqual({
      command: "npx",
      args: ["playwright", "run-test-mcp-server"],
    });
    expect(minimaxAdapter.isMcpInstalled(tmpRoot, "playwright-test")).toBe(true);
  });

  it("installMcp preserves the user's own server entries", () => {
    writeFileSync(
      mcpJson(),
      JSON.stringify({ mcpServers: { "user-server": { command: "uvx", args: ["foo"] } } }, null, 2) + "\n",
    );
    minimaxAdapter.installMcp(tmpRoot, "playwright-test", ["npx", "pw"]);
    const parsed = JSON.parse(readFileSync(mcpJson(), "utf-8"));
    expect(parsed.mcpServers["user-server"]).toEqual({ command: "uvx", args: ["foo"] });
    expect(parsed.mcpServers["playwright-test"]).toEqual({ command: "npx", args: ["pw"] });
  });

  it("removeMcp deletes only its own entry and keeps others", () => {
    minimaxAdapter.installMcp(tmpRoot, "playwright-test", ["npx", "pw"]);
    minimaxAdapter.installMcp(tmpRoot, "user-server", ["uvx", "foo"]);
    minimaxAdapter.removeMcp(tmpRoot, "playwright-test");
    const parsed = JSON.parse(readFileSync(mcpJson(), "utf-8"));
    expect(parsed.mcpServers["playwright-test"]).toBeUndefined();
    expect(parsed.mcpServers["user-server"]).toEqual({ command: "uvx", args: ["foo"] });
  });

  it("removeMcp is a no-op when the server or file is missing", () => {
    expect(() => minimaxAdapter.removeMcp(tmpRoot, "playwright-test")).not.toThrow();
    minimaxAdapter.installMcp(tmpRoot, "playwright-test", ["npx", "pw"]);
    expect(() => minimaxAdapter.removeMcp(tmpRoot, "playwright-test")).not.toThrow();
    expect(minimaxAdapter.isMcpInstalled(tmpRoot, "playwright-test")).toBe(false);
  });
});

// ─── Removal stays surgical under the shared .agents/ root ──────────────

describe("minimax artifact removal", () => {
  it("removes only .agents/skills/opsx-e2e/ and keeps sibling skills", () => {
    installCommand(minimaxAdapter, buildCommandMeta("body"), tmpRoot);
    const sibling = join(tmpRoot, ".agents", "skills", "other-skill", "SKILL.md");
    mkdirSync(join(tmpRoot, ".agents", "skills", "other-skill"), {
      recursive: true,
    });
    writeFileSync(sibling, "# other skill\n");

    removeAdapterCommandArtifacts(minimaxAdapter, tmpRoot);

    expect(existsSync(join(tmpRoot, ".agents", "skills", "opsx-e2e"))).toBe(false);
    expect(existsSync(sibling)).toBe(true);
    expect(existsSync(join(tmpRoot, ".agents", "skills"))).toBe(true);
  });

  it("removes the empty .agents/ tree when nothing else lives there", () => {
    installCommand(minimaxAdapter, buildCommandMeta("body"), tmpRoot);
    removeAdapterCommandArtifacts(minimaxAdapter, tmpRoot);
    expect(existsSync(join(tmpRoot, ".agents"))).toBe(false);
  });
});

// ─── Shared MCP config file guard ───────────────────────────────────────

describe("shared .mcp.json removal guard", () => {
  it("keeps the shared entry while another selected editor depends on the file", () => {
    minimaxAdapter.installMcp(tmpRoot, "playwright-test", ["npx", "pw"]);
    const retained = retainedMcpConfigFiles([minimaxAdapter], tmpRoot);
    expect(retained.has(join(tmpRoot, ".mcp.json"))).toBe(true);

    const inv = enumerateAdapterArtifacts(minimaxAdapter, tmpRoot, retained);
    expect(inv.mcpServers).toEqual([]);
    expect(inv.retainedMcpServers).toEqual(["playwright-test"]);

    removeAdapterMcp(minimaxAdapter, tmpRoot, inv.mcpServers, retained);
    expect(minimaxAdapter.isMcpInstalled(tmpRoot, "playwright-test")).toBe(true);
  });

  it("removes an exclusive-file editor's entry even when a shared-file editor stays", () => {
    // cline owns .cline/mcp.json — a file no other adapter depends on.
    clineAdapter.installMcp(tmpRoot, "playwright-test", ["npx", "pw"]);
    minimaxAdapter.installMcp(tmpRoot, "playwright-test", ["npx", "pw"]);

    const retained = retainedMcpConfigFiles([minimaxAdapter], tmpRoot);
    expect(retained.has(join(tmpRoot, ".cline", "mcp.json"))).toBe(false);

    const inv = enumerateAdapterArtifacts(clineAdapter, tmpRoot, retained);
    expect(inv.mcpServers).toEqual(["playwright-test"]);
    expect(inv.retainedMcpServers).toEqual([]);

    removeAdapterMcp(clineAdapter, tmpRoot, inv.mcpServers, retained);
    expect(clineAdapter.isMcpInstalled(tmpRoot, "playwright-test")).toBe(false);
    // The shared-file editor keeps its own entry.
    expect(minimaxAdapter.isMcpInstalled(tmpRoot, "playwright-test")).toBe(true);
  });

  it("removes the shared entry when no selected editor depends on the file", () => {
    minimaxAdapter.installMcp(tmpRoot, "playwright-test", ["npx", "pw"]);
    const inv = enumerateAdapterArtifacts(minimaxAdapter, tmpRoot, new Set());
    expect(inv.mcpServers).toEqual(["playwright-test"]);
    expect(inv.retainedMcpServers).toEqual([]);

    removeAdapterMcp(minimaxAdapter, tmpRoot, inv.mcpServers, new Set());
    expect(minimaxAdapter.isMcpInstalled(tmpRoot, "playwright-test")).toBe(false);
  });
});
