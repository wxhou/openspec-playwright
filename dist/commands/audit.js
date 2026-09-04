import { execFileSync } from "child_process";
import { existsSync, readdirSync, readFileSync, } from "fs";
import { join } from "path";
import chalk from "chalk";
import { SHARED_FILE_NAMES, TIMEOUT, needsShell, detectAppServer } from "../shared/index.js";
export async function audit() {
    const projectRoot = process.cwd();
    const testsDir = join(projectRoot, "tests", "playwright");
    if (!existsSync(testsDir)) {
        console.log(chalk.yellow("  tests/playwright/ not found. Run `openspec-pw init` first.\n"));
        return;
    }
    console.log(chalk.blue("\n🔍 OpenSpec Playwright: Audit\n"));
    const results = [];
    // 1. Get sitemap routes
    const sitemapResult = await getSitemapRoutes(projectRoot);
    const allRoutes = sitemapResult.routes;
    if (sitemapResult.note) {
        console.log(chalk.gray(`  ℹ ${sitemapResult.note}`));
    }
    // 2. Get OpenSpec change names
    const changeNames = await getChangeNames(projectRoot);
    // 3. Scan all spec files recursively
    const specFiles = collectSpecFiles(testsDir);
    // 4. Audit each spec file
    const SHARED_FILES = SHARED_FILE_NAMES;
    for (const file of specFiles) {
        const relPath = file.replace(testsDir + "/", "");
        const content = readFileSync(file, "utf-8");
        // Skip shared files
        const fileName = relPath.split("/").pop() ?? "";
        if (SHARED_FILES.has(fileName))
            continue;
        // 4a. Orphaned spec file: no matching OpenSpec change
        const changeName = fileName.replace(".spec.ts", "");
        // Check if this is a root-level old-style file
        if (!relPath.includes("/")) {
            if (changeNames.length > 0 && !changeNames.includes(changeName)) {
                results.push({
                    fileName: relPath,
                    issue: "Orphaned spec file",
                    detail: `No matching OpenSpec change found. Consider migrating to tests/playwright/changes/${changeName}/`,
                });
            }
        }
        // 4b. Check for hardcoded URLs not in sitemap
        const urlMatches = content.match(/https?:\/\/[^\s'"]+/g);
        if (urlMatches) {
            for (const url of urlMatches) {
                const pathname = new URL(url).pathname;
                if (pathname !== "/" &&
                    allRoutes.length > 0 &&
                    !allRoutes.includes(pathname) &&
                    !allRoutes.some((r) => pathname.startsWith(r))) {
                    results.push({
                        fileName: relPath,
                        issue: "Route not in sitemap",
                        detail: `Found URL: ${url}`,
                    });
                }
            }
        }
    }
    // 4c. Spec-anchor retire check: tests anchored to requirements that no
    // longer exist in the main spec. Report-only — audit never deletes.
    const anchorStats = auditSpecAnchors(projectRoot, testsDir, specFiles, results);
    // 5. Check for missing auth.setup when tests reference protected routes
    const needsAuth = specFiles.some((file) => {
        const content = readFileSync(file, "utf-8");
        const fileName = file.split("/").pop() ?? "";
        return (!SHARED_FILES.has(fileName) &&
            (content.includes("storageState") ||
                content.includes("auth.setup") ||
                content.includes("authenticated") ||
                content.includes("dashboard") ||
                content.includes("profile")));
    });
    if (needsAuth && !existsSync(join(testsDir, "auth.setup.ts"))) {
        results.push({
            fileName: "auth.setup.ts",
            issue: "Missing auth setup",
            detail: "Tests reference protected routes but auth.setup.ts is not found",
        });
    }
    // 6. Check for deprecated old-style file locations
    const rootSpecFiles = readdirSync(testsDir).filter((f) => f.endsWith(".spec.ts") && !SHARED_FILES.has(f));
    for (const f of rootSpecFiles) {
        results.push({
            fileName: f,
            issue: "Old-style file location",
            detail: `Run \`openspec-pw migrate\` to move to tests/playwright/changes/${f.replace(".spec.ts", "")}/`,
        });
    }
    // 7. Output results
    // Anchor-free info stats: visibility signal only, never counted as issues.
    for (const line of anchorStats) {
        console.log(chalk.gray(`  ℹ ${line}`));
    }
    if (results.length === 0) {
        if (anchorStats.length === 0) {
            console.log(chalk.green("  ✅ No issues found. All tests look healthy.\n"));
        }
        return;
    }
    console.log(chalk.yellow(`─── Found ${results.length} issue(s) ───`));
    // Group by issue type
    const grouped = {};
    for (const r of results) {
        if (!grouped[r.issue])
            grouped[r.issue] = [];
        grouped[r.issue].push(r);
    }
    for (const [issue, items] of Object.entries(grouped)) {
        console.log(chalk.yellow(`\n  ⚠ ${issue}`));
        for (const item of items) {
            console.log(chalk.gray(`    - ${item.fileName}`));
            if (item.detail) {
                console.log(chalk.gray(`      → ${item.detail}`));
            }
        }
    }
    console.log(chalk.blue("\n─── Suggested fixes ───"));
    if (Object.keys(grouped).some((k) => k.includes("Old-style"))) {
        console.log(chalk.green("  Run `openspec-pw migrate` to reorganize file structure."));
    }
    if (Object.keys(grouped).some((k) => k.includes("Missing auth"))) {
        console.log(chalk.green("  Run `openspec-pw init` with auth credentials configured."));
    }
    if (Object.keys(grouped).some((k) => k.includes("Route not in sitemap"))) {
        console.log(chalk.green("  Update sitemap or verify route is intentional."));
    }
    console.log();
}
const ANCHOR_RE = /^\/\/\s*spec:\s*([^#\n]+)#(.+)$/;
/** Shared-file exclusion set (SHARED_FILE_NAMES) as a local Set for helpers. */
const SHARED_FILES_LOCAL = new Set(SHARED_FILE_NAMES);
/** Extract every `// spec: <cap>#<title>` line from a spec file's content. */
export function extractSpecAnchors(content) {
    const anchors = [];
    content.split("\n").forEach((line, idx) => {
        const m = ANCHOR_RE.exec(line.trim());
        if (m) {
            anchors.push({
                capability: m[1].trim(),
                requirementTitle: m[2].trim(),
                line: idx,
            });
        }
    });
    return anchors;
}
/**
 * Indices of content lines that belong to a `test.fixme(...)` block. A fixme
 * test is a declared "known-stale, kept on purpose" — anchor checks skip it
 * (reporting it would be noise and push users toward deleting the anchor to
 * silence the report). Line-level regex, same style as the flake scanner.
 */
export function extractFixmeLines(content) {
    const lines = content.split("\n");
    const fixme = new Set();
    lines.forEach((line, idx) => {
        if (/test\.fixme\s*\(/.test(line)) {
            // The fixme title string ends the declaration; the test body spans
            // until the matching close. Line-level approximation: the same line
            // plus the block that follows until a line starting with `});` at the
            // test's indentation. Cheap superset: mark the anchor candidates that
            // lie within [line, next `});` line].
            let end = idx;
            for (let j = idx + 1; j < lines.length; j++) {
                if (/^\s*\}\);/.test(lines[j])) {
                    end = j;
                    break;
                }
                if (j === lines.length - 1)
                    end = j;
            }
            for (let k = idx; k <= end; k++)
                fixme.add(k);
        }
    });
    return fixme;
}
/** Whether a `// spec:` anchor at line index `line` is exempt (inside a fixme block). */
function anchorIsFixmeExempt(fixmeLines, line) {
    return fixmeLines.has(line);
}
/**
 * Check 4c: report tests whose spec anchor points at a requirement that no
 * longer exists in the main spec. Pure computation over injected reads so
 * unit tests never need a real openspec tree — the fs-reading variant below
 * wires this into audit().
 */
export function auditAnchorsCore(input) {
    const { testsDir, specFiles, readMainSpec, readArchivedDeltas } = input;
    const results = [];
    const unanchoredByDir = new Map();
    const mainSpecCache = new Map();
    const getMainSpec = (cap) => {
        if (!mainSpecCache.has(cap))
            mainSpecCache.set(cap, readMainSpec(cap));
        return mainSpecCache.get(cap) ?? null;
    };
    for (const file of specFiles) {
        const relPath = file.replace(testsDir + "/", "");
        const fileName = relPath.split("/").pop() ?? "";
        if (SHARED_FILES_LOCAL.has(fileName))
            continue;
        const content = readFileSync(file, "utf-8");
        const lines = content.split("\n");
        // Anchors carry their own line indices — duplicate anchor texts (same
        // requirement, multiple tests) each keep their true position.
        const anchors = extractSpecAnchors(content);
        // Tests without an anchor on the line directly above them.
        const testLines = lines
            .map((l, idx) => ({ idx, isTest: /^\s*(test|await\s+test)\s*[\('"]/.test(l) }))
            .filter((t) => t.isTest);
        const fixmeLines = extractFixmeLines(content);
        let unanchored = 0;
        for (const t of testLines) {
            const anchorAbove = anchors.find((a) => a.line === t.idx - 1 || a.line === t.idx - 2);
            if (!anchorAbove)
                unanchored++;
        }
        if (unanchored > 0) {
            const dir = relPath.includes("/")
                ? relPath.slice(0, relPath.lastIndexOf("/"))
                : relPath;
            unanchoredByDir.set(dir, (unanchoredByDir.get(dir) ?? 0) + unanchored);
        }
        for (const anchor of anchors) {
            if (anchor.line >= 0 && anchorIsFixmeExempt(fixmeLines, anchor.line))
                continue;
            const mainSpec = getMainSpec(anchor.capability);
            if (mainSpec === null) {
                results.push({
                    fileName: relPath,
                    issue: "Anchored to retired capability",
                    detail: `Anchor capability \`${anchor.capability}\` has no openspec/specs/ directory — renamed or removed? Verify before retiring the test.`,
                });
                continue;
            }
            if (!mainSpec.includes(anchor.requirementTitle)) {
                const archived = readArchivedDeltas(anchor.capability);
                const culprit = archived.find((d) => d.content.includes(`### Requirement: ${anchor.requirementTitle}`));
                results.push({
                    fileName: relPath,
                    issue: "Anchored to removed requirement",
                    detail: culprit
                        ? `Requirement "${anchor.requirementTitle}" is gone from the main spec — removed by archived change \`${culprit.change}\`. Test is a retire candidate (delete, fixme with reason, or keep if the behavior lives on).`
                        : `Requirement "${anchor.requirementTitle}" is gone from the main spec. Test is a retire candidate (delete, fixme with reason, or keep if the behavior lives on).`,
                });
            }
        }
    }
    const infoLines = [];
    for (const [dir, count] of unanchoredByDir) {
        infoLines.push(`${dir}/ — ${count} test(s) without spec anchors (pre-anchors legacy or missing anchors)`);
    }
    return { results, infoLines };
}
/** fs-reading wiring of auditAnchorsCore for audit(). Report-only: no writes. */
function auditSpecAnchors(projectRoot, testsDir, specFiles, results) {
    const output = auditAnchorsCore({
        projectRoot,
        testsDir,
        specFiles,
        readMainSpec: (cap) => {
            const specPath = join(projectRoot, "openspec", "specs", ...cap.split("/"), "spec.md");
            if (!existsSync(specPath))
                return null;
            return readFileSync(specPath, "utf-8");
        },
        readArchivedDeltas: (cap) => {
            const archiveDir = join(projectRoot, "openspec", "changes", "archive");
            if (!existsSync(archiveDir))
                return [];
            const out = [];
            for (const entry of readdirSync(archiveDir, { withFileTypes: true })) {
                if (!entry.isDirectory())
                    continue;
                const deltaPath = join(archiveDir, entry.name, "specs", ...cap.split("/"), "spec.md");
                if (!existsSync(deltaPath))
                    continue;
                out.push({ change: entry.name, content: readFileSync(deltaPath, "utf-8") });
            }
            return out;
        },
    });
    results.push(...output.results);
    return output.infoLines;
}
export async function getSitemapRoutes(projectRoot) {
    // detectAppServer already prefers process.env.BASE_URL and falls back
    // through the full detection chain (script port → vite config → .env →
    // framework default → seed → localhost:3000).
    const { baseUrl, baseUrlSource } = detectAppServer(projectRoot);
    const hasBaseUrl = baseUrlSource === "BASE_URL env";
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT.OPENSPEC_LIST);
        const response = await fetch(`${baseUrl}/sitemap.xml`, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!response.ok) {
            return {
                routes: [],
                note: `${baseUrl}/sitemap.xml returned ${response.status}; route coverage check skipped`,
            };
        }
        const text = await response.text();
        const urlRegex = /<loc>([^<]+)<\/loc>/g;
        const urls = [];
        let match;
        while ((match = urlRegex.exec(text)) !== null && urls.length < 50) {
            try {
                urls.push(new URL(match[1]).pathname);
            }
            catch { }
        }
        return { routes: [...new Set(urls)], note: null };
    }
    catch (err) {
        const reason = hasBaseUrl
            ? `fetch failed: ${err.message}`
            : `no BASE_URL set, fell back to ${baseUrl} (${baseUrlSource})`;
        return {
            routes: [],
            note: `sitemap.xml unreachable; route coverage check skipped (${reason})`,
        };
    }
}
async function getChangeNames(projectRoot) {
    try {
        const result = execFileSync("npx", ["openspec", "list", "--json"], { shell: needsShell,
            cwd: projectRoot,
            encoding: "utf-8",
            timeout: TIMEOUT.OPENSPEC_LIST,
        });
        const data = JSON.parse(result);
        if (Array.isArray(data))
            return data.map((c) => c.name);
        if (data.changes && Array.isArray(data.changes))
            return data.changes.map((c) => c.name);
        return Object.keys(data);
    }
    catch {
        return [];
    }
}
function collectSpecFiles(dir, collected = []) {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
            // Skip node_modules, .auth, __snapshots__ etc.
            if (!entry.name.startsWith(".") &&
                entry.name !== "node_modules" &&
                entry.name !== "__snapshots__") {
                collectSpecFiles(fullPath, collected);
            }
        }
        else if (entry.name.endsWith(".spec.ts")) {
            collected.push(fullPath);
        }
    }
    return collected;
}
//# sourceMappingURL=audit.js.map