import { describe, it, expect } from "vitest";

async function importFlake() {
  return import("../../src/commands/flake.js");
}

// ─── detectNetworkIdle ───────────────────────────────────────────────

describe("detectNetworkIdle", () => {
  it("detects single-quoted networkidle", async () => {
    const { detectNetworkIdle } = await importFlake();
    const content = `import { test } from '@playwright/test';\n\ntest('example', async ({ page }) => {\n  await page.waitForLoadState('networkidle');\n});\n`;
    const findings = detectNetworkIdle(content, "example.spec.ts");
    expect(findings).toHaveLength(1);
    expect(findings[0].pattern).toBe("networkidle");
    expect(findings[0].line).toBe(4);
    expect(findings[0].severity).toBe("high");
  });

  it("detects double-quoted networkidle", async () => {
    const { detectNetworkIdle } = await importFlake();
    const content = `test('test', async ({ page }) => {\n  await page.waitForLoadState("networkidle");\n});\n`;
    const findings = detectNetworkIdle(content, "foo.spec.ts");
    expect(findings).toHaveLength(1);
  });

  it("skips template literal arguments", async () => {
    const { detectNetworkIdle } = await importFlake();
    const content = `test('test', async ({ page }) => {\n  await page.waitForLoadState(\`networkidle\`);\n});\n`;
    const findings = detectNetworkIdle(content, "foo.spec.ts");
    expect(findings).toHaveLength(0);
  });

  it("skips other waitForLoadState values", async () => {
    const { detectNetworkIdle } = await importFlake();
    const content = `test('test', async ({ page }) => {\n  await page.waitForLoadState('domcontentloaded');\n});\n`;
    const findings = detectNetworkIdle(content, "foo.spec.ts");
    expect(findings).toHaveLength(0);
  });

  it("reports no findings on clean files", async () => {
    const { detectNetworkIdle } = await importFlake();
    const findings = detectNetworkIdle("test('clean', () => {});\n", "clean.spec.ts");
    expect(findings).toHaveLength(0);
  });
});

// ─── detectRouteAfterGoto ────────────────────────────────────────────

describe("detectRouteAfterGoto", () => {
  it("detects route after goto", async () => {
    const { detectRouteAfterGoto } = await importFlake();
    const content = [
      "test('example', async ({ page }) => {",
      "  await page.goto('/');",
      "  await page.route('**/*', handler);",
      "});",
    ].join("\n");
    const findings = detectRouteAfterGoto(content, "example.spec.ts");
    expect(findings).toHaveLength(1);
    expect(findings[0].pattern).toBe("route-after-goto");
    expect(findings[0].severity).toBe("high");
  });

  it("skips route before goto", async () => {
    const { detectRouteAfterGoto } = await importFlake();
    const content = [
      "test('example', async ({ page }) => {",
      "  await page.route('**/*', handler);",
      "  await page.goto('/');",
      "});",
    ].join("\n");
    const findings = detectRouteAfterGoto(content, "example.spec.ts");
    expect(findings).toHaveLength(0);
  });

  it("ignores page.context().route()", async () => {
    const { detectRouteAfterGoto } = await importFlake();
    const content = [
      "test('example', async ({ page }) => {",
      "  await page.goto('/');",
      "  await page.context().route('**/*', handler);",
      "});",
    ].join("\n");
    const findings = detectRouteAfterGoto(content, "example.spec.ts");
    expect(findings).toHaveLength(0);
  });

  it("scopes per test block", async () => {
    const { detectRouteAfterGoto } = await importFlake();
    const content = [
      "test('good', async ({ page }) => {",
      "  await page.route('**/*', handler);",
      "  await page.goto('/');",
      "});",
      "",
      "test('bad', async ({ page }) => {",
      "  await page.goto('/admin');",
      "  await page.route('**/*', handler);",
      "});",
    ].join("\n");
    const findings = detectRouteAfterGoto(content, "example.spec.ts");
    expect(findings).toHaveLength(1);
  });
});

// ─── detectStorageLeakage ────────────────────────────────────────────

