/**
 * Locate projects on this machine that carry openspec-pw territory, for
 * `remove --all`. Stateless on purpose: the filesystem is the only source
 * of truth, so there is no registry to go stale or miss pre-existing installs.
 *
 * The scan is bounded (depth, visited-directory count), prunes dependency,
 * cache and system directories, and never follows symlinks.
 */
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import {
  buildCommandMeta,
  getAllAdapters,
  hasRuleFileMarkers,
  listCommandArtifactPaths,
  normalizeEol,
  OPENSPEC_PW_MCP_SERVERS,
} from "../commands/editors.js";
import { isStopHookInstalled } from "../commands/hooks.js";
import { AUTO_PIPELINE_REL } from "../commands/pipeline.js";
import { GITIGNORE_BLOCK_BEGIN, GITIGNORE_BLOCK_END } from "./gitignore-managed.js";
import {
  isChecklistUnmodified,
  isToolGeneratedEslintConfig,
  isToolOwnedRuffBlock,
} from "./lint-guidelines.js";

export const SCAN_MAX_DEPTH = 6;
export const SCAN_MAX_DIRS = 50_000;

/** Signal files larger than this are skipped instead of read whole. */
const SIGNAL_MAX_BYTES = 1024 * 1024;

/** Skipped at any depth — dependencies, caches, build output, tool data. */
const PRUNED_DIR_NAMES = new Set([
  "node_modules",
  ".git",
  "library",
  ".cache",
  ".npm",
  ".pnpm-store",
  ".trash",
  "appdata",
  ".venv",
  "venv",
  "dist",
  "build",
  ".codegraph",
  ".playwright-mcp",
]);

/** Skipped only at scan roots (drive roots on Windows, home dir). */
const SYSTEM_DIR_NAMES = new Set([
  "windows",
  "program files",
  "program files (x86)",
  "programdata",
  "$recycle.bin",
  "system volume information",
]);

export interface DiscoverOptions {
  /** Replaces the default scan roots when non-empty. `~` is expanded. */
  roots?: string[];
  /** Always merged into the result (first), even when outside the scan roots. */
  cwd?: string;
  maxDepth?: number;
  maxDirs?: number;
  homeDir?: string;
  platform?: NodeJS.Platform;
  /** Injectable drive probe for tests (defaults to existsSync). */
  driveExists?: (path: string) => boolean;
}

export interface DiscoverResult {
  /** Absolute project paths, deduplicated by realpath, cwd first when present. */
  projects: string[];
  /** True when the visited-directory cap stopped the scan early. */
  truncated: boolean;
  scannedDirs: number;
  /** Directories skipped because they could not be read. */
  unreadableDirs: number;
}

/** Does this directory carry any openspec-pw territory? Read-only, signal per design D4. */
export function hasOpenspecPwTerritory(projectRoot: string): boolean {
  const meta = buildCommandMeta("");
  for (const adapter of getAllAdapters()) {
    for (const rel of listCommandArtifactPaths(adapter, meta)) {
      if (existsSync(join(projectRoot, rel))) return true;
    }
  }

  if (existsSync(join(projectRoot, "openspec", "schemas", "playwright-e2e"))) {
    return true;
  }

  if (hasRuleFileMarkers(projectRoot, SIGNAL_MAX_BYTES)) return true;

  const gitignore = join(projectRoot, ".gitignore");
  if (isSmallFile(gitignore)) {
    const text = readFileSync(gitignore, "utf-8");
    const begin = text.indexOf(GITIGNORE_BLOCK_BEGIN);
    if (begin !== -1 && text.indexOf(GITIGNORE_BLOCK_END, begin) !== -1) {
      return true;
    }
  }

  // Ask each adapter itself: the opencode carrier keeps its entries in
  // opencode.json(c) and declares no mcpConfigPath, so a path-based scan
  // would miss an OpenCode-only leftover. Both server names count — a legacy
  // install may only have the old `playwright` entry left.
  for (const adapter of getAllAdapters()) {
    if (adapter.supportsMcp === false) continue;
    for (const serverName of OPENSPEC_PW_MCP_SERVERS) {
      try {
        if (adapter.isMcpInstalled(projectRoot, serverName)) return true;
      } catch {
        // Unreadable config for this editor — try the next one.
      }
    }
  }

  // Content-owned leftovers carry no markers or MCP entries but are still
  // removable — without these signals `--all` would skip such projects.
  return hasContentOwnedTerritory(projectRoot);
}

const TESTS_README_TEMPLATE = new URL(
  "../../templates/tests-readme.md",
  import.meta.url,
);

