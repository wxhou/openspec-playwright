import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";
function readPackageJson(path) {
    try {
        return JSON.parse(readFileSync(path, "utf-8"));
    }
    catch {
        return null;
    }
}
function hasRunnableScript(pkg) {
    const scripts = pkg.scripts ?? {};
    return Boolean(scripts["dev:all"] || scripts.dev || scripts.start || scripts.serve || scripts.preview);
}
export function findNpmRoot(projectRoot, maxDepth = 5) {
    function search(dir, depth) {
        if (depth > maxDepth)
            return null;
        const pkgPath = join(dir, "package.json");
        if (existsSync(pkgPath)) {
            const pkg = readPackageJson(pkgPath);
            if (pkg && hasRunnableScript(pkg))
                return dir;
        }
        try {
            const entries = readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (!entry.isDirectory() || entry.name.startsWith(".") || entry.name === "node_modules")
                    continue;
                const found = search(join(dir, entry.name), depth + 1);
                if (found)
                    return found;
            }
        }
        catch {
            // ignore unreadable directories
        }
        return null;
    }
    return search(projectRoot, 0) ?? projectRoot;
}
export function chooseDevScript(scripts) {
    if (scripts["dev:all"])
        return "dev:all";
    if (scripts.dev)
        return "dev";
    if (scripts.start)
        return "start";
    if (scripts.serve)
        return "serve";
    if (scripts.preview)
        return "preview";
    return undefined;
}
export function parsePort(text) {
    const patterns = [
        /(?:^|\s)(?:--port|-p)\s+([0-9]{2,5})(?:\s|$)/,
        /(?:^|\s)--port=([0-9]{2,5})(?:\s|$)/,
        /(?:^|\s)(?:PORT|VITE_PORT|PLAYWRIGHT_PORT|E2E_PORT)=([0-9]{2,5})(?:\s|$)/,
        /port\s*:\s*([0-9]{2,5})/,
    ];
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            const port = Number(match[1]);
            if (port > 0 && port <= 65535)
                return port;
        }
    }
    return undefined;
}
function parseEnvPort(content) {
    const lines = content.split(/\r?\n/);
    for (const key of ["PLAYWRIGHT_PORT", "E2E_PORT", "VITE_PORT", "PORT"]) {
        for (const line of lines) {
            const match = line.match(new RegExp(`^\\s*${key}\\s*=\\s*["']?([0-9]{2,5})["']?\\s*$`));
            if (match) {
                const port = Number(match[1]);
                if (port > 0 && port <= 65535)
                    return port;
            }
        }
    }
    return undefined;
}
function detectPortFromEnv(env) {
    for (const key of ["PLAYWRIGHT_PORT", "E2E_PORT", "VITE_PORT", "PORT"]) {
        const value = env[key];
        if (!value)
            continue;
        const port = Number(value);
        if (Number.isInteger(port) && port > 0 && port <= 65535) {
            return { port, source: `${key} env` };
        }
    }
    return undefined;
}
function detectPortFromEnvFiles(npmRoot) {
    for (const file of [".env.local", ".env.development", ".env"]) {
        const path = join(npmRoot, file);
        if (!existsSync(path))
            continue;
        const port = parseEnvPort(readFileSync(path, "utf-8"));
        if (port)
            return { port, source: file };
    }
    return undefined;
}
function detectVitePort(npmRoot) {
    for (const file of ["vite.config.ts", "vite.config.mts", "vite.config.js", "vite.config.mjs", "vite.config.cjs"]) {
        const path = join(npmRoot, file);
        if (!existsSync(path))
            continue;
        const port = parsePort(readFileSync(path, "utf-8"));
        if (port)
            return { port, source: file };
    }
    return undefined;
}
function detectSeedBaseUrl(projectRoot) {
    const seedSpec = join(projectRoot, "tests", "playwright", "seed.spec.ts");
    if (!existsSync(seedSpec))
        return undefined;
    const content = readFileSync(seedSpec, "utf-8");
    const match = content.match(/BASE_URL\s*=\s*process\.env\.BASE_URL\s*\|\|\s*['"]([^'"]+)['"]/);
    if (match) {
        const baseUrl = match[1];
        // Skip seed defaults like '/' that are relative to Playwright use.baseURL
        if (baseUrl.startsWith("http://") || baseUrl.startsWith("https://")) {
            return { baseUrl, source: "seed.spec.ts" };
        }
    }
    return undefined;
}
function dependencyExists(pkg, name) {
    return Boolean(pkg.dependencies?.[name] || pkg.devDependencies?.[name]);
}
function frameworkDefaultPort(pkg, command = "") {
    if (command.includes("vite") || dependencyExists(pkg, "vite"))
        return { port: 5173, source: "vite default" };
    if (command.includes("astro") || dependencyExists(pkg, "astro"))
        return { port: 4321, source: "astro default" };
    if (command.includes("next") || dependencyExists(pkg, "next"))
        return { port: 3000, source: "next default" };
    if (command.includes("nuxt") || dependencyExists(pkg, "nuxt"))
        return { port: 3000, source: "nuxt default" };
    return undefined;
}
// Frontend framework dependency keys — exact key match on deps/devDeps
// (substring would false-hit vitest/nextra). Scoped packages use their full
// name (e.g. "@angular/core"). Keep the framework set in sync with
// frameworkDefaultPort above (vite/astro/next/nuxt subset) — one module,
// one maintenance point.
const FRONTEND_FRAMEWORK_DEPS = [
    "react", "next", "vue", "nuxt", "svelte", "sveltekit", "astro",
    "angular", "solid", "preact", "remix", "vite", "@angular/core",
];
// Frontend dev-command keywords — substring match on scripts.dev (command
// text is naturally matched by inclusion).
const FRONTEND_DEV_COMMAND_KEYWORDS = ["vite", "next", "nuxt", "svelte-kit", "astro"];
// Framework config files — the strongest zero-ambiguity signal: presence at
// a project/npm root means "frontend" even when dependencies live elsewhere
// (monorepo roots commonly hold no frontend deps at all).
const FRONTEND_CONFIG_FILES = [
    "vite.config.js", "vite.config.ts", "vite.config.mjs",
    "next.config.js", "next.config.ts", "next.config.mjs",
    "nuxt.config.js", "nuxt.config.ts", "nuxt.config.mjs",
    "angular.json",
    "svelte.config.js", "svelte.config.ts",
    "astro.config.js", "astro.config.mjs", "astro.config.ts",
    "vue.config.js", "vue.config.ts",
    "remix.config.js", "remix.config.ts",
];
// Workspace-scan bounds (spec: frontend-signal-detection): never walk deeper
// than 3 directory levels and never inspect more than 50 member package.jsons
// — guards against unbounded scans on huge repos.
const WORKSPACE_SCAN_MAX_DEPTH = 3;
const WORKSPACE_SCAN_MAX_MEMBERS = 50;
function hasFrontendConfigFile(dir) {
    return FRONTEND_CONFIG_FILES.some((file) => existsSync(join(dir, file)));
}
function packageHasFrontendDeps(pkg) {
    return FRONTEND_FRAMEWORK_DEPS.some((name) => dependencyExists(pkg, name));
}
/**
 * Workspace member globs for a detected monorepo, or null when the project
 * is not a detectable workspace. An empty array means "workspace but no
 * member globs discoverable" (marker files only) — the caller falls back to
 * a bounded tree scan. Reads pnpm-workspace.yaml naively (list items only)
 * and package.json workspaces (array or {packages} form); turbo/nx/lerna/
 * rush markers carry no member list at all.
 */
