import { describe, it, expect } from "vitest";
import {
  buildCustomizeChoices,
  describeGroupChoice,
  describeGroupPaths,
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

  it("puts an unregistered path into Uncategorized instead of dropping it", () => {
    const withNew = groupGitignoreCandidates([
      ...skippableManagedPaths(),
      "future/path",
    ]);
    const other = withNew.find((g) => g.label === "Uncategorized");
    expect(other?.paths).toEqual(["future/path"]);
  });

  it("groups AI tooling, tests, MCP, and other tools in that order", () => {
    expect(groups.map((g) => g.label)).toEqual([
      "AI coding assistants",
      "Test artifacts and credentials",
      "MCP config and settings",
      "Other tools and runtime files",
    ]);
    const other = groups.find((g) => g.label === "Other tools and runtime files");
    expect(other?.paths).toEqual(
      expect.arrayContaining([".codegraph/", "openspec/", "tmp/"]),
    );
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
    const label = "Test artifacts and credentials";
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

  it("drops examples when the row would overflow the terminal", () => {
    expect(
      describeGroupChoice({
        label: "Test artifacts and credentials",
        paths: [
          "playwright/.auth/",
          "tests/playwright/test-results/",
          "tests/playwright/credentials.yaml",
        ],
      }),
    ).toBe("Test artifacts and credentials (3 paths)");
  });
});

describe("group path preview", () => {
  it("lists every path, wrapped so no line exceeds the width", () => {
    const paths = groups.flatMap((g) => g.paths);
    const text = describeGroupPaths(paths, 40);

    expect(text.replace(/\n/g, ", ")).toBe(paths.join(", "));
    for (const line of text.split("\n")) {
      expect(line.length).toBeLessThanOrEqual(40);
    }
  });

  it("keeps a short group on one line", () => {
    expect(describeGroupPaths(["openspec/"])).toBe("openspec/");
  });
});

describe("customize prefill", () => {
  it("checks exactly the paths of the groups that stayed checked", () => {
    const kept = ["MCP config and settings"];
    const blocks = buildCustomizeChoices(groups, kept);

    expect(blocks.map((b) => b.label)).toEqual(groups.map((g) => g.label));
    const items = blocks.flatMap((b) => b.choices);
    const checked = items.filter((i) => i.checked).map((i) => i.value);
    const expected = groups.find((g) => g.label === kept[0])?.paths ?? [];
    expect(new Set(checked)).toEqual(new Set(expected));
  });

  it("covers every path once, in group order", () => {
    const items = buildCustomizeChoices(groups, []).flatMap((b) => b.choices);

    expect(items.map((i) => i.value)).toEqual(groups.flatMap((g) => g.paths));
    expect(items.every((i) => !i.checked)).toBe(true);
  });
});
