import { exec } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import chalk from 'chalk';
export const MCP_VERSION_MARKER = '<!-- MCP_VERSION:';
export const DEFAULT_HEALER_TOOLS = [
    { name: 'browser_navigate', purpose: "Go to the failing test's page" },
    { name: 'browser_snapshot', purpose: 'Get page structure to find equivalent selectors' },
    { name: 'browser_console_messages', purpose: 'Diagnose JS errors that may cause failures' },
    { name: 'browser_take_screenshot', purpose: 'Visually compare before/after fixes' },
    { name: 'browser_run_code', purpose: 'Execute custom fix logic (optional)' },
];
/** Extract MCP version from SKILL.md marker */
export function getStoredMcpVersion(skillContent) {
    const idx = skillContent.indexOf(MCP_VERSION_MARKER);
    if (idx === -1)
        return null;
    const end = skillContent.indexOf(' -->', idx);
    return skillContent.slice(idx + MCP_VERSION_MARKER.length, end).trim();
}
/** Build the Healer tools table markdown */
function buildHealerTable(version, tools) {
    const rows = tools.map(t => `| \`${t.name}\` | ${t.purpose} |`).join('\n');
    return `${MCP_VERSION_MARKER} ${version} -->\n\n| Tool | Purpose |\n|------|---------|\n${rows}`;
}
/** Replace the Healer tools table in SKILL.md */
export function updateHealerTable(skillContent, version, tools) {
    const start = skillContent.indexOf('| Tool | Purpose |');
    if (start === -1)
        return skillContent;
    let end = skillContent.indexOf('\n\n', start);
    if (end === -1)
        end = skillContent.length;
    const before = skillContent.slice(0, start);
    const after = skillContent.slice(end);
    return before + buildHealerTable(version, tools) + after;
}
/** Fetch latest @playwright/mcp version from npm registry */
export function getLatestMcpVersion() {
    return new Promise((resolve) => {
        exec('npm show @playwright/mcp version --json', { timeout: 15000 }, (err, stdout) => {
            if (err) {
                resolve(null);
                return;
            }
            try {
                resolve(JSON.parse(stdout.trim()));
            }
            catch {
                resolve(null);
            }
        });
    });
}
/** Parse README markdown to extract browser_* tool entries */
function parseMcpReadme(content) {
    const tools = [];
    const re = /-\s+\*\*`?([^`*\n]+)`?\*\*\s*-\s*Title:\s*([^\n]+)/g;
    let m;
    while ((m = re.exec(content)) !== null) {
        const name = m[1].trim();
        if (name.startsWith('browser_')) {
            const purpose = m[2].trim().replace(/\.$/, '');
            tools.push({ name, purpose });
        }
    }
    return tools;
}
/**
 * Fetch @playwright/mcp tools from npm package.
 * Downloads the tarball, extracts README, parses tool names.
 */
export function fetchMcpTools(version) {
    return new Promise((resolve) => {
        const tmpDir = `/tmp/openspec-pw-mcp-${version}`;
        exec(`rm -rf ${tmpDir} && mkdir -p ${tmpDir} && npm pack @playwright/mcp@${version} --pack-destination ${tmpDir} 2>/dev/null && tar -xzf ${tmpDir}/playwright-mcp-${version}.tgz -C ${tmpDir} --strip-components=1 && cat ${tmpDir}/package/README.md`, { timeout: 30000 }, (err, stdout) => {
            if (err) {
                resolve([]);
                return;
            }
            const tools = parseMcpReadme(stdout);
            resolve(tools);
        });
    });
}
/**
 * Sync Healer tools table in SKILL.md with latest @playwright/mcp.
 * Returns true if updated, false if already current or failed.
 */
export async function syncMcpTools(skillDest, verbose = false) {
    const latestVersion = await getLatestMcpVersion();
    if (!latestVersion) {
        if (verbose)
            console.log(chalk.yellow('  ⚠ Could not fetch latest @playwright/mcp version'));
        return false;
    }
    if (!existsSync(skillDest)) {
        if (verbose)
            console.log(chalk.gray('  - SKILL.md not found, skipping MCP sync'));
        return false;
    }
    const skillContent = readFileSync(skillDest, 'utf-8');
    const storedVersion = getStoredMcpVersion(skillContent);
    if (storedVersion === latestVersion) {
        if (verbose)
            console.log(chalk.gray(`  - Healer tools current (${latestVersion})`));
        return false;
    }
    if (verbose)
        console.log(chalk.blue(`  - Updating from ${storedVersion ?? 'unknown'} → ${latestVersion}`));
    const tools = await fetchMcpTools(latestVersion);
    const toolSet = tools.length > 0 ? tools : DEFAULT_HEALER_TOOLS;
    const updated = updateHealerTable(skillContent, latestVersion, toolSet);
    writeFileSync(skillDest, updated);
    if (verbose) {
        if (tools.length > 0) {
            console.log(chalk.green(`  ✓ Healer tools synced to ${latestVersion} (${tools.length} tools)`));
        }
        else {
            console.log(chalk.green(`  ✓ Healer tools synced to ${latestVersion} (default set)`));
        }
    }
    return true;
}
//# sourceMappingURL=mcpSync.js.map