function workspaceGlobPatterns(root, pkg) {
    const pnpmYaml = join(root, "pnpm-workspace.yaml");
    let isWorkspace = false;
    if (existsSync(pnpmYaml)) {
        isWorkspace = true;
        try {
            const patterns = readFileSync(pnpmYaml, "utf-8")
                .split(/\r?\n/)
                .filter((line) => /^\s*-/.test(line))
                .map((line) => line.replace(/^\s*-\s*/, "").trim().replace(/^['"]|['"]$/g, ""))
                .filter((pattern) => pattern.length > 0);
            if (patterns.length > 0)
                return patterns;
        }
        catch {
            // unreadable → fall through to the other markers
        }
    }
    if (Array.isArray(pkg.workspaces))
        return pkg.workspaces;
    const wsPackages = pkg.workspaces?.packages;
    if (Array.isArray(wsPackages))
        return wsPackages;
    for (const marker of ["turbo.json", "nx.json", "lerna.json", "rush.json"]) {
        if (existsSync(join(root, marker)))
            return [];
    }
    return isWorkspace ? [] : null;
}
/**
 * Expand member globs ("apps/*", "packages/**", "apps/web") into candidate
 * member directories. Supports only the simple forms — an exact path, or a
 * star-wildcard in the last segment. Anything else (leading/middle wildcards)
 * returns null so the caller falls back to a bounded tree scan.
 */
function resolveMemberDirs(root, patterns) {
    const dirs = [];
    for (const raw of patterns) {
        const pattern = raw.replace(/^\.\//, "").replace(/\/+$/, "");
        if (pattern === "")
            continue;
        const segments = pattern.split("/");
        const last = segments.length - 1;
        if (segments.some((seg, i) => i !== last && seg.includes("*")))
            return null;
        if (segments[last].includes("*")) {
            const baseDir = join(root, ...segments.slice(0, last));
            if (!existsSync(baseDir))
                continue;
            try {
                for (const entry of readdirSync(baseDir, { withFileTypes: true })) {
                    if (!entry.isDirectory() || entry.name.startsWith(".") || entry.name === "node_modules")
                        continue;
                    dirs.push(join(baseDir, entry.name));
                }
            }
            catch {
                // unreadable base directory — skip this pattern
            }
        }
        else {
            dirs.push(join(root, ...segments)); // exact member path
        }
    }
    return dirs;
}
/**
 * Bounded scan of member candidate dirs for frontend deps or config files.
 * Each seed gets `budget` directory levels below it; at most
 * WORKSPACE_SCAN_MAX_MEMBERS member package.jsons are inspected. Skips
 * node_modules and dot-directories (same convention as findNpmRoot).
 */
function hasFrontendInDirs(seeds, budget) {
    let checked = 0;
    const visit = (dir, remaining) => {
        if (remaining < 0 || checked >= WORKSPACE_SCAN_MAX_MEMBERS)
            return false;
        const pkg = readPackageJson(join(dir, "package.json"));
        if (pkg)
            checked++;
        if ((pkg !== null && packageHasFrontendDeps(pkg)) || hasFrontendConfigFile(dir))
            return true;
        if (remaining === 0)
            return false;
        let entries;
        try {
            entries = readdirSync(dir, { withFileTypes: true });
        }
        catch {
            return false;
        }
        for (const entry of entries) {
            if (!entry.isDirectory() || entry.name.startsWith(".") || entry.name === "node_modules")
                continue;
            if (visit(join(dir, entry.name), remaining - 1))
                return true;
        }
        return false;
    };
    for (const seed of seeds) {
        if (visit(seed, budget))
            return true;
    }
    return false;
}
/**
 * Detect whether the project has frontend code — layered signals, specific
 * first, stop on first hit:
 *   1. framework config files at the project/npm root (strongest);
 *   2. framework dependencies in the package.json located by findNpmRoot
 *      (same source as detectAppServer, so monorepo conclusions match);
 *   3. dev-script command keywords;
 *   4. monorepo workspace members (bounded scan) — frontend code commonly
 *      lives in member packages (e.g. pnpm apps/*) whose root package.json
 *      carries no frontend deps at all.
 * Returns null when no readable package.json is found at the located root —
 * callers skip the hint in that case (detection skipped, not "no frontend").
 * Deliberately biased toward "frontend": a false positive costs one extra
 * MCP install (--no-mcp skips it); a false negative silently skips the MCP.
 */
export function hasFrontendSignal(projectRoot) {
    const npmRoot = findNpmRoot(projectRoot);
    const pkg = readPackageJson(join(npmRoot, "package.json"));
    if (!pkg)
        return null;
    if (hasFrontendConfigFile(projectRoot) || (npmRoot !== projectRoot && hasFrontendConfigFile(npmRoot)))
        return true;
    if (packageHasFrontendDeps(pkg))
        return true;
    const dev = pkg.scripts?.dev ?? "";
    if (FRONTEND_DEV_COMMAND_KEYWORDS.some((kw) => dev.includes(kw)))
        return true;
    const patterns = workspaceGlobPatterns(projectRoot, pkg);
    if (patterns === null)
        return false;
    const memberDirs = resolveMemberDirs(projectRoot, patterns);
    if (memberDirs !== null && memberDirs.length > 0) {
        return hasFrontendInDirs(memberDirs, WORKSPACE_SCAN_MAX_DEPTH - 1);
    }
    return hasFrontendInDirs([projectRoot], WORKSPACE_SCAN_MAX_DEPTH);
}
export function detectAppServer(projectRoot, env = process.env) {
    const npmRoot = findNpmRoot(projectRoot);
    const packageJsonPath = join(npmRoot, "package.json");
    const pkg = readPackageJson(packageJsonPath) ?? {};
    const scripts = pkg.scripts ?? {};
    const scriptName = chooseDevScript(scripts);
    const scriptCommand = scriptName ? scripts[scriptName] : undefined;
    const devCommand = scriptName
        ? npmRoot === projectRoot
            ? `npm run ${scriptName}`
            : `cd "${npmRoot}" && npm run ${scriptName}`
        : undefined;
    if (env.BASE_URL) {
        return {
            projectRoot,
            npmRoot,
            packageJsonPath,
            scripts,
            scriptName,
            scriptCommand,
            devCommand,
            baseUrl: env.BASE_URL,
            baseUrlSource: "BASE_URL env",
        };
    }
    const portDetection = detectPortFromEnv(env) ??
        (scriptCommand ? (() => {
            const port = parsePort(scriptCommand);
            return port ? { port, source: `package.json scripts.${scriptName}` } : undefined;
        })() : undefined) ??
        detectVitePort(npmRoot) ??
        detectPortFromEnvFiles(npmRoot) ??
        frameworkDefaultPort(pkg, scriptCommand);
    if (portDetection) {
        return {
            projectRoot,
            npmRoot,
            packageJsonPath,
            scripts,
            scriptName,
            scriptCommand,
            devCommand,
            baseUrl: `http://localhost:${portDetection.port}`,
            baseUrlSource: portDetection.source,
            port: portDetection.port,
            portSource: portDetection.source,
        };
    }
    const seed = detectSeedBaseUrl(projectRoot);
    return {
        projectRoot,
        npmRoot,
        packageJsonPath,
        scripts,
        scriptName,
        scriptCommand,
        devCommand,
        baseUrl: seed?.baseUrl ?? "http://localhost:3000",
        baseUrlSource: seed?.source ?? "default",
    };
}
//# sourceMappingURL=app-detect.js.map