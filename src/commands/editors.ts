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
 * cline → cursor → pi → omp → codebuddy → minimax → dsh → gemini → qwen →
 * github-copilot → roocode → trae → codex → kimi), which
 * `resolveToolsArg("all")`, the interactive prompt order, and
 * tests/editors-tools.test.ts depend on.
 */

// Types & factory (zero internal deps)
export {
  type CommandMeta,
  buildCommandMeta,
  type EditorId,
  type ExtraArtifact,
  type EditorAdapter,
  type AdapterDeclaration,
  type ArtifactSpec,
  type ArtifactStyle,
  type ArtifactFrontmatter,
  type ArtifactNaming,
  type ArtifactRoot,
  type DetectionSpec,
  type McpSpec,
  type RulesSpec,
} from "./editors/types.js";

// Declarative adapter compiler (derives the runtime EditorAdapter surface)
export {
  defineAdapter,
  artifactRootHit,
  projectSignalFor,
  preselectSignalFor,
} from "./editors/declaration.js";

// Cross-editor shared helpers
export {
  escapeYamlValue,
  formatTagsArray,
  transformToHyphenCommands,
  transformToOpenSpecCommands,
  artifactName,
  formatArtifact,
  type McpStdioServer,
  type McpServersFile,
  readMcpServersFile,
  writeMcpServersFile,
  isMcpServerInFile,
  installMcpServerInFile,
  removeMcpServerFromFile,
} from "./editors/shared.js";

// Registry (lookup / detection / install helpers) — no adapter imports here
export {
  registerAdapter,
  resolveArtifactStyle,
  getAdapter,
  getAllAdapters,
  detectAdapters,
  detectProjectAdapters,
  preselectAdapters,
  hasCommandArtifacts,
  slashCommandForAdapter,
  listCommandArtifactPaths,
  migrateOldStyleArtifacts,
  listOptionalArtifactPaths,
  installCommand,
  installOptionalArtifacts,
} from "./editors/registry.js";

// Adapters — import order = registration order (do not reorder)
export {
  formatClaudeCommand,
  formatClaudeSkill,
  getClaudeCommandPath,
  getClaudeSkillPath,
  getClaudeSharedSkillPath,
  hasClaudeCode,
  claudeAdapter,
  claudeAdapter2,
} from "./editors/adapters/claude.js";
export {
  formatOpenCodeCommand,
  getOpenCodeCommandPath,
  getOpenCodeCommandPath2,
  hasOpenCode,
  opencodeAdapter,
  opencodeAdapter2,
  readOpenCodeInstructions,
} from "./editors/adapters/opencode.js";
export {
  formatClineCommand,
  getClineCommandPath,
  getClineCommandPath2,
  hasCline,
  clineAdapter,
  clineAdapter2,
} from "./editors/adapters/cline.js";
export {
  formatCursorCommand,
  getCursorCommandPath,
  getCursorCommandPath2,
  getCursorSkillPath,
  getCursorSkillPath2,
  formatCursorSkill,
  hasCursor,
  cursorAdapter,
  cursorAdapter2,
} from "./editors/adapters/cursor.js";
export {
  formatPiCommand,
  getPiCommandPath,
  getPiCommandPath2,
  hasPi,
  piAdapter,
  piAdapter2,
} from "./editors/adapters/pi.js";
export {
  formatOmpCommand,
  getOmpCommandPath,
  getOmpCommandPath2,
  hasOmp,
  ompAdapter,
  ompAdapter2,
} from "./editors/adapters/omp.js";
export {
  formatCodebuddyCommand,
  getCodebuddyCommandPath,
  getCodebuddyCommandPath2,
  hasCodebuddy,
  codebuddyAdapter,
  codebuddyAdapter2,
} from "./editors/adapters/codebuddy.js";
export {
  formatMinimaxSkill,
  getMinimaxSkillPath,
  getMinimaxSkillPath2,
  hasMinimax,
  hasMinimaxProjectSignal,
  minimaxAdapter,
  minimaxAdapter2,
  minimaxMcpPath,
} from "./editors/adapters/minimax.js";
export {
  formatDshSkill,
  getDshSkillPath,
  getDshSkillPath2,
  hasDsh,
  hasDshProjectSignal,
  dshAdapter,
  dshAdapter2,
} from "./editors/adapters/dsh.js";
export {
  formatGeminiCommand,
  getGeminiCommandPath,
  getGeminiCommandPath2,
  hasGemini,
  geminiAdapter,
  geminiAdapter2,
} from "./editors/adapters/gemini.js";
export {
  formatQwenCommand,
  getQwenCommandPath,
  getQwenCommandPath2,
  hasQwen,
  qwenAdapter,
  qwenAdapter2,
} from "./editors/adapters/qwen.js";
export {
  formatCopilotPrompt,
  getCopilotPromptPath,
  getCopilotPromptPath2,
  hasGithubCopilot,
  githubCopilotAdapter,
  githubCopilotAdapter2,
} from "./editors/adapters/github-copilot.js";
export {
  formatRooCodeCommand,
  getRooCodeCommandPath,
  getRooCodeCommandPath2,
  getRooCodeRulesPath,
  hasRooCode,
  roocodeAdapter,
  roocodeAdapter2,
} from "./editors/adapters/roocode.js";
export {
  formatTraeCommand,
  getTraeCommandPath,
  getTraeCommandPath2,
  getTraeRulesPath,
  hasTrae,
  traeAdapter,
  traeAdapter2,
} from "./editors/adapters/trae.js";
export {
  formatCodexSkill,
  getCodexSkillPath,
  getCodexSkillPath2,
  hasCodex,
  codexAdapter,
  codexAdapter2,
} from "./editors/adapters/codex.js";
export {
  formatKimiSkill,
  getKimiSkillPath,
  getKimiSkillPath2,
  hasKimi,
  kimiAdapter,
  kimiAdapter2,
} from "./editors/adapters/kimi.js";

