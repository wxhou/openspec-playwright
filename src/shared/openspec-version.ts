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
  /** True when no `openspec` binary is reachable — the "not installed" case. */
  missing: boolean;
}

/**
 * The CLI state a command should act on: supported, absent, present but
 * unreadable, or present with an unsupported version.
 */
export type OpenSpecCliStatus =
  | { ok: true; major: number }
  | { ok: false; kind: "missing"; message: string }
  | { ok: false; kind: "unreadable"; message: string }
  | { ok: false; kind: "unsupported"; message: string };

const EXACT_VERSION = /^v?(\d+)\.(\d+)(?:\.\d+)?(?:[-+].*)?$/;

/**
 * Parse the major version out of `openspec --version` output. Accepts a bare
 * version, a version on its own line, or a banner that names the tool — an
 * unrelated version in the banner (a Node version, say) is not a candidate.
 */
export function parseOpenSpecMajor(output: string): number | null {
  const text = output.trim();
  const direct = text.match(EXACT_VERSION);
  if (direct) return Number(direct[1]);
  for (const line of text.split("\n")) {
    const onLine = line.trim().match(EXACT_VERSION);
    if (onLine) return Number(onLine[1]);
  }
  const named = text.match(/\bopenspec@?\s*v?(\d+)\.(\d+)(?:\.\d+)?/i);
  return named ? Number(named[1]) : null;
}

function isMissingBinary(err: unknown): boolean {
  return (err as { code?: string } | null)?.code === "ENOENT";
}

function failureDetail(err: unknown): string {
  const stderr = (err as { stderr?: string } | null)?.stderr?.trim();
  if (stderr) return stderr.split("\n")[0];
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
    // The bare bin name — not the package name — is what the CLI installs on
    // PATH (globally or in node_modules/.bin). `--no-install` keeps npx from
    // downloading the current release, which would report 2.x on a machine
    // whose cache holds only 1.x.
    ["npx", ["--no-install", "openspec", "--version"]],
  ];
  for (const [bin, args] of probes) {
    let out: string;
    try {
      out = String(
        execFileSync(bin, args, { encoding: "utf-8", timeout: 15_000 }),
      );
    } catch (err) {
      // A binary that exists but fails is a broken install: report it instead
      // of letting the npx fallback resolve a different copy and call the CLI
      // healthy.
      if (bin === "openspec" && !isMissingBinary(err)) {
        return {
          major: null,
          reason: `probe failed: ${failureDetail(err)}`,
          missing: false,
        };
      }
      // The npx probe only runs after the PATH probe found no binary, so its
      // own failure means "not installed".
      continue;
    }
    const major = parseOpenSpecMajor(out);
    if (major !== null) return { major, reason: null, missing: false };
    return {
      major: null,
      reason: `version output not parseable: "${out.trim().slice(0, 40)}"`,
      missing: false,
    };
  }
  return { major: null, reason: "not found", missing: true };
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

/** Classify an installed CLI (probed by default) for the commands that depend on it. */
export function openSpecCliStatus(
  probe: OpenSpecVersionProbe = detectOpenSpecVersion(),
): OpenSpecCliStatus {
  if (probe.major === OPENSPEC_SUPPORTED_MAJOR) {
    return { ok: true, major: probe.major };
  }
  const install = `npm install -g @fission-ai/openspec@${OPENSPEC_SUPPORTED_MAJOR}`;
  if (probe.missing) {
    return {
      ok: false,
      kind: "missing",
      message: `OpenSpec CLI not found — install ${OPENSPEC_SUPPORTED_MAJOR}.x: ${install}`,
    };
  }
  if (probe.major === null) {
    return {
      ok: false,
      kind: "unreadable",
      message: `OpenSpec CLI version could not be read (${probe.reason}) — check the install: ${install}`,
    };
  }
  return {
    ok: false,
    kind: "unsupported",
    message: `OpenSpec ${probe.major}.x detected — this tool needs ${OPENSPEC_SUPPORTED_MAJOR}.x — install ${OPENSPEC_SUPPORTED_MAJOR}.x: ${install}`,
  };
}
