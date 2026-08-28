import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync, readFileSync, symlinkSync } from "fs";
import { join } from "path";
import {
  migrateLegacyMarkers,
} from "../src/commands/editors/project-rules.js";
import { OPENSPEC_START, OPENSPEC_END, LEGACY_OPENSPEC_START, LEGACY_OPENSPEC_END } from "../src/shared/drift.js";

describe("migrateLegacyMarkers", () => {
  const tmpDir = join(__dirname, "..", "tmp-test", "migrate-markers-" + Date.now());

  beforeEach(() => {
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  const writeAgents = (content: string) => writeFileSync(join(tmpDir, "AGENTS.md"), content);
  const readAgents = () => readFileSync(join(tmpDir, "AGENTS.md"), "utf-8");

  const legacyBlock =
    "outside before\n\n" +
    `${LEGACY_OPENSPEC_START}\n\n# AI Coding Assistant Employee-Grade Standards\n\n## 0. 适用范围\n\nrules body\n\n${LEGACY_OPENSPEC_END}\n\noutside after\n`;

  it("complete legacy block: markers swapped in place, content verbatim", () => {
    writeAgents(legacyBlock);
    expect(migrateLegacyMarkers(tmpDir, true, false)).toBe(true);
    const after = readAgents();
    expect(after).toContain(`${OPENSPEC_START}\n\n# AI Coding Assistant Employee-Grade Standards`);
    expect(after).not.toContain("OPENSPEC:START");
    expect(after).toContain("rules body\n\n" + OPENSPEC_END + "\n\noutside after");
    // Outside content preserved verbatim
    expect(after.startsWith("outside before")).toBe(true);
    expect(after.endsWith("outside after\n")).toBe(true);
  });

  it("lone legacy START with signature after it: migrated (truncated-repair converges later)", () => {
    writeAgents(
      `# proj\n\n${LEGACY_OPENSPEC_START}\n\n# AI Coding Assistant Employee-Grade Standards\n\nbody without end\n`,
    );
    expect(migrateLegacyMarkers(tmpDir, true, false)).toBe(true);
    expect(readAgents()).toContain(OPENSPEC_START);
    expect(readAgents()).not.toContain(LEGACY_OPENSPEC_START);
  });

  it("lone legacy END (no START): not migrated, file untouched", () => {
    const content = `# proj\n\norphan ${LEGACY_OPENSPEC_END}\n`;
    writeAgents(content);
    expect(migrateLegacyMarkers(tmpDir, true, false)).toBe(false);
    expect(readAgents()).toBe(content);
  });

  it("official legacy block (no signature): not migrated", () => {
    const content = `${LEGACY_OPENSPEC_START}\n\nOpenSpec workflow guidance\n\n${LEGACY_OPENSPEC_END}\n`;
    writeAgents(content);
    expect(migrateLegacyMarkers(tmpDir, true, false)).toBe(false);
    expect(readAgents()).toBe(content);
  });

  it("legacy FULL-standards block in CLAUDE.md (April-2026 format, no @AGENTS.md) migrates", () => {
    // v0.1.38–v0.3.2 wrote the full standards directly into CLAUDE.md under
    // legacy markers. Without this signature, update would APPEND a new
    // wrapper next to the block instead of replacing it (duplicate content).
    const shapeB = `${LEGACY_OPENSPEC_START}\n\n# AI Coding Assistant Employee-Grade Standards\n\nfull standards body\n\n${LEGACY_OPENSPEC_END}\n`;
    writeFileSync(join(tmpDir, "CLAUDE.md"), shapeB);
    writeAgents("no markers here\n");
    expect(migrateLegacyMarkers(tmpDir, true, true)).toBe(true);
    const after = readFileSync(join(tmpDir, "CLAUDE.md"), "utf-8");
    expect(after).toContain(OPENSPEC_START);
    expect(after).not.toContain(LEGACY_OPENSPEC_START);
    expect(after).toContain("full standards body");
  });

  it("no pw artifacts: official relic untouched (not our territory)", () => {
    writeAgents(legacyBlock);
    expect(migrateLegacyMarkers(tmpDir, false, false)).toBe(false);
    expect(readAgents()).toBe(legacyBlock);
  });

  it("no legacy markers at all: untouched", () => {
    const content = "# proj\n\nplain user content\n";
    writeAgents(content);
    expect(migrateLegacyMarkers(tmpDir, true, false)).toBe(false);
    expect(readAgents()).toBe(content);
  });

  it("wrapper migrated only when claude is authorized", () => {
    const wrapper =
      `# proj\n\n${LEGACY_OPENSPEC_START}\n\n## CodeGraph 优先\n\n工作流提示。\n\n@AGENTS.md\n\n${LEGACY_OPENSPEC_END}\n`;
    writeFileSync(join(tmpDir, "CLAUDE.md"), wrapper);
    writeAgents(legacyBlock);

    expect(migrateLegacyMarkers(tmpDir, true, false)).toBe(true); // AGENTS.md only
    expect(readFileSync(join(tmpDir, "CLAUDE.md"), "utf-8")).toBe(wrapper);

    expect(migrateLegacyMarkers(tmpDir, true, true)).toBe(true); // now the wrapper too
    const migratedWrapper = readFileSync(join(tmpDir, "CLAUDE.md"), "utf-8");
    expect(migratedWrapper).toContain(`${OPENSPEC_START}\n\n## CodeGraph 优先`);
    expect(migratedWrapper).not.toContain(LEGACY_OPENSPEC_START);
  });

  it("symlinked CLAUDE.md wrapper is not rewritten through the link", () => {
    writeAgents(legacyBlock);
    symlinkSync(join(tmpDir, "AGENTS.md"), join(tmpDir, "CLAUDE.md"));
    expect(migrateLegacyMarkers(tmpDir, true, true)).toBe(true); // AGENTS.md migrated
    // AGENTS.md now carries the new markers, so the symlink target is correct.
    expect(readAgents()).toContain(OPENSPEC_START);
  });
});