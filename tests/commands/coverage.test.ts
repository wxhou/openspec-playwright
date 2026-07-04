import { describe, it, expect, vi, beforeEach } from "vitest";
import { existsSync } from "fs";

vi.mock("child_process", () => ({
  execFileSync: vi.fn(),
}));

vi.mock("fs", () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  readdirSync: vi.fn(),
}));

import { readFileSync, readdirSync } from "fs";

// ─── Helpers ──────────────────────────────────────────────────────────

async function importCoverage() {
  return import("../../src/commands/coverage.js");
}

function dirent(name: string, isDir: boolean) {
  return { name, isDirectory: () => isDir } as unknown as ReturnType<typeof readdirSync>[number];
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── parseScenarios ──────────────────────────────────────────────────

describe("parseScenarios", () => {
  it("extracts scenario names from markdown content", async () => {
    const { parseScenarios } = await importCoverage();
    const md = [
      "## Some section",
      "",
      "#### Scenario: User can log in",
      "Given the user is on the login page",
      "When they enter valid credentials",
      "Then they should be redirected to /dashboard",
      "",
      "#### Scenario: User can log out @auth",
      "Given the user is logged in",
      "When they click logout",
      "Then they should be redirected to /login",
    ].join("\n");
    vi.mocked(readFileSync).mockReturnValue(md);

    const scenarios = parseScenarios("/fake/spec.md");
    expect(scenarios).toHaveLength(2);
    expect(scenarios[0].name).toBe("User can log in");
    expect(scenarios[1].name).toBe("User can log out");
  });

  it("extracts @tags from scenario description", async () => {
    const { parseScenarios } = await importCoverage();
    const md = "#### Scenario: Authenticated access @auth @secure\nShould verify login first\n";
    vi.mocked(readFileSync).mockReturnValue(md);

    const scenarios = parseScenarios("/fake/spec.md");
    expect(scenarios[0].tags).toContain("@auth");
    expect(scenarios[0].tags).toContain("@secure");
  });

  it("returns empty array for spec without scenarios", async () => {
    const { parseScenarios } = await importCoverage();
    vi.mocked(readFileSync).mockReturnValue("# Just a title\n\nSome description\n");

    const scenarios = parseScenarios("/fake/spec.md");
    expect(scenarios).toHaveLength(0);
  });
});

// ─── parseTestCases ──────────────────────────────────────────────────

describe("parseTestCases", () => {
  it("extracts test names from spec file content", async () => {
    const { parseTestCases } = await importCoverage();
    const content = [
      'test("should log in successfully", async ({ page }) => {',
      '  await page.goto("/login");',
      "});",
      "",
      'test("should log out @auth", async ({ page }) => {',
      '  await page.goto("/logout");',
      "});",
    ].join("\n");
    vi.mocked(readFileSync).mockReturnValue(content);

    const tests = parseTestCases("/fake/test.spec.ts");
    expect(tests).toHaveLength(2);
    expect(tests[0].name).toBe("should log in successfully");
    expect(tests[1].name).toBe("should log out @auth");
  });

  it("handles single-quoted test names", async () => {
    const { parseTestCases } = await importCoverage();
    vi.mocked(readFileSync).mockReturnValue("test('should work', async ({ page }) => {});\n");

    const tests = parseTestCases("/fake/test.spec.ts");
    expect(tests[0].name).toBe("should work");
  });
});

// ─── extractKeywords ─────────────────────────────────────────────────

describe("extractKeywords", () => {
  it("extracts meaningful words from scenario name", async () => {
    const { extractKeywords } = await importCoverage();
    const words = extractKeywords("User can log in with credentials");
    // 'user' is a stop word — excluded
    expect(words).toContain("log");
    expect(words).toContain("credentials");
    // Stop words filtered
    expect(words).not.toContain("the");
    expect(words).not.toContain("with");
    expect(words).not.toContain("can");
  });
});

// ─── collectSpecFiles ────────────────────────────────────────────────

describe("collectSpecFiles", () => {
  it("collects .spec.ts files recursively", async () => {
    const { collectSpecFiles } = await importCoverage();
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readdirSync)
      .mockReturnValueOnce([
        dirent("auth", true),
        dirent("profile.spec.ts", false),
        dirent("readme.md", false),
      ])
      .mockReturnValueOnce([
        dirent("login.spec.ts", false),
      ]);

    const result = collectSpecFiles("/fake/tests");
    expect(result).toHaveLength(2);
    expect(result[0]).toContain("login.spec.ts");
    expect(result[1]).toContain("profile.spec.ts");
  });

  it("skips node_modules and __snapshots__", async () => {
    const { collectSpecFiles } = await importCoverage();
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readdirSync).mockReturnValue([
      dirent("node_modules", true),
      dirent("__snapshots__", true),
      dirent("test.spec.ts", false),
    ]);
    const result = collectSpecFiles("/fake/tests");
    expect(result).toHaveLength(1);
    expect(result[0]).toContain("test.spec.ts");
  });
});

// ─── analyzeChange (integration-style) ───────────────────────────────

describe("analyzeChange", () => {
  it("returns 0% coverage when no test files exist", async () => {
    const { analyzeChange } = await importCoverage();
    vi.mocked(existsSync).mockImplementation((p) => {
      const path = String(p);
      if (path.includes("openspec/changes/my-change/specs")) return true;
      if (path.includes("tests/playwright/changes")) return false;
      if (path === "/project/tests/playwright") return true;
      return false;
    });
    vi.mocked(readdirSync).mockImplementation((dir) => {
      if (String(dir).includes("specs")) {
        return [dirent("auth.md", false)];
      }
      return [];
    });
    vi.mocked(readFileSync).mockImplementation((path) => {
      if (String(path).includes("auth.md")) {
        return "#### Scenario: Login works\nShould log in\n";
      }
      return "";
    });

    const result = analyzeChange("my-change", "/project", "/project/tests/playwright", "/project/openspec/changes", []);
    expect(result.name).toBe("my-change");
    expect(result.specScenarioCount).toBe(1);
    expect(result.testCount).toBe(0);
    expect(result.coveragePct).toBe(0);
  });
});

// ─── computeOverall ──────────────────────────────────────────────────

describe("computeOverall", () => {
  it("aggregates multiple changes correctly", async () => {
    const { computeOverall } = await importCoverage();
    const changes = [
      { name: "change-a", testCount: 3, specScenarioCount: 4, matchedScenarioCount: 3, coveragePct: 75, uncoveredScenarios: [], coveredRoutes: [], uncoveredRoutes: [] },
      { name: "change-b", testCount: 5, specScenarioCount: 6, matchedScenarioCount: 6, coveragePct: 100, uncoveredScenarios: [], coveredRoutes: [], uncoveredRoutes: [] },
    ];
    const report = computeOverall(changes, [], []);
    expect(report.overallTestCount).toBe(8);
    expect(report.overallScenarioCount).toBe(10);
    expect(report.overallMatchedCount).toBe(9);
    expect(report.overallCoveragePct).toBe(90);
  });
});
