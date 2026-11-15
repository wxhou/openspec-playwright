import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { miniProgramChecks } from "../../src/commands/doctor.js";

// A fresh directory per test: Node caches successful require.resolve hits by
// request + search paths, so reusing one path would let a stale hit survive
// after node_modules is deleted.
let tmpDir = "";

function writePackage(name: string, version: string) {
  const dir = join(tmpDir, "node_modules", name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({ name, version, main: "index.js" }),
  );
  writeFileSync(join(dir, "index.js"), "module.exports = {};");
}

describe("doctor mini-program checks", () => {
  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "openspec-pw-doctor-miniprogram-"));
    writeFileSync(join(tmpDir, "project.config.json"), "{}");
    writeFileSync(
      join(tmpDir, "app.json"),
      JSON.stringify({ pages: ["pages/index/index"] }),
    );
    writeFileSync(join(tmpDir, "package.json"), JSON.stringify({ scripts: { dev: "x" } }));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("passes fixture, version, and output checks when everything is present", () => {
    writePackage("@playwright/test", "1.65.1");
    writePackage("@open-wxa/wxa-runner-playwright", "0.13.1");
    const checks = miniProgramChecks(tmpDir);
    expect(checks.find((c) => c.name === "chrome")).toBeDefined();
    expect(checks.find((c) => c.name === "wxa-fixture")?.ok).toBe(true);
    expect(checks.find((c) => c.name === "playwright-test-version")?.ok).toBe(true);
    expect(checks.find((c) => c.name === "wxa-project")?.ok).toBe(true);
  });

  it("fails the version check below 1.64 and names the requirement", () => {
    writePackage("@playwright/test", "1.63.0");
    writePackage("@open-wxa/wxa-runner-playwright", "0.13.1");
    const check = miniProgramChecks(tmpDir).find((c) => c.name === "playwright-test-version");
    expect(check?.ok).toBe(false);
    expect(check?.message).toContain("requires >=1.64");
  });

  it("reports a missing fixture with the install command", () => {
    const check = miniProgramChecks(tmpDir).find((c) => c.name === "wxa-fixture");
    expect(check?.ok).toBe(false);
    expect(check?.message).toContain("@open-wxa/wxa-runner-playwright");
  });

  it("fails the output check when the build output is missing", () => {
    rmSync(join(tmpDir, "project.config.json"));
    writeFileSync(
      join(tmpDir, "package.json"),
      JSON.stringify({ scripts: { dev: "x" }, dependencies: { "@tarojs/taro": "^4.0.0" } }),
    );
    const check = miniProgramChecks(tmpDir).find((c) => c.name === "wxa-project");
    expect(check?.ok).toBe(false);
    expect(check?.message).toContain("build first");
  });
});
