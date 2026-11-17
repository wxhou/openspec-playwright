import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

// Claude Code warns once a loaded instruction file passes 200 lines
// (code.claude.com/docs/en/memory). The standards are installed into the
// project's AGENTS.md, which Claude Code imports from CLAUDE.md, so the file
// length is user-visible: the installer adds a title and markers — 190 leaves
// room for that overhead and a few future lines.
const MAX_STANDARDS_LINES = 190;

function countLines(file: string): number {
  const text = readFileSync(
    join(__dirname, "..", "standards", file),
    "utf-8",
  ).replace(/\r\n/g, "\n");
  return text.replace(/\n+$/, "").split("\n").length;
}

describe("standards length", () => {
  for (const file of ["employee-standards.md", "employee-standards.en.md"]) {
    it(`${file} stays within the 200-line CLAUDE.md target`, () => {
      expect(countLines(file)).toBeLessThanOrEqual(MAX_STANDARDS_LINES);
    });
  }
});
