// Restore caller's working directory (passed from wrapper via env var).
// This ensures init/git/file operations use the user's directory, not the global package dir.
if (process.env.OPENSPE_PW_CWD) {
    process.chdir(process.env.OPENSPE_PW_CWD);
}
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { Command } from "commander";
import { init } from "./commands/init.js";
import { update } from "./commands/update.js";
import { doctor } from "./commands/doctor.js";
import { run } from "./commands/run.js";
import { migrate } from "./commands/migrate.js";
import { uninstall } from "./commands/uninstall.js";
import { audit } from "./commands/audit.js";
import { explore } from "./commands/explore.js";
import { checkForUpdate } from "./shared/version-check.js";
const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, "../package.json"), "utf-8"));
const program = new Command();
program
    .name("openspec-pw")
    .description("OpenSpec + Playwright E2E verification setup tool")
    .version(pkg.version);
program
    .command("init")
    .description("Initialize OpenSpec + Playwright E2E integration in the current project")
    .option("-c, --change <name>", "default change name", "default")
    .option("--no-mcp", "skip Playwright MCP configuration")
    .option("--seed", "force regenerate seed.spec.ts (overwrite if exists)")
    .action(async (opts) => {
    await init(opts);
    await checkForUpdate(pkg.version);
});
program
    .command("doctor")
    .description("Check if all prerequisites are installed")
    .option("--json", "Output results as JSON")
    .action(async (opts) => {
    await doctor(opts);
    await checkForUpdate(pkg.version);
});
program
    .command("update")
    .description("Update the CLI tool and commands to the latest version")
    .option("--no-cli", "skip CLI update")
    .option("--no-skill", "skip command update")
    .action(async (opts) => {
    await update(opts);
    // No version check needed after update — user just updated
});
program
    .command("run <change-name>")
    .description("Run Playwright E2E tests for an OpenSpec change")
    .option("-p, --project <name>", "Playwright project to run (e.g., user, admin)")
    .option("-t, --timeout <seconds>", "Test timeout in seconds", "300")
    .option("--json", "Output results as JSON")
    .option("-g, --grep <pattern>", "Run only tests matching pattern")
    .option("--smoke", "Run only smoke tests (--grep @smoke)")
    .option("-w, --workers <n>", "Number of parallel workers", (v) => parseInt(v, 10), undefined)
    .option("--app-bugs <n>", "Number of app bugs (skipped tests)", (v) => parseInt(v, 10), undefined)
    .option("--healed <n>", "Number of test bugs healed by Healer", (v) => parseInt(v, 10), undefined)
    .option("--raft <n>", "Number of RAFTs detected", (v) => parseInt(v, 10), undefined)
    .option("--escalated <n>", "Number of human escalations", (v) => parseInt(v, 10), undefined)
    .option("--headed", "Show browser during test run (default: headless)")
    .option("--update-snapshots", "Update screenshot baselines before running tests")
    .action(async (changeName, opts) => {
    await run(changeName, opts);
    await checkForUpdate(pkg.version);
});
program
    .command("migrate")
    .description("Migrate old-style change spec files to the new tests/playwright/changes/<name>/ structure")
    .option("-n, --dry-run", "Show what would be migrated without moving files")
    .option("-f, --force", "Overwrite existing files at the new location")
    .action(async (opts) => {
    await migrate(opts);
    await checkForUpdate(pkg.version);
});
program
    .command("uninstall")
    .description("Remove OpenSpec + Playwright E2E integration from the current project")
    .action(async () => {
    await uninstall();
    await checkForUpdate(pkg.version);
});
program
    .command("audit")
    .description("Audit test files for orphaned specs, missing auth, sitemap issues")
    .action(async () => {
    await audit();
    await checkForUpdate(pkg.version);
});
program
    .command("explore")
    .description("Explore routes in parallel with Playwright")
    .option("-p, --parallel <n>", "Number of parallel workers", (v) => parseInt(v, 10), 4)
    .option("-n, --dry-run", "Show what would be explored without running")
    .action(async (opts) => {
    await explore(opts);
    await checkForUpdate(pkg.version);
});
program.parse();
//# sourceMappingURL=index.js.map