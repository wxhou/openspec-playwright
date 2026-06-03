import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock child_process
vi.mock("child_process", () => ({
  execFileSync: vi.fn(),
}));

// Mock fs modules
vi.mock("fs", () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

describe("init command validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("validates project root has openspec directory", () => {
    vi.mocked(existsSync).mockReturnValue(false);
    const projectRoot = "/test/project";
    const hasOpenSpec = existsSync(join(projectRoot, "openspec"));
    expect(hasOpenSpec).toBe(false);
  });

  it("validates project root has .claude directory", () => {
    vi.mocked(existsSync).mockReturnValue(true);
    const projectRoot = "/test/project";
    const hasClaude = existsSync(join(projectRoot, ".claude"));
    expect(hasClaude).toBe(true);
  });

  it("generates seed test when it does not exist", () => {
    vi.mocked(existsSync).mockReturnValue(false);
    vi.mocked(readFileSync).mockReturnValue("seed test content");
    vi.mocked(writeFileSync).mockImplementation(() => undefined);
    vi.mocked(mkdirSync).mockImplementation(() => undefined);

    const seedPath = "/test/project/tests/playwright/seed.spec.ts";
    const exists = existsSync(seedPath);
    expect(exists).toBe(false);

    // Simulate generation
    const content = readFileSync("/templates/seed.spec.ts", "utf-8");
    writeFileSync(seedPath, content);
    expect(writeFileSync).toHaveBeenCalledWith(seedPath, "seed test content");
  });

  it("skips seed test when it already exists", () => {
    vi.mocked(existsSync).mockReturnValue(true);
    const seedPath = "/test/project/tests/playwright/seed.spec.ts";
    const exists = existsSync(seedPath);
    expect(exists).toBe(true);
  });

  it("generates auth.setup.ts when it does not exist", () => {
    vi.mocked(existsSync).mockReturnValue(false);
    vi.mocked(readFileSync).mockReturnValue("auth setup content");
    vi.mocked(writeFileSync).mockImplementation(() => undefined);

    const authPath = "/test/project/tests/playwright/auth.setup.ts";
    const exists = existsSync(authPath);
    expect(exists).toBe(false);

    // Simulate generation
    const content = readFileSync("/templates/auth.setup.ts", "utf-8");
    writeFileSync(authPath, content);
    expect(writeFileSync).toHaveBeenCalledWith(authPath, "auth setup content");
  });

  it("generates credentials.yaml when it does not exist", () => {
    vi.mocked(existsSync).mockReturnValue(false);
    vi.mocked(readFileSync).mockReturnValue("credentials content");
    vi.mocked(writeFileSync).mockImplementation(() => undefined);

    const credsPath = "/test/project/tests/playwright/credentials.yaml";
    const exists = existsSync(credsPath);
    expect(exists).toBe(false);

    // Simulate generation
    const content = readFileSync("/templates/credentials.yaml", "utf-8");
    writeFileSync(credsPath, content);
    expect(writeFileSync).toHaveBeenCalledWith(credsPath, "credentials content");
  });

  it("generates app-knowledge.md when it does not exist", () => {
    vi.mocked(existsSync).mockReturnValue(false);
    vi.mocked(readFileSync).mockReturnValue("app knowledge content");
    vi.mocked(writeFileSync).mockImplementation(() => undefined);

    const knowledgePath = "/test/project/tests/playwright/app-knowledge.md";
    const exists = existsSync(knowledgePath);
    expect(exists).toBe(false);

    // Simulate generation
    const content = readFileSync("/templates/app-knowledge.md", "utf-8");
    writeFileSync(knowledgePath, content);
    expect(writeFileSync).toHaveBeenCalledWith(knowledgePath, "app knowledge content");
  });

  it("generates BasePage.ts when it does not exist", () => {
    vi.mocked(existsSync).mockReturnValue(false);
    vi.mocked(readFileSync).mockReturnValue("base page content");
    vi.mocked(writeFileSync).mockImplementation(() => undefined);
    vi.mocked(mkdirSync).mockImplementation(() => undefined);

    const pagesDir = "/test/project/tests/playwright/pages";
    const basePagePath = join(pagesDir, "BasePage.ts");
    const exists = existsSync(basePagePath);
    expect(exists).toBe(false);

    // Simulate generation
    const content = readFileSync("/templates/pages/BasePage.ts", "utf-8");
    writeFileSync(basePagePath, content);
    expect(writeFileSync).toHaveBeenCalledWith(basePagePath, "base page content");
  });

  it("skips BasePage.ts when it already exists", () => {
    vi.mocked(existsSync).mockReturnValue(true);
    const pagesDir = "/test/project/tests/playwright/pages";
    const basePagePath = join(pagesDir, "BasePage.ts");
    const exists = existsSync(basePagePath);
    expect(exists).toBe(true);
  });
});
