import { exec } from 'child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { promisify } from 'util';
import chalk from 'chalk';
import * as tar from 'tar';

export const MCP_VERSION_MARKER = '<!-- MCP_VERSION:';

export const DEFAULT_HEALER_TOOLS = [
  { name: 'browser_navigate', purpose: "Go to the failing test's page" },
  { name: 'browser_snapshot', purpose: 'Get page structure to find equivalent selectors' },
  { name: 'browser_console_messages', purpose: 'Diagnose JS errors that may cause failures' },
  { name: 'browser_take_screenshot', purpose: 'Visually compare before/after fixes' },
  { name: 'browser_run_code', purpose: 'Execute custom fix logic (optional)' },
];

/** Extract MCP version from SKILL.md marker */
export function getStoredMcpVersion(skillContent: string): string | null {
  const idx = skillContent.indexOf(MCP_VERSION_MARKER);
  if (idx === -1) return null;
  const end = skillContent.indexOf(' -->', idx);
  return skillContent.slice(idx + MCP_VERSION_MARKER.length, end).trim();
}

/** Remove all existing MCP_VERSION comment lines from content */
function removeMcpVersionMarkers(content: string): string {
  return content
    .split('\n')
    .filter(line => !line.trim().startsWith(MCP_VERSION_MARKER))
    .join('\n');
}

/** Build the Healer tools table markdown */
function buildHealerTable(version: string, tools: Array<{ name: string; purpose: string }>): string {
  const rows = tools.map(t => `| \`${t.name}\` | ${t.purpose} |`).join('\n');
  return `${MCP_VERSION_MARKER} ${version} -->\n\n| Tool | Purpose |\n|------|---------|\n${rows}`;
}

/** Replace the Healer tools table in SKILL.md */
export function updateHealerTable(
  skillContent: string,
  version: string,
  tools: Array<{ name: string; purpose: string }>
): string {
  const noMarkers = removeMcpVersionMarkers(skillContent);
  const start = noMarkers.indexOf('| Tool | Purpose |');
  if (start === -1) return skillContent;
  let end = noMarkers.indexOf('\n\n', start);
  if (end === -1) end = noMarkers.length;

  const before = noMarkers.slice(0, start);
  const after = noMarkers.slice(end);
  return before + buildHealerTable(version, tools) + after;
}

/** Fetch latest @playwright/mcp version from npm registry */
export function getLatestMcpVersion(): Promise<string | null> {
  return new Promise((resolve) => {
    exec('npm show @playwright/mcp version --json', { timeout: 15000 }, (err, stdout) => {
      if (err) { resolve(null); return; }
      try { resolve(JSON.parse(stdout.trim())); } catch { resolve(null); }
    });
  });
}

const execAsync = promisify(exec);

/** Extract a .tgz tarball to a destination directory (cross-platform) */
async function extractTarball(tarballPath: string, destDir: string): Promise<void> {
  rmSync(destDir, { recursive: true, force: true });
  mkdirSync(destDir, { recursive: true });
  await tar.extract({ file: tarballPath, cwd: destDir, strip: 1 });
}

/** Parse README markdown to extract browser_* tool entries */
function parseMcpReadme(content: string): Array<{ name: string; purpose: string }> {
  const tools: Array<{ name: string; purpose: string }> = [];
  const re = /-\s+\*\*`?([^`*\n]+)`?\*\*\s*-\s*Title:\s*([^\n]+)/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    const name = m[1].trim();
    if (name.startsWith('browser_')) {
      const purpose = m[2].trim().replace(/\.$/, '');
      tools.push({ name, purpose });
    }
  }
  return tools;
}

/**
 * Fetch @playwright/mcp tools from npm package.
 * Downloads the tarball, extracts README, parses tool names.
 */
export async function fetchMcpTools(version: string): Promise<Array<{ name: string; purpose: string }>> {
  const tmpDir = join(tmpdir(), `openspec-pw-mcp-${version}`);
  try {
    await execAsync(
      `npm pack @playwright/mcp@${version} --pack-destination ${tmpDir}`,
      { timeout: 30000 }
    );
    const tgzFiles = readdirSync(tmpDir).filter(f => f.startsWith('playwright-mcp-') && f.endsWith('.tgz'));
    if (tgzFiles.length === 0) return [];
    const tarballPath = join(tmpDir, tgzFiles[0]);
    const extractDir = join(tmpDir, 'pkg');
    await extractTarball(tarballPath, extractDir);
    const readmePath = join(extractDir, 'README.md');
    const content = existsSync(readmePath) ? readFileSync(readmePath, 'utf-8') : '';
    rmSync(tmpDir, { recursive: true, force: true });
    return parseMcpReadme(content);
  } catch {
    return [];
  }
}

/**
 * Sync Healer tools table in SKILL.md with latest @playwright/mcp.
 * Returns true if updated, false if already current or failed.
 */
export async function syncMcpTools(
  skillDest: string,
  verbose = false
): Promise<boolean> {
  const latestVersion = await getLatestMcpVersion();
  if (!latestVersion) {
    if (verbose) console.log(chalk.yellow('  ⚠ Could not fetch latest @playwright/mcp version'));
    return false;
  }

  if (!existsSync(skillDest)) {
    if (verbose) console.log(chalk.gray('  - SKILL.md not found, skipping MCP sync'));
    return false;
  }

  const skillContent = readFileSync(skillDest, 'utf-8');
  const storedVersion = getStoredMcpVersion(skillContent);

  if (storedVersion === latestVersion) {
    if (verbose) console.log(chalk.gray(`  - Healer tools current (${latestVersion})`));
    return false;
  }

  if (verbose) console.log(chalk.blue(`  - Updating from ${storedVersion ?? 'unknown'} → ${latestVersion}`));

  const tools = await fetchMcpTools(latestVersion);
  const toolSet = tools.length > 0 ? tools : DEFAULT_HEALER_TOOLS;

  const updated = updateHealerTable(skillContent, latestVersion, toolSet);
  writeFileSync(skillDest, updated);

  if (verbose) {
    if (tools.length > 0) {
      console.log(chalk.green(`  ✓ Healer tools synced to ${latestVersion} (${tools.length} tools)`));
    } else {
      console.log(chalk.green(`  ✓ Healer tools synced to ${latestVersion} (default set)`));
    }
  }
  return true;
}
