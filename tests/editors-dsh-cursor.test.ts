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
  cursorAdapter,
  detectAdapters,
  dshAdapter,
  formatCursorCommand,
  formatCursorSkill,
  formatDshCommand,
  getCursorCommandPath,
  getCursorSkillPath,
  getDshCommandPath,
  hasCursor,
  hasDsh,
  installCommand,
  installOpenSpecBlock,
  installProjectRules,
  listCommandArtifactPaths,
  opencodeAdapter,
} from "../src/commands/editors.js";
import { uninstall } from "../src/commands/uninstall.js";
import { compareBlock } from "../src/shared/drift.js";

// Shared temp-dir lifecycle for filesystem-touching tests below.
let tmpRoot: string;
beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), "openspec-pw-editors-"));
});
afterEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
});

// ─── DeepSeek Harness adapter ─────────────────────────────────────────────
describe("dshAdapter", () => {
  it("has correct metadata", () => {
    expect(dshAdapter.id).toBe("dsh");
    expect(dshAdapter.displayName).toBe("DeepSeek Harness");
    // dsh configures MCP via cordis.yml plugin config, not a simple file —
    // MCP phases must skip it.
    expect(dshAdapter.supportsMcp).toBe(false);
  });

  it("detects a project .dsh/ directory", () => {
    mkdirSync(join(tmpRoot, ".dsh"));
    expect(hasDsh(tmpRoot)).toBe(true);
    expect(dshAdapter.detect(tmpRoot)).toBe(true);
  });

  it("detects the global ~/.dsh directory (DSH_HOME)", () => {
    const home = join(tmpRoot, "fake-home");
    mkdirSync(join(home, ".dsh"), { recursive: true });
    expect(hasDsh(tmpRoot, home)).toBe(true);
    expect(dshAdapter.detect(tmpRoot, home)).toBe(true);
  });

  it("does not detect when neither .dsh/ nor ~/.dsh exists", () => {
    const home = join(tmpRoot, "fake-home");
    expect(hasDsh(tmpRoot, home)).toBe(false);
    expect(dshAdapter.detect(tmpRoot, home)).toBe(false);
  });
});

describe("getDshCommandPath", () => {
  it("returns .dsh/skills/opsx-<id>/SKILL.md", () => {
    expect(getDshCommandPath("e2e")).toBe(
      join(".dsh", "skills", "opsx-e2e", "SKILL.md"),
    );
  });
});

describe("formatDshCommand", () => {
  it("emits name + description frontmatter and hyphenated body", () => {
    const meta = buildCommandMeta("Run the E2E flow via /opsx:e2e");
    const out = formatDshCommand(meta);
    expect(out).toContain("name: opsx-e2e");
    expect(out).toContain(
      "description: Run Playwright E2E verification for an OpenSpec change",
    );
    expect(out).toContain("/opsx-e2e");
    expect(out).not.toContain("/opsx:e2e");
  });
});

describe("dshAdapter MCP (no simple file)", () => {
  it("isMcpInstalled always returns false", () => {
    expect(dshAdapter.isMcpInstalled(tmpRoot, "playwright")).toBe(false);
  });

  it("installMcp and removeMcp are no-ops (do not write files)", () => {
    dshAdapter.installMcp(tmpRoot, "playwright", ["npx", "@playwright/mcp@latest"]);
    dshAdapter.removeMcp(tmpRoot, "playwright");
    expect(existsSync(join(tmpRoot, ".dsh", "mcp.json"))).toBe(false);
  });
});

describe("installCommand (DeepSeek Harness)", () => {
  it("writes the skill to .dsh/skills/opsx-e2e/SKILL.md", () => {
    const meta = buildCommandMeta("Do the E2E thing");
    installCommand(dshAdapter, meta, tmpRoot);
    const dest = join(tmpRoot, ".dsh", "skills", "opsx-e2e", "SKILL.md");
    expect(existsSync(dest)).toBe(true);
    const content = readFileSync(dest, "utf-8");
    expect(content).toContain("name: opsx-e2e");
    expect(content).toContain("Do the E2E thing");
  });

  it("lists the skill file as the only artifact", () => {
    const meta = buildCommandMeta("body");
    expect(listCommandArtifactPaths(dshAdapter, meta)).toEqual([
      join(".dsh", "skills", "opsx-e2e", "SKILL.md"),
    ]);
  });
});

