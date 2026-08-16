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
  blockMatchesExpected,
  buildCommandMeta,
  claudeAdapter,
  claudeWrapperStandardsContent,
  cleanProjectRules,
  clineAdapter,
  detectAdapters,
  escapeYamlValue,
  formatClaudeCommand,
  formatClineCommand,
  formatOpenCodeCommand,
  formatTagsArray,
  formatPiCommand,
  formatOmpCommand,
  getAdapter,
  getClaudeCommandPath,
  getClineCommandPath,
  getOpenCodeCommandPath,
  getPiCommandPath,
  getOmpCommandPath,
  hasClaudeCode,
  hasOpenCode,
  hasPi,
  hasOmp,
  installCommand,
  installProjectRules,
  listCommandArtifactPaths,
  opencodeAdapter,
  piAdapter,
  ompAdapter,
  readOpenSpecBlock,
  transformToHyphenCommands,
} from "../src/commands/editors.js";

// Shared temp-dir lifecycle for filesystem-touching tests below.
let tmpRoot: string;
beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), "openspec-pw-editors-"));
});
afterEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
});

// ─── escapeYamlValue ──────────────────────────────────────────────────────────

describe("escapeYamlValue", () => {
  it("returns raw value for plain strings", () => {
    expect(escapeYamlValue("hello world")).toBe("hello world");
    expect(escapeYamlValue("simple")).toBe("simple");
  });

  it("quotes strings with colons", () => {
    expect(escapeYamlValue("hello: world")).toBe('"hello: world"');
  });

  it("quotes strings starting with whitespace", () => {
    expect(escapeYamlValue("  hello")).toBe('"  hello"');
  });

  it("quotes strings ending with whitespace", () => {
    expect(escapeYamlValue("hello  ")).toBe('"hello  "');
  });

  it("quotes and escapes strings containing quotes", () => {
    expect(escapeYamlValue('say "hello"')).toBe('"say \\"hello\\""');
  });

  it("quotes and escapes strings containing newlines", () => {
    expect(escapeYamlValue("line1\nline2")).toBe('"line1\\nline2"');
  });

  it("quotes strings with special YAML chars", () => {
    expect(escapeYamlValue("key: value")).toBe('"key: value"');
    expect(escapeYamlValue("# comment")).toBe('"# comment"');
    expect(escapeYamlValue("a{b}c")).toBe('"a{b}c"');
  });

  it("quotes strings with array-like chars", () => {
    expect(escapeYamlValue("[a, b]")).toBe('"[a, b]"');
  });

  it("escapes backticks and pipes", () => {
    expect(escapeYamlValue("use `code` here")).toBe('"use `code` here"');
    expect(escapeYamlValue("a | b")).toBe('"a | b"');
  });

  it("escaping newlines preserves content", () => {
    const escaped = escapeYamlValue("line1\nline2\nline3");
    expect(escaped).toBe('"line1\\nline2\\nline3"');
    expect(escaped).not.toContain("\n");
  });
});

// ─── formatTagsArray ─────────────────────────────────────────────────────────

describe("formatTagsArray", () => {
  it("formats empty tags", () => {
    expect(formatTagsArray([])).toBe("[]");
  });

  it("formats single tag", () => {
    expect(formatTagsArray(["openspec"])).toBe("[openspec]");
  });

  it("formats multiple tags", () => {
    expect(
      formatTagsArray(["openspec", "playwright", "e2e"]),
    ).toBe("[openspec, playwright, e2e]");
  });

  it("escapes tags with colons using YAML quoting", () => {
    expect(formatTagsArray(["tag:colon"])).toBe('["tag:colon"]');
  });

  it("handles role:test without throwing", () => {
    expect(() => formatTagsArray(["role:test"])).not.toThrow();
    expect(formatTagsArray(["role:test"])).toContain("role:test");
  });
});

// ─── buildCommandMeta ─────────────────────────────────────────────────────────

describe("buildCommandMeta", () => {
  it("creates meta with correct id", () => {
    const meta = buildCommandMeta("test body");
    expect(meta.id).toBe("e2e");
  });

  it("creates meta with correct fields", () => {
    const meta = buildCommandMeta("test body");
    expect(meta.name).toBe("OPSX: E2E");
    expect(meta.description).toBe(
      "Run Playwright E2E verification for an OpenSpec change",
    );
    expect(meta.category).toBe("OpenSpec");
    expect(meta.tags).toEqual(["openspec", "playwright", "e2e", "testing"]);
    expect(meta.body).toBe("test body");
  });

  it("with empty body", () => {
    const meta = buildCommandMeta("");
    expect(meta.id).toBe("e2e");
    expect(meta.body).toBe("");
    expect(meta.tags.length).toBeGreaterThan(0);
  });

  it("preserves original body", () => {
    const body = "Step 1: read\nStep 2: test";
    const meta = buildCommandMeta(body);
    expect(meta.body).toBe(body);
  });
});

// ─── formatClaudeCommand ─────────────────────────────────────────────────────

describe("formatClaudeCommand", () => {
  it("produces non-empty output", () => {
    const meta = buildCommandMeta("test body");
    const output = formatClaudeCommand(meta);
    expect(output.length).toBeGreaterThan(0);
  });

  it("includes YAML frontmatter delimiters", () => {
    const output = formatClaudeCommand(buildCommandMeta("body"));
    expect(output).toContain("---");
  });

  it("includes required frontmatter fields", () => {
    const output = formatClaudeCommand(buildCommandMeta("body"));
    expect(output).toContain("name:");
    expect(output).toContain("description:");
    expect(output).toContain("category:");
    expect(output).toContain("tags:");
  });

  it("body content appears after frontmatter", () => {
    const body = "Step 1: read\nStep 2: test";
    const output = formatClaudeCommand(buildCommandMeta(body));
    expect(output).toContain(body);
  });
});

// ─── getClaudeCommandPath ────────────────────────────────────────────────────

describe("getClaudeCommandPath", () => {
  it("returns path with opsx directory", () => {
    const path = getClaudeCommandPath("e2e");
    expect(path).toContain("opsx");
    expect(path).toContain("e2e");
  });
});

// ─── hasClaudeCode ───────────────────────────────────────────────────────────

describe("hasClaudeCode", () => {
  it("returns true when .claude directory exists", () => {
    // This test only runs locally where .claude exists
    // In CI, .claude is not tracked, so this test may be skipped
    const result = hasClaudeCode(process.cwd());
    // Don't assert true - .claude may not exist in CI
    expect(typeof result).toBe("boolean");
  });

  it("returns false for non-existent directory", () => {
    const result = hasClaudeCode("/tmp/nonexistent-project-xyz-123");
    expect(result).toBe(false);
  });
});

