import { execFile, execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { join } from "path";
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, statSync, } from "fs";
import { tmpdir } from "os";
import { promisify } from "util";
import chalk from "chalk";
import * as tar from "tar";
import { buildCommandMeta, detectAdapters, installCommand, installProjectRules, } from "./editors.js";
import { isPlaywrightMcpInstalled, ensurePlaywrightMcp, needsShell } from "../shared/index.js";
const execFileAsync = promisify(execFile);
export async function update(options) {
    console.log(chalk.blue("\n🔄 Updating OpenSpec + Playwright E2E\n"));
    const projectRoot = process.cwd();
    // Check if init has been run
    const hasCommand = existsSync(join(projectRoot, ".claude", "commands", "opsx", "e2e.md")) ||
        existsSync(join(projectRoot, ".opencode", "commands", "opsx-e2e.md"));
    const hasOpenSpec = existsSync(join(projectRoot, "openspec"));
    if (!hasCommand && !hasOpenSpec) {
        console.log(chalk.yellow("  ⚠ OpenSpec + Playwright E2E not initialized."));
        console.log(chalk.gray('  Run "openspec-pw init" first to set up the integration.\n'));
        return;
    }
    // 1. Update CLI tool from npm
    if (options.cli !== false) {
        console.log(chalk.blue("─── Updating CLI ───"));
        let cliUpdated = false;
        try {
            await execFileAsync("npm", ["install", "-g", "openspec-playwright@latest"], { timeout: 120000, cwd: projectRoot, stdio: "inherit", shell: needsShell });
            console.log(chalk.green("  ✓ CLI updated via npm"));
            cliUpdated = true;
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.log(chalk.yellow(`  ⚠ Failed to update CLI via npm: ${msg}`));
            console.log(chalk.gray("  Run manually: npm install -g openspec-playwright@latest"));
        }
        // Re-execute remaining steps (templates, commands, AGENTS.md) with the
        // newly-installed binary so that the latest code handles project setup.
        // The original process still runs old code and would miss AGENTS.md creation
        // (which was added in a later version).
        if (cliUpdated) {
            console.log(chalk.gray("  Re-executing remaining steps with updated binary..."));
            try {
                execFileSync("openspec-pw", ["update", "--no-cli"], {
                    stdio: "inherit",
                    cwd: projectRoot,
                    shell: needsShell,
                });
                console.log(chalk.green("  ✓ Post-update tasks completed with latest binary"));
                return;
            }
            catch {
                console.log(chalk.yellow("  ⚠ Re-execution failed, continuing with current binary..."));
                // Fall through — let the old binary attempt remaining steps
            }
        }
    }
    // 1b. Sync local devDependency if present
    const pkgJsonPath = join(projectRoot, "package.json");
    if (existsSync(pkgJsonPath)) {
        let devDepVersion;
        try {
            const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf-8"));
            devDepVersion = pkg.devDependencies?.["openspec-playwright"];
        }
        catch {
            // ignore parse errors
        }
        if (devDepVersion) {
            console.log(chalk.blue("─── Syncing devDependency ───"));
            console.log(chalk.yellow("  ⚠ openspec-playwright found in devDependencies —"));
            console.log(chalk.gray("    Node module resolution will use local version, not global CLI."));
            console.log(chalk.gray("    Syncing local devDependency to latest..."));
            try {
                await execFileAsync("npm", ["install", "-D", "openspec-playwright@latest"], { timeout: 120000, cwd: projectRoot, stdio: "inherit", shell: needsShell });
                console.log(chalk.green("  ✓ devDependency synced to latest"));
            }
            catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                console.log(chalk.yellow(`  ⚠ Failed to sync devDependency: ${msg}`));
                console.log(chalk.gray("    Run manually: npm install -D openspec-playwright@latest\n"));
            }
        }
    }
    // 2. Update commands for all detected editors
    if (options.skill !== false) {
        console.log(chalk.blue("\n─── Updating Commands ───"));
        try {
            const tmpDir = join(tmpdir(), "openspec-e2e-update");
            rmSync(tmpDir, { recursive: true, force: true });
            mkdirSync(tmpDir, { recursive: true });
            // execFile with args array is safe with shell: true — Node quotes
            // each argument, so paths with spaces (OneDrive, CJK user names)
            // are passed verbatim to the shell.
            await execFileAsync("npm", ["pack", "openspec-playwright", "--pack-destination", tmpDir], { timeout: 30000, shell: needsShell });
            // Find the latest tarball by mtime
            const tgzFiles = readdirSync(tmpDir)
                .filter((f) => f.startsWith("openspec-playwright-") && f.endsWith(".tgz"))
                .map((f) => ({ name: f, mtime: statSync(join(tmpDir, f)).mtimeMs }))
                .sort((a, b) => b.mtime - a.mtime);
            if (tgzFiles.length === 0)
                throw new Error("No tarball found");
            const tarballPath = join(tmpDir, tgzFiles[0].name);
            // Extract tarball
            await tar.extract({ file: tarballPath, cwd: tmpDir, strip: 1 });
            // Read e2e command content from template
            const commandSrc = join(tmpDir, "templates", "e2e-command.md");
            let body = "";
            if (existsSync(commandSrc)) {
                body = readFileSync(commandSrc, "utf-8");
            }
            const detected = detectAdapters(projectRoot);
            if (detected.length === 0) {
                console.log(chalk.gray("  - No supported editor (.claude or .opencode) found, skipping command installation"));
            }
            else if (body) {
                const meta = buildCommandMeta(body);
                for (const adapter of detected) {
                    installCommand(adapter, meta, projectRoot);
                }
            }
            // Sync project templates (BasePage.ts, seed.spec.ts)
            syncProjectTemplates(tmpDir, projectRoot);
            // Update employee-grade standards in project CLAUDE.md
            const standardsSrc = join(tmpDir, "employee-standards.md");
            if (existsSync(standardsSrc)) {
                const standards = readFileSync(standardsSrc, "utf-8");
                installProjectRules(projectRoot, standards, detected);
            }
            rmSync(tmpDir, { recursive: true, force: true });
            console.log(chalk.green("  ✓ Commands & templates updated to latest"));
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.log(chalk.yellow(`  ⚠ Failed to update from npm: ${msg}`));
            console.log(chalk.gray("  Trying npm install to pull latest version..."));
            try {
                await execFileAsync("npm", ["install", "-g", "openspec-playwright@latest"], { timeout: 120000, cwd: projectRoot, stdio: "inherit", shell: needsShell });
                console.log(chalk.green("  ✓ Updated via npm install"));
            }
            catch (err2) {
                const msg2 = err2 instanceof Error ? err2.message : String(err2);
                console.log(chalk.red(`  ✗ Failed to update: ${msg2}`));
                console.log(chalk.gray("    Run manually: npm install -g openspec-playwright@latest"));
            }
        }
    }
    // 2b. Install Playwright MCP if not present (per detected editor)
    if (options.mcp !== false) {
        const mcpEditors = detectAdapters(projectRoot);
        if (mcpEditors.length > 0) {
            console.log(chalk.blue("\n─── Installing Playwright MCP ───"));
            for (const adapter of mcpEditors) {
                if (isPlaywrightMcpInstalled(adapter)) {
                    console.log(chalk.green(`  ✓ ${adapter.label}: Playwright MCP already installed`));
                    continue;
                }
                try {
                    ensurePlaywrightMcp(adapter);
                    console.log(chalk.gray(`  (Restart ${adapter.label} to activate)`));
                }
                catch {
                    console.log(chalk.yellow(`  ⚠ ${adapter.label}: Failed to install Playwright MCP`));
                    console.log(chalk.gray(`    Install manually (see ${adapter.label} docs).`));
                }
            }
        }
    }
    // Summary
    console.log(chalk.blue("\n─── Summary ───"));
    console.log(chalk.green("  ✓ Update complete!"));
    // Self-check: detect when the actually-resolved package version
    // (by Node module resolution from this CLI script) differs from
    // the latest published version. The most common cause is a
    // devDependency in the user's package.json shadowing the global
    // CLI binary. See Node module resolution rules.
    await checkVersionShadow();
    const editorsForHint = detectAdapters(projectRoot);
    if (editorsForHint.length > 0) {
        const labels = editorsForHint.map((a) => a.displayName).join(" + ");
        console.log(chalk.bold(`\n  Restart ${labels} to use the updated commands.`));
    }
    else {
        console.log(chalk.bold("\n  No supported editor detected — nothing to restart."));
    }
}
/**
 * Self-check: print warning if Node module resolution is loading
 * a different `openspec-playwright` version than the one just
 * installed. The most common cause is a devDependency in the
 * current project's package.json shadowing the global CLI binary
 * (Node module resolution prefers local node_modules over global).
 */