/** True when a content-owned artifact is present and still tool-owned. */
function hasContentOwnedTerritory(projectRoot: string): boolean {
  const readSmall = (path: string): string | null => {
    try {
      if (!existsSync(path) || !statSync(path).isFile()) return null;
      if (statSync(path).size > SIGNAL_MAX_BYTES) return null;
      return readFileSync(path, "utf-8");
    } catch {
      return null;
    }
  };

  const testsReadme = readSmall(join(projectRoot, "tests", "README.md"));
  if (testsReadme !== null) {
    try {
      const template = readFileSync(TESTS_README_TEMPLATE, "utf-8");
      if (normalizeEol(testsReadme) === normalizeEol(template)) return true;
    } catch {
      // Template unreadable — fall through to the other signals.
    }
  }

  const checklist = readSmall(join(projectRoot, "lint-guidelines.md"));
  if (checklist !== null && isChecklistUnmodified(checklist)) return true;

  // Filenames below are tool-specific, so existence is signal enough.
  if (existsSync(join(projectRoot, ".github", "workflows", "openspec-pw.yml"))) {
    return true;
  }
  if (existsSync(join(projectRoot, AUTO_PIPELINE_REL))) return true;

  const eslint = readSmall(join(projectRoot, "eslint.config.mjs"));
  if (eslint !== null && isToolGeneratedEslintConfig(eslint)) return true;

  for (const name of ["pyproject.toml", ".ruff.toml", "ruff.toml"]) {
    const content = readSmall(join(projectRoot, name));
    if (content !== null && isToolOwnedRuffBlock(content)) return true;
  }

  return isStopHookInstalled(projectRoot);
}

/** Scan for openspec-pw projects under the given (or default) roots. */
export function discoverProjects(options: DiscoverOptions = {}): DiscoverResult {
  const platform = options.platform ?? process.platform;
  const homeDir = options.homeDir ?? homedir();
  const maxDepth = options.maxDepth ?? SCAN_MAX_DEPTH;
  const maxDirs = options.maxDirs ?? SCAN_MAX_DIRS;
  const driveExists =
    options.driveExists ??
    ((path: string) => {
      try {
        return existsSync(path);
      } catch {
        return false;
      }
    });

  const roots = options.roots?.length
    ? dedupe(options.roots.map((r) => expandTilde(r, homeDir)))
    : defaultScanRoots(homeDir, platform, driveExists);

  const found = new Map<string, string>();
  let scannedDirs = 0;
  let unreadableDirs = 0;
  let truncated = false;

  const visit = (dir: string, depth: number): void => {
    if (truncated || depth > maxDepth) return;
    if (++scannedDirs > maxDirs) {
      truncated = true;
      return;
    }

    let isProject = false;
    try {
      isProject = hasOpenspecPwTerritory(dir);
    } catch {
      // One unreadable file must not hide the whole subtree — note it and
      // keep scanning.
      unreadableDirs++;
    }
    // A detected project is scanned as one unit: do not descend into its
    // fixtures. Scan roots themselves may also be projects (e.g. init run
    // in $HOME) — record them but keep descending.
    if (isProject) {
      const key = safeRealpath(dir) ?? dir;
      if (!found.has(key)) found.set(key, dir);
      if (depth > 0) return;
    }
    if (depth === maxDepth) return;

    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      unreadableDirs++;
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
      const name = entry.name.toLowerCase();
      if (PRUNED_DIR_NAMES.has(name)) continue;
      if (depth === 0 && SYSTEM_DIR_NAMES.has(name)) continue;
      visit(join(dir, entry.name), depth + 1);
      if (truncated) return;
    }
  };

  for (const root of roots) {
    if (!existsSync(root)) continue;
    visit(root, 0);
    if (truncated) break;
  }

  const projects = [...found.values()];
  const cwd = options.cwd;
  // An explicit `--root` defines the whole scope: merging the cwd project
  // would let `--yes` clean a project the user did not ask about.
  if (cwd && !options.roots?.length) {
    // The spec includes the *project containing* the cwd, not the cwd itself:
    // `remove --all` is often run from a subdirectory of the project.
    const cwdProject = findContainingProject(cwd);
    if (cwdProject) {
      const cwdKey = safeRealpath(cwdProject) ?? cwdProject;
      const existing = projects.findIndex(
        (p) => (safeRealpath(p) ?? p) === cwdKey,
      );
      if (existing === -1) {
        projects.unshift(cwdProject);
      } else if (existing > 0) {
        const [hit] = projects.splice(existing, 1);
        projects.unshift(hit);
      }
    }
  }

  return { projects, truncated, scannedDirs, unreadableDirs };
}

/** Nearest directory at or above `startDir` that carries openspec-pw territory. */
function findContainingProject(startDir: string): string | null {
  let dir = startDir;
  for (let hops = 0; hops < 64; hops++) {
    try {
      if (hasOpenspecPwTerritory(dir)) return dir;
    } catch {
      // Unreadable level — keep ascending.
    }
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
  return null;
}

/** Default roots: home; on Windows, home plus every drive letter that exists. */
export function defaultScanRoots(
  homeDir: string,
  platform: NodeJS.Platform,
  driveExists: (path: string) => boolean,
): string[] {
  const roots = [homeDir];
  if (platform === "win32") {
    for (let code = 65; code <= 90; code++) {
      const drive = `${String.fromCharCode(code)}:\\`;
      if (driveExists(drive)) roots.push(drive);
    }
  }
  return roots;
}

function expandTilde(path: string, homeDir: string): string {
  if (path === "~") return homeDir;
  if (path.startsWith("~/") || path.startsWith("~\\")) {
    return join(homeDir, path.slice(2));
  }
  return path;
}

function isSmallFile(path: string): boolean {
  try {
    return existsSync(path) && statSync(path).isFile() && statSync(path).size <= SIGNAL_MAX_BYTES;
  } catch {
    return false;
  }
}

function safeRealpath(path: string): string | null {
  try {
    return realpathSync(path);
  } catch {
    return null;
  }
}

function dedupe(paths: string[]): string[] {
  return [...new Set(paths)];
}
