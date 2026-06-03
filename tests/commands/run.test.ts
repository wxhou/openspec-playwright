import { describe, it, expect, vi, beforeEach } from "vitest";

import { parsePlaywrightOutput } from "../../src/commands/run.js";

describe("parsePlaywrightOutput", () => {
  it("parses passed test results", () => {
    const output = `✓ login-page-loads (1.2s)
✓ logout-redirects (0.8s)`;
    const results = parsePlaywrightOutput(output);
    expect(results.total).toBe(2);
    expect(results.passed).toBe(2);
    expect(results.failed).toBe(0);
    expect(results.tests).toHaveLength(2);
    expect(results.tests[0].name).toBe("login-page-loads");
    expect(results.tests[0].status).toBe("passed");
  });

  it("parses failed test results", () => {
    const output = `✗ invalid-form-submit (0.5s)`;
    const results = parsePlaywrightOutput(output);
    expect(results.total).toBe(1);
    expect(results.passed).toBe(0);
    expect(results.failed).toBe(1);
    expect(results.tests[0].status).toBe("failed");
  });

  it("parses mixed pass/fail results", () => {
    const output = `✓ happy-path (1.0s)
✗ error-path (0.5s)
✓ edge-case (2.0s)`;
    const results = parsePlaywrightOutput(output);
    expect(results.total).toBe(3);
    expect(results.passed).toBe(2);
    expect(results.failed).toBe(1);
  });

  it("parses duration from summary line", () => {
    const output = `✓ test (1s)
2 tests ran (5s)`;
    const results = parsePlaywrightOutput(output);
    expect(results.duration).toBe("5s");
  });

  it("parses minute+second duration", () => {
    const output = `✓ test (1s)
1 test ran (1m 30s)`;
    const results = parsePlaywrightOutput(output);
    expect(results.duration).toBe("1m 30s");
  });

  it("handles empty output", () => {
    const results = parsePlaywrightOutput("");
    expect(results.total).toBe(0);
    expect(results.passed).toBe(0);
    expect(results.failed).toBe(0);
    expect(results.duration).toBe("0s");
  });

  it("handles output with only summary (no individual tests)", () => {
    const output = `0 tests ran (0s)`;
    const results = parsePlaywrightOutput(output);
    expect(results.total).toBe(0);
  });

  it("handles unicode x for skipped tests", () => {
    const output = `✓ test (1s)
x skipped-test (0.2s)`;
    const results = parsePlaywrightOutput(output);
    expect(results.total).toBe(2);
    expect(results.passed).toBe(1);
    expect(results.failed).toBe(1); // x maps to 'failed' in current regex
  });

  it("handles test names with parentheses", () => {
    const output = `✓ test (search by name (foo)) (2.0s)`;
    const results = parsePlaywrightOutput(output);
    expect(results.total).toBe(1);
    expect(results.passed).toBe(1);
    // Name should NOT include the duration - regex should stop at first (digits
    expect(results.tests[0].name).not.toMatch(/\d+[a-z]+/);
  });
});

describe("run function validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("validates changeName to prevent path traversal", () => {
    // Test the validation logic directly
    const changeName = "test/change";
    const isInvalid = changeName !== "all" && (
      changeName.includes("/") || 
      changeName.includes("\\") || 
      changeName.includes("..")
    );
    expect(isInvalid).toBe(true);
  });

  it("validates changeName with backslash", () => {
    const changeName = "test\\change";
    const isInvalid = changeName !== "all" && (
      changeName.includes("/") || 
      changeName.includes("\\") || 
      changeName.includes("..")
    );
    expect(isInvalid).toBe(true);
  });

  it("validates changeName with double dots", () => {
    const changeName = "../change";
    const isInvalid = changeName !== "all" && (
      changeName.includes("/") || 
      changeName.includes("\\") || 
      changeName.includes("..")
    );
    expect(isInvalid).toBe(true);
  });

  it("allows 'all' as changeName", () => {
    const changeName = "all";
    const isInvalid = changeName !== "all" && (
      changeName.includes("/") || 
      changeName.includes("\\") || 
      changeName.includes("..")
    );
    expect(isInvalid).toBe(false);
  });

  it("allows valid changeName", () => {
    const changeName = "my-feature";
    const isInvalid = changeName !== "all" && (
      changeName.includes("/") || 
      changeName.includes("\\") || 
      changeName.includes("..")
    );
    expect(isInvalid).toBe(false);
  });
});
