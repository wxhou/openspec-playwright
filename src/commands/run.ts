import { execSync } from "child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import chalk from "chalk";

export interface RunOptions {
  project?: string;
  timeout?: number;
  json?: boolean;
}

const REPORTS_DIR = "openspec/reports";

export async function run(changeName: string, options: RunOptions) {
  console.log(chalk.blue(`\n🔍 OpenSpec Playwright E2E: ${changeName}\n`));

  const projectRoot = process.cwd();

  // 1. Verify test file exists
  const testFile = join(
    projectRoot,
    "tests",
    "playwright",
    `${changeName}.spec.ts`,
  );
  if (!existsSync(testFile)) {
    console.log(
      chalk.red(
        `  ✗ Test file not found: tests/playwright/${changeName}.spec.ts`,
      ),
    );
    console.log(chalk.gray("  Run /opsx:e2e first to generate tests.\n"));
    process.exit(1);
  }

  // 2. Setup reports dir
  mkdirSync(join(projectRoot, REPORTS_DIR), { recursive: true });

  // 3. Detect auth credentials
  const credsPath = join(
    projectRoot,
    "tests",
    "playwright",
    "credentials.yaml",
  );
  const hasCredentials = existsSync(credsPath);
  if (!hasCredentials) {
    console.log(
      chalk.yellow(
        "  ⚠ No credentials.yaml found — tests may fail if auth required",
      ),
    );
  }

  // 4. Run Playwright tests with output capture
  console.log(chalk.blue("─── Running Tests ───"));

  const args = ["npx", "playwright", "test", testFile, "--reporter=list"];
  if (options.project) {
    args.push("--project=" + options.project);
  }

  let testOutput = "";

  try {
    // Capture stdout to detect port mismatch
    const result = execSync(args.join(" "), {
      cwd: projectRoot,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: (options.timeout ?? 300) * 1000,
    });
    testOutput = result;
  } catch (err: unknown) {
    const error = err as { stdout?: string; stderr?: string; status?: number };
    testOutput = (error.stdout ?? "") + (error.stderr ?? "");
  }

  // 5. Parse results from Playwright output
  const results = parsePlaywrightOutput(testOutput);

  // 6. Scan for screenshots of failed tests
  const screenshotDir = join(projectRoot, "__screenshots__");
  scanScreenshots(screenshotDir, results.tests);

  // 7. Detect port mismatch
  if (
    testOutput.includes("net::ERR_CONNECTION_REFUSED") ||
    testOutput.includes("listen EADDRINUSE") ||
    testOutput.includes("0.0.0.0:")
  ) {
    console.log(
      chalk.yellow(
        "  ⚠ Port mismatch detected. Check BASE_URL and webServer port.",
      ),
    );
  }

  // 8. Generate markdown report
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const reportPath = join(
    projectRoot,
    REPORTS_DIR,
    `playwright-e2e-${changeName}-${timestamp}.md`,
  );

  const reportContent = generateReport(changeName, timestamp, results);
  writeFileSync(reportPath, reportContent);

  // 8. Summary
  if (options.json) {
    const output = JSON.stringify(
      {
        change: changeName,
        total: results.total,
        passed: results.passed,
        failed: results.failed,
        duration: results.duration,
        report: reportPath,
        tests: results.tests,
        ok: results.failed === 0,
      },
      null,
      2,
    );
    console.log(output);
    if (results.failed > 0) process.exit(1);
    return;
  }

  console.log(chalk.blue("\n─── Results ───"));
  console.log(
    `  Tests: ${results.total}  ` +
      chalk.green(`✓ ${results.passed}`) +
      "  " +
      (results.failed > 0
        ? chalk.red(`✗ ${results.failed}`)
        : chalk.gray(`✗ ${results.failed}`)) +
      `  Duration: ${results.duration}`,
  );

  console.log(chalk.blue("\n─── Report ───"));
  console.log(chalk.green(`  ✓ ${reportPath}\n`));

  if (results.failed > 0) {
    console.log(
      chalk.red(`✗ E2E verification FAILED (${results.failed} tests)`),
    );
    process.exit(1);
  } else {
    console.log(chalk.green("✓ E2E verification PASSED"));
  }
}

