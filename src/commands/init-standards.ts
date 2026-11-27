import { existsSync, readFileSync } from "fs";
import { join } from "path";
import {
  detectInstalledProfile,
  type StandardsProfile,
} from "../shared/index.js";
import { extractRuleBlockContent } from "../shared/drift.js";
import { promptSelectStandardsProfile } from "./init-standards-prompt.js";

export interface InitStandardsDeps {
  /**
   * Interactive answer seam; defaults to @inquirer/prompts select. Receives
   * the detected installed profile so a rerun defaults to keeping it.
   */
  profilePrompt?: (
    installed: StandardsProfile | null,
  ) => Promise<StandardsProfile>;
  /** True when a prompt may run (injected prompt or a real TTY). */
  interactive: boolean;
}

/**
 * Resolve the standards profile for init: explicit flag wins, then the
 * interactive answer, then the installed block, then `general`.
 * Returns `null` when the user cancelled the prompt.
 */
export async function resolveInitStandardsProfile(
  projectRoot: string,
  flag: string | undefined,
  deps: InitStandardsDeps,
): Promise<{ flag?: string } | null> {
  if (flag !== undefined) return { flag };
  if (!deps.interactive) return {};

  const agentsPath = join(projectRoot, "AGENTS.md");
  const installed = detectInstalledProfile(
    existsSync(agentsPath)
      ? extractRuleBlockContent(readFileSync(agentsPath, "utf-8"))
      : null,
  );
  const prompt = deps.profilePrompt ?? promptSelectStandardsProfile;
  try {
    return { flag: await prompt(installed) };
  } catch (err) {
    // Same ExitPromptError contract as init's editor prompt.
    if ((err as { name?: string } | null)?.name === "ExitPromptError") {
      return null;
    }
    throw err;
  }
}
