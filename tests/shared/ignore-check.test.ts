import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { findUnignoredFiles } from "../../src/shared/ignore-check.js";

describe("findUnignoredFiles", () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), "ospw-ignore-check-"));
  });

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  const CREDS = "tests/playwright/credentials.yaml";
  const BAK = "tests/playwright/credentials.yaml.bak";

  /** Create the credentials files listed (paths exist on disk). */
  function touch(...relPaths: string[]) {
    for (const rel of relPaths) {
      mkdirSync(join(tmpRoot, rel, ".."), { recursive: true });
      writeFileSync(join(tmpRoot, rel), "x");
    }
  }

  it("reports every existing path as unignored when no rules are present", () => {
    touch(CREDS, BAK);
    expect(findUnignoredFiles(tmpRoot, [CREDS, BAK])).toEqual([CREDS, BAK]);
  });

  it("exact-path entry covers the file", () => {
    touch(CREDS, BAK);
    writeFileSync(join(tmpRoot, ".gitignore"), `${CREDS}\n`);
    expect(findUnignoredFiles(tmpRoot, [CREDS, BAK])).toEqual([BAK]);
  });

  it("directory prefix `tests/` covers both files", () => {
    touch(CREDS, BAK);
    writeFileSync(join(tmpRoot, ".gitignore"), "tests/\n");
    expect(findUnignoredFiles(tmpRoot, [CREDS, BAK])).toEqual([]);
  });

  it("`*.bak` wildcard covers only the backup", () => {
    touch(CREDS, BAK);
    writeFileSync(join(tmpRoot, ".gitignore"), "*.bak\n");
    expect(findUnignoredFiles(tmpRoot, [CREDS, BAK])).toEqual([CREDS]);
  });

  it("negation re-includes a file matched at file level", () => {
    touch(CREDS, BAK);
    // `tests/playwright/*` matches children (file level, the directory
    // itself is not excluded) — so the negation CAN re-include. BAK is
    // not negated and stays covered.
    writeFileSync(
      join(tmpRoot, ".gitignore"),
      `tests/playwright/*\n!${CREDS}\n`,
    );
    expect(findUnignoredFiles(tmpRoot, [CREDS, BAK])).toEqual([CREDS]);
  });

  it("negation cannot re-include under an excluded directory (git rule)", () => {
    touch(CREDS, BAK);
    // gitignore(5): a file under an excluded directory (`tests/`) can
    // never be re-included — the directory is never descended into.
    writeFileSync(join(tmpRoot, ".gitignore"), `tests/\n!${CREDS}\n`);
    expect(findUnignoredFiles(tmpRoot, [CREDS, BAK])).toEqual([]);
  });

  it(".gitignore has precedence over .git/info/exclude (git order)", () => {
    // exclude ignores the file; .gitignore negates it back in. git gives
    // .gitignore priority → NOT ignored → hinted. Adding the sources in
    // reverse order flips this to [] — the regression this case locks.
    touch(CREDS, BAK);
    mkdirSync(join(tmpRoot, ".git", "info"), { recursive: true });
    writeFileSync(join(tmpRoot, ".git", "info", "exclude"), `${CREDS}\n`);
    writeFileSync(join(tmpRoot, ".gitignore"), `!${CREDS}\n`);
    expect(findUnignoredFiles(tmpRoot, [CREDS, BAK])).toEqual([CREDS, BAK]);
  });

  it(".git/info/exclude rules alone cover files (no .gitignore)", () => {
    touch(CREDS);
    mkdirSync(join(tmpRoot, ".git", "info"), { recursive: true });
    writeFileSync(join(tmpRoot, ".git", "info", "exclude"), `${CREDS}\n`);
    expect(findUnignoredFiles(tmpRoot, [CREDS])).toEqual([]);
  });

  it("works without a .git directory when .gitignore covers the file", () => {
    touch(CREDS);
    writeFileSync(join(tmpRoot, ".gitignore"), `${CREDS}\n`);
    expect(findUnignoredFiles(tmpRoot, [CREDS])).toEqual([]);
  });

  it("filters out paths that do not exist on disk", () => {
    touch(CREDS);
    // .bak does not exist — omitted from the result entirely.
    expect(findUnignoredFiles(tmpRoot, [CREDS, BAK])).toEqual([CREDS]);
  });
});
