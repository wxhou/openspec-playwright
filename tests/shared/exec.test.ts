import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const mocks = vi.hoisted(() => {
  const sync = vi.fn();
  const spawn = Object.assign(vi.fn(), { sync });
  return { spawn, sync };
});

vi.mock("cross-spawn", () => ({ default: mocks.spawn }));

import {
  execFileAsync,
  execFileSync,
  spawnSync,
} from "../../src/shared/exec.js";

function fakeChild() {
  const child = new EventEmitter() as EventEmitter & {
    stdout: PassThrough;
    stderr: PassThrough;
    kill: ReturnType<typeof vi.fn>;
  };
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.kill = vi.fn();
  return child;
}

beforeEach(() => {
  mocks.spawn.mockReset();
  mocks.sync.mockReset();
});

describe("shared/exec", () => {
  it("execFileSync delegates to cross-spawn without a shell", () => {
    mocks.sync.mockReturnValue({
      status: 0,
      stdout: "1.2.3",
      stderr: "",
      signal: null,
    });

    const out = execFileSync("npm", ["--version"], {
      encoding: "utf-8",
      cwd: "/tmp/work",
      timeout: 1234,
      env: { OSPW_TEST: "1" },
    });

    expect(out).toBe("1.2.3");
    expect(mocks.sync).toHaveBeenCalledWith(
      "npm",
      ["--version"],
      expect.objectContaining({
        windowsHide: true,
        cwd: "/tmp/work",
        timeout: 1234,
        env: { OSPW_TEST: "1" },
      }),
    );
    expect(mocks.sync.mock.calls[0][2]).not.toHaveProperty("shell", true);
  });

  it("execFileSync returns an empty string when encoding has no piped stdout", () => {
    mocks.sync.mockReturnValue({
      status: 0,
      stdout: null,
      stderr: "",
      signal: null,
    });

    const out = execFileSync("claude", ["mcp", "list"], {
      encoding: "utf-8",
      stdio: "ignore",
    });

    expect(out).toBe("");
  });

  it("execFileSync throws on a non-zero status", () => {
    mocks.sync.mockReturnValue({
      status: 1,
      stdout: "",
      stderr: "boom",
      signal: null,
    });

    expect(() =>
      execFileSync("npm", ["install"], { encoding: "utf-8" }),
    ).toThrow(/boom/);
  });

  it("spawnSync returns the cross-spawn result unchanged", () => {
    mocks.sync.mockReturnValue({
      status: 0,
      stdout: "ok",
      stderr: "",
      signal: null,
    });

    const result = spawnSync("git", ["status"], {
      encoding: "utf-8",
      cwd: "/tmp/work",
      timeout: 1234,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toBe("ok");
    expect(mocks.sync).toHaveBeenCalledWith(
      "git",
      ["status"],
      expect.objectContaining({ cwd: "/tmp/work", timeout: 1234 }),
    );
  });

  it("execFileAsync collects stdout and stderr", async () => {
    const child = fakeChild();
    mocks.spawn.mockReturnValue(child);

    const promise = execFileAsync("npm", ["--version"], {
      cwd: "/tmp/work",
      timeout: 1234,
      env: { OSPW_TEST: "1" },
    });
    child.stdout.emit("data", "1.2.3");
    child.stderr.emit("data", "warn");
    child.emit("close", 0, null);

    await expect(promise).resolves.toEqual({
      stdout: "1.2.3",
      stderr: "warn",
    });
    expect(mocks.spawn).toHaveBeenCalledWith(
      "npm",
      ["--version"],
      expect.objectContaining({
        windowsHide: true,
        cwd: "/tmp/work",
        timeout: 1234,
        env: { OSPW_TEST: "1" },
      }),
    );
    expect(mocks.spawn.mock.calls[0][2]).not.toHaveProperty("shell", true);
  });

  it("execFileAsync rejects on a non-zero status", async () => {
    const child = fakeChild();
    mocks.spawn.mockReturnValue(child);

    const promise = execFileAsync("npm", ["install"]);
    child.stderr.emit("data", "boom");
    child.emit("close", 1, null);

    await expect(promise).rejects.toMatchObject({ status: 1, stderr: "boom" });
  });

  it("no source file uses shell: true or needsShell", () => {
    const srcRoot = fileURLToPath(new URL("../../src", import.meta.url));
    const offenders: string[] = [];

    function walk(dir: string): void {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(path);
        } else if (entry.name.endsWith(".ts")) {
          const source = readFileSync(path, "utf-8");
          if (
            /shell:\s*true/.test(source) ||
            /shell:\s*process\.platform/.test(source) ||
            /needsShell/.test(source)
          ) {
            offenders.push(path);
          }
        }
      }
    }

    walk(srcRoot);
    expect(offenders).toEqual([]);
  });
});
