import { execSync } from "child_process";
import { existsSync, mkdirSync, readdirSync, renameSync, } from "fs";
import { join } from "path";
import chalk from "chalk";
const SHARED_FILES = new Set([
    "seed.spec.ts",
    "app-all.spec.ts",
    "auth.setup.ts",
    "credentials.yaml",
    "app-knowledge.md",
    "playwright.config.ts",
    "mcp-tools.md",
]);
export async function migrate(options) {
    const projectRoot = process.cwd();
    const testsDir = join(projectRoot, "tests", "playwright");
    if (!existsSync(testsDir)) {
        console.log(chalk.yellow("  tests/playwright/ not found. Is this an initialized project?"));
        return;
    }
    console.log(chalk.blue("\n🔄 OpenSpec Playwright: Migration\n"));
    // 1. Get list of OpenSpec changes (to validate)
    let changeNames = [];
    try {
        const result = execSync("npx openspec list --json", {
            cwd: projectRoot,
            encoding: "utf-8",
            timeout: 30000,
        });
        const data = JSON.parse(result);
        changeNames = Array.isArray(data)
            ? data.map((c) => c.name)
            : Object.keys(data);
    }
    catch {
        // If openspec not available or no changes, proceed with empty list
        changeNames = [];
    }
    // 2. Find old-style spec files in root
    const oldFiles = readdirSync(testsDir)
        .filter((f) => f.endsWith(".spec.ts"))
        .filter((f) => !SHARED_FILES.has(f))
        .filter((f) => !f.startsWith("."));
    if (oldFiles.length === 0) {
        console.log(chalk.green("  ✓ No old-style change spec files found. Nothing to migrate.\n"));
        return;
    }
    console.log(chalk.blue(`─── Found ${oldFiles.length} old-style spec file(s) ───`));
    const items = oldFiles.map((fileName) => {
        const changeName = fileName.replace(".spec.ts", "");
        const oldPath = join(testsDir, fileName);
        const newDir = join(testsDir, "changes", changeName);
        const newPath = join(newDir, fileName);
        const valid = changeNames.includes(changeName);
        const reason = valid
            ? undefined
            : changeNames.length === 0
                ? "openspec not initialized or no changes found"
                : `change "${changeName}" not found in openspec`;
        return { fileName, changeName, oldPath, newPath, valid, reason };
    });
    // 4. Display findings
    const validItems = items.filter((i) => i.valid);
    const invalidItems = items.filter((i) => !i.valid);
    for (const item of items) {
        const icon = item.valid ? chalk.green("✓") : chalk.red("✗");
        console.log(`  ${icon} ${item.fileName}  →  changes/${item.changeName}/${item.fileName}`);
        if (item.reason) {
            console.log(chalk.gray(`    Skip: ${item.reason}`));
        }
    }
    if (invalidItems.length > 0) {
        console.log(chalk.yellow(`\n  ⚠ ${invalidItems.length} file(s) skipped (no matching OpenSpec change)`));
    }
    if (validItems.length === 0) {
        console.log(chalk.blue("\n  No valid migrations to perform.\n"));
        return;
    }
    // 5. Dry run or execute
    if (options.dryRun) {
        console.log(chalk.blue(`\n─── Dry run — no files were moved ───`));
        console.log(chalk.green("  All valid migrations would succeed.\n"));
        return;
    }
    console.log(chalk.blue("\n─── Migrating ───"));
    let migrated = 0;
    let skipped = 0;
    for (const item of validItems) {
        // Check if file exists
        if (!existsSync(item.oldPath)) {
            console.log(chalk.yellow(`  ⚠ ${item.fileName} not found, skipping`));
            skipped++;
            continue;
        }
        // Check if new location already has a file
        if (existsSync(item.newPath)) {
            if (!options.force) {
                console.log(chalk.yellow(`  ⚠ ${item.newPath} already exists. Use --force to overwrite.`));
                skipped++;
                continue;
            }
        }
        // Create directory and move
        mkdirSync(join(testsDir, "changes", item.changeName), {
            recursive: true,
        });
        renameSync(item.oldPath, item.newPath);
        migrated++;
    }
    // 6. Summary
    console.log(chalk.blue("\n─── Results ───"));
    console.log(`  ${chalk.green(`✓ ${migrated} migrated`)}  ${chalk.red(`✗ ${skipped} skipped`)}`);
    console.log(chalk.blue("\n─── Next step ───"));
    console.log(chalk.green("  Run `openspec-pw run <name>` to verify each migrated change.\n"));
}
//# sourceMappingURL=migrate.js.map