describe("installProjectRules (DeepSeek Harness)", () => {
  it("writes AGENTS.md (SSOT) and no CLAUDE.md wrapper", () => {
    mkdirSync(join(tmpRoot, ".dsh"));
    const detected = detectAdapters(tmpRoot, join(tmpRoot, "fake-home"));
    installProjectRules(tmpRoot, "standards", detected);
    expect(existsSync(join(tmpRoot, "AGENTS.md"))).toBe(true);
    expect(existsSync(join(tmpRoot, "CLAUDE.md"))).toBe(false);
  });
});

// ─── Cursor adapter ──────────────────────────────────────────────────────────

describe("cursorAdapter", () => {
  it("has correct metadata", () => {
    expect(cursorAdapter.id).toBe("cursor");
    expect(cursorAdapter.displayName).toBe("Cursor");
  });

  it("detects .cursor/ directory", () => {
    mkdirSync(join(tmpRoot, ".cursor"));
    expect(hasCursor(tmpRoot)).toBe(true);
    expect(cursorAdapter.detect(tmpRoot)).toBe(true);
  });

  it("does not detect when .cursor/ is missing", () => {
    expect(hasCursor(tmpRoot)).toBe(false);
    expect(cursorAdapter.detect(tmpRoot)).toBe(false);
  });
});

describe("getCursorCommandPath / getCursorSkillPath", () => {
  it("returns expected relative paths", () => {
    expect(getCursorCommandPath("e2e")).toBe(
      join(".cursor", "commands", "opsx-e2e.md"),
    );
    expect(getCursorSkillPath("e2e")).toBe(
      join(".cursor", "skills", "opsx-e2e", "SKILL.md"),
    );
  });
});

describe("formatCursorCommand", () => {
  const meta = buildCommandMeta("Run /opsx:e2e now");

  it("is plain markdown with no YAML frontmatter", () => {
    const out = formatCursorCommand(meta);
    expect(out.trimStart().startsWith("---")).toBe(false);
    expect(out).not.toMatch(/^name:/m);
  });

  it("includes $1 change-name preamble and hyphenates /opsx:", () => {
    const out = formatCursorCommand(meta);
    expect(out).toContain("$1");
    expect(out).toContain("/opsx-e2e");
    expect(out).not.toContain("/opsx:");
  });
});

describe("formatCursorSkill", () => {
  const meta = buildCommandMeta("Run /opsx:e2e now");

  it("emits frontmatter with disable-model-invocation and no $1", () => {
    const out = formatCursorSkill(meta);
    expect(out).toContain("name: opsx-e2e");
    expect(out).toContain("disable-model-invocation: true");
    expect(out).toContain("/opsx-e2e");
    expect(out).not.toContain("/opsx:");
    expect(out).not.toContain("$1");
  });
});

describe("cursorAdapter MCP", () => {
  it("installMcp creates .cursor/mcp.json and preserves unknown fields", () => {
    mkdirSync(join(tmpRoot, ".cursor"), { recursive: true });
    writeFileSync(
      join(tmpRoot, ".cursor", "mcp.json"),
      JSON.stringify(
        { mcpServers: { other: { command: "echo", args: ["hi"] } }, keep: 1 },
        null,
        2,
      ),
    );

    cursorAdapter.installMcp(tmpRoot, "playwright", [
      "npx",
      "@playwright/mcp@latest",
    ]);

    const cfg = JSON.parse(
      readFileSync(join(tmpRoot, ".cursor", "mcp.json"), "utf-8"),
    );
    expect(cfg.mcpServers.playwright).toEqual({
      command: "npx",
      args: ["@playwright/mcp@latest"],
    });
    expect(cfg.mcpServers.other).toEqual({ command: "echo", args: ["hi"] });
    expect(cfg.keep).toBe(1);
    expect(cursorAdapter.isMcpInstalled(tmpRoot, "playwright")).toBe(true);
  });

  it("removeMcp removes only playwright and preserves other fields", () => {
    cursorAdapter.installMcp(tmpRoot, "playwright", ["npx", "pw"]);
    cursorAdapter.installMcp(tmpRoot, "other", ["echo", "hi"]);
    cursorAdapter.removeMcp(tmpRoot, "playwright");

    const cfg = JSON.parse(
      readFileSync(join(tmpRoot, ".cursor", "mcp.json"), "utf-8"),
    );
    expect(cfg.mcpServers.playwright).toBeUndefined();
    expect(cfg.mcpServers.other).toEqual({ command: "echo", args: ["hi"] });
  });

  it("isMcpInstalled is false when already missing / file absent", () => {
    expect(cursorAdapter.isMcpInstalled(tmpRoot, "playwright")).toBe(false);
    cursorAdapter.installMcp(tmpRoot, "playwright", ["npx", "pw"]);
    expect(cursorAdapter.isMcpInstalled(tmpRoot, "playwright")).toBe(true);
  });
});

