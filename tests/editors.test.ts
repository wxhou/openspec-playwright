import { describe, it, expect } from "vitest";
import {
  escapeYamlValue,
  formatTagsArray,
  buildCommandMeta,
  detectEditors,
  ALL_ADAPTERS,
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
    expect(formatTagsArray(["openspec", "playwright", "e2e"])).toBe(
      "[openspec, playwright, e2e]",
    );
  });

  it("escapes tags with colons using YAML quoting", () => {
    // escapeYamlValue quotes 'tag:colon' → "tag:colon", so array has quoted element
    expect(formatTagsArray(["tag:colon"])).toBe('["tag:colon"]');
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
});

// ─── detectEditors ────────────────────────────────────────────────────────────

describe("detectEditors", () => {
  it("returns empty array for non-existent directory", () => {
    const result = detectEditors("/tmp/nonexistent-project-xyz-123");
    expect(result).toEqual([]);
  });

  it("detects Claude Code when .claude directory exists", () => {
    const result = detectEditors(process.cwd());
    const names = result.map((a) => a.toolId);
    expect(names).toContain("claude");
  });
});

// ─── Adapter format correctness ───────────────────────────────────────────────

describe("Adapter format correctness", () => {
  it("every adapter has a toolId", () => {
    for (const adapter of ALL_ADAPTERS) {
      expect(adapter.toolId).toBeTruthy();
    }
  });

  it("every adapter has formatCommand that returns non-empty string", () => {
    const meta = buildCommandMeta("test body content");
    for (const adapter of ALL_ADAPTERS) {
      const output = adapter.formatCommand(meta);
      expect(output.length).toBeGreaterThan(0);
    }
  });

  it("every adapter getCommandPath returns a path with the id", () => {
    const meta = buildCommandMeta("test");
    for (const adapter of ALL_ADAPTERS) {
      const path = adapter.getCommandPath(meta.id);
      expect(path).toContain("opsx");
    }
  });

  it("Claude adapter output has YAML frontmatter", () => {
    const meta = buildCommandMeta("body");
    const output = ALL_ADAPTERS[0].formatCommand(meta);
    expect(output).toContain("---");
    expect(output).toContain("name:");
    expect(output).toContain("description:");
  });

  it("TOML adapters (gemini, qwen) do not use YAML frontmatter", () => {
    const meta = buildCommandMeta("body");
    const adapters = ALL_ADAPTERS.filter(
      (a) => a.toolId === "gemini" || a.toolId === "qwen",
    );
    for (const adapter of adapters) {
      const output = adapter.formatCommand(meta);
      expect(output).not.toContain("---");
      expect(output).toContain("description =");
      expect(output).toContain("prompt =");
    }
  });

  it("crush and qoder use raw values without escaping in name/description", () => {
    const meta = buildCommandMeta("body");
    const adapters = ALL_ADAPTERS.filter(
      (a) => a.toolId === "crush" || a.toolId === "qoder",
    );
    for (const adapter of adapters) {
      const output = adapter.formatCommand(meta);
      // Should NOT have escaped quotes in the raw-value fields
      expect(output).not.toContain('\\\\"');
      expect(output).toContain("name: OPSX: E2E");
    }
  });

  it("ALL_ADAPTERS has 5 adapters", () => {
    expect(ALL_ADAPTERS.length).toBe(5);
  });

  it("every adapter produces unique path patterns", () => {
    const paths = ALL_ADAPTERS.map((a) => a.getCommandPath("e2e"));
    const unique = new Set(paths);
    // All paths should be unique per adapter
    expect(unique.size).toBe(ALL_ADAPTERS.length);
  });

  it("escaping newlines in description preserves content", () => {
    const escaped = escapeYamlValue("line1\nline2\nline3");
    expect(escaped).toBe('"line1\\nline2\\nline3"');
    expect(escaped).not.toContain("\n");
  });

  it("escaping backticks and pipes", () => {
    expect(escapeYamlValue("use `code` here")).toBe('"use `code` here"');
    expect(escapeYamlValue("a | b")).toBe('"a | b"');
  });

  it("formatTagsArray with special chars", () => {
    // role:test contains ':' which triggers quoting
    const result = formatTagsArray(["@admin", "role:test"]);
    expect(result).toContain("role:test");
    // Should NOT break on colon
    expect(() => formatTagsArray(["role:test"])).not.toThrow();
  });

  it("buildCommandMeta with empty body", () => {
    const meta = buildCommandMeta("");
    expect(meta.id).toBe("e2e");
    expect(meta.body).toBe("");
    expect(meta.tags.length).toBeGreaterThan(0);
  });

  it("buildCommandMeta preserves original body", () => {
    const body = "Step 1: read\nStep 2: test";
    const meta = buildCommandMeta(body);
    expect(meta.body).toBe(body);
  });
});
