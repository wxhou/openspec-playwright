import { describe, it, expect } from "vitest";
import {
  execFileAsync,
  execFileSync,
  spawnSync,
} from "../../src/shared/exec.js";

const windowsOnly = process.platform === "win32" ? describe : describe.skip;

// These tests intentionally do not mock cross-spawn: they exercise the real
// Windows .cmd resolution path that the unit tests cannot cover.
windowsOnly("shared/exec on Windows", () => {
  it("runs npm.cmd and npx.cmd through execFileSync", () => {
    const npm = execFileSync("npm", ["--version"], { encoding: "utf-8" });
    expect(npm.trim()).toMatch(/^\d+\.\d+\.\d+/);

    const npx = execFileSync("npx", ["--version"], { encoding: "utf-8" });
    expect(npx.trim()).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("runs npm.cmd through execFileAsync without DEP0190", async () => {
    const warnings: string[] = [];
    const onWarning = (warning: Error) => {
      warnings.push(`${warning.name}: ${warning.message}`);
    };
    process.on("warning", onWarning);
    try {
      const result = await execFileAsync("npm", ["--version"]);
      expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
      expect(result.stderr).not.toContain("DEP0190");
      await new Promise((resolve) => setImmediate(resolve));
      expect(warnings.join("\n")).not.toContain("DEP0190");
    } finally {
      process.off("warning", onWarning);
    }
  });

  it("runs npx.cmd through spawnSync", () => {
    const result = spawnSync("npx", ["--version"], { encoding: "utf-8" });
    expect(result.status).toBe(0);
    expect(String(result.stdout)).toMatch(/^\d+\.\d+\.\d+/);
  });
});
