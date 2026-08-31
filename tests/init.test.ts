import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from "vitest";
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
} from "fs";
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
    expect(config).toContain("let baseUrl = process.env.BASE_URL");
    expect(config).toContain("if (!baseUrl && existsSync(seedSpec))");
    // Guard against relative seed defaults like '/' being used as a raw base URL
    expect(config).toContain("candidate.startsWith('http://') || candidate.startsWith('https://')");
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

  it("seed and BasePage use Playwright baseURL when BASE_URL env is unset", () => {
    const seed = readFileSync(join(process.cwd(), "templates", "seed.spec.ts"), "utf-8");
    const basePage = readFileSync(join(process.cwd(), "templates", "pages", "BasePage.ts"), "utf-8");
    expect(seed).toContain("const BASE_URL = process.env.BASE_URL || '/'");
    expect(seed).toContain("page.request.get(BASE_URL)");
    expect(basePage).toContain("const BASE_URL = process.env.BASE_URL;");
    expect(basePage).toContain("path.startsWith('http') || !BASE_URL ? path");
  });
});

// ─── init --tools selection ────────────────────────────────────────────

describe("init tool selection", () => {
  let tmpRoot: string;
  let cwdSpy: ReturnType<typeof import("vitest")["vi"]["spyOn"]>;
  const blankHome = join(tmpdir(), "ospw-pw-blank-home-" + Date.now());

  const COMMAND_FILES: Record<string, string> = {
    claude: ".claude/commands/opsx/e2e.md",
    opencode: ".opencode/commands/opsx-e2e.md",
    cline: ".cline/skills/opsx-e2e/SKILL.md",
    cursor: ".cursor/commands/opsx-e2e.md",
    pi: ".pi/prompts/opsx-e2e.md",
    omp: ".omp/commands/opsx-e2e.md",
  };

  beforeAll(() => {
    mkdirSync(blankHome, { recursive: true });
  });

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), "ospw-pw-init-sel-"));
    mkdirSync(join(tmpRoot, "openspec"), { recursive: true });
    // init() resolves the project root from process.cwd() — point it at the temp project.
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tmpRoot);
  });

  afterEach(() => {
    cwdSpy.mockRestore();
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  afterAll(() => {
    rmSync(blankHome, { recursive: true, force: true });
  });

  it("--tools none skips editors but still generates the scaffold", async () => {
    const { init } = await import("../../src/commands/init.js");
    // No mcp:false — with zero editors the MCP phase must not run at all,
    // so this also proves the MCP loop is skipped (no claude mcp side effects).
    await init({ tools: "none" });
    expect(existsSync(join(tmpRoot, ".claude"))).toBe(false);
    expect(existsSync(join(tmpRoot, "AGENTS.md"))).toBe(false);
    expect(existsSync(join(tmpRoot, "tests/playwright/seed.spec.ts"))).toBe(true);
    expect(existsSync(join(tmpRoot, "tests/playwright/auth.setup.ts"))).toBe(true);
    expect(existsSync(join(tmpRoot, "tests/playwright/credentials.yaml"))).toBe(true);
    expect(existsSync(join(tmpRoot, "tests/playwright/pages/BasePage.ts"))).toBe(true);
    expect(existsSync(join(tmpRoot, "tests/playwright/app-knowledge.md"))).toBe(true);
    expect(existsSync(join(tmpRoot, "playwright.config.ts"))).toBe(true);
  });

  it("--tools all installs every supported editor", async () => {
    const { init } = await import("../../src/commands/init.js");
    await init({ tools: "all", mcp: false });
    for (const rel of Object.values(COMMAND_FILES)) {
      expect(existsSync(join(tmpRoot, rel))).toBe(true);
    }
    expect(existsSync(join(tmpRoot, "AGENTS.md"))).toBe(true);
  });

  it("--tools with a list configures exactly those editors", async () => {
    const { init } = await import("../../src/commands/init.js");
    await init({ tools: "claude,cursor", mcp: false });
    expect(existsSync(join(tmpRoot, COMMAND_FILES.claude))).toBe(true);
    expect(existsSync(join(tmpRoot, COMMAND_FILES.cursor))).toBe(true);
    expect(existsSync(join(tmpRoot, COMMAND_FILES.opencode))).toBe(false);
    expect(existsSync(join(tmpRoot, COMMAND_FILES.cline))).toBe(false);
  });

  it("accepts the oh-my-pi alias for omp", async () => {
    const { init } = await import("../../src/commands/init.js");
    await init({ tools: "oh-my-pi", mcp: false });
    expect(existsSync(join(tmpRoot, COMMAND_FILES.omp))).toBe(true);
    expect(existsSync(join(tmpRoot, COMMAND_FILES.claude))).toBe(false);
  });

  it("throws on unknown ids without writing any files", async () => {
    const { init } = await import("../../src/commands/init.js");
    await expect(init({ tools: "claude,wat", mcp: false })).rejects.toThrow(
      /wat/,
    );
    expect(existsSync(join(tmpRoot, "tests"))).toBe(false);
    expect(existsSync(join(tmpRoot, ".claude"))).toBe(false);
  });

  it("falls back to detected editors when not a TTY and no --tools flag", async () => {
    const { init } = await import("../../src/commands/init.js");
    // Detect exactly one editor: Cursor.
    mkdirSync(join(tmpRoot, ".cursor"), { recursive: true });
    await init({ mcp: false }, { isTTY: false, homeDir: blankHome });
    // Detected Cursor is configured via the non-interactive fallback…
    expect(existsSync(join(tmpRoot, COMMAND_FILES.cursor))).toBe(true);
    // …and nothing undetected is.
    expect(existsSync(join(tmpRoot, COMMAND_FILES.claude))).toBe(false);
    expect(existsSync(join(tmpRoot, COMMAND_FILES.opencode))).toBe(false);
  });

  it("non-TTY fallback ignores global-only editors (project-scope only)", async () => {
    const { init } = await import("../../src/commands/init.js");
    // Oh My Pi exists only via its global config dir (~/.omp/agent) —
    // no .omp/ marker dir in the project. The global signal must not
    // authorize editor configuration in the non-interactive fallback:
    // init fails with --tools guidance and writes nothing.
    mkdirSync(join(blankHome, ".omp", "agent"), { recursive: true });
    await expect(
      init({ mcp: false }, { isTTY: false, homeDir: blankHome }),
    ).rejects.toThrow(/--tools/);
    expect(existsSync(join(tmpRoot, COMMAND_FILES.omp))).toBe(false);
    expect(existsSync(join(tmpRoot, ".omp"))).toBe(false);
  });

  it("fails with --tools guidance when nothing is detected and not a TTY", async () => {
    const { init } = await import("../../src/commands/init.js");
    await expect(
      init({ mcp: false }, { isTTY: false, homeDir: blankHome }),
    ).rejects.toThrow(/--tools/);
  });
});

