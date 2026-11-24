/**
 * `.gitignore` opt-out prompt: grouping of managed paths and the two-level
 * interactive select. Kept out of init.ts so that file stays under the
 * 1500-line cap; init owns the decision, this module owns the presentation.
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
    label: "Local data and credentials",
    paths: [
      "app-exploration.md",
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
  {
    label: "Editor commands and directories",
    paths: [
      ".claude/",
      ".cursor/",
      ".opencode/",
      ".cline/",
      ".pi/",
      ".omp/",
      ".codebuddy/",
      ".agents/",
      ".dsh/",
      ".gemini/",
      ".qwen/",
      ".kimi-code/",
      ".github/prompts/",
      ".roo/commands/opsx-e2e.md",
      ".roo/commands/openspec-e2e.md",
      ".trae/commands/opsx-e2e.md",
      ".trae/commands/openspec-e2e.md",
    ],
  },
  {
    label: "MCP config and settings",
    paths: [
      "opencode.json",
      "opencode.jsonc",
      ".mcp.json",
      ".roo/mcp.json",
      ".trae/mcp.json",
    ],
  },
  {
    label: "OpenSpec artifacts",
    paths: ["openspec/"],
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

/** Paths that stay ignored when `picked` groups stay checked. */
export function expandGroupSelection(
  groups: readonly { label: string; paths: readonly string[] }[],
  picked: readonly string[],
): string[] {
  const kept = new Set(picked);
  return groups.filter((g) => kept.has(g.label)).flatMap((g) => [...g.paths]);
}

/**
 * Prefill for the per-path list reached from the customize row: a path stays
 * checked when its group stayed checked, so the two levels cannot disagree.
 */
export function buildCustomizeChoices(
  groups: readonly { label: string; paths: readonly string[] }[],
  keptLabels: readonly string[],
): { name: string; value: string; checked: boolean }[] {
  const kept = new Set(keptLabels);
  return groups.flatMap((g) =>
    g.paths.map((p) => ({ name: p, value: p, checked: kept.has(g.label) })),
  );
}

/** Sentinel for the customize row; cannot collide with a group label. */
const CUSTOMIZE = "\u0000customize";

/** Group row label: path count plus two examples so the row explains itself. */
export function describeGroupChoice(group: {
  label: string;
  paths: readonly string[];
}): string {
  const count = group.paths.length;
  const noun = count === 1 ? "path" : "paths";
  const examples = group.paths.slice(0, 2).map((p) => p.replace(/\/$/, ""));
  const more = count > examples.length ? "…" : "";
  return `${group.label} (${count} ${noun} — ${examples.join(", ")}${more})`;
}

const MESSAGE = "Generated paths to keep out of git (uncheck to commit)";

/**
 * Group rows first (all checked, so Enter keeps the previous behavior), then
 * a customize row that opens the per-path list. Unchecking a group commits
 * every path in it.
 */
export async function promptSelectGitignorePaths(
  groups: readonly { label: string; paths: readonly string[] }[],
): Promise<string[]> {
  const { checkbox, Separator } = await import("@inquirer/prompts");
  const picked = (await checkbox({
    message: MESSAGE,
    choices: [
      ...groups.map((g) => ({
        name: describeGroupChoice(g),
        value: g.label,
        checked: true,
      })),
      new Separator(" "),
      { name: "Customize individual paths…", value: CUSTOMIZE, checked: false },
    ],
    pageSize: groups.length + 2,
  })) as string[];

  if (!picked.includes(CUSTOMIZE)) return expandGroupSelection(groups, picked);

  const keptLabels = groups
    .filter((g) => picked.includes(g.label))
    .map((g) => g.label);
  const items = buildCustomizeChoices(groups, keptLabels);
  let cursor = 0;
  const choices = groups.flatMap((g) => {
    const block = items.slice(cursor, cursor + g.paths.length);
    cursor += g.paths.length;
    return [new Separator(g.label), ...block];
  });
  return (await checkbox({ message: MESSAGE, choices, pageSize: 20 })) as string[];
}
