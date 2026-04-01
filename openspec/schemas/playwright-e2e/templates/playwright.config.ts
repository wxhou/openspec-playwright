import { defineConfig, devices } from '@playwright/test';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// ─── BASE_URL: prefer env, then seed.spec.ts, then default ───
const seedSpec = join(__dirname, '../tests/playwright/seed.spec.ts');
let baseUrl = process.env.BASE_URL || 'http://localhost:3000';
if (existsSync(seedSpec)) {
  const content = readFileSync(seedSpec, 'utf-8');
  const m = content.match(/BASE_URL\s*=\s*process\.env\.BASE_URL\s*\|\|\s*['"]([^'"]+)['"]/);
  if (m) baseUrl = m[1];
}

// ─── Dev command: detect from package.json scripts ───
const pkgPath = join(__dirname, '../package.json');
let devCmd = 'npm run dev';
if (existsSync(pkgPath)) {
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  const scripts = pkg.scripts ?? {};
  // Prefer in order: dev, start, serve, preview
  devCmd = scripts.dev ?? scripts.start ?? scripts.serve ?? scripts.preview ?? devCmd;
}

export default defineConfig({
  testDir: '../tests/playwright',
  // Keep test artifacts inside tests/playwright/ instead of project root
  outputDir: '../tests/playwright/test-results',
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
