import { describe, it, expect } from "vitest";
import { groupEditorChoices } from "../../src/commands/init.js";
import { getAllAdapters } from "../../src/commands/editors/registry.js";

const all = getAllAdapters();

describe("editor prompt grouping", () => {
  it("orders configured, then detected, then the rest", () => {
    const [first, second] = all;
    const groups = groupEditorChoices(
      all,
      new Set([first.id]),
      new Set([second.id]),
    );

    expect(groups.map((g) => g.label)).toEqual([
      "Configured (1)",
      "Detected (1)",
      `Other (${all.length - 2})`,
    ]);
    expect(groups[0].editors[0].id).toBe(first.id);
    expect(groups[1].editors[0].id).toBe(second.id);
  });

  it("covers every editor exactly once", () => {
    const groups = groupEditorChoices(
      all,
      new Set([all[0].id]),
      new Set([all[0].id, all[1].id]),
    );
    const ids = groups.flatMap((g) => g.editors.map((a) => a.id));

    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(ids)).toEqual(new Set(all.map((a) => a.id)));
    // Configured wins over detected: no duplicate row in the Detected bucket.
    expect(groups[0].editors.map((a) => a.id)).toEqual([all[0].id]);
  });

  it("drops empty buckets on a first run", () => {
    const groups = groupEditorChoices(all, new Set(), new Set());

    expect(groups).toEqual([{ label: `Other (${all.length})`, editors: all }]);
  });
});
