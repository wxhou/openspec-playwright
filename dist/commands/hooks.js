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
import { isPathInsideProjectRoot } from "../shared/path-guard.js";
/** Any command containing this fragment belongs to us. */
const OWN_MARKER = "openspec-pw gate";
const TIER_CHECKS = {
    static: "validate,lint,typecheck,test",
    full: "validate,lint,typecheck,test,flake,e2e",
};
/** Timeout is generous but finite: a hook that never returns traps the turn. */
const TIER_TIMEOUT_SECONDS = {
    static: 300,
    full: 900,
};
export function isHookTier(value) {
    return value === "static" || value === "full";
}
export function buildHookEntry(tier) {
    return {
        type: "command",
        command: `openspec-pw gate --hook --only ${TIER_CHECKS[tier]}`,
        timeout: TIER_TIMEOUT_SECONDS[tier],
    };
}
export function isOwnHook(hook) {
    // Settings files are user-editable; a null entry in a Stop group is valid
    // JSON and must not crash detection.
    return (typeof hook === "object" &&
        hook !== null &&
        typeof hook.command === "string" &&
        hook.command.includes(OWN_MARKER));
}
/**
 * Insert or refresh our hook. Idempotent: a second call leaves one entry.
 * Everything we do not recognise is preserved byte-for-byte.
 */
export function mergeStopHook(settings, entry) {
    const hooks = { ...(settings.hooks ?? {}) };
    const stop = Array.isArray(hooks.Stop) ? [...hooks.Stop] : [];
    let replaced = false;
    const nextStop = stop.map((group) => {
        if (!group || typeof group !== "object" || !Array.isArray(group.hooks)) {
            return group;
        }
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
    }
    else {
        // Stop has no matcher support; an omitted matcher matches every turn.
        hooks.Stop = [...nextStop, { hooks: [entry] }];
    }
    return { ...settings, hooks };
}
/** Remove our hook and tidy up the empty containers it leaves behind. */
export function removeStopHook(settings) {
    const hooks = { ...(settings.hooks ?? {}) };
    const stop = Array.isArray(hooks.Stop) ? hooks.Stop : [];
    let removed = false;
    const nextStop = stop
        .map((group) => {
        if (!group || typeof group !== "object" || !Array.isArray(group.hooks)) {
            return group;
        }
        const kept = group.hooks.filter((h) => {
            if (isOwnHook(h)) {
                removed = true;
                return false;
            }
            return true;
        });
        return { ...group, hooks: kept };
    })
        .filter((group) => !group ||
        typeof group !== "object" ||
        !Array.isArray(group.hooks) ||
        group.hooks.length > 0);
    if (nextStop.length > 0)
        hooks.Stop = nextStop;
    else
        delete hooks.Stop;
    const next = { ...settings };
    if (Object.keys(hooks).length > 0)
        next.hooks = hooks;
    else
        delete next.hooks;
    return { settings: next, removed };
}
function settingsPath(projectRoot) {
    return join(projectRoot, ".claude", "settings.json");
}
/**
 * Read the project settings file. A malformed file aborts the install rather
 * than being overwritten — it may hold the user's entire hook setup.
 */
export function readSettings(projectRoot) {
    const path = settingsPath(projectRoot);
    if (!existsSync(path))
        return { settings: {} };
    try {
        const parsed = JSON.parse(readFileSync(path, "utf-8"));
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
            return { error: `${path} does not contain a JSON object` };
        }
        return { settings: parsed };
    }
    catch (err) {
        return { error: `${path} is not valid JSON: ${err.message}` };
    }
}
export function writeSettings(projectRoot, settings) {
    const path = settingsPath(projectRoot);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(settings, null, 2)}\n`, "utf-8");
}
export function installStopHook(projectRoot, tier) {
    const read = readSettings(projectRoot);
    if ("error" in read)
        return read;
    const merged = mergeStopHook(read.settings, buildHookEntry(tier));
    writeSettings(projectRoot, merged);
    return { path: settingsPath(projectRoot), tier };
}
/** True when the project carries our Stop hook — the detection predicate. */
export function isStopHookInstalled(projectRoot) {
    const read = readSettings(projectRoot);
    if ("error" in read)
        return false;
    const stop = read.settings.hooks?.Stop;
    return (Array.isArray(stop) &&
        stop.some((group) => !!group &&
            typeof group === "object" &&
            Array.isArray(group.hooks) &&
            group.hooks.some(isOwnHook)));
}
/**
 * True when the hook is installed and its settings file is inside the project.
 * The remove plan uses this so it does not promise a removal that the write
 * guard will refuse (a symlinked `.claude/` checkout).
 */
export function isStopHookRemovable(projectRoot) {
    return (isStopHookInstalled(projectRoot) &&
        isPathInsideProjectRoot(projectRoot, settingsPath(projectRoot)));
}
export function uninstallStopHook(projectRoot) {
    const read = readSettings(projectRoot);
    if ("error" in read)
        return read;
    const { settings, removed } = removeStopHook(read.settings);
    if (removed) {
        if (!isPathInsideProjectRoot(projectRoot, settingsPath(projectRoot))) {
            return {
                error: `${settingsPath(projectRoot)} resolves outside the project (symlink) — refusing to write`,
            };
        }
        writeSettings(projectRoot, settings);
    }
    return { path: settingsPath(projectRoot), removed };
}
//# sourceMappingURL=hooks.js.map