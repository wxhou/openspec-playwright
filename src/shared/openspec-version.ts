/**
 * OpenSpec CLI version probe.
 *
 * This tool targets the OpenSpec 1.x CLI. OpenSpec 2.x stopped generating the
 * `/opsx:*` command files and installs its workflows as skills under
 * `.agents/skills/` instead.
 */
import { execFileSync } from "./exec.js";

/** The OpenSpec CLI major version this tool supports. */
export const OPENSPEC_SUPPORTED_MAJOR = 1;

export interface OpenSpecVersionProbe {
  /** Major version of the installed CLI; null when it could not be read. */
  major: number | null;
  /** Why the version could not be read; null when it was. */
  reason: string | null;
}

/** Parse the major version out of `openspec --version` output. */
export function parseOpenSpecMajor(output: string): number | null {
  const match = output.trim().match(/^v?(\d+)\.(\d+)(?:\.\d+)?(?:[-+].*)?$/);
  return match ? Number(match[1]) : null;
}

function isMissingBinary(err: unknown): boolean {
  return (err as { code?: string } | null)?.code === "ENOENT";
}

function firstLine(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return message.split("\n")[0];
}

/**
 * Probe the installed CLI. Uncached — a process that runs more than one
 * command should use detectOpenSpecVersion() instead.
 */
export function probeOpenSpecVersion(): OpenSpecVersionProbe {
  const probes: [string, string[]][] = [
    ["openspec", ["--version"]],
    // `--no-install` keeps npx from downloading the current release, which
    // would report 2.x on a machine whose cache holds only 1.x.
    ["npx", ["--no-install", "openspec", "--version"]],
  ];
  let broken: string | null = null;
  for (const [bin, args] of probes) {
    let out: string;
    try {
      out = String(
        execFileSync(bin, args, { encoding: "utf-8", timeout: 15_000 }),
      );
    } catch (err) {
      // The npx fallback only runs when the PATH probe found nothing, so its
      // failure means "not installed"; a PATH failure that is not a missing
      // binary is a broken install and keeps its reason.
      if (bin === "openspec" && !isMissingBinary(err)) {
        broken = `probe failed: ${firstLine(err)}`;
      }
      continue;
    }
    const major = parseOpenSpecMajor(out);
    if (major !== null) return { major, reason: null };
    return {
      major: null,
      reason: `version output not parseable: "${out.trim().slice(0, 40)}"`,
    };
  }
  return { major: null, reason: broken ?? "not found" };
}

let cached: OpenSpecVersionProbe | undefined;

/**
 * Detect the installed OpenSpec CLI version. Memoized: the CLI version cannot
 * change while the process runs, and the probe spawns a subprocess.
 */
export function detectOpenSpecVersion(): OpenSpecVersionProbe {
  if (cached === undefined) cached = probeOpenSpecVersion();
  return cached;
}
