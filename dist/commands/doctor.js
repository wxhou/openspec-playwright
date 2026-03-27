import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import chalk from 'chalk';
export async function doctor() {
    console.log(chalk.blue('\n🔍 OpenSpec + Playwright E2E Prerequisites Check\n'));
    const projectRoot = process.cwd();
    let allOk = true;
    // Node.js
    console.log(chalk.blue('─── Node.js ───'));
    try {
        const node = execSync('node --version', { encoding: 'utf-8' }).trim();
        console.log(chalk.green(`  ✓ Node.js ${node}`));
    }
    catch {
        console.log(chalk.red('  ✗ Node.js not found'));
        allOk = false;
    }
    // npm
    console.log(chalk.blue('\n─── npm ───'));
    try {
        const npm = execSync('npm --version', { encoding: 'utf-8' }).trim();
        console.log(chalk.green(`  ✓ npm ${npm}`));
    }
    catch {
        console.log(chalk.red('  ✗ npm not found'));
        allOk = false;
    }
    // OpenSpec
    console.log(chalk.blue('\n─── OpenSpec ───'));
    const hasOpenSpec = existsSync(join(projectRoot, 'openspec'));
    if (hasOpenSpec) {
        console.log(chalk.green('  ✓ OpenSpec initialized'));
    }
    else {
        console.log(chalk.red('  ✗ OpenSpec not initialized'));
        console.log(chalk.gray('    Run: openspec init'));
        allOk = false;
    }
    // Playwright browsers
    console.log(chalk.blue('\n─── Playwright Browsers ───'));
    try {
        const pw = execSync('npx playwright --version', { encoding: 'utf-8' }).trim();
        console.log(chalk.green(`  ✓ Playwright ${pw}`));
    }
    catch {
        console.log(chalk.red('  ✗ Playwright browsers not installed'));
        console.log(chalk.gray('    Run: npx playwright install --with-deps'));
        allOk = false;
    }
    // Playwright MCP (global)
    console.log(chalk.blue('\n─── Playwright MCP ───'));
    const homeDir = process.env.HOME ?? '';
    const claudeJsonPath = join(homeDir, '.claude.json');
    let mcpInstalled = false;
    if (existsSync(claudeJsonPath)) {
        try {
            const claudeJson = JSON.parse(readFileSync(claudeJsonPath, 'utf-8'));
            const globalMcp = claudeJson?.mcpServers ?? {};
            const localMcp = claudeJson?.projects?.[projectRoot]?.mcpServers ?? {};
            if (globalMcp['playwright'] || localMcp['playwright']) {
                mcpInstalled = true;
            }
        }
        catch {
            // ignore
        }
    }
    if (mcpInstalled) {
        console.log(chalk.green('  ✓ Playwright MCP installed globally'));
    }
    else {
        console.log(chalk.red('  ✗ Playwright MCP not configured'));
        console.log(chalk.gray('    Run: openspec-pw init'));
        allOk = false;
    }
    // Skill
    console.log(chalk.blue('\n─── Claude Code Skill ───'));
    const hasSkill = existsSync(join(projectRoot, '.claude', 'skills', 'openspec-e2e', 'SKILL.md'));
    if (hasSkill) {
        console.log(chalk.green('  ✓ /openspec-e2e skill installed'));
    }
    else {
        console.log(chalk.red('  ✗ Skill not installed'));
        console.log(chalk.gray('    Run: openspec-pw init'));
        allOk = false;
    }
    // Seed test
    console.log(chalk.blue('\n─── Seed Test ───'));
    const hasSeed = existsSync(join(projectRoot, 'tests', 'playwright', 'seed.spec.ts'));
    if (hasSeed) {
        console.log(chalk.green('  ✓ seed.spec.ts found'));
    }
    else {
        console.log(chalk.yellow('  ⚠ seed.spec.ts not found (optional)'));
        console.log(chalk.gray('    Run: openspec-pw init'));
    }
    // Summary
    console.log(chalk.blue('\n─── Summary ───'));
    if (allOk) {
        console.log(chalk.green('  ✅ All prerequisites met!\n'));
        console.log(chalk.gray('  Run: /opsx:e2e <change-name> in Claude Code\n'));
    }
    else {
        console.log(chalk.red('  ❌ Some prerequisites are missing\n'));
        console.log(chalk.gray('  Run: openspec-pw init to fix\n'));
        process.exit(1);
    }
}
//# sourceMappingURL=doctor.js.map