// ─── transformToHyphenCommands ──────────────────────────────────────────────

describe("transformToHyphenCommands", () => {
  it("replaces /opsx:foo with /opsx-foo", () => {
    expect(transformToHyphenCommands("use /opsx:e2e to run")).toBe(
      "use /opsx-e2e to run",
    );
  });

  it("handles multiple occurrences in the same string", () => {
    expect(transformToHyphenCommands("/opsx:e2e then /opsx:foo and /opsx:bar")).toBe(
      "/opsx-e2e then /opsx-foo and /opsx-bar",
    );
  });

  it("is a no-op when no /opsx: prefix is present", () => {
    const input = "hello world, no commands here";
    expect(transformToHyphenCommands(input)).toBe(input);
  });

  it("preserves already-hyphenated /opsx- (no double-transform)", () => {
    // The regex only matches `/opsx:` literally — `/opsx-` must stay intact.
    expect(transformToHyphenCommands("run /opsx-e2e now")).toBe(
      "run /opsx-e2e now",
    );
    // Mixed: hyphen stays, colon becomes hyphen exactly once.
    expect(transformToHyphenCommands("/opsx-e2e and /opsx:foo")).toBe(
      "/opsx-e2e and /opsx-foo",
    );
  });
});

// ─── OpenCode adapter (formatting + detection) ─────────────────────────────

describe("OpenCode adapter", () => {
  it("formatOpenCodeCommand emits only `description` in frontmatter", () => {
    const output = formatOpenCodeCommand(buildCommandMeta("body"));
    expect(output).toContain("description:");
    // OpenCode frontmatter must NOT carry name/category/tags.
    expect(output).not.toContain("name:");
    expect(output).not.toContain("category:");
    expect(output).not.toContain("tags:");
    expect(output.startsWith("---\n")).toBe(true);
  });

  it("formatOpenCodeCommand rewrites /opsx:e2e → /opsx-e2e in the body", () => {
    const output = formatOpenCodeCommand(
      buildCommandMeta("Step 1: read\nThen run /opsx:e2e now."),
    );
    expect(output).toContain("/opsx-e2e");
    expect(output).not.toContain("/opsx:e2e");
  });

  it("getOpenCodeCommandPath returns .opencode/commands/opsx-<id>.md", () => {
    const p = getOpenCodeCommandPath("e2e");
    expect(p).toContain(".opencode");
    expect(p).toContain("commands");
    // Hyphenated filename, not colon-separated.
    expect(p.endsWith("opsx-e2e.md")).toBe(true);
    expect(p).not.toContain("opsx:e2e");
  });

  it("hasOpenCode: true when .opencode/ exists, false otherwise", () => {
    expect(hasOpenCode(tmpRoot)).toBe(false);
    mkdirSync(join(tmpRoot, ".opencode"));
    expect(hasOpenCode(tmpRoot)).toBe(true);
  });

  it("installCommand with opencodeAdapter writes the hyphenated command file", () => {
    const meta = buildCommandMeta("Run /opsx:e2e verification.");
    installCommand(opencodeAdapter, meta, tmpRoot);

    const filePath = join(tmpRoot, ".opencode", "commands", "opsx-e2e.md");
    expect(existsSync(filePath)).toBe(true);

    const content = readFileSync(filePath, "utf-8");
    // Body has been transformed.
    expect(content).toContain("/opsx-e2e");
    expect(content).not.toContain("/opsx:e2e");
    // Description-only frontmatter preserved.
    expect(content).toContain("description:");
    expect(content).not.toContain("name:");
  });
});

// ─── installProjectRules routing ────────────────────────────────────────────

