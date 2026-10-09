import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  buildMirrorContent,
  parseArgs,
  syncAgentsMirror,
  OPENSPEC_PW_BEGIN,
  OPENSPEC_PW_END,
} from "../scripts/sync-standards.mjs";

// Shared temp-dir lifecycle; AGENTS.md itself is a gitignored local file,
// so every test works in an isolated tempdir (CI-safe by construction).
let tmpRoot: string;
beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), "openspec-pw-standards-"));
});
afterEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
});

const SSOT = "# Standards\n\nLine one.\nLine two.\n";
const BLOCK = `${OPENSPEC_PW_BEGIN}\n\n# Standards\n\nLine one.\nLine two.\n${OPENSPEC_PW_END}`;
const FRESH = `# openspec-playwright\n${BLOCK}\n`;

describe("parseArgs", () => {
  it("accepts no args and --check; rejects anything else", () => {
    expect(parseArgs([])).toEqual({ check: false });
    expect(parseArgs(["--check"])).toEqual({ check: true });
    expect(parseArgs(["--dry-run"]).error).toMatch(/unknown flag/);
    expect(parseArgs(["--Check"]).error).toBeDefined();
    expect(parseArgs(["-h"]).error).toBeDefined();
    expect(parseArgs(["../other"]).error).toMatch(/unexpected argument/);
  });
});

describe("buildMirrorContent", () => {
  it("creates the canonical fresh shape when the file effectively does not exist", () => {
    expect(buildMirrorContent(SSOT, null).content).toBe(FRESH);
    expect(buildMirrorContent(SSOT, "").content).toBe(FRESH);
    expect(buildMirrorContent(SSOT, "   \n").content).toBe(FRESH);
  });

  it("normalizes a CRLF SSOT — no bare \\r can leak into the block", () => {
    const crlfSSOT = SSOT.replace("\n", "\r\n");
    expect(buildMirrorContent(crlfSSOT, null).content).toBe(FRESH);
  });

  it("replaces the block in place and preserves bytes outside it exactly", () => {
    const existing = [
      "# openspec-playwright",
      OPENSPEC_PW_BEGIN,
      "stale inner content",
      OPENSPEC_PW_END,
      "",
      "<!-- CODEGRAPH_START -->",
      "codegraph block stays",
      "<!-- CODEGRAPH_END -->",
    ].join("\n");
    expect(buildMirrorContent(SSOT, existing).content).toBe(
      `# openspec-playwright\n${BLOCK}\n\n<!-- CODEGRAPH_START -->\ncodegraph block stays\n<!-- CODEGRAPH_END -->`,
    );
  });

  it("converts the whole block to CRLF on a CRLF-dominant file, no bare LF left", () => {
    const existing = `# t\r\n\r\n${OPENSPEC_PW_BEGIN}\r\nold\r\n${OPENSPEC_PW_END}\r\n`;
    const content = buildMirrorContent(SSOT, existing).content!;
    expect(content.startsWith(`# t\r\n\r\n${OPENSPEC_PW_BEGIN}\r\n\r\n# Standards\r\n\r\nLine one.\r\nLine two.\r\n${OPENSPEC_PW_END}\r\n`)).toBe(true);
    expect(content).not.toMatch(/(?<!\r)\n/);
  });

  it("refuses BEGIN without a later END instead of consuming the file", () => {
    expect(buildMirrorContent(SSOT, `orphan ${OPENSPEC_PW_BEGIN} no end\n`).error).toBeDefined();
  });

  it("replaces the first marker pair and drops stale later pairs", () => {
    const existing = [
      "# openspec-playwright",
      OPENSPEC_PW_BEGIN,
      "old one",
      OPENSPEC_PW_END,
      "junk between blocks",
      OPENSPEC_PW_BEGIN,
      "second stale pair",
      OPENSPEC_PW_END,
      "tail content",
    ].join("\n");
    expect(buildMirrorContent(SSOT, existing).content).toBe(
      `# openspec-playwright\n${BLOCK}\ntail content`,
    );
  });

  it("restores the generated title on a block-only file", () => {
    const blockOnly = `${OPENSPEC_PW_BEGIN}\n\ncontent\n${OPENSPEC_PW_END}`;
    // F5: the file ended without a trailing newline — the restored shape
    // keeps ending without one (the blanked-file fresh shape does not).
    expect(buildMirrorContent(SSOT, blockOnly).content).toBe(FRESH.replace(/\n$/, ""));
  });

  it("appends at the tail keeping exact trailing-newline state (F5)", () => {
    // LF file ending with a newline: block appended, one newline as found.
    expect(buildMirrorContent(SSOT, "just text\n").content).toBe(`just text\n${BLOCK}\n`);
    // LF file ending WITHOUT a newline: must still end without one.
    expect(buildMirrorContent(SSOT, "just text").content).toBe(`just text\n${BLOCK}`);
    // CRLF file ending with a newline: separator and terminator both CRLF
    // — the old bug left an orphan \r here.
    expect(buildMirrorContent(SSOT, "just text\r\n").content).toBe(`just text\r\n${BLOCK.replace(/\n/g, "\r\n")}\r\n`);
    // Multiple trailing newlines collapse to the block separator.
    expect(buildMirrorContent(SSOT, "just text\n\n\n").content).toBe(`just text\n${BLOCK}\n`);
  });

  it("keeps an orphan END marker as user content and still appends", () => {
    const existing = `stray ${OPENSPEC_PW_END} here\n`;
    expect(buildMirrorContent(SSOT, existing).content).toBe(
      `stray ${OPENSPEC_PW_END} here\n${BLOCK}\n`,
    );
  });
});

describe("syncAgentsMirror", () => {
  const writeSSOT = () => writeFileSync(join(tmpRoot, "employee-standards.md"), SSOT);

  it("round-trips: write then re-run reports already in sync, byte-identical", () => {
    writeSSOT();
    expect(syncAgentsMirror(tmpRoot).changed).toBe(true);
    const first = readFileSync(join(tmpRoot, "AGENTS.md"), "utf-8");
    expect(syncAgentsMirror(tmpRoot)).toEqual({ changed: false });
    expect(readFileSync(join(tmpRoot, "AGENTS.md"), "utf-8")).toBe(first);
  });

  it("settles when the mirror carries extra trailing newlines (no churn)", () => {
    writeSSOT();
    writeFileSync(join(tmpRoot, "AGENTS.md"), FRESH + "\n\n");
    expect(syncAgentsMirror(tmpRoot)).toEqual({ changed: false });
  });

  it("check mode reports drift without writing", () => {
    writeSSOT();
    writeFileSync(join(tmpRoot, "AGENTS.md"), `${OPENSPEC_PW_BEGIN}\n\ndrifted\n${OPENSPEC_PW_END}\n`);
    expect(syncAgentsMirror(tmpRoot, { check: true })).toEqual({ changed: true, wrote: false });
    expect(readFileSync(join(tmpRoot, "AGENTS.md"), "utf-8")).toContain("drifted");
  });

  it("throws when the SSOT is missing instead of fabricating one", () => {
    expect(() => syncAgentsMirror(tmpRoot)).toThrow(/SSOT not found/);
    expect(existsSync(join(tmpRoot, "AGENTS.md"))).toBe(false);
  });
});
