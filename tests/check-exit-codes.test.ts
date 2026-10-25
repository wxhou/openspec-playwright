import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  coverageExitCode,
  extractScenarioTitles,
  normalizeTitle,
  planCoverage,
} from "../src/commands/coverage.js";
import { auditExitCode } from "../src/commands/audit.js";

// Both commands default to report-only; `--fail-under` and `--gate` are the
// only things that turn them into checks, so the decision lives in a pure
// function that can be pinned without spawning a whole project.

describe("coverage --fail-under", () => {
  it("fails when coverage is below the threshold", () => {
    expect(coverageExitCode(62, "80")).toBe(1);
  });

  it("passes at or above the threshold", () => {
    expect(coverageExitCode(80, "80")).toBe(0);
    expect(coverageExitCode(95, "80")).toBe(0);
  });

  it("never fails without the flag", () => {
    expect(coverageExitCode(0)).toBe(0);
    expect(coverageExitCode(12)).toBe(0);
  });

  it("fails on a malformed threshold rather than silently passing", () => {
    expect(coverageExitCode(99, "eighty")).toBe(1);
  });
});

describe("audit --gate", () => {
  it("fails when issues exist and the flag is on", () => {
    expect(auditExitCode(3, true)).toBe(1);
  });

  it("passes when there are no issues", () => {
    expect(auditExitCode(0, true)).toBe(0);
  });

  it("stays report-only without the flag", () => {
    expect(auditExitCode(3, false)).toBe(0);
    expect(auditExitCode(3)).toBe(0);
  });
});

// The autonomous e2e mode replaces the human plan approval with this check, so
// it has to be exact enough to trust and forgiving enough to be usable.
describe("coverage --plan (plan gate)", () => {
  const scenarios = ["Search finds matches", "Empty query shows all"];

  it("passes when every scenario is planned", () => {
    const plan = `
# Test plan
1. Search finds matches — type a keyword, list filters
2. Empty query shows all — clear the box, full list returns
`;
    const { missing, covered } = planCoverage(scenarios, plan);
    expect(missing).toEqual([]);
    expect(covered).toHaveLength(2);
  });

  it("fails and names the scenario that is missing", () => {
    const plan = "1. Search finds matches — type a keyword";
    const { missing } = planCoverage(scenarios, plan);
    expect(missing).toEqual(["Empty query shows all"]);
  });

  it("matches across case, spacing and punctuation", () => {
    const plan = "### 1. SEARCH   finds-matches!\n- type a keyword\n### 2. empty query shows all.\n";
    expect(planCoverage(scenarios, plan).missing).toEqual([]);
  });

  it("matches Chinese titles written with different punctuation", () => {
    const zh = ["搜索返回匹配项", "空查询显示全部"];
    const plan = "用例一：搜索返回匹配项（输入关键字）\n用例二：空查询显示全部；";
    expect(planCoverage(zh, plan).missing).toEqual([]);
  });

  it("normalizes without dropping letters or digits", () => {
    expect(normalizeTitle("Search finds matches!")).toBe("searchfindsmatches");
    expect(normalizeTitle("搜索 返回、匹配项")).toBe("搜索返回匹配项");
  });

  it("extracts scenario titles from nested delta specs", () => {
    const root = mkdtempSync(join(tmpdir(), "plan-test-"));
    try {
      mkdirSync(join(root, "search"), { recursive: true });
      writeFileSync(
        join(root, "search", "spec.md"),
        "# Spec\n\n#### Scenario: Search finds matches\n- **WHEN** a\n\n#### Scenario: Empty query shows all\n- **THEN** b\n",
      );
      expect(extractScenarioTitles(root)).toEqual([
        "Search finds matches",
        "Empty query shows all",
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
