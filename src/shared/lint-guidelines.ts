/**
 * Swallow-error clause → lint rule checklist data (lint-guidelines capability).
 * Single source of truth for rule ids; templates/lint-guidelines.md is paired
 * with this data and pinned by a checksum test (docs-sync pattern: drift is a
 * CI failure, both sides update in the same commit).
 */
import { createHash } from "node:crypto";
import {
  existsSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
  type Dirent,
} from "node:fs";
import { dirname, extname, join, sep } from "node:path";
import { bundledTemplatePath } from "./drift.js";
import { normalizeEol } from "../commands/editors/agents.js";

export interface LintRuleEntry {
  /** Rule id as written in linter config/docs. */
  id: string;
  /** Linter that owns the rule. */
  tool: "ESLint" | "ruff" | "pylint";
  /** What shape of swallowed failure fires the rule. */
  semantics: string;
  /** Enabled by the linter's default rule set (no config needed). */
  defaultOn: boolean;
  /** Trigger scope — what the rule deliberately does NOT flag. */
  scope: string;
}

export const LINT_GUIDELINE_RULES: LintRuleEntry[] = [
  {
    id: "no-empty",
    tool: "ESLint",
    semantics: "empty catch block with no comment",
    defaultOn: true,
    scope: "blocks containing a comment are exempt — the black hole survives, human review carries it.",
  },
  {
    id: "E722",
    tool: "ruff",
    semantics: "bare `except:`",
    defaultOn: true,
    scope: "typed handlers only (narrow catches are not flagged)",
  },
  {
    id: "S110",
    tool: "ruff",
    semantics: "`except Exception: pass`",
    defaultOn: true,
    scope: "broad or bare handlers only; `pass` body",
  },
  {
    id: "S112",
    tool: "ruff",
    semantics: "`except Exception: continue`",
    defaultOn: true,
    scope: "broad or bare handlers only; `continue` body",
  },
  {
    id: "BLE001",
    tool: "ruff",
    semantics: "blind `except Exception` / `except BaseException`",
    defaultOn: true,
    scope: "not flagged when the handler logs with exc_info enabled (logged-exempt).",
  },
  {
    id: "B904",
    tool: "ruff",
    semantics: "`raise` inside an except handler without `from` (dropped causality; rethrown as-is exempt)",
    defaultOn: false,
    scope: "opt-in via select/extend-select of rule id or bugbear category `B`, or `ALL`",
  },
  {
    id: "W0702",
    tool: "pylint",
    semantics: "bare-except",
    defaultOn: true,
    scope: "pylint's default rule set; disabled only by project config",
  },
  {
    id: "W0718",
    tool: "pylint",
    semantics: "broad-exception-caught",
    defaultOn: true,
    scope: "pylint's default rule set; disabled only by project config",
  },
  {
    id: "W0707",
    tool: "pylint",
    semantics: "raise-missing-from (dropped causality)",
    defaultOn: true,
    scope: "pylint's default rule set; disabled only by project config",
  },
];

/** Project-relative checklist file path (editor-agnostic reference asset). */
export const LINT_GUIDELINES_RELPATH = "lint-guidelines.md";

/** Checksum line prefix — content hash is computed excluding this line itself. */
export const LINT_GUIDELINES_CHECKSUM_PREFIX =
  "<!-- openspec-pw: lint-guidelines ";

/**
 * Ownership checksum: sha256 of the checklist body with the checksum line
 * removed, truncated to 8 hex chars. The checksum line must be stripped from
 * the input it hashes (self-reference would deadlock the comparison). EOL is
 * normalized first: a CRLF checkout (Windows) must hash the same as LF, or
 * tool-owned files would be misread as user-modified.
 */
export function computeChecklistChecksum(body: string): string {
  const withoutChecksum = normalizeEol(body)
    .split("\n")
    .filter((line) => !line.startsWith(LINT_GUIDELINES_CHECKSUM_PREFIX))
    .join("\n");
  return createHash("sha256").update(withoutChecksum).digest("hex").slice(0, 8);
}

