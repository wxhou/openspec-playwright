import { existsSync, lstatSync, readFileSync, rmSync, rmdirSync, statSync } from "fs";
import { homedir } from "os";
import { join, dirname, relative } from "path";
import { fileURLToPath } from "url";
import chalk from "chalk";
import { uninstallStopHook, isStopHookInstalled, isStopHookRemovable } from "./hooks.js";
import { buildCommandMeta, CLAUDE_LEGACY_SKILL_REL, cleanProjectRules, cleanupEmptyDirs, claudeAdapter, codebuddyAdapter, detectAdapters, enumerateVendoredAgents, getAllAdapters, installedAgentsSnapshotDir, listCommandArtifactPaths, OPENSPEC_PW_MCP_SERVERS, removeAdapterCommandArtifacts, removeOwnedVendoredAgents, hasCleanableMarkers, hasRuleFileMarkers, normalizeEol, wrapperRulesFile, } from "./editors.js";
import { removeMcp, detectCodeGraphStatus, removeManagedBlock, removeChecklist, removeGeneratedEslintConfig, removeRuffManagedBlock, isChecklistUnmodified, isToolGeneratedEslintConfig, isToolOwnedRuffBlock, LINT_ESLINT_CONFIG_FILE, LINT_GUIDELINES_RELPATH, } from "../shared/index.js";
import { discoverProjects, expandTilde } from "../shared/discover.js";
import { readTextFileCapped } from "../shared/file-read.js";
import { hasRemovableManagedBlock } from "../shared/gitignore-managed.js";
import { GITHUB_WORKFLOW_REL } from "../shared/constants.js";
import { isPathInsideProjectRoot } from "../shared/path-guard.js";
import { AUTO_PIPELINE_REL, AUTO_PIPELINE_TEMPLATE } from "./pipeline.js";
const WORKFLOW_TEMPLATE = "github-workflow.yml";
/** Managed paths holding secrets — warn when the block is gone but they stay. */
const SENSITIVE_MANAGED_PATHS = [
    ".mcp.json",
    "playwright/.auth",
    "tests/playwright/credentials.yaml",
    "tests/playwright/credentials.yaml.bak",
];
/**
 * A removal that failed. `modified` tells the batch orchestrator how far the
 * cleanup got; `unwritable` marks a permission failure, which the batch counts
 * as skipped only when nothing changed (no writability precheck — it is
 * unreliable on Windows). The original error is kept as `cause`.
 */
export class RemoveError extends Error {
    modified;
    unwritable;
    constructor(message, modified, 
    /** True when the failure was a filesystem permission error (project not writable). */
    unwritable = false, cause) {
        super(message);
        this.modified = modified;
        this.unwritable = unwritable;
        this.name = "RemoveError";
        if (cause !== undefined) {
            this.cause = cause;
        }
    }
}
/** Filesystem errors that mean "this project cannot be written", not "the tool broke". */
const UNWRITABLE_CODES = new Set(["EACCES", "EPERM", "EROFS", "EBUSY"]);
function isUnwritableError(err, depth = 0) {
    // Wrappers (removeMcp → MCP failure recheck → RemoveError) carry the
    // original errno through `cause`; multiple adapter failures arrive as an
    // AggregateError. Check the whole chain.
    if (!err || depth > 4)
        return false;
    const code = err.code;
    if (typeof code === "string" && UNWRITABLE_CODES.has(code))
        return true;
    const nested = err.errors;
    if (Array.isArray(nested) && nested.some((inner) => isUnwritableError(inner, depth + 1))) {
        return true;
    }
    return isUnwritableError(err.cause, depth + 1);
}
/**
 * Remove every openspec-pw product from one project. Tool-owned artifacts
 * are deleted, user-modified copies are kept with a notice, and user data
 * (credentials, tests, openspec specs) is never touched. Idempotent: an
 * already-clean project produces only skip lines.
 *
 * `all` is the batch mode: it skips the legacy `playwright` entry, whose name
 * cannot be told apart from a user's own server.
 *
 * Returns the project-relative paths (and coarse markers like `mcp:…`) that
 * were changed, so a failed run can report how far it got.
 */
