import { existsSync, readFileSync, readdirSync } from "fs";
import { join, relative, sep } from "path";
import { parse as parseJsonc, type ParseError } from "jsonc-parser";
import { findNpmRoot, type PackageJson } from "./app-detect.js";

export interface WxaProjectResolution {
  /** Project directory relative to the repo root, POSIX separators. */
  projectPath: string;
  kind: "native" | "uni-app" | "taro" | "unknown";
  exists: boolean;
  source: string;
}

export interface PageManifest {
  homePage: string | null;
  pages: string[];
  source: string | null;
  reason?: string;
}

function readJson(path: string): Record<string, unknown> | null {
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function readJsonc(path: string): Record<string, unknown> | null {
  try {
    const errors: ParseError[] = [];
    const parsed = parseJsonc(readFileSync(path, "utf-8"), errors) as Record<string, unknown> | undefined;
    return errors.length === 0 && parsed ? parsed : null;
  } catch {
    return null;
  }
}

function toPosix(root: string, dir: string): string {
  const rel = relative(root, dir).split(sep).join("/");
  return rel === "" ? "." : rel;
}

function firstExisting(root: string, rels: string[]): string | null {
  return rels.find((rel) => existsSync(join(root, rel))) ?? null;
}

/** Absolute path of the first hit under any search root (repo root, npm root). */
function firstExistingIn(roots: string[], rels: string[]): string | null {
  for (const root of roots) {
    const rel = firstExisting(root, rels);
    if (rel) return join(root, rel);
  }
  return null;
}

function searchRoots(projectRoot: string, npmRoot: string): string[] {
  return npmRoot === projectRoot ? [projectRoot] : [projectRoot, npmRoot];
}

function readPackage(projectRoot: string): { npmRoot: string; pkg: PackageJson | null } {
  const npmRoot = findNpmRoot(projectRoot);
  return { npmRoot, pkg: readJson(join(npmRoot, "package.json")) as PackageJson | null };
}

function hasDep(pkg: PackageJson | null, prefix: string): boolean {
  if (!pkg) return false;
  return [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})].some(
    (name) => name.startsWith(prefix),
  );
}

function findDirWithAppJson(root: string, depth: number): string | null {
  if (depth < 0) return null;
  if (existsSync(join(root, "app.json"))) return root;
  let entries;
  try {
    entries = readdirSync(root, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const hit = findDirWithAppJson(join(root, entry.name), depth - 1);
    if (hit) return hit;
  }
  return null;
}

/**
 * Resolve the directory wxa-runner must run. Native projects point at the
 * directory holding project.config.json; uni-app and Taro point at their
 * compiled mp-weixin output. Missing output is reported, never invented as
 * "present" — callers warn and doctor fails.
 */
export function resolveWxaProject(projectRoot: string): WxaProjectResolution {
  const { npmRoot, pkg } = readPackage(projectRoot);
  const roots = searchRoots(projectRoot, npmRoot);
  for (const dir of roots) {
    if (existsSync(join(dir, "project.config.json"))) {
      return { projectPath: toPosix(projectRoot, dir), kind: "native", exists: true, source: "project.config.json" };
    }
  }

  const uniOutput = firstExistingIn(roots, [
    "dist/dev/mp-weixin",
    "dist/build/mp-weixin",
    "dist/mp-weixin",
    "mp-weixin",
  ]);
  if (uniOutput) {
    return {
      projectPath: toPosix(projectRoot, uniOutput),
      kind: "uni-app",
      exists: true,
      source: `output: ${toPosix(projectRoot, uniOutput)}`,
    };
  }

  if (hasDep(pkg, "@tarojs/")) {
    const configFile = firstExistingIn(roots, ["config/index.ts", "config/index.js"]);
    let outputRoot = "dist";
    if (configFile) {
      try {
        const match = readFileSync(configFile, "utf-8").match(
          /outputRoot\s*:\s*['"]([^'"]+)['"]/,
        );
        if (match) outputRoot = match[1];
      } catch {
        // unreadable config → keep the documented Taro 3 default
      }
    }
    // outputRoot is relative to the Taro project root (the package root).
    const outputDir = join(npmRoot, outputRoot);
    const withAppJson = findDirWithAppJson(outputDir, 2);
    return {
      projectPath: toPosix(projectRoot, withAppJson ?? outputDir),
      kind: "taro",
      exists: withAppJson !== null,
      source: `outputRoot: ${outputRoot}`,
    };
  }

  if (hasDep(pkg, "@dcloudio/")) {
    const defaultOutput = join(npmRoot, "dist", "dev", "mp-weixin");
    return {
      projectPath: toPosix(projectRoot, defaultOutput),
      kind: "uni-app",
      exists: false,
      source: "uni-app default output",
    };
  }

  return { projectPath: ".", kind: "unknown", exists: true, source: "project root" };
}

function normalizePageList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (typeof entry === "string") return entry;
      if (entry && typeof entry === "object" && typeof (entry as { path?: unknown }).path === "string") {
        return (entry as { path: string }).path;
      }
      return null;
    })
    .filter((entry): entry is string => entry !== null);
}

