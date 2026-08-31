import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "fs";
import { tmpdir } from "os";
import { join } from "path";

// init shells `npx openspec --version`, `node --version`, `npm --version`
// during prerequisites — stub execFileSync so hermetic runs don't depend on PATH.
vi.mock("child_process", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("child_process")>();
  return {
    ...actual,
    execFileSync: vi.fn((file: string, args: string[]) => {
      if (file === "npx" && args[0] === "openspec") return "1.11.0";
      if (file === "node") return "v22.0.0";
      if (file === "npm") return "10.0.0";
      throw new Error(`unexpected execFileSync: ${file}`);
    }),
  };
});

import { init } from "../../src/commands/init.js";

const CURSOR_COMMAND = join(".cursor", "commands", "opsx-e2e.md");
const CURSOR_SKILL = join(".cursor", "skills", "opsx-e2e", "SKILL.md");

describe("init deselect-removal: cursor deselected and confirmed", () => {
  let tmpRoot: string;
  let cwdSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), "ospw-pw-deselect-"));
    mkdirSync(join(tmpRoot, "openspec"), { recursive: true });
    // Detect claude + cursor; both carry existing openspec-pw artifacts
    mkdirSync(join(tmpRoot, ".claude"), { recursive: true });
    mkdirSync(join(tmpRoot, ".claude", "commands", "opsx"), { recursive: true });
    writeFileSync(join(tmpRoot, ".claude", "commands", "opsx", "e2e.md"), "cmd");
    mkdirSync(join(tmpRoot, ".cursor", "commands"), { recursive: true });
    writeFileSync(join(tmpRoot, CURSOR_COMMAND), "cmd");
    mkdirSync(join(tmpRoot, ".cursor", "skills", "opsx-e2e"), { recursive: true });
    writeFileSync(join(tmpRoot, CURSOR_SKILL), "skill");
    writeFileSync(
      join(tmpRoot, ".cursor", "mcp.json"),
      JSON.stringify({
        mcpServers: { "playwright-test": { command: "npx", args: ["p"] } },
      }),
    );
    // Shared AGENTS.md block installed by an earlier full init
    writeFileSync(
      join(tmpRoot, "AGENTS.md"),
      "user content\n\n<!-- OPENSPEC-PW:START -->\nstandards\n<!-- OPENSPEC-PW:END -->\n",
    );
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tmpRoot);
  });

  afterEach(() => {
    cwdSpy.mockRestore();
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("removes deselected cursor artifacts + MCP entry, keeps claude and the shared AGENTS.md block", async () => {
    const confirms: string[] = [];
    await init(
      { mcp: false },
      {
        isTTY: true,
        prompt: async () => ["claude"], // deselect cursor
        confirm: async (message: string) => {
          confirms.push(message);
          return true;
        },
      },
    );

    expect(confirms).toHaveLength(1);
    // Cursor products are gone
    expect(existsSync(join(tmpRoot, CURSOR_COMMAND))).toBe(false);
    expect(existsSync(join(tmpRoot, CURSOR_SKILL))).toBe(false);
    const mcp = JSON.parse(readFileSync(join(tmpRoot, ".cursor", "mcp.json"), "utf-8"));
    expect(mcp.mcpServers["playwright-test"]).toBeUndefined();
    // Claude (selected) is untouched
    expect(existsSync(join(tmpRoot, ".claude", "commands", "opsx", "e2e.md"))).toBe(true);
    // Shared AGENTS.md block survives a partial cancellation — the marker
    // territory and the user's own content are both still there (the block
    // body is re-written by the install phase for the selected editor, so
    // don't assert the pre-run body text).
    const agentsAfter = readFileSync(join(tmpRoot, "AGENTS.md"), "utf-8");
    expect(agentsAfter).toContain("user content");
    expect(agentsAfter).toContain("OPENSPEC-PW:START");
  });

  it("confirmation declined → old skip semantics, nothing removed, no error", async () => {
    await init(
      { mcp: false },
      {
        isTTY: true,
        prompt: async () => ["claude"],
        confirm: async () => false,
      },
    );

    expect(existsSync(join(tmpRoot, CURSOR_COMMAND))).toBe(true);
    expect(existsSync(join(tmpRoot, CURSOR_SKILL))).toBe(true);
    const mcp = JSON.parse(readFileSync(join(tmpRoot, ".cursor", "mcp.json"), "utf-8"));
    expect(mcp.mcpServers["playwright-test"]).toBeDefined();
  });

  it("empty selection + shared AGENTS.md block → block joins the confirm list and is removed on agree", async () => {
    let sawPrompt = false;
    await init(
      { mcp: false },
      {
        isTTY: true,
        prompt: async () => {
          sawPrompt = true;
          return [];
        },
        confirm: async () => true,
      },
    );

    expect(sawPrompt).toBe(true);
    expect(readFileSync(join(tmpRoot, "AGENTS.md"), "utf-8")).not.toContain("standards");
    expect(readFileSync(join(tmpRoot, "AGENTS.md"), "utf-8")).toContain("user content");
  });

  it("per-editor artifacts gone but shared block present → still asks, removal happens", async () => {
    // Simulate hand-deleted per-editor artifacts: only dirs remain
    rmSync(join(tmpRoot, CURSOR_COMMAND));
    rmSync(join(tmpRoot, CURSOR_SKILL));
    rmSync(join(tmpRoot, ".cursor", "mcp.json"));
    rmSync(join(tmpRoot, ".claude", "commands", "opsx", "e2e.md"), { force: true });

    const confirms: string[] = [];
    await init(
      { mcp: false },
      {
        isTTY: true,
        prompt: async () => [],
        confirm: async (message: string) => {
          confirms.push(message);
          return true;
        },
      },
    );

    expect(confirms).toHaveLength(1);
    expect(readFileSync(join(tmpRoot, "AGENTS.md"), "utf-8")).not.toContain("standards");
  });

  it("per-editor enumeration empty and no shared block → no confirm at all", async () => {
    rmSync(join(tmpRoot, CURSOR_COMMAND));
    rmSync(join(tmpRoot, CURSOR_SKILL));
    rmSync(join(tmpRoot, ".cursor", "mcp.json"));
    rmSync(join(tmpRoot, ".claude", "commands", "opsx", "e2e.md"), { force: true });

    let confirmCalls = 0;
    let removalAnnounced = false;
    const logSpy = vi.spyOn(console, "log").mockImplementation((msg?: unknown) => {
      if (String(msg).includes("Removing Deselected")) removalAnnounced = true;
    });
    try {
      await init(
        { mcp: false },
        {
          isTTY: true,
          prompt: async () => ["claude"],
          confirm: async () => {
            confirmCalls++;
            return true;
          },
        },
      );
    } finally {
      logSpy.mockRestore();
    }
    expect(removalAnnounced).toBe(false);
    expect(confirmCalls).toBe(0);
  });

  it("claude deselected → CLAUDE.md wrapper removed; symlinked CLAUDE.md skipped", async () => {
    // Fresh dir with claude deselected instead
    writeFileSync(
      join(tmpRoot, "CLAUDE.md"),
      "# Title\n\n<!-- OPENSPEC-PW:START -->\nwrapper\n<!-- OPENSPEC-PW:END -->\n",
    );
    await init(
      { mcp: false },
      {
        isTTY: true,
        prompt: async () => ["cursor"],
        confirm: async () => true,
      },
    );
    const after = readFileSync(join(tmpRoot, "CLAUDE.md"), "utf-8");
    expect(after).toContain("# Title");
    expect(after).not.toContain("wrapper");

    // Now the symlink case: CLAUDE.md → AGENTS.md. The run rewrites the
    // AGENTS.md block for the selected editor, but never writes a wrapper
    // THROUGH the symlink — CLAUDE.md must still be a symlink afterwards.
    rmSync(join(tmpRoot, "CLAUDE.md"));
    writeFileSync(join(tmpRoot, "AGENTS.md"), "shared standards\n");
    symlinkSync(join(tmpRoot, "AGENTS.md"), join(tmpRoot, "CLAUDE.md"));
    await init(
      { mcp: false },
      {
        isTTY: true,
        prompt: async () => ["cursor"],
        confirm: async () => true,
      },
    );
    const { lstatSync } = await import("fs");
    expect(lstatSync(join(tmpRoot, "CLAUDE.md")).isSymbolicLink()).toBe(true);
    expect(readFileSync(join(tmpRoot, "AGENTS.md"), "utf-8")).toContain("shared standards");
    expect(readFileSync(join(tmpRoot, "AGENTS.md"), "utf-8")).toContain("OPENSPEC-PW:START");
  });

  it("--tools explicitly lists selections → no removal of unlisted editors", async () => {
    await init({ mcp: false, tools: "claude" }, { isTTY: true });

    expect(existsSync(join(tmpRoot, CURSOR_COMMAND))).toBe(true);
    expect(existsSync(join(tmpRoot, CURSOR_SKILL))).toBe(true);
    const mcp = JSON.parse(readFileSync(join(tmpRoot, ".cursor", "mcp.json"), "utf-8"));
    expect(mcp.mcpServers["playwright-test"]).toBeDefined();
  });
});

