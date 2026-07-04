import { readFileSync, existsSync } from "fs";
import { join } from "path";
import chalk from "chalk";
import { SHARED_FILE_NAMES } from "../shared/index.js";
import { collectSpecFiles } from "./coverage.js";

// ─── Types ────────────────────────────────────────────────────────────

export interface FlakeFinding {
  pattern: string;
  file: string;
  line: number;
  message: string;
  severity: "high" | "medium";
}

export interface FlakeReport {
  findings: FlakeFinding[];
  patternCounts: Record<string, number>;
  summaryText: string;
}

// ─── Main Entry Point ─────────────────────────────────────────────────

export async function flake(
  changeName?: string,
  options?: { json?: boolean; gate?: string },
) {
  const projectRoot = process.cwd();
  const testsDir = join(projectRoot, "tests", "playwright");

  if (!existsSync(testsDir)) {
    console.log(
      chalk.yellow("  tests/playwright/ not found. Run `openspec-pw init` first.\n"),
    );
    return;
  }

  console.log(chalk.blue("\n🔍 OpenSpec Playwright: Flake Detection\n"));

  // Scope filtering
  let specFiles: string[];
  if (changeName) {
    const changeTestDir = join(testsDir, "changes", changeName);
    if (!existsSync(changeTestDir)) {
      console.log(chalk.yellow(`  No tests found for change "${changeName}".\n`));
      return;
    }
    specFiles = collectSpecFiles(changeTestDir);
  } else {
    specFiles = collectSpecFiles(testsDir);
  }

  // Filter out shared files
  const SHARED_FILES = new Set([
    ...SHARED_FILE_NAMES,
    "auth.setup.ts",
    "global.teardown.ts",
    "seed.spec.ts",
  ]);
  specFiles = specFiles.filter((f) => {
    const name = f.split("/").pop() ?? "";
    return !SHARED_FILES.has(name);
  });

  if (specFiles.length === 0) {
    console.log(chalk.yellow("  No spec files found to analyze.\n"));
    return;
  }

  // Parse config
  const configHasStorageState = getConfigStorageState(projectRoot);

  // Run all detectors
  const findings: FlakeFinding[] = [];
  for (const file of specFiles) {
    const content = readFileSync(file, "utf-8");
    const relPath = file.replace(testsDir + "/", "");
    findings.push(...detectNetworkIdle(content, relPath));
    findings.push(...detectRouteAfterGoto(content, relPath));
    findings.push(...detectStorageLeakage(content, relPath, configHasStorageState));
    findings.push(...detectTestUseScope(content, relPath, configHasStorageState));
  }

  // Build report
  const report = buildReport(findings);

  // Render
  if (options?.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    renderReport(report);
  }

  // Gate
  if (options?.gate) {
    const exitCode = computeGateExitCode(report, options.gate);
    if (exitCode !== 0) process.exit(exitCode);
  }
}

// ─── Config Parsing ───────────────────────────────────────────────────

export function getConfigStorageState(projectRoot: string): boolean {
  for (const name of [
    "playwright.config.ts",
    "playwright.config.js",
    "playwright.config.mjs",
  ]) {
    const configPath = join(projectRoot, name);
    if (!existsSync(configPath)) continue;
    const content = readFileSync(configPath, "utf-8");
    if (/storageState/.test(content) || /storageState\s*:/.test(content)) {
      return true;
    }
  }
  return false;
}

// ─── Pattern Detectors ────────────────────────────────────────────────