describe("installCommand (Cursor dual artifacts)", () => {
  it("writes command and skill files", () => {
    const meta = buildCommandMeta("Do the E2E thing with /opsx:e2e");
    installCommand(cursorAdapter, meta, tmpRoot);

    const cmdPath = join(tmpRoot, ".cursor", "commands", "opsx-e2e.md");
    const skillPath = join(
      tmpRoot,
      ".cursor",
      "skills",
      "opsx-e2e",
      "SKILL.md",
    );
    expect(existsSync(cmdPath)).toBe(true);
    expect(existsSync(skillPath)).toBe(true);
    expect(readFileSync(cmdPath, "utf-8")).toContain("$1");
    expect(readFileSync(skillPath, "utf-8")).toContain(
      "disable-model-invocation: true",
    );
    expect(listCommandArtifactPaths(cursorAdapter, meta)).toEqual([
      getCursorCommandPath("e2e"),
      getCursorSkillPath("e2e"),
    ]);
  });
});

describe("uninstall removes Cursor dual artifacts", () => {
  it("deletes command, skill, and empties skill dir", async () => {
    mkdirSync(join(tmpRoot, ".cursor"));
    const meta = buildCommandMeta("body /opsx:e2e");
    installCommand(cursorAdapter, meta, tmpRoot);
    cursorAdapter.installMcp(tmpRoot, "playwright", ["npx", "pw"]);

    const cwd = process.cwd();
    try {
      process.chdir(tmpRoot);
      await uninstall();
    } finally {
      process.chdir(cwd);
    }

    expect(
      existsSync(join(tmpRoot, ".cursor", "commands", "opsx-e2e.md")),
    ).toBe(false);
    expect(
      existsSync(join(tmpRoot, ".cursor", "skills", "opsx-e2e", "SKILL.md")),
    ).toBe(false);
    const mcp = JSON.parse(
      readFileSync(join(tmpRoot, ".cursor", "mcp.json"), "utf-8"),
    );
    expect(mcp.mcpServers.playwright).toBeUndefined();
  });
});

describe("installProjectRules (Cursor only)", () => {
  it("writes AGENTS.md and does not create .cursor/rules", () => {
    mkdirSync(join(tmpRoot, ".cursor"));
    const detected = detectAdapters(tmpRoot, join(tmpRoot, "fake-home"));
    installProjectRules(tmpRoot, "## Standards\nCursor only", detected);

    expect(existsSync(join(tmpRoot, "AGENTS.md"))).toBe(true);
    expect(existsSync(join(tmpRoot, ".cursor", "rules"))).toBe(false);
    expect(existsSync(join(tmpRoot, "CLAUDE.md"))).toBe(false);
  });
});

// ─── installOpenSpecBlock: truncated-marker repair ────────────────────────

describe("installOpenSpecBlock truncated-marker repair", () => {
  const M_START = "<!-- OPENSPEC:START -->";
  const M_END = "<!-- OPENSPEC:END -->";

  it("repairs a lone START marker (no END) instead of skipping", () => {
    const dest = join(tmpRoot, "AGENTS.md");
    writeFileSync(dest, `# proj\n${M_START}\nsome half-written content\n`);
    installOpenSpecBlock(tmpRoot, "EMPLOYEE STANDARDS", opencodeAdapter);
    const content = readFileSync(dest, "utf-8");
    expect(content).toContain(M_START);
    expect(content).toContain(M_END);
    expect(content).toContain("EMPLOYEE STANDARDS");
    // The half-written marker content is gone (rebuilt clean)
    expect(content).not.toContain("some half-written content");
  });

  it("repairs a lone END marker (no START)", () => {
    const dest = join(tmpRoot, "AGENTS.md");
    writeFileSync(dest, `# proj\n${M_END}\norphan end\n`);
    installOpenSpecBlock(tmpRoot, "EMPLOYEE STANDARDS", opencodeAdapter);
    const content = readFileSync(dest, "utf-8");
    expect(content).toContain(M_START);
    expect(content).toContain(M_END);
    expect(content).toContain("EMPLOYEE STANDARDS");
    expect(content).not.toContain("orphan end");
  });

  it("repaired block is no longer reported stale", () => {
    const dest = join(tmpRoot, "AGENTS.md");
    writeFileSync(dest, `# proj\n${M_START}\nsome half-written content\n`);
    installOpenSpecBlock(tmpRoot, "EMPLOYEE STANDARDS", opencodeAdapter);
    const content = readFileSync(dest, "utf-8");
    expect(compareBlock(content, "EMPLOYEE STANDARDS").stale).toBe(false);
  });
});