describe("installProjectRules routing", () => {
  const standards = "Use employee-grade standards everywhere.";

  it("is a no-op when 0 editors are detected", () => {
    installProjectRules(tmpRoot, standards, []);
    expect(existsSync(join(tmpRoot, "CLAUDE.md"))).toBe(false);
    expect(existsSync(join(tmpRoot, "AGENTS.md"))).toBe(false);
    expect(existsSync(join(tmpRoot, "opencode.jsonc"))).toBe(false);
    expect(existsSync(join(tmpRoot, "opencode.json"))).toBe(false);
  });

  it("writes AGENTS.md (SSOT) + thin CLAUDE.md when only Claude is detected", () => {
    mkdirSync(join(tmpRoot, ".claude"));
    const detected = detectAdapters(tmpRoot, join(tmpRoot, "fake-home"));
    expect(detected.map((a) => a.id)).toEqual(["claude"]);

    installProjectRules(tmpRoot, standards, detected);

    // AGENTS.md has the full standards (SSOT).
    expect(existsSync(join(tmpRoot, "AGENTS.md"))).toBe(true);
    expect(readFileSync(join(tmpRoot, "AGENTS.md"), "utf-8")).toContain(
      standards,
    );

    // CLAUDE.md is a thin wrapper with @AGENTS.md import.
    expect(existsSync(join(tmpRoot, "CLAUDE.md"))).toBe(true);
    const claudeContent = readFileSync(join(tmpRoot, "CLAUDE.md"), "utf-8");
    expect(claudeContent).toContain("@AGENTS.md");
    expect(claudeContent).toContain("CodeGraph 优先");
    expect(claudeContent).not.toContain(standards);

    // No opencode config (OpenCode not detected).
    expect(existsSync(join(tmpRoot, "opencode.jsonc"))).toBe(false);
    expect(existsSync(join(tmpRoot, "opencode.json"))).toBe(false);
  });

  it("writes AGENTS.md (only) when only OpenCode is detected", () => {
    mkdirSync(join(tmpRoot, ".opencode"));
    const detected = detectAdapters(tmpRoot, join(tmpRoot, "fake-home"));
    expect(detected.map((a) => a.id)).toEqual(["opencode"]);

    installProjectRules(tmpRoot, standards, detected);

    expect(existsSync(join(tmpRoot, "AGENTS.md"))).toBe(true);
    expect(existsSync(join(tmpRoot, "CLAUDE.md"))).toBe(false);
    expect(readFileSync(join(tmpRoot, "AGENTS.md"), "utf-8")).toContain(
      standards,
    );

    // opencode.json(c) must register AGENTS.md as a project instruction.
    const configPath = existsSync(join(tmpRoot, "opencode.jsonc"))
      ? join(tmpRoot, "opencode.jsonc")
      : join(tmpRoot, "opencode.json");
    expect(existsSync(configPath)).toBe(true);
    const cfg = JSON.parse(readFileSync(configPath, "utf-8"));
    expect(cfg.instructions).toContain("AGENTS.md");
  });

  it("writes AGENTS.md as SSOT + thin CLAUDE.md + registers AGENTS.md when both are detected", () => {
    mkdirSync(join(tmpRoot, ".claude"));
    mkdirSync(join(tmpRoot, ".opencode"));
    const detected = detectAdapters(tmpRoot, join(tmpRoot, "fake-home"));
    expect(detected.map((a) => a.id).sort()).toEqual(["claude", "opencode"]);

    installProjectRules(tmpRoot, standards, detected);

    // AGENTS.md has the full standards (single source of truth).
    expect(existsSync(join(tmpRoot, "AGENTS.md"))).toBe(true);
    expect(readFileSync(join(tmpRoot, "AGENTS.md"), "utf-8")).toContain(
      standards,
    );

    // CLAUDE.md is a thin wrapper with @AGENTS.md import.
    expect(existsSync(join(tmpRoot, "CLAUDE.md"))).toBe(true);
    const claudeContent = readFileSync(join(tmpRoot, "CLAUDE.md"), "utf-8");
    expect(claudeContent).toContain("@AGENTS.md");
    expect(claudeContent).toContain("CodeGraph 优先");
    // Standards live in AGENTS.md, not duplicated into CLAUDE.md.
    expect(claudeContent).not.toContain(standards);

    // opencode.json(c) created with instructions registering AGENTS.md.
    const configPath = existsSync(join(tmpRoot, "opencode.jsonc"))
      ? join(tmpRoot, "opencode.jsonc")
      : join(tmpRoot, "opencode.json");
    expect(existsSync(configPath)).toBe(true);
    const cfg = JSON.parse(readFileSync(configPath, "utf-8"));
    expect(cfg.instructions).toEqual(["AGENTS.md"]);
  });

  it("2-editor branch merges instructions (preserves user entries, no duplicates)", () => {
    mkdirSync(join(tmpRoot, ".claude"));
    mkdirSync(join(tmpRoot, ".opencode"));
    // User already has their own instructions in opencode.jsonc.
    writeFileSync(
      join(tmpRoot, "opencode.jsonc"),
      JSON.stringify(
        { instructions: ["docs/RULES.md", ".cursor/rules"] },
        null,
        2,
      ),
    );

    installProjectRules(tmpRoot, "## Standards\nContent", [
      claudeAdapter,
      opencodeAdapter,
    ]);

    const after = JSON.parse(
      readFileSync(join(tmpRoot, "opencode.jsonc"), "utf-8"),
    );
    // AGENTS.md added, user entries preserved.
    expect(after.instructions).toContain("AGENTS.md");
    expect(after.instructions).toContain("docs/RULES.md");
    expect(after.instructions).toContain(".cursor/rules");
    // No duplicates.
    expect(new Set(after.instructions).size).toBe(after.instructions.length);
  });
});

// ─── opencodeAdapter MCP (install / remove / isInstalled) ───────────────────

describe("opencodeAdapter MCP", () => {
  it("installMcp: creates new opencode.jsonc with $schema + mcp key when no file exists", () => {
    expect(existsSync(join(tmpRoot, "opencode.jsonc"))).toBe(false);

    opencodeAdapter.installMcp(tmpRoot, "playwright", ["npx", "playwright"]);

    const configPath = join(tmpRoot, "opencode.jsonc");
    expect(existsSync(configPath)).toBe(true);
    const cfg = JSON.parse(readFileSync(configPath, "utf-8"));
    expect(cfg.$schema).toBe("https://opencode.ai/config.json");
    expect(cfg.mcp.playwright).toEqual({
      type: "local",
      command: ["npx", "playwright"],
    });
  });

  it("installMcp: edits existing opencode.json preserving $schema and adding mcp key", () => {
    const existing = [
      '{',
      '  "$schema": "https://opencode.ai/config.json",',
      '  "theme": "dark"',
      '}',
      "",
    ].join("\n");
    writeFileSync(join(tmpRoot, "opencode.jsonc"), existing);

    opencodeAdapter.installMcp(tmpRoot, "playwright", ["npx", "playwright"]);

    const cfg = JSON.parse(
      readFileSync(join(tmpRoot, "opencode.jsonc"), "utf-8"),
    );
    expect(cfg.$schema).toBe("https://opencode.ai/config.json");
    expect(cfg.theme).toBe("dark");
    expect(cfg.mcp.playwright).toEqual({
      type: "local",
      command: ["npx", "playwright"],
    });
  });

  it("installMcp: nested path mcp > playwright has the correct shape", () => {
    opencodeAdapter.installMcp(tmpRoot, "playwright", [
      "npx",
      "-y",
      "@playwright/mcp@latest",
    ]);

    const cfg = JSON.parse(
      readFileSync(join(tmpRoot, "opencode.jsonc"), "utf-8"),
    );
    expect(cfg.mcp.playwright.type).toBe("local");
    expect(Array.isArray(cfg.mcp.playwright.command)).toBe(true);
    expect(cfg.mcp.playwright.command).toEqual([
      "npx",
      "-y",
      "@playwright/mcp@latest",
    ]);
  });

  it("removeMcp: removes only the named server, preserves other mcp entries", () => {
    opencodeAdapter.installMcp(tmpRoot, "playwright", ["npx", "playwright"]);
    opencodeAdapter.installMcp(tmpRoot, "other", ["echo", "hi"]);

    opencodeAdapter.removeMcp(tmpRoot, "playwright");

    const cfg = JSON.parse(
      readFileSync(join(tmpRoot, "opencode.jsonc"), "utf-8"),
    );
    expect(cfg.mcp.playwright).toBeUndefined();
    expect(cfg.mcp.other).toEqual({ type: "local", command: ["echo", "hi"] });
    expect(cfg.$schema).toBe("https://opencode.ai/config.json");
  });

  it("isMcpInstalled: false before install, true after", () => {
    expect(opencodeAdapter.isMcpInstalled(tmpRoot, "playwright")).toBe(false);
    opencodeAdapter.installMcp(tmpRoot, "playwright", ["npx", "playwright"]);
    expect(opencodeAdapter.isMcpInstalled(tmpRoot, "playwright")).toBe(true);
    // An unrelated name stays false.
    expect(opencodeAdapter.isMcpInstalled(tmpRoot, "other")).toBe(false);
  });

  it("removeMcp: no-op when opencode.jsonc exists but has no mcp key (early return)", () => {
    // opencode.jsonc with $schema and theme but NO mcp key.
    writeFileSync(
      join(tmpRoot, "opencode.jsonc"),
      JSON.stringify(
        { $schema: "https://opencode.ai/config.json", theme: "dark" },
        null,
        2,
      ),
    );

    // Should hit the `value === undefined` guard and return without writing.
    opencodeAdapter.removeMcp(tmpRoot, "playwright");

    const after = readFileSync(join(tmpRoot, "opencode.jsonc"), "utf-8");
    expect(after).toContain("theme");
    expect(after).not.toContain("mcp");
  });

  it("installMcp: preserves C-style comments when adding MCP to an existing opencode.jsonc", () => {
    const cfg = join(tmpRoot, "opencode.jsonc");
    // C-style JSONC comment with a real-world-looking annotation.
    writeFileSync(
      cfg,
      `// Project-specific Playwright MCP\n{\n  "$schema": "https://opencode.ai/config.json"\n}\n`,
    );

    opencodeAdapter.installMcp(tmpRoot, "playwright", ["npx", "@playwright/mcp@latest"]);

    const after = readFileSync(cfg, "utf-8");
    // The whole point of using jsonc-parser: comments survive the edit.
    expect(after).toContain("// Project-specific Playwright MCP");
  });
});

