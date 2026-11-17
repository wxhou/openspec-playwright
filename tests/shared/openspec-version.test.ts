import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  OPENSPEC_SUPPORTED_MAJOR,
  detectOpenSpecMajorVersion,
  parseOpenSpecMajor,
} from "../../src/shared/openspec-version.js";

describe("parseOpenSpecMajor", () => {
  it("reads the major version out of the CLI output", () => {
    expect(parseOpenSpecMajor("1.17.0")).toBe(1);
    expect(parseOpenSpecMajor("2.1.0")).toBe(2);
    expect(parseOpenSpecMajor("v1.17.0")).toBe(1);
  });

  it("returns null when the output carries no version", () => {
    expect(parseOpenSpecMajor("")).toBeNull();
    expect(parseOpenSpecMajor("not a version")).toBeNull();
  });
});

describe("detectOpenSpecMajorVersion", () => {
  const originalPath = process.env.PATH;

  afterEach(() => {
    process.env.PATH = originalPath;
  });

  it("returns null when no openspec CLI is reachable", () => {
    // An empty PATH hides both the global binary and npx, so neither probe
    // can resolve — the "CLI missing" case, not a version report.
    process.env.PATH = mkdtempSync(join(tmpdir(), "ospw-no-openspec-"));
    expect(detectOpenSpecMajorVersion()).toBeNull();
  });
});

describe("supported OpenSpec major", () => {
  it("is 1.x — 2.x dropped the /opsx:* commands and --profile", () => {
    expect(OPENSPEC_SUPPORTED_MAJOR).toBe(1);
  });
});
