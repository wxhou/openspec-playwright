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
  .option("--seed", "force regenerate seed.spec.ts (overwrite if exists)")
  .option("--no-seed", "skip seed.spec.ts generation entirely")
  .action(init);

program
  .command("doctor")
  .description("Check if all prerequisites are installed")
  .option("--json", "Output results as JSON")
  .action(doctor);

program
  .command("update")
  .description("Update the CLI tool and skill to the latest version")
  .option("--no-cli", "skip CLI update")
  .option("--no-skill", "skip skill/command update")
  .action(update);

program
  .command("run <change-name>")
  .description("Run Playwright E2E tests for an OpenSpec change")
  .option(
    "-p, --project <name>",
    "Playwright project to run (e.g., user, admin)",
  )
  .option("-t, --timeout <seconds>", "Test timeout in seconds", "300")
  .option("--json", "Output results as JSON")
  .option("-g, --grep <pattern>", "Run only tests matching pattern")
  .option("--app-bugs <n>", "Number of app bugs (skipped tests)", (v) => parseInt(v, 10), undefined)
  .option("--healed <n>", "Number of test bugs healed by Healer", (v) => parseInt(v, 10), undefined)
  .option("--raft <n>", "Number of RAFTs detected", (v) => parseInt(v, 10), undefined)
  .option("--escalated <n>", "Number of human escalations", (v) => parseInt(v, 10), undefined)
  .action(run);

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
  .action(migrate);

program
  .command("uninstall")
  .description(
    "Remove OpenSpec + Playwright E2E integration from the current project",
  )
  .action(uninstall);

program.parse();
