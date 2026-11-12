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

  it("detects an MCP config carrying playwright-test alone", () => {
    const root = makeTemp("ospw-discover-mcp-");
    try {
      writeFileSync(
        join(root, ".mcp.json"),
        JSON.stringify({ mcpServers: { "playwright-test": { command: "npx" } } }),
      );
      expect(hasOpenspecPwTerritory(root)).toBe(true);
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

  it("lists the cwd project first even when it is outside the scan roots", () => {
    const root = makeTemp("ospw-discover-roots-");
    const outside = makeTemp("ospw-discover-cwd-");
    try {
      const scanned = join(root, "proj");
      makeProject(scanned);
      makeProject(outside);

      const result = discoverProjects({ roots: [root], cwd: outside });

      expect(result.projects[0]).toBe(outside);
      expect(result.projects).toContain(scanned);
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
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
