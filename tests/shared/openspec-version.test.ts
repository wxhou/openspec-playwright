import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  OPENSPEC_SUPPORTED_MAJOR,
  detectOpenSpecVersion,
  openSpecCliStatus,
  parseOpenSpecMajor,
  probeOpenSpecVersion,
} from "../../src/shared/openspec-version.js";

const originalPath = process.env.PATH;

afterEach(() => {
  process.env.PATH = originalPath;
});

/** Write an executable shim named `name` into `dir`. */
function writeShim(
  dir: string,
  name: string,
  stdout: string,
  opts: { stderr?: string; code?: number } = {},
): void {
  const code = opts.code ?? 0;
  if (process.platform === "win32") {
    const lines = ["@echo off"];
    if (stdout) lines.push(`echo ${stdout}`);
    if (opts.stderr) lines.push(`echo ${opts.stderr} 1>&2`);
    if (code) lines.push(`exit /b ${code}`);
    writeFileSync(join(dir, `${name}.cmd`), `${lines.join("\r\n")}\r\n`);
  } else {
    const lines = ["#!/bin/sh"];
    if (stdout) lines.push(`echo "${stdout}"`);
    if (opts.stderr) lines.push(`echo "${opts.stderr}" >&2`);
    if (code) lines.push(`exit ${code}`);
    writeFileSync(join(dir, name), `${lines.join("\n")}\n`, { mode: 0o755 });
  }
}

/** Put a fake `openspec` on PATH that prints the given version. */
function fakeOpenspecOnPath(version: string): string {
  const dir = mkdtempSync(join(tmpdir(), "ospw-fake-openspec-"));
  writeShim(dir, "openspec", version);
  process.env.PATH = `${dir}${process.platform === "win32" ? ";" : ":"}${originalPath}`;
  return dir;
}

/** Create a directory holding a fake `openspec` that exits 3 with `stderr`. */
function brokenOpenspecOnPath(stderr: string): string {
  const dir = mkdtempSync(join(tmpdir(), "ospw-broken-openspec-"));
  writeShim(dir, "openspec", "", { stderr, code: 3 });
  return dir;
}

describe("parseOpenSpecMajor", () => {
  it("reads the major version out of the CLI output", () => {
    expect(parseOpenSpecMajor("1.17.0")).toBe(1);
    expect(parseOpenSpecMajor("2.1.0")).toBe(2);
    expect(parseOpenSpecMajor("v1.17.0")).toBe(1);
  });

  it("reads the version from a banner that names the tool", () => {
    expect(parseOpenSpecMajor("openspec 1.17.0")).toBe(1);
    expect(parseOpenSpecMajor("@fission-ai/openspec@1.17.0")).toBe(1);
  });

  it("ignores unrelated versions in a banner", () => {
    expect(parseOpenSpecMajor("Node 22.1.0 - openspec 1.17.0")).toBe(1);
  });

  it("reads a version that sits on its own line", () => {
    expect(parseOpenSpecMajor("(node warning)\n2.1.0")).toBe(2);
  });

  it("keeps prerelease versions parseable", () => {
    expect(parseOpenSpecMajor("1.6.0-beta.1")).toBe(1);
    expect(parseOpenSpecMajor("2.0.0-rc.2")).toBe(2);
  });

  it("returns null when the output carries no version", () => {
    expect(parseOpenSpecMajor("")).toBeNull();
    expect(parseOpenSpecMajor("not a version")).toBeNull();
  });
});

describe("probeOpenSpecVersion", () => {
  it("reports the major version of the CLI on PATH", () => {
    fakeOpenspecOnPath("2.1.0");
    expect(probeOpenSpecVersion()).toEqual({
      major: 2,
      reason: null,
      missing: false,
    });
  });

  it("reports a prerelease CLI by its major version", () => {
    fakeOpenspecOnPath("1.6.0-beta.1");
    expect(probeOpenSpecVersion()).toEqual({
      major: 1,
      reason: null,
      missing: false,
    });
  });

  it("reports the reason when the version output cannot be read", () => {
    fakeOpenspecOnPath("banana");
    const probe = probeOpenSpecVersion();
    expect(probe.major).toBeNull();
    expect(probe.missing).toBe(false);
    expect(probe.reason).toContain("not parseable");
  });

  it("reports 'not found' when no CLI is reachable", () => {
    // An empty PATH hides both the global binary and npx, so neither probe
    // can resolve — the "CLI missing" case, not a version report.
    process.env.PATH = mkdtempSync(join(tmpdir(), "ospw-no-openspec-"));
    expect(probeOpenSpecVersion()).toEqual({
      major: null,
      reason: "not found",
      missing: true,
    });
  });

  it("keeps a failing CLI's stderr as the reason", () => {
    // PATH holds only the broken binary — without npx on PATH the fallback
    // cannot mask the failure.
    process.env.PATH = brokenOpenspecOnPath("broken install");
    expect(probeOpenSpecVersion()).toEqual({
      major: null,
      reason: "probe failed: broken install",
      missing: false,
    });
  });

  it("does not let npx mask a broken CLI on PATH", () => {
    // The shell — and the generated commands — run the PATH binary, so a
    // local npx copy must not report the install as healthy.
    const dir = mkdtempSync(join(tmpdir(), "ospw-broken-with-npx-"));
    writeShim(dir, "openspec", "", { stderr: "broken install", code: 3 });
    writeShim(dir, "npx", "1.17.0");
    process.env.PATH = dir;
    expect(probeOpenSpecVersion()).toEqual({
      major: null,
      reason: "probe failed: broken install",
      missing: false,
    });
  });
});

describe("openSpecCliStatus", () => {
  it("accepts a supported 1.x CLI", () => {
    expect(
      openSpecCliStatus({ major: 1, reason: null, missing: false }),
    ).toEqual({ ok: true, major: 1 });
  });

  it("reports a missing CLI as missing", () => {
    const status = openSpecCliStatus({
      major: null,
      reason: "not found",
      missing: true,
    });
    expect(status.ok).toBe(false);
    if (status.ok) throw new Error("expected a failure status");
    expect(status.kind).toBe("missing");
  });

  it("reports a 2.x CLI as unsupported and names the 1.x install command", () => {
    const status = openSpecCliStatus({
      major: 2,
      reason: null,
      missing: false,
    });
    expect(status.ok).toBe(false);
    if (status.ok) throw new Error("expected a failure status");
    expect(status.kind).toBe("unsupported");
    expect(status.message).toContain("2.x detected");
    expect(status.message).toContain("npm install -g @fission-ai/openspec@1");
  });

  it("reports an unreadable version as unreadable, not missing", () => {
    const status = openSpecCliStatus({
      major: null,
      reason: "probe failed: broken install",
      missing: false,
    });
    expect(status.ok).toBe(false);
    if (status.ok) throw new Error("expected a failure status");
    expect(status.kind).toBe("unreadable");
    expect(status.message).toContain("could not be read");
  });
});

describe("detectOpenSpecVersion", () => {
  it("memoizes the probe result", () => {
    fakeOpenspecOnPath("1.17.0");
    const first = detectOpenSpecVersion();
    const second = detectOpenSpecVersion();
    expect(first).toEqual({ major: 1, reason: null, missing: false });
    expect(second).toBe(first);
  });
});

describe("supported OpenSpec major", () => {
  it("is 1.x — 2.x stopped generating the /opsx:* command files", () => {
    expect(OPENSPEC_SUPPORTED_MAJOR).toBe(1);
  });
});