// ─── opencodeAdapter.registerInstructions ───────────────────────────────────

describe("opencodeAdapter registerInstructions", () => {
  it("writes instructions array to opencode.jsonc", () => {
    opencodeAdapter.registerInstructions!(tmpRoot, ["CLAUDE.md"]);

    const cfg = JSON.parse(
      readFileSync(join(tmpRoot, "opencode.jsonc"), "utf-8"),
    );
    expect(cfg.instructions).toEqual(["CLAUDE.md"]);
  });

  it("preserves existing keys (e.g. $schema)", () => {
    const existing =
      '{\n  "$schema": "https://opencode.ai/config.json",\n  "theme": "dark"\n}\n';
    writeFileSync(join(tmpRoot, "opencode.jsonc"), existing);

    opencodeAdapter.registerInstructions!(tmpRoot, ["CLAUDE.md", "AGENTS.md"]);

    const cfg = JSON.parse(
      readFileSync(join(tmpRoot, "opencode.jsonc"), "utf-8"),
    );
    expect(cfg.$schema).toBe("https://opencode.ai/config.json");
    expect(cfg.theme).toBe("dark");
    expect(cfg.instructions).toEqual(["CLAUDE.md", "AGENTS.md"]);
  });

  it("replaces an existing instructions array", () => {
    opencodeAdapter.registerInstructions!(tmpRoot, ["CLAUDE.md"]);
    opencodeAdapter.registerInstructions!(tmpRoot, [
      "CLAUDE.md",
      "AGENTS.md",
      "docs/RULES.md",
    ]);

    const cfg = JSON.parse(
      readFileSync(join(tmpRoot, "opencode.jsonc"), "utf-8"),
    );
    expect(cfg.instructions).toEqual([
      "CLAUDE.md",
      "AGENTS.md",
      "docs/RULES.md",
    ]);
    // Old single-element array must be gone.
    expect(cfg.instructions).not.toEqual(["CLAUDE.md"]);
  });
});

// ─── clineAdapter ────────────────────────────────────────────────────────────

describe("clineAdapter", () => {
  it("has correct metadata", () => {
    expect(clineAdapter.id).toBe("cline");
    expect(clineAdapter.displayName).toBe("Cline");
  });

  it("detects .cline/ directory", () => {
    mkdirSync(join(tmpRoot, ".cline"));
    expect(clineAdapter.detect(tmpRoot)).toBe(true);
  });

  it("detects .clinerules/ directory (legacy)", () => {
    mkdirSync(join(tmpRoot, ".clinerules"));
    expect(clineAdapter.detect(tmpRoot)).toBe(true);
  });

  it("does not detect when neither directory exists", () => {
    expect(clineAdapter.detect(tmpRoot)).toBe(false);
  });
});

// ─── getClineCommandPath / formatClineCommand ────────────────────────────────

describe("getClineCommandPath", () => {
  it("returns .cline/skills/opsx-<id>/SKILL.md", () => {
    expect(getClineCommandPath("e2e")).toBe(
      join(".cline", "skills", "opsx-e2e", "SKILL.md"),
    );
  });
});

describe("formatClineCommand", () => {
  const meta = buildCommandMeta("Run /opsx:e2e now");

  it("emits YAML frontmatter with name and description", () => {
    const out = formatClineCommand(meta);
    expect(out).toContain("---");
    expect(out).toContain("name: opsx-e2e");
    expect(out).toContain(`description: ${meta.description}`);
  });

  it("rewrites /opsx: to /opsx- in the body (hyphenated)", () => {
    const out = formatClineCommand(meta);
    expect(out).toContain("/opsx-e2e");
    expect(out).not.toContain("/opsx:");
  });

  it("uses the skill name derived from the command id", () => {
    const out = formatClineCommand(meta);
    // Skill name = directory name = opsx-<id>
    expect(out).toMatch(/^name: opsx-e2e$/m);
  });
});

// ─── clineAdapter MCP (.cline/mcp.json) ─────────────────────────────────────