async function checkVersionShadow() {
    let resolvedVersion;
    let resolvedPath;
    try {
        const require = createRequire(import.meta.url);
        const pkgPath = require.resolve("openspec-playwright/package.json");
        resolvedPath = pkgPath;
        const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
        resolvedVersion = pkg.version;
    }
    catch {
        // openspec-playwright not in module path — nothing to check
        return;
    }
    if (!resolvedVersion)
        return;
    let publishedVersion;
    try {
        const { stdout } = await execFileAsync("npm", ["view", "openspec-playwright", "version"], { timeout: 30000, shell: needsShell });
        publishedVersion = stdout.trim();
    }
    catch {
        // offline / npm registry unavailable — skip silently
        return;
    }
    if (!publishedVersion || resolvedVersion === publishedVersion)
        return;
    console.log(chalk.yellow(`\n  ⚠ Version mismatch: loaded ${resolvedVersion}, latest ${publishedVersion}`));
    console.log(chalk.gray(`    This update script resolved from: ${resolvedPath.replace(/[\\/]package\.json$/, "")}`));
    console.log(chalk.gray("    A devDependency in this project's package.json is shadowing the global CLI binary."));
    console.log(chalk.gray("    Fix: upgrade or remove it with: npm uninstall openspec-playwright"));
    console.log(chalk.gray("         then re-run: openspec-pw update (or: npm install -D openspec-playwright@latest)"));
}
// Sync project-level templates
function syncProjectTemplates(tmpDir, projectRoot) {
    const testsDir = join(projectRoot, "tests", "playwright");
    if (!existsSync(testsDir))
        return;
    // 1. Sync BasePage.ts — always update if content differs
    const basePageSrc = join(tmpDir, "templates", "pages", "BasePage.ts");
    const basePageDest = join(testsDir, "pages", "BasePage.ts");
    if (existsSync(basePageSrc)) {
        if (!existsSync(basePageDest)) {
            mkdirSync(join(testsDir, "pages"), { recursive: true });
            writeFileSync(basePageDest, readFileSync(basePageSrc));
            console.log(chalk.green("  ✓ Generated: tests/playwright/pages/BasePage.ts"));
        }
        else {
            const existing = readFileSync(basePageDest, "utf-8");
            const latest = readFileSync(basePageSrc, "utf-8");
            if (existing !== latest) {
                writeFileSync(basePageDest, latest);
                console.log(chalk.green("  ✓ Updated: tests/playwright/pages/BasePage.ts"));
            }
        }
    }
    // 2. Sync app-knowledge.md — generate if missing
    const appKnowledgeSrc = join(tmpDir, "templates", "app-knowledge.md");
    const appKnowledgeDest = join(testsDir, "app-knowledge.md");
    if (existsSync(appKnowledgeSrc) && !existsSync(appKnowledgeDest)) {
        writeFileSync(appKnowledgeDest, readFileSync(appKnowledgeSrc));
        console.log(chalk.green("  ✓ Generated: tests/playwright/app-knowledge.md"));
    }
    // 3. Sync seed.spec.ts — warn if content differs (may have user customizations)
    const seedSrc = join(tmpDir, "templates", "seed.spec.ts");
    const seedDest = join(testsDir, "seed.spec.ts");
    if (existsSync(seedSrc) && existsSync(seedDest)) {
        const existing = readFileSync(seedDest, "utf-8");
        const latest = readFileSync(seedSrc, "utf-8");
        if (existing !== latest) {
            console.log(chalk.yellow("  ⚠ tests/playwright/seed.spec.ts differs from latest template"));
            console.log(chalk.gray("    Run 'openspec-pw init --seed' to regenerate (overwrites existing)."));
        }
    }
    // 4. Sync credentials.yaml — preserve user credentials
    syncCredentials(tmpDir, projectRoot);
}
/**
 * Sync credentials.yaml — update template structure while preserving user data.
 * Extracts api + users array from existing file, injects into latest template.
 * Falls back to warning if template structure changed significantly.
 */
