import { execFileSync } from "child_process";
import { existsSync, readFileSync, readdirSync } from "fs";
import { join, isAbsolute } from "path";
import chalk from "chalk";
import { TIMEOUT, needsShell } from "../shared/index.js";

// ─── Types ────────────────────────────────────────────────────────────

interface CoverageChange {
  name: string;
  testCount: number;
  specScenarioCount: number;
  matchedScenarioCount: number;
  coveragePct: number;
  uncoveredScenarios: string[];
  coveredRoutes: string[];
  uncoveredRoutes: string[];
}

interface CoverageReport {
  changes: CoverageChange[];
  overallTestCount: number;
  overallScenarioCount: number;
  overallMatchedCount: number;
  overallCoveragePct: number;
  orphanedTests: string[];
  recommendations: string[];
}

interface Scenario {
  name: string;
  tags: string[];
  routes: string[];
  file: string;
}

interface TestCase {
  name: string;
  tags: string[];
  routes: string[];
  file: string;
}

// ─── Main Entry Point ─────────────────────────────────────────────────

export async function coverage(
  changeName?: string,
  opts?: { json?: boolean; failUnder?: string; plan?: string },
): Promise<number> {
  const projectRoot = process.cwd();

  // `--plan` swaps the analysis entirely: it checks a test plan against the
  // delta spec's scenarios and needs neither tests/playwright nor a test run.
  if (opts?.plan !== undefined) {
    return planGate(changeName, opts.plan, projectRoot, opts.json);
  }

  const testsDir = join(projectRoot, "tests", "playwright");
  const changesDir = join(projectRoot, "openspec", "changes");

  if (!existsSync(testsDir)) {
    console.log(
      chalk.yellow("  tests/playwright/ not found. Run `openspec-pw init` first.\n"),
    );
    return 0;
  }

  console.log(chalk.blue("\n📊 OpenSpec Playwright: Coverage Analysis\n"));

  // 1. Get all OpenSpec change names
  const changeNames = await getChangeNames(projectRoot);

  if (changeNames.length === 0) {
    console.log(chalk.yellow("  No OpenSpec changes found. Run `openspec init` first.\n"));
    return 0;
  }

  // Filter to single change if requested
  const targetChanges = changeName
    ? changeNames.filter((n) => n === changeName)
    : changeNames;

  if (changeName && targetChanges.length === 0) {
    console.log(chalk.yellow(`  Change "${changeName}" not found.\n`));
    return 0;
  }

  // 2. Collect test files
  const testFiles = collectTestFiles(testsDir);

  // 3. Analyze each change
  const changes: CoverageChange[] = [];
  const orphanedTests: string[] = [];
  const allRecommendations: string[] = [];

  for (const name of targetChanges) {
    const change = analyzeChange(name, projectRoot, testsDir, changesDir, testFiles);
    changes.push(change);

    if (change.coveragePct === 0 && change.specScenarioCount > 0) {
      allRecommendations.push(`Add tests for "${name}" (${change.specScenarioCount} scenarios uncovered)`);
    }
  }

  // 4. Detect orphaned tests (test file with no matching change)
  for (const tf of testFiles) {
    const rel = tf.replace(testsDir + "/", "");
    const match = rel.match(/^changes\/([^/]+)\//);
    if (match && !changeNames.includes(match[1])) {
      orphanedTests.push(rel);
    }
  }

  if (orphanedTests.length > 0) {
    allRecommendations.push(`${orphanedTests.length} orphaned test(s) — no matching OpenSpec change`);
  }

  // 5. Compute overall stats
  const overall = computeOverall(changes, orphanedTests, allRecommendations);

  // 6. Render
  if (opts?.json) {
    console.log(JSON.stringify(overall, null, 2));
  } else {
    renderReport(overall);
  }

  // 7. Optional threshold. Without --fail-under the command stays report-only.
  return coverageExitCode(overall.overallCoveragePct, opts?.failUnder);
}

/** Threshold decision for `--fail-under`. No flag means "never fail". */
export function coverageExitCode(overallPct: number, failUnder?: string): number {
  if (failUnder === undefined) return 0;
  const min = Number.parseFloat(failUnder);
  if (Number.isNaN(min)) return 1;
  return overallPct < min ? 1 : 0;
}

// ─── Plan coverage (the deterministic gate behind `e2e --auto`) ────────

/**
 * Collapse case, whitespace and punctuation so a scenario title matches the
 * way it was written into a plan — Chinese and English alike.
 */
export function normalizeTitle(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

export function planCoverage(
  scenarios: string[],
  planText: string,
): { covered: string[]; missing: string[] } {
  const haystack = normalizeTitle(planText);
  const covered: string[] = [];
  const missing: string[] = [];
  for (const scenario of scenarios) {
    if (haystack.includes(normalizeTitle(scenario))) covered.push(scenario);
    else missing.push(scenario);
  }
  return { covered, missing };
}

/** Every `#### Scenario: <title>` across a change's delta spec files. */
export function extractScenarioTitles(specsDir: string): string[] {
  const titles: string[] = [];
  const walk = (dir: string) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".md")) {
        for (const line of readFileSync(full, "utf-8").split("\n")) {
          const match = /^####\s+Scenario:\s*(.+?)\s*$/.exec(line);
          if (match) titles.push(match[1]);
        }
      }
    }
  };
  walk(specsDir);
  return titles;
}

