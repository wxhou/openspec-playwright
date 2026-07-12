// Restore caller's working directory (passed from wrapper via env var).
// This ensures init/git/file operations use the user's directory, not the global package dir.
if (process.env.OPENSPE_PW_CWD) {
  process.chdir(process.env.OPENSPE_PW_CWD);
}

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { Command } from "commander";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  readFileSync(join(__dirname, "../package.json"), "utf-8"),
);

const program = new Command();

program
  .name("openspec-pw")
  .description("OpenSpec + Playwright E2E verification setup tool")
  .version(pkg.version);

program
  .command("init")
  .description(
    "Initialize OpenSpec + Playwright E2E integration in the current project",
  )
  .option("-c, --change <name>", "default change name", "default")
  .option("--no-mcp", "skip Playwright MCP configuration")
  .option("--ci", "generate GitHub Actions CI workflow")
  .action(async (opts) => {
    const { init } = await import("./commands/init.js");
    const { checkForUpdate } = await import("./shared/version-check.js");
    await init(opts);
    await checkForUpdate(pkg.version);
  });

program
  .command("doctor")
  .description("Check if all prerequisites are installed")
  .option("--json", "Output results as JSON")
  .action(async (opts) => {
    const { doctor } = await import("./commands/doctor.js");
    const { checkForUpdate } = await import("./shared/version-check.js");
    await doctor(opts);
    await checkForUpdate(pkg.version);
  });

program
  .command("update")
  .description("Update the CLI tool and commands to the latest version")
  .option("--no-cli", "skip CLI update")
  .option("--no-skill", "skip command update")
  .action(async (opts) => {
    const { update } = await import("./commands/update.js");
    await update(opts);
    // No version check needed after update — user just updated
  });

program
  .command("migrate")
  .description(
    "Migrate old-style change spec files to the new tests/playwright/changes/<name>/ structure",
  )
  .option(
    "-n, --dry-run",
    "Show what would be migrated without moving files",
  )
  .option("-f, --force", "Overwrite existing files at the new location")
  .action(async (opts) => {
    const { migrate } = await import("./commands/migrate.js");
    const { checkForUpdate } = await import("./shared/version-check.js");
    await migrate(opts);
    await checkForUpdate(pkg.version);
  });

program
  .command("uninstall")
  .description(
    "Remove OpenSpec + Playwright E2E integration from the current project",
  )
  .action(async () => {
    const { uninstall } = await import("./commands/uninstall.js");
    const { checkForUpdate } = await import("./shared/version-check.js");
    await uninstall();
    await checkForUpdate(pkg.version);
  });

program
  .command("audit")
  .description("Audit test files for orphaned specs, missing auth, sitemap issues")
  .action(async () => {
    const { audit } = await import("./commands/audit.js");
    const { checkForUpdate } = await import("./shared/version-check.js");
    await audit();
    await checkForUpdate(pkg.version);
  });

program
  .command("coverage [change-name]")
  .description("Analyze spec–test coverage for OpenSpec changes")
  .option("--json", "Output results as JSON")
  .action(async (changeName, opts) => {
    const { coverage } = await import("./commands/coverage.js");
    await coverage(changeName, opts);
  });

program
  .command("flake [change-name]")
  .description("Detect static flake patterns in Playwright test files")
  .option("--json", "Output results as JSON")
  .option("--gate <severity>", "Exit non-zero if findings meet severity (HIGH|MEDIUM|ALL)")
  .action(async (changeName, opts) => {
    const { flake } = await import("./commands/flake.js");
    await flake(changeName, opts);
  });

program
  .command("explore")
  .description("Explore routes in parallel with Playwright")
  .option(
    "-p, --parallel <n>",
    "Number of parallel workers",
    (v) => parseInt(v, 10),
    4,
  )
  .option(
    "-n, --dry-run",
    "Show what would be explored without running",
  )
  .action(async (opts) => {
    const { explore } = await import("./commands/explore.js");
    const { checkForUpdate } = await import("./shared/version-check.js");
    await explore(opts);
    await checkForUpdate(pkg.version);
  });

program.parse();
