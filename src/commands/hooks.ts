/**
 * Claude Code Stop hook installation.
 *
 * The hook is a thin wrapper around `openspec-pw gate --hook`: the gate decides
 * whether the turn may end, so there is still exactly one check list in the
 * codebase. Merging is conservative — unknown keys, other events and the
 * user's own Stop hooks survive untouched.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";

export type HookTier = "static" | "full";

export interface CommandHook {
  type: "command";
  command: string;
  timeout?: number;
}

export interface HookGroup {
  matcher?: string;
  hooks: CommandHook[];
}

export type ClaudeSettings = {
  hooks?: Record<string, HookGroup[]>;
} & Record<string, unknown>;

/** Any command containing this fragment belongs to us. */
const OWN_MARKER = "openspec-pw gate";

const TIER_CHECKS: Record<HookTier, string> = {
  static: "validate,lint,typecheck,test",
  full: "validate,lint,typecheck,test,flake,e2e",
};

/** Timeout is generous but finite: a hook that never returns traps the turn. */
const TIER_TIMEOUT_SECONDS: Record<HookTier, number> = {
  static: 300,
  full: 900,
};

export function isHookTier(value: unknown): value is HookTier {
  return value === "static" || value === "full";
}

export function buildHookEntry(tier: HookTier): CommandHook {
  return {
    type: "command",
    command: `openspec-pw gate --hook --only ${TIER_CHECKS[tier]}`,
    timeout: TIER_TIMEOUT_SECONDS[tier],
  };
}

export function isOwnHook(hook: CommandHook): boolean {
  return typeof hook.command === "string" && hook.command.includes(OWN_MARKER);
}

/**
 * Insert or refresh our hook. Idempotent: a second call leaves one entry.
 * Everything we do not recognise is preserved byte-for-byte.
 */
export function mergeStopHook(
  settings: ClaudeSettings,
  entry: CommandHook,
): ClaudeSettings {
  const hooks = { ...(settings.hooks ?? {}) };
  const stop = Array.isArray(hooks.Stop) ? [...hooks.Stop] : [];

  let replaced = false;
  const nextStop = stop.map((group) => {
    if (!Array.isArray(group.hooks)) return group;
    const hooksInGroup = group.hooks.map((h) => {
      if (isOwnHook(h)) {
        replaced = true;
        return { ...h, ...entry };
      }
      return h;
    });
    return { ...group, hooks: hooksInGroup };
  });

  if (replaced) {
    hooks.Stop = nextStop;
  } else {
    // Stop has no matcher support; an omitted matcher matches every turn.
    hooks.Stop = [...nextStop, { hooks: [entry] }];
  }

  return { ...settings, hooks };
}

/** Remove our hook and tidy up the empty containers it leaves behind. */
export function removeStopHook(settings: ClaudeSettings): {
  settings: ClaudeSettings;
  removed: boolean;
} {
  const hooks = { ...(settings.hooks ?? {}) };
  const stop = Array.isArray(hooks.Stop) ? hooks.Stop : [];
  let removed = false;

  const nextStop = stop
    .map((group) => {
      if (!Array.isArray(group.hooks)) return group;
      const kept = group.hooks.filter((h) => {
        if (isOwnHook(h)) {
          removed = true;
          return false;
        }
        return true;
      });
      return { ...group, hooks: kept };
    })
    .filter((group) => !Array.isArray(group.hooks) || group.hooks.length > 0);

  if (nextStop.length > 0) hooks.Stop = nextStop;
  else delete hooks.Stop;

  const next: ClaudeSettings = { ...settings };
  if (Object.keys(hooks).length > 0) next.hooks = hooks;
  else delete next.hooks;

  return { settings: next, removed };
}

function settingsPath(projectRoot: string): string {
  return join(projectRoot, ".claude", "settings.json");
}

/**
 * Read the project settings file. A malformed file aborts the install rather
 * than being overwritten — it may hold the user's entire hook setup.
 */
export function readSettings(
  projectRoot: string,
): { settings: ClaudeSettings } | { error: string } {
  const path = settingsPath(projectRoot);
  if (!existsSync(path)) return { settings: {} };
  try {
    const parsed = JSON.parse(readFileSync(path, "utf-8")) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return { error: `${path} does not contain a JSON object` };
    }
    return { settings: parsed as ClaudeSettings };
  } catch (err) {
    return { error: `${path} is not valid JSON: ${(err as Error).message}` };
  }
}

export function writeSettings(projectRoot: string, settings: ClaudeSettings): void {
  const path = settingsPath(projectRoot);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(settings, null, 2)}\n`, "utf-8");
}

export function installStopHook(
  projectRoot: string,
  tier: HookTier,
): { path: string; tier: HookTier } | { error: string } {
  const read = readSettings(projectRoot);
  if ("error" in read) return read;
  const merged = mergeStopHook(read.settings, buildHookEntry(tier));
  writeSettings(projectRoot, merged);
  return { path: settingsPath(projectRoot), tier };
}

export function uninstallStopHook(
  projectRoot: string,
): { path: string; removed: boolean } | { error: string } {
  const read = readSettings(projectRoot);
  if ("error" in read) return read;
  const { settings, removed } = removeStopHook(read.settings);
  if (removed) writeSettings(projectRoot, settings);
  return { path: settingsPath(projectRoot), removed };
}
