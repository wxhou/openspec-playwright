import { describe, it, expect } from "vitest";
import {
  buildCustomizeChoices,
  describeGroupChoice,
  expandGroupSelection,
  groupGitignoreCandidates,
} from "../../src/commands/init-gitignore-prompt.js";
import { skippableManagedPaths } from "../../src/shared/gitignore-managed.js";

const groups = groupGitignoreCandidates(skippableManagedPaths());

describe("gitignore prompt grouping", () => {
  it("covers every candidate exactly once", () => {
    const all = groups.flatMap((g) => g.paths);
    expect(new Set(all).size).toBe(all.length);
    expect(new Set(all)).toEqual(new Set(skippableManagedPaths()));
  });

  it("puts an unregistered path into Other instead of dropping it", () => {
    const withNew = groupGitignoreCandidates([
      ...skippableManagedPaths(),
      "future/path",
    ]);
    const other = withNew.find((g) => g.label === "Other");
    expect(other?.paths).toEqual(["future/path"]);
  });

  it("keeps openspec/ in its own group", () => {
    const group = groups.find((g) => g.label === "OpenSpec artifacts");
    expect(group?.paths).toEqual(["openspec/"]);
  });

  it("ignores editor territories whole, keeping Roo/Trae files narrow", () => {
    const paths = skippableManagedPaths();
    for (const dir of [
      ".agents/",
      ".dsh/",
      ".gemini/",
      ".qwen/",
      ".kimi-code/",
      ".github/prompts/",
    ]) {
      expect(paths).toContain(dir);
    }
    for (const narrow of [
      ".agents/skills/opsx-e2e/",
      ".agents/skills/openspec-e2e/",
      ".dsh/skills/opsx-e2e/",
      ".dsh/skills/openspec-e2e/",
      ".gemini/commands/openspec-e2e.toml",
      ".qwen/commands/openspec-e2e.md",
      ".kimi-code/skills/openspec-e2e/",
      ".github/prompts/openspec-e2e.prompt.md",
    ]) {
      expect(paths).not.toContain(narrow);
    }
    expect(paths).toContain(".roo/commands/openspec-e2e.md");
    expect(paths).toContain(".trae/commands/openspec-e2e.md");
  });
});

describe("group selection expansion", () => {
  it("returns the paths of every checked group", () => {
    const expanded = expandGroupSelection(
      groups,
      groups.map((g) => g.label),
    );
    expect(new Set(expanded)).toEqual(new Set(skippableManagedPaths()));
  });

  it("drops a group's paths when it is unchecked", () => {
    const label = "Local data and credentials";
    const target = groups.find((g) => g.label === label);
    const picked = groups.map((g) => g.label).filter((l) => l !== label);
    const expanded = expandGroupSelection(groups, picked);
    expect(expanded).not.toContain(target?.paths[0]);
    expect(expanded).toContain("openspec/");
  });

  it("keeps nothing when every group is unchecked", () => {
    expect(expandGroupSelection(groups, [])).toEqual([]);
  });
});

describe("group row labels", () => {
  it("shows the count and up to two example paths", () => {
    expect(
      describeGroupChoice({ label: "OpenSpec artifacts", paths: ["openspec/"] }),
    ).toBe("OpenSpec artifacts (1 path — openspec)");
    expect(
      describeGroupChoice({ label: "M", paths: ["a", "b", "c"] }),
    ).toBe("M (3 paths — a, b…)");
  });
});

describe("customize prefill", () => {
  it("checks exactly the paths of the groups that stayed checked", () => {
    const kept = ["MCP config and settings"];
    const items = buildCustomizeChoices(groups, kept);
    const checked = items.filter((i) => i.checked).map((i) => i.value);
    const expected = groups.find((g) => g.label === kept[0])?.paths ?? [];
    expect(new Set(checked)).toEqual(new Set(expected));
  });

  it("covers every path once, in group order", () => {
    const items = buildCustomizeChoices(groups, []);
    expect(items.map((i) => i.value)).toEqual(groups.flatMap((g) => g.paths));
    expect(items.every((i) => !i.checked)).toBe(true);
  });
});
