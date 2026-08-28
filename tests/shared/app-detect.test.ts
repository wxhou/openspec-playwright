import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { chooseDevScript, detectAppServer, parsePort, hasFrontendSignal } from "../../src/shared/app-detect.js";

describe("app-detect", () => {
  const tmpDir = join(tmpdir(), "openspec-pw-app-detect-" + Date.now());

  beforeEach(() => {
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("prefers dev:all over dev", () => {
    expect(chooseDevScript({ dev: "vite", "dev:all": "concurrently a b" })).toBe("dev:all");
  });

  it("parses common port forms", () => {
    expect(parsePort("vite --port 5125")).toBe(5125);
    expect(parsePort("vite --port=5174")).toBe(5174);
    expect(parsePort("PORT=3001 next dev")).toBe(3001);
    expect(parsePort("server: { port: 4321 }")).toBe(4321);
  });

  it("uses BASE_URL env before detected ports", () => {
    writeFileSync(join(tmpDir, "package.json"), JSON.stringify({ scripts: { dev: "vite --port 5125" } }));
    const detected = detectAppServer(tmpDir, { BASE_URL: "http://localhost:9999" });
    expect(detected.baseUrl).toBe("http://localhost:9999");
    expect(detected.baseUrlSource).toBe("BASE_URL env");
  });

  it("detects port from package script", () => {
    writeFileSync(join(tmpDir, "package.json"), JSON.stringify({ scripts: { dev: "vite --port 5125" } }));
    const detected = detectAppServer(tmpDir, {});
    expect(detected.scriptName).toBe("dev");
    expect(detected.devCommand).toBe("npm run dev");
    expect(detected.baseUrl).toBe("http://localhost:5125");
    expect(detected.baseUrlSource).toBe("package.json scripts.dev");
  });

  it("detects vite config port", () => {
    writeFileSync(join(tmpDir, "package.json"), JSON.stringify({ scripts: { dev: "vite" } }));
    writeFileSync(join(tmpDir, "vite.config.ts"), "export default { server: { port: 5125 } }");
    const detected = detectAppServer(tmpDir, {});
    expect(detected.baseUrl).toBe("http://localhost:5125");
    expect(detected.baseUrlSource).toBe("vite.config.ts");
  });

  it("falls back to Vite default port", () => {
    writeFileSync(join(tmpDir, "package.json"), JSON.stringify({ scripts: { dev: "vite" }, devDependencies: { vite: "^8.0.0" } }));
    const detected = detectAppServer(tmpDir, {});
    expect(detected.baseUrl).toBe("http://localhost:5173");
    expect(detected.baseUrlSource).toBe("vite default");
  });

  it("finds npm root in a nested app", () => {
    const appDir = join(tmpDir, "apps", "web");
    mkdirSync(appDir, { recursive: true });
    writeFileSync(join(tmpDir, "package.json"), JSON.stringify({ private: true }));
    writeFileSync(join(appDir, "package.json"), JSON.stringify({ scripts: { dev: "vite --port 5126" } }));
    const detected = detectAppServer(tmpDir, {});
    expect(detected.npmRoot).toBe(appDir);
    expect(detected.devCommand).toBe(`cd "${appDir}" && npm run dev`);
    expect(detected.baseUrl).toBe("http://localhost:5126");
  });

  it("ignores seed '/' default and falls back to localhost:3000", () => {
    const seedDir = join(tmpDir, "tests", "playwright");
    mkdirSync(seedDir, { recursive: true });
    writeFileSync(
      join(seedDir, "seed.spec.ts"),
      "const BASE_URL = process.env.BASE_URL || '/';\n",
    );
    writeFileSync(join(tmpDir, "package.json"), JSON.stringify({ scripts: {} }));
    const detected = detectAppServer(tmpDir, {});
    expect(detected.baseUrl).toBe("http://localhost:3000");
    expect(detected.baseUrlSource).toBe("default");
  });

  it("falls back to localhost:3000 with no package.json at all", () => {
    // No package.json anywhere — findNpmRoot falls back to projectRoot, pkg
    // is null, so the webServer fallback (localhost:3000) still applies.
    const detected = detectAppServer(tmpDir, {});
    expect(detected.baseUrl).toBe("http://localhost:3000");
    expect(detected.baseUrlSource).toBe("default");
  });

  it("uses seed http:// url when present", () => {
    const seedDir = join(tmpDir, "tests", "playwright");
    mkdirSync(seedDir, { recursive: true });
    writeFileSync(
      join(seedDir, "seed.spec.ts"),
      "const BASE_URL = process.env.BASE_URL || 'http://localhost:4000';\n",
    );
    writeFileSync(join(tmpDir, "package.json"), JSON.stringify({ scripts: {} }));
    const detected = detectAppServer(tmpDir, {});
    expect(detected.baseUrl).toBe("http://localhost:4000");
    expect(detected.baseUrlSource).toBe("seed.spec.ts");
  });

  // ─── hasFrontendSignal ─────────────────────────────────────────────────

  it("hasFrontendSignal: exact dep match on react returns true", () => {
    writeFileSync(join(tmpDir, "package.json"), JSON.stringify({ dependencies: { react: "^19.0.0" } }));
    expect(hasFrontendSignal(tmpDir)).toBe(true);
  });

  it("hasFrontendSignal: exact devDep match on vite returns true", () => {
    writeFileSync(join(tmpDir, "package.json"), JSON.stringify({ devDependencies: { vite: "^8.0.0" } }));
    expect(hasFrontendSignal(tmpDir)).toBe(true);
  });

  it("hasFrontendSignal: scripts.dev 'next dev' returns true", () => {
    writeFileSync(join(tmpDir, "package.json"), JSON.stringify({ scripts: { dev: "next dev" } }));
    expect(hasFrontendSignal(tmpDir)).toBe(true);
  });

  it("hasFrontendSignal: pure backend deps return false", () => {
    writeFileSync(
      join(tmpDir, "package.json"),
      JSON.stringify({ dependencies: { express: "^4.0.0" }, scripts: { dev: "node server.js" } }),
    );
    expect(hasFrontendSignal(tmpDir)).toBe(false);
  });

  it("hasFrontendSignal: empty package.json returns false", () => {
    writeFileSync(join(tmpDir, "package.json"), JSON.stringify({}));
    expect(hasFrontendSignal(tmpDir)).toBe(false);
  });

  it("hasFrontendSignal: no package.json returns null (detection skipped)", () => {
    expect(hasFrontendSignal(tmpDir)).toBe(null);
  });

  it("hasFrontendSignal: vitest does not false-hit vite", () => {
    writeFileSync(
      join(tmpDir, "package.json"),
      JSON.stringify({ devDependencies: { vitest: "^4.0.0", "@vitest/ui": "^4.0.0" }, scripts: { dev: "node server.js" } }),
    );
    expect(hasFrontendSignal(tmpDir)).toBe(false);
  });

  it("hasFrontendSignal: finds a frontend in a nested app (monorepo)", () => {
    const appDir = join(tmpDir, "apps", "web");
    mkdirSync(appDir, { recursive: true });
    writeFileSync(join(tmpDir, "package.json"), JSON.stringify({ private: true, workspaces: ["apps/*"] }));
    writeFileSync(join(appDir, "package.json"), JSON.stringify({ dependencies: { react: "^19.0.0" }, scripts: { dev: "vite" } }));
    expect(hasFrontendSignal(tmpDir)).toBe(true);
  });

  // ─── hasFrontendSignal: layered signals + workspace awareness ─────────

  it("hasFrontendSignal: framework config file hits even with backend-only deps", () => {
    writeFileSync(join(tmpDir, "package.json"), JSON.stringify({ dependencies: { express: "^4.0.0" } }));
    writeFileSync(join(tmpDir, "vite.config.ts"), "export default {};");
    expect(hasFrontendSignal(tmpDir)).toBe(true);
  });

  it("hasFrontendSignal: angular.json counts as a framework config signal", () => {
    writeFileSync(join(tmpDir, "package.json"), JSON.stringify({}));
    writeFileSync(join(tmpDir, "angular.json"), "{}");
    expect(hasFrontendSignal(tmpDir)).toBe(true);
  });

  it("hasFrontendSignal: config file at the nested npm root counts when the project root has none", () => {
    writeFileSync(join(tmpDir, "package.json"), JSON.stringify({ scripts: { build: "tsc" } }));
    const appDir = join(tmpDir, "apps", "web");
    mkdirSync(appDir, { recursive: true });
    writeFileSync(join(appDir, "package.json"), JSON.stringify({ scripts: { dev: "node server.js" } }));
    writeFileSync(join(appDir, "next.config.mjs"), "export default {};");
    expect(hasFrontendSignal(tmpDir)).toBe(true);
  });

  it("hasFrontendSignal: pnpm workspace member deps hit when root has a runnable script", () => {
    // atlasai shape: root dev:all pins findNpmRoot at the repo root, whose
    // package.json carries no frontend deps — only members do.
    writeFileSync(join(tmpDir, "package.json"), JSON.stringify({ scripts: { "dev:all": "concurrently a b" } }));
    writeFileSync(join(tmpDir, "pnpm-workspace.yaml"), "packages:\n  - apps/*\n  - packages/*\n");
    const web = join(tmpDir, "apps", "web");
    mkdirSync(web, { recursive: true });
    writeFileSync(join(web, "package.json"), JSON.stringify({ dependencies: { react: "^19.0.0" } }));
    expect(hasFrontendSignal(tmpDir)).toBe(true);
  });

  it("hasFrontendSignal: npm workspaces {packages: []} object form resolves members", () => {
    writeFileSync(
      join(tmpDir, "package.json"),
      JSON.stringify({ scripts: { dev: "node server.js" }, workspaces: { packages: ["packages/*"] } }),
    );
    const ui = join(tmpDir, "packages", "ui");
    mkdirSync(ui, { recursive: true });
    writeFileSync(join(ui, "package.json"), JSON.stringify({ dependencies: { vue: "^3.0.0" } }));
    expect(hasFrontendSignal(tmpDir)).toBe(true);
  });

  it("hasFrontendSignal: workspace member config file hits without member deps", () => {
    writeFileSync(join(tmpDir, "package.json"), JSON.stringify({ workspaces: ["packages/*"] }));
    const ui = join(tmpDir, "packages", "ui");
    mkdirSync(ui, { recursive: true });
    writeFileSync(join(ui, "package.json"), JSON.stringify({ devDependencies: { typescript: "^5.0.0" } }));
    writeFileSync(join(ui, "vite.config.ts"), "export default {};");
    expect(hasFrontendSignal(tmpDir)).toBe(true);
  });

  it("hasFrontendSignal: exact-path workspace pattern resolves the member directly", () => {
    writeFileSync(join(tmpDir, "package.json"), JSON.stringify({ workspaces: ["apps/web"] }));
    const web = join(tmpDir, "apps", "web");
    mkdirSync(web, { recursive: true });
    writeFileSync(join(web, "package.json"), JSON.stringify({ dependencies: { solid: "^1.0.0" } }));
    expect(hasFrontendSignal(tmpDir)).toBe(true);
  });

  it("hasFrontendSignal: marker-only workspace (turbo.json) falls back to bounded scan", () => {
    writeFileSync(join(tmpDir, "package.json"), JSON.stringify({ scripts: { dev: "node server.js" } }));
    writeFileSync(join(tmpDir, "turbo.json"), "{}");
    const web = join(tmpDir, "apps", "web");
    mkdirSync(web, { recursive: true });
    writeFileSync(join(web, "package.json"), JSON.stringify({ dependencies: { preact: "^10.0.0" } }));
    expect(hasFrontendSignal(tmpDir)).toBe(true);
  });

  it("hasFrontendSignal: leading-wildcard glob falls back to bounded scan", () => {
    writeFileSync(join(tmpDir, "package.json"), JSON.stringify({}));
    writeFileSync(join(tmpDir, "pnpm-workspace.yaml"), "packages:\n  - '**/apps'\n");
    const web = join(tmpDir, "libs", "apps", "web");
    mkdirSync(web, { recursive: true });
    writeFileSync(join(web, "package.json"), JSON.stringify({ dependencies: { svelte: "^5.0.0" } }));
    expect(hasFrontendSignal(tmpDir)).toBe(true);
  });

  it("hasFrontendSignal: all-backend workspace returns false", () => {
    writeFileSync(join(tmpDir, "package.json"), JSON.stringify({ scripts: { dev: "node server.js" } }));
    writeFileSync(join(tmpDir, "pnpm-workspace.yaml"), "packages:\n  - services/*\n");
    const api = join(tmpDir, "services", "api");
    mkdirSync(api, { recursive: true });
    writeFileSync(join(api, "package.json"), JSON.stringify({ dependencies: { express: "^4.0.0" } }));
    expect(hasFrontendSignal(tmpDir)).toBe(false);
  });

  it("hasFrontendSignal: node_modules inside a member is skipped", () => {
    writeFileSync(join(tmpDir, "package.json"), JSON.stringify({ workspaces: ["packages/*"] }));
    const nm = join(tmpDir, "packages", "api", "node_modules", "react");
    mkdirSync(nm, { recursive: true });
    writeFileSync(join(nm, "package.json"), JSON.stringify({ name: "react", dependencies: { react: "^19.0.0" } }));
    writeFileSync(join(tmpDir, "packages", "api", "package.json"), JSON.stringify({ dependencies: { express: "^4.0.0" } }));
    expect(hasFrontendSignal(tmpDir)).toBe(false);
  });

  it("hasFrontendSignal: members nested deeper than 3 levels are not reached (bounded)", () => {
    writeFileSync(join(tmpDir, "package.json"), JSON.stringify({}));
    writeFileSync(join(tmpDir, "pnpm-workspace.yaml"), "packages:\n  - apps/*\n");
    const deep = join(tmpDir, "apps", "a", "b", "c", "d");
    mkdirSync(deep, { recursive: true });
    writeFileSync(join(deep, "package.json"), JSON.stringify({ dependencies: { react: "^19.0.0" } }));
    expect(hasFrontendSignal(tmpDir)).toBe(false);
  });

  it("hasFrontendSignal: member scan stops at the 50-member cap", () => {
    writeFileSync(join(tmpDir, "package.json"), JSON.stringify({ workspaces: ["packages/*"] }));
    mkdirSync(join(tmpDir, "packages"), { recursive: true });
    for (let i = 1; i <= 55; i++) {
      const dir = join(tmpDir, "packages", `m${String(i).padStart(2, "0")}`);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "package.json"), JSON.stringify({ dependencies: { express: "^4.0.0" } }));
    }
    // Alphabetically last: the scan must hit the member cap before reaching it.
    const frontend = join(tmpDir, "packages", "zz");
    mkdirSync(frontend, { recursive: true });
    writeFileSync(join(frontend, "package.json"), JSON.stringify({ dependencies: { react: "^19.0.0" } }));
    expect(hasFrontendSignal(tmpDir)).toBe(false);
  });

  it("hasFrontendSignal: repeat calls on unchanged state return the same result", () => {
    writeFileSync(join(tmpDir, "package.json"), JSON.stringify({ scripts: { dev: "node server.js" } }));
    writeFileSync(join(tmpDir, "pnpm-workspace.yaml"), "packages:\n  - apps/*\n");
    const web = join(tmpDir, "apps", "web");
    mkdirSync(web, { recursive: true });
    writeFileSync(join(web, "package.json"), JSON.stringify({ dependencies: { express: "^4.0.0" } }));
    const first = hasFrontendSignal(tmpDir);
    expect(first).toBe(false);
    expect(hasFrontendSignal(tmpDir)).toBe(first);
  });
});
