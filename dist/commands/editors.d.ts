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
 * cline → cursor → pi → omp), which `resolveToolsArg("all")`, the
 * interactive prompt order, and tests/editors-tools.test.ts depend on.
 */
export { type CommandMeta, buildCommandMeta, type EditorId, type ExtraArtifact, type EditorAdapter, type EditorAdapterInit, defineAdapter, } from "./editors/types.js";
export { escapeYamlValue, formatTagsArray, transformToHyphenCommands, type McpStdioServer, type McpServersFile, readMcpServersFile, writeMcpServersFile, isMcpServerInFile, installMcpServerInFile, removeMcpServerFromFile, } from "./editors/shared.js";
export { registerAdapter, getAdapter, getAllAdapters, detectAdapters, detectProjectAdapters, hasCommandArtifacts, slashCommandForAdapter, listCommandArtifactPaths, listOptionalArtifactPaths, installCommand, installOptionalArtifacts, } from "./editors/registry.js";
export { formatClaudeCommand, getClaudeCommandPath, hasClaudeCode, claudeAdapter, } from "./editors/adapters/claude.js";
export { formatOpenCodeCommand, getOpenCodeCommandPath, hasOpenCode, opencodeAdapter, readOpenCodeInstructions, } from "./editors/adapters/opencode.js";
export { formatClineCommand, getClineCommandPath, hasCline, clineAdapter, } from "./editors/adapters/cline.js";
export { formatCursorCommand, getCursorCommandPath, getCursorSkillPath, formatCursorSkill, hasCursor, cursorAdapter, } from "./editors/adapters/cursor.js";
export { formatPiCommand, getPiCommandPath, hasPi, piAdapter, } from "./editors/adapters/pi.js";
export { formatOmpCommand, getOmpCommandPath, hasOmp, ompAdapter, } from "./editors/adapters/omp.js";
export { resolveToolsArg } from "./editors/tool-selection.js";
export { OPENSPEC_PW_MCP_SERVERS, CLAUDE_LEGACY_SKILL_REL, type AdapterArtifactInventory, enumerateAdapterArtifacts, isInventoryEmpty, removeAdapterMcp, removeAdapterCommandArtifacts, removeOwnedVendoredAgents, removeClaudeLegacySkill, removeClaudeWrapper, cleanupEmptyDirs, } from "./editors/removal.js";
export { VENDORED_AGENT_ROLES, vendoredAgentRelPath, vendoredAgentRelPaths, type AgentsManifest, installedAgentsSnapshotDir, readAgentsManifest, loadAgentSnapshots, sha256Contents, roleForRelPath, classifyAgentFile, enumerateVendoredAgents, syncVendoredAgents, } from "./editors/agents.js";
export { isEditorConfigured, anyEditorConfigured, agentsFileHasMarkers, } from "./editors/configured.js";
export { intentFileEditors } from "./editors/preselect.js";
export { readOpenSpecBlock, blockMatchesExpected, installOpenSpecBlock, claudeWrapperStandardsContent, installClaudeWrapper, installProjectRules, migrateLegacyMarkers, cleanProjectRules, removeMarkersFromFile, readEmployeeStandards, } from "./editors/project-rules.js";
