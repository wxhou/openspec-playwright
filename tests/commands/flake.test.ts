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
