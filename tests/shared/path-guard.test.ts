import { describe, expect, it } from "vitest";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isPathInsideProjectRoot } from "../../src/shared/path-guard.js";

describe("isPathInsideProjectRoot", () => {
  it("accepts files and missing tails inside the project root", () => {
    const root = mkdtempSync(join(tmpdir(), "ospw-guard-"));
    try {
      mkdirSync(join(root, "a", "b"), { recursive: true });
      writeFileSync(join(root, "a", "b", "file.txt"), "x");

      expect(
        isPathInsideProjectRoot(root, join(root, "a", "b", "file.txt")),
      ).toBe(true);
      expect(
        isPathInsideProjectRoot(root, join(root, "a", "b", "missing.txt")),
      ).toBe(true);
      expect(
        isPathInsideProjectRoot(root, join(root, "a", "..", "a", "b", "file.txt")),
      ).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects siblings and symlink escapes", () => {
    if (process.platform === "win32") return;
    const root = mkdtempSync(join(tmpdir(), "ospw-guard-"));
    const outside = mkdtempSync(join(tmpdir(), "ospw-guard-outside-"));
    try {
      writeFileSync(join(outside, "file.txt"), "x");
      expect(isPathInsideProjectRoot(root, join(outside, "file.txt"))).toBe(false);

      symlinkSync(outside, join(root, "link"));
      expect(isPathInsideProjectRoot(root, join(root, "link", "file.txt"))).toBe(
        false,
      );
      expect(
        isPathInsideProjectRoot(root, join(root, "link", "missing", "file.txt")),
      ).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it("rejects dangling symlinks on the target path", () => {
    if (process.platform === "win32") return;
    const root = mkdtempSync(join(tmpdir(), "ospw-guard-"));
    const outside = mkdtempSync(join(tmpdir(), "ospw-guard-outside-"));
    try {
      symlinkSync(join(outside, "missing.txt"), join(root, "dangling"));
      expect(isPathInsideProjectRoot(root, join(root, "dangling"))).toBe(false);
      expect(
        isPathInsideProjectRoot(root, join(root, "dangling", "nested.txt")),
      ).toBe(false);

      symlinkSync(join(outside, "missing-dir"), join(root, "dangling-dir"));
      expect(
        isPathInsideProjectRoot(root, join(root, "dangling-dir", "file.txt")),
      ).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it("normalizes .. before walking missing tails", () => {
    const root = mkdtempSync(join(tmpdir(), "ospw-guard-"));
    try {
      expect(
        isPathInsideProjectRoot(
          root,
          join(root, "missing", "..", "inside-file"),
        ),
      ).toBe(true);
      expect(
        isPathInsideProjectRoot(
          root,
          join(root, "missing", "..", "..", "outside-file"),
        ),
      ).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("treats the filesystem root as containing everything", () => {
    const root = mkdtempSync(join(tmpdir(), "ospw-guard-"));
    try {
      expect(isPathInsideProjectRoot("/", join(root, "anything"))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("accepts a project root that is itself a symlink", () => {
    if (process.platform === "win32") return;
    const base = mkdtempSync(join(tmpdir(), "ospw-guard-link-root-"));
    try {
      const real = join(base, "real");
      const link = join(base, "link");
      mkdirSync(real);
      writeFileSync(join(real, "file.txt"), "x");
      symlinkSync(real, link);

      expect(isPathInsideProjectRoot(link, join(link, "file.txt"))).toBe(true);
      expect(isPathInsideProjectRoot(link, join(base, "other"))).toBe(false);
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });
});
