/**
 * OpenSpec CLI version probe.
 *
 * This tool targets the OpenSpec 1.x CLI. OpenSpec 2.x retired the `/opsx:*`
 * commands and the `--profile` flag that templates/auto-pipeline.yml relies
 * on, and ships its workflows as skills under `.agents/skills/` instead of
 * per-tool command files.
 */
import { execFileSync } from "./exec.js";

/** The OpenSpec CLI major version this tool supports. */
export const OPENSPEC_SUPPORTED_MAJOR = 1;

/** Parse the major version out of `openspec --version` output. */
export function parseOpenSpecMajor(output: string): number | null {
  const match = output.trim().match(/^v?(\d+)\.(\d+)(?:\.\d+)?$/);
  return match ? Number(match[1]) : null;
}

let cachedMajor: number | null | undefined;

/**
 * Detect the installed OpenSpec CLI major version.
 * Returns null when the CLI is missing or prints an unparseable version.
 *
 * Memoized: the CLI version cannot change while the process runs, and the
 * probe spawns a subprocess.
 */
export function detectOpenSpecMajorVersion(): number | null {
  if (cachedMajor === undefined) cachedMajor = probeMajorVersion();
  return cachedMajor;
}

function probeMajorVersion(): number | null {
  const probes: [string, string[]][] = [
    ["openspec", ["--version"]],
    // `--no-install` keeps npx from downloading the current release, which
    // would report 2.x on a machine whose cache holds only 1.x.
    ["npx", ["--no-install", "openspec", "--version"]],
  ];
  for (const [bin, args] of probes) {
    try {
      const out = execFileSync(bin, args, {
        encoding: "utf-8",
        timeout: 15_000,
      });
      const major = parseOpenSpecMajor(String(out));
      if (major !== null) return major;
    } catch {
      // probe failed — try the next one
    }
  }
  return null;
}
