/**
 * Adapter registry: the ADAPTERS array plus lookup/detection/install
 * helpers. Adapters self-register on module load (each adapters/*.ts
 * calls registerAdapter); this module deliberately imports no adapter so
 * the dependency graph stays acyclic (adapters -> registry).
 *
 * Registration order is load order and MUST stay:
 *   claude, opencode, cline, cursor, pi, omp, dsh
 * (editors.ts re-exports the adapter modules in exactly that order;
 * tests/editors-tools.test.ts asserts it.)
 */
import { mkdirSync, writeFileSync } from "fs";
import { dirname, resolve as pathResolve } from "path";
import chalk from "chalk";
// ─── Registry ────────────────────────────────────────────────────────────
const ADAPTERS = [
// Adapters are registered after const declarations at the bottom of this file.
];
export function getAdapter(id) {
    return ADAPTERS.find((a) => a.id === id);
}
/** All registered editors, regardless of detection. */
export function getAllAdapters() {
    return [...ADAPTERS];
}
export function detectAdapters(projectRoot, homeDir) {
    return ADAPTERS.filter((a) => a.detect(projectRoot, homeDir));
}
export function registerAdapter(adapter) {
    ADAPTERS.push(adapter);
}
/** Slash-command hint for user-facing messages. */
export function slashCommandForAdapter(adapter) {
    return adapter.id === "claude" ? "/opsx:e2e" : "/opsx-e2e";
}
/** Relative paths installCommand writes for this adapter + meta. */
export function listCommandArtifactPaths(adapter, meta) {
    const paths = [adapter.commandFilePath(meta.id)];
    for (const extra of adapter.extraArtifacts?.(meta) ?? []) {
        paths.push(extra.relativePath);
    }
    return paths;
}
// ─── Install helpers ─────────────────────────────────────────────────────
/** Install the command file (and optional extraArtifacts) for one adapter. */
export function installCommand(adapter, meta, projectRoot) {
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
//# sourceMappingURL=registry.js.map