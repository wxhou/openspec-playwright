import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { fileURLToPath } from "url";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const tmpDir = join(tmpdir(), "openspec-pw-miniprogram-init-" + Date.now());
const testsDir = join(tmpDir, "tests", "playwright");

function writeNativeProject() {
  writeFileSync(join(tmpDir, "project.config.json"), "{}");
  writeFileSync(
    join(tmpDir, "app.json"),
    JSON.stringify({
      entryPagePath: "pages/home/index",
      pages: ["pages/index/index", "pages/home/index"],
      subPackages: [{ root: "pkg", pages: ["detail/detail"] }],
    }),
  );
}

describe("mini-program scaffold generation", () => {
  beforeEach(() => {
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("generates the fixture scaffold without web auth assets", async () => {
    writeNativeProject();
    const {
      generateSeedTest,
      generateSharedPages,
      generatePlaywrightConfig,
      generateAppKnowledge,
      generateTestPlanTemplate,
    } = await import("../../src/commands/init.js");

    await generateSeedTest(tmpDir, "miniprogram");
    await generateSharedPages(tmpDir, "miniprogram");
    await generatePlaywrightConfig(tmpDir, "miniprogram");
    await generateAppKnowledge(tmpDir, "miniprogram");
    await generateTestPlanTemplate(tmpDir, "miniprogram");

    const seed = readFileSync(join(testsDir, "seed.spec.ts"), "utf-8");
    expect(seed).toContain("pages/home/index");
    expect(seed).not.toContain("__HOME_PAGE__");
    expect(seed).not.toContain("__SKIP_LINE__");

    const config = readFileSync(join(tmpDir, "playwright.config.ts"), "utf-8");
    expect(config).toContain("wxaProject: '.'");
    expect(config).toContain("channel: 'chrome'");
    expect(config).not.toContain("webServer:");

    expect(existsSync(join(testsDir, "wxa-test.ts"))).toBe(true);
    expect(existsSync(join(testsDir, "wxa.setup.ts"))).toBe(true);
    expect(existsSync(join(testsDir, "README.md"))).toBe(true);
    expect(existsSync(join(testsDir, "auth.setup.ts"))).toBe(false);
    expect(existsSync(join(testsDir, "credentials.yaml"))).toBe(false);

    const basePage = readFileSync(join(testsDir, "pages", "BasePage.ts"), "utf-8");
    expect(basePage).toContain("miniProgram.current");
    expect(basePage).not.toContain("goto(");

    const knowledge = readFileSync(join(testsDir, "app-knowledge.md"), "utf-8");
    expect(knowledge).toContain("## Pages");
    const plan = readFileSync(join(testsDir, "test-plan.template.md"), "utf-8");
    expect(plan).toContain("**Page**:");
  });

  it("skips the seed with a reason when the page manifest is unreadable", async () => {
    writeFileSync(join(tmpDir, "project.config.json"), "{}");
    const { generateSeedTest } = await import("../../src/commands/init.js");
    await generateSeedTest(tmpDir, "miniprogram");

    const seed = readFileSync(join(testsDir, "seed.spec.ts"), "utf-8");
    expect(seed).toContain("test.skip(true,");
    expect(seed).toContain("no readable page manifest");
  });

  it("reads uni-app pages.json for the home page", async () => {
    writeFileSync(
      join(tmpDir, "package.json"),
      JSON.stringify({ scripts: { dev: "uni" }, devDependencies: { "@dcloudio/uni-app": "^3.0.0" } }),
    );
    writeFileSync(
      join(tmpDir, "pages.json"),
      JSON.stringify({ pages: [{ path: "pages/uni/home" }] }),
    );
    const { generateSeedTest } = await import("../../src/commands/init.js");
    await generateSeedTest(tmpDir, "miniprogram");
    expect(readFileSync(join(testsDir, "seed.spec.ts"), "utf-8")).toContain("pages/uni/home");
  });

  it("reads Taro app.config.ts when no compiled app.json exists", async () => {
    writeFileSync(
      join(tmpDir, "package.json"),
      JSON.stringify({ scripts: { dev: "taro" }, dependencies: { "@tarojs/taro": "^4.0.0" } }),
    );
    mkdirSync(join(tmpDir, "src"), { recursive: true });
    writeFileSync(
      join(tmpDir, "src", "app.config.ts"),
      "export default { pages: ['pages/taro/index'] };",
    );
    const { generateSeedTest } = await import("../../src/commands/init.js");
    await generateSeedTest(tmpDir, "miniprogram");
    expect(readFileSync(join(testsDir, "seed.spec.ts"), "utf-8")).toContain("pages/taro/index");
  });
});

describe("update mini-program templates", () => {
  beforeEach(() => {
    mkdirSync(testsDir, { recursive: true });
    writeFileSync(join(tmpDir, "project.config.json"), "{}");
    writeFileSync(join(testsDir, "wxa-test.ts"), "export {};");
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("syncs the mini-program BasePage and skips credentials", async () => {
    const { syncProjectTemplates } = await import("../../src/commands/update.js");
    syncProjectTemplates(ROOT, tmpDir);

    const basePage = readFileSync(join(testsDir, "pages", "BasePage.ts"), "utf-8");
    expect(basePage).toContain("miniProgram.current");
    expect(basePage).not.toContain("this.page.getByRole");

    const wrapper = readFileSync(join(testsDir, "wxa-test.ts"), "utf-8");
    expect(wrapper).toContain("@open-wxa/wxa-runner-playwright");

    expect(existsSync(join(testsDir, "credentials.yaml"))).toBe(false);
  });
});

describe("mini-program CI generation", () => {
  beforeEach(() => {
    mkdirSync(tmpDir, { recursive: true });
    writeFileSync(
      join(tmpDir, "package.json"),
      JSON.stringify({
        scripts: { dev: "uni", "build:mp-weixin": "uni build -p mp-weixin" },
        devDependencies: { "@dcloudio/uni-app": "^3.0.0" },
      }),
    );
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("renders the GitHub workflow with Chrome and the build step", async () => {
    const { generateGithubWorkflow } = await import("../../src/commands/init.js");
    await generateGithubWorkflow(tmpDir, "miniprogram");
    const content = readFileSync(
      join(tmpDir, ".github", "workflows", "openspec-pw.yml"),
      "utf-8",
    );
    expect(content).toContain("npx playwright install --with-deps chrome");
    expect(content).toContain("npm run build:mp-weixin");
    expect(content.indexOf("npm run build:mp-weixin")).toBeLessThan(
      content.indexOf("npx playwright test"),
    );
  });

  it("inserts the build step into both auto-pipeline jobs", async () => {
    const { generateAutoPipeline } = await import("../../src/commands/pipeline.js");
    generateAutoPipeline(tmpDir, "miniprogram");
    const content = readFileSync(
      join(tmpDir, ".github", "workflows", "openspec-auto.yml"),
      "utf-8",
    );
    expect(content.match(/npm run build:mp-weixin/g)).toHaveLength(2);
  });

  it("keeps the web workflow byte-identical", async () => {
    const { generateGithubWorkflow } = await import("../../src/commands/init.js");
    await generateGithubWorkflow(tmpDir, "web");
    const generated = readFileSync(
      join(tmpDir, ".github", "workflows", "openspec-pw.yml"),
      "utf-8",
    );
    const bundled = readFileSync(join(ROOT, "templates", "github-workflow.yml"), "utf-8");
    expect(generated).toBe(bundled);
  });
});

describe("init summary for the mini-program target", () => {
  let cwdSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mkdirSync(tmpDir, { recursive: true });
    mkdirSync(join(tmpDir, "openspec"), { recursive: true });
    writeNativeProject();
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tmpDir);
  });

  afterEach(() => {
    cwdSpy.mockRestore();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("prints fixture dependencies instead of web auth steps", async () => {
    const logs: string[] = [];
    const logSpy = vi.spyOn(console, "log").mockImplementation((line: unknown) => {
      logs.push(String(line));
    });
    try {
      const { init } = await import("../../src/commands/init.js");
      await init({ tools: "none", miniprogram: true, mcp: false }, { isTTY: false });
    } finally {
      logSpy.mockRestore();
    }
    const output = logs.join("\n");
    expect(output).toContain("target: miniprogram");
    expect(output).toContain("@open-wxa/wxa-runner-playwright");
    expect(output).toContain("wxa.setup.ts");
    expect(output).not.toContain("Customize tests/playwright/credentials.yaml");
    expect(output).not.toContain("export E2E_USERNAME");
    expect(output).not.toContain("npx playwright test --project=setup");
  });
});

describe("init refuses a half migration to the mini-program target", () => {
  let cwdSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mkdirSync(tmpDir, { recursive: true });
    mkdirSync(join(tmpDir, "openspec"), { recursive: true });
    writeNativeProject();
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tmpDir);
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    cwdSpy.mockRestore();
    logSpy.mockRestore();
    errorSpy.mockRestore();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("stops before writing when a web config is already present", async () => {
    writeFileSync(join(tmpDir, "playwright.config.ts"), "export default {};\n");
    const { init } = await import("../../src/commands/init.js");
    await expect(
      init({ tools: "none", miniprogram: true, mcp: false }, { isTTY: false }),
    ).rejects.toThrow(/Existing web Playwright scaffold/);
    expect(existsSync(join(testsDir, "wxa-test.ts"))).toBe(false);
  });

  it("stops when a web BasePage is present without a mini config", async () => {
    mkdirSync(join(testsDir, "pages"), { recursive: true });
    writeFileSync(join(testsDir, "pages", "BasePage.ts"), "export class BasePage {}\n");
    const { init } = await import("../../src/commands/init.js");
    await expect(
      init({ tools: "none", miniprogram: true, mcp: false }, { isTTY: false }),
    ).rejects.toThrow(/pages\/BasePage\.ts/);
    expect(existsSync(join(testsDir, "wxa-test.ts"))).toBe(false);
  });
});
