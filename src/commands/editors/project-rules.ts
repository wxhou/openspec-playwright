/**
 * Project rules file management: OPENSPEC marker blocks inside
 * AGENTS.md (single source of truth) and the thin CLAUDE.md wrapper for
 * Claude Code (@AGENTS.md import + CodeGraph-first guidance).
 */
import {
  existsSync,
  lstatSync,
  rmSync,
  readFileSync,
  writeFileSync,
} from "fs";
import { join, basename } from "path";
import chalk from "chalk";
import type { EditorAdapter } from "./types.js";
import { claudeAdapter } from "./adapters/claude.js";
import { opencodeAdapter, readOpenCodeInstructions } from "./adapters/opencode.js";

// ─── Project rules file (CLAUDE.md / AGENTS.md) ──────────────────────────

/**
 * Read the OPENSPEC marker block from a rules file, or `null` when the file
 * is missing / has no markers. Used by drift detection and update to decide
 * whether a rules file needs rewriting.
 */
export function readOpenSpecBlock(projectRoot: string, adapter: EditorAdapter): string | null {
  const dest = adapter.projectRulesPath(projectRoot);
  if (!existsSync(dest)) return null;
  const content = readFileSync(dest, "utf-8");
  const startIdx = content.indexOf("<!-- OPENSPEC:START -->");
  const endIdx = content.indexOf("<!-- OPENSPEC:END -->");
  if (startIdx === -1 || endIdx === -1) return null;
  return content.slice(startIdx + "<!-- OPENSPEC:START -->".length, endIdx).trim();
}

/**
 * Whether a rules file's OPENSPEC block matches the expected content.
 * A missing file or absent/truncated markers counts as "does not match"
 * (the caller will rewrite it), which keeps update idempotent but safe.
 */
export function blockMatchesExpected(
  projectRoot: string,
  adapter: EditorAdapter,
  expected: string,
): boolean {
  const block = readOpenSpecBlock(projectRoot, adapter);
  if (block === null) return false;
  return block === expected.trim();
}

/**
 * Install employee-grade standards into the editor's rules file
 * (CLAUDE.md for Claude, AGENTS.md for OpenCode, Cline, and Cursor). Wraps content in
 * `<!-- OPENSPEC:START -->` / `<!-- OPENSPEC:END -->` markers so future
 * updates can replace the block without touching the rest of the file.
 */
export function installOpenSpecBlock(
  projectRoot: string,
  standardsContent: string,
  adapter: EditorAdapter = claudeAdapter,
): void {
  const dest = adapter.projectRulesPath(projectRoot);
  const fileLabel = basename(dest);
  const markerStart = "<!-- OPENSPEC:START -->";
  const markerEnd = "<!-- OPENSPEC:END -->";

  if (!existsSync(dest)) {
    const projName = projectRoot.split("/").pop() ?? "Project";
    const content = `# ${projName}\n\n${markerStart}\n\n${standardsContent.trim()}\n\n${markerEnd}\n`;
    writeFileSync(dest, content);
    console.log(
      chalk.green(`  ✓ ${fileLabel}: created with employee-grade standards`),
    );
    return;
  }

  const existing = readFileSync(dest, "utf-8");
  const hasStart = existing.includes(markerStart);
  const hasEnd = existing.includes(markerEnd);

  if (hasStart && hasEnd) {
    const startIdx = existing.indexOf(markerStart);
    const endIdx = existing.indexOf(markerEnd) + markerEnd.length;
    const before = existing.slice(0, startIdx).trimEnd();
    const after = existing.slice(endIdx);
    const updated =
      before +
      "\n" +
      markerStart +
      "\n\n" +
      standardsContent.trim() +
      "\n\n" +
      markerEnd +
      after;
    writeFileSync(dest, updated);
    console.log(
      chalk.green(
        `  ✓ ${fileLabel}: updated employee-grade standards (markers preserved, content refreshed)`,
      ),
    );
  } else if (!hasStart && !hasEnd) {
    const updated =
      existing.trim() +
      "\n\n" +
      markerStart +
      "\n\n" +
      standardsContent.trim() +
      "\n\n" +
      markerEnd +
      "\n";
    writeFileSync(dest, updated);
    console.log(
      chalk.green(`  ✓ ${fileLabel}: appended employee-grade standards with markers`),
    );
  } else {
    // Incomplete markers (only START, or only END) — corrupted tool territory.
    // Keep everything before the first marker (user content), discard the
    // truncated tool output after it, and write a clean complete block so
    // `doctor`/`update` converge instead of dead-ending on a skipped file.
    const firstIdx = hasStart
      ? existing.indexOf(markerStart)
      : existing.indexOf(markerEnd);
    const header = existing.slice(0, firstIdx).trimEnd();
    const updated =
      header +
      "\n\n" +
      markerStart +
      "\n\n" +
      standardsContent.trim() +
      "\n\n" +
      markerEnd +
      "\n";
    writeFileSync(dest, updated);
    console.log(
      chalk.green(
        `  ✓ ${fileLabel}: repaired incomplete OPENSPEC markers with employee-grade standards`,
      ),
    );
  }
}

