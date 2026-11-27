/**
 * Standards-profile prompt. Kept out of init.ts so that file stays under the
 * 1500-line cap; init owns the decision, this module owns the presentation.
 */
import type { StandardsProfile } from "../shared/index.js";

/**
 * Pick the standards variant to install. Pre-selects the profile already in
 * AGENTS.md so a rerun keeps it when the user just presses Enter.
 * Dynamically imports @inquirer/prompts so non-interactive runs never load it.
 */
export async function promptSelectStandardsProfile(
  installed: StandardsProfile | null,
): Promise<StandardsProfile> {
  const { select } = await import("@inquirer/prompts");
  return select<StandardsProfile>({
    message: "Select the standards profile",
    default: installed ?? "general",
    choices: [
      {
        name: "General — frontend, backend, and general codebases",
        value: "general",
        description: "The full §0–§7 employee-grade standards",
      },
      {
        name: "ML — training, evaluation, data, and experiment ledgers",
        value: "ml",
        description: "ML-specific rules, including large artifacts (§0–§8)",
      },
    ],
  });
}
