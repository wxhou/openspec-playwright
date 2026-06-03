import { describe, it, expect } from "vitest";
import { SHARED_FILE_NAMES, TIMEOUT } from "../../src/shared/constants.js";

describe("SHARED_FILE_NAMES", () => {
  it("contains all expected shared files", () => {
    expect(SHARED_FILE_NAMES).toContain("seed.spec.ts");
    expect(SHARED_FILE_NAMES).toContain("app-all.spec.ts");
    expect(SHARED_FILE_NAMES).toContain("auth.setup.ts");
    expect(SHARED_FILE_NAMES).toContain("credentials.yaml");
    expect(SHARED_FILE_NAMES).toContain("app-knowledge.md");
    expect(SHARED_FILE_NAMES).toContain("playwright.config.ts");
    expect(SHARED_FILE_NAMES).toContain("mcp-tools.md");
  });

  it("has exactly 7 shared files", () => {
    expect(SHARED_FILE_NAMES.size).toBe(7);
  });

  it("is a Set", () => {
    expect(SHARED_FILE_NAMES).toBeInstanceOf(Set);
  });
});

describe("TIMEOUT", () => {
  it("has all expected timeout values", () => {
    expect(TIMEOUT.MCP_LIST).toBe(10000);
    expect(TIMEOUT.OPENSPEC_LIST).toBe(30000);
    expect(TIMEOUT.NPM_PACK).toBe(30000);
    expect(TIMEOUT.NAVIGATION).toBe(30000);
    expect(TIMEOUT.BROWSER_LAUNCH).toBe(60000);
  });

  it("has positive timeout values", () => {
    expect(TIMEOUT.MCP_LIST).toBeGreaterThan(0);
    expect(TIMEOUT.OPENSPEC_LIST).toBeGreaterThan(0);
    expect(TIMEOUT.NPM_PACK).toBeGreaterThan(0);
    expect(TIMEOUT.NAVIGATION).toBeGreaterThan(0);
    expect(TIMEOUT.BROWSER_LAUNCH).toBeGreaterThan(0);
  });

  it("has reasonable timeout values (not too high)", () => {
    expect(TIMEOUT.MCP_LIST).toBeLessThanOrEqual(60000);
    expect(TIMEOUT.OPENSPEC_LIST).toBeLessThanOrEqual(60000);
    expect(TIMEOUT.NPM_PACK).toBeLessThanOrEqual(60000);
    expect(TIMEOUT.NAVIGATION).toBeLessThanOrEqual(60000);
    expect(TIMEOUT.BROWSER_LAUNCH).toBeLessThanOrEqual(120000);
  });
});
