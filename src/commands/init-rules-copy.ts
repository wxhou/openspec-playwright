import { existsSync } from "fs";
import {
  cleanProjectRules,
  fullRulesFile,
  getAllAdapters,
  wrapperRulesFile,
} from "./editors.js";
import type { EditorAdapter } from "./editors.js";
import {
  RULE_COPY_GITIGNORE_PATHS,
  managedPathFor,
  readManagedSkipsSafe,
} from "../shared/index.js";

/** The per-editor rules file a rule-copy decision applies to, if any. */
function carrierRulesFile(
  adapter: EditorAdapter,
  projectRoot: string,
): string | null {
  return (
    fullRulesFile(adapter, projectRoot) ?? wrapperRulesFile(adapter, projectRoot)
  );
}

/**
 * Per-adapter rule-copy decision: `--no-rule-files` opts every adapter out,
 * `--rule-files` opts in, and the default follows the skip record written by
 * an earlier opt-out run.
 */
export function ruleCopyPredicate(
  ruleFiles: boolean | undefined,
  projectRoot: string,
): (adapter: EditorAdapter) => boolean {
  if (ruleFiles === false) return () => true;
  if (ruleFiles === true) return () => false;
  const recorded = new Set(readManagedSkipsSafe(projectRoot));
  const carriers = new Set<string>(RULE_COPY_GITIGNORE_PATHS);
  return (adapter) => {
    const file = carrierRulesFile(adapter, projectRoot);
    if (!file) return false;
    const rel = managedPathFor(projectRoot, file);
    return recorded.has(rel) && carriers.has(rel);
  };
}

/**
 * Remove existing per-editor rules copies when the opt-out is in force.
 * Absent carriers stay silent; symlinked files are left alone by
 * cleanProjectRules, and AGENTS.md is never touched.
 */
export function cleanOptedOutCopies(projectRoot: string): void {
  for (const adapter of getAllAdapters()) {
    const file = carrierRulesFile(adapter, projectRoot);
    if (!file || !existsSync(file)) continue;
    cleanProjectRules(adapter, projectRoot, { agents: false });
  }
}
