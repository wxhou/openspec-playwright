import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildCommandMeta,
  claudeAdapter,
  installOpenSpecBlock,
  listCommandArtifactPaths,
  removeAdapterCommandArtifacts,
} from "../src/commands/editors.js";

// Symlink-boundary coverage moved out of editors.test.ts to keep each test
// file under the repo's 1500-line cap.
let tmpRoot: string;
beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), "openspec-pw-symlink-"));
});
afterEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
});

describe("update.ts: symlinked CLAUDE.md drift check (source guard)", () => {
  it("drift check skips a symlinked CLAUDE.md before comparing to the wrapper", () => {
    const src = readFileSync(
      fileURLToPath(new URL("../src/commands/update.ts", import.meta.url)),
      "utf-8",
    );
    expect(src).toMatch(
      /existsSync\(wrapperPath\) && lstatSync\(wrapperPath\)\.isSymbolicLink\(\)/,
    );
  });

  it("doctor reports standards-claude as covered when CLAUDE.md is a symlink", () => {
    const src = readFileSync(
      fileURLToPath(new URL("../src/commands/doctor.ts", import.meta.url)),
      "utf-8",
    );
    expect(src).toMatch(
      /existsSync\(wrapperFile\) && lstatSync\(wrapperFile\)\.isSymbolicLink\(\)/,
    );
  });
});

describe("symlink boundary", () => {
  it("does not install standards through a symlinked AGENTS.md", () => {
    if (process.platform === "win32") return;
    const outside = mkdtempSync(join(tmpdir(), "openspec-pw-outside-"));
    try {
      const external = join(outside, "AGENTS.md");
      writeFileSync(external, "user content\n");
      symlinkSync(external, join(tmpRoot, "AGENTS.md"));

      installOpenSpecBlock(tmpRoot, "standards", claudeAdapter);

      expect(readFileSync(external, "utf-8")).toBe("user content\n");
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it("does not create a file through a dangling AGENTS.md symlink", () => {
    if (process.platform === "win32") return;
    const outside = mkdtempSync(join(tmpdir(), "openspec-pw-outside-"));
    try {
      const external = join(outside, "AGENTS.md");
      symlinkSync(external, join(tmpRoot, "AGENTS.md"));

      installOpenSpecBlock(tmpRoot, "standards", claudeAdapter);

      expect(existsSync(external)).toBe(false);
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it("does not delete command artifacts through a symlinked parent directory", () => {
    if (process.platform === "win32") return;
    const outside = mkdtempSync(join(tmpdir(), "openspec-pw-outside-"));
    try {
      const rel = listCommandArtifactPaths(claudeAdapter, buildCommandMeta(""))[0];
      const externalFile = join(outside, rel.slice(".claude/".length));
      mkdirSync(dirname(externalFile), { recursive: true });
      writeFileSync(externalFile, "shared command");
      symlinkSync(outside, join(tmpRoot, ".claude"));

      const removed = removeAdapterCommandArtifacts(claudeAdapter, tmpRoot);

      expect(removed).toEqual([]);
      expect(readFileSync(externalFile, "utf-8")).toBe("shared command");
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });
});
