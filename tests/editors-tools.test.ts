import { describe, it, expect } from "vitest";
import { resolveToolsArg } from "../src/commands/editors.js";

// ─── resolveToolsArg (--tools flag parsing) ──────────────────────────────

describe("resolveToolsArg", () => {
  const ALL = ["claude", "opencode", "cline", "cursor", "pi", "omp", "dsh"];

  it("returns null when no --tools flag was provided", () => {
    expect(resolveToolsArg(undefined)).toBeNull();
  });

  it("resolves 'all' to every registered editor", () => {
    expect(resolveToolsArg("all")).toEqual(ALL);
  });

  it("is case-insensitive for 'all'", () => {
    expect(resolveToolsArg("ALL")).toEqual(ALL);
  });

  it("resolves 'none' to an empty list", () => {
    expect(resolveToolsArg("none")).toEqual([]);
  });

  it("resolves a comma-separated subset", () => {
    expect(resolveToolsArg("claude,cursor")).toEqual(["claude", "cursor"]);
  });

  it("accepts the oh-my-pi alias for omp", () => {
    expect(resolveToolsArg("oh-my-pi")).toEqual(["omp"]);
    expect(resolveToolsArg("Claude,OH-MY-PI")).toEqual(["claude", "omp"]);
  });

  it("trims surrounding whitespace around ids", () => {
    expect(resolveToolsArg(" claude , cursor ")).toEqual(["claude", "cursor"]);
  });

  it("is case-insensitive for specific ids", () => {
    expect(resolveToolsArg("CLAUDE,OpenCode")).toEqual(["claude", "opencode"]);
  });

  it("throws on an empty value", () => {
    expect(() => resolveToolsArg("")).toThrow(/requires a value/);
    expect(() => resolveToolsArg("   ")).toThrow(/requires a value/);
  });

  it("throws when the list contains no ids", () => {
    expect(() => resolveToolsArg(",")).toThrow(/at least one editor id/);
  });

  it("throws when unknown ids are present, listing valid values", () => {
    expect(() => resolveToolsArg("claude,unknown-editor")).toThrow(
      /unknown-editor/,
    );
    expect(() => resolveToolsArg("claude,unknown-editor")).toThrow(
      /Available values: all, none, claude, opencode/,
    );
  });

  it("throws when reserved values are mixed with specific ids", () => {
    expect(() => resolveToolsArg("all,claude")).toThrow(
      /Cannot combine reserved values/,
    );
    expect(() => resolveToolsArg("none,opencode")).toThrow(
      /Cannot combine reserved values/,
    );
  });

  it("deduplicates repeated ids preserving first-occurrence order", () => {
    expect(resolveToolsArg("claude,claude,cursor,claude")).toEqual([
      "claude",
      "cursor",
    ]);
  });
});
