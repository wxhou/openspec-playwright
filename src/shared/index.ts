export { SHARED_FILE_NAMES, TIMEOUT } from "./constants.js";
export {
  removeMcp,
  removePlaywrightMcp,
  TEST_RUNNER_MCP_SERVER,
  isTestRunnerMcpInstalled,
  ensureTestRunnerMcp,
  removeTestRunnerMcp,
} from "./mcp.js";
export {
  LINT_GUIDELINE_RULES,
  LINT_GUIDELINES_RELPATH,
  computeChecklistChecksum,
  isChecklistUnmodified,
  installOrRefreshChecklist,
  removeChecklist,
  LINT_ESLINT_CONFIG_FILE,
  LINT_ESLINT_GENERATED_MARKER,
  LINT_ESLINT_SNIPPET,
  LINT_RUFF_BLOCK_BEGIN,
  LINT_RUFF_BLOCK_END,
  ESLINT_CONFIG_FILENAMES,
  buildRuffManagedBlock,
  findRuffManagedBlock,
  hasRuffLintTable,
  hasDedicatedRuffLintTable,
  findEslintConfig,
  findRuffConfig,
  findSourceFile,
  eslintMajorFromSpec,
  installLintConfig,
  buildGeneratedEslintConfig,
  generatedEslintConfigVariants,
  isToolGeneratedEslintConfig,
  removeGeneratedEslintConfig,
  removeRuffManagedBlock,
  isToolOwnedRuffBlock,
  type EslintConfigRemovalStatus,
  type RuffBlockRemovalStatus,
  type ChecklistDisposition,
  type ChecklistRemovalDisposition,
  type LintRuleEntry,
  type RuffTableHeader,
  type FoundLintConfig,
  type LintConfigAction,
  type LintConfigResult,
} from "./lint-guidelines.js";
export { detectCodeGraphStatus, codegraphHintLines } from "./codegraph.js";
export type { CodeGraphStatus } from "./codegraph.js";
export {
  detectAppServer,
  findNpmRoot,
  chooseDevScript,
  parsePort,
  hasFrontendSignal,
  explainFrontendSignal,
  detectMiniProgramSignal,
  hasMiniProgramSignal,
  configHasWxaProject,
  resolveTemplateTarget,
  resolveProjectTarget,
} from "./app-detect.js";
export type { AppServerDetection, MiniProgramSignal, TemplateTarget } from "./app-detect.js";
export {
  resolveWxaProject,
  resolvePageManifest,
  resolveBuildScript,
  resolveBuildCommand,
} from "./miniprogram.js";
export type { WxaProjectResolution, PageManifest } from "./miniprogram.js";
export { renderWorkflowTemplate } from "./workflow-render.js";
export type { WorkflowRenderOptions } from "./workflow-render.js";
export {
  detectInstalledLanguage,
  detectSystemLanguage,
  missingEnglishSections,
  resolveStandardsLanguage,
  validateLanguageFlag,
} from "./standards-language.js";
export type { StandardsLanguage } from "./standards-language.js";
export {
  CREDENTIALS_RELPATHS,
  credentialsIgnoreHint,
  findUnignoredFiles,
} from "./ignore-check.js";
export {
  MANAGED_GITIGNORE_PATHS,
  LOCKED_GITIGNORE_PATHS,
  skippableManagedPaths,
  readManagedSkips,
  GITIGNORE_BLOCK_BEGIN,
  GITIGNORE_BLOCK_END,
  findUncoveredManagedPaths,
  ensureGitignoreEntries,
  removeManagedBlock,
  detectTrackedFiles,
  isIgnoredPath,
  managedBlockAdvisoryHint,
} from "./gitignore-managed.js";