/** True when the file's checksum line matches the file body (tool-owned). */
export function isChecklistUnmodified(content: string): boolean {
  const lines = content.split("\n");
  const checksumLine = lines.find((l) =>
    l.startsWith(LINT_GUIDELINES_CHECKSUM_PREFIX),
  );
  if (!checksumLine) return false;
  const expected = checksumLine
    .slice(LINT_GUIDELINES_CHECKSUM_PREFIX.length)
    .replace(/\s*-->\s*$/, "")
    .trim();
  if (!/^[0-9a-f]{8}$/.test(expected)) return false;
  return computeChecklistChecksum(content) === expected;
}

export type ChecklistDisposition =
  | "created"
  | "unchanged"
  | "refreshed"
  | "kept-modified";

/** Uninstall-side disposition for the checklist file. */
export type ChecklistRemovalDisposition = "removed" | "kept-modified" | "absent";

/**
 * Uninstall the checklist: tool-owned (checksum intact) → remove;
 * user-modified → keep and report; missing → nothing to do.
 */
export function removeChecklist(
  projectRoot: string,
): ChecklistRemovalDisposition {
  const dest = join(projectRoot, LINT_GUIDELINES_RELPATH);
  if (!existsSync(dest)) return "absent";
  if (isChecklistUnmodified(readFileSync(dest, "utf-8"))) {
    rmSync(dest);
    return "removed";
  }
  return "kept-modified";
}

/**
 * Install or refresh the checklist in the project root, content-based
 * ownership (vendored-agents semantics): missing → copy; identical → no-op;
 * never user-modified (checksum intact) → overwrite with latest; user-modified
 * → leave untouched (caller reports it).
 *
 * `templateContent` lets `update` pass the fetched tarball's copy so the
 * checklist follows the same source as every other synced asset; callers
 * without a fetched bundle fall back to the running package's template.
 */
export function installOrRefreshChecklist(
  projectRoot: string,
  templateContent?: string,
): ChecklistDisposition {
  const latest =
    templateContent ??
    readFileSync(bundledTemplatePath(join("templates", "lint-guidelines.md")), "utf-8");
  const dest = join(projectRoot, LINT_GUIDELINES_RELPATH);
  if (!existsSync(dest)) {
    writeFileSync(dest, latest);
    return "created";
  }
  const current = readFileSync(dest, "utf-8");
  if (normalizeEol(current) === normalizeEol(latest)) return "unchanged";
  if (isChecklistUnmodified(current)) {
    writeFileSync(dest, latest);
    return "refreshed";
  }
  return "kept-modified";
}

// ── Config bootstrap (`init --lint-config`) ────────────────────────────────

/** ESLint flat-config generated by `init --lint-config` (write-once). */
export const LINT_ESLINT_CONFIG_FILE = "eslint.config.mjs";

/** First line of the generated ESLint config — marks the file as tool-generated. */
export const LINT_ESLINT_GENERATED_MARKER =
  "// Generated by openspec-pw init --lint-config.";

/** Paste-ready `no-empty` enablement snippet (flat-config object / legacy rules entry). */
export const LINT_ESLINT_SNIPPET = '{ rules: { "no-empty": "error" } }';

/** Managed-block markers for TOML appends (ruff). */
export const LINT_RUFF_BLOCK_BEGIN = "# openspec-pw: lint-guidelines begin";
export const LINT_RUFF_BLOCK_END = "# openspec-pw: lint-guidelines end";

/** ESLint config filenames: flat config first (ESLint 9+), then legacy. */
export const ESLINT_CONFIG_FILENAMES = [
  "eslint.config.js",
  "eslint.config.mjs",
  "eslint.config.cjs",
  "eslint.config.ts",
  "eslint.config.mts",
  "eslint.config.cts",
  ".eslintrc.js",
  ".eslintrc.cjs",
  ".eslintrc.json",
  ".eslintrc.yaml",
  ".eslintrc.yml",
  ".eslintrc",
];

