import { describe, expect, it } from "vitest";
import { readFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  LINT_GUIDELINE_RULES,
  LINT_GUIDELINES_CHECKSUM_PREFIX,
  LINT_GUIDELINES_RELPATH,
  computeChecklistChecksum,
  installOrRefreshChecklist,
  isChecklistUnmodified,
  removeChecklist,
} from "../../src/shared/lint-guidelines.js";

const template = readFileSync(
  join(import.meta.dirname, "..", "..", "templates", "lint-guidelines.md"),
  "utf-8",
);

describe("lint-guidelines checklist data ↔ template pairing", () => {
  it("template contains every rule id from the data source", () => {
    for (const rule of LINT_GUIDELINE_RULES) {
      expect(template.includes(`\`${rule.id}\``), `missing \`${rule.id}\``).toBe(
        true,
      );
    }
  });

  it("template checksum matches its body (tool-owned, refreshed safely)", () => {
    expect(isChecklistUnmodified(template)).toBe(true);
    const line = template
      .split("\n")
      .find((l) => l.startsWith(LINT_GUIDELINES_CHECKSUM_PREFIX));
    expect(line).toBeDefined();
    expect(line).toContain(computeChecklistChecksum(template));
  });

  it("default-state contract: only B904 is off by default, none is a hook entry", () => {
    const offByDefault = LINT_GUIDELINE_RULES.filter((r) => !r.defaultOn);
    expect(offByDefault.map((r) => r.id)).toEqual(["B904"]);
    for (const rule of LINT_GUIDELINE_RULES) {
      expect(["ESLint", "ruff", "pylint"]).toContain(rule.tool);
      // hook entries are banned — execution stays lint/CI/pre-commit
      expect(rule.tool.toLowerCase()).not.toContain("hook");
    }
  });

  it("no-empty boundary (comment exemption) is stated in the template", () => {
    expect(template).toMatch(/comment/i);
    expect(template).toMatch(/\.catch\(\(\) => null/);
  });
});

describe("lint-guidelines install / refresh (content-based ownership)", () => {
  const staleBody = template.replace("## Rules\n", "## Rules (old)\n");

  /** A checklist file whose checksum is valid for its (older) body = tool-owned. */
  function staleToolOwnedFixture(): string {
    const checksum = computeChecklistChecksum(staleBody);
    const line = `${LINT_GUIDELINES_CHECKSUM_PREFIX}${checksum} -->`;
    return staleBody.replace(
      /^<!-- openspec-pw: lint-guidelines [0-9a-f]{8} -->$/m,
      line,
    );
  }

  it("missing file → created with template content, bare temp root works (no scaffold)", () => {
    const root = mkdtempSync(join(tmpdir(), "ospw-lintguidelines-"));
    try {
      const disposition = installOrRefreshChecklist(root);
      expect(disposition).toBe("created");
      expect(readFileSync(join(root, LINT_GUIDELINES_RELPATH), "utf-8")).toBe(
        template,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("identical content → unchanged (idempotent second run)", () => {
    const root = mkdtempSync(join(tmpdir(), "ospw-lintguidelines-"));
    try {
      expect(installOrRefreshChecklist(root)).toBe("created");
      expect(installOrRefreshChecklist(root)).toBe("unchanged");
      expect(readFileSync(join(root, LINT_GUIDELINES_RELPATH), "utf-8")).toBe(
        template,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("tool-owned stale file (old checksum, never user-modified) → refreshed", () => {
    const root = mkdtempSync(join(tmpdir(), "ospw-lintguidelines-"));
    try {
      const stale = staleToolOwnedFixture();
      expect(isChecklistUnmodified(stale)).toBe(true);
      writeFileSync(join(root, LINT_GUIDELINES_RELPATH), stale);
      const disposition = installOrRefreshChecklist(root);
      expect(disposition).toBe("refreshed");
      expect(readFileSync(join(root, LINT_GUIDELINES_RELPATH), "utf-8")).toBe(
        template,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("user-modified file (checksum no longer matches body) → kept-modified, untouched", () => {
    const root = mkdtempSync(join(tmpdir(), "ospw-lintguidelines-"));
    try {
      const handEdited = template.replace("## Rules\n", "## My Rules\n");
      writeFileSync(join(root, LINT_GUIDELINES_RELPATH), handEdited);
      expect(isChecklistUnmodified(handEdited)).toBe(false);
      const disposition = installOrRefreshChecklist(root);
      expect(disposition).toBe("kept-modified");
      expect(readFileSync(join(root, LINT_GUIDELINES_RELPATH), "utf-8")).toBe(
        handEdited,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("stripped checksum line counts as user-modified → kept-modified", () => {
    const root = mkdtempSync(join(tmpdir(), "ospw-lintguidelines-"));
    try {
      const noChecksum = template.replace(
        /^<!-- openspec-pw: lint-guidelines [0-9a-f]{8} -->\n/m,
        "",
      );
      writeFileSync(join(root, LINT_GUIDELINES_RELPATH), noChecksum);
      expect(installOrRefreshChecklist(root)).toBe("kept-modified");
      expect(readFileSync(join(root, LINT_GUIDELINES_RELPATH), "utf-8")).toBe(
        noChecksum,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("lint-guidelines uninstall (content-based ownership)", () => {
  it("tool-owned checklist → removed", () => {
    const root = mkdtempSync(join(tmpdir(), "ospw-lintguidelines-rm-"));
    try {
      writeFileSync(join(root, LINT_GUIDELINES_RELPATH), template);
      expect(removeChecklist(root)).toBe("removed");
      expect(() =>
        readFileSync(join(root, LINT_GUIDELINES_RELPATH), "utf-8"),
      ).toThrow();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("user-modified checklist → kept as-is (content preserved)", () => {
    const root = mkdtempSync(join(tmpdir(), "ospw-lintguidelines-rm-"));
    try {
      const handEdited = template.replace("## Rules\n", "## My Rules\n");
      writeFileSync(join(root, LINT_GUIDELINES_RELPATH), handEdited);
      expect(removeChecklist(root)).toBe("kept-modified");
      expect(readFileSync(join(root, LINT_GUIDELINES_RELPATH), "utf-8")).toBe(
        handEdited,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("absent checklist → absent, no touch", () => {
    const root = mkdtempSync(join(tmpdir(), "ospw-lintguidelines-rm-"));
    try {
      expect(removeChecklist(root)).toBe("absent");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});