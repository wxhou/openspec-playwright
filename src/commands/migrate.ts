import {
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
} from "fs";
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

export interface MigrateOptions {
  dryRun?: boolean;
  force?: boolean;
}

export async function migrate(options: MigrateOptions) {
  const projectRoot = process.cwd();
  const testsDir = join(projectRoot, "tests", "playwright");

  if (!existsSync(testsDir)) {
    console.log(
      chalk.yellow(
        "  tests/playwright/ not found. Is this an initialized project?",
      ),
    );
    return;
  }

  console.log(chalk.blue("\n🔄 OpenSpec Playwright: Migration\n"));

  // 1. Find old-style spec files in root
  const oldFiles = readdirSync(testsDir)
    .filter((f) => f.endsWith(".spec.ts"))
    .filter((f) => !SHARED_FILES.has(f))
    .filter((f) => !f.startsWith("."));

  if (oldFiles.length === 0) {
    console.log(
      chalk.green("  ✓ No old-style change spec files found. Nothing to migrate.\n"),
    );
    return;
  }

  console.log(
    chalk.blue(`─── Found ${oldFiles.length} old-style spec file(s) ───`),
  );

  // 2. Build migration list
  interface MigrateItem {
    fileName: string;
    changeName: string;
    oldPath: string;
    newPath: string;
  }

  const items: MigrateItem[] = oldFiles.map((fileName) => {
    const changeName = fileName.replace(".spec.ts", "");
    const oldPath = join(testsDir, fileName);
    const newDir = join(testsDir, "changes", changeName);
    const newPath = join(newDir, fileName);
    return { fileName, changeName, oldPath, newPath };
  });

  // 3. Display migration plan
  for (const item of items) {
    console.log(
      `  ${chalk.green("→")} ${item.fileName}  →  changes/${item.changeName}/${item.fileName}`,
    );
  }

  // 4. Dry run
  if (options.dryRun) {
    console.log(
      chalk.blue(`\n─── Dry run — no files were moved ───`),
    );
    console.log(chalk.green("  All migrations would succeed.\n"));
    return;
  }

  // 5. Ensure changes/ directory exists
  mkdirSync(join(testsDir, "changes"), { recursive: true });

  // 6. Execute migrations
  console.log(chalk.blue("\n─── Migrating ───"));

  let migrated = 0;
  let skipped = 0;

  for (const item of items) {
    if (!existsSync(item.oldPath)) {
      console.log(
        chalk.yellow(`  ⚠ ${item.fileName} not found, skipping`),
      );
      skipped++;
      continue;
    }

    if (existsSync(item.newPath)) {
      if (!options.force) {
        console.log(
          chalk.yellow(
            `  ⚠ ${item.newPath} already exists. Use --force to overwrite.`,
          ),
        );
        skipped++;
        continue;
      }
    }

    mkdirSync(join(testsDir, "changes", item.changeName), {
      recursive: true,
    });
    renameSync(item.oldPath, item.newPath);
    migrated++;
  }

  // 7. Summary
  console.log(chalk.blue("\n─── Results ───"));
  console.log(
    `  ${chalk.green(`✓ ${migrated} migrated`)}  ${skipped > 0 ? chalk.red(`✗ ${skipped} skipped`) : ""}`,
  );
  console.log(
    chalk.blue("\n─── Next step ───"),
  );
  console.log(
    chalk.green(
      "  Run `openspec-pw run <name>` to verify each migrated change.\n",
    ),
  );
}