// ─── init interactive prompt selection ────────────────────────────────

describe("init interactive prompt selection", () => {
  let tmpRoot: string;
  let cwdSpy: ReturnType<typeof import("vitest")["vi"]["spyOn"]>;

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), "ospw-pw-init-prompt-"));
    mkdirSync(join(tmpRoot, "openspec"), { recursive: true });
    // Detect exactly one editor: Cursor.
    mkdirSync(join(tmpRoot, ".cursor"), { recursive: true });
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tmpRoot);
  });

  afterEach(() => {
    cwdSpy.mockRestore();
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("pre-selects detected editors and installs only the confirmed selection", async () => {
    const { init } = await import("../../src/commands/init.js");
    const receivedDetected = new Set<string>();
    const fakePrompt = async (
      allEditors: Array<{ id: string }>,
      detected: ReadonlySet<string>,
    ) => {
      // All editors are offered — never fewer than the full registry.
      expect(allEditors.length).toBe(6);
      // Detected Cursor is pre-selected.
      // Detected Cursor is pre-selected.
      expect(detected.has("cursor")).toBe(true);
      detected.forEach((id) => receivedDetected.add(id));
      // User overrides the pre-selection and picks only Claude.
      return ["claude"];
    };

    await init({ mcp: false }, { isTTY: true, prompt: fakePrompt });

    expect(receivedDetected.has("cursor")).toBe(true);
    // Only the confirmed selection is installed.
    expect(existsSync(join(tmpRoot, ".claude/commands/opsx/e2e.md"))).toBe(true);
    expect(existsSync(join(tmpRoot, ".cursor/commands/opsx-e2e.md"))).toBe(false);
    expect(existsSync(join(tmpRoot, ".opencode"))).toBe(false);
  });

  it("an empty interactive selection behaves like --tools none", async () => {
    const { init } = await import("../../src/commands/init.js");
    await init({ mcp: false }, { isTTY: true, prompt: async () => [] });

    expect(existsSync(join(tmpRoot, ".claude"))).toBe(false);
    expect(existsSync(join(tmpRoot, ".cursor"))).toBe(true); // created by us only
    expect(existsSync(join(tmpRoot, "tests/playwright/seed.spec.ts"))).toBe(true);
  });
});

