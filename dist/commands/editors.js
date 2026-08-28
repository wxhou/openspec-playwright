/**
 * ─────────────────────────────────────────────────────────────────────────
 *  FACADE FILE — implementation lives in ./editors/*
 * ─────────────────────────────────────────────────────────────────────────
 * This file only re-exports the public API of the editor adapter layer so
 * every existing `import ... from ".../editors.js"` keeps working.
 *
 * Why a facade instead of letting callers import "./editors/index.js"?
 * Node ESM and TypeScript nodenext do NOT resolve directory indexes:
 * `"./editors.js"` with only `editors/index.ts` on disk fails (TS2307).
 * Keeping this thin file preserves zero-churn imports for all callers.
 *
 * Do NOT add logic here. Add implementations under ./editors/ and
 * re-export below.
 *
 * Re-export order matters for adapter self-registration: importing the
 * adapter modules loads them, and each calls `registerAdapter()` — the
 * order below fixes ADAPTERS registration order (claude → opencode →
 * cline → cursor → pi → omp → dsh), which `resolveToolsArg("all")`, the
 * interactive prompt order, and tests/editors-tools.test.ts depend on.
 */
// Types & factory (zero internal deps)
export { buildCommandMeta, defineAdapter, } from "./editors/types.js";
// Cross-editor shared helpers
export { escapeYamlValue, formatTagsArray, transformToHyphenCommands, readMcpServersFile, writeMcpServersFile, isMcpServerInFile, installMcpServerInFile, removeMcpServerFromFile, } from "./editors/shared.js";
// Registry (lookup / detection / install helpers) — no adapter imports here
export { registerAdapter, getAdapter, getAllAdapters, detectAdapters, detectProjectAdapters, hasCommandArtifacts, slashCommandForAdapter, listCommandArtifactPaths, installCommand, } from "./editors/registry.js";
// Adapters — import order = registration order (do not reorder)
export { formatClaudeCommand, getClaudeCommandPath, hasClaudeCode, claudeAdapter, } from "./editors/adapters/claude.js";
export { formatOpenCodeCommand, getOpenCodeCommandPath, hasOpenCode, opencodeAdapter, readOpenCodeInstructions, } from "./editors/adapters/opencode.js";
export { formatClineCommand, getClineCommandPath, hasCline, clineAdapter, } from "./editors/adapters/cline.js";
export { formatCursorCommand, getCursorCommandPath, getCursorSkillPath, formatCursorSkill, hasCursor, cursorAdapter, } from "./editors/adapters/cursor.js";
export { formatPiCommand, getPiCommandPath, hasPi, piAdapter, } from "./editors/adapters/pi.js";
export { formatOmpCommand, getOmpCommandPath, hasOmp, ompAdapter, } from "./editors/adapters/omp.js";
export { formatDshCommand, getDshCommandPath, hasDsh, dshAdapter, } from "./editors/adapters/dsh.js";
// Tool selection (--tools flag parsing)
export { resolveToolsArg } from "./editors/tool-selection.js";
// Project rules file management (AGENTS.md SSOT + CLAUDE.md wrapper)
export { readOpenSpecBlock, blockMatchesExpected, installOpenSpecBlock, claudeWrapperStandardsContent, installClaudeWrapper, installProjectRules, cleanProjectRules, readEmployeeStandards, } from "./editors/project-rules.js";
//# sourceMappingURL=editors.js.map