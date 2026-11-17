import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  OPENSPEC_SUPPORTED_MAJOR,
  detectOpenSpecVersion,
  parseOpenSpecMajor,
  probeOpenSpecVersion,
} from "../../src/shared/openspec-version.js";

const originalPath = process.env.PATH;

afterEach(() => {
  process.env.PATH = originalPath;
});

/** Put a fake `openspec` on PATH that prints the given version. */
function fakeOpenspecOnPath(version: string): string {
  const dir = mkdtempSync(join(tmpdir(), "ospw-fake-openspec-"));
  if (process.platform === "win32") {
    writeFileSync(join(dir, "openspec.cmd"), `@echo off\r\necho ${version}\r\n`);
  } else {
    writeFileSync(join(dir, "openspec"), `#!/bin/sh\necho "${version}"\n`, {
      mode: 0o755,
    });
  }
  process.env.PATH = `${dir}${process.platform === "win32" ? ";" : ":"}${originalPath}`;
  return dir;
}

describe("parseOpenSpecMajor", () => {
  it("reads the major version out of the CLI output", () => {
    expect(parseOpenSpecMajor("1.17.0")).toBe(1);
    expect(parseOpenSpecMajor("2.1.0")).toBe(2);
    expect(parseOpenSpecMajor("v1.17.0")).toBe(1);
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
    expect(probeOpenSpecVersion()).toEqual({ major: 2, reason: null });
  });

  it("reports a prerelease CLI by its major version", () => {
    fakeOpenspecOnPath("1.6.0-beta.1");
    expect(probeOpenSpecVersion()).toEqual({ major: 1, reason: null });
  });

  it("reports the reason when the version output cannot be read", () => {
    fakeOpenspecOnPath("banana");
    const probe = probeOpenSpecVersion();
    expect(probe.major).toBeNull();
    expect(probe.reason).toContain("not parseable");
  });

  it("reports 'not found' when no CLI is reachable", () => {
    // An empty PATH hides both the global binary and npx, so neither probe
    // can resolve — the "CLI missing" case, not a version report.
    process.env.PATH = mkdtempSync(join(tmpdir(), "ospw-no-openspec-"));
    expect(probeOpenSpecVersion()).toEqual({ major: null, reason: "not found" });
  });
});

describe("detectOpenSpecVersion", () => {
  it("memoizes the probe result", () => {
    fakeOpenspecOnPath("1.17.0");
    const first = detectOpenSpecVersion();
    const second = detectOpenSpecVersion();
    expect(first).toEqual({ major: 1, reason: null });
    expect(second).toBe(first);
  });
});

describe("supported OpenSpec major", () => {
  it("is 1.x — 2.x stopped generating the /opsx:* command files", () => {
    expect(OPENSPEC_SUPPORTED_MAJOR).toBe(1);
  });
});
