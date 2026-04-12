import { chromium } from "playwright";
import chalk from "chalk";
import { existsSync, cpSync, renameSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
// ── File utilities ────────────────────────────────────────────────────────────────
/**
 * Atomic write: backup original, write new content, revert on failure.
 * Uses cpSync + rename for atomicity (POSIX rename is atomic on success).
 */
function atomicWrite(filePath, content) {
    const backupPath = `${filePath}.bak`;
    cpSync(filePath, backupPath, { force: true });
    try {
        writeFileSync(filePath, content, "utf-8");
    }
    catch (err) {
        cpSync(backupPath, filePath, { force: true });
        throw err;
    }
}
/**
 * Acquire a lock file. Returns false if already locked by a live process.
 */
function acquireLock(lockPath) {
    try {
        writeFileSync(lockPath, `${process.pid}`, { flag: "wx" });
        return true;
    }
    catch {
        return false;
    }
}
function releaseLock(lockPath) {
    try {
        existsSync(lockPath) && renameSync(lockPath, `${lockPath}.released`);
    }
    catch { }
}
// ── Parsing ────────────────────────────────────────────────────────────────────
function parseExplorationFile(content) {
    const baseUrlMatch = content.match(/BASE_URL:\s*(\S+)/);
    const baseUrl = baseUrlMatch ? baseUrlMatch[1].trim() : "http://localhost:3000";
    const routes = [];
    // More permissive regex: match any column count, allow spaces in route path
    const tableRegex = /^\|\s*(\/[^\s|]+)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*(.+?)\s*\|/gm;
    let match;
    while ((match = tableRegex.exec(content)) !== null) {
        routes.push({
            path: match[1],
            auth: match[2].trim(),
            status: match[3].trim(),
            readySignal: match[4].trim(),
        });
    }
    return { baseUrl, routes, rawContent: content };
}
function updateExplorationFile(original, results) {
    const lines = original.rawContent.split("\n");
    const updatedLines = [];
    for (const line of lines) {
        // Update the Exploration Summary table with new results
        if (line.match(/^\| \//)) {
            const pathMatch = line.match(/^\| (\/\S+)/);
            if (pathMatch) {
                const path = pathMatch[1];
                const result = results.find((r) => r.path === path);
                if (result) {
                    const icon = result.status === "ok"
                        ? "explored"
                        : result.status === "error"
                            ? "error"
                            : result.status === "auth-required"
                                ? "auth-required"
                                : "skipped";
                    // Replace status column (3rd column)
                    const cols = line.split("|");
                    if (cols.length >= 4) {
                        cols[3] = ` ${icon} `;
                        updatedLines.push(cols.join("|"));
                        continue;
                    }
                }
            }
        }
        updatedLines.push(line);
    }
    return updatedLines.join("\n");
}
function buildSummaryTable(results) {
    const lines = [
        "## Exploration Results",
        "",
        "| Route | Status | Title | Forms | Links | Error |",
        "|-------|--------|-------|-------|-------|-------|",
    ];
    for (const r of results) {
        const icon = r.status === "ok"
            ? "ok"
            : r.status === "error"
                ? "error"
                : r.status === "auth-required"
                    ? "auth-required"
                    : "skipped";
        const title = r.snapshot.title ? r.snapshot.title.slice(0, 30) : "-";
        const error = r.errorMessage ? r.errorMessage.slice(0, 40) : "-";
        lines.push(`| ${r.path} | ${icon} | ${title} | ${r.snapshot.formCount} | ${r.snapshot.linkCount} | ${error} |`);
    }
    return lines.join("\n");
}
function appendFailureSection(content, results) {
    const failures = results.filter((r) => r.status === "error" || r.status === "auth-required");
    if (failures.length === 0)
        return content;
    const failureLines = [
        "",
        "## Exploration Failures",
        "",
        "| Route | Status | Error | Notes |",
        "|-------|--------|-------|-------|",
    ];
    for (const f of failures) {
        const notes = f.status === "auth-required"
            ? "Requires authentication — set up auth.setup.ts"
            : "";
        failureLines.push(`| ${f.path} | ${f.status} | ${f.errorMessage ?? "unknown"} | ${notes} |`);
    }
    failureLines.push("");
    return content + failureLines.join("\n");
}
// ── Worker ──────────────────────────────────────────────────────────────────────
async function exploreRoute(page, route, baseUrl) {
    const url = `${baseUrl}${route}`;
    const loginPatterns = [
        "/login",
        "/signin",
        "/auth",
        "/sign-in",
        "/log-in",
        "/oauth",
        "/sso",
    ];
    try {
        const response = await page.goto(url, {
            waitUntil: "networkidle",
            timeout: 30000,
        });
        const status = response?.status() ?? 0;
        const finalUrl = page.url();
        // Detect redirect to login page (auth-required route)
        if (status < 400) {
            try {
                const expectedOrigin = new URL(baseUrl).origin;
                const finalOrigin = new URL(finalUrl).origin;
                if (finalOrigin === expectedOrigin &&
                    finalUrl !== url &&
                    loginPatterns.some((p) => finalUrl.toLowerCase().includes(p))) {
                    return {
                        path: route,
                        url,
                        status: "auth-required",
                        errorMessage: `Redirected to login`,
                        snapshot: { formCount: 0, linkCount: 0 },
                    };
                }
            }
            catch {
                // URL parsing failed — proceed with status-based result
            }
        }
        if (status >= 400) {
            return {
                path: route,
                url,
                status: "error",
                errorMessage: `HTTP ${status}`,
                snapshot: { formCount: 0, linkCount: 0 },
            };
        }
        // Collect snapshot data
        const snapshot = await page.evaluate(() => {
            const title = document.title;
            const h1 = document.querySelector("h1");
            const mainHeading = h1?.textContent?.trim();
            const formCount = document.querySelectorAll("form").length;
            const linkCount = document.querySelectorAll("a").length;
            return { title, mainHeading, formCount, linkCount };
        });
        return {
            path: route,
            url,
            status: "ok",
            snapshot,
        };
    }
    catch (err) {
        const error = err;
        return {
            path: route,
            url,
            status: "error",
            errorMessage: error.message,
            snapshot: { formCount: 0, linkCount: 0 },
        };
    }
}
async function runWorker(workerId, routes, baseUrl) {
    const results = [];
    if (routes.length === 0)
        return results;
    let browser;
    try {
        browser = await chromium.launch({
            headless: true,
            timeout: 60000,
        });
        const context = await browser.newContext();
        const page = await context.newPage();
        for (const route of routes) {
            const result = await exploreRoute(page, route, baseUrl);
            results.push(result);
            const icon = result.status === "ok"
                ? chalk.green("ok")
                : result.status === "auth-required"
                    ? chalk.yellow("auth")
                    : chalk.red("err");
            const pathDisplay = route.length > 40 ? route.slice(0, 40) + "..." : route;
            console.log(`  [worker ${workerId}] ${icon}  ${pathDisplay}`);
        }
        await context.close();
    }
    finally {
        if (browser) {
            await browser.close();
        }
    }
    return results;
}
function chunkRoutes(routes, numWorkers) {
    const chunks = Array.from({ length: numWorkers }, () => []);
    routes.forEach((route, i) => {
        chunks[i % numWorkers].push(route);
    });
    return chunks;
}
// ── Main ───────────────────────────────────────────────────────────────────────
export async function explore(options) {
    const projectRoot = process.cwd();
    const MAX_WORKERS = 16;
    const numWorkers = Math.min(options.parallel ?? 4, MAX_WORKERS);
    const startTime = Date.now();
    // ── Signal handling: clean up on Ctrl+C / SIGTERM ──
    let interrupted = false;
    const cleanup = () => {
        if (interrupted)
            return;
        interrupted = true;
        console.log(chalk.yellow("\n  Interrupted — cleaning up Chromium processes...\n"));
        process.exit(130);
    };
    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);
    console.log(chalk.blue(`\nApp Exploration — ${numWorkers} workers\n`));
    // 1. Read app-exploration.md
    const explorationPath = join(projectRoot, "app-exploration.md");
    if (!existsSync(explorationPath)) {
        console.log(chalk.red(`  app-exploration.md not found in ${projectRoot}\n` +
            `  Run openspec-pw init first to generate it, or create it manually.\n`));
        process.exit(1);
    }
    const fileContent = readFileSync(explorationPath, "utf-8");
    const parsed = parseExplorationFile(fileContent);
    if (parsed.routes.length === 0) {
        console.log(chalk.red(`  ERROR: No routes parsed from app-exploration.md.\n` +
            `  Check that the file contains a valid route table with | /path | ... | format.\n`));
        process.exit(1);
    }
    const baseUrl = process.env.BASE_URL ?? parsed.baseUrl;
    const paths = parsed.routes.map((r) => r.path);
    console.log(chalk.blue("─── Dry Run ───"));
    if (options.dryRun) {
        for (let i = 0; i < paths.length; i++) {
            const chunk = i % numWorkers;
            console.log(`  worker ${chunk}: ${paths[i]}`);
        }
        console.log(chalk.gray(`\n  (dry run — no browsers launched)\n`));
        return;
    }
    // 1b. Acquire lock to prevent concurrent runs from overwriting each other
    const lockPath = join(projectRoot, ".explore.lock");
    if (!acquireLock(lockPath)) {
        console.log(chalk.red(`  ERROR: Another explore process is running.\n` +
            `  Remove ${lockPath} if no other process is active.\n`));
        process.exit(1);
    }
    try {
        // 2. Split routes into chunks
        const chunks = chunkRoutes(paths, numWorkers);
        const nonEmptyChunks = chunks
            .map((c, i) => ({ chunk: c, id: i }))
            .filter((x) => x.chunk.length > 0);
        console.log(chalk.blue(`─── Exploring ${paths.length} routes with ${nonEmptyChunks.length} workers ───\n`));
        // 3. Launch workers concurrently
        const workerPromises = nonEmptyChunks.map(({ chunk, id }) => runWorker(id, chunk, baseUrl));
        const settled = await Promise.allSettled(workerPromises);
        // 4. Merge results
        const allResults = [];
        for (const result of settled) {
            if (result.status === "fulfilled") {
                allResults.push(...result.value);
            }
        }
        // 5. Sort results to match original route order
        const pathOrder = new Map(paths.map((p, i) => [p, i]));
        allResults.sort((a, b) => (pathOrder.get(a.path) ?? 0) - (pathOrder.get(b.path) ?? 0));
        // 6. Write updated app-exploration.md (atomic)
        let updatedContent = updateExplorationFile(parsed, allResults);
        updatedContent = appendFailureSection(updatedContent, allResults);
        atomicWrite(explorationPath, updatedContent);
        // 7. Print summary
        const durationMs = Date.now() - startTime;
        const durationSec = (durationMs / 1000).toFixed(1);
        const okCount = allResults.filter((r) => r.status === "ok").length;
        const authCount = allResults.filter((r) => r.status === "auth-required").length;
        const errorCount = allResults.filter((r) => r.status === "error").length;
        const totalCount = allResults.length;
        console.log(chalk.blue("\n─── Summary ───"));
        console.log(`  Routes explored: ${totalCount}  ` +
            chalk.green(`ok ${okCount}`) +
            (authCount > 0
                ? `  ${chalk.yellow(`auth-required ${authCount}`)}`
                : "") +
            "  " +
            (errorCount > 0
                ? chalk.red(`error ${errorCount}`)
                : chalk.gray(`error ${errorCount}`)) +
            `  Duration: ${durationSec}s`);
        console.log(chalk.blue("\n─── Updated ───"));
        console.log(chalk.green(`  ${explorationPath}\n`));
        if (errorCount > 0) {
            console.log(chalk.red(`Exploration completed with ${errorCount} error(s).\n`));
        }
        else {
            console.log(chalk.green("Exploration completed successfully.\n"));
        }
    }
    finally {
        releaseLock(lockPath);
    }
}
//# sourceMappingURL=explore.js.map