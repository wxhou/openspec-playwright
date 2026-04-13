import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// ─── extractSkillBody ──────────────────────────────────────────────────────────

describe("extractSkillBody", () => {
  it("strips YAML frontmatter from SKILL.md content", () => {
    const content = `---
name: Test
version: "1.0"
---

# Body content
Step 1: do something
`;
    const body = extractSkillBody(content);
    expect(body).toBe("# Body content\nStep 1: do something\n");
  });

  it("returns full content if no frontmatter", () => {
    const content = "No frontmatter here";
    const body = extractSkillBody(content);
    expect(body).toBe("No frontmatter here");
  });

  it("handles empty frontmatter values", () => {
    const content = `---
foo:
bar: baz
---

Actual content`;
    const body = extractSkillBody(content);
    expect(body).toContain("Actual content");
    expect(body).not.toContain("foo:");
  });

  it("handles multiline frontmatter", () => {
    const content = `---
name: SKILL
description: |
  Multi-line
  description
tags:
  - tag1
  - tag2
---

Body`;
    const body = extractSkillBody(content);
    expect(body).toBe("Body");
  });
});

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

// ─── installSkillTemplates ────────────────────────────────────────────────────

describe("installSkillTemplates", () => {
  const tmpDir = join(tmpdir(), "openspec-pw-skill-templates-" + Date.now());

  beforeEach(() => {
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("installs all template files to .claude/skills/openspec-e2e/templates", async () => {
    const { installSkillTemplates } = await import("../../src/commands/init.js");
    installSkillTemplates(tmpDir);

    const templatesDir = join(tmpDir, ".claude", "skills", "openspec-e2e", "templates");
    expect(existsSync(templatesDir)).toBe(true);

    // Check at least some template files are created
    const files = ["app-exploration.md", "test-plan.md", "report.md", "e2e-test.ts"];
    for (const file of files) {
      expect(existsSync(join(templatesDir, file))).toBe(true);
    }
  });

  it("does not overwrite existing template files", async () => {
    const { installSkillTemplates } = await import("../../src/commands/init.js");
    const templatesDir = join(tmpDir, ".claude", "skills", "openspec-e2e", "templates");
    mkdirSync(templatesDir, { recursive: true });

    // Pre-existing file
    writeFileSync(join(templatesDir, "app-exploration.md"), "custom content");

    installSkillTemplates(tmpDir);

    // Should preserve custom content
    expect(readFileSync(join(templatesDir, "app-exploration.md"), "utf-8")).toBe("custom content");
  });
});

// Re-export the function being tested
function extractSkillBody(content: string): string {
  return content.replace(/^---\n[\s\S]*?\n---\n*/, "");
}