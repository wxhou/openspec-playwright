/**
 * Version check: periodically query npm for the latest version
 * and show a one-line hint when the user's CLI is outdated.
 *
 * - Caches result in `~/.openspec-pw-version.json`
 * - Only hits the registry once per 24 hours
 * - Never throws — failures are silently ignored
 * - Runs *after* the command completes so it doesn't slow anything down
 */
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { execFile } from "node:child_process";
import { promisify } from "util";
import chalk from "chalk";
import { needsShell } from "./platform.js";

const execFileAsync = promisify(execFile) as (
  file: string,
  args: readonly string[],
  options: { timeout: number; shell: boolean },
) => Promise<{ stdout: string; stderr: string }>;

const CACHE_FILE = join(homedir(), ".openspec-pw-version.json");
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

interface VersionCache {
  lastCheck: number;
  latestVersion: string;
}

function readCache(): VersionCache | null {
  try {
    if (!existsSync(CACHE_FILE)) return null;
    return JSON.parse(readFileSync(CACHE_FILE, "utf-8")) as VersionCache;
  } catch {
    return null;
  }
}

function writeCache(cache: VersionCache): void {
  try {
    writeFileSync(CACHE_FILE, JSON.stringify(cache));
  } catch {
    // ignore — cache is optional
  }
}

async function fetchLatestVersion(): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(
      "npm",
      ["view", "openspec-playwright", "version"],
      { timeout: 10_000, shell: needsShell },
    );
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/, "").split(".").map(Number);
  const pb = b.replace(/^v/, "").split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) > (pb[i] ?? 0)) return 1;
    if ((pa[i] ?? 0) < (pb[i] ?? 0)) return -1;
  }
  return 0;
}

/**
 * Show a version update hint if the CLI is outdated.
 * Call this *after* the main command finishes so it doesn't block.
 */
export async function checkForUpdate(currentVersion: string): Promise<void> {
  const now = Date.now();
  const cached = readCache();

  let latest: string | null;

  if (cached && now - cached.lastCheck < CACHE_TTL) {
    latest = cached.latestVersion;
  } else {
    latest = await fetchLatestVersion();
    if (latest) {
      writeCache({ lastCheck: now, latestVersion: latest });
    }
  }

  if (!latest || compareVersions(latest, currentVersion) <= 0) return;

  // Newer version available
  console.log(
    chalk.gray(
      `\n💡 A new version of openspec-pw is available: ${currentVersion} → ${latest}`,
    ),
  );
  console.log(
    chalk.gray("   Run: npm install -g openspec-playwright@latest"),
  );
}