/**
 * `coverage --plan <file>`: the autonomous e2e mode replaces the human plan
 * approval with this. Missing plan or missing scenario both fail — a plan the
 * agent never wrote must not pass silently.
 */
function planGate(
  changeName: string | undefined,
  planPath: string,
  projectRoot: string,
  json?: boolean,
): number {
  if (!changeName) {
    console.error("  coverage --plan requires a change name\n");
    return 2;
  }
  const scenarios = extractScenarioTitles(
    join(projectRoot, "openspec", "changes", changeName, "specs"),
  );
  const resolved = isAbsolute(planPath) ? planPath : join(projectRoot, planPath);

  if (scenarios.length === 0) {
    if (json) console.log(JSON.stringify({ change: changeName, scenarios: 0, missing: [] }));
    else console.log(chalk.yellow(`  No scenarios in "${changeName}" — nothing to check.\n`));
    return 0;
  }

  if (!existsSync(resolved)) {
    if (json) {
      console.log(JSON.stringify({ change: changeName, plan: planPath, missing: scenarios }));
    } else {
      console.error(chalk.red(`  Test plan not found: ${planPath}`));
      console.log("  Every scenario must appear in that file:");
      for (const s of scenarios) console.log(`    - ${s}`);
      console.log();
    }
    return 1;
  }

  const { covered, missing } = planCoverage(
    scenarios,
    readFileSync(resolved, "utf-8"),
  );

  if (json) {
    console.log(JSON.stringify({ change: changeName, total: scenarios.length, covered: covered.length, missing }));
  } else {
    console.log(chalk.blue("\n📋 OpenSpec Playwright: Plan Coverage\n"));
    console.log(`  ${covered.length}/${scenarios.length} scenarios planned in ${planPath}`);
    if (missing.length > 0) {
      console.log(chalk.red(`\n  Missing (${missing.length}):`));
      for (const m of missing) console.log(chalk.red(`    ✗ ${m}`));
    } else {
      console.log(chalk.green("  ✓ Every scenario has a planned case"));
    }
    console.log();
  }
  return missing.length > 0 ? 1 : 0;
}

// ─── Analysis Functions ───────────────────────────────────────────────

