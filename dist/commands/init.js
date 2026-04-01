import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync, } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import { readFile } from 'fs/promises';
import { syncMcpTools } from './mcpSync.js';
import { detectEditors, detectCodex, installForAllEditors, installSkill, installProjectClaudeMd, readEmployeeStandards, claudeAdapter } from './editors.js';
const TEMPLATE_DIR = fileURLToPath(new URL('../../templates', import.meta.url));
const SCHEMA_DIR = fileURLToPath(new URL('../../schemas', import.meta.url));
const SKILL_SRC = fileURLToPath(new URL('../../.claude/skills/openspec-e2e/SKILL.md', import.meta.url));
const CMD_BODY_SRC = fileURLToPath(new URL('../../.claude/commands/opsx/e2e-body.md', import.meta.url));
const EMPLOYEE_STANDARDS_SRC = fileURLToPath(new URL('../../employee-standards.md', import.meta.url));
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
    // 3. Install Playwright MCP (global)
    if (options.mcp !== false) {
        console.log(chalk.blue('\n─── Installing Playwright MCP ───'));
        // Check if playwright MCP already exists in global config
        const claudeJsonPath = join(homedir(), '.claude.json');
        const claudeJson = existsSync(claudeJsonPath) ? JSON.parse(readFileSync(claudeJsonPath, 'utf-8')) : {};
        const globalMcp = claudeJson?.mcpServers ?? {};
        const localMcp = claudeJson?.projects?.[projectRoot]?.mcpServers ?? {};
        if (globalMcp['playwright'] || localMcp['playwright']) {
            console.log(chalk.green('  ✓ Playwright MCP already installed'));
        }
        else {
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
    }
    // 4. Install E2E commands for detected editors
    console.log(chalk.blue('\n─── Installing E2E Commands ───'));
    const detected = detectEditors(projectRoot);
    const codex = detectCodex();
    const adapters = codex ? [...detected, codex] : detected;
    if (adapters.length > 0) {
        const body = await readFile(CMD_BODY_SRC, 'utf-8');
        installForAllEditors(body, adapters, projectRoot);
    }
    else {
        const body = await readFile(CMD_BODY_SRC, 'utf-8');
        installForAllEditors(body, [claudeAdapter], projectRoot);
    }
    // Claude Code also gets the SKILL.md
    if (existsSync(join(projectRoot, '.claude'))) {
        const skillContent = await readFile(SKILL_SRC, 'utf-8');
        installSkill(projectRoot, skillContent);
    }
    // 5. Sync Healer tools with latest @playwright/mcp (Claude Code only)
    if (existsSync(join(projectRoot, '.claude'))) {
        console.log(chalk.blue('\n─── Syncing Healer Tools ───'));
        const skillDest = join(projectRoot, '.claude', 'skills', 'openspec-e2e', 'SKILL.md');
        await syncMcpTools(skillDest, true);
    }
    else {
        console.log(chalk.blue('\n─── Syncing Healer Tools ───'));
        console.log(chalk.gray('  - Claude Code not detected, skipping MCP sync'));
    }
    // 6. Install OpenSpec schema
    console.log(chalk.blue('\n─── Installing OpenSpec Schema ───'));
    await installSchema(projectRoot);
    // 7. Generate seed test
    if (options.seed !== false) {
        console.log(chalk.blue('\n─── Generating Seed Test ───'));
        await generateSeedTest(projectRoot);
    }
    // 8. Generate app-knowledge.md
    console.log(chalk.blue('\n─── Generating App Knowledge ───'));
    await generateAppKnowledge(projectRoot);
    // 9. Install employee-grade CLAUDE.md
    console.log(chalk.blue('\n─── Installing Employee Standards ───'));
    const standards = readEmployeeStandards(EMPLOYEE_STANDARDS_SRC);
    if (standards) {
        installProjectClaudeMd(projectRoot, standards);
    }
    // 10. Summary
    console.log(chalk.blue('\n─── Summary ───'));
    console.log(chalk.green('  ✓ Setup complete!\n'));
    console.log(chalk.bold('Next steps:'));
    console.log(chalk.gray('  1. Install Playwright browsers: npx playwright install --with-deps'));
    console.log(chalk.gray('  2. Customize tests/playwright/credentials.yaml with your test user'));
    console.log(chalk.gray('  3. Set credentials: export E2E_USERNAME=xxx E2E_PASSWORD=yyy'));
    console.log(chalk.gray('  4. Run auth setup: npx playwright test --project=setup'));
    const hasClaude = existsSync(join(projectRoot, '.claude'));
    if (hasClaude) {
        console.log(chalk.gray('  5. In Claude Code, run: /opsx:e2e <change-name>'));
    }
    console.log(chalk.gray(`  ${hasClaude ? '6.' : '5.'} Or: openspec-pw run <change-name>`));
    console.log(chalk.gray(`  ${hasClaude ? '7.' : '6.'} Or: openspec-pw doctor to verify setup\n`));
    console.log(chalk.bold('How it works:'));
    console.log(chalk.gray('  /opsx:e2e reads your OpenSpec specs and runs Playwright'));
    console.log(chalk.gray('  E2E tests through a three-agent pipeline:'));
    console.log(chalk.gray('  Planner → Generator → Healer\n'));
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
async function generateAppKnowledge(projectRoot) {
    const src = join(SCHEMA_DIR, 'playwright-e2e', 'templates', 'app-knowledge.md');
    const dest = join(projectRoot, 'tests', 'playwright', 'app-knowledge.md');
    if (existsSync(dest)) {
        console.log(chalk.gray('  - app-knowledge.md already exists, skipping'));
        return;
    }
    if (existsSync(src)) {
        writeFileSync(dest, readFileSync(src));
        console.log(chalk.green('  ✓ Generated: tests/playwright/app-knowledge.md'));
    }
}
async function installSchema(projectRoot) {
    const schemaSrc = SCHEMA_DIR + '/playwright-e2e';
    const schemaDest = join(projectRoot, 'openspec', 'schemas', 'playwright-e2e');
    const schemaFiles = ['schema.yaml'];
    mkdirSync(schemaDest, { recursive: true });
    for (const file of schemaFiles) {
        const src = join(schemaSrc, file);
        const dest = join(schemaDest, file);
        if (existsSync(src)) {
            writeFileSync(dest, readFileSync(src));
        }
    }
    // Copy templates
    const templatesSrc = join(schemaSrc, 'templates');
    const templatesDest = join(schemaDest, 'templates');
    mkdirSync(templatesDest, { recursive: true });
    const templateFiles = ['test-plan.md', 'report.md', 'e2e-test.ts', 'playwright.config.ts', 'app-knowledge.md'];
    for (const file of templateFiles) {
        const src = join(templatesSrc, file);
        const dest = join(templatesDest, file);
        if (existsSync(src)) {
            writeFileSync(dest, readFileSync(src));
        }
    }
    console.log(chalk.green('  ✓ Schema installed: openspec/schemas/playwright-e2e/'));
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