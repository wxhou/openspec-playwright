import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  resolveBuildCommand,
  resolvePageManifest,
  resolveWxaProject,
} from "../../src/shared/miniprogram.js";

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

  it("prefixes the build command with the workspace member path", () => {
    const pkg = join(root, "apps", "mobile");
    writeJson(join(pkg, "package.json"), {
      scripts: { dev: "uni -p mp-weixin", "build:mp-weixin": "uni build -p mp-weixin" },
      dependencies: { "@dcloudio/uni-app": "^3.0.0" },
    });

    expect(resolveBuildCommand(root)).toBe("npm --prefix apps/mobile run build:mp-weixin");
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

describe("mini-program resolution when the repo root owns the dev script", () => {
  let root = "";

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "openspec-pw-mini-root-dev-"));
    // The repo root runs the web app; the mini program is a workspace member.
    writeJson(join(root, "package.json"), {
      private: true,
      scripts: { dev: "vite" },
      workspaces: ["apps/*"],
    });
    const pkg = join(root, "apps", "mobile");
    writeJson(join(pkg, "package.json"), {
      scripts: { "build:mp-weixin": "uni build -p mp-weixin" },
      dependencies: { "@dcloudio/uni-app": "^3.0.0" },
    });
    mkdirSync(join(pkg, "dist", "dev", "mp-weixin"), { recursive: true });
    writeJson(join(pkg, "src", "pages.json"), { pages: [{ path: "pages/home/index" }] });
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("points wxaProject at the member's build output", () => {
    const wxa = resolveWxaProject(root);
    expect(wxa.kind).toBe("uni-app");
    expect(wxa.projectPath).toBe("apps/mobile/dist/dev/mp-weixin");
    expect(wxa.exists).toBe(true);
  });

  it("runs the build script from the member that owns it", () => {
    expect(resolveBuildCommand(root)).toBe("npm --prefix apps/mobile run build:mp-weixin");
  });

  it("reads the page manifest from the member", () => {
    expect(resolvePageManifest(root).homePage).toBe("pages/home/index");
  });
});

describe("mini-program resolution for a member path with a space", () => {
  let root = "";

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "openspec-pw-mini-spaced-"));
    writeJson(join(root, "package.json"), {
      private: true,
      workspaces: ["apps/*"],
    });
    writeJson(join(root, "apps", "my app", "package.json"), {
      scripts: { "build:mp-weixin": "uni build -p mp-weixin" },
      dependencies: { "@dcloudio/uni-app": "^3.0.0" },
    });
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("quotes the prefix so the path stays one shell argument", () => {
    expect(resolveBuildCommand(root)).toBe('npm --prefix "apps/my app" run build:mp-weixin');
  });
});

describe("page manifest entry page", () => {
  let root = "";

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "openspec-pw-mini-entry-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("honors entryPagePath without a project.config.json", () => {
    writeJson(join(root, "app.json"), {
      entryPagePath: "pages/home/index",
      pages: ["pages/index/index"],
    });

    expect(resolvePageManifest(root).homePage).toBe("pages/home/index");
  });

  it("honors entryPagePath in a uni-app pages.json", () => {
    writeJson(join(root, "src", "pages.json"), {
      entryPagePath: "pages/home/index",
      pages: [{ path: "pages/index/index" }],
    });

    expect(resolvePageManifest(root).homePage).toBe("pages/home/index");
  });
});
