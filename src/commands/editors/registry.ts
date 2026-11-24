/**
 * Adapter registry: the ADAPTERS array plus lookup/detection/install
 * helpers. Adapters self-register on module load (each adapters/*.ts
 * calls registerAdapter); this module deliberately imports no adapter so
 * the dependency graph stays acyclic (adapters -> registry).
 *
 * Registration order is load order and MUST stay:
 *   claude, opencode, cline, cursor, pi, omp, codebuddy, minimax, dsh,
 *   gemini, qwen, github-copilot, roocode, trae, codex, kimi
 * (editors.ts re-exports the adapter modules in exactly that order;
 * tests/editors-tools.test.ts asserts it.)
 */
import {
  mkdirSync,
  writeFileSync,
  existsSync,
  readFileSync,
  readdirSync,
  rmdirSync,
  rmSync,
} from "fs";
import { dirname, resolve as pathResolve } from "path";
import chalk from "chalk";
import { isPathInsideProjectRoot } from "../../shared/path-guard.js";
import { openSpecCliStatus } from "../../shared/openspec-version.js";
import type {
  ArtifactStyle,
  CommandMeta,
  EditorAdapter,
  EditorId,
} from "./types.js";
import { buildCommandMeta } from "./types.js";
import { preselectSignalFor } from "./declaration.js";
import {
  classifyAgentFile,
  installedAgentsSnapshotDir,
  normalizeEol,
  readAgentsManifest,
} from "./agents.js";

// ─── Registry ────────────────────────────────────────────────────────────

const ADAPTERS: EditorAdapter[] = [
  // Adapters are registered after const declarations at the bottom of this file.
];

/**
 * Which artifact style the installed CLI calls for: 2.x uses the
 * `openspec-*` family; 1.x, an unreadable version, and a missing CLI use
 * `opsx-*` (a project may be initialized before the CLI exists).
 */
export function resolveArtifactStyle(): ArtifactStyle {
  const status = openSpecCliStatus();
  return status.ok && status.major >= 2 ? "openspec" : "opsx";
}

export function getAdapter(
  id: EditorId,
  style: ArtifactStyle = resolveArtifactStyle(),
): EditorAdapter | undefined {
  return ADAPTERS.find((a) => a.id === id && a.style === style);
}

/** All registered editors of one naming style, regardless of detection. */
export function getAllAdapters(
  style: ArtifactStyle = resolveArtifactStyle(),
): EditorAdapter[] {
  return ADAPTERS.filter((a) => a.style === style);
}

export function detectAdapters(
  projectRoot: string,
  homeDir?: string,
  style: ArtifactStyle = resolveArtifactStyle(),
): EditorAdapter[] {
  return ADAPTERS.filter((a) => a.style === style && a.detect(projectRoot, homeDir));
}

/**
 * Project-scope detection: project-level signals only (no global config
 * dirs). This is the scope the init non-TTY fallback uses; write
 * authorization additionally requires tool-owned artifacts (see
 * hasCommandArtifacts).
 */
export function detectProjectAdapters(
  projectRoot: string,
  style: ArtifactStyle = resolveArtifactStyle(),
): EditorAdapter[] {
  return ADAPTERS.filter(
    (a) => a.style === style && a.projectSignal(projectRoot),
  );
}

/**
 * Interactive first-run pre-select set: project signals plus the adapter's
 * declared intent files. Never authorizes writes (see hasCommandArtifacts).
 */
export function preselectAdapters(
  projectRoot: string,
  style: ArtifactStyle = resolveArtifactStyle(),
): EditorAdapter[] {
  return ADAPTERS.filter(
    (a) =>
      a.style === style &&
      a.declaration !== undefined &&
      preselectSignalFor(projectRoot, a.declaration.detection),
  );
}

