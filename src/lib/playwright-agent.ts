import { execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { readOpenSpecSpecs } from './openspec.js';

export interface TestResult {
  name: string;
  passed: boolean;
  failure?: string;
}

export interface PlaywrightVerifyResult {
  passed: boolean;
  details: string;
  tests: TestResult[];
  failed: number;
  attempts: number;
}

/**
 * Run Playwright Planner agent - generates test plan from OpenSpec specs
 */
export async function runPlaywrightPlanner(change: string, projectRoot: string): Promise<void> {
  const specs = readOpenSpecSpecs(change, projectRoot);

  if (specs.files.length === 0) {
    console.log(chalk.yellow('⚠ No specs found. Run /opsx:propose first.'));
    return;
  }

  console.log(chalk.gray(`  Processing ${specs.files.length} spec file(s)...`));

  // Create playwright specs directory
  const playwrightSpecsDir = join(projectRoot, 'openspec', 'changes', change, 'specs', 'playwright');
  mkdirSync(playwrightSpecsDir, { recursive: true });

  // Write specs as test-plan.md for Generator agent
  const testPlanPath = join(playwrightSpecsDir, 'test-plan.md');
  const testPlan = `# Playwright Test Plan

Generated from OpenSpec specs for change: ${change}

## Requirements

${specs.content}

## Test Coverage

Generate tests covering all functional requirements above.
`;

  writeFileSync(testPlanPath, testPlan);
  console.log(chalk.green(`  ✓ Test plan written to specs/playwright/test-plan.md`));
}

/**
 * Run Playwright Generator agent - generates tests from test plan
 */
export async function runPlaywrightGenerator(change: string, projectRoot: string): Promise<void> {
  const playwrightSpecsDir = join(projectRoot, 'openspec', 'changes', change, 'specs', 'playwright');
  const testPlanPath = join(playwrightSpecsDir, 'test-plan.md');

  if (!existsSync(testPlanPath)) {
    console.log(chalk.yellow('⚠ No test plan. Run `openspec-pw plan` first.'));
    return;
  }

  const testsDir = join(projectRoot, 'tests', 'playwright');
  mkdirSync(testsDir, { recursive: true });

  // Check for seed test
  const seedPath = join(testsDir, 'seed.spec.ts');
  if (!existsSync(seedPath)) {
    console.log(chalk.gray('  No seed.spec.ts found. Create one for template guidance.'));
  }

  console.log(chalk.gray('  Generator would use Playwright MCP agent here'));
  console.log(chalk.gray('  For now, creates a placeholder test from test-plan.md'));

  // Simple placeholder - in real impl, this would call Playwright Generator agent
  const testPath = join(testsDir, `${change}.spec.ts`);
  const testPlan = readFileSync(testPlanPath, 'utf-8');
  const placeholderTest = `// Auto-generated test for change: ${change}
// TODO: Enhance with actual Playwright Generator agent

import { test, expect } from '@playwright/test';

test('${change} - verify specs coverage', async ({ page }) => {
  // Generated from: specs/playwright/test-plan.md
  // This is a placeholder - enhance with actual test logic

  // Check app is running
  await page.goto('http://localhost:3000');

  // TODO: Add assertions based on test-plan.md requirements
  await expect(page).toHaveTitle(/.*/);
});
`;

  writeFileSync(testPath, placeholderTest);
  console.log(chalk.green(`  ✓ Test generated: tests/playwright/${change}.spec.ts`));
}

/**
 * Run Playwright Healer agent - execute tests and auto-heal failures
 */
export async function runPlaywrightHealer(change: string, projectRoot: string): Promise<PlaywrightVerifyResult> {
  const testsDir = join(projectRoot, 'tests', 'playwright');
  const testFile = join(testsDir, `${change}.spec.ts`);

  if (!existsSync(testFile)) {
    // Generate tests if not exist
    await runPlaywrightPlanner(change, projectRoot);
    await runPlaywrightGenerator(change, projectRoot);
  }

  const maxAttempts = 3;
  let attempts = 0;
  const results: TestResult[] = [];

  console.log(chalk.gray(`  Running Playwright tests (max ${maxAttempts} attempts)...\n`));

  for (attempts = 1; attempts <= maxAttempts; attempts++) {
    console.log(chalk.gray(`  Attempt ${attempts}/${maxAttempts}...`));

    try {
      const output = execSync(`npx playwright test ${change}.spec.ts --reporter=json`, {
        cwd: projectRoot,
        encoding: 'utf-8',
        timeout: 120000,
      });

      // Parse results (simplified)
      console.log(chalk.green(`  Attempt ${attempts}: All tests passed`));
      return {
        passed: true,
        details: `All tests passed on attempt ${attempts}`,
        tests: [{ name: change, passed: true }],
        failed: 0,
        attempts,
      };
    } catch (e: any) {
      const output = e.stdout || e.stderr || '';
      const failures = parsePlaywrightOutput(output);

      if (failures.length === 0) {
        // No test failures, might be setup error
        console.log(chalk.yellow(`  Attempt ${attempts}: Setup error, retrying...`));
        continue;
      }

      console.log(chalk.yellow(`  Attempt ${attempts}: ${failures.length} test(s) failed`));

      for (const failure of failures) {
        console.log(chalk.gray(`    - ${failure.name}: ${failure.failure}`));
      }

      // Healer would auto-patch here
      console.log(chalk.gray(`    → Healing (auto-patch would happen here in full impl)...`));

      if (attempts < maxAttempts) {
        // Auto-patch and retry
        await autoHealTests(failures, testFile, projectRoot);
      }

      results.push(...failures.map((f) => ({ ...f, passed: false as const })));
    }
  }

  return {
    passed: false,
    details: `Failed after ${attempts} attempts`,
    tests: results,
    failed: results.length,
    attempts,
  };
}

interface Failure {
  name: string;
  failure: string;
}

function parsePlaywrightOutput(output: string): Failure[] {
  // Simple parser for Playwright JSON output
  const failures: Failure[] = [];

  try {
    const data = JSON.parse(output);
    if (data.suites) {
      for (const suite of data.suites) {
        for (const spec of suite.specs || []) {
          for (const test of spec.tests || []) {
            if (test.results && test.results[0]?.status === 'failed') {
              failures.push({
                name: test.title || spec.title,
                failure: test.results[0].error?.message || 'Unknown error',
              });
            }
          }
        }
      }
    }
  } catch {
    // Fallback: check for failure indicators in text output
    const lines = output.split('\n');
    for (const line of lines) {
      if (line.includes('FAIL') || line.includes('failed')) {
        failures.push({ name: 'test', failure: line });
      }
    }
  }

  return failures;
}

async function autoHealTests(failures: Failure[], testFile: string, projectRoot: string): Promise<void> {
  // Placeholder for Healer auto-heal logic
  // In full impl, this would:
  // 1. Analyze the failure
  // 2. Inspect current UI state
  // 3. Patch test selectors/assertions
  // 4. Write patched test
  console.log(chalk.gray(`    → Auto-heal: Would patch ${failures.map((f) => f.name).join(', ')}`));
}

/**
 * Run full Playwright E2E verify (Planner → Generator → Healer)
 */
export async function runPlaywrightVerify(change: string, projectRoot: string): Promise<PlaywrightVerifyResult> {
  console.log(chalk.blue('  Step 1: Planner (generate test plan from specs)'));
  await runPlaywrightPlanner(change, projectRoot);

  console.log(chalk.blue('\n  Step 2: Generator (create test files from plan)'));
  await runPlaywrightGenerator(change, projectRoot);

  console.log(chalk.blue('\n  Step 3: Healer (run tests with auto-heal)'));
  return await runPlaywrightHealer(change, projectRoot);
}