export type RuffTableHeader = "[tool.ruff.lint]" | "[lint]";

/** Build the managed block appended to a pyproject or dedicated ruff.toml. */
export function buildRuffManagedBlock(tableHeader: RuffTableHeader): string {
  return [
    LINT_RUFF_BLOCK_BEGIN,
    tableHeader,
    'extend-select = ["B904"]',
    LINT_RUFF_BLOCK_END,
  ].join("\n");
}

/** Managed block body (between the marker lines), EOL-normalized; null if absent. */
export function findRuffManagedBlock(content: string): string | null {
  const normalized = normalizeEol(content);
  const begin = normalized.indexOf(LINT_RUFF_BLOCK_BEGIN);
  if (begin === -1) return null;
  const end = normalized.indexOf(LINT_RUFF_BLOCK_END, begin);
  if (end === -1) return null;
  return normalized
    .slice(begin + LINT_RUFF_BLOCK_BEGIN.length, end)
    .replace(/^\n/, "")
    .replace(/\n$/, "");
}

/**
 * Wide check for a hybrid pyproject ruff lint table. Substring match is
 * deliberate: a false positive means "snippet only, do not edit", which is
 * safer than appending a duplicate `[tool.ruff.lint]` table (invalid TOML).
 */
export function hasRuffLintTable(text: string): boolean {
  return text.includes("tool.ruff.lint");
}

/** Wide check for a dedicated ruff.toml `[lint]` table or root-level `lint.*` keys. */
export function hasDedicatedRuffLintTable(text: string): boolean {
  return /^\s*\[lint(?:\.[^\]]*)?\]/m.test(text) || /^\s*lint\s*\./m.test(text);
}

export interface FoundLintConfig {
  /** Absolute directory containing the config file. */
  dir: string;
  file: string;
  text: string | null;
  error: string | null;
  /** True when the file lives in the project root itself. */
  inProject: boolean;
}

function readConfig(
  dir: string,
  file: string,
  inProject: boolean,
): FoundLintConfig {
  try {
    return {
      dir,
      file,
      text: readFileSync(join(dir, file), "utf-8"),
      error: null,
      inProject,
    };
  } catch (err) {
    return {
      dir,
      file,
      text: null,
      error: err instanceof Error ? err.message : String(err),
      inProject,
    };
  }
}

