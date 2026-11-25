/**
 * Editor multi-select prompt: grouping by state and the inquirer call.
 * Kept out of init.ts so that file stays under the 1500-line cap; init owns
 * the decision, this module owns the presentation.
 */
import type { EditorAdapter, EditorId } from "./editors.js";

/**
 * Ordered buckets for the editor prompt: configured editors first, then
 * detected-but-not-configured, then the rest. Empty buckets are dropped so a
 * first-run project never shows an empty "Configured" section.
 */
export function groupEditorChoices(
  allEditors: readonly EditorAdapter[],
  configured: ReadonlySet<EditorId>,
  detected: ReadonlySet<EditorId>,
): { label: string; editors: EditorAdapter[] }[] {
  const rest = allEditors.filter((a) => !configured.has(a.id));
  return [
    {
      label: "Configured",
      editors: allEditors.filter((a) => configured.has(a.id)),
    },
    { label: "Detected", editors: rest.filter((a) => detected.has(a.id)) },
    { label: "Other", editors: rest.filter((a) => !detected.has(a.id)) },
  ]
    .filter((bucket) => bucket.editors.length > 0)
    .map((bucket) => ({
      label: `${bucket.label} (${bucket.editors.length})`,
      editors: bucket.editors,
    }));
}

/**
 * Interactive multi-select of all supported editors, pre-selecting the
 * editors passed in `preselected` and grouping them by state so the list
 * fits one screen. Dynamically imports @inquirer/prompts so non-interactive
 * runs never load it.
 */
export async function promptSelectEditors(
  allEditors: EditorAdapter[],
  preselected: ReadonlySet<EditorId>,
  configured: ReadonlySet<EditorId> = new Set(),
  detected: ReadonlySet<EditorId> = new Set(),
): Promise<EditorId[]> {
  const { checkbox, Separator } = await import("@inquirer/prompts");
  const choices = groupEditorChoices(allEditors, configured, detected).flatMap(
    (group, index) => [
      ...(index === 0 ? [] : [new Separator(" ")]),
      new Separator(group.label),
      ...group.editors.map((a) => ({
        name: a.displayName,
        value: a.id,
        checked: preselected.has(a.id),
      })),
    ],
  );
  const selected = await checkbox({
    message: "Select editors to configure",
    choices,
    pageSize: 20,
  });
  return selected as EditorId[];
}
