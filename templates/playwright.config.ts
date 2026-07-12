import { defineConfig, devices } from '@playwright/test';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

// ─── Detect project root (where package.json lives) ───
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
// Searches recursively up to maxDepth levels to support nested monorepos
function findNpmRoot(projectRoot: string, maxDepth = 5): string {
  function search(dir: string, depth: number): string | null {
    if (depth > maxDepth) return null;
    const pkgPath = join(dir, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
        const scripts = pkg.scripts ?? {};
        if (scripts['dev:all'] || scripts.dev || scripts.start || scripts.serve || scripts.preview) {
          return dir;
        }
      } catch {}
    }
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name === 'node_modules') continue;
        const found = search(join(dir, entry.name), depth + 1);
        if (found) return found;
      }
    } catch {}
    return null;
  }
  return search(projectRoot, 0) ?? projectRoot;
}

function parsePort(text: string): number | undefined {
  const patterns = [
    /(?:^|\s)(?:--port|-p)\s+([0-9]{2,5})(?:\s|$)/,
    /(?:^|\s)--port=([0-9]{2,5})(?:\s|$)/,
    /(?:^|\s)(?:PORT|VITE_PORT|PLAYWRIGHT_PORT|E2E_PORT)=([0-9]{2,5})(?:\s|$)/,
    /port\s*:\s*([0-9]{2,5})/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const port = Number(match[1]);
      if (port > 0 && port <= 65535) return port;
    }
  }
  return undefined;
}

function parseEnvPort(content: string): number | undefined {
  const lines = content.split(/\r?\n/);
  for (const key of ['PLAYWRIGHT_PORT', 'E2E_PORT', 'VITE_PORT', 'PORT']) {
    for (const line of lines) {
      const match = line.match(new RegExp(`^\\s*${key}\\s*=\\s*['\"]?([0-9]{2,5})['\"]?\\s*$`));
      if (match) {
        const port = Number(match[1]);
        if (port > 0 && port <= 65535) return port;
      }
    }
  }
  return undefined;
}

function detectPortFromEnv(): number | undefined {
  for (const key of ['PLAYWRIGHT_PORT', 'E2E_PORT', 'VITE_PORT', 'PORT']) {
    const value = process.env[key];
    if (!value) continue;
    const port = Number(value);
    if (Number.isInteger(port) && port > 0 && port <= 65535) return port;
  }
  return undefined;
}

function detectPortFromEnvFiles(npmRoot: string): number | undefined {
  for (const file of ['.env.local', '.env.development', '.env']) {
    const path = join(npmRoot, file);
    if (!existsSync(path)) continue;
    const port = parseEnvPort(readFileSync(path, 'utf-8'));
    if (port) return port;
  }
  return undefined;
}

function detectVitePort(npmRoot: string): number | undefined {
  for (const file of ['vite.config.ts', 'vite.config.mts', 'vite.config.js', 'vite.config.mjs', 'vite.config.cjs']) {
    const path = join(npmRoot, file);
    if (!existsSync(path)) continue;
    const port = parsePort(readFileSync(path, 'utf-8'));
    if (port) return port;
  }
  return undefined;
}

function frameworkDefaultPort(pkg: Record<string, any>, command = ''): number | undefined {
  const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  if (command.includes('vite') || deps.vite) return 5173;
  if (command.includes('astro') || deps.astro) return 4321;
  if (command.includes('next') || deps.next) return 3000;
  if (command.includes('nuxt') || deps.nuxt) return 3000;
  return undefined;
}

const projectRoot = findProjectRoot(process.cwd());
const npmRoot = findNpmRoot(projectRoot);
const npmPkg = join(npmRoot, 'package.json');
const pkg = existsSync(npmPkg) ? JSON.parse(readFileSync(npmPkg, 'utf-8')) : {};
const scripts = pkg.scripts ?? {};

// ─── Dev command: detect from the npm project ───
const scriptName = scripts['dev:all']
  ? 'dev:all'
  : scripts.dev
    ? 'dev'
    : scripts.start
      ? 'start'
      : scripts.serve
        ? 'serve'
        : scripts.preview
          ? 'preview'
          : 'dev';
let devCmd = `npm run ${scriptName}`;
if (npmRoot !== projectRoot) {
  devCmd = `cd "${npmRoot}" && ${devCmd}`;
}

// ─── BASE_URL: prefer env, then detected port, then seed.spec.ts, then default ───
const seedSpec = join(projectRoot, 'tests', 'playwright', 'seed.spec.ts');
let baseUrl = process.env.BASE_URL;
if (!baseUrl) {
  const scriptPort = scripts[scriptName] ? parsePort(scripts[scriptName]) : undefined;
  const port = detectPortFromEnv() ?? scriptPort ?? detectVitePort(npmRoot) ?? detectPortFromEnvFiles(npmRoot) ?? frameworkDefaultPort(pkg, scripts[scriptName]);
  if (port) baseUrl = `http://localhost:${port}`;
}
if (!baseUrl && existsSync(seedSpec)) {
  const content = readFileSync(seedSpec, 'utf-8');
  const m = content.match(/BASE_URL\s*=\s*process\.env\.BASE_URL\s*\|\|\s*['"]([^'"]+)['"]/);
  if (m) {
    const candidate = m[1];
    if (candidate.startsWith('http://') || candidate.startsWith('https://')) baseUrl = candidate;
  }
}
baseUrl ??= 'http://localhost:3000';

const authStatePath = join(projectRoot, 'playwright', '.auth', 'user.json');
const storageState = existsSync(authStatePath) ? authStatePath : undefined;

export default defineConfig({
  testDir: join(projectRoot, 'tests', 'playwright'),
  outputDir: join(projectRoot, 'tests', 'playwright', 'test-results'),
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // CI: respect PW_WORKERS env var (defaults to 4 for parallel execution).
  // Local: undefined lets Playwright auto-select based on CPU cores.
  workers: process.env.CI ? (parseInt(process.env.PW_WORKERS || '4') || 4) : undefined,
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

  // Setup project (used by /opsx:e2e Healer and local auth setup)
  // Teardown project (optional): uncomment the two lines below + create tests/playwright/global.teardown.ts
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    // { name: 'teardown', testMatch: /global\.teardown\.ts/ }, // Uncomment + create file
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState,
      },
      dependencies: ['setup'],
      // teardown: 'teardown', // Uncomment when teardown project is enabled
    },
  ],
});