describe("init deselect-removal: re-init pre-select behavior", () => {
  let tmpRoot: string;
  let cwdSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), "ospw-pw-deselect-converge-"));
    mkdirSync(join(tmpRoot, "openspec"), { recursive: true });
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tmpRoot);
  });

  afterEach(() => {
    cwdSpy.mockRestore();
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("converges: dir with only openspec-pw products is cleaned away → not pre-selected next run", async () => {
    mkdirSync(join(tmpRoot, ".cursor", "commands"), { recursive: true });
    writeFileSync(join(tmpRoot, CURSOR_COMMAND), "cmd");
    mkdirSync(join(tmpRoot, ".claude"), { recursive: true });

    // Run 1: deselect cursor, confirm removal
    await init(
      { mcp: false },
      {
        isTTY: true,
        prompt: async () => ["claude"],
        confirm: async () => true,
      },
    );

    // Run 2: cursor's marker dir was cascade-deleted → no longer detected
    const detectedNext = new Set<string>();
    await init(
      { mcp: false },
      {
        isTTY: true,
        prompt: async (_all, detected) => {
          detected.forEach((id) => detectedNext.add(id));
          return ["claude"];
        },
        confirm: async () => true,
      },
    );
    expect(detectedNext.has("cursor")).toBe(false);
  });

  it("converges despite residue: installed-MCP dir kept (rewritten mcp.json) → no longer pre-selected", async () => {
    mkdirSync(join(tmpRoot, ".cursor", "commands"), { recursive: true });
    writeFileSync(join(tmpRoot, CURSOR_COMMAND), "cmd");
    writeFileSync(
      join(tmpRoot, ".cursor", "mcp.json"),
      JSON.stringify({
        mcpServers: { "playwright-test": { command: "npx", args: ["p"] } },
      }),
    );
    mkdirSync(join(tmpRoot, ".claude"), { recursive: true });

    await init(
      { mcp: false },
      {
        isTTY: true,
        prompt: async () => ["claude"],
        confirm: async () => true,
      },
    );

    // entry removed but the rewritten mcp.json keeps .cursor/ alive on disk —
    // directory residue no longer drives the pre-select (artifact manifest)
    expect(existsSync(join(tmpRoot, ".cursor", "mcp.json"))).toBe(true);
    const detectedNext = new Set<string>();
    await init(
      { mcp: false },
      {
        isTTY: true,
        prompt: async (_all, preselected) => {
          [...preselected].forEach((id) => detectedNext.add(id));
          return ["claude"];
        },
        confirm: async () => true,
      },
    );
    expect(detectedNext.has("cursor")).toBe(false);
  });

  it("pi global home signal: project removal runs, ~/.pi left untouched", async () => {
    const home = mkdtempSync(join(tmpdir(), "ospw-pw-deselect-home-"));
    mkdirSync(join(home, ".pi", "agent"), { recursive: true });
    mkdirSync(join(tmpRoot, ".pi", "prompts"), { recursive: true });
    const piCommand = join(tmpRoot, ".pi", "prompts", "opsx-e2e.md");
    writeFileSync(piCommand, "cmd");
    mkdirSync(join(tmpRoot, ".claude"), { recursive: true });

    try {
      const confirms: string[] = [];
      await init(
        { mcp: false },
        {
          isTTY: true,
          homeDir: home,
          prompt: async () => ["claude"],
          confirm: async (m: string) => {
            confirms.push(m);
            return true;
          },
        },
      );
      expect(confirms).toHaveLength(1);
      // Project-side product removed
      expect(existsSync(piCommand)).toBe(false);
      expect(existsSync(join(tmpRoot, ".pi", "prompts", "opsx-e2e.md"))).toBe(false);
      // Global home dir untouched
      expect(existsSync(join(home, ".pi", "agent"))).toBe(true);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});