export async function removeInProject(projectRoot, options = {}) {
    console.log(chalk.blue("\n🗑️  Removing OpenSpec + Playwright E2E\n"));
    const modified = [];
    const track = (marker) => {
        modified.push(marker);
    };
    try {
        const detected = detectAdapters(projectRoot);
        // Body unused — only need paths from commandFilePath / extraArtifacts
        const meta = buildCommandMeta("");
        // 1. Remove Playwright MCP servers — both the browser-control server and
        // the official test-runner server. Every adapter, not only detected ones:
        // an editor can carry a project MCP entry (e.g. opencode.json) without its
        // marker directory, and detection would otherwise report a no-op project
        // as cleaned while the entry stays behind. Silent for editors that are not
        // detected and hold nothing, so batch runs stay readable.
        console.log(chalk.blue("\n─── Removing Playwright MCP ───"));
        const detectedIds = new Set(detected.map((adapter) => adapter.id));
        const trackedMcp = new Set();
        // In batch mode the legacy `playwright` name is left alone: it is
        // indistinguishable from a user's own @playwright/mcp server.
        const servers = options.all ? ["playwright-test"] : [...OPENSPEC_PW_MCP_SERVERS];
        const mcpFailures = [];
        const skippedMcpConfigs = new Set();
        for (const adapter of getAllAdapters()) {
            if (adapter.supportsMcp === false) {
                if (detectedIds.has(adapter.id)) {
                    console.log(chalk.gray(`  - ${adapter.label}: MCP not supported (nothing to remove)`));
                }
                continue;
            }
            const installed = servers.filter((serverName) => {
                try {
                    return adapter.isMcpInstalled(projectRoot, serverName);
                }
                catch {
                    // Unreadable MCP config for this editor — treat as absent.
                    return false;
                }
            });
            if (installed.length === 0) {
                if (detectedIds.has(adapter.id)) {
                    console.log(chalk.gray(`  - ${adapter.label}: no Playwright MCP entries (nothing to remove)`));
                }
                continue;
            }
            // A config that resolves outside the project is never rewritten — the
            // carrier's own guard would refuse the write, so skip it with a notice
            // (same posture as symlinked rules files) instead of a failure.
            const configPath = adapter.mcpConfigPath?.(projectRoot);
            if (configPath && !isPathInsideProjectRoot(projectRoot, configPath)) {
                if (!skippedMcpConfigs.has(configPath)) {
                    skippedMcpConfigs.add(configPath);
                    console.log(chalk.yellow(`  ⚠ ${relative(projectRoot, configPath)} resolves outside the project (symlink) — MCP entries skipped`));
                }
                continue;
            }
            for (const serverName of installed) {
                const result = removeMcp(adapter, projectRoot, serverName);
                if (result.removed) {
                    // Editors sharing one config file (claude/codebuddy/minimax read the
                    // project .mcp.json) must not record the same physical entry twice.
                    const key = mcpEntryKey(adapter, projectRoot, serverName);
                    if (!trackedMcp.has(key)) {
                        trackedMcp.add(key);
                        track(key);
                    }
                }
                else {
                    mcpFailures.push({ adapter, serverName, error: result.error });
                }
            }
        }
        // 2. Remove E2E command (+ extraArtifacts) for each detected editor —
        // delegates to the removal.ts primitive (same rm + empty-dir cascade +
        // per-path success line as the original inline loop).
        console.log(chalk.blue("\n─── Removing E2E Commands ───"));
        for (const adapter of detected) {
            const relPaths = listCommandArtifactPaths(adapter, meta);
            let removedAny = false;
            for (const relPath of relPaths) {
                if (existsSync(join(projectRoot, relPath))) {
                    removedAny = true;
                }
            }
            if (removedAny) {
                // Track only after an actual removal: a first-file failure touched
                // nothing and must classify as skipped, not failed.
                let marked = false;
                const markOnce = () => {
                    if (!marked) {
                        marked = true;
                        track(`commands:${adapter.id}`);
                    }
                };
                for (const relPath of removeAdapterCommandArtifacts(adapter, projectRoot, markOnce)) {
                    track(relPath);
                }
            }
            else {
                console.log(chalk.gray(`  - ${adapter.label}: E2E command not found, skipping`));
            }
        }
        // 2b. Remove the vendored Playwright agent files (opt-in `init --agents`
        // installs). Tool-owned files go; user-modified files are kept and named.
        console.log(chalk.blue("\n─── Removing Vendored Agents ───"));
        if (detected.some((a) => a.id === "claude")) {
            let markedAgents = false;
            const markAgents = () => {
                if (!markedAgents) {
                    markedAgents = true;
                    track("vendored-agents");
                }
            };
            const removedAgents = removeOwnedVendoredAgents(projectRoot, claudeAdapter, markAgents);
            if (removedAgents.length === 0) {
                console.log(chalk.gray("  - No tool-owned vendored agents found (nothing to remove)"));
            }
            removedAgents.forEach(track);
        }
        else {
            console.log(chalk.gray("  - Claude not detected, skipping"));
        }
        // 2c. Remove the swallow-error lint checklist (lint-guidelines capability).
        // Editor-agnostic asset — no adapter owns it, so this runs outside the
        // per-adapter loops above. app-knowledge/app-exploration stay (user-generated
        // domain content); this file is a static tool reference, so tool-owned copies
        // go and user-modified copies are kept and named (same split as 2b).
        console.log(chalk.blue("\n─── Removing Lint Guidelines ───"));
        const checklistResult = removeChecklist(projectRoot);
        if (checklistResult === "removed") {
            track(LINT_GUIDELINES_RELPATH);
            console.log(chalk.green(`  ✓ Removed ${LINT_GUIDELINES_RELPATH}`));
        }
        else if (checklistResult === "kept-modified") {
            console.log(chalk.yellow(`  ⚠ ${LINT_GUIDELINES_RELPATH} is locally modified — kept`));
        }
        else if (checklistResult === "kept-unsafe") {
            console.log(chalk.yellow(`  ⚠ ${LINT_GUIDELINES_RELPATH} resolves outside the project (symlink) — skipping`));
        }
        else if (checklistResult === "kept-too-large") {
            console.log(chalk.yellow(`  ⚠ ${LINT_GUIDELINES_RELPATH} is too large to verify ownership — kept`));
        }
        else {
            console.log(chalk.gray("  - Lint guidelines not found, skipping"));
        }
        // 2d. Remove generated CI workflows — tool-named and tool-written, so a
        // byte-identical copy is tool-owned; an edited one is kept and named.
        console.log(chalk.blue("\n─── Removing CI Workflows ───"));
        for (const [rel, templateFile] of [
            [GITHUB_WORKFLOW_REL, WORKFLOW_TEMPLATE],
            [AUTO_PIPELINE_REL, AUTO_PIPELINE_TEMPLATE],
        ]) {
            const dest = join(projectRoot, rel);
            if (!existsSync(dest)) {
                console.log(chalk.gray(`  - ${rel} not found, skipping`));
            }
            else if (!isPathInsideProjectRoot(projectRoot, dest)) {
                console.log(chalk.yellow(`  ⚠ ${rel} resolves outside the project (symlink) — skipping`));
            }
            else if (isPristineCopy(projectRoot, rel, templateFile)) {
                rmSync(dest);
                cleanupEmptyDirs(dirname(dest), projectRoot);
                track(rel);
                console.log(chalk.green(`  ✓ Removed ${rel}`));
            }
            else {
                console.log(chalk.yellow(`  ⚠ ${rel} differs from the bundled template — kept (user-modified)`));
            }
        }
        // 2e. Remove lint-config products written by `init --lint-config`: the
        // ruff managed block (clear begin/end territory) and a generated
        // eslint config that still matches a tool-generated shape. User-edited
        // copies are kept and named.
        console.log(chalk.blue("\n─── Removing Lint Config ───"));
        const ruffRemovals = removeRuffManagedBlock(projectRoot, (file) => track(relative(projectRoot, file)));
        if (ruffRemovals.length === 0) {
            console.log(chalk.gray("  - No ruff managed block found, skipping"));
        }
        const lintReadFailures = [];
        for (const { file, status, error } of ruffRemovals) {
            if (status === "kept-modified") {
                console.log(chalk.yellow(`  ⚠ ${relative(projectRoot, file)} ruff block is locally modified — kept`));
                continue;
            }
            if (status === "kept-unsafe") {
                console.log(chalk.yellow(`  ⚠ ${relative(projectRoot, file)} resolves outside the project (symlink) — skipping`));
                continue;
            }
            if (status === "kept-too-large") {
                console.log(chalk.yellow(`  ⚠ ${relative(projectRoot, file)} is too large to verify ownership — kept`));
                continue;
            }
            if (status === "unreadable") {
                // Cannot tell whether the block is there; defer the failure until the
                // rest of the cleanup ran, so its accounting stays honest.
                lintReadFailures.push({ file, error });
                continue;
            }
            console.log(chalk.green(`  ✓ Removed ruff managed block from ${relative(projectRoot, file)}`));
        }
        const eslintResult = removeGeneratedEslintConfig(projectRoot);
        if (eslintResult.status === "removed") {
            track(LINT_ESLINT_CONFIG_FILE);
            console.log(chalk.green(`  ✓ Removed ${LINT_ESLINT_CONFIG_FILE}`));
        }
        else if (eslintResult.status === "kept-modified") {
            console.log(chalk.yellow(`  ⚠ ${LINT_ESLINT_CONFIG_FILE} differs from the generated config — kept (user-modified)`));
        }
        else if (eslintResult.status === "kept-unsafe") {
            console.log(chalk.yellow(`  ⚠ ${LINT_ESLINT_CONFIG_FILE} resolves outside the project (symlink) — skipping`));
        }
        else if (eslintResult.status === "kept-too-large") {
            console.log(chalk.yellow(`  ⚠ ${LINT_ESLINT_CONFIG_FILE} is too large to verify ownership — kept`));
        }
        else if (eslintResult.status === "not-generated") {
            console.log(chalk.gray(`  - ${LINT_ESLINT_CONFIG_FILE} is user-authored, skipping`));
        }
        else {
            console.log(chalk.gray(`  - ${LINT_ESLINT_CONFIG_FILE} not found, skipping`));
        }
        // 3. Remove legacy skill directory (if present from older versions)
        console.log(chalk.blue("\n─── Removing Legacy Skill ───"));
        const skillDir = join(projectRoot, CLAUDE_LEGACY_SKILL_REL);
        if (!existsSync(skillDir)) {
            console.log(chalk.gray("  - Legacy skill directory not found, skipping"));
        }
        else if (!isPathInsideProjectRoot(projectRoot, skillDir)) {
            console.log(chalk.yellow("  ⚠ .claude/skills/openspec-e2e/ resolves outside the project (symlink) — skipping"));
        }
        else {
            rmSync(skillDir, { recursive: true, force: true });
            track(CLAUDE_LEGACY_SKILL_REL);
            console.log(chalk.green("  ✓ Removed .claude/skills/openspec-e2e/"));
        }
        // 4. Remove schema
        console.log(chalk.blue("\n─── Removing Schema ───"));
        const schemaDir = join(projectRoot, "openspec", "schemas", "playwright-e2e");
        if (!existsSync(schemaDir)) {
            console.log(chalk.gray("  - Schema not found, skipping"));
        }
        else if (!isPathInsideProjectRoot(projectRoot, schemaDir)) {
            console.log(chalk.yellow("  ⚠ openspec/schemas/playwright-e2e/ resolves outside the project (symlink) — skipping"));
        }
        else {
            rmSync(schemaDir, { recursive: true, force: true });
            track("openspec/schemas/playwright-e2e");
            console.log(chalk.green("  ✓ Removed openspec/schemas/playwright-e2e/"));
        }
        // 4b. Remove the minimal-mode scaffold (tests/README.md) — content-owned:
        // byte-identical to the bundled template → tool-owned → removed; anything
        // else is user-owned → kept with a notice.
        console.log(chalk.blue("\n─── Removing Minimal Scaffold ───"));
        const readmeDest = join(projectRoot, "tests", "README.md");
        if (!existsSync(readmeDest)) {
            console.log(chalk.gray("  - tests/README.md not found, skipping"));
        }
        else if (!isPathInsideProjectRoot(projectRoot, readmeDest)) {
            console.log(chalk.yellow("  ⚠ tests/README.md resolves outside the project (symlink) — skipping"));
        }
        else {
            const template = readTextFileCapped(fileURLToPath(new URL("../../templates/tests-readme.md", import.meta.url)));
            if (template.kind !== "ok") {
                throw new Error("bundled tests README template is unreadable");
            }
            const read = readTextFileCapped(readmeDest);
            if (read.kind === "unreadable") {
                throw new Error("cannot read tests/README.md to verify ownership", {
                    cause: read.error,
                });
            }
            if (read.kind === "ok" &&
                normalizeEol(read.content) === normalizeEol(template.content)) {
                rmSync(readmeDest);
                track("tests/README.md");
                try {
                    rmdirSync(dirname(readmeDest)); // only succeeds when empty
                }
                catch {
                    // user content in tests/ — leave the directory
                }
                console.log(chalk.green("  ✓ Removed tests/README.md"));
            }
            else {
                console.log(chalk.yellow("  ⚠ tests/README.md differs from the bundled template — kept (user-modified or user-owned)"));
            }
        }
        // 5. Clean rules file markers for each detected editor
        console.log(chalk.blue("\n─── Cleaning Rules Files ───"));
        let markedRules = false;
        let agentsCleaned = false;
        const markRules = () => {
            if (!markedRules) {
                markedRules = true;
                track("rules-markers");
            }
        };
        const cleanRules = (adapter) => {
            cleanProjectRules(adapter, projectRoot, {
                agents: !agentsCleaned,
                onChanged: markRules,
            });
            agentsCleaned = true;
        };
        for (const adapter of detected) {
            cleanRules(adapter);
        }
        // Minimal-mode projects carry standards without command artifacts (and
        // without a marker dir for the wrapper editors) — detection may miss
        // claude/codebuddy entirely (or the project may mix a detected editor
        // with a wrapper-only editor). Clean the rules files whenever a wrapper
        // editor is not among the detected editors but our territory is present;
        // removeMarkersFromFile stays quiet-ish (gray info lines) when the files
        // carry no markers.
        if (!detected.some((a) => a.id === "claude") && hasRuleFileMarkers(projectRoot)) {
            cleanRules(claudeAdapter);
        }
        if (!detected.some((a) => a.id === "codebuddy") && hasRuleFileMarkers(projectRoot)) {
            cleanRules(codebuddyAdapter);
        }
        // 5b. Remove the managed .gitignore block. Idempotent — no block is a
        // silent no-op. Credentials stay on disk: deleting user credentials is
        // data loss — they just lose the ignore protection.
        console.log(chalk.blue("\n─── Removing Managed .gitignore Block ───"));
        const blockResult = removeManagedBlock(projectRoot);
        if (blockResult.removed) {
            track(".gitignore");
            console.log(chalk.green("  ✓ Removed openspec-pw managed block from .gitignore"));
            // Everything the block ignored is now committable. Secrets that stay on
            // disk (user MCP servers, auth state, credentials) need a warning, or a
            // later `git add -A` could leak them.
            for (const rel of SENSITIVE_MANAGED_PATHS) {
                if (existsSync(join(projectRoot, rel))) {
                    console.log(chalk.yellow(`  ⚠ ${rel} kept on disk — no longer ignore-protected, review before committing`));
                }
            }
        }
        else if (blockResult.tooLarge) {
            console.log(chalk.yellow("  ⚠ .gitignore is too large to verify ownership — kept"));
        }
        else if (existsSync(join(projectRoot, ".gitignore")) &&
            !isPathInsideProjectRoot(projectRoot, join(projectRoot, ".gitignore"))) {
            console.log(chalk.yellow("  ⚠ .gitignore resolves outside the project (symlink) — skipping"));
        }
        else {
            console.log(chalk.gray("  - No managed block found, skipping"));
        }
        console.log(chalk.blue("\n─── Removing Stop Hook ───"));
        if (isStopHookInstalled(projectRoot) && !isStopHookRemovable(projectRoot)) {
            // A symlinked `.claude/settings.json` belongs to a shared checkout —
            // never rewrite it; the same policy as symlinked rules files.
            console.log(chalk.yellow("  ⚠ Stop hook settings resolve outside the project (symlink) — skipping"));
        }
        else {
            const hookResult = uninstallStopHook(projectRoot);
            if ("error" in hookResult) {
                // The hook may still be installed — report a failure, not success.
                throw new Error(`Stop hook could not be removed: ${hookResult.error}`);
            }
            else if (hookResult.removed) {
                const hookRel = relative(projectRoot, hookResult.path);
                track(hookRel);
                console.log(chalk.green(`  ✓ Removed openspec-pw Stop hook from ${hookRel}`));
            }
            else {
                console.log(chalk.gray("  - No openspec-pw Stop hook found, skipping"));
            }
        }
        // A failure can be another adapter's success: when one editor's carrier
        // cannot write a shared config, a later adapter may have removed the same
        // entry. Only entries still on disk are real failures.
        const remaining = mcpFailures.filter(({ adapter, serverName }) => {
            try {
                return adapter.isMcpInstalled(projectRoot, serverName);
            }
            catch {
                return true;
            }
        });
        if (remaining.length > 0) {
            // The entries are still there; reporting success would make --all
            // claim a destructive operation that did not happen. Keep the adapter
            // error as `cause` so the batch can tell a permission failure from a
            // genuine one (RemoveError derives `unwritable` from the chain).
            const message = `failed to remove MCP entry: ${remaining
                .map(({ adapter, serverName }) => `${adapter.label}: ${serverName}`)
                .join(", ")}`;
            const causes = remaining
                .map((failure) => failure.error)
                .filter((error) => error !== undefined);
            const cause = causes.length === 0
                ? undefined
                : causes.length === 1
                    ? causes[0]
                    : new AggregateError(causes, message);
            throw cause === undefined ? new Error(message) : new Error(message, { cause });
        }
        if (lintReadFailures.length > 0) {
            // The file exists but could not be read, so "no managed block" would be
            // a guess. Fail after the rest of the cleanup, keeping its accounting.
            const files = lintReadFailures
                .map(({ file }) => relative(projectRoot, file))
                .join(", ");
            const causes = lintReadFailures.map(({ error }) => error);
            const cause = causes.length === 1
                ? causes[0]
                : new AggregateError(causes, "lint config unreadable");
            throw new Error(`failed to inspect lint config: ${files}`, { cause });
        }
        // Summary — batch mode prints its own per-project verdict afterwards, so
        // an unconditional "Remove complete!" here would contradict it.
        if (!options.all) {
            console.log(chalk.blue("\n─── Summary ───"));
            console.log(chalk.green("  ✓ Remove complete!\n"));
            console.log(chalk.gray("  Note: Run openspec-pw doctor to verify clean removal.\n"));
        }
        // CodeGraph MCP is a codegraph-owned asset — never touch it here, only
        // point the user at the removal command.
        const cg = detectCodeGraphStatus(projectRoot);
        if (cg.mcpInstalledAdapters.length > 0) {
            console.log(chalk.gray("  Note: codegraph MCP remains in your agents — remove with: codegraph uninstall"));
        }
    }
    catch (err) {
        throw new RemoveError(err instanceof Error ? err.message : String(err), modified, isUnwritableError(err), err);
    }
    return modified;
}
/** Single-project entry: returns the process exit code (0 ok, 1 failed). */
export async function removeSingle(projectRoot = process.cwd()) {
    try {
        await removeInProject(projectRoot);
        return 0;
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(chalk.red(`  ✗ Remove failed: ${msg}`));
        return 1;
    }
}
/** Usage error for an invalid option combination; null when valid. */
export function removeOptionError(options) {
    if (!options.all && (options.yes === true || (options.root?.length ?? 0) > 0)) {
        return "remove: --yes and --root require --all";
    }
    // UNC roots have no local filesystem bound: an offline share would hang the
    // scan and the README promises network roots are never touched.
    if (options.root?.some((root) => /^(?:\\\\|\/\/)/.test(root))) {
        return "remove: --root does not support UNC network paths";
    }
    return null;
}
/**
 * Machine-wide removal. Without `yes` this only prints the plan and never
 * writes; with `yes` every discovered project is cleaned, one project's
 * failure never stops the rest, and a nonzero exit code signals failures.
 */
