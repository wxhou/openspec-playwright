import { describe, it, expect } from "vitest";
import {
  compareBlock,
  extractOpenSpecBlock,
  extractRuleBlockContent,
  OPENSPEC_START,
  OPENSPEC_END,
  bundledStandardsPath,
  bundledTemplatePath,
} from "../src/shared/drift.js";

const MARKER = (inner: string) =>
  `${OPENSPEC_START}\n\n${inner}\n\n${OPENSPEC_END}`;

describe("extractOpenSpecBlock", () => {
  it("returns null when no markers present", () => {
    expect(extractOpenSpecBlock("# just a file\nno markers here")).toBeNull();
  });

  it("returns null on truncated marker (START without END)", () => {
    const content = `# file\n${OPENSPEC_START}\nsome content\n`;
    expect(extractOpenSpecBlock(content)).toBeNull();
  });

  it("returns the marker range when both present", () => {
    const content = `# title\n\n${MARKER("body")}\n# tail\n`;
    const range = extractOpenSpecBlock(content);
    expect(range).not.toBeNull();
    expect(content.slice(range!.startIdx, range!.endIdx)).toContain("body");
  });
});

describe("compareBlock", () => {
  it("content identical → stale:false", () => {
    const expected = "## 1. 代码质量\n- 规则";
    const file = `# proj\n\n${MARKER(expected)}\n`;
    expect(compareBlock(file, expected).stale).toBe(false);
  });

  it("content different → stale:true", () => {
    const file = `# proj\n\n${MARKER("old content")}\n`;
    expect(compareBlock(file, "new content").stale).toBe(true);
  });

  it("no marker → stale:false (not tool-owned, don't misreport)", () => {
    expect(compareBlock("# user file, no markers", "anything").stale).toBe(false);
  });

  it("truncated marker (START without END) → stale:true", () => {
    const file = `# proj\n${OPENSPEC_START}\ncontent without end\n`;
    expect(compareBlock(file, "expected").stale).toBe(true);
  });

  it("lone END marker (no START) → stale:true (corrupted, asymmetric fix)", () => {
    const file = `# proj\n${OPENSPEC_END}\norphan end marker\n`;
    expect(compareBlock(file, "expected").stale).toBe(true);
  });

  it("CRLF inside the block compares equal to LF template (newline-insensitive)", () => {
    const expected = "## 1. 代码质量\n- 规则";
    // File saved with \r\n line endings inside the block
    const file = `# proj\n\n${OPENSPEC_START}\r\n\r\n## 1. 代码质量\r\n- 规则\r\n\r\n${OPENSPEC_END}\n`;
    expect(compareBlock(file, expected).stale).toBe(false);
  });

  it("trims whitespace around expected block (install writes \\n\\n padding)", () => {
    const expected = "content";
    // installOpenSpecBlock writes: START + \n\n + content.trim() + \n\n + END
    const file = `# proj\n\n${OPENSPEC_START}\n\n${expected}\n\n${OPENSPEC_END}\n`;
    expect(compareBlock(file, expected).stale).toBe(false);
    expect(compareBlock(file, `\n\n${expected}\n\n`).stale).toBe(false);
  });
});

describe("extractRuleBlockContent", () => {
  it("returns only the tool-owned block, not user prose around it", () => {
    const file = `# user prose\nThis codebase is yours\n${MARKER("这份代码库是你的")}\n`;
    expect(extractRuleBlockContent(file)).toContain("这份代码库是你的");
    expect(extractRuleBlockContent(file)).not.toContain("This codebase is yours");
  });

  it("reads a legacy OPENSPEC block before marker migration", () => {
    const file = `preamble\n<!-- OPENSPEC:START -->\n这份代码库是你的\n<!-- OPENSPEC:END -->\n`;
    expect(extractRuleBlockContent(file)).toContain("这份代码库是你的");
  });

  it("returns null when the file has no complete marker pair", () => {
    expect(extractRuleBlockContent("# no markers\n")).toBeNull();
    expect(extractRuleBlockContent(`${OPENSPEC_START}\ntruncated\n`)).toBeNull();
  });
});

describe("bundled template path resolution", () => {
  it("resolves employee-standards.md under the standards directory", () => {
    const p = bundledStandardsPath().replace(/\\/g, "/");
    expect(p.endsWith("standards/employee-standards.md")).toBe(true);
  });

  it("resolves the English standards file when asked", () => {
    expect(
      bundledStandardsPath("en").replace(/\\/g, "/").endsWith("standards/employee-standards.en.md"),
    ).toBe(true);
  });

  it("resolves templates relative to the package root", () => {
    // Normalize separators so the assertion holds on win32 backslash paths.
    expect(bundledTemplatePath("templates/e2e-command.md").replace(/\\/g, "/")).toMatch(
      /templates\/e2e-command\.md$/,
    );
  });
});
