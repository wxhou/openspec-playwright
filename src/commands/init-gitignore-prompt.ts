/**
 * `.gitignore` opt-out prompt: grouping of managed paths and the two-level
 * interactive select. Kept out of init.ts so that file stays under the
 * 1500-line cap; init owns the decision, this module owns the presentation.
 */

/**
 * Grouping for the .gitignore opt-out prompt. A path missing here lands in
 * "Uncategorized" rather than disappearing, so a newly managed path still
 * reaches the prompt without a second edit.
 */
const GITIGNORE_GROUPS: readonly {
  label: string;
  paths: readonly string[];
}[] = [
  {
    label: "AI coding assistants",
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
    label: "Test artifacts and credentials",
    paths: [
      "playwright/.auth/",
      "tests/playwright/test-results/",
      "tests/playwright/screenshots/",
      "tests/playwright/credentials.yaml",
      "tests/playwright/credentials.yaml.bak",
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
    label: "Other tools and runtime files",
    paths: [
      ".codegraph/",
      ".playwright-mcp/",
      "openspec/",
      "app-exploration.md",
      "tmp/",
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
  if (rest.length > 0) groups.push({ label: "Uncategorized", paths: rest });
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
 * Returns one block per group — the caller renders each block under its own
 * separator, so no parallel index bookkeeping can misalign.
 */
export function buildCustomizeChoices(
  groups: readonly { label: string; paths: readonly string[] }[],
  keptLabels: readonly string[],
): {
  label: string;
  choices: { name: string; value: string; checked: boolean }[];
}[] {
  const kept = new Set(keptLabels);
  return groups.map((g) => ({
    label: g.label,
    choices: g.paths.map((p) => ({
      name: p,
      value: p,
      checked: kept.has(g.label),
    })),
  }));
}

/** Sentinel for the customize row; cannot collide with a group label. */
const CUSTOMIZE = "\u0000customize";

/**
 * Full path list for the focused group's description. Explicit newlines keep
 * the prompt's line accounting correct — one soft-wrapped line would leave
 * stale rows on redraw.
 */
export function describeGroupPaths(
  paths: readonly string[],
  maxWidth = 72,
): string {
  const lines: string[] = [];
  let line = "";
  for (const path of paths) {
    const next = line === "" ? path : `${line}, ${path}`;
    if (line !== "" && next.length > maxWidth) {
      lines.push(line);
      line = path;
    } else {
      line = next;
    }
  }
  if (line !== "") lines.push(line);
  return lines.join("\n");
}

/**
 * Group row label: path count plus two examples so the row explains itself.
 * Falls back to the count alone when examples would overflow the terminal —
 * the description below still lists every path.
 */
export function describeGroupChoice(
  group: {
    label: string;
    paths: readonly string[];
  },
  maxWidth = 72,
): string {
  const count = group.paths.length;
  const noun = count === 1 ? "path" : "paths";
  const base = `${group.label} (${count} ${noun})`;
  const examples = group.paths.slice(0, 2).map((p) => p.replace(/\/$/, ""));
  const more = count > examples.length ? "…" : "";
  const detailed = `${base.slice(0, -1)} — ${examples.join(", ")}${more})`;
  return detailed.length <= maxWidth ? detailed : base;
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
        description: describeGroupPaths(g.paths),
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
  const choices = buildCustomizeChoices(groups, keptLabels).flatMap((block) => [
    new Separator(block.label),
    ...block.choices,
  ]);
  return (await checkbox({ message: MESSAGE, choices, pageSize: 20 })) as string[];
}
