import { describe, it, expect } from "vitest";
import {
  escapeYamlValue,
  formatTagsArray,
  buildCommandMeta,
  formatClaudeCommand,
  getClaudeCommandPath,
  hasClaudeCode,
} from "../src/commands/editors.js";

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
    const result = hasClaudeCode(process.cwd());
    expect(result).toBe(true);
  });

  it("returns false for non-existent directory", () => {
    const result = hasClaudeCode("/tmp/nonexistent-project-xyz-123");
    expect(result).toBe(false);
  });
});