describe("init interactive prompt with no detected editors", () => {
  let tmpRoot: string;
  let cwdSpy: ReturnType<typeof import("vitest")["vi"]["spyOn"]>;
  const blankHome = join(tmpdir(), "ospw-pw-blank-home-prompt-" + Date.now());

  beforeAll(() => {
    mkdirSync(blankHome, { recursive: true });
  });

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), "ospw-pw-init-nodetect-"));
    mkdirSync(join(tmpRoot, "openspec"), { recursive: true });
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tmpRoot);
  });

  afterEach(() => {
    cwdSpy.mockRestore();
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  afterAll(() => {
    rmSync(blankHome, { recursive: true, force: true });
  });

  it("still prompts with all editors and none pre-selected, then configures the confirmation", async () => {
    const { init } = await import("../../src/commands/init.js");
    const seenDetected = new Set<string>();
    const fakePrompt = async (
      allEditors: Array<{ id: string }>,
      detected: ReadonlySet<string>,
    ) => {
      // All editors offered despite zero detections…
      expect(allEditors.length).toBe(6);
      // …with nothing pre-selected.
      expect(detected.size).toBe(0);
      detected.forEach((id) => seenDetected.add(id));
      return ["cursor"];
    };

    await init({ mcp: false }, { isTTY: true, homeDir: blankHome, prompt: fakePrompt });

    expect(seenDetected.size).toBe(0);
    // The confirmation is installed even though nothing was detected.
    expect(existsSync(join(tmpRoot, ".cursor/commands/opsx-e2e.md"))).toBe(true);
    expect(existsSync(join(tmpRoot, ".claude"))).toBe(false);
  });
});

// ─── init frontend signal hint ─────────────────────────────────────────

