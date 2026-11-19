/**
 * `.gitignore` opt-out prompt: grouping of managed paths and the interactive
 * multi-select. Kept out of init.ts so that file stays under the 1500-line
 * cap; init owns the decision, this module owns the presentation.
 */

/**
 * Grouping for the .gitignore opt-out prompt. A path missing here lands in
 * "Other" rather than disappearing, so a newly managed path still reaches
 * the prompt without a second edit.
 */
const GITIGNORE_GROUPS: readonly {
  label: string;
  paths: readonly string[];
}[] = [
  {
    label: "Editor directories",
    paths: [
      ".claude/",
      ".cursor/",
      ".opencode/",
      ".cline/",
      ".pi/",
      ".omp/",
      ".codebuddy/",
      ".agents/skills/opsx-e2e/",
      ".dsh/skills/opsx-e2e/",
      ".gemini/commands/opsx/e2e.toml",
      ".qwen/commands/opsx-e2e.md",
      ".github/prompts/opsx-e2e.prompt.md",
      ".roo/commands/opsx-e2e.md",
      ".trae/commands/opsx-e2e.md",
      ".kimi-code/skills/opsx-e2e/",
    ],
  },
  {
    label: "Project files",
    paths: [
      "openspec/",
      "CODEBUDDY.md",
      "GEMINI.md",
      "QWEN.md",
      ".github/copilot-instructions.md",
      ".roo/rules/openspec-pw.md",
      ".trae/rules/project_rules.md",
      "app-exploration.md",
      "opencode.json",
      ".mcp.json",
      ".gemini/settings.json",
      ".qwen/settings.json",
      ".roo/mcp.json",
      ".trae/mcp.json",
      ".kimi-code/mcp.json",
    ],
  },
  {
    label: "Local data and credentials",
    paths: [
      ".codegraph/",
      ".playwright-mcp/",
      "tmp/",
      "playwright/.auth/",
      "tests/playwright/test-results/",
      "tests/playwright/screenshots/",
      "tests/playwright/credentials.yaml",
      "tests/playwright/credentials.yaml.bak",
    ],
  },
];

export function groupGitignoreCandidates(
  candidates: readonly string[],
): { label: string; paths: string[] }[] {
  const known = new Set(GITIGNORE_GROUPS.flatMap((g) => g.paths));
  const groups = GITIGNORE_GROUPS.map((g) => ({
    label: g.label,
    paths: candidates.filter((p) => g.paths.includes(p)),
  })).filter((g) => g.paths.length > 0);
  const rest = candidates.filter((p) => !known.has(p));
  if (rest.length > 0) groups.push({ label: "Other", paths: rest });
  return groups;
}

/**
 * Multi-select of managed paths that stay ignored — all checked, so Enter
 * keeps the previous behavior; unchecking records the path as a skip in the
 * block header.
 */
export async function promptSelectGitignorePaths(
  groups: readonly { label: string; paths: readonly string[] }[],
): Promise<string[]> {
  const { checkbox, Separator } = await import("@inquirer/prompts");
  const choices = groups.flatMap((g, index) => [
    ...(index === 0 ? [] : [new Separator(" ")]),
    new Separator(g.label),
    ...g.paths.map((p) => ({ name: p, value: p, checked: true })),
  ]);
  const selected = await checkbox({
    message: "Generated paths to keep out of git (uncheck to commit)",
    choices,
    pageSize: 20,
  });
  return selected as string[];
}
