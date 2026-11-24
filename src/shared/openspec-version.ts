/**
 * OpenSpec CLI version probe.
 *
 * Supports the 1.x and 2.x CLIs. 1.x generates `/opsx:*` command files; 2.x
 * installs its workflows as skills under `.agents/skills/` instead.
 */
import { execFileSync } from "./exec.js";

/** OpenSpec CLI major versions this tool supports. */
export const OPENSPEC_SUPPORTED_MAJORS = [1, 2] as const;

/** Newest supported major — what install hints point at. */
export const OPENSPEC_LATEST_MAJOR = 2;

/** Human-readable supported range for messages. */
export const OPENSPEC_SUPPORTED_RANGE = "1.x and 2.x";

/** True when the probed major belongs to the supported set. */
export function isOpenSpecMajorSupported(major: number | null): boolean {
  return (
    major !== null &&
    (OPENSPEC_SUPPORTED_MAJORS as readonly number[]).includes(major)
  );
}

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
  if (probe.major !== null && isOpenSpecMajorSupported(probe.major)) {
    return { ok: true, major: probe.major };
  }
  // `latest` resolves to 2.x while it stays the newest published major.
  const install = "npm install -g @fission-ai/openspec@latest";
  if (probe.missing) {
    return {
      ok: false,
      kind: "missing",
      message: `OpenSpec CLI not found — install a supported major (${OPENSPEC_SUPPORTED_RANGE}): ${install}`,
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
    message: `OpenSpec ${probe.major}.x detected — this tool supports ${OPENSPEC_SUPPORTED_RANGE} — install ${OPENSPEC_LATEST_MAJOR}.x: ${install}`,
  };
}
