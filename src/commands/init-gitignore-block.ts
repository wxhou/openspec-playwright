import chalk from "chalk";
import {
  RULE_COPY_GITIGNORE_PATHS,
  detectTrackedFiles,
  ensureGitignoreEntries,
  findUncoveredManagedPaths,
  managedBlockAdvisoryHint,
  readManagedSkips,
} from "../shared/index.js";

/**
 * Maintain the managed `.gitignore` block for one init run: merge the
 * interactive selection with recorded skips and the rule-copy decision, write
 * the block, then degrade to advisories when it cannot be written and warn
 * about already-tracked paths. Lines outside the block are never touched.
 */
export function maintainManagedGitignore(options: {
  projectRoot: string;
  selectedPaths: string[] | undefined;
  candidates: string[];
  omit: string[];
  ruleFiles: boolean | undefined;
}): boolean {
  const { projectRoot, selectedPaths, candidates, omit, ruleFiles } = options;
  let skippedPaths: string[] = [];
  // Callers that promise protection in a user-facing message need to know
  // whether the write actually happened; the catch below only warns.
  let applied = true;
  try {
    // Not asking ≠ "ignore everything again": a non-interactive run keeps
    // the opt-outs an earlier interactive run recorded, exactly like update.
    // Recorded paths outside the candidate set (openspec/ while the pipeline
    // owns it) stay recorded.
    const recordedSkips = readManagedSkips(projectRoot);
    skippedPaths =
      selectedPaths === undefined
        ? recordedSkips
        : [
            ...new Set([
              ...recordedSkips.filter((p) => !candidates.includes(p)),
              ...candidates.filter((p) => !selectedPaths.includes(p)),
            ]),
          ];
    // Rule-copy opt-out shares the skip record: carrier paths leave the
    // managed block (a user-owned same-name file must stay committable) and
    // drive the install/cleanup decision.
    if (ruleFiles === false) {
      skippedPaths = [
        ...new Set([...skippedPaths, ...RULE_COPY_GITIGNORE_PATHS]),
      ];
    } else if (ruleFiles === true) {
      const carriers = new Set<string>(RULE_COPY_GITIGNORE_PATHS);
      skippedPaths = skippedPaths.filter((p) => !carriers.has(p));
    }
    const result = ensureGitignoreEntries(projectRoot, {
      omit,
      skip: skippedPaths,
    });
    if (result.changed) {
      const delta = [
        result.added.length ? `+${result.added.length}` : "",
        result.removed.length + result.pruned.length
          ? `-${result.removed.length + result.pruned.length}`
          : "",
      ]
        .filter(Boolean)
        .join(" ");
      console.log(
        chalk.green(`  ✓ .gitignore: managed block updated (${delta})`),
      );
    }
    if (result.removed.length > 0) {
      console.log(
        chalk.gray(`    kept committable: ${result.removed.join(", ")}`),
      );
    }
  } catch {
    applied = false;
    const uncovered = findUncoveredManagedPaths(projectRoot, [
      ...omit,
      ...skippedPaths,
    ]);
    if (uncovered.length > 0) {
      console.log(chalk.yellow(`\n  ⚠ ${managedBlockAdvisoryHint(uncovered)}`));
    }
    if (ruleFiles === false) {
      console.log(
        chalk.yellow(
          "\n  ⚠ The rule-copy opt-out could not be recorded — this run still skips" +
            ' the copies, but a later "openspec-pw update" may recreate them.' +
            " Fix .gitignore, then re-run with --no-rule-files.",
        ),
      );
    } else if (ruleFiles === true) {
      console.log(
        chalk.yellow(
          "\n  ⚠ The rule-copy restoration could not be recorded — the copies were" +
            ' written, but the stale skip record keeps "openspec-pw update" from' +
            " refreshing them. Fix .gitignore, then re-run with --rule-files.",
        ),
      );
    }
  }
  const tracked = detectTrackedFiles(projectRoot, [...omit, ...skippedPaths]);
  if (tracked.length > 0) {
    console.log(
      chalk.yellow(
        `\n  ⚠ These generated files/dirs are already git-tracked — ignore rules do NOT apply to them:` +
          `\n    ${tracked.join("\n    ")}` +
          `\n    Fix: git rm -r --cached <path> (then commit to share with your team)`,
      ),
    );
  }
  return applied;
}