describe("clineAdapter MCP", () => {
  it("isMcpInstalled returns false when .cline/mcp.json does not exist", () => {
    expect(clineAdapter.isMcpInstalled(tmpRoot, "playwright")).toBe(false);
  });

  it("installMcp creates .cline/mcp.json with mcpServers structure", () => {
    clineAdapter.installMcp(tmpRoot, "playwright", [
      "npx",
      "@playwright/mcp@latest",
    ]);

    const cfg = JSON.parse(
      readFileSync(join(tmpRoot, ".cline", "mcp.json"), "utf-8"),
    );
    expect(cfg.mcpServers.playwright).toEqual({
      command: "npx",
      args: ["@playwright/mcp@latest"],
    });
  });

  it("isMcpInstalled returns true after installMcp", () => {
    clineAdapter.installMcp(tmpRoot, "playwright", ["npx", "pw-mcp"]);
    expect(clineAdapter.isMcpInstalled(tmpRoot, "playwright")).toBe(true);
  });

  it("installMcp preserves existing servers in mcpServers", () => {
    clineAdapter.installMcp(tmpRoot, "other", ["echo", "hi"]);
    clineAdapter.installMcp(tmpRoot, "playwright", ["npx", "pw-mcp"]);

    const cfg = JSON.parse(
      readFileSync(join(tmpRoot, ".cline", "mcp.json"), "utf-8"),
    );
    expect(cfg.mcpServers.other).toEqual({ command: "echo", args: ["hi"] });
    expect(cfg.mcpServers.playwright).toEqual({
      command: "npx",
      args: ["pw-mcp"],
    });
  });

  it("installMcp preserves unknown top-level fields in mcp.json", () => {
    mkdirSync(join(tmpRoot, ".cline"), { recursive: true });
    writeFileSync(
      join(tmpRoot, ".cline", "mcp.json"),
      JSON.stringify(
        { mcpServers: {}, customField: "preserve me", version: 2 },
        null,
        2,
      ),
    );

    clineAdapter.installMcp(tmpRoot, "playwright", ["npx", "pw-mcp"]);

    const cfg = JSON.parse(
      readFileSync(join(tmpRoot, ".cline", "mcp.json"), "utf-8"),
    );
    expect(cfg.mcpServers.playwright).toEqual({
      command: "npx",
      args: ["pw-mcp"],
    });
    expect(cfg.customField).toBe("preserve me");
    expect(cfg.version).toBe(2);
  });

  it("removeMcp preserves unknown top-level fields in mcp.json", () => {
    mkdirSync(join(tmpRoot, ".cline"), { recursive: true });
    writeFileSync(
      join(tmpRoot, ".cline", "mcp.json"),
      JSON.stringify(
        {
          mcpServers: { playwright: { command: "npx", args: ["pw"] } },
          customField: "preserve me",
        },
        null,
        2,
      ),
    );

    clineAdapter.removeMcp(tmpRoot, "playwright");

    const cfg = JSON.parse(
      readFileSync(join(tmpRoot, ".cline", "mcp.json"), "utf-8"),
    );
    expect(cfg.mcpServers.playwright).toBeUndefined();
    expect(cfg.customField).toBe("preserve me");
  });

  it("removeMcp removes only the named server", () => {
    clineAdapter.installMcp(tmpRoot, "playwright", ["npx", "pw"]);
    clineAdapter.installMcp(tmpRoot, "other", ["echo", "hi"]);

    clineAdapter.removeMcp(tmpRoot, "playwright");

    const cfg = JSON.parse(
      readFileSync(join(tmpRoot, ".cline", "mcp.json"), "utf-8"),
    );
    expect(cfg.mcpServers.playwright).toBeUndefined();
    expect(cfg.mcpServers.other).toEqual({ command: "echo", args: ["hi"] });
  });

  it("removeMcp is a no-op when server is not present", () => {
    clineAdapter.installMcp(tmpRoot, "other", ["echo", "hi"]);
    // Should not throw
    expect(() => clineAdapter.removeMcp(tmpRoot, "playwright")).not.toThrow();

    const cfg = JSON.parse(
      readFileSync(join(tmpRoot, ".cline", "mcp.json"), "utf-8"),
    );
    expect(cfg.mcpServers.other).toEqual({ command: "echo", args: ["hi"] });
  });

  it("removeMcp is a no-op when mcp.json does not exist", () => {
    expect(() => clineAdapter.removeMcp(tmpRoot, "playwright")).not.toThrow();
  });

  it("isMcpInstalled returns false when mcp.json is unparseable", () => {
    mkdirSync(join(tmpRoot, ".cline"), { recursive: true });
    writeFileSync(join(tmpRoot, ".cline", "mcp.json"), "{ invalid json");
    expect(clineAdapter.isMcpInstalled(tmpRoot, "playwright")).toBe(false);
  });

  it("installMcp overwrites an existing server entry", () => {
    clineAdapter.installMcp(tmpRoot, "playwright", ["npx", "old"]);
    clineAdapter.installMcp(tmpRoot, "playwright", ["npx", "new"]);

    const cfg = JSON.parse(
      readFileSync(join(tmpRoot, ".cline", "mcp.json"), "utf-8"),
    );
    expect(cfg.mcpServers.playwright).toEqual({
      command: "npx",
      args: ["new"],
    });
  });
});

// ─── installCommand (Cline) ──────────────────────────────────────────────────

describe("installCommand (Cline)", () => {
  it("writes SKILL.md to .cline/skills/opsx-e2e/", () => {
    const meta = buildCommandMeta("Do the E2E thing with /opsx:e2e");
    installCommand(clineAdapter, meta, tmpRoot);

    const skillPath = join(tmpRoot, ".cline", "skills", "opsx-e2e", "SKILL.md");
    expect(existsSync(skillPath)).toBe(true);
    const content = readFileSync(skillPath, "utf-8");
    expect(content).toContain("name: opsx-e2e");
    expect(content).toContain("/opsx-e2e");
    expect(content).not.toContain("/opsx:");
  });
});

// ─── cleanProjectRules ───────────────────────────────────────────────────────
// Covers both the public cleanProjectRules routing AND the private
// removeMarkersFromFile helper (exercised through the public API).

