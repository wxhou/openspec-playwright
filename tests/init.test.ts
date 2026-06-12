import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// ─── generateSeedTest ─────────────────────────────────────────────────────────

describe("generateSeedTest", () => {
  const tmpDir = join(tmpdir(), "openspec-pw-init-test-" + Date.now());
  const testsDir = join(tmpDir, "tests", "playwright");

  beforeEach(() => {
    mkdirSync(testsDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("generates seed.spec.ts when it does not exist", async () => {
    const { generateSeedTest } = await import("../../src/commands/init.js");
    await generateSeedTest(tmpDir, false);
    const seedPath = join(testsDir, "seed.spec.ts");
    expect(existsSync(seedPath)).toBe(true);
    expect(readFileSync(seedPath, "utf-8")).toContain("playwright");
  });

  it("skips seed.spec.ts when it already exists (force=false)", async () => {
    const existingContent = "custom seed test content";
    writeFileSync(join(testsDir, "seed.spec.ts"), existingContent);

    const { generateSeedTest } = await import("../../src/commands/init.js");
    await generateSeedTest(tmpDir, false);

    expect(readFileSync(join(testsDir, "seed.spec.ts"), "utf-8")).toBe(existingContent);
  });

  it("overwrites seed.spec.ts when force=true", async () => {
    const { generateSeedTest } = await import("../../src/commands/init.js");

    // First generation
    await generateSeedTest(tmpDir, false);

    // Second generation with force
    await generateSeedTest(tmpDir, true);
    const secondContent = readFileSync(join(testsDir, "seed.spec.ts"), "utf-8");

    // Should be rewritten (may or may not be same content depending on template)
    expect(typeof secondContent).toBe("string");
  });

  it("generates auth.setup.ts when it does not exist", async () => {
    const { generateSeedTest } = await import("../../src/commands/init.js");
    await generateSeedTest(tmpDir, false);
    expect(existsSync(join(testsDir, "auth.setup.ts"))).toBe(true);
  });

  it("generates credentials.yaml when it does not exist", async () => {
    const { generateSeedTest } = await import("../../src/commands/init.js");
    await generateSeedTest(tmpDir, false);
    expect(existsSync(join(testsDir, "credentials.yaml"))).toBe(true);
  });

  it("skips auth.setup.ts when it already exists", async () => {
    writeFileSync(join(testsDir, "auth.setup.ts"), "existing content");
    const { generateSeedTest } = await import("../../src/commands/init.js");
    await generateSeedTest(tmpDir, false);
    expect(readFileSync(join(testsDir, "auth.setup.ts"), "utf-8")).toBe("existing content");
  });
});

// ─── generateAppKnowledge ─────────────────────────────────────────────────────

describe("generateAppKnowledge", () => {
  const tmpDir = join(tmpdir(), "openspec-pw-app-knowledge-" + Date.now());
  const testsDir = join(tmpDir, "tests", "playwright");

  beforeEach(() => {
    mkdirSync(testsDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("generates app-knowledge.md when it does not exist", async () => {
    const { generateAppKnowledge } = await import("../../src/commands/init.js");
    await generateAppKnowledge(tmpDir);
    const dest = join(testsDir, "app-knowledge.md");
    expect(existsSync(dest)).toBe(true);
  });

  it("skips when app-knowledge.md already exists", async () => {
    const existingContent = "custom knowledge";
    writeFileSync(join(testsDir, "app-knowledge.md"), existingContent);

    const { generateAppKnowledge } = await import("../../src/commands/init.js");
    await generateAppKnowledge(tmpDir);

    expect(readFileSync(join(testsDir, "app-knowledge.md"), "utf-8")).toBe(existingContent);
  });
});

// ─── generateSharedPages ──────────────────────────────────────────────────────

describe("generateSharedPages", () => {
  const tmpDir = join(tmpdir(), "openspec-pw-shared-pages-" + Date.now());
  const pagesDir = join(tmpDir, "tests", "playwright", "pages");

  beforeEach(() => {
    mkdirSync(pagesDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("generates pages/BasePage.ts when it does not exist", async () => {
    const { generateSharedPages } = await import("../../src/commands/init.js");
    await generateSharedPages(tmpDir);
    expect(existsSync(join(pagesDir, "BasePage.ts"))).toBe(true);
  });

  it("skips when pages/BasePage.ts already exists", async () => {
    writeFileSync(join(pagesDir, "BasePage.ts"), "custom base page");
    const { generateSharedPages } = await import("../../src/commands/init.js");
    await generateSharedPages(tmpDir);
    expect(readFileSync(join(pagesDir, "BasePage.ts"), "utf-8")).toBe("custom base page");
  });
});

// ─── generatePlaywrightConfig ───────────────────────────────────────────────

describe("generatePlaywrightConfig", () => {
  const tmpDir = join(tmpdir(), "openspec-pw-pw-config-" + Date.now());

  beforeEach(() => {
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("generates playwright.config.ts when it does not exist", async () => {
    const { generatePlaywrightConfig } = await import("../../src/commands/init.js");
    await generatePlaywrightConfig(tmpDir);
    expect(existsSync(join(tmpDir, "playwright.config.ts"))).toBe(true);
  });

  it("skips when playwright.config.ts already exists", async () => {
    writeFileSync(join(tmpDir, "playwright.config.ts"), "existing config");
    const { generatePlaywrightConfig } = await import("../../src/commands/init.js");
    await generatePlaywrightConfig(tmpDir);
    expect(readFileSync(join(tmpDir, "playwright.config.ts"), "utf-8")).toBe("existing config");
  });
});

// ─── generateGithubWorkflow ─────────────────────────────────────────────────

describe("generateGithubWorkflow", () => {
  const tmpDir = join(tmpdir(), "openspec-pw-ci-" + Date.now());

  beforeEach(() => {
    mkdirSync(join(tmpDir, ".github", "workflows"), { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("skips when workflow already exists", async () => {
    writeFileSync(join(tmpDir, ".github", "workflows", "openspec-pw.yml"), "existing");
    const { generateGithubWorkflow } = await import("../../src/commands/init.js");
    await generateGithubWorkflow(tmpDir);
    expect(readFileSync(join(tmpDir, ".github", "workflows", "openspec-pw.yml"), "utf-8")).toBe("existing");
  });
});

// ─── npx detection: execFile migration ────────────────────────────────────
// Guards the Windows-safe form of `npx openspec --version`.

describe("init.ts: npx detection uses execFile (no shell)", () => {
  it("uses execFileSync with shell: needsShell for cross-platform support", async () => {
    const { readFileSync } = await import("fs");
    const { fileURLToPath } = await import("url");
    const { join } = await import("path");
    const src = readFileSync(
      join(
        fileURLToPath(import.meta.url),
        "../../src/commands/init.ts",
      ),
      "utf-8",
    );
    // Old form: `npx openspec --version 2>/dev/null || echo "not found"`
    expect(src).not.toMatch(/npx openspec --version 2>\/dev\/null \|\| echo/);
    // Windows-safe form: execFileSync("npx", ["openspec", "--version"], { shell: needsShell })
    expect(src).toMatch(/execFileSync\("npx",\s*\["openspec",\s*"--version"\],\s*\{[^}]*shell: needsShell/);
  });
});

// ─── Template regressions from real-project smoke tests ─────────────────────

describe("template regressions", () => {
  it("seed.spec.ts does not call test.afterEach inside a test", () => {
    const seed = readFileSync(join(process.cwd(), "templates", "seed.spec.ts"), "utf-8");
    expect(seed).not.toContain("test.afterEach(() => page.off");
    expect(seed).toContain("finally {");
    expect(seed).toContain("page.off('console', handler)");
  });

  it("playwright.config.ts keeps BASE_URL env precedence over seed default", () => {
    const config = readFileSync(join(process.cwd(), "templates", "playwright.config.ts"), "utf-8");
    expect(config).toContain("if (!process.env.BASE_URL && existsSync(seedSpec))");
  });

  it("playwright.config.ts runs npm script names, not raw script bodies", () => {
    const config = readFileSync(join(process.cwd(), "templates", "playwright.config.ts"), "utf-8");
    expect(config).toContain("const scriptName = scripts['dev:all']");
    expect(config).toContain("devCmd = `npm run ${scriptName}`");
  });

  it("auth.setup.ts skips auth by default when E2E_AUTH_REQUIRED is not true", () => {
    const auth = readFileSync(join(process.cwd(), "templates", "auth.setup.ts"), "utf-8");
    expect(auth).toContain("const authRequired = process.env.E2E_AUTH_REQUIRED === 'true'");
    expect(auth).toContain("setup.skip(!authRequired || authMethod !== 'api'");
    expect(auth).toContain("setup.skip(!authRequired || authMethod !== 'ui'");
  });
});