interface TestResults {
  total: number;
  passed: number;
  failed: number;
  duration: string;
  tests: Array<{ name: string; status: "passed" | "failed"; screenshot?: string }>;
}

function scanScreenshots(
  dir: string,
  tests: Array<{ name: string; status: "passed" | "failed"; screenshot?: string }>,
) {
  if (!existsSync(dir)) return;

  const files = readdirSync(dir).filter((f) => f.endsWith(".png"));

  for (const test of tests) {
    if (test.status !== "failed") continue;

    // Playwright screenshot naming: "test-name-failed.png" or "test-name-failed-1.png"
    const escaped = test.name.replace(/[^a-zA-Z0-9-_ ]/g, "").replace(/ /g, "-");
    const match = files.find(
      (f) =>
        f.startsWith(escaped + "-") &&
        f.includes("-failed"),
    );
    if (match) {
      test.screenshot = `__screenshots__/${match}`;
    }
  }
}

export function parsePlaywrightOutput(output: string): TestResults {
  const results: TestResults = {
    total: 0,
    passed: 0,
    failed: 0,
    duration: "0s",
    tests: [],
  };

  // Parse: "✓ my-test (1.2s)" or "✗ my-test (0.5s)"
  const testLineRegex = /([✓✗x]) (.+?) \((\d+(?:\.\d+)?[a-z]+)\)/g;
  let match;
  while ((match = testLineRegex.exec(output)) !== null) {
    const status = match[1] === "✓" ? "passed" : "failed";
    results.tests.push({ name: match[2], status });
    results.total++;
    if (status === "passed") results.passed++;
    else results.failed++;
  }

  // Parse duration: "N tests ran (1m 30s)" or "1 test ran (5s)"
  const durationMatch = output.match(/\d+ tests? ran \((\d+(?:m\s*\d+)?s?)\)/);
  if (durationMatch) results.duration = durationMatch[1];

  return results;
}

function generateReport(
  changeName: string,
  timestamp: string,
  results: TestResults,
): string {
  const lines: string[] = [
    `# E2E Verify Report: ${changeName}`,
    "",
    `**Change**: \`${changeName}\``,
    `**Generated**: ${timestamp.replace("T", " ").slice(0, 16)} UTC`,
    "",
    "## Summary",
    "",
    "| Check | Status |",
    "|-------|--------|",
    `| Tests Run | ${results.total} |`,
    `| Passed | ${results.passed} |`,
    `| Failed | ${results.failed} |`,
    `| Duration | ${results.duration} |`,
    `| Final Status | ${results.failed === 0 ? "✅ PASS" : "❌ FAIL"} |`,
    "",
    "## Test Results",
    "",
  ];

  if (results.tests.length === 0) {
    lines.push(
      "_(No test output captured — check Playwright configuration)_",
      "",
    );
  } else {
    lines.push("| Test | Status | Screenshot |");
    lines.push("|------|--------|-----------|");
    for (const test of results.tests) {
      const icon = test.status === "passed" ? "✅" : "❌";
      const screenshot = test.screenshot
        ? `[${test.screenshot}](${test.screenshot})`
        : "-";
      lines.push(`| ${test.name} | ${icon} ${test.status} | ${screenshot} |`);
    }
    lines.push("");
  }

  lines.push("## Recommendations", "");
  if (results.failed > 0) {
    lines.push(
      "Review failed tests above. Screenshots are embedded in this report.",
      "Common fixes:",
      "- Update selectors if UI changed (use `data-testid` attributes)",
      "- Adjust BASE_URL in seed.spec.ts if port differs",
      "- Set E2E_USERNAME/E2E_PASSWORD if auth is required",
      "- For full interactive reports: `npx playwright show-report`",
      "",
    );
  } else {
    lines.push("All tests passed. No action needed.", "");
  }

  return lines.join("\n");
}