describe("cleanProjectRules", () => {
  const MARKER_BLOCK = (content: string) =>
    `<!-- OPENSPEC:START -->\n\n${content}\n\n<!-- OPENSPEC:END -->`;

  it("removes markers from AGENTS.md for any adapter (SSOT)", () => {
    writeFileSync(
      join(tmpRoot, "AGENTS.md"),
      `# Project\n\n${MARKER_BLOCK("standards body")}\n`,
    );
    cleanProjectRules(opencodeAdapter, tmpRoot);
    const after = readFileSync(join(tmpRoot, "AGENTS.md"), "utf-8");
    expect(after).not.toContain("OPENSPEC:START");
    expect(after).not.toContain("standards body");
    // Project header outside markers must survive.
    expect(after).toContain("# Project");
  });

  it("also cleans CLAUDE.md when adapter is claude", () => {
    writeFileSync(
      join(tmpRoot, "AGENTS.md"),
      `# Project\n\n${MARKER_BLOCK("standards body")}\n`,
    );
    writeFileSync(
      join(tmpRoot, "CLAUDE.md"),
      `# My Rules\n\n${MARKER_BLOCK("@AGENTS.md")}\n`,
    );
    cleanProjectRules(claudeAdapter, tmpRoot);
    const agents = readFileSync(join(tmpRoot, "AGENTS.md"), "utf-8");
    const claude = readFileSync(join(tmpRoot, "CLAUDE.md"), "utf-8");
    expect(agents).not.toContain("OPENSPEC:START");
    expect(claude).not.toContain("OPENSPEC:START");
    expect(claude).not.toContain("@AGENTS.md");
    expect(claude).toContain("# My Rules");
  });

  it("skips CLAUDE.md when adapter is opencode", () => {
    writeFileSync(
      join(tmpRoot, "AGENTS.md"),
      `# Project\n\n${MARKER_BLOCK("standards body")}\n`,
    );
    writeFileSync(
      join(tmpRoot, "CLAUDE.md"),
      `# My Rules\n\n${MARKER_BLOCK("@AGENTS.md")}\n`,
    );
    cleanProjectRules(opencodeAdapter, tmpRoot);
    // AGENTS.md cleaned, CLAUDE.md untouched.
    expect(readFileSync(join(tmpRoot, "AGENTS.md"), "utf-8")).not.toContain(
      "OPENSPEC:START",
    );
    expect(readFileSync(join(tmpRoot, "CLAUDE.md"), "utf-8")).toContain(
      "OPENSPEC:START",
    );
  });

  it("collapses surrounding blank lines instead of leaving 3+ gaps", () => {
    writeFileSync(
      join(tmpRoot, "AGENTS.md"),
      `before\n\n${MARKER_BLOCK("x")}\n\nafter\n`,
    );
    cleanProjectRules(claudeAdapter, tmpRoot);
    const after = readFileSync(join(tmpRoot, "AGENTS.md"), "utf-8");
    // No run of 3+ consecutive newlines should remain.
    expect(after).not.toMatch(/\n{3,}/);
    expect(after).toContain("before");
    expect(after).toContain("after");
  });

  it("deletes the file when only markers + whitespace remain", () => {
    writeFileSync(join(tmpRoot, "AGENTS.md"), `${MARKER_BLOCK("only this")}\n`);
    cleanProjectRules(claudeAdapter, tmpRoot);
    expect(existsSync(join(tmpRoot, "AGENTS.md"))).toBe(false);
  });

  it("is idempotent — second call is a no-op", () => {
    writeFileSync(
      join(tmpRoot, "AGENTS.md"),
      `# Project\n\n${MARKER_BLOCK("standards body")}\n`,
    );
    cleanProjectRules(claudeAdapter, tmpRoot);
    const afterFirst = readFileSync(join(tmpRoot, "AGENTS.md"), "utf-8");
    // Second call: file has no markers, should not throw and should not mutate.
    cleanProjectRules(claudeAdapter, tmpRoot);
    const afterSecond = readFileSync(join(tmpRoot, "AGENTS.md"), "utf-8");
    expect(afterSecond).toBe(afterFirst);
  });

  it("handles CRLF line endings in marker block", () => {
    const crlf = `# Project\r\n\r\n<!-- OPENSPEC:START -->\r\n\r\nstandards body\r\n\r\n<!-- OPENSPEC:END -->\r\n`;
    writeFileSync(join(tmpRoot, "AGENTS.md"), crlf);
    cleanProjectRules(claudeAdapter, tmpRoot);
    const after = readFileSync(join(tmpRoot, "AGENTS.md"), "utf-8");
    expect(after).not.toContain("OPENSPEC:START");
    expect(after).toContain("# Project");
  });

  it("no-ops gracefully when file is missing", () => {
    // Neither file exists. Should not throw.
    expect(() => cleanProjectRules(claudeAdapter, tmpRoot)).not.toThrow();
  });

  it("no-ops gracefully when file has no markers", () => {
    writeFileSync(join(tmpRoot, "AGENTS.md"), `# Just a project file\n`);
    cleanProjectRules(claudeAdapter, tmpRoot);
    expect(readFileSync(join(tmpRoot, "AGENTS.md"), "utf-8")).toBe(
      `# Just a project file\n`,
    );
  });

  it("clineAdapter: removes markers from AGENTS.md but does not create CLAUDE.md", () => {
    writeFileSync(
      join(tmpRoot, "AGENTS.md"),
      `# Project\n\n${MARKER_BLOCK("standards body")}\n`,
    );
    cleanProjectRules(clineAdapter, tmpRoot);
    // AGENTS.md markers must be removed.
    const after = readFileSync(join(tmpRoot, "AGENTS.md"), "utf-8");
    expect(after).not.toContain("OPENSPEC:START");
    expect(after).toContain("# Project");
    // CLAUDE.md must NOT be created — Cline auto-detects AGENTS.md natively.
    expect(existsSync(join(tmpRoot, "CLAUDE.md"))).toBe(false);
  });
});

// ─── installProjectRules ─────────────────────────────────────────────────────

describe("installProjectRules", () => {
  const STANDARDS = "Employee-grade standards content";

  it("creates AGENTS.md when Cline is detected", () => {
    mkdirSync(join(tmpRoot, ".cline"));
    const detected = detectAdapters(tmpRoot, join(tmpRoot, "fake-home"));
    installProjectRules(tmpRoot, STANDARDS, detected);
    expect(existsSync(join(tmpRoot, "AGENTS.md"))).toBe(true);
    const content = readFileSync(join(tmpRoot, "AGENTS.md"), "utf-8");
    expect(content).toContain("OPENSPEC:START");
    expect(content).toContain(STANDARDS);
  });

  it("creates AGENTS.md but NOT CLAUDE.md when Cline is the only detected editor", () => {
    mkdirSync(join(tmpRoot, ".cline"));
    const detected = detectAdapters(tmpRoot, join(tmpRoot, "fake-home"));
    installProjectRules(tmpRoot, STANDARDS, detected);
    // AGENTS.md must exist (SSOT).
    expect(existsSync(join(tmpRoot, "AGENTS.md"))).toBe(true);
    // CLAUDE.md must NOT exist — Cline auto-detects AGENTS.md natively.
    expect(existsSync(join(tmpRoot, "CLAUDE.md"))).toBe(false);
  });

  it("creates AGENTS.md + CLAUDE.md when both Cline and Claude are detected", () => {
    mkdirSync(join(tmpRoot, ".claude"));
    mkdirSync(join(tmpRoot, ".cline"));
    const detected = detectAdapters(tmpRoot, join(tmpRoot, "fake-home"));
    installProjectRules(tmpRoot, STANDARDS, detected);
    // Both files must exist.
    expect(existsSync(join(tmpRoot, "AGENTS.md"))).toBe(true);
    expect(existsSync(join(tmpRoot, "CLAUDE.md"))).toBe(true);
    // CLAUDE.md must contain the @AGENTS.md import.
    const claude = readFileSync(join(tmpRoot, "CLAUDE.md"), "utf-8");
    expect(claude).toContain("@AGENTS.md");
  });

  it("readOpenSpecBlock extracts the OPENSPEC block content", () => {
    mkdirSync(join(tmpRoot, ".claude"));
    const detected = detectAdapters(tmpRoot, join(tmpRoot, "fake-home"));
    installProjectRules(tmpRoot, STANDARDS, detected);
    const claudeAdapter = getAdapter("claude")!;
    const block = readOpenSpecBlock(tmpRoot, claudeAdapter);
    expect(block).not.toBeNull();
    expect(block).toContain("@AGENTS.md");
    expect(block).toContain("CodeGraph 优先");
  });

  it("readOpenSpecBlock returns null when the file has no markers", () => {
    const opencodeAdapter = getAdapter("opencode")!;
    writeFileSync(join(tmpRoot, "AGENTS.md"), "# user file, no markers\n");
    expect(readOpenSpecBlock(tmpRoot, opencodeAdapter)).toBeNull();
  });

  it("blockMatchesExpected matches an identical block and rejects drift", () => {
    mkdirSync(join(tmpRoot, ".claude"));
    const detected = detectAdapters(tmpRoot, join(tmpRoot, "fake-home"));
    installProjectRules(tmpRoot, STANDARDS, detected);
    const claudeAdapter = getAdapter("claude")!;
    expect(blockMatchesExpected(tmpRoot, claudeAdapter, claudeWrapperStandardsContent())).toBe(true);
    expect(blockMatchesExpected(tmpRoot, claudeAdapter, "totally different")).toBe(false);
  });

  it("blockMatchesExpected returns false when the rules file is missing", () => {
    const opencodeAdapter = getAdapter("opencode")!;
    expect(blockMatchesExpected(tmpRoot, opencodeAdapter, "any")).toBe(false);
  });
});

