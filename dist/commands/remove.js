import { existsSync, readFileSync, rmSync, rmdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import chalk from "chalk";
import { uninstallStopHook, isStopHookInstalled } from "./hooks.js";
import { buildCommandMeta, CLAUDE_LEGACY_SKILL_REL, cleanProjectRules, claudeAdapter, codebuddyAdapter, detectAdapters, enumerateVendoredAgents, getAllAdapters, installedAgentsSnapshotDir, listCommandArtifactPaths, OPENSPEC_PW_MCP_SERVERS, removeAdapterCommandArtifacts, removeOwnedVendoredAgents, hasRuleFileMarkers, normalizeEol, } from "./editors.js";
import { removePlaywrightMcp, removeTestRunnerMcp, detectCodeGraphStatus, removeManagedBlock, removeChecklist, removeGeneratedEslintConfig, removeRuffManagedBlock, isChecklistUnmodified, isToolGeneratedEslintConfig, findRuffManagedBlock, LINT_ESLINT_CONFIG_FILE, LINT_GUIDELINES_RELPATH, } from "../shared/index.js";
import { discoverProjects } from "../shared/discover.js";
import { GITIGNORE_BLOCK_BEGIN } from "../shared/gitignore-managed.js";
const WORKFLOW_REL = join(".github", "workflows", "openspec-pw.yml");
/**
 * A removal that failed after some files were already changed. `modified`
 * lets the batch orchestrator tell "nothing touchable" (skipped) from
 * "half-cleaned" (failed) without a writability precheck, which is
 * unreliable on Windows.
 */
export class RemoveError extends Error {
    modified;
    constructor(message, modified) {
        super(message);
        this.modified = modified;
        this.name = "RemoveError";
    }
}
/**
 * Remove every openspec-pw product from one project. Tool-owned artifacts
 * are deleted, user-modified copies are kept with a notice, and user data
 * (credentials, tests, openspec specs) is never touched. Idempotent: an
 * uninstalled project produces only skip lines.
 *
 * Returns the project-relative paths (and coarse markers like `mcp:…`) that
 * were changed, so a failed run can report how far it got.
 */
export async function removeInProject(projectRoot) {
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
        // as cleaned while the entry stays behind.
        console.log(chalk.blue("\n─── Removing Playwright MCP ───"));
        for (const adapter of getAllAdapters()) {
            if (adapter.supportsMcp !== false) {
                for (const serverName of OPENSPEC_PW_MCP_SERVERS) {
                    try {
                        if (adapter.isMcpInstalled(projectRoot, serverName)) {
                            track(`mcp:${adapter.id}:${serverName}`);
                        }
                    }
                    catch {
                        // Unreadable MCP config for this editor — skip its probe.
                    }
                }
            }
            removePlaywrightMcp(adapter, projectRoot);
            removeTestRunnerMcp(adapter, projectRoot);
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
                // Record before the multi-file primitive: if a later file throws, the
                // project is already partially cleaned and must count as failed,
                // never as skipped.
                track(`commands:${adapter.id}`);
                for (const relPath of removeAdapterCommandArtifacts(adapter, projectRoot)) {
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
            const agentFiles = (claudeAdapter.optionalArtifacts?.(true) ?? []).map((extra) => extra.relativePath);
            if (agentFiles.some((rel) => existsSync(join(projectRoot, rel)))) {
                // Pre-record: a throw mid-primitive still means partial cleanup.
                track("vendored-agents");
            }
            const removedAgents = removeOwnedVendoredAgents(projectRoot, claudeAdapter);
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
        else {
            console.log(chalk.gray("  - Lint guidelines not found, skipping"));
        }
        // 2d. Remove the generated CI workflow — tool-named and tool-written, so
        // a byte-identical copy is tool-owned; an edited one is kept and named.
        console.log(chalk.blue("\n─── Removing CI Workflow ───"));
        const workflowDest = join(projectRoot, WORKFLOW_REL);
        if (existsSync(workflowDest)) {
            const template = readFileSync(fileURLToPath(new URL("../../templates/github-workflow.yml", import.meta.url)), "utf-8");
            if (normalizeEol(readFileSync(workflowDest, "utf-8")) === normalizeEol(template)) {
                rmSync(workflowDest);
                track(WORKFLOW_REL);
                console.log(chalk.green(`  ✓ Removed ${WORKFLOW_REL}`));
            }
            else {
                console.log(chalk.yellow(`  ⚠ ${WORKFLOW_REL} differs from the bundled template — kept (user-modified)`));
            }
        }
        else {
            console.log(chalk.gray("  - CI workflow not found, skipping"));
        }
        // 2e. Remove lint-config products written by `init --lint-config`: the
        // ruff managed block (clear begin/end territory) and a generated
        // eslint config that still matches a tool-generated shape. User-edited
        // copies are kept and named.
        console.log(chalk.blue("\n─── Removing Lint Config ───"));
        if (hasRuffBlock(projectRoot)) {
            // Pre-record: the primitive edits several candidate files in a loop.
            track("ruff-managed-block");
        }
        const ruffRemovals = removeRuffManagedBlock(projectRoot);
        if (ruffRemovals.length === 0) {
            console.log(chalk.gray("  - No ruff managed block found, skipping"));
        }
        for (const { file } of ruffRemovals) {
            track(file);
            console.log(chalk.green(`  ✓ Removed ruff managed block from ${file}`));
        }
        const eslintResult = removeGeneratedEslintConfig(projectRoot);
        if (eslintResult.status === "removed") {
            track(LINT_ESLINT_CONFIG_FILE);
            console.log(chalk.green(`  ✓ Removed ${LINT_ESLINT_CONFIG_FILE}`));
        }
        else if (eslintResult.status === "kept-modified") {
            console.log(chalk.yellow(`  ⚠ ${LINT_ESLINT_CONFIG_FILE} differs from the generated config — kept (user-modified)`));
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
        if (existsSync(skillDir)) {
            rmSync(skillDir, { recursive: true, force: true });
            track(CLAUDE_LEGACY_SKILL_REL);
            console.log(chalk.green("  ✓ Removed .claude/skills/openspec-e2e/"));
        }
        else {
            console.log(chalk.gray("  - Legacy skill directory not found, skipping"));
        }
        // 4. Remove schema
        console.log(chalk.blue("\n─── Removing Schema ───"));
        const schemaDir = join(projectRoot, "openspec", "schemas", "playwright-e2e");
        if (existsSync(schemaDir)) {
            rmSync(schemaDir, { recursive: true, force: true });
            track("openspec/schemas/playwright-e2e");
            console.log(chalk.green("  ✓ Removed openspec/schemas/playwright-e2e/"));
        }
        else {
            console.log(chalk.gray("  - Schema not found, skipping"));
        }
        // 4b. Remove the minimal-mode scaffold (tests/README.md) — content-owned:
        // byte-identical to the bundled template → tool-owned → removed; anything
        // else is user-owned → kept with a notice.
        console.log(chalk.blue("\n─── Removing Minimal Scaffold ───"));
        const readmeDest = join(projectRoot, "tests", "README.md");
        if (existsSync(readmeDest)) {
            const template = readFileSync(fileURLToPath(new URL("../../templates/tests-readme.md", import.meta.url)), "utf-8");
            if (normalizeEol(readFileSync(readmeDest, "utf-8")) === normalizeEol(template)) {
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
        else {
            console.log(chalk.gray("  - tests/README.md not found, skipping"));
        }
        // 5. Clean rules file markers for each detected editor
        console.log(chalk.blue("\n─── Cleaning Rules Files ───"));
        if (hasRuleFileMarkers(projectRoot))
            track("rules-markers");
        for (const adapter of detected) {
            cleanProjectRules(adapter, projectRoot);
        }
        // Minimal-mode projects carry standards without command artifacts (and
        // without a marker dir for the wrapper editors) — detection may miss
        // claude/codebuddy entirely (or the project may mix a detected editor
        // with a wrapper-only editor). Clean the rules files whenever a wrapper
        // editor is not among the detected editors but our territory is present;
        // removeMarkersFromFile stays quiet-ish (gray info lines) when the files
        // carry no markers.
        if (!detected.some((a) => a.id === "claude") && hasRuleFileMarkers(projectRoot)) {
            cleanProjectRules(claudeAdapter, projectRoot);
        }
        if (!detected.some((a) => a.id === "codebuddy") && hasRuleFileMarkers(projectRoot)) {
            cleanProjectRules(codebuddyAdapter, projectRoot);
        }
        // 5b. Remove the managed .gitignore block. Idempotent — no block is a
        // silent no-op. Credentials stay on disk: deleting user credentials is
        // data loss — they just lose the ignore protection.
        console.log(chalk.blue("\n─── Removing Managed .gitignore Block ───"));
        const blockResult = removeManagedBlock(projectRoot);
        if (blockResult.removed) {
            track(".gitignore");
            console.log(chalk.green("  ✓ Removed openspec-pw managed block from .gitignore"));
            if (existsSync(join(projectRoot, "tests", "playwright", "credentials.yaml"))) {
                console.log(chalk.yellow("  ⚠ tests/playwright/credentials.yaml kept on disk — no longer ignore-protected, handle it yourself"));
            }
        }
        else {
            console.log(chalk.gray("  - No managed block found, skipping"));
        }
        console.log(chalk.blue("\n─── Removing Stop Hook ───"));
        const hookResult = uninstallStopHook(projectRoot);
        if ("error" in hookResult) {
            console.log(chalk.yellow(`  ⚠ ${hookResult.error}`));
        }
        else if (hookResult.removed) {
            track(hookResult.path);
            console.log(chalk.green(`  ✓ Removed openspec-pw Stop hook from ${hookResult.path}`));
        }
        else {
            console.log(chalk.gray("  - No openspec-pw Stop hook found, skipping"));
        }
        // Summary
        console.log(chalk.blue("\n─── Summary ───"));
        console.log(chalk.green("  ✓ Remove complete!\n"));
        console.log(chalk.gray("  Note: Run openspec-pw doctor to verify clean removal.\n"));
        // CodeGraph MCP is a codegraph-owned asset — never touch it here, only
        // point the user at the removal command.
        const cg = detectCodeGraphStatus(projectRoot);
        if (cg.mcpInstalledAdapters.length > 0) {
            console.log(chalk.gray("  Note: codegraph MCP remains in your agents — remove with: codegraph uninstall"));
        }
    }
    catch (err) {
        throw new RemoveError(err instanceof Error ? err.message : String(err), modified);
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
            await removeInProject(project);
            removed++;
        }
        catch (err) {
            const modified = err instanceof RemoveError ? err.modified : [];
            const message = err instanceof Error ? err.message : String(err);
            if (modified.length === 0) {
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
        commands += listCommandArtifactPaths(adapter, meta).filter((rel) => existsSync(join(projectRoot, rel))).length;
    }
    // MCP entries are removed for every adapter (an editor can carry a project
    // entry without its marker directory), so the plan must count them the same way.
    let mcp = 0;
    for (const adapter of getAllAdapters()) {
        if (adapter.supportsMcp === false)
            continue;
        for (const serverName of OPENSPEC_PW_MCP_SERVERS) {
            try {
                if (adapter.isMcpInstalled(projectRoot, serverName))
                    mcp++;
            }
            catch {
                // Unreadable MCP config — leave it out of the plan.
            }
        }
    }
    if (commands > 0)
        groups.push(`commands ${commands}`);
    if (mcp > 0)
        groups.push(`MCP ${mcp}`);
    if (existsSync(join(projectRoot, CLAUDE_LEGACY_SKILL_REL)))
        groups.push("legacy skill");
    if (existsSync(join(projectRoot, "openspec", "schemas", "playwright-e2e")))
        groups.push("schema");
    // Content-owned artifacts: list them only when removal would really delete
    // them (a user-modified copy is kept), so the plan matches the execution.
    if (isPristineCopy(projectRoot, join("tests", "README.md"), "tests-readme.md")) {
        groups.push("tests/README.md");
    }
    if (hasRuleFileMarkers(projectRoot))
        groups.push("rules markers");
    try {
        const checklistPath = join(projectRoot, LINT_GUIDELINES_RELPATH);
        if (existsSync(checklistPath) &&
            isChecklistUnmodified(readFileSync(checklistPath, "utf-8"))) {
            groups.push("lint checklist");
        }
    }
    catch {
        // Unreadable file — skip the group rather than aborting the plan.
    }
    if (isPristineCopy(projectRoot, WORKFLOW_REL, "github-workflow.yml")) {
        groups.push("CI workflow");
    }
    if (hasRuffBlock(projectRoot))
        groups.push("ruff managed block");
    try {
        const eslintPath = join(projectRoot, LINT_ESLINT_CONFIG_FILE);
        if (existsSync(eslintPath) &&
            isToolGeneratedEslintConfig(readFileSync(eslintPath, "utf-8"))) {
            groups.push("generated eslint config");
        }
    }
    catch {
        // Unreadable file — skip the group rather than aborting the plan.
    }
    const agents = enumerateVendoredAgents(projectRoot, installedAgentsSnapshotDir());
    if (agents.owned.length > 0)
        groups.push("vendored agents");
    if (hasManagedGitignoreBlock(projectRoot))
        groups.push(".gitignore block");
    if (isStopHookInstalled(projectRoot))
        groups.push("stop hook");
    if (groups.length === 0)
        groups.push("(nothing detected — will be skipped)");
    return groups;
}
/** True when the file exists and is byte-identical (EOL-normalized) to its template. */
function isPristineCopy(projectRoot, relPath, templateFile) {
    try {
        const dest = join(projectRoot, relPath);
        if (!existsSync(dest))
            return false;
        const template = readFileSync(fileURLToPath(new URL(`../../templates/${templateFile}`, import.meta.url)), "utf-8");
        return normalizeEol(readFileSync(dest, "utf-8")) === normalizeEol(template);
    }
    catch {
        return false;
    }
}
function hasRuffBlock(projectRoot) {
    return ["pyproject.toml", ".ruff.toml", "ruff.toml"].some((name) => {
        const file = join(projectRoot, name);
        try {
            return existsSync(file) && findRuffManagedBlock(readFileSync(file, "utf-8")) !== null;
        }
        catch {
            return false;
        }
    });
}
function hasManagedGitignoreBlock(projectRoot) {
    const file = join(projectRoot, ".gitignore");
    try {
        if (!existsSync(file))
            return false;
        return readFileSync(file, "utf-8").includes(GITIGNORE_BLOCK_BEGIN);
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=remove.js.map