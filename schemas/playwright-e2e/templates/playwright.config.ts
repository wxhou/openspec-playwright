import { defineConfig, devices } from '@playwright/test';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// ─── Detect project root (find package.json walking up) ───
function findProjectRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(dir, 'package.json'))) return dir;
    const parent = join(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  return start;
}

const projectRoot = findProjectRoot(__dirname);

// ─── BASE_URL: prefer env, then seed.spec.ts, then default ───
const seedSpec = join(projectRoot, 'tests', 'playwright', 'seed.spec.ts');
let baseUrl = process.env.BASE_URL || 'http://localhost:3000';
if (existsSync(seedSpec)) {
  const content = readFileSync(seedSpec, 'utf-8');
  const m = content.match(/BASE_URL\s*=\s*process\.env\.BASE_URL\s*\|\|\s*['"]([^'"]+)['"]/);
  if (m) baseUrl = m[1];
}

// ─── Dev command: detect from package.json scripts ───
const pkgPath = join(projectRoot, 'package.json');
let devCmd = 'npm run dev';
if (existsSync(pkgPath)) {
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  const scripts = pkg.scripts ?? {};
  devCmd = scripts.dev ?? scripts.start ?? scripts.serve ?? scripts.preview ?? devCmd;
}

export default defineConfig({
  testDir: join(projectRoot, 'tests', 'playwright'),
  outputDir: join(projectRoot, 'tests', 'playwright', 'test-results'),
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',

  use: {
    baseURL: baseUrl,
    trace: 'on-first-retry',
  },

  // Dev server lifecycle - Playwright starts/stops automatically
  webServer: {
    command: devCmd,
    url: baseUrl,
    timeout: 120000,
    reuseExistingServer: true,
  },

  // Setup project for authentication (configured by openspec-pw run)
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
