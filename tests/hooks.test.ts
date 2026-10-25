import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  buildHookEntry,
  installStopHook,
  isOwnHook,
  mergeStopHook,
  readSettings,
  removeStopHook,
  uninstallStopHook,
  type ClaudeSettings,
} from "../src/commands/hooks.js";

const OWN = (s: ClaudeSettings) =>
  (s.hooks?.Stop ?? []).flatMap((g) => g.hooks ?? []).filter(isOwnHook);

describe("hook entry", () => {
  it("embeds the static tier and a finite timeout", () => {
    const entry = buildHookEntry("static");
    expect(entry.command).toContain("openspec-pw gate --hook");
    expect(entry.command).toContain("--only validate,lint,typecheck,test");
    expect(entry.timeout).toBeGreaterThan(0);
  });

  it("adds flake and e2e in the full tier", () => {
    const entry = buildHookEntry("full");
    expect(entry.command).toContain("flake,e2e");
    expect(entry.timeout).toBeGreaterThan(buildHookEntry("static").timeout ?? 0);
  });
});

describe("mergeStopHook", () => {
  it("creates the Stop array from an empty file", () => {
    const merged = mergeStopHook({}, buildHookEntry("static"));
    expect(merged.hooks?.Stop).toHaveLength(1);
    expect(OWN(merged)).toHaveLength(1);
  });

  it("is idempotent", () => {
    const once = mergeStopHook({}, buildHookEntry("static"));
    const twice = mergeStopHook(once, buildHookEntry("static"));
    expect(OWN(twice)).toHaveLength(1);
    expect(twice.hooks?.Stop).toHaveLength(1);
  });

  it("upgrades the tier in place instead of adding a second entry", () => {
    const once = mergeStopHook({}, buildHookEntry("static"));
    const upgraded = mergeStopHook(once, buildHookEntry("full"));
    expect(OWN(upgraded)).toHaveLength(1);
    expect(OWN(upgraded)[0].command).toContain("flake,e2e");
  });

  it("keeps the user's own Stop hook and other events", () => {
    const user: ClaudeSettings = {
      permissions: { allow: ["Read"] },
      hooks: {
        Stop: [{ hooks: [{ type: "command", command: "my-own-check" }] }],
        UserPromptSubmit: [{ hooks: [{ type: "command", command: "prompt-hook" }] }],
      },
    };
    const merged = mergeStopHook(user, buildHookEntry("static"));
    const commands = (merged.hooks?.Stop ?? []).flatMap((g) =>
      g.hooks.map((h) => h.command),
    );
    expect(commands).toContain("my-own-check");
    expect(commands).toContain("openspec-pw gate --hook --only validate,lint,typecheck,test");
    expect(merged.hooks?.UserPromptSubmit).toEqual(user.hooks?.UserPromptSubmit);
    expect(merged.permissions).toEqual({ allow: ["Read"] });
  });

  it("does not add a matcher (Stop ignores it)", () => {
    const merged = mergeStopHook({}, buildHookEntry("static"));
    expect(merged.hooks?.Stop?.[0].matcher).toBeUndefined();
  });
});

describe("removeStopHook", () => {
  it("removes only our entry and keeps the user's", () => {
    const settings = mergeStopHook(
      {
        hooks: {
          Stop: [{ hooks: [{ type: "command", command: "my-own-check" }] }],
        },
      },
      buildHookEntry("static"),
    );
    const { settings: next, removed } = removeStopHook(settings);
    expect(removed).toBe(true);
    const commands = (next.hooks?.Stop ?? []).flatMap((g) => g.hooks.map((h) => h.command));
    expect(commands).toEqual(["my-own-check"]);
  });

  it("deletes hooks.Stop when it becomes empty", () => {
    const settings = mergeStopHook({}, buildHookEntry("static"));
    const { settings: next, removed } = removeStopHook(settings);
    expect(removed).toBe(true);
    expect(next.hooks?.Stop).toBeUndefined();
  });

  it("deletes the hooks key entirely when nothing is left", () => {
    const settings = mergeStopHook({}, buildHookEntry("static"));
    const { settings: next } = removeStopHook(settings);
    expect(next.hooks).toBeUndefined();
    expect(next).toEqual({});
  });

  it("reports nothing removed on a clean file", () => {
    const { removed } = removeStopHook({ permissions: { allow: [] } });
    expect(removed).toBe(false);
  });
});

describe("install / uninstall on disk", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "hooks-test-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("writes .claude/settings.json and round-trips", () => {
    const result = installStopHook(root, "static");
    expect("path" in result && existsSync(result.path)).toBe(true);
    const onDisk = JSON.parse(
      readFileSync(join(root, ".claude", "settings.json"), "utf-8"),
    );
    expect(OWN(onDisk)).toHaveLength(1);

    const removed = uninstallStopHook(root);
    expect("removed" in removed && removed.removed).toBe(true);
    const after = JSON.parse(
      readFileSync(join(root, ".claude", "settings.json"), "utf-8"),
    );
    expect(after).toEqual({});
  });

  it("preserves the existing codegraph-style UserPromptSubmit hook", () => {
    mkdirSync(join(root, ".claude"), { recursive: true });
    const existing = {
      permissions: { allow: ["mcp__codegraph__*"] },
      hooks: {
        UserPromptSubmit: [{ hooks: [{ type: "command", command: "codegraph prompt-hook" }] }],
      },
    };
    writeFileSync(
      join(root, ".claude", "settings.json"),
      JSON.stringify(existing, null, 2),
    );

    installStopHook(root, "static");
    const onDisk = JSON.parse(
      readFileSync(join(root, ".claude", "settings.json"), "utf-8"),
    );
    expect(onDisk.permissions).toEqual(existing.permissions);
    expect(onDisk.hooks.UserPromptSubmit).toEqual(existing.hooks.UserPromptSubmit);
  });

  it("aborts instead of overwriting a malformed settings file", () => {
    mkdirSync(join(root, ".claude"), { recursive: true });
    const path = join(root, ".claude", "settings.json");
    writeFileSync(path, "{ not json");

    const result = installStopHook(root, "static");
    expect("error" in result).toBe(true);
    expect(readFileSync(path, "utf-8")).toBe("{ not json");
    expect(readSettings(root)).toHaveProperty("error");
  });
});
