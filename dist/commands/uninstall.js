import { existsSync, rmSync, readdirSync, rmdirSync, } from "fs";
import { join, dirname } from "path";
import chalk from "chalk";
import { cleanProjectRules, detectAdapters, } from "./editors.js";
import { removePlaywrightMcp } from "../shared/index.js";
export async function uninstall() {
    console.log(chalk.blue("\n🗑️  Uninstalling OpenSpec + Playwright E2E\n"));
    const projectRoot = process.cwd();
    const detected = detectAdapters(projectRoot);
    // 1. Remove Playwright MCP for each detected editor
    console.log(chalk.blue("\n─── Removing Playwright MCP ───"));
    for (const adapter of detected) {
        removePlaywrightMcp(adapter);
    }
    // 2. Remove E2E command file for each detected editor
    console.log(chalk.blue("\n─── Removing E2E Commands ───"));
    for (const adapter of detected) {
        const relPath = adapter.commandFilePath("e2e");
        const absPath = join(projectRoot, relPath);
        if (existsSync(absPath)) {
            rmSync(absPath);
            cleanupEmptyDirs(dirname(absPath), projectRoot);
            console.log(chalk.green(`  ✓ ${adapter.label}: ${relPath}`));
        }
        else {
            console.log(chalk.gray(`  - ${adapter.label}: E2E command not found, skipping`));
        }
    }
    // 3. Remove legacy skill directory (if present from older versions)
    console.log(chalk.blue("\n─── Removing Legacy Skill ───"));
    const skillDir = join(projectRoot, ".claude", "skills", "openspec-e2e");
    if (existsSync(skillDir)) {
        rmSync(skillDir, { recursive: true, force: true });
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
        console.log(chalk.green("  ✓ Removed openspec/schemas/playwright-e2e/"));
    }
    else {
        console.log(chalk.gray("  - Schema not found, skipping"));
    }
    // 5. Clean rules file markers for each detected editor
    console.log(chalk.blue("\n─── Cleaning Rules Files ───"));
    for (const adapter of detected) {
        cleanProjectRules(adapter, projectRoot);
    }
    // Summary
    console.log(chalk.blue("\n─── Summary ───"));
    console.log(chalk.green("  ✓ Uninstall complete!\n"));
    console.log(chalk.gray("  Note: Run openspec-pw doctor to verify clean removal.\n"));
}
function cleanupEmptyDirs(dir, stopAt) {
    while (dir !== stopAt && dir.length > stopAt.length) {
        try {
            const entries = readdirSync(dir);
            if (entries.length === 0) {
                rmdirSync(dir);
                dir = dirname(dir);
            }
            else {
                break;
            }
        }
        catch {
            break;
        }
    }
}
//# sourceMappingURL=uninstall.js.map