describe("detectStorageLeakage", () => {
  it("flags file with storageState + protected route + no isolation", async () => {
    const { detectStorageLeakage } = await importFlake();
    const content = [
      "test('admin test', async ({ page }) => {",
      "  await page.goto('/dashboard');",
      "  await expect(page.getByText('Welcome')).toBeVisible();",
      "});",
    ].join("\n");
    const findings = detectStorageLeakage(content, "admin.spec.ts", true);
    expect(findings).toHaveLength(1);
    expect(findings[0].pattern).toBe("storage-leakage");
    expect(findings[0].severity).toBe("medium");
  });

  it("skips files with browser.newContext()", async () => {
    const { detectStorageLeakage } = await importFlake();
    const content = [
      "test('auth guard', async ({ browser }) => {",
      "  const ctx = await browser.newContext();",
      "  const page = await ctx.newPage();",
      "  await page.goto('/dashboard');",
      "});",
    ].join("\n");
    const findings = detectStorageLeakage(content, "guard.spec.ts", true);
    expect(findings).toHaveLength(0);
  });

  it("skips files without storageState ref", async () => {
    const { detectStorageLeakage } = await importFlake();
    const content = "test('public test', async ({ page }) => {\n  await page.goto('/dashboard');\n});\n";
    const findings = detectStorageLeakage(content, "public.spec.ts", false);
    expect(findings).toHaveLength(0);
  });

  it("detects config-level storageState", async () => {
    const { detectStorageLeakage } = await importFlake();
    const content = "test('test', async ({ page }) => {\n  await page.goto('/admin');\n});\n";
    const findings = detectStorageLeakage(content, "admin.spec.ts", true);
    expect(findings).toHaveLength(1);
  });
});

// ─── detectTestUseScope ──────────────────────────────────────────────

describe("detectTestUseScope", () => {
  it("flags test.use inside describe when project has storageState", async () => {
    const { detectTestUseScope } = await importFlake();
    const content = [
      "test.describe('Admin section', () => {",
      "  test.use({ storageState: './playwright/.auth/user.json' });",
      "  test('admin test', async ({ page }) => {",
      "    await page.goto('/admin');",
      "  });",
      "});",
    ].join("\n");
    const findings = detectTestUseScope(content, "admin.spec.ts", true);
    expect(findings).toHaveLength(1);
    expect(findings[0].pattern).toBe("test-use-scope");
    expect(findings[0].severity).toBe("medium");
  });

  it("skips when no project-level storageState", async () => {
    const { detectTestUseScope } = await importFlake();
    const content = [
      "test.describe('Section', () => {",
      "  test.use({ storageState: './auth.json' });",
      "  test('test', async ({ page }) => {});",
      "});",
    ].join("\n");
    const findings = detectTestUseScope(content, "section.spec.ts", false);
    expect(findings).toHaveLength(0);
  });

  it("skips when describe has no storageState override", async () => {
    const { detectTestUseScope } = await importFlake();
    const content = [
      "test.describe('Section', () => {",
      "  test('test', async ({ page }) => {});",
      "});",
    ].join("\n");
    const findings = detectTestUseScope(content, "section.spec.ts", true);
    expect(findings).toHaveLength(0);
  });

  it("flags top-level test.use with untagged tests", async () => {
    const { detectTestUseScope } = await importFlake();
    const content = [
      "test.use({ storageState: './auth.json' });",
      "",
      "test('page loads', async ({ page }) => {",
      "  await page.goto('/');",
      "});",
    ].join("\n");
    const findings = detectTestUseScope(content, "app.spec.ts", true);
    expect(findings).toHaveLength(1);
  });

  it("skips top-level test.use when all tests tagged @unauthenticated", async () => {
    const { detectTestUseScope } = await importFlake();
    const content = [
      "test.use({ storageState: './auth.json' });",
      "",
      "test('public page @unauthenticated', async ({ page }) => {",
      "  await page.goto('/');",
      "});",
    ].join("\n");
    const findings = detectTestUseScope(content, "app.spec.ts", true);
    expect(findings).toHaveLength(0);
  });
});

// ─── buildReport ─────────────────────────────────────────────────────

describe("buildReport", () => {
  it("groups findings by pattern", async () => {
    const { buildReport } = await importFlake();
    const findings = [
      { pattern: "networkidle", file: "a.spec.ts", line: 5, message: "msg", severity: "high" as const },
      { pattern: "networkidle", file: "b.spec.ts", line: 10, message: "msg", severity: "high" as const },
      { pattern: "route-after-goto", file: "c.spec.ts", line: 3, message: "msg", severity: "high" as const },
    ];
    const report = buildReport(findings);
    expect(report.patternCounts).toEqual({ networkidle: 2, "route-after-goto": 1 });
    expect(report.summaryText).toBe("3 finding(s) across 2 pattern(s)");
  });
});

// ─── computeGateExitCode ─────────────────────────────────────────────