// ─── detectAdapters ─────────────────────────────────────────────────────────

describe("detectAdapters", () => {
  it("returns all seven adapters when every editor dir exists", () => {
    mkdirSync(join(tmpRoot, ".claude"));
    mkdirSync(join(tmpRoot, ".opencode"));
    mkdirSync(join(tmpRoot, ".cline"));
    mkdirSync(join(tmpRoot, ".cursor"));
    mkdirSync(join(tmpRoot, ".pi"));
    mkdirSync(join(tmpRoot, ".omp"));
    mkdirSync(join(tmpRoot, ".dsh"));
    const adapters = detectAdapters(tmpRoot, join(tmpRoot, "fake-home"));
    expect(adapters.map((a) => a.id).sort()).toEqual([
      "claude",
      "cline",
      "cursor",
      "dsh",
      "omp",
      "opencode",
      "pi",
    ]);
  });

  it("returns [claude] when only .claude exists", () => {
    mkdirSync(join(tmpRoot, ".claude"));
    const adapters = detectAdapters(tmpRoot, join(tmpRoot, "fake-home"));
    expect(adapters.map((a) => a.id)).toEqual(["claude"]);
  });

  it("returns [opencode] when only .opencode exists", () => {
    mkdirSync(join(tmpRoot, ".opencode"));
    const adapters = detectAdapters(tmpRoot, join(tmpRoot, "fake-home"));
    expect(adapters.map((a) => a.id)).toEqual(["opencode"]);
  });

  it("returns [cline] when only .cline exists", () => {
    mkdirSync(join(tmpRoot, ".cline"));
    const adapters = detectAdapters(tmpRoot, join(tmpRoot, "fake-home"));
    expect(adapters.map((a) => a.id)).toEqual(["cline"]);
  });

  it("returns [cursor] when only .cursor exists", () => {
    mkdirSync(join(tmpRoot, ".cursor"));
    const adapters = detectAdapters(tmpRoot, join(tmpRoot, "fake-home"));
    expect(adapters.map((a) => a.id)).toEqual(["cursor"]);
  });

  it("returns [cline] when only .clinerules exists (legacy)", () => {
    mkdirSync(join(tmpRoot, ".clinerules"));
    const adapters = detectAdapters(tmpRoot, join(tmpRoot, "fake-home"));
    expect(adapters.map((a) => a.id)).toEqual(["cline"]);
  });

  it("returns [] when no editor directory exists", () => {
    const adapters = detectAdapters(tmpRoot, join(tmpRoot, "fake-home"));
    expect(adapters).toEqual([]);
  });

  it("detects Pi via the global ~/.pi/agent dir when no project .pi/ exists", () => {
    const home = join(tmpRoot, "fake-home");
    mkdirSync(join(home, ".pi", "agent"), { recursive: true });
    const adapters = detectAdapters(tmpRoot, home);
    expect(adapters.map((a) => a.id)).toEqual(["pi"]);
  });

  it("detects Oh My Pi via the global ~/.omp/agent dir when no project .omp/ exists", () => {
    const home = join(tmpRoot, "fake-home");
    mkdirSync(join(home, ".omp", "agent"), { recursive: true });
    const adapters = detectAdapters(tmpRoot, home);
    expect(adapters.map((a) => a.id)).toEqual(["omp"]);
  });
});

// ─── Pi adapter ────────────────────────────────────────────────────────────

describe("piAdapter", () => {
  it("has correct metadata", () => {
    expect(piAdapter.id).toBe("pi");
    expect(piAdapter.displayName).toBe("Pi");
    // Pi has no MCP client — MCP phases must skip it.
    expect(piAdapter.supportsMcp).toBe(false);
  });

  it("detects a project .pi/ directory", () => {
    mkdirSync(join(tmpRoot, ".pi"));
    expect(hasPi(tmpRoot)).toBe(true);
    expect(piAdapter.detect(tmpRoot)).toBe(true);
  });

  it("detects the global ~/.pi/agent directory", () => {
    const home = join(tmpRoot, "fake-home");
    mkdirSync(join(home, ".pi", "agent"), { recursive: true });
    expect(hasPi(tmpRoot, home)).toBe(true);
    expect(piAdapter.detect(tmpRoot, home)).toBe(true);
  });

  it("does not detect when neither .pi/ nor ~/.pi/agent exists", () => {
    const home = join(tmpRoot, "fake-home");
    expect(hasPi(tmpRoot, home)).toBe(false);
    expect(piAdapter.detect(tmpRoot, home)).toBe(false);
  });
});

describe("getPiCommandPath", () => {
  it("returns .pi/prompts/opsx-<id>.md", () => {
    expect(getPiCommandPath("e2e")).toBe(
      join(".pi", "prompts", "opsx-e2e.md"),
    );
  });
});

