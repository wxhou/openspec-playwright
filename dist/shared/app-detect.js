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