export function detectNetworkIdle(content: string, filePath: string): FlakeFinding[] {
  const findings: FlakeFinding[] = [];
  const regex = /waitForLoadState\s*\(\s*['"]networkidle['"]/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    const line = content.substring(0, match.index).split("\n").length;
    findings.push({
      pattern: "networkidle",
      file: filePath,
      line,
      message:
        "waitForLoadState('networkidle') in SPA — use a specific response wait instead",
      severity: "high",
    });
  }
  return findings;
}

export function detectRouteAfterGoto(content: string, filePath: string): FlakeFinding[] {
  const findings: FlakeFinding[] = [];

  // Find all test( positions to isolate test blocks
  const testPositions: number[] = [];
  const testRegex = /test\s*\(/g;
  let tm: RegExpExecArray | null;
  while ((tm = testRegex.exec(content)) !== null) {
    testPositions.push(tm.index);
  }

  for (let i = 0; i < testPositions.length; i++) {
    const testStart = testPositions[i];
    const testEnd =
      i + 1 < testPositions.length ? testPositions[i + 1] : content.length;
    const block = content.substring(testStart, testEnd);

    // Collect page.goto() line numbers
    const gotoCalls: number[] = [];
    const gotoRegex = /page\.goto\s*\(/g;
    let gm: RegExpExecArray | null;
    while ((gm = gotoRegex.exec(block)) !== null) {
      const line = content.substring(0, testStart + gm.index).split("\n").length;
      gotoCalls.push(line);
    }

    // Collect page.route() line numbers (excluding page.context().route())
    const routeCalls: number[] = [];
    const routeRegex = /page\.route\s*\(/g;
    let rm: RegExpExecArray | null;
    while ((rm = routeRegex.exec(block)) !== null) {
      // Skip if this is page.context().route()
      const before = block.substring(Math.max(0, rm.index - 20), rm.index);
      if (before.includes(".context(")) continue;

      const line = content.substring(0, testStart + rm.index).split("\n").length;
      routeCalls.push(line);
    }

    // If any route call appears after any goto call → finding
    if (routeCalls.length > 0 && gotoCalls.length > 0) {
      const earliestGoto = Math.min(...gotoCalls);
      for (const routeLine of routeCalls) {
        if (routeLine > earliestGoto) {
          findings.push({
            pattern: "route-after-goto",
            file: filePath,
            line: routeLine,
            message:
              "page.route() registered after page.goto() — move route() before goto()",
            severity: "high",
          });
        }
      }
    }
  }

  return findings;
}

export function detectStorageLeakage(
  content: string,
  filePath: string,
  configHasStorageState: boolean,
): FlakeFinding[] {
  // Condition 1: file references storageState
  const hasStorageStateRef = content.includes("storageState") || configHasStorageState;

  // Condition 2: page.goto() targeting protected routes
  const protectedRoutes = [
    "/dashboard",
    "/profile",
    "/admin",
    "/settings",
    "/account",
  ];
  const gotoRegex = /page\.goto\s*\(\s*['"`]([^'"`]*)['"`]/g;
  let hasProtectedGoto = false;
  let firstProtectedGotoLine = 0;
  let gm: RegExpExecArray | null;
  while ((gm = gotoRegex.exec(content)) !== null) {
    const url = gm[1];
    if (protectedRoutes.some((route) => url.includes(route))) {
      hasProtectedGoto = true;
      firstProtectedGotoLine =
        content.substring(0, gm.index).split("\n").length;
      break;
    }
  }

  // Condition 3: no browser.newContext()
  const hasNewContext = content.includes("browser.newContext(");

  if (hasStorageStateRef && hasProtectedGoto && !hasNewContext) {
    return [
      {
        pattern: "storage-leakage",
        file: filePath,
        line: firstProtectedGotoLine,
        message:
          "Potential storageState leakage — authenticated state may bleed into unauthenticated tests",
        severity: "medium",
      },
    ];
  }

  return [];
}

export function detectTestUseScope(
  content: string,
  filePath: string,
  configHasStorageState: boolean,
): FlakeFinding[] {
  const findings: FlakeFinding[] = [];
  if (!configHasStorageState) return findings;

  // Find all test.describe( positions
  const describePositions: number[] = [];
  const descRegex = /test\.describe\s*\(/g;
  let dm: RegExpExecArray | null;
  while ((dm = descRegex.exec(content)) !== null) {
    describePositions.push(dm.index);
  }

  // Find all test.use({ with storageState
  const useRegex = /test\.use\s*\(/g;
  let um: RegExpExecArray | null;
  while ((um = useRegex.exec(content)) !== null) {
    const usePos = um.index;
    const line = content.substring(0, usePos).split("\n").length;

    // Check if storageState appears nearby (within the test.use config block)
    // Search from usePos to the next test( or test.describe( or end of content
    let searchEnd = content.length;
    const nextTest = content.indexOf("test(", usePos + 1);
    const nextDescribe = content.indexOf("test.describe(", usePos + 1);
    if (nextTest > 0) searchEnd = Math.min(searchEnd, nextTest);
    if (nextDescribe > 0) searchEnd = Math.min(searchEnd, nextDescribe);
    const context = content.substring(usePos, Math.min(usePos + 500, searchEnd));

    if (!context.includes("storageState")) continue;

    // Determine if inside a describe block
    const isInsideDescribe = describePositions.some((dp) => dp < usePos);

    if (isInsideDescribe) {
      // Sub-check 1: test.use({ storageState }) inside test.describe(
      findings.push({
        pattern: "test-use-scope",
        file: filePath,
        line,
        message:
          "Conflicting test.use({ storageState }) scope — may silently break test isolation",
        severity: "medium",
      });
    } else {
      // Sub-check 2: top-level test.use({ storageState }) with untagged tests
      const testTagRegex = /test\(['"`]([^'"`]*)['"`]/g;
      let hasUntaggedTest = false;
      let ttm: RegExpExecArray | null;
      while ((ttm = testTagRegex.exec(content)) !== null) {
        if (!/@unauthenticated|@public/i.test(ttm[1])) {
          hasUntaggedTest = true;
          break;
        }
      }

      if (hasUntaggedTest) {
        findings.push({
          pattern: "test-use-scope",
          file: filePath,
          line,
          message:
            "Conflicting test.use({ storageState }) scope — may silently break test isolation",
          severity: "medium",
        });
      }
    }
  }

  return findings;
}

// ─── Report Helpers ───────────────────────────────────────────────────

export function buildReport(findings: FlakeFinding[]): FlakeReport {
  const patternCounts: Record<string, number> = {};
  for (const f of findings) {
    patternCounts[f.pattern] = (patternCounts[f.pattern] || 0) + 1;
  }
  const totalPatterns = Object.keys(patternCounts).length;
  return {
    findings,
    patternCounts,
    summaryText: `${findings.length} finding(s) across ${totalPatterns} pattern(s)`,
  };
}

function renderReport(report: FlakeReport) {
  if (report.findings.length === 0) {
    console.log("  ✅ No flake patterns detected.\n");
    return;
  }

  // Group findings by pattern
  const grouped: Record<string, FlakeFinding[]> = {};
  for (const f of report.findings) {
    if (!grouped[f.pattern]) grouped[f.pattern] = [];
    grouped[f.pattern].push(f);
  }

  for (const [pattern, patternFindings] of Object.entries(grouped)) {
    console.log(`─── ${pattern} ───`);
    for (const f of patternFindings) {
      console.log(`  ⚠ ${f.file}:${f.line}`);
      console.log(`    ${f.message}`);
    }
    console.log();
  }

  console.log(`Summary: ${report.summaryText}\n`);
}

export function computeGateExitCode(report: FlakeReport, gate: string): number {
  const level = gate.toUpperCase();

  if (level === "HIGH") {
    return report.findings.some((f) => f.severity === "high") ? 1 : 0;
  }
  if (level === "MEDIUM") {
    return report.findings.some(
      (f) => f.severity === "high" || f.severity === "medium",
    )
      ? 1
      : 0;
  }
  if (level === "ALL") {
    return report.findings.length > 0 ? 1 : 0;
  }

  // Default to HIGH
  return report.findings.some((f) => f.severity === "high") ? 1 : 0;
}