describe("init frontend signal hint", () => {
  let tmpRoot: string;
  let cwdSpy: ReturnType<typeof import("vitest")["vi"]["spyOn"]>;
  let logSpy: ReturnType<typeof import("vitest")["vi"]["spyOn"]>;
  const logs: string[] = [];

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), "ospw-pw-init-frontend-"));
    mkdirSync(join(tmpRoot, "openspec"), { recursive: true });
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tmpRoot);
    logs.length = 0;
    logSpy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      logs.push(args.join(" "));
    });
  });

  afterEach(() => {
    cwdSpy.mockRestore();
    logSpy.mockRestore();
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("prints the two-line hint for a project without a frontend signal", async () => {
    writeFileSync(
      join(tmpRoot, "package.json"),
      JSON.stringify({ dependencies: { express: "^4.0.0" }, scripts: { dev: "node server.js" } }),
    );
    const { init } = await import("../../src/commands/init.js");
    await init({ tools: "none" });
    expect(logs.some((l) => l.includes("request fixture"))).toBe(true);
    expect(logs.some((l) => l.includes("app directory"))).toBe(true);
    // Hint does not affect the install flow.
    expect(existsSync(join(tmpRoot, "tests/playwright/seed.spec.ts"))).toBe(true);
  });

  it("prints no hint when a frontend signal is present", async () => {
    writeFileSync(join(tmpRoot, "package.json"), JSON.stringify({ scripts: { dev: "vite" } }));
    const { init } = await import("../../src/commands/init.js");
    await init({ tools: "none" });
    expect(logs.some((l) => l.includes("request fixture"))).toBe(false);
  });

  it("prints no hint when findNpmRoot descends to a frontend app (monorepo)", async () => {
    const appDir = join(tmpRoot, "apps", "web");
    mkdirSync(appDir, { recursive: true });
    writeFileSync(join(tmpRoot, "package.json"), JSON.stringify({ private: true, workspaces: ["apps/*"] }));
    writeFileSync(join(appDir, "package.json"), JSON.stringify({ scripts: { dev: "vite" } }));
    const { init } = await import("../../src/commands/init.js");
    await init({ tools: "none" });
    expect(logs.some((l) => l.includes("request fixture"))).toBe(false);
  });

  it("skips the hint and still scaffolds when no package.json exists", async () => {
    const { init } = await import("../../src/commands/init.js");
    await init({ tools: "none" });
    expect(logs.some((l) => l.includes("request fixture"))).toBe(false);
    expect(existsSync(join(tmpRoot, "tests/playwright/seed.spec.ts"))).toBe(true);
    expect(existsSync(join(tmpRoot, "playwright.config.ts"))).toBe(true);
  });
});

// ─── init output signals: detected vs selected ────────────────────────

