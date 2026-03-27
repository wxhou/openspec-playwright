import { execSync } from 'child_process';
import { existsSync, writeFileSync, mkdirSync, } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { readFile } from 'fs/promises';
const TEMPLATE_DIR = new URL('../../templates', import.meta.url).pathname;
const SKILL_SRC = new URL('../../.claude/skills/openspec-e2e', import.meta.url).pathname;
const CMD_SRC = new URL('../../.claude/commands/opsx/e2e.md', import.meta.url).pathname;
export async function init(options) {
    console.log(chalk.blue('\n🔧 OpenSpec + Playwright E2E Setup\n'));
    const projectRoot = process.cwd();
    // 1. Check prerequisites
    console.log(chalk.blue('─── Prerequisites ───'));
    const hasNode = execCmd('node --version', 'Node.js', true);
    const hasNpm = execCmd('npm --version', 'npm', true);
    const hasOpenspec = execCmd('npx openspec --version 2>/dev/null || echo "not found"', 'OpenSpec', true);
    if (!hasNode || !hasNpm) {
        console.log(chalk.red('  ✗ Node.js/npm is required'));
        process.exit(1);
    }
    console.log(chalk.green('  ✓ Node.js and npm found'));
    // 2. Check OpenSpec
    if (!existsSync(join(projectRoot, 'openspec'))) {
        console.log(chalk.yellow('\n⚠ OpenSpec not initialized. Run these commands first:'));
        console.log(chalk.gray('  npm install -g @fission-ai/openspec'));
        console.log(chalk.gray('  openspec init'));
        console.log(chalk.gray('  openspec config profile core'));
        console.log(chalk.gray('  openspec update\n'));
        console.log(chalk.gray('  Then run openspec-pw init again.\n'));
        return;
    }
    console.log(chalk.green('  ✓ OpenSpec initialized'));
    // 3. Install Playwright
    console.log(chalk.blue('\n─── Installing Playwright ───'));
    try {
        execSync('npx playwright install --with-deps', {
            cwd: projectRoot,
            stdio: 'inherit',
        });
        console.log(chalk.green('  ✓ Playwright installed'));
    }
    catch {
        console.log(chalk.yellow('  ⚠ Failed to install Playwright'));
        console.log(chalk.gray('  Try manually: npx playwright install --with-deps'));
    }
    // 4. Install Playwright agents
    if (options.playwrightInit !== false) {
        console.log(chalk.blue('\n─── Installing Playwright Test Agents ───'));
        // Check if already installed
        if (existsSync(join(projectRoot, '.github'))) {
            console.log(chalk.green('  ✓ Playwright agents already installed'));
        }
        else {
            try {
                execSync('npx playwright init-agents --loop=claude', {
                    cwd: projectRoot,
                    stdio: 'inherit',
                });
                console.log(chalk.green('  ✓ Playwright Test Agents initialized'));
            }
            catch {
                console.log(chalk.yellow('  ⚠ Failed to run playwright init-agents'));
                console.log(chalk.gray('  Try manually: npx playwright init-agents --loop=claude'));
            }
        }
    }
    // 5. Install Playwright MCP (global)
    if (options.mcp !== false) {
        console.log(chalk.blue('\n─── Installing Playwright MCP ───'));
        try {
            execSync('claude mcp add playwright npx @playwright/mcp@latest', {
                cwd: projectRoot,
                stdio: 'inherit',
            });
            console.log(chalk.green('  ✓ Playwright MCP installed globally'));
            console.log(chalk.gray('  (Restart Claude Code to activate)'));
        }
        catch {
            console.log(chalk.yellow('  ⚠ Failed to run claude mcp add'));
            console.log(chalk.gray('  Run manually: claude mcp add playwright npx @playwright/mcp@latest'));
            console.log(chalk.gray('  (Restart Claude Code to activate the MCP server)'));
        }
    }
    // 6. Copy skill files
    console.log(chalk.blue('\n─── Installing Claude Code Skill ───'));
    await installSkill(projectRoot);
    // 7. Generate seed test
    if (options.seed !== false) {
        console.log(chalk.blue('\n─── Generating Seed Test ───'));
        await generateSeedTest(projectRoot);
    }
    // 8. Summary
    console.log(chalk.blue('\n─── Summary ───'));
    console.log(chalk.green('  ✓ Setup complete!\n'));
    console.log(chalk.bold('Next steps:'));
    console.log(chalk.gray('  1. Customize tests/playwright/credentials.yaml with your test user'));
    console.log(chalk.gray('  2. Set credentials: export E2E_USERNAME=xxx E2E_PASSWORD=yyy'));
    console.log(chalk.gray('  3. Run auth setup: npx playwright test --project=setup'));
    console.log(chalk.gray('  4. In Claude Code, run: /opsx:e2e <change-name>'));
    console.log(chalk.gray('  5. Or: openspec-pw doctor to verify setup\n'));
    console.log(chalk.bold('How it works:'));
    console.log(chalk.gray('  /opsx:e2e reads your OpenSpec specs and runs Playwright'));
    console.log(chalk.gray('  E2E tests through a three-agent pipeline:'));
    console.log(chalk.gray('  Planner → Generator → Healer\n'));
}
async function installSkill(projectRoot) {
    const skillsDir = join(projectRoot, '.claude', 'skills');
    const skillDir = join(skillsDir, 'openspec-e2e');
    const cmdDir = join(projectRoot, '.claude', 'commands');
    // Copy skill
    mkdirSync(skillDir, { recursive: true });
    const skillContent = await readFile(SKILL_SRC + '/SKILL.md', 'utf-8');
    writeFileSync(join(skillDir, 'SKILL.md'), skillContent);
    console.log(chalk.green(`  ✓ Skill installed: /openspec-e2e`));
    // Copy command
    mkdirSync(join(cmdDir, 'opsx'), { recursive: true });
    const cmdContent = await readFile(CMD_SRC, 'utf-8');
    writeFileSync(join(cmdDir, 'opsx', 'e2e.md'), cmdContent);
    console.log(chalk.green(`  ✓ Command installed: /opsx:e2e`));
}
async function generateSeedTest(projectRoot) {
    const testsDir = join(projectRoot, 'tests', 'playwright');
    mkdirSync(testsDir, { recursive: true });
    const seedPath = join(testsDir, 'seed.spec.ts');
    if (existsSync(seedPath)) {
        console.log(chalk.gray('  - seed.spec.ts already exists, skipping'));
    }
    else {
        const seedContent = await readFile(TEMPLATE_DIR + '/seed.spec.ts', 'utf-8');
        writeFileSync(seedPath, seedContent);
        console.log(chalk.green('  ✓ Generated: tests/playwright/seed.spec.ts'));
    }
    // Generate auth.setup.ts
    const authSetupPath = join(testsDir, 'auth.setup.ts');
    if (existsSync(authSetupPath)) {
        console.log(chalk.gray('  - auth.setup.ts already exists, skipping'));
    }
    else {
        const authContent = await readFile(TEMPLATE_DIR + '/auth.setup.ts', 'utf-8');
        writeFileSync(authSetupPath, authContent);
        console.log(chalk.green('  ✓ Generated: tests/playwright/auth.setup.ts'));
    }
    // Generate credentials.yaml
    const credsPath = join(testsDir, 'credentials.yaml');
    if (existsSync(credsPath)) {
        console.log(chalk.gray('  - credentials.yaml already exists, skipping'));
    }
    else {
        const credsContent = await readFile(TEMPLATE_DIR + '/credentials.yaml', 'utf-8');
        writeFileSync(credsPath, credsContent);
        console.log(chalk.green('  ✓ Generated: tests/playwright/credentials.yaml'));
    }
    console.log(chalk.gray('  (Customize BASE_URL and credentials for your app)'));
}
function execCmd(cmd, name, silent = false) {
    try {
        execSync(cmd, { stdio: 'pipe' });
        if (!silent)
            console.log(chalk.green(`  ✓ ${name} found`));
        return true;
    }
    catch {
        if (!silent)
            console.log(chalk.yellow(`  ⚠ ${name} not found`));
        return false;
    }
}
//# sourceMappingURL=init.js.map