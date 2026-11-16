import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "..");
const read = (rel: string) => readFileSync(join(ROOT, "templates", "miniprogram", rel), "utf8");

describe("mini-program templates", () => {
  it("config uses the wxa fixture and has no web-only fields", () => {
    const config = read("playwright.config.ts");
    expect(config).toContain("defineConfig<WxaOptions>");
    expect(config).toContain("channel: 'chrome'");
    expect(config).toContain("wxaProject:");
    expect(config).toContain("wxaServerOptions:");
    expect(config).toContain("setup: './tests/playwright/wxa.setup.ts'");
    expect(config).toContain("testDir:");
    expect(config).not.toContain("webServer:");
    expect(config).not.toContain("storageState");
    expect(config).not.toContain("name: 'setup'");
  });

  it("wxa-test re-exports only the stable fixture surface", () => {
    const wrapper = read("wxa-test.ts");
    expect(wrapper).toContain(
      "export { test, expect } from '@open-wxa/wxa-runner-playwright';",
    );
    expect(wrapper).toContain(
      "export type { WxaOptions } from '@open-wxa/wxa-runner-playwright';",
    );
    expect(wrapper.match(/export /g)).toHaveLength(2);
  });

  it("setup file is an empty defineSetup with commented examples", () => {
    const setup = read("wxa.setup.ts");
    expect(setup).toContain("import { defineSetup } from '@open-wxa/wxa-runner-core/setup';");
    expect(setup).toContain("export default defineSetup({});");
    expect(setup).toContain("storage:");
    expect(setup).toContain("network:");
  });

  it("BasePage targets miniProgram.current and exposes the fixture state API", () => {
    const base = read("pages/BasePage.ts");
    expect(base).toContain("this.miniProgram.current");
    for (const method of ["open(", "waitForPage(", "pageData(", "errors(", "requests("]) {
      expect(base).toContain(method);
    }
    expect(base).not.toContain("goto(");
    expect(base).not.toContain("toHaveURL");
  });

  it("seed uses the resolved home page and a skip hook", () => {
    const seed = read("seed.spec.ts");
    expect(seed).toContain("__HOME_PAGE__");
    expect(seed).toContain("__SKIP_LINE__");
    expect(seed).toContain("miniProgram.open(HOME_PAGE)");
    expect(seed).toContain("toHavePath(HOME_PAGE)");
  });

  it("docs state the browser-vs-device limitation", () => {
    const readme = read("tests-readme.md");
    expect(readme).toContain("3.7.0");
    expect(readme).toContain("不等于真机通过");
    expect(readme).toContain("wxa.setup.ts");

    const exploration = read("app-exploration.md");
    expect(exploration).toContain("pages/index/index");
    expect(exploration).toContain("waitForPage");
    expect(exploration).toContain("3.7.0");
  });
});