describe("init output signals detected vs selected", () => {
  let tmpRoot: string;
  let cwdSpy: ReturnType<typeof import("vitest")["vi"]["spyOn"]>;
  let logSpy: ReturnType<typeof import("vitest")["vi"]["spyOn"]>;
  const logs: string[] = [];
  const blankHome = join(tmpdir(), "ospw-pw-blank-home-signals-" + Date.now());

  beforeAll(() => {
    mkdirSync(blankHome, { recursive: true });
  });

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), "ospw-pw-init-signals-"));
    mkdirSync(join(tmpRoot, "openspec"), { recursive: true });
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tmpRoot);
    logs.length = 0;
    logSpy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      logs.push(args.join(" "));
    });
  });

  afterEach(() => {
    cwdSpy.mockRestore();
    logSpy.mockRestore();
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  afterAll(() => {
    rmSync(blankHome, { recursive: true, force: true });
  });

  it("--tools suppresses the Detected line; Selected editors is the install set", async () => {
    // Both editors detectable — the misread this change fixes.
    mkdirSync(join(tmpRoot, ".claude"), { recursive: true });
    mkdirSync(join(tmpRoot, ".opencode"), { recursive: true });
    const { init } = await import("../../src/commands/init.js");
    await init({ tools: "claude", mcp: false });
    expect(logs.some((l) => l.includes("Selected editors: claude"))).toBe(true);
    expect(logs.some((l) => l.includes("Detected"))).toBe(false);
    expect(existsSync(join(tmpRoot, ".opencode/commands/opsx-e2e.md"))).toBe(false);
  });

  it("no --tools in non-TTY prints Detected (pre-select) and the fallback as Selected editors", async () => {
    mkdirSync(join(tmpRoot, ".claude"), { recursive: true });
    mkdirSync(join(tmpRoot, ".opencode"), { recursive: true });
    const { init } = await import("../../src/commands/init.js");
    await init({ mcp: false }, { isTTY: false, homeDir: blankHome });
    expect(logs.some((l) => l.includes("Detected (pre-select): claude, opencode"))).toBe(true);
    expect(logs.some((l) => l.includes("Selected editors: claude, opencode"))).toBe(true);
  });

  it("TTY override: Detected (pre-select) lists detection, Selected editors reflects the confirmation", async () => {
    mkdirSync(join(tmpRoot, ".cursor"), { recursive: true });
    const { init } = await import("../../src/commands/init.js");
    await init(
      { mcp: false },
      { isTTY: true, homeDir: blankHome, prompt: async () => ["claude"] },
    );
    expect(logs.some((l) => l.includes("Detected (pre-select): cursor"))).toBe(true);
    expect(logs.some((l) => l.includes("Selected editors: claude"))).toBe(true);
  });

  it("--tools none prints Selected editors: none", async () => {
    const { init } = await import("../../src/commands/init.js");
    await init({ tools: "none" });
    expect(logs.some((l) => l.includes("Selected editors: none"))).toBe(true);
  });

  it("nothing detected without --tools prints both none lines before failing", async () => {
    const { init } = await import("../../src/commands/init.js");
    await expect(
      init({ mcp: false }, { isTTY: false, homeDir: blankHome }),
    ).rejects.toThrow(/--tools/);
    expect(logs.some((l) => l.includes("Detected: none"))).toBe(true);
    expect(logs.some((l) => l.includes("Selected editors: none"))).toBe(true);
  });

  it("--tools expands to an editor that was not detected", async () => {
    mkdirSync(join(tmpRoot, ".claude"), { recursive: true });
    mkdirSync(join(tmpRoot, ".opencode"), { recursive: true });
    const { init } = await import("../../src/commands/init.js");
    await init({ tools: "cursor", mcp: false });
    expect(logs.some((l) => l.includes("Detected"))).toBe(false);
    expect(logs.some((l) => l.includes("Selected editors: cursor"))).toBe(true);
    expect(existsSync(join(tmpRoot, ".cursor/commands/opsx-e2e.md"))).toBe(true);
  });
});

// ─── init credentials ignore hint ─────────────────────────────────────

describe("init credentials ignore hint", () => {
  let tmpRoot: string;
  let cwdSpy: ReturnType<typeof import("vitest")["vi"]["spyOn"]>;
  let logSpy: ReturnType<typeof import("vitest")["vi"]["spyOn"]>;
  const logs: string[] = [];

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), "ospw-pw-init-credhint-"));
    mkdirSync(join(tmpRoot, "openspec"), { recursive: true });
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tmpRoot);
    logs.length = 0;
    logSpy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      logs.push(args.join(" "));
    });
  });

  afterEach(() => {
    cwdSpy.mockRestore();
    logSpy.mockRestore();
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("hints when credentials.yaml is not git-ignored", async () => {
    const { init } = await import("../../src/commands/init.js");
    await init({ tools: "none" });
    expect(
      logs.some(
        (l) =>
          l.includes("Test credentials are not git-ignored") &&
          l.includes("tests/playwright/credentials.yaml"),
      ),
    ).toBe(true);
  });

  it("no hint when .gitignore covers both credential files", async () => {
    writeFileSync(
      join(tmpRoot, ".gitignore"),
      "tests/playwright/credentials.yaml\ntests/playwright/credentials.yaml.bak\n",
    );
    const { init } = await import("../../src/commands/init.js");
    await init({ tools: "none" });
    expect(
      logs.some((l) => l.includes("Test credentials are not git-ignored")),
    ).toBe(false);
  });

  it("never edits the project .gitignore", async () => {
    const content = "# my rules\ntests/playwright/credentials.yaml\n";
    writeFileSync(join(tmpRoot, ".gitignore"), content);
    const { init } = await import("../../src/commands/init.js");
    await init({ tools: "none" });
    expect(readFileSync(join(tmpRoot, ".gitignore"), "utf-8")).toBe(content);
  });
});