export async function runRemoveAll(options = {}) {
    const cwd = options.cwd ?? process.cwd();
    const roots = options.root?.length ? options.root : undefined;
    // A typo in --root must not read as "nothing to clean"; neither must a
    // path that is a file (discover would report it as unreadable and exit 0).
    const invalidRoots = (roots ?? []).filter((root) => {
        try {
            return !statSync(expandTilde(root, homedir())).isDirectory();
        }
        catch {
            return true;
        }
    });
    if (invalidRoots.length > 0) {
        console.error(chalk.red(`  ✗ --root path not found or not a directory: ${invalidRoots.join(", ")}`));
        return 2;
    }
    console.log(chalk.blue("\n🔍 Scanning for OpenSpec + Playwright E2E projects\n"));
    const discovery = discoverProjects({ roots, cwd });
    if (discovery.truncated) {
        console.log(chalk.yellow("  ⚠ Directory scan cap reached — results may be incomplete; narrow with --root.\n"));
    }
    if (discovery.unreadableDirs > 0) {
        console.log(chalk.yellow(`  ⚠ ${discovery.unreadableDirs} director${discovery.unreadableDirs === 1 ? "y" : "ies"} could not be read — results may be incomplete.\n`));
    }
    if (discovery.projects.length === 0) {
        console.log(chalk.gray("  - No projects with openspec-pw territory found.\n"));
        return 0;
    }
    console.log(chalk.gray(`  Found ${discovery.projects.length} project(s).\n`));
    if (!options.yes) {
        for (const project of discovery.projects) {
            console.log(chalk.blue(`─── ${project} ───`));
            // One unreadable or odd file must not abort the rest of the plan.
            let plan;
            try {
                plan = describePlan(project).join(", ");
            }
            catch (err) {
                plan = `(plan unavailable: ${err instanceof Error ? err.message : String(err)})`;
            }
            console.log(chalk.gray(`  would remove: ${plan}`));
        }
        console.log(chalk.gray("\n  Dry run — nothing was changed. Re-run with --yes to remove.\n"));
        return 0;
    }
    let removed = 0;
    let skipped = 0;
    let failed = 0;
    for (const project of discovery.projects) {
        console.log(chalk.blue(`─── ${project} ───`));
        try {
            const modified = await removeInProject(project, { all: true });
            if (modified.length === 0) {
                // Discovered but nothing removable (all copies user-modified, or
                // symlinked). Counting it as removed would overstate the sweep.
                skipped++;
                console.log(chalk.yellow("  ⚠ Skipped: nothing removable"));
            }
            else {
                removed++;
            }
        }
        catch (err) {
            const modified = err instanceof RemoveError ? err.modified : [];
            const message = err instanceof Error ? err.message : String(err);
            // Skipped means "this project cannot be written", not "some code
            // failed": only a permission error before any change is a skip. A
            // broken settings file or a logic error must stay visible as failed.
            const unwritable = err instanceof RemoveError && err.unwritable && modified.length === 0;
            if (unwritable) {
                skipped++;
                console.log(chalk.yellow(`  ⚠ Skipped: ${message}`));
            }
            else {
                failed++;
                console.log(chalk.red(`  ✗ Failed after ${modified.length} change(s): ${message}`));
            }
        }
    }
    console.log(chalk.blue("\n─── Summary ───"));
    console.log(`  removed ${removed} / skipped ${skipped} / failed ${failed}`);
    return failed > 0 ? 1 : 0;
}
/** Read-only summary of the tool-owned artifacts present in one project. */
function describePlan(projectRoot) {
    const groups = [];
    const detected = detectAdapters(projectRoot);
    const meta = buildCommandMeta("");
    let commands = 0;
    for (const adapter of detected) {
        commands += listCommandArtifactPaths(adapter, meta).filter((rel) => {
            const abs = join(projectRoot, rel);
            return existsSync(abs) && isPathInsideProjectRoot(projectRoot, abs);
        }).length;
    }
    // MCP entries are removed for every adapter (an editor can carry a project
    // entry without its marker directory), so the plan must count them the same
    // way. Batch mode leaves the ambiguous legacy `playwright` name alone.
    const mcpKeys = new Set();
    for (const adapter of getAllAdapters()) {
        if (adapter.supportsMcp === false)
            continue;
        const sharedPath = adapter.mcpConfigPath?.(projectRoot);
        // A shared config pointing outside the project is never rewritten.
        if (sharedPath && !isPathInsideProjectRoot(projectRoot, sharedPath))
            continue;
        for (const serverName of ["playwright-test"]) {
            try {
                if (adapter.isMcpInstalled(projectRoot, serverName)) {
                    mcpKeys.add(mcpEntryKey(adapter, projectRoot, serverName));
                }
            }
            catch {
                // Unreadable MCP config — leave it out of the plan.
            }
        }
    }
    const mcp = mcpKeys.size;
    if (commands > 0)
        groups.push(`commands ${commands}`);
    if (mcp > 0)
        groups.push(`MCP ${mcp}`);
    if (existsSync(join(projectRoot, CLAUDE_LEGACY_SKILL_REL)) &&
        isPathInsideProjectRoot(projectRoot, join(projectRoot, CLAUDE_LEGACY_SKILL_REL))) {
        groups.push("legacy skill");
    }
    if (existsSync(join(projectRoot, "openspec", "schemas", "playwright-e2e")) &&
        isPathInsideProjectRoot(projectRoot, join(projectRoot, "openspec", "schemas", "playwright-e2e"))) {
        groups.push("schema");
    }
    // Content-owned artifacts: list them only when removal would really delete
    // them (a user-modified copy is kept), so the plan matches the execution.
    if (isPristineCopy(projectRoot, join("tests", "README.md"), "tests-readme.md")) {
        groups.push("tests/README.md");
    }
    if (hasCleanableRuleMarkers(projectRoot))
        groups.push("rules markers");
    const checklistPath = join(projectRoot, LINT_GUIDELINES_RELPATH);
    if (existsSync(checklistPath) &&
        isPathInsideProjectRoot(projectRoot, checklistPath)) {
        const read = readTextFileCapped(checklistPath);
        if (read.kind === "ok" && isChecklistUnmodified(read.content)) {
            groups.push("lint checklist");
        }
    }
    if (isPristineCopy(projectRoot, GITHUB_WORKFLOW_REL, WORKFLOW_TEMPLATE)) {
        groups.push("CI workflow");
    }
    if (isPristineCopy(projectRoot, AUTO_PIPELINE_REL, AUTO_PIPELINE_TEMPLATE)) {
        groups.push("auto pipeline workflow");
    }
    if (hasRuffBlock(projectRoot))
        groups.push("ruff managed block");
    const eslintPath = join(projectRoot, LINT_ESLINT_CONFIG_FILE);
    if (existsSync(eslintPath) &&
        isPathInsideProjectRoot(projectRoot, eslintPath)) {
        const read = readTextFileCapped(eslintPath);
        if (read.kind === "ok" && isToolGeneratedEslintConfig(read.content)) {
            groups.push("generated eslint config");
        }
    }
    const agents = enumerateVendoredAgents(projectRoot, installedAgentsSnapshotDir());
    const ownedAgents = agents.owned.filter((rel) => isPathInsideProjectRoot(projectRoot, join(projectRoot, rel)));
    if (ownedAgents.length > 0)
        groups.push("vendored agents");
    if (hasManagedGitignoreBlock(projectRoot))
        groups.push(".gitignore block");
    if (isStopHookRemovable(projectRoot))
        groups.push("stop hook");
    if (groups.length === 0)
        groups.push("(nothing detected — will be skipped)");
    return groups;
}
/** True when the file exists and is byte-identical (EOL-normalized) to its template. */
function isPristineCopy(projectRoot, relPath, templateFile) {
    const dest = join(projectRoot, relPath);
    if (!existsSync(dest) || !isPathInsideProjectRoot(projectRoot, dest)) {
        return false;
    }
    const template = readTextFileCapped(fileURLToPath(new URL(`../../templates/${templateFile}`, import.meta.url)));
    if (template.kind !== "ok") {
        throw new Error(`bundled template ${templateFile} is unreadable`);
    }
    const read = readTextFileCapped(dest);
    if (read.kind === "missing")
        return false;
    // An unreadable file is not "user-modified" — map it to an honest failure.
    if (read.kind === "unreadable") {
        throw new Error(`cannot read ${relPath} to verify ownership`, {
            cause: read.error,
        });
    }
    // Templates are small; a larger file cannot be a byte-identical copy.
    if (read.kind === "too-large")
        return false;
    return normalizeEol(read.content) === normalizeEol(template.content);
}
/** Identity of one physical MCP entry — shared config files count once. */
function mcpEntryKey(adapter, projectRoot, serverName) {
    const shared = adapter.mcpConfigPath?.(projectRoot);
    return shared ? `mcp:${shared}:${serverName}` : `mcp:${adapter.id}:${serverName}`;
}
/** Markers removal can actually clear — non-symlink rules files only. */
function hasCleanableRuleMarkers(projectRoot) {
    const files = new Set([join(projectRoot, "AGENTS.md")]);
    for (const adapter of getAllAdapters()) {
        const wrapper = wrapperRulesFile(adapter, projectRoot);
        if (wrapper)
            files.add(wrapper);
    }
    for (const file of files) {
        try {
            if (!existsSync(file) || lstatSync(file).isSymbolicLink())
                continue;
            const content = readFileSync(file, "utf-8");
            if (hasCleanableMarkers(content)) {
                return true;
            }
        }
        catch {
            // Unreadable file — not a removable marker source.
        }
    }
    return false;
}
function hasRuffBlock(projectRoot) {
    return ["pyproject.toml", ".ruff.toml", "ruff.toml"].some((name) => {
        const file = join(projectRoot, name);
        if (!existsSync(file) || !isPathInsideProjectRoot(projectRoot, file)) {
            return false;
        }
        const read = readTextFileCapped(file);
        return read.kind === "ok" && isToolOwnedRuffBlock(read.content);
    });
}
function hasManagedGitignoreBlock(projectRoot) {
    const file = join(projectRoot, ".gitignore");
    if (!existsSync(file) || !isPathInsideProjectRoot(projectRoot, file)) {
        return false;
    }
    const read = readTextFileCapped(file);
    return read.kind === "ok" && hasRemovableManagedBlock(read.content);
}
//# sourceMappingURL=remove.js.map