/**
 * True when any of the adapter's tool-owned command artifacts exist in the
 * project — the write-authorization signal ("existing artifacts are the
 * manifest"). Deliberately does NOT use detect(): a marker directory alone
 * (e.g. a hand-created `.cursor/` with the user's own config) does not
 * authorize openspec-pw writes.
 */
export function hasCommandArtifacts(
  projectRoot: string,
  adapter: EditorAdapter,
): boolean {
  const meta = buildCommandMeta("");
  // Shared artifacts (several adapters write the same shared skill) cannot
  // prove which editor installed them, so they confer no configured status
  // and no write authorization. The set comes from the adapter variant's own
  // style, not from the 1.x declaration.
  const shared = new Set(adapter.sharedArtifactPaths?.(meta) ?? []);
  const paths = listCommandArtifactPaths(adapter, meta).filter(
    (rel) => !shared.has(rel),
  );
  return paths.some((rel) => existsSync(pathResolve(projectRoot, rel)));
}

export function registerAdapter(adapter: EditorAdapter): void {
  ADAPTERS.push(adapter);
}

/**
 * Slash-command hint for user-facing messages. The form comes from the
 * adapter — colon for editors that load command files, hyphen for the
 * skill-based ones — so a new adapter cannot drift out of the hint.
 */
export function slashCommandForAdapter(adapter: EditorAdapter): string {
  if (adapter.invocationHint) {
    return adapter.invocationHint;
  }
  if (adapter.style === "openspec") {
    return "/openspec-e2e";
  }
  return adapter.commandForm === "colon" ? "/opsx:e2e" : "/opsx-e2e";
}

/**
 * Remove one editor's 1.x e2e artifacts when the 2.x install replaces them.
 * Only byte-identical (EOL-normalized) copies of this tool's 1.x render are
 * deleted — a user-edited file is kept and reported. Returns removed paths.
 */
export function migrateOldStyleArtifacts(
  adapter: EditorAdapter,
  projectRoot: string,
  meta: CommandMeta,
): string[] {
  if (adapter.style !== "openspec") return [];
  const old = getAdapter(adapter.id, "opsx");
  if (!old) return [];
  const expected = new Map<string, string>();
  expected.set(old.commandFilePath(meta.id), old.formatCommand(meta));
  for (const extra of old.extraArtifacts?.(meta) ?? []) {
    expected.set(extra.relativePath, extra.contents);
  }
  const removed: string[] = [];
  for (const [rel, contents] of expected) {
    const abs = pathResolve(projectRoot, rel);
    if (!existsSync(abs) || !isPathInsideProjectRoot(projectRoot, abs)) continue;
    if (normalizeEol(readFileSync(abs, "utf-8")) !== normalizeEol(contents)) {
      console.log(
        chalk.gray(
          `  - ${adapter.label}: ${rel} differs from this tool's 1.x output — kept`,
        ),
      );
      continue;
    }
    rmSync(abs);
    // Skill artifacts live alone in their own directory — drop it so the 1.x
    // name does not linger as an empty skill folder.
    const parent = dirname(abs);
    if (
      parent !== pathResolve(projectRoot) &&
      isPathInsideProjectRoot(projectRoot, parent) &&
      existsSync(parent) &&
      readdirSync(parent).length === 0
    ) {
      rmdirSync(parent);
    }
    console.log(chalk.green(`  ✓ ${adapter.label}: ${rel} migrated to the 2.x name`));
    removed.push(rel);
  }
  return removed;
}

/** Relative paths installCommand writes for this adapter + meta. */
export function listCommandArtifactPaths(
  adapter: EditorAdapter,
  meta: CommandMeta,
): string[] {
  const paths = [adapter.commandFilePath(meta.id)];
  for (const extra of adapter.extraArtifacts?.(meta) ?? []) {
    paths.push(extra.relativePath);
  }
  return paths;
}

/**
 * Relative paths of the adapter's consent-gated optional artifacts, empty
 * unless `install` consent is granted. Deliberately separate from
 * listCommandArtifactPaths — optional artifacts (vendored agents) confer no
 * write authorization and no configured status.
 */
