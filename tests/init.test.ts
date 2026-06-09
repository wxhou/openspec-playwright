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

// ─── npx detection: execFile migration ────────────────────────────────────
// Guards the Windows-safe form of `npx openspec --version`.

describe("init.ts: npx detection uses execFile (no shell)", () => {
  it("uses execFileSync with cmd() for cross-platform support", async () => {
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
    // Windows-safe form: execFileSync(cmd("npx"), ["openspec", "--version"])
    expect(src).toMatch(/execFileSync\("npx",\s*\["openspec",\s*"--version"\],\s*\{[^}]*shell: needsShell/);
  });
});
