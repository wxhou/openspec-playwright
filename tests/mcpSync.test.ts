import { describe, it, expect } from "vitest";
import {
  getStoredMcpVersion,
  updateHealerTable,
  DEFAULT_HEALER_TOOLS,
} from "../src/commands/mcpSync.js";

// ─── getStoredMcpVersion ─────────────────────────────────────────────────────

describe("getStoredMcpVersion", () => {
  it("extracts version from marker line", () => {
    const content = `foo\n<!-- MCP_VERSION: 1.2.3 -->\nbar`;
    expect(getStoredMcpVersion(content)).toBe("1.2.3");
  });

  it("returns null when no marker", () => {
    expect(getStoredMcpVersion("no marker here")).toBeNull();
  });

  it("handles whitespace around version", () => {
    const content = `<!-- MCP_VERSION:  0.5.0  -->`;
    expect(getStoredMcpVersion(content)).toBe("0.5.0");
  });

  it("handles version-only content", () => {
    expect(getStoredMcpVersion("<!-- MCP_VERSION: -->")).toBe("");
  });
});

// ─── updateHealerTable ───────────────────────────────────────────────────────

describe("updateHealerTable", () => {
  const header = `---
name: Test
---

| Tool | Purpose |
|------|---------|
| \`old_tool\` | Old purpose |

More content`;

  it("replaces the Healer tools table", () => {
    const tools = [
      { name: "browser_navigate", purpose: "Go to page" },
      { name: "browser_snapshot", purpose: "Get structure" },
    ];
    const result = updateHealerTable(header, "2.0.0", tools);
    expect(result).toContain("<!-- MCP_VERSION: 2.0.0 -->");
    expect(result).toContain("browser_navigate");
    expect(result).toContain("Go to page");
    expect(result).not.toContain("old_tool");
  });

  it("returns original when table not found", () => {
    const noTable = "No table here";
    const result = updateHealerTable(noTable, "1.0.0", DEFAULT_HEALER_TOOLS);
    expect(result).toBe(noTable);
  });

  it("uses passed tools (not default) when provided", () => {
    const tools = [
      { name: "browser_navigate", purpose: "Custom navigate" },
    ];
    const result = updateHealerTable(header, "1.0.0", tools);
    expect(result).toContain("<!-- MCP_VERSION: 1.0.0 -->");
    expect(result).toContain("browser_navigate");
    expect(result).toContain("Custom navigate");
    expect(result).not.toContain("old_tool");
  });

  it("escapes pipe characters in purpose text", () => {
    const tools = [{ name: "test", purpose: "a | b | c" }];
    const result = updateHealerTable(header, "1.0.0", tools);
    expect(result).toContain("a | b | c");
  });

  it("preserves multiline purpose text", () => {
    const tools = [{ name: "test", purpose: "Line 1\nLine 2" }];
    const result = updateHealerTable(header, "1.0.0", tools);
    expect(result).toContain("Line 1");
    expect(result).toContain("Line 2");
  });
});

// ─── DEFAULT_HEALER_TOOLS ────────────────────────────────────────────────────

describe("DEFAULT_HEALER_TOOLS", () => {
  it("has all expected browser_ tools", () => {
    const names = DEFAULT_HEALER_TOOLS.map((t) => t.name);
    expect(names).toContain("browser_navigate");
    expect(names).toContain("browser_snapshot");
    expect(names).toContain("browser_console_messages");
    expect(names).toContain("browser_take_screenshot");
    expect(names).toContain("browser_run_code");
  });

  it("every tool has a non-empty purpose", () => {
    for (const tool of DEFAULT_HEALER_TOOLS) {
      expect(tool.purpose.length).toBeGreaterThan(0);
    }
  });

  it("every tool name starts with browser_", () => {
    for (const tool of DEFAULT_HEALER_TOOLS) {
      expect(tool.name).toMatch(/^browser_/);
    }
  });
});