/**
 * CodeGraph-first guidance prepended to the Claude wrapper so the model sees
 * it in the main rules file instead of relying on the AGENTS.md import
 * (imported content ranks lower and is treated as optional by the model).
 */
const CODE_GRAPH_FIRST_BLOCK = `## CodeGraph 优先 🔴

有 \`.codegraph/\` 时：结构性任务（定义/调用链/影响面/流程）默认第一步用 \`codegraph_explore\`，直接用结果回答，别先 grep/read（仅字面文本、已打开文件、结果不足时补查）。不派子 agent 重建索引。无 \`.codegraph/\` 跳过。`;

/**
 * The expected OPENSPEC block content for a thin CLAUDE.md wrapper
 * (CodeGraph-first guidance + workflow hint + `@AGENTS.md` import). Exported
 * so drift detection / update can compare against it.
 *
 * The `@AGENTS.md` line is Claude Code's documented way to reuse AGENTS.md
 * inside CLAUDE.md — AGENTS.md is NOT read by default ("Claude Code reads
 * CLAUDE.md, not AGENTS.md"). Contract per
 * https://code.claude.com/docs/en/memory.md:
 * - Position is irrelevant — the doc says "@ ... anywhere in your CLAUDE.md"
 *   (examples even inline it mid-sentence or in a list item). The one real
 *   constraint: the `@` line must NOT sit inside a code span (backticks) or
 *   a fenced code block — the resolver skips those. This wrapper keeps the
 *   import at the end of the block as a bare line.
 * - The path resolves relative to the importing CLAUDE.md; import recursion
 *   is capped at 4 hops.
 * - Block-level HTML comments (`<!-- ... -->`) are stripped before context
 *   injection, so the OPENSPEC markers vanish while the live `@AGENTS.md`
 *   line inside them is still honored.
 */
export function claudeWrapperStandardsContent(): string {
  return `${CODE_GRAPH_FIRST_BLOCK}\n\n**工作流**：优先使用 OpenSpec 工作流（/opsx 命令），而非 plan mode。\n\n@AGENTS.md\n`;
}

/**
 * Install a thin CLAUDE.md that imports AGENTS.md.
 *
 * Uses the same OPENSPEC:START/END markers as the full standards block so
 * `cleanProjectRules` can remove it uniformly. The CodeGraph-first block is
 * written directly into CLAUDE.md (before the @AGENTS.md import) so Claude
 * Code picks it up without depending on the import.
 *
 * Also handles migration: if CLAUDE.md has an existing OPENSPEC:START block
 * (old format that wrote standards directly to CLAUDE.md), calling
 * `installOpenSpecBlock` replaces the content with the CodeGraph block +
 * `@AGENTS.md` import.
 */
