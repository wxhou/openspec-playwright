import { describe, expect, it } from "vitest";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import {
  defaultScanRoots,
  discoverProjects,
  hasOpenspecPwTerritory,
} from "../../src/shared/discover.js";

const MARKERS =
  "user\n\n<!-- OPENSPEC-PW:START -->\nstandards\n<!-- OPENSPEC-PW:END -->\n";

function makeTemp(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

function makeProject(dir: string): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "AGENTS.md"), MARKERS);
}

describe("defaultScanRoots", () => {
  it("uses only the home directory off Windows", () => {
    expect(defaultScanRoots("/home/me", "darwin", () => true)).toEqual(["/home/me"]);
  });

  it("adds every existing drive on Windows", () => {
    const roots = defaultScanRoots("C:\\Users\\me", "win32", (p) =>
      p === "C:\\" || p === "D:\\",
    );
    expect(roots).toEqual(["C:\\Users\\me", "C:\\", "D:\\"]);
  });
});

describe("hasOpenspecPwTerritory", () => {
  it("detects the standards marker block", () => {
    const root = makeTemp("ospw-discover-marker-");
    try {
      writeFileSync(join(root, "AGENTS.md"), MARKERS);
      expect(hasOpenspecPwTerritory(root)).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("detects the schema directory alone", () => {
    const root = makeTemp("ospw-discover-schema-");
    try {
      mkdirSync(join(root, "openspec", "schemas", "playwright-e2e"), { recursive: true });
      expect(hasOpenspecPwTerritory(root)).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("detects a managed .gitignore block alone", () => {
    const root = makeTemp("ospw-discover-gitignore-");
    try {
      writeFileSync(
        join(root, ".gitignore"),
        "# openspec-pw: begin managed block\n.mcp.json\n# openspec-pw: end managed block\n",
      );
      expect(hasOpenspecPwTerritory(root)).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("does not treat a lone playwright-test entry as territory", () => {
    const root = makeTemp("ospw-discover-mcp-");
    try {
      writeFileSync(
        join(root, ".mcp.json"),
        JSON.stringify({ mcpServers: { "playwright-test": { command: "npx" } } }),
      );
      // The official Playwright agent init writes the same server name.
      expect(hasOpenspecPwTerritory(root)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("does not treat a bare legacy playwright entry as territory", () => {
    const root = makeTemp("ospw-discover-legacy-mcp-");
    try {
      writeFileSync(
        join(root, ".mcp.json"),
        JSON.stringify({ mcpServers: { playwright: { command: "npx" } } }),
      );
      // Indistinguishable from a user's own @playwright/mcp server.
      expect(hasOpenspecPwTerritory(root)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("returns false for a plain directory", () => {
    const root = makeTemp("ospw-discover-plain-");
    try {
      writeFileSync(join(root, "README.md"), "# hello\n");
      expect(hasOpenspecPwTerritory(root)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("discoverProjects", () => {
  it("finds projects under the given roots and prunes heavy directories", () => {
    const root = makeTemp("ospw-discover-scan-");
    try {
      const project = join(root, "work", "proj-a");
      makeProject(project);
      const pruned = join(root, "work", "proj-b", "node_modules", "pkg");
      makeProject(pruned);

      const result = discoverProjects({ roots: [root], cwd: join(root, "empty") });

      expect(result.projects).toContain(project);
      expect(result.projects).not.toContain(pruned);
      expect(result.truncated).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("does not follow directory symlinks", () => {
    const root = makeTemp("ospw-discover-link-");
    const target = makeTemp("ospw-discover-target-");
    try {
      makeProject(target);
      const link = join(root, "linked");
      try {
        // Junction works without developer mode on Windows; ignored on POSIX.
        symlinkSync(target, link, "junction");
      } catch {
        try {
          symlinkSync(target, link);
        } catch {
          // Environment cannot create symlinks (Windows without privileges).
          return;
        }
      }

      const result = discoverProjects({ roots: [root], cwd: join(root, "none") });

      expect(result.projects).not.toContain(link);
    } finally {
      rmSync(target, { recursive: true, force: true });
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("does not scan an overlapping root twice", () => {
    const root = makeTemp("ospw-discover-overlap-");
    try {
      const home = join(root, "home");
      const project = join(home, "proj");
      makeProject(project);

      const broad = discoverProjects({ roots: [root], cwd: undefined });
      const overlapped = discoverProjects({
        roots: [home, root],
        cwd: undefined,
      });

      expect(overlapped.projects).toContain(project);
      expect(
        overlapped.projects.filter((p) => p === project),
      ).toHaveLength(1);
      // The nested root is visited once, not once per containing root.
      expect(overlapped.scannedDirs).toBe(broad.scannedDirs);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("keeps scanning a subtree when a file in the parent is unreadable", () => {
    if (process.platform === "win32") return;
    const root = makeTemp("ospw-discover-unreadable-");
    const file = join(root, "CLAUDE.md");
    try {
      writeFileSync(file, MARKERS);
      chmodSync(file, 0o000);
      const nested = join(root, "nested");
      makeProject(nested);

      const result = discoverProjects({ roots: [root], cwd: join(root, "none") });

      expect(result.projects).toContain(nested);
    } finally {
      chmodSync(file, 0o644);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("merges the cwd project first when no explicit root is given", () => {
    const home = makeTemp("ospw-discover-home-");
    const outside = makeTemp("ospw-discover-cwd-default-");
    try {
      makeProject(join(home, "proj"));
      makeProject(outside);

      const result = discoverProjects({
        homeDir: home,
        platform: "darwin",
        cwd: outside,
      });

      expect(result.projects[0]).toBe(outside);
    } finally {
      rmSync(home, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it("does not merge the cwd project when roots are explicit", () => {
    const root = makeTemp("ospw-discover-explicit-");
    const outside = makeTemp("ospw-discover-cwd-explicit-");
    try {
      makeProject(join(root, "proj"));
      makeProject(outside);

      const result = discoverProjects({ roots: [root], cwd: outside });

      expect(result.projects).not.toContain(outside);
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it("resolves a relative root to an absolute project path", () => {
    const root = makeTemp("ospw-discover-rel-");
    try {
      const project = join(root, "proj");
      makeProject(project);
      const rel = relative(process.cwd(), root);

      const result = discoverProjects({
        roots: [rel],
        cwd: join(root, "none"),
      });

      expect(result.projects).toEqual([project]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("flags truncation when the directory cap is hit", () => {
    const root = makeTemp("ospw-discover-cap-");
    try {
      for (let i = 0; i < 5; i++) {
        mkdirSync(join(root, `d${i}`), { recursive: true });
      }

      const result = discoverProjects({ roots: [root], cwd: join(root, "none"), maxDirs: 2 });

      expect(result.truncated).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("treats a detected project as one unit and does not descend into it", () => {
    const root = makeTemp("ospw-discover-unit-");
    try {
      const project = join(root, "proj");
      makeProject(project);
      // Nested marker directory that would be seen if we descended.
      makeProject(join(project, "fixture"));

      const result = discoverProjects({ roots: [root], cwd: join(root, "none") });

      expect(result.projects).toEqual([project]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