export function analyzeChange(
  name: string,
  projectRoot: string,
  testsDir: string,
  changesDir: string,
  _allTestFiles: string[],
): CoverageChange {
  // Spec dir: openspec/changes/<name>/specs/
  const specDir = join(changesDir, name, "specs");
  // Test dir: tests/playwright/changes/<name>/
  const changeTestDir = join(testsDir, "changes", name);

  // Parse spec scenarios
  const scenarios: Scenario[] = [];
  if (existsSync(specDir)) {
    const specFiles = collectMarkdownFiles(specDir);
    for (const sf of specFiles) {
      scenarios.push(...parseScenarios(sf));
    }
  }

  // Parse test cases
  const tests: TestCase[] = [];
  if (existsSync(changeTestDir)) {
    const files = collectSpecFiles(changeTestDir);
    for (const tf of files) {
      tests.push(...parseTestCases(tf));
    }
  }

  // Route extraction
  const specRoutes = extractRoutes(scenarios.map((s) => s.routes).flat());
  const testRoutes = extractRoutes(tests.map((t) => t.routes).flat());

  // L2 — Route match: spec routes covered by test routes
  const coveredRoutes = specRoutes.filter((r) =>
    testRoutes.some((tr) => tr === r || tr.startsWith(r)),
  );
  const uncoveredRoutes = specRoutes.filter(
    (r) => !coveredRoutes.includes(r),
  );

  // L3 — Tag match
  const testTags = new Set(tests.flatMap((t) => t.tags));

  // L1+L3+L4+L5 — Scenario matching
  let matchedCount = 0;
  const uncoveredScenarios: string[] = [];

  for (const sc of scenarios) {
    // L3: tag match
    const tagMatched = sc.tags.length > 0 && sc.tags.some((t) => testTags.has(t));
    // L4: keyword match — extract key terms from scenario name
    const scKeywords = extractKeywords(sc.name);
    const keywordMatched = tests.some((t) =>
      scKeywords.some((kw) => t.name.toLowerCase().includes(kw)),
    );
    // L5: name contains (or similar by overlap)
    const nameMatched = tests.some(
      (t) =>
        t.name.toLowerCase().includes(sc.name.toLowerCase()) ||
        sc.name.toLowerCase().includes(t.name.toLowerCase()),
    );

    if (tagMatched || keywordMatched || nameMatched) {
      matchedCount++;
    } else {
      uncoveredScenarios.push(sc.name);
    }
  }

  const totalScenarios = scenarios.length || 1; // avoid div-by-zero
  const pct = Math.round((matchedCount / totalScenarios) * 100);

  return {
    name,
    testCount: tests.length,
    specScenarioCount: scenarios.length,
    matchedScenarioCount: matchedCount,
    coveragePct: pct,
    uncoveredScenarios,
    coveredRoutes,
    uncoveredRoutes,
  };
}

export function computeOverall(
  changes: CoverageChange[],
  orphanedTests: string[],
  recommendations: string[],
): CoverageReport {
  const totalScenarios = changes.reduce((s, c) => s + c.specScenarioCount, 0);
  const totalMatched = changes.reduce((s, c) => s + c.matchedScenarioCount, 0);
  const totalTests = changes.reduce((s, c) => s + c.testCount, 0);

  return {
    changes,
    overallTestCount: totalTests,
    overallScenarioCount: totalScenarios,
    overallMatchedCount: totalMatched,
    overallCoveragePct: totalScenarios > 0
      ? Math.round((totalMatched / totalScenarios) * 100)
      : 0,
    orphanedTests,
    recommendations,
  };
}

// ─── Parsing Helpers ──────────────────────────────────────────────────

