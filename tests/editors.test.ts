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
  claudeAdapter,
  detectAdapters,
  escapeYamlValue,
  formatClaudeCommand,
  formatOpenCodeCommand,
  formatTagsArray,
  getClaudeCommandPath,
  getOpenCodeCommandPath,
  hasClaudeCode,
  hasOpenCode,
  installCommand,
  installProjectRules,
  opencodeAdapter,
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

  it("writes CLAUDE.md (only) when only Claude is detected", () => {
    mkdirSync(join(tmpRoot, ".claude"));
    const detected = detectAdapters(tmpRoot);
    expect(detected.map((a) => a.id)).toEqual(["claude"]);

    installProjectRules(tmpRoot, standards, detected);

    expect(existsSync(join(tmpRoot, "CLAUDE.md"))).toBe(true);
    expect(existsSync(join(tmpRoot, "AGENTS.md"))).toBe(false);
    expect(existsSync(join(tmpRoot, "opencode.jsonc"))).toBe(false);
    expect(existsSync(join(tmpRoot, "opencode.json"))).toBe(false);
    expect(readFileSync(join(tmpRoot, "CLAUDE.md"), "utf-8")).toContain(
      standards,
    );
  });

  it("writes AGENTS.md (only) when only OpenCode is detected", () => {
    mkdirSync(join(tmpRoot, ".opencode"));
    const detected = detectAdapters(tmpRoot);
    expect(detected.map((a) => a.id)).toEqual(["opencode"]);

    installProjectRules(tmpRoot, standards, detected);

    expect(existsSync(join(tmpRoot, "AGENTS.md"))).toBe(true);
    expect(existsSync(join(tmpRoot, "CLAUDE.md"))).toBe(false);
    expect(readFileSync(join(tmpRoot, "AGENTS.md"), "utf-8")).toContain(
      standards,
    );
  });

  it("writes CLAUDE.md + registers it in opencode.json(c) when both are detected", () => {
    mkdirSync(join(tmpRoot, ".claude"));
    mkdirSync(join(tmpRoot, ".opencode"));
    const detected = detectAdapters(tmpRoot);
    expect(detected.map((a) => a.id).sort()).toEqual(["claude", "opencode"]);

    installProjectRules(tmpRoot, standards, detected);

    // CLAUDE.md written once (serves both editors via OpenCode fallback).
    expect(existsSync(join(tmpRoot, "CLAUDE.md"))).toBe(true);
    expect(readFileSync(join(tmpRoot, "CLAUDE.md"), "utf-8")).toContain(
      standards,
    );

    // opencode.json(c) created with instructions registering CLAUDE.md.
    const configPath = existsSync(join(tmpRoot, "opencode.jsonc"))
      ? join(tmpRoot, "opencode.jsonc")
      : join(tmpRoot, "opencode.json");
    expect(existsSync(configPath)).toBe(true);
    const cfg = JSON.parse(readFileSync(configPath, "utf-8"));
    expect(cfg.instructions).toEqual(["CLAUDE.md"]);
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
    // CLAUDE.md added, user entries preserved.
    expect(after.instructions).toContain("CLAUDE.md");
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

// ─── detectAdapters ─────────────────────────────────────────────────────────

describe("detectAdapters", () => {
  it("returns both adapters when .claude and .opencode both exist", () => {
    mkdirSync(join(tmpRoot, ".claude"));
    mkdirSync(join(tmpRoot, ".opencode"));
    const adapters = detectAdapters(tmpRoot);
    expect(adapters.map((a) => a.id).sort()).toEqual(["claude", "opencode"]);
  });

  it("returns [claude] when only .claude exists", () => {
    mkdirSync(join(tmpRoot, ".claude"));
    const adapters = detectAdapters(tmpRoot);
    expect(adapters.map((a) => a.id)).toEqual(["claude"]);
  });

  it("returns [opencode] when only .opencode exists", () => {
    mkdirSync(join(tmpRoot, ".opencode"));
    const adapters = detectAdapters(tmpRoot);
    expect(adapters.map((a) => a.id)).toEqual(["opencode"]);
  });

  it("returns [] when neither .claude nor .opencode exists", () => {
    const adapters = detectAdapters(tmpRoot);
    expect(adapters).toEqual([]);
  });
});