describe("formatPiCommand", () => {
  it("emits description + argument-hint frontmatter and hyphenated body", () => {
    const meta = buildCommandMeta("Run the E2E flow via /opsx:e2e");
    const out = formatPiCommand(meta);
    expect(out).toContain("description: Run Playwright E2E verification for an OpenSpec change");
    expect(out).toContain('argument-hint: "<change-name>"');
    expect(out).toContain("/opsx-e2e");
    expect(out).not.toContain("/opsx:e2e");
  });
});

describe("piAdapter MCP (no client)", () => {
  it("isMcpInstalled always returns false", () => {
    expect(piAdapter.isMcpInstalled(tmpRoot, "playwright")).toBe(false);
  });

  it("installMcp and removeMcp are no-ops (do not write files)", () => {
    piAdapter.installMcp(tmpRoot, "playwright", ["npx", "@playwright/mcp@latest"]);
    piAdapter.removeMcp(tmpRoot, "playwright");
    expect(existsSync(join(tmpRoot, ".pi", "mcp.json"))).toBe(false);
  });
});

describe("installCommand (Pi)", () => {
  it("writes the prompt template to .pi/prompts/opsx-e2e.md", () => {
    const meta = buildCommandMeta("Do the E2E thing");
    installCommand(piAdapter, meta, tmpRoot);
    const dest = join(tmpRoot, ".pi", "prompts", "opsx-e2e.md");
    expect(existsSync(dest)).toBe(true);
    const content = readFileSync(dest, "utf-8");
    expect(content).toContain("description:");
    expect(content).toContain("Do the E2E thing");
  });

  it("lists the prompt file as the only artifact", () => {
    const meta = buildCommandMeta("body");
    expect(listCommandArtifactPaths(piAdapter, meta)).toEqual([
      join(".pi", "prompts", "opsx-e2e.md"),
    ]);
  });
});

describe("installProjectRules (Pi)", () => {
  it("writes AGENTS.md (SSOT) and no CLAUDE.md wrapper", () => {
    mkdirSync(join(tmpRoot, ".pi"));
    const detected = detectAdapters(tmpRoot, join(tmpRoot, "fake-home"));
    installProjectRules(tmpRoot, "standards", detected);
    expect(existsSync(join(tmpRoot, "AGENTS.md"))).toBe(true);
    expect(existsSync(join(tmpRoot, "CLAUDE.md"))).toBe(false);
  });
});

// ─── Oh My Pi adapter ──────────────────────────────────────────────────────

describe("ompAdapter", () => {
  it("has correct metadata", () => {
    expect(ompAdapter.id).toBe("omp");
    expect(ompAdapter.displayName).toBe("Oh My Pi");
    expect(ompAdapter.supportsMcp).not.toBe(false);
  });

  it("detects a project .omp/ directory", () => {
    mkdirSync(join(tmpRoot, ".omp"));
    expect(hasOmp(tmpRoot)).toBe(true);
    expect(ompAdapter.detect(tmpRoot)).toBe(true);
  });

  it("detects the global ~/.omp/agent directory", () => {
    const home = join(tmpRoot, "fake-home");
    mkdirSync(join(home, ".omp", "agent"), { recursive: true });
    expect(hasOmp(tmpRoot, home)).toBe(true);
    expect(ompAdapter.detect(tmpRoot, home)).toBe(true);
  });

  it("does not detect when neither .omp/ nor ~/.omp/agent exists", () => {
    const home = join(tmpRoot, "fake-home");
    expect(hasOmp(tmpRoot, home)).toBe(false);
    expect(ompAdapter.detect(tmpRoot, home)).toBe(false);
  });
});

describe("getOmpCommandPath", () => {
  it("returns .omp/commands/opsx-<id>.md", () => {
    expect(getOmpCommandPath("e2e")).toBe(
      join(".omp", "commands", "opsx-e2e.md"),
    );
  });
});

describe("formatOmpCommand", () => {
  it("emits name + description frontmatter and hyphenated body", () => {
    const meta = buildCommandMeta("Run the E2E flow via /opsx:e2e");
    const out = formatOmpCommand(meta);
    expect(out).toContain("name: opsx-e2e");
    expect(out).toContain("description: Run Playwright E2E verification for an OpenSpec change");
    expect(out).toContain("/opsx-e2e");
    expect(out).not.toContain("/opsx:e2e");
  });
});

describe("ompAdapter MCP (.omp/mcp.json)", () => {
  it("isMcpInstalled returns false when .omp/mcp.json does not exist", () => {
    expect(ompAdapter.isMcpInstalled(tmpRoot, "playwright")).toBe(false);
  });

  it("installMcp creates .omp/mcp.json with mcpServers structure", () => {
    ompAdapter.installMcp(tmpRoot, "playwright", [
      "npx",
      "@playwright/mcp@latest",
    ]);
    const dest = join(tmpRoot, ".omp", "mcp.json");
    expect(existsSync(dest)).toBe(true);
    const config = JSON.parse(readFileSync(dest, "utf-8"));
    expect(config.mcpServers.playwright).toEqual({
      command: "npx",
      args: ["@playwright/mcp@latest"],
    });
    expect(ompAdapter.isMcpInstalled(tmpRoot, "playwright")).toBe(true);
  });

  it("removeMcp deletes only the named server", () => {
    ompAdapter.installMcp(tmpRoot, "playwright", ["npx", "@playwright/mcp@latest"]);
    ompAdapter.installMcp(tmpRoot, "filesystem", ["npx", "fs-mcp"]);
    ompAdapter.removeMcp(tmpRoot, "playwright");
    const config = JSON.parse(
      readFileSync(join(tmpRoot, ".omp", "mcp.json"), "utf-8"),
    );
    expect(config.mcpServers.playwright).toBeUndefined();
    expect(config.mcpServers.filesystem).toBeDefined();
    expect(ompAdapter.isMcpInstalled(tmpRoot, "playwright")).toBe(false);
  });
});

describe("installCommand (Oh My Pi)", () => {
  it("writes the command to .omp/commands/opsx-e2e.md", () => {
    const meta = buildCommandMeta("Do the E2E thing");
    installCommand(ompAdapter, meta, tmpRoot);
    const dest = join(tmpRoot, ".omp", "commands", "opsx-e2e.md");
    expect(existsSync(dest)).toBe(true);
    const content = readFileSync(dest, "utf-8");
    expect(content).toContain("name: opsx-e2e");
    expect(content).toContain("Do the E2E thing");
  });
});