export function parseScenarios(filePath: string): Scenario[] {
  const content = readFileSync(filePath, "utf-8");
  const scenarios: Scenario[] = [];
  const lines = content.split("\n");

  let currentScenario: Partial<Scenario> | null = null;
  let descriptionLines: string[] = [];

  for (const line of lines) {
    const scenarioMatch = line.match(/^#### Scenario:\s*(.+)/);
    if (scenarioMatch) {
      if (currentScenario?.name) {
        scenarios.push(buildScenario(currentScenario, descriptionLines));
      }
      // Capture inline tags, then strip from name
      const rawName = scenarioMatch[1].trim();
      const inlineTags = [...new Set(
        (rawName.match(/@\w+/g) ?? []).map((t) => t.toLowerCase()),
      )];
      const cleanName = rawName.replace(/@\w+/g, "").replace(/\s{2,}/g, " ").trim();
      currentScenario = { name: cleanName, tags: inlineTags, routes: [] };
      descriptionLines = [];
      continue;
    }

    if (currentScenario) {
      descriptionLines.push(line);
    }
  }

  if (currentScenario?.name) {
    scenarios.push(buildScenario(currentScenario, descriptionLines));
  }

  return scenarios;
}

function buildScenario(sc: Partial<Scenario>, descLines: string[]): Scenario {
  const fullText = descLines.join(" ");

  // Merge inline tags (already parsed) with description tags
  const descTags = (fullText.match(/@\w+/g) ?? []).map((t) => t.toLowerCase());
  const tags = [...new Set([...(sc.tags ?? []), ...descTags])];

  // Extract routes
  const routes = extractRoutesFromText(fullText);

  return {
    name: sc.name ?? "",
    tags,
    routes,
    file: "",
  };
}

export function parseTestCases(filePath: string): TestCase[] {
  const content = readFileSync(filePath, "utf-8");
  const tests: TestCase[] = [];
  const lines = content.split("\n");

  for (const line of lines) {
    // Match test('name', ...) or test("name", ...) or test(`name`, ...)
    const match = line.match(/test\(['"`](.+)['"`]/);
    if (match) {
      const name = match[1].trim();

      // Extract @tags
      const tagMatches = name.match(/@\w+/g);
      const tags = tagMatches ? [...new Set(tagMatches.map((t) => t.toLowerCase()))] : [];

      // Extract routes from the line
      const routes = extractRoutesFromText(name);

      tests.push({ name, tags, routes, file: filePath });
    }
  }

  return tests;
}

function extractRoutesFromText(text: string): string[] {
  const routes: string[] = [];
  // Match goto('/path') or page.goto('/path')
  const gotoPattern = /(?:page\s*\.\s*)?goto\s*\(\s*['"`](\/[^'"`]*)['"`]/g;
  let m;
  while ((m = gotoPattern.exec(text)) !== null) {
    routes.push(m[1]);
  }
  // Also match bare paths like /login, /dashboard used in comments/specs
  const pathPattern = /\b(\/[a-z][a-z0-9_\-/]*)/gi;
  while ((m = pathPattern.exec(text)) !== null) {
    const p = m[1];
    if (!p.includes("//") && !p.includes(".") && p.split("/").length <= 4) {
      routes.push(p);
    }
  }
  return [...new Set(routes)];
}

function extractRoutes(routeList: string[]): string[] {
  return [...new Set(routeList)];
}

export function extractKeywords(name: string): string[] {
  // Extract meaningful words (≥3 chars, not common stop words)
  const stopWords = new Set([
    "the", "and", "for", "with", "from", "that", "this", "when",
    "then", "user", "page", "test", "should", "can", "not",
  ]);
  return name
    .toLowerCase()
    .split(/[\s\-_/]+/)
    .filter((w) => w.length >= 3 && !stopWords.has(w));
}

// ─── File Collection ──────────────────────────────────────────────────

function collectTestFiles(dir: string, collected: string[] = []): string[] {
  return collectSpecFiles(dir, collected);
}

export function collectSpecFiles(dir: string, collected: string[] = []): string[] {
  if (!existsSync(dir)) return collected;
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (
        !entry.name.startsWith(".") &&
        entry.name !== "node_modules" &&
        entry.name !== "__snapshots__"
      ) {
        collectSpecFiles(fullPath, collected);
      }
    } else if (entry.name.endsWith(".spec.ts")) {
      collected.push(fullPath);
    }
  }
  return collected;
}

function collectMarkdownFiles(dir: string, collected: string[] = []): string[] {
  if (!existsSync(dir)) return collected;
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!entry.name.startsWith(".") && entry.name !== "node_modules") {
        collectMarkdownFiles(fullPath, collected);
      }
    } else if (entry.name.endsWith(".md") && entry.name !== "test-plan.md") {
      collected.push(fullPath);
    }
  }
  return collected;
}

async function getChangeNames(projectRoot: string): Promise<string[]> {
  try {
    const result = execFileSync("npx", ["openspec", "list", "--json"], {
      shell: needsShell,
      cwd: projectRoot,
      encoding: "utf-8",
      timeout: TIMEOUT.OPENSPEC_LIST,
    });
    const data = JSON.parse(result);
    if (Array.isArray(data)) return data.map((c: { name: string }) => c.name);
    if (data.changes && Array.isArray(data.changes)) return data.changes.map((c: { name: string }) => c.name);
    return Object.keys(data);
  } catch {
    return [];
  }
}

// ─── Report Rendering ─────────────────────────────────────────────────

function renderReport(report: CoverageReport) {
  const { changes, overallCoveragePct, orphanedTests, recommendations } = report;

  if (changes.length === 0) {
    console.log(chalk.yellow("  No changes to analyze.\n"));
    return;
  }

  // Summary table (manually aligned for terminal)
  const header = `${chalk.bold("Change".padEnd(24))} ${chalk.bold("Tests")}  ${chalk.bold("Spec")}   ${chalk.bold("Cov")}`;
  const sep = "─".repeat(24) + " ───── ───── ─────";

  console.log(`  ${header}`);
  console.log(`  ${chalk.gray(sep)}`);

  for (const c of changes) {
    const name = c.name.padEnd(24);
    const tests = String(c.testCount).padStart(3);
    const specs = String(c.specScenarioCount).padStart(4);
    const pct = formatPct(c.coveragePct);
    console.log(`  ${name} ${tests}  ${specs}  ${pct}`);
  }

  console.log();

  // Overall
  const overallColor = overallCoveragePct >= 80 ? chalk.green : overallCoveragePct >= 50 ? chalk.yellow : chalk.red;
  console.log(`  Overall coverage: ${overallColor(`${overallCoveragePct}%`)} (${report.overallMatchedCount}/${report.overallScenarioCount} scenarios)`);
  console.log(`  Total test cases: ${chalk.cyan(String(report.overallTestCount))}`);
  console.log();

  // Uncovered scenarios
  const uncovered = changes.flatMap((c) =>
    c.uncoveredScenarios.map((s) => ({ change: c.name, scenario: s })),
  );
  if (uncovered.length > 0) {
    console.log(chalk.yellow(`  📋 Uncovered scenarios (${uncovered.length}):`));
    for (const u of uncovered) {
      console.log(chalk.gray(`    ${u.change} → ${u.scenario}`));
    }
    console.log();
  }

  // Uncovered routes
  const uncoveredRoutes = changes.flatMap((c) =>
    c.uncoveredRoutes.map((r) => ({ change: c.name, route: r })),
  );
  if (uncoveredRoutes.length > 0) {
    console.log(chalk.yellow(`  🛣️  Uncovered routes (${uncoveredRoutes.length}):`));
    for (const u of uncoveredRoutes) {
      console.log(chalk.gray(`    ${u.change} → ${u.route}`));
    }
    console.log();
  }

  // Orphaned tests
  if (orphanedTests.length > 0) {
    console.log(chalk.red(`  ⚠ Orphaned tests (${orphanedTests.length}):`));
    for (const ot of orphanedTests) {
      console.log(chalk.gray(`    ${ot}`));
    }
    console.log();
  }

  // Recommendations
  if (recommendations.length > 0) {
    console.log(chalk.blue("  💡 Recommendations:"));
    for (const r of recommendations) {
      console.log(chalk.gray(`    • ${r}`));
    }
    console.log();
  }

  // Footer
  if (uncovered.length === 0 && orphanedTests.length === 0) {
    console.log(chalk.green("  ✅ Full coverage — all scenarios matched.\n"));
  }
}

function formatPct(pct: number): string {
  const s = `${pct}%`.padStart(4);
  if (pct >= 80) return chalk.green(s);
  if (pct >= 50) return chalk.yellow(s);
  return chalk.red(s);
}