describe("computeGateExitCode", () => {
  it("exits 1 for HIGH gate when high severity findings exist", async () => {
    const { buildReport, computeGateExitCode } = await importFlake();
    const report = buildReport([
      { pattern: "networkidle", file: "a.spec.ts", line: 1, message: "msg", severity: "high" as const },
    ]);
    expect(computeGateExitCode(report, "HIGH")).toBe(1);
  });

  it("exits 0 for HIGH gate when only medium findings exist", async () => {
    const { buildReport, computeGateExitCode } = await importFlake();
    const report = buildReport([
      { pattern: "storage-leakage", file: "a.spec.ts", line: 1, message: "msg", severity: "medium" as const },
    ]);
    expect(computeGateExitCode(report, "HIGH")).toBe(0);
  });

  it("exits 1 for MEDIUM gate when medium findings exist", async () => {
    const { buildReport, computeGateExitCode } = await importFlake();
    const report = buildReport([
      { pattern: "storage-leakage", file: "a.spec.ts", line: 1, message: "msg", severity: "medium" as const },
    ]);
    expect(computeGateExitCode(report, "MEDIUM")).toBe(1);
  });

  it("exits 1 for ALL gate when any finding exists", async () => {
    const { buildReport, computeGateExitCode } = await importFlake();
    const report = buildReport([
      { pattern: "networkidle", file: "a.spec.ts", line: 1, message: "msg", severity: "high" as const },
    ]);
    expect(computeGateExitCode(report, "ALL")).toBe(1);
  });

  it("exits 0 for ALL gate when no findings", async () => {
    const { buildReport, computeGateExitCode } = await importFlake();
    const report = buildReport([]);
    expect(computeGateExitCode(report, "ALL")).toBe(0);
  });

  it("defaults to HIGH for unknown gate value", async () => {
    const { buildReport, computeGateExitCode } = await importFlake();
    const report = buildReport([
      { pattern: "networkidle", file: "a.spec.ts", line: 1, message: "msg", severity: "high" as const },
    ]);
    expect(computeGateExitCode(report, "INVALID")).toBe(1);
  });
});

// ─── parseTimeoutIncreases ───────────────────────────────────────────

const timeoutDiff = (from: string, to: string) =>
  [
    "--- a/tests/playwright/a.spec.ts",
    "+++ b/tests/playwright/a.spec.ts",
    "@@ -10,1 +10,1 @@",
    `-  ${from}`,
    `+  ${to}`,
  ].join("\n");

describe("parseTimeoutIncreases", () => {
  it("reports a raised timeout with its new line number", async () => {
    const { parseTimeoutIncreases } = await importFlake();
    const found = parseTimeoutIncreases(
      timeoutDiff(
        "await page.waitForSelector('#x', { timeout: 5000 });",
        "await page.waitForSelector('#x', { timeout: 30000 });",
      ),
    );
    expect(found).toEqual([
      { file: "tests/playwright/a.spec.ts", line: 10, from: 5000, to: 30000 },
    ]);
  });

  it("reports a raised test.setTimeout", async () => {
    const { parseTimeoutIncreases } = await importFlake();
    const found = parseTimeoutIncreases(
      timeoutDiff("test.setTimeout(30000);", "test.setTimeout(120000);"),
    );
    expect(found).toEqual([
      { file: "tests/playwright/a.spec.ts", line: 10, from: 30000, to: 120000 },
    ]);
  });

  it("ignores lowered and unchanged values", async () => {
    const { parseTimeoutIncreases } = await importFlake();
    expect(
      parseTimeoutIncreases(timeoutDiff("test.setTimeout(60000);", "test.setTimeout(30000);")),
    ).toEqual([]);
    expect(
      parseTimeoutIncreases(timeoutDiff("timeout: 5000", "timeout: 5000")),
    ).toEqual([]);
  });

  it("never pairs a removal with an addition in another file", async () => {
    const { parseTimeoutIncreases } = await importFlake();
    const diff = [
      "--- a/a.spec.ts",
      "+++ b/a.spec.ts",
      "@@ -1,1 +1,0 @@",
      "-  timeout: 5000",
      "--- a/b.spec.ts",
      "+++ b/b.spec.ts",
      "@@ -1,0 +1,1 @@",
      "+  timeout: 30000",
    ].join("\n");
    expect(parseTimeoutIncreases(diff)).toEqual([]);
  });

  it("restricts findings to the given scope", async () => {
    const { parseTimeoutIncreases } = await importFlake();
    const change = (name: string) => [
      `--- a/tests/playwright/changes/${name}.spec.ts`,
      `+++ b/tests/playwright/changes/${name}.spec.ts`,
      "@@ -1,1 +1,1 @@",
      "-  timeout: 1000",
      "+  timeout: 9000",
    ];
    const diff = [...change("one"), ...change("two")].join("\n");
    const scoped = parseTimeoutIncreases(diff, [
      "tests/playwright/changes/one.spec.ts",
    ]);
    expect(scoped.map((f) => f.file)).toEqual([
      "tests/playwright/changes/one.spec.ts",
    ]);
    expect(parseTimeoutIncreases(diff)).toHaveLength(2);
  });
});
