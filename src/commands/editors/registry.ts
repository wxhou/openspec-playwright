/**
 * Adapter registry: the ADAPTERS array plus lookup/detection/install
 * helpers. Adapters self-register on module load (each adapters/*.ts
 * calls registerAdapter); this module deliberately imports no adapter so
 * the dependency graph stays acyclic (adapters -> registry).
 *
 * Registration order is load order and MUST stay:
 *   claude, opencode, cline, cursor, pi, omp
 * (editors.ts re-exports the adapter modules in exactly that order;
 * tests/editors-tools.test.ts asserts it.)
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "fs";
import { dirname, resolve as pathResolve } from "path";
import chalk from "chalk";
import type { CommandMeta, EditorAdapter, EditorId } from "./types.js";
import { buildCommandMeta } from "./types.js";
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

export function getAdapter(id: EditorId): EditorAdapter | undefined {
  return ADAPTERS.find((a) => a.id === id);
}

/** All registered editors, regardless of detection. */
export function getAllAdapters(): EditorAdapter[] {
  return [...ADAPTERS];
}

export function detectAdapters(
  projectRoot: string,
  homeDir?: string,
): EditorAdapter[] {
  return ADAPTERS.filter((a) => a.detect(projectRoot, homeDir));
}

/**
 * Project-scope detection: project-level signals only (no global config
 * dirs). This is the scope the init non-TTY fallback uses; write
 * authorization additionally requires tool-owned artifacts (see
 * hasCommandArtifacts).
 */
export function detectProjectAdapters(projectRoot: string): EditorAdapter[] {
  return ADAPTERS.filter((a) => a.projectSignal!(projectRoot));
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
  const paths = listCommandArtifactPaths(adapter, buildCommandMeta(""));
  return paths.some((rel) => existsSync(pathResolve(projectRoot, rel)));
}

export function registerAdapter(adapter: EditorAdapter): void {
  ADAPTERS.push(adapter);
}

/** Slash-command hint for user-facing messages. */
export function slashCommandForAdapter(adapter: EditorAdapter): string {
  return adapter.id === "claude" ? "/opsx:e2e" : "/opsx-e2e";
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
  mkdirSync(dirname(absPath), { recursive: true });
  writeFileSync(absPath, adapter.formatCommand(meta));
  console.log(chalk.green(`  ✓ ${adapter.label}: ${relPath}`));

  for (const extra of adapter.extraArtifacts?.(meta) ?? []) {
    const extraAbs = pathResolve(projectRoot, extra.relativePath);
    mkdirSync(dirname(extraAbs), { recursive: true });
    writeFileSync(extraAbs, extra.contents);
    console.log(chalk.green(`  ✓ ${adapter.label}: ${extra.relativePath}`));
  }
}
