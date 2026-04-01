import { defineConfig, devices } from '@playwright/test';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

// ─── Detect project root (where openspec/ lives) ───
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

// ─── Find the npm project root (where package.json with scripts lives) ───
// Checks project root first, then immediate subdirectories
function findNpmRoot(projectRoot: string): string {
  const pkgAtRoot = join(projectRoot, 'package.json');
  if (existsSync(pkgAtRoot)) {
    const pkg = JSON.parse(readFileSync(pkgAtRoot, 'utf-8'));
    if (pkg.scripts?.dev || pkg.scripts?.start || pkg.scripts?.serve || pkg.scripts?.preview) {
      return projectRoot;
    }
  }
  // Check immediate subdirectories (e.g., openspec/ and imap/ are siblings)
  try {
    const entries = readdirSync(projectRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const subPkg = join(projectRoot, entry.name, 'package.json');
      if (existsSync(subPkg)) {
        const sub = JSON.parse(readFileSync(subPkg, 'utf-8'));
        if (sub.scripts?.dev || sub.scripts?.start) {
          return join(projectRoot, entry.name);
        }
      }
    }
  } catch {}
  return projectRoot;
}

const projectRoot = findProjectRoot(__dirname);
const npmRoot = findNpmRoot(projectRoot);

// ─── BASE_URL: prefer env, then seed.spec.ts, then default ───
const seedSpec = join(projectRoot, 'tests', 'playwright', 'seed.spec.ts');
let baseUrl = process.env.BASE_URL || 'http://localhost:3000';
if (existsSync(seedSpec)) {
  const content = readFileSync(seedSpec, 'utf-8');
  const m = content.match(/BASE_URL\s*=\s*process\.env\.BASE_URL\s*\|\|\s*['"]([^'"]+)['"]/);
  if (m) baseUrl = m[1];
}

// ─── Dev command: detect from the npm project ───
let devCmd = 'npm run dev';
const npmPkg = join(npmRoot, 'package.json');
if (existsSync(npmPkg)) {
  const pkg = JSON.parse(readFileSync(npmPkg, 'utf-8'));
  const scripts = pkg.scripts ?? {};
  devCmd = scripts.dev ?? scripts.start ?? scripts.serve ?? scripts.preview ?? devCmd;
  // Prefix with cd if npmRoot differs from projectRoot
  if (npmRoot !== projectRoot) {
    devCmd = `cd ${npmRoot} && ${devCmd}`;
  }
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