export function installClaudeWrapper(projectRoot: string): void {
  const dest = join(projectRoot, "CLAUDE.md");

  // CLAUDE.md symlinked (typically → AGENTS.md, the officially documented
  // reuse pattern): AGENTS.md itself is what Claude Code reads, and
  // installProjectRules already keeps the full standards in it. Writing a
  // wrapper here would overwrite them through the symlink (and the wrapper's
  // @AGENTS.md import would self-reference). Skip instead.
  if (existsSync(dest)) {
    if (lstatSync(dest).isSymbolicLink()) {
      console.log(
        chalk.gray(
          "  - CLAUDE.md is a symlink to AGENTS.md — standards live there, no wrapper needed",
        ),
      );
      return;
    }
  }

  // No-op if our full wrapper (CodeGraph block + @AGENTS.md import) is already
  // in place — content-equal, so a user edit inside the markers is detected.
  // A bare @AGENTS.md without our markers (added by openspec CLI or the user)
  // is left untouched — but tell the user CodeGraph-first won't be written.
  if (existsSync(dest)) {
    const existing = readFileSync(dest, "utf-8");
    const hasMarkers = existing.includes("<!-- OPENSPEC:START -->");
    if (!hasMarkers && /^@AGENTS\.md\r?$/m.test(existing)) {
      console.log(
        chalk.yellow(
          "  ⚠ CLAUDE.md 是裸 @AGENTS.md 导入（无 OPENSPEC 标记），CodeGraph 优先约束未写入。如需启用：删除该行后重跑 openspec-pw update。",
        ),
      );
      return;
    }
    if (hasMarkers && blockMatchesExpected(projectRoot, claudeAdapter, claudeWrapperStandardsContent())) {
      return;
    }
  }

  // Delegate to installOpenSpecBlock which handles create/update/append
  // with OPENSPEC:START/END markers.
  installOpenSpecBlock(
    projectRoot,
    claudeWrapperStandardsContent(),
    claudeAdapter,
  );
}

/**
 * Route employee-grade standards into project rules files.
 *
 * AGENTS.md is always the single source of truth, regardless of which
 * editors are detected. If Claude is in use, a thin CLAUDE.md wrapper
 * with `@AGENTS.md` import is created so Claude loads AGENTS.md as
 * its project rules. Cline and Cursor auto-detect AGENTS.md natively — no
 * wrapper needed.
 */
export function installProjectRules(
  projectRoot: string,
  standardsContent: string,
  detected: EditorAdapter[],
): void {
  if (detected.length === 0) return;

  // AGENTS.md is always the single source of truth
  installOpenSpecBlock(projectRoot, standardsContent, opencodeAdapter);

  // Thin CLAUDE.md with @AGENTS.md import if Claude is in use
  if (detected.some((a) => a.id === "claude")) {
    installClaudeWrapper(projectRoot);
  }

  // Register AGENTS.md in opencode.json for OpenCode
  if (detected.some((a) => a.id === "opencode") && opencodeAdapter.registerInstructions) {
    const existing = readOpenCodeInstructions(projectRoot);
    const next = Array.from(new Set([...(existing ?? []), "AGENTS.md"]));
    opencodeAdapter.registerInstructions(projectRoot, next);
  }
}

/** Remove all OpenSpec marker blocks from AGENTS.md (always) and CLAUDE.md (for claude adapter). */
export function cleanProjectRules(adapter: EditorAdapter, projectRoot: string): void {
  // AGENTS.md always has the employee standards (SSOT)
  removeMarkersFromFile(join(projectRoot, "AGENTS.md"), "AGENTS.md");

  // CLAUDE.md may have the wrapper import if Claude is detected
  if (adapter.id === "claude") {
    removeMarkersFromFile(adapter.projectRulesPath(projectRoot), basename(adapter.projectRulesPath(projectRoot)));
  }
}

/** Remove OpenSpec marker blocks from a single file. Only edits within markers. */
function removeMarkersFromFile(dest: string, fileLabel: string): void {
  if (!existsSync(dest)) {
    console.log(chalk.gray(`  - ${fileLabel} not found, skipping`));
    return;
  }
  const existing = readFileSync(dest, "utf-8");

  if (!existing.includes("<!-- OPENSPEC:START -->")) {
    console.log(chalk.gray(`  - No OpenSpec markers found in ${fileLabel}`));
    return;
  }

  // Remove markers and their content, consuming surrounding whitespace.
  // Then collapse runs of 3+ blank lines to at most 2 for a clean result.
  let updated = existing.replace(
    /\s*<!-- OPENSPEC:START -->[\s\S]*?<!-- OPENSPEC:END -->\s*/g,
    "\n\n",
  ).replace(/\n{3,}/g, "\n\n").trim();

  // Delete empty file rather than leaving a ghost.
  if (updated === "") {
    rmSync(dest);
    console.log(chalk.green(`  ✓ Removed empty ${fileLabel}`));
    return;
  }

  writeFileSync(dest, updated + "\n");
  console.log(chalk.green(`  ✓ Removed OpenSpec markers from ${fileLabel}`));
}

/** Read the employee-grade standards source file (empty string if missing). */
export function readEmployeeStandards(srcPath: string): string {
  return existsSync(srcPath) ? readFileSync(srcPath, "utf-8") : "";
}
