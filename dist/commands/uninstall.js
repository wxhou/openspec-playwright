import { existsSync, readFileSync, writeFileSync, rmSync, readdirSync, rmdirSync, } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";
import chalk from "chalk";
import { detectEditors } from "./editors.js";
export async function uninstall() {
    console.log(chalk.blue("\n🗑️  Uninstalling OpenSpec + Playwright E2E\n"));
    const projectRoot = process.cwd();
    // 1. Remove Playwright MCP from .claude.json
    console.log(chalk.blue("─── Removing Playwright MCP ───"));
    removeMcpFromClaudeJson(homedir(), projectRoot);
    // 2. Remove E2E commands for detected editors
    console.log(chalk.blue("\n─── Removing E2E Commands ───"));
    const adapters = detectEditors(projectRoot);
    if (adapters.length > 0) {
        for (const adapter of adapters) {
            const relPath = adapter.getCommandPath("e2e");
            const absPath = join(projectRoot, relPath);
            if (existsSync(absPath)) {
                rmSync(absPath);
                // Remove empty parent directories
                cleanupEmptyDirs(dirname(absPath), projectRoot);
                console.log(chalk.green(`  ✓ ${adapter.toolId}: removed ${relPath}`));
            }
        }
    }
    else {
        console.log(chalk.gray("  - No editors detected, skipping"));
    }
    // 3. Remove SKILL.md
    console.log(chalk.blue("\n─── Removing Skill ───"));
    const skillDir = join(projectRoot, ".claude", "skills", "openspec-e2e");
    if (existsSync(skillDir)) {
        rmSync(skillDir, { recursive: true, force: true });
        console.log(chalk.green("  ✓ Removed .claude/skills/openspec-e2e/"));
    }
    else {
        console.log(chalk.gray("  - Skill not found, skipping"));
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
    // 5. Clean CLAUDE.md markers
    console.log(chalk.blue("\n─── Cleaning CLAUDE.md ───"));
    cleanClaudeMd(projectRoot);
    // Summary
    console.log(chalk.blue("\n─── Summary ───"));
    console.log(chalk.green("  ✓ Uninstall complete!\n"));
    console.log(chalk.gray("  Note: Run openspec-pw doctor to verify clean removal.\n"));
}
function removeMcpFromClaudeJson(homeDir, projectRoot) {
    const claudeJsonPath = join(homeDir, ".claude.json");
    if (!existsSync(claudeJsonPath)) {
        console.log(chalk.gray("  - .claude.json not found, skipping"));
        return;
    }
    try {
        const content = readFileSync(claudeJsonPath, "utf-8");
        const json = JSON.parse(content);
        let changed = false;
        // Remove from global mcpServers
        if (json.mcpServers?.["playwright"]) {
            delete json.mcpServers["playwright"];
            changed = true;
        }
        // Remove from project-level mcpServers
        if (json.projects?.[projectRoot]?.mcpServers?.["playwright"]) {
            delete json.projects[projectRoot].mcpServers["playwright"];
            changed = true;
        }
        if (changed) {
            writeFileSync(claudeJsonPath, JSON.stringify(json, null, 2) + "\n");
            console.log(chalk.green("  ✓ Removed playwright from .claude.json"));
            console.log(chalk.gray("    Restart Claude Code to complete removal"));
        }
        else {
            console.log(chalk.gray("  - Playwright MCP not found in .claude.json"));
        }
    }
    catch (err) {
        console.log(chalk.yellow(`  ⚠ Failed to update .claude.json: ${err instanceof Error ? err.message : String(err)}`));
    }
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
function cleanClaudeMd(projectRoot) {
    const dest = join(projectRoot, "CLAUDE.md");
    if (!existsSync(dest)) {
        console.log(chalk.gray("  - CLAUDE.md not found, skipping"));
        return;
    }
    const existing = readFileSync(dest, "utf-8");
    const markerStart = "<!-- OPENSPEC:START -->";
    const markerEnd = "<!-- OPENSPEC:END -->";
    if (!existing.includes(markerStart)) {
        console.log(chalk.gray("  - No OpenSpec markers found in CLAUDE.md"));
        return;
    }
    const updated = existing
        .split("\n")
        .filter((line) => !line.trim().startsWith(markerStart) &&
        !line.trim().startsWith(markerEnd))
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim() + "\n";
    writeFileSync(dest, updated);
    console.log(chalk.green("  ✓ Removed OpenSpec markers from CLAUDE.md"));
}
//# sourceMappingURL=uninstall.js.map