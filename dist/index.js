import { Command } from 'commander';
import { init } from './commands/init.js';
import { doctor } from './commands/doctor.js';
const program = new Command();
program
    .name('openspec-pw')
    .description('OpenSpec + Playwright E2E verification setup tool')
    .version('0.1.1');
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