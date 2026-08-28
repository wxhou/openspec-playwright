import { describe, it, expect } from "vitest";
import { resolveToolsArg } from "../src/commands/editors.js";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { vi, beforeEach, afterEach } from "vitest";
import {
  detectAdapters,
  detectProjectAdapters,
  hasCommandArtifacts,
  getAllAdapters,
  getAdapter,
} from "../src/commands/editors.js";

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

// ─── detection scopes + write authorization (scope-editor-writes) ────────

describe("detectProjectAdapters (project-scope detection)", () => {
  let tmp: string;
  let fakeHome: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "ospw-pw-scope-"));
    fakeHome = mkdtempSync(join(tmpdir(), "ospw-pw-scope-home-"));
    vi.spyOn(process, "cwd").mockReturnValue(tmp);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(tmp, { recursive: true, force: true });
    rmSync(fakeHome, { recursive: true, force: true });
  });

  it("detectProjectAdapters excludes global-only editors; detectAdapters includes them", () => {
    // omp present only via its global config dir
    mkdirSync(join(fakeHome, ".omp", "agent"), { recursive: true });
    // claude present via project marker dir
    mkdirSync(join(tmp, ".claude"), { recursive: true });

    const anyIds = detectAdapters(tmp, fakeHome).map((a) => a.id);
    expect(anyIds).toContain("omp");
    expect(anyIds).toContain("claude");

    const projectIds = detectProjectAdapters(tmp).map((a) => a.id);
    expect(projectIds).toContain("claude");
    expect(projectIds).not.toContain("omp");
  });
});

describe("hasCommandArtifacts (write authorization)", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "ospw-pw-authz-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("is false for a hand-created marker directory alone (detect is not authorization)", () => {
    mkdirSync(join(tmp, ".cursor"), { recursive: true });
    const cursor = getAdapter("cursor")!;
    expect(existsSync(join(tmp, ".cursor"))).toBe(true);
    expect(hasCommandArtifacts(tmp, cursor)).toBe(false);
  });

  it("is true once the command artifact exists", () => {
    const omp = getAdapter("omp")!;
    mkdirSync(join(tmp, ".omp", "commands"), { recursive: true });
    writeFileSync(join(tmp, ".omp", "commands", "opsx-e2e.md"), "x");
    expect(hasCommandArtifacts(tmp, omp)).toBe(true);
  });

  it("filters the full adapter list down to authorized editors only", () => {
    mkdirSync(join(tmp, ".claude", "commands", "opsx"), { recursive: true });
    writeFileSync(join(tmp, ".claude", "commands", "opsx", "e2e.md"), "x");
    const authorized = getAllAdapters().filter((a) =>
      hasCommandArtifacts(tmp, a),
    );
    expect(authorized.map((a) => a.id)).toEqual(["claude"]);
  });
});