export function syncCredentials(tmpDir, projectRoot) {
    const credsSrc = join(tmpDir, "templates", "credentials.yaml");
    const credsDest = join(projectRoot, "tests", "playwright", "credentials.yaml");
    if (!existsSync(credsSrc))
        return;
    const latest = readFileSync(credsSrc, "utf-8");
    if (!existsSync(credsDest)) {
        mkdirSync(join(projectRoot, "tests", "playwright"), { recursive: true });
        writeFileSync(credsDest, latest);
        console.log(chalk.green("  ✓ Generated: tests/playwright/credentials.yaml"));
        return;
    }
    const existing = readFileSync(credsDest, "utf-8");
    if (existing === latest)
        return;
    // Backup existing credentials
    const backupDest = credsDest + ".bak";
    writeFileSync(backupDest, existing);
    console.log(chalk.gray(`  - Backed up: tests/playwright/credentials.yaml → credentials.yaml.bak`));
    // Extract user data from existing file
    const users = [];
    // Match user entries directly without block matching (more robust)
    const regex = /^  - name:\s*(\S+)\n    username:\s*(.+?)\n    password:\s*(.+?)(?:\n|$)/gm;
    let match;
    while ((match = regex.exec(existing)) !== null) {
        users.push({
            name: match[1],
            username: match[2].trim(),
            password: match[3].trim(),
        });
    }
    // Extract api field from existing
    const apiMatch = existing.match(/^api:\s*(.+?)(?:\n|$)/m);
    const apiValue = apiMatch ? apiMatch[1].trim() : "";
    // Build updated template with preserved user data
    let updated = latest;
    if (users.length > 0) {
        const userLines = users
            .map((u) => `  - name: ${u.name}\n    username: ${u.username}\n    password: ${u.password}`)
            .join("\n\n");
        // Replace the users section in template
        updated = updated.replace(/^users:\s*\n(\s*- name:[\s\S]*?)(\n\s*#|\n\s*# Multi-user)/m, `users:\n${userLines}\n$2`);
    }
    if (apiValue && !apiValue.includes("CHANGE_ME")) {
        updated = updated.replace(/^api:\s*.*$/m, `api: ${apiValue}`);
    }
    writeFileSync(credsDest, updated);
    console.log(chalk.green("  ✓ Updated: tests/playwright/credentials.yaml (preserved user data)"));
}
//# sourceMappingURL=update.js.map