export function listOptionalArtifactPaths(
  adapter: EditorAdapter,
  install: boolean,
): string[] {
  if (!install) return [];
  return (adapter.optionalArtifacts?.(true) ?? []).map((extra) => extra.relativePath);
}

/**
 * Write the adapter's consent-gated optional artifacts (vendored agents).
 * Ownership-aware: missing → write; tool-owned & current → no-op; tool-owned
 * & stale (older snapshot) → refresh; user-owned → never overwritten, yellow
 * notice instead. Consent is the caller's job — `install: true` runs writes.
 */
export function installOptionalArtifacts(
  adapter: EditorAdapter,
  projectRoot: string,
  install: boolean,
): void {
  if (!install) return;
  const extras = adapter.optionalArtifacts?.(true) ?? [];
  if (extras.length === 0) return;
  const manifest = readAgentsManifest(installedAgentsSnapshotDir());
  for (const extra of extras) {
    const absPath = pathResolve(projectRoot, extra.relativePath);
    if (!isPathInsideProjectRoot(projectRoot, absPath)) {
      console.log(
        chalk.gray(
          `  - ${adapter.label}: ${extra.relativePath} resolves outside the project (symlink) — skipping`,
        ),
      );
      continue;
    }
    if (existsSync(absPath) && manifest) {
      const state = classifyAgentFile(projectRoot, extra.relativePath, extra.contents, manifest);
      if (state === "modified") {
        console.log(
          chalk.yellow(
            `  ⚠ ${adapter.label}: ${extra.relativePath} differs from the bundled snapshot (manual edit or newer init-agents output) — left untouched`,
          ),
        );
        continue;
      }
      if (normalizeEol(readFileSync(absPath, "utf-8")) === normalizeEol(extra.contents)) {
        console.log(chalk.gray(`  - ${adapter.label}: ${extra.relativePath} already current`));
        continue;
      }
    }
    mkdirSync(dirname(absPath), { recursive: true });
    writeFileSync(absPath, extra.contents);
    console.log(chalk.green(`  ✓ ${adapter.label}: ${extra.relativePath}`));
  }
  console.log(
    chalk.gray(
      "  (official `playwright init-agents` claude-loop snapshot — provenance: templates/agents/SOURCE.md)",
    ),
  );
}

// ─── Install helpers ─────────────────────────────────────────────────────

/** Install the command file (and optional extraArtifacts) for one adapter. */
export function installCommand(
  adapter: EditorAdapter,
  meta: CommandMeta,
  projectRoot: string,
): void {
  const relPath = adapter.commandFilePath(meta.id);
  const absPath = pathResolve(projectRoot, relPath);
  // A symlinked parent (`./.roo` linked elsewhere) would write outside the
  // project even though the artifact path itself is lexical.
  if (!isPathInsideProjectRoot(projectRoot, absPath)) {
    console.log(
      chalk.gray(
        `  - ${adapter.label}: ${relPath} resolves outside the project (symlink) — skipping`,
      ),
    );
    return;
  }
  mkdirSync(dirname(absPath), { recursive: true });
  writeFileSync(absPath, adapter.formatCommand(meta));
  console.log(chalk.green(`  ✓ ${adapter.label}: ${relPath}`));

  for (const extra of adapter.extraArtifacts?.(meta) ?? []) {
    const extraAbs = pathResolve(projectRoot, extra.relativePath);
    if (!isPathInsideProjectRoot(projectRoot, extraAbs)) {
      console.log(
        chalk.gray(
          `  - ${adapter.label}: ${extra.relativePath} resolves outside the project (symlink) — skipping`,
        ),
      );
      continue;
    }
    mkdirSync(dirname(extraAbs), { recursive: true });
    writeFileSync(extraAbs, extra.contents);
    console.log(chalk.green(`  ✓ ${adapter.label}: ${extra.relativePath}`));
  }
}