// Tool selection (--tools flag parsing)
export { resolveToolsArg } from "./editors/tool-selection.js";

// Per-editor artifact removal (init deselect + remove cleanup)
export {
  OPENSPEC_PW_MCP_SERVERS,
  type AdapterArtifactInventory,
  enumerateAdapterArtifacts,
  isInventoryEmpty,
  retainedMcpConfigFiles,
  retainedCommandArtifactPaths,
  removeAdapterMcp,
  removeAdapterCommandArtifacts,
  removeOwnedVendoredAgents,
  removeWrapper,
  cleanupEmptyDirs,
} from "./editors/removal.js";

// Vendored Playwright agent snapshots (claude, init --agents)
export {
  VENDORED_AGENT_ROLES,
  vendoredAgentRelPath,
  vendoredAgentRelPaths,
  knownAgentRelPaths,
  type AgentsManifest,
  installedAgentsSnapshotDir,
  readAgentsManifest,
  loadAgentSnapshots,
  sha256Contents,
  roleForRelPath,
  classifyAgentFile,
  enumerateVendoredAgents,
  syncVendoredAgents,
} from "./editors/agents.js";

// Config-state predicates (init pre-select manifest)
export {
  isEditorConfigured,
  anyEditorConfigured,
  agentsFileHasMarkers,
} from "./editors/configured.js";

// Pre-select-only intent-file signals (first-run tier; never authorize writes)
export { intentFileEditors } from "./editors/preselect.js";

// Project rules file management (AGENTS.md SSOT + CLAUDE.md / CODEBUDDY.md wrappers)
export {
  readOpenSpecBlock,
  blockMatchesExpected,
  installOpenSpecBlock,
  claudeWrapperStandardsContent,
  installThinWrapper,
  installClaudeWrapper,
  installCodebuddyWrapper,
  installProjectRules,
  migrateLegacyMarkers,
  cleanProjectRules,
  removeMarkersFromFile,
  hasCleanableMarkers,
  agentsFileHasCleanableMarkers,
  readEmployeeStandards,
  hasRuleFileMarkers,
  rulesFileHasCleanableMarkers,
  wrapperRulesFile,
  fullRulesFile,
  removeFullRulesBlock,
  wrapperHasMarkers,
  wrapperLinksToAgents,
} from "./editors/project-rules.js";
export { normalizeEol } from "./editors/agents.js";