function collectSubPackagePages(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const pages: string[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const root = (entry as { root?: unknown }).root;
    const subPages = normalizePageList((entry as { pages?: unknown }).pages);
    if (typeof root !== "string") continue;
    pages.push(...subPages.map((page) => `${root.replace(/\/+$/, "")}/${page.replace(/^\/+/, "")}`));
  }
  return pages;
}

function manifestFromJson(
  data: Record<string, unknown>,
  source: string,
  entryAware: boolean,
): PageManifest {
  const pages = normalizePageList(data.pages);
  const subPages = collectSubPackagePages(data.subPackages ?? data.subpackages);
  const entry = entryAware && typeof data.entryPagePath === "string" ? data.entryPagePath : null;
  return {
    homePage: entry ?? pages[0] ?? subPages[0] ?? null,
    pages: [...pages, ...subPages],
    source,
  };
}

function readTaroStaticPages(projectRoot: string, roots: string[]): PageManifest | null {
  const file = firstExistingIn(roots, [
    "src/app.config.ts",
    "src/app.config.js",
    "app.config.ts",
    "app.config.js",
  ]);
  if (!file) return null;
  try {
    const content = readFileSync(file, "utf-8");
    const match = content.match(/pages\s*:\s*\[([\s\S]*?)\]/);
    if (!match) return null;
    const pages = [...match[1].matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]);
    if (pages.length === 0) return null;
    return { homePage: pages[0], pages, source: toPosix(projectRoot, file) };
  } catch {
    return null;
  }
}

/**
 * Read the page manifest used for the seed and for all-mode exploration.
 * Native uses app.json (entryPagePath wins); uni-app uses pages.json; Taro
 * prefers its compiled app.json and falls back to the static app.config.
 */
export function resolvePageManifest(projectRoot: string): PageManifest {
  const wxa = resolveWxaProject(projectRoot);
  const projectDir = join(projectRoot, wxa.projectPath);
  const { npmRoot } = readPackage(projectRoot);
  const roots = searchRoots(projectRoot, npmRoot);

  const appJsonPath = join(projectDir, "app.json");
  if (existsSync(appJsonPath)) {
    const data = readJson(appJsonPath);
    if (data) return manifestFromJson(data, toPosix(projectRoot, appJsonPath), wxa.kind === "native");
  }

  const pagesJson = firstExistingIn(roots, ["src/pages.json", "pages.json"]);
  if (pagesJson) {
    const data = readJsonc(pagesJson);
    if (data) return manifestFromJson(data, toPosix(projectRoot, pagesJson), false);
  }

  const taro = readTaroStaticPages(projectRoot, roots);
  if (taro) return taro;

  return {
    homePage: null,
    pages: [],
    source: null,
    reason: `no readable page manifest (looked for ${toPosix(projectRoot, appJsonPath)}, src/pages.json, pages.json, src/app.config.ts)`,
  };
}

/** Build script for the mini-program target, chosen from real package scripts. */
export function resolveBuildScript(projectRoot: string): string | null {
  const { pkg } = readPackage(projectRoot);
  const scripts = pkg?.scripts ?? {};
  const names = Object.keys(scripts);
  const preferred = hasDep(pkg, "@dcloudio/")
    ? ["build:mp-weixin", "build:mp"]
    : hasDep(pkg, "@tarojs/")
      ? ["build:weapp", "build:mp-weixin"]
      : ["build:mp-weixin", "build:weapp"];
  for (const name of preferred) {
    if (scripts[name]) return name;
  }
  return names.find((name) => name.includes("build") && /(mp-weixin|weapp)/.test(name)) ?? null;
}