/** Git root of `start`; `start` itself when it is not inside a repository. */
function findGitRoot(start: string): string {
  let dir = start;
  while (true) {
    if (existsSync(join(dir, ".git"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return start;
    dir = parent;
  }
}

/** `start` plus ancestors up to the git root (only `start` outside a repo). */
function dirsUpToGitRoot(start: string): string[] {
  const root = findGitRoot(start);
  const dirs: string[] = [];
  let dir = start;
  while (true) {
    dirs.push(dir);
    if (dir === root) break;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return dirs;
}

/** Nearest ESLint config from the project root upward (to the git root). */
export function findEslintConfig(projectRoot: string): FoundLintConfig | null {
  for (const dir of dirsUpToGitRoot(projectRoot)) {
    for (const file of ESLINT_CONFIG_FILENAMES) {
      if (existsSync(join(dir, file))) {
        return readConfig(dir, file, dir === projectRoot);
      }
    }
  }
  return null;
}

function findRuffConfigInDir(dir: string, inProject: boolean): FoundLintConfig | null {
  for (const file of ["ruff.toml", ".ruff.toml"]) {
    if (existsSync(join(dir, file))) return readConfig(dir, file, inProject);
  }
  const pyproject = join(dir, "pyproject.toml");
  if (existsSync(pyproject)) {
    const found = readConfig(dir, "pyproject.toml", inProject);
    // Unreadable pyproject is treated as a potential ruff config (conservative:
    // never append next to it, report the unreadable state instead).
    if (found.text === null) return found;
    if (/\[tool\.ruff(?:\.[^\]]*)?\]/.test(found.text)) return found;
  }
  return null;
}

/** Nearest ruff config from the project root upward (to the git root). */
export function findRuffConfig(projectRoot: string): FoundLintConfig | null {
  for (const dir of dirsUpToGitRoot(projectRoot)) {
    const found = findRuffConfigInDir(dir, dir === projectRoot);
    if (found) return found;
  }
  return null;
}

const SCAN_SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".git",
  ".venv",
  "venv",
  "__pycache__",
  ".next",
  ".turbo",
  ".cache",
]);
const SCAN_MAX_ENTRIES = 200;
const SCAN_MAX_DEPTH = 4;

/**
 * First source file matching `extensions` under a bounded scan (`src/`
 * preferred). Used for semantic probe targets and the Python-signal check.
 */
export function findSourceFile(
  projectRoot: string,
  extensions: string[],
): string | null {
  const candidates: Array<{ path: string; score: number }> = [];
  let entries = 0;

  const walk = (
    dir: string,
    depth: number,
    skipPaths: ReadonlySet<string> = new Set(),
  ): void => {
    if (entries >= SCAN_MAX_ENTRIES || depth > SCAN_MAX_DEPTH) return;
    let items: Dirent[];
    try {
      items = readdirSync(dir, { withFileTypes: true });
    } catch {
      // Unreadable directory cannot contribute candidates; other branches continue.
      return;
    }
    items.sort((a, b) => a.name.localeCompare(b.name));
    for (const item of items) {
      if (entries >= SCAN_MAX_ENTRIES) break;
      entries++;
      const path = join(dir, item.name);
      if (item.isDirectory()) {
        if (skipPaths.has(path)) continue;
        if (SCAN_SKIP_DIRS.has(item.name) || item.name.startsWith(".")) continue;
        walk(path, depth + 1, skipPaths);
        continue;
      }
      if (!item.isFile()) continue;
      const ext = extensions.find((candidate) => extname(item.name) === candidate);
      if (!ext) continue;
      if (item.name.endsWith(".d.ts")) continue;
      if (
        item.name.startsWith("eslint.config.") ||
        /\.config\.[cm]?[jt]s$/.test(item.name)
      ) {
        continue;
      }
      const rel = path.slice(projectRoot.length);
      const inSrc = rel.includes(`${sep}src${sep}`);
      candidates.push({
        path,
        score: (inSrc ? 0 : 10) + extensions.indexOf(ext),
      });
    }
  };

  // Walk `src/` first: the entry budget is bounded, and a large non-source
  // tree (openspec/, docs/) sorted ahead of `src/` could otherwise starve it.
  const preferred = join(projectRoot, "src");
  if (existsSync(preferred)) {
    walk(preferred, 1);
    walk(projectRoot, 0, new Set([preferred]));
  } else {
    walk(projectRoot, 0);
  }
  candidates.sort((a, b) => a.score - b.score || a.path.localeCompare(b.path));
  return candidates[0]?.path ?? null;
}

export interface ProjectDeps {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
}

function readProjectDeps(projectRoot: string): ProjectDeps | null {
  const file = join(projectRoot, "package.json");
  if (!existsSync(file)) return null;
  try {
    const parsed = JSON.parse(readFileSync(file, "utf-8")) as Record<
      string,
      unknown
    >;
    const pick = (value: unknown): Record<string, string> =>
      value && typeof value === "object"
        ? (value as Record<string, string>)
        : {};
    return {
      dependencies: pick(parsed.dependencies),
      devDependencies: pick(parsed.devDependencies),
    };
  } catch {
    // Unparsable package.json means dependency gates cannot be evaluated —
    // report "no usable package.json" to the caller instead of guessing.
    return null;
  }
}

function depSpec(deps: ProjectDeps, name: string): string | undefined {
  return deps.dependencies[name] ?? deps.devDependencies[name];
}

/**
 * First major number in a dependency spec (`^9`, `~9.20`, `>=9`, `9.x`).
 * Alias/protocol specs and tags are unresolvable here → null (skip generation).
 */
export function eslintMajorFromSpec(spec: string): number | null {
  const trimmed = spec.trim();
  if (
    /^(?:workspace|file|link|portal|github|git|https?|npm|patch|exec):/i.test(
      trimmed,
    )
  ) {
    return null;
  }
  if (/^(?:latest|next|beta|canary|stable)$/i.test(trimmed)) return null;
  const match = trimmed.match(/(\d+)/);
  return match ? Number.parseInt(match[1], 10) : null;
}

export type LintConfigAction =
  | "created"
  | "appended"
  | "unchanged"
  | "kept-modified"
  | "generated-existing"
  | "snippet"
  | "skipped";

export interface LintConfigResult {
  tool: "ESLint" | "ruff";
  action: LintConfigAction;
  /** Absolute path of the config file involved (absent when skipped). */
  file?: string;
  /** Reason for snippet/skipped outcomes. */
  reason?: string;
}

/**
 * Write/adjust lint configs for the swallow-error checklist. Explicitly
 * opt-in (`init --lint-config`); existing configs are never edited — only
 * missing files are created and missing ruff lint tables are appended as a
 * managed block, and never outside the project directory.
 */
export function installLintConfig(projectRoot: string): LintConfigResult[] {
  return [installEslintConfig(projectRoot), installRuffConfig(projectRoot)];
}

function installEslintConfig(projectRoot: string): LintConfigResult {
  const found = findEslintConfig(projectRoot);
  if (found) {
    const file = join(found.dir, found.file);
    if (found.text?.startsWith(LINT_ESLINT_GENERATED_MARKER)) {
      return { tool: "ESLint", action: "generated-existing", file };
    }
    return {
      tool: "ESLint",
      action: "snippet",
      file,
      reason: found.inProject
        ? undefined
        : "config found in an ancestor directory",
    };
  }

  const deps = readProjectDeps(projectRoot);
  if (!deps) {
    return { tool: "ESLint", action: "skipped", reason: "no usable package.json" };
  }
  const spec = depSpec(deps, "eslint");
  if (!spec) {
    return {
      tool: "ESLint",
      action: "skipped",
      reason: "eslint is not in dependencies",
    };
  }
  const major = eslintMajorFromSpec(spec);
  if (major === null) {
    return {
      tool: "ESLint",
      action: "skipped",
      reason: `eslint version "${spec}" is not resolvable`,
    };
  }
  if (major < 9) {
    return {
      tool: "ESLint",
      action: "skipped",
      reason: `eslint ${major} (< 9) has no flat-config support`,
    };
  }
  const isTypeScript =
    existsSync(join(projectRoot, "tsconfig.json")) ||
    Boolean(depSpec(deps, "typescript"));
  if (isTypeScript) {
    const hasTsEslint = [
      "typescript-eslint",
      "@typescript-eslint/eslint-plugin",
      "@typescript-eslint/parser",
    ].some((name) => depSpec(deps, name));
    if (!hasTsEslint) {
      return {
        tool: "ESLint",
        action: "skipped",
        reason:
          "TypeScript project without typescript-eslint — the minimal config has no TS parser",
      };
    }
  }

  const file = join(projectRoot, LINT_ESLINT_CONFIG_FILE);
  writeFileSync(
    file,
    `${LINT_ESLINT_GENERATED_MARKER} You own this file; openspec-pw won't modify it.\nexport default [\n  {\n    rules: {\n      "no-empty": "error",\n    },\n  },\n];\n`,
  );
  return { tool: "ESLint", action: "created", file };
}

function installRuffConfig(projectRoot: string): LintConfigResult {
  const pyprojectPath = join(projectRoot, "pyproject.toml");
  const hasPyproject = existsSync(pyprojectPath);
  const dedicated = ["ruff.toml", ".ruff.toml"].find((file) =>
    existsSync(join(projectRoot, file)),
  );
  // An existing ruff config is itself a Python-project signal: the spec's
  // "append when the config has no lint table" applies even without .py files.
  const pythonSignal =
    hasPyproject || dedicated !== undefined || findSourceFile(projectRoot, [".py"]) !== null;
  if (!pythonSignal) {
    return {
      tool: "ruff",
      action: "skipped",
      reason: "no Python project signal",
    };
  }

  if (dedicated) {
    return applyRuffBlock(join(projectRoot, dedicated), "[lint]");
  }

  const ancestor = dirsUpToGitRoot(projectRoot)
    .slice(1)
    .map((dir) => findRuffConfigInDir(dir, false))
    .find((found) => found !== null);

  if (hasPyproject) {
    let text: string;
    try {
      text = readFileSync(pyprojectPath, "utf-8");
    } catch (err) {
      return {
        tool: "ruff",
        action: "skipped",
        file: pyprojectPath,
        reason: `pyproject.toml unreadable (${err instanceof Error ? err.message : String(err)})`,
      };
    }
    // Our own managed block counts as a ruff table — resolve idempotency
    // before the literal table check, or a second run degrades to snippet.
    if (findRuffManagedBlock(text) !== null) {
      return applyRuffBlock(pyprojectPath, "[tool.ruff.lint]");
    }
    if (hasRuffLintTable(text)) {
      return { tool: "ruff", action: "snippet", file: pyprojectPath };
    }
    // A pyproject without any [tool.ruff*] table only appends safely when no
    // ancestor config would be shadowed by the new table.
    const hasRuffTable = /\[tool\.ruff(?:\.[^\]]*)?\]/.test(text);
    if (!hasRuffTable && ancestor) {
      return {
        tool: "ruff",
        action: "snippet",
        file: join(ancestor.dir, ancestor.file),
        reason: "config found in an ancestor directory",
      };
    }
    return applyRuffBlock(pyprojectPath, "[tool.ruff.lint]");
  }

  if (ancestor) {
    return {
      tool: "ruff",
      action: "snippet",
      file: join(ancestor.dir, ancestor.file),
      reason: "config found in an ancestor directory",
    };
  }

  const file = join(projectRoot, "ruff.toml");
  writeFileSync(file, `${buildRuffManagedBlock("[lint]")}\n`);
  return { tool: "ruff", action: "created", file };
}

function applyRuffBlock(
  file: string,
  tableHeader: RuffTableHeader,
): LintConfigResult {
  let content: string;
  try {
    content = readFileSync(file, "utf-8");
  } catch (err) {
    return {
      tool: "ruff",
      action: "skipped",
      file,
      reason: `config unreadable (${err instanceof Error ? err.message : String(err)})`,
    };
  }

  const block = buildRuffManagedBlock(tableHeader);
  const expectedBody = block.split("\n").slice(1, -1).join("\n");
  const existing = findRuffManagedBlock(content);
  if (existing !== null) {
    return existing === expectedBody
      ? { tool: "ruff", action: "unchanged", file }
      : { tool: "ruff", action: "kept-modified", file };
  }

  const tableExists =
    tableHeader === "[lint]"
      ? hasDedicatedRuffLintTable(content)
      : hasRuffLintTable(content);
  if (tableExists) {
    return { tool: "ruff", action: "snippet", file };
  }

  const eol = content.includes("\r\n") ? "\r\n" : "\n";
  const blockText = block.split("\n").join(eol);
  const separator = content.length > 0 && !content.endsWith("\n") ? eol : "";
  writeFileSync(file, content + separator + blockText + eol);
  return { tool: "ruff", action: "appended", file };
}