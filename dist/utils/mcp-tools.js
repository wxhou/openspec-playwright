/**
 * Shared utilities for Playwright MCP tool synchronization.
 * Parses @playwright/mcp README to extract browser_* tool names and
 * updates the Healer MCP tools table in SKILL.md.
 */
import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
/** Cached directory for npm temp files */
const TMP_DIR = '/tmp/openspec-pw-mcp';
/**
 * Get the latest @playwright/mcp version from npm registry.
 * Falls back to cached README if network fails.
 */
function getLatestVersion() {
    try {
        const json = execSync('npm show @playwright/mcp version --json', { stdio: 'pipe', encoding: 'utf-8' }).trim();
        return JSON.parse(json);
    }
    catch {
        return '0.0.68'; // fallback to known version
    }
}
/**
 * Download and parse the @playwright/mcp README to extract all browser_* tools.
 */
export function fetchMcpTools() {
    const version = getLatestVersion();
    const tmpPkg = join(TMP_DIR, 'package');
    // Clean and prepare temp dir
    execSync(`rm -rf ${TMP_DIR} && mkdir -p ${TMP_DIR}`, { stdio: 'pipe' });
    // Download tarball
    execSync(`cd ${TMP_DIR} && npm pack @playwright/mcp@${version} --pack-destination ${TMP_DIR}`, { stdio: 'pipe' });
    const tarball = execSync(`ls -t ${TMP_DIR}/playwright-mcp-*.tgz | head -1`, { encoding: 'utf-8' }).trim();
    execSync(`tar -xzf "${tarball}" -C ${TMP_DIR} --strip-components=1`, { stdio: 'pipe' });
    const readme = readFileSync(join(TMP_DIR, 'README.md'), 'utf-8');
    return parseToolsFromReadme(readme);
}
/**
 * Parse browser_* tools from the MCP README markdown.
 * Format:
 * - **browser_navigate**
 *   - Title: Navigate to a URL
 *   - Description: Navigate to a URL
 */
function parseToolsFromReadme(readme) {
    const tools = [];
    // Match tool blocks: **browser_name** followed by Title and Description
    const blockRegex = /- \*\*([a-z_]+)\*\*[\s\S]*?- Title: ([^\n]+)\n[\s\S]*?- Description: ([^\n]+)/g;
    let match;
    while ((match = blockRegex.exec(readme)) !== null) {
        const name = match[1];
        const title = match[2].trim();
        const description = match[3].trim();
        // Map tool name to Healer purpose
        const purpose = mapToolToPurpose(name, title, description);
        tools.push({ name, title, description, purpose });
    }
    return tools;
}
/** Map a browser_* tool to its Healer purpose in the SKILL */
function mapToolToPurpose(name, title, description) {
    const map = {
        browser_navigate: 'Go to the failing test\'s page',
        browser_snapshot: 'Get page structure to find equivalent selectors',
        browser_console_messages: 'Diagnose JS errors that may cause failures',
        browser_take_screenshot: 'Visually compare before/after fixes',
        browser_run_code: 'Execute custom fix logic (optional)',
    };
    return map[name] || title;
}
/**
 * Update the Healer MCP tools table in SKILL.md.
 * Only syncs the 5 core Healer tools; all other MCP tools are
 * general-purpose automation not specific to healing.
 * Deduplicates by tool name.
 */
export function updateSkillHealerTable(skillPath, tools) {
    if (!existsSync(skillPath))
        return;
    const content = readFileSync(skillPath, 'utf-8');
    // Only the 5 core Healer tools
    const healerToolNames = [
        'browser_navigate',
        'browser_snapshot',
        'browser_console_messages',
        'browser_take_screenshot',
        'browser_run_code',
    ];
    // Filter to healer tools, deduplicate by name
    const healerTools = tools.filter(t => healerToolNames.includes(t.name));
    const seen = new Set();
    const unique = healerTools.filter(t => {
        if (seen.has(t.name))
            return false;
        seen.add(t.name);
        return true;
    });
    // Build new table rows
    const rows = unique.map(t => `| \`${t.name}\` | ${t.purpose} |`).join('\n');
    // Replace the existing table
    const tableHeader = '| Tool | Purpose |';
    const tableSep = '|------|---------|';
    const start = content.indexOf(tableHeader);
    const end = content.indexOf(tableSep, start + 1);
    if (start === -1 || end === -1)
        return;
    const newSection = tableHeader + '\n' + tableSep + '\n' + rows;
    const newContent = content.substring(0, start) +
        newSection +
        content.substring(end + tableSep.length);
    writeFileSync(skillPath, newContent, 'utf-8');
}
/**
 * Main entry point: fetch tools and update SKILL.md.
 * Call this after installing the skill in init.ts and update.ts.
 */
export function syncMcpTools(skillPath) {
    try {
        const tools = fetchMcpTools();
        updateSkillHealerTable(skillPath, tools);
        console.log(chalk.green(`  ✓ Healer tools synced from @playwright/mcp`));
    }
    catch (err) {
        console.log(chalk.yellow(`  ⚠ Failed to sync MCP tools: ${err}`));
        console.log(chalk.gray('  SKILL.md MCP tools table may be stale'));
    }
}
//# sourceMappingURL=mcp-tools.js.map