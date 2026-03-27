import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Command } from 'commander';
import { init } from './commands/init.js';
import { doctor } from './commands/doctor.js';
const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8'));
const program = new Command();
program
    .name('openspec-pw')
    .description('OpenSpec + Playwright E2E verification setup tool')
    .version(pkg.version);
program
    .command('init')
    .description('Initialize OpenSpec + Playwright E2E integration in the current project')
    .option('-c, --change <name>', 'default change name', 'default')
    .option('--no-playwright-init', 'skip playwright init-agents')
    .option('--no-mcp', 'skip Playwright MCP configuration')
    .option('--no-seed', 'skip seed test generation')
    .action(init);
program
    .command('doctor')
    .description('Check if all prerequisites are installed')
    .action(doctor);
program.parse();
//# sourceMappingURL=index.js.map