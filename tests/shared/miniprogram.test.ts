import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { resolvePageManifest, resolveWxaProject } from "../../src/shared/miniprogram.js";

// Monorepo layout: the repo root has no runnable script, the package lives in
// apps/mobile. Paths must resolve against the package root, not the repo root.
let root = "";

function writeJson(path: string, value: unknown) {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, JSON.stringify(value));
}

describe("mini-program resolution in a monorepo", () => {
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "openspec-pw-mini-monorepo-"));
    writeJson(join(root, "package.json"), { private: true });
    mkdirSync(join(root, "apps", "mobile"), { recursive: true });
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("resolves the uni-app output and pages.json under the package root", () => {
    const pkg = join(root, "apps", "mobile");
    writeJson(join(pkg, "package.json"), {
      scripts: { dev: "uni -p mp-weixin" },
      dependencies: { "@dcloudio/uni-app": "^3.0.0" },
    });
    mkdirSync(join(pkg, "dist", "dev", "mp-weixin"), { recursive: true });
    writeJson(join(pkg, "src", "pages.json"), {
      pages: [{ path: "pages/home/index" }],
    });

    const wxa = resolveWxaProject(root);
    expect(wxa.kind).toBe("uni-app");
    expect(wxa.projectPath).toBe("apps/mobile/dist/dev/mp-weixin");
    expect(wxa.exists).toBe(true);
    expect(resolvePageManifest(root).homePage).toBe("pages/home/index");
  });

  it("reports the package-root default output when uni-app is not built yet", () => {
    const pkg = join(root, "apps", "mobile");
    writeJson(join(pkg, "package.json"), {
      scripts: { dev: "uni -p mp-weixin" },
      dependencies: { "@dcloudio/uni-app": "^3.0.0" },
    });

    const wxa = resolveWxaProject(root);
    expect(wxa.projectPath).toBe("apps/mobile/dist/dev/mp-weixin");
    expect(wxa.exists).toBe(false);
  });

  it("points uni-app at the build output when a build script exists", () => {
    const pkg = join(root, "apps", "mobile");
    writeJson(join(pkg, "package.json"), {
      scripts: { dev: "uni -p mp-weixin", "build:mp-weixin": "uni build -p mp-weixin" },
      dependencies: { "@dcloudio/uni-app": "^3.0.0" },
    });

    const wxa = resolveWxaProject(root);
    expect(wxa.projectPath).toBe("apps/mobile/dist/build/mp-weixin");
    expect(wxa.exists).toBe(false);
  });

  it("follows project.config.json miniprogramRoot for native projects", () => {
    writeJson(join(root, "project.config.json"), { miniprogramRoot: "miniprogram/" });
    writeJson(join(root, "miniprogram", "app.json"), {
      entryPagePath: "pages/home/index",
      pages: ["pages/index/index", "pages/home/index"],
    });

    const wxa = resolveWxaProject(root);
    expect(wxa.kind).toBe("native");
    expect(wxa.projectPath).toBe("miniprogram");
    expect(wxa.exists).toBe(true);
    expect(resolvePageManifest(root).homePage).toBe("pages/home/index");
  });

  it("marks an unrecognized directory without app.json as missing", () => {
    expect(resolveWxaProject(root).exists).toBe(false);
    writeJson(join(root, "app.json"), { pages: ["pages/index/index"] });
    expect(resolveWxaProject(root).exists).toBe(true);
  });

  it("resolves Taro outputRoot relative to the config directory", () => {
    const pkg = join(root, "apps", "mobile");
    writeJson(join(pkg, "package.json"), {
      scripts: { dev: "taro build --type weapp --watch", "build:weapp": "taro build --type weapp" },
      dependencies: { "@tarojs/taro": "^4.0.0" },
    });
    mkdirSync(join(pkg, "config"), { recursive: true });
    writeFileSync(join(pkg, "config", "index.ts"), "export default { outputRoot: 'dist' };\n");
    writeJson(join(pkg, "dist", "app.json"), { pages: ["pages/index/index"] });

    const wxa = resolveWxaProject(root);
    expect(wxa.kind).toBe("taro");
    expect(wxa.projectPath).toBe("apps/mobile/dist");
    expect(wxa.exists).toBe(true);
  });
});
