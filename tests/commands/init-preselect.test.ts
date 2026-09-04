import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "fs";
import { tmpdir } from "os";
import { join } from "path";

// init shells `npx openspec --version`, `node --version`, `npm --version`
// during prerequisites — stub execFileSync so hermetic runs don't depend on PATH.
vi.mock("child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("child_process")>();
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
import {
  isEditorConfigured,
  anyEditorConfigured,
  agentsFileHasMarkers,
} from "../../src/commands/editors.js";
import {
  claudeAdapter,
  cursorAdapter,
  piAdapter,
  opencodeAdapter,
} from "../../src/commands/editors.js";

const CURSOR_COMMAND = join(".cursor", "commands", "opsx-e2e.md");
const CLAUDE_COMMAND = join(".claude", "commands", "opsx", "e2e.md");

describe("configured predicates (isEditorConfigured)", () => {
  let projectRoot: string;

  beforeEach(() => {
    projectRoot = mkdtempSync(join(tmpdir(), "ospw-pw-configured-"));
  });

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it("configured when the e2e command artifact exists", () => {
    mkdirSync(join(projectRoot, ".claude", "commands", "opsx"), { recursive: true });
    writeFileSync(join(projectRoot, CLAUDE_COMMAND), "cmd");
    expect(isEditorConfigured(claudeAdapter, projectRoot)).toBe(true);
  });

  it("not configured for the official CLI's opsx-* files (foreign territory)", () => {
    mkdirSync(join(projectRoot, ".opencode", "commands"), { recursive: true });
    writeFileSync(join(projectRoot, ".opencode", "commands", "opsx-apply.md"), "official");
    writeFileSync(join(projectRoot, ".opencode", "commands", "opsx-new.md"), "x");
    expect(isEditorConfigured(opencodeAdapter, projectRoot)).toBe(false);
  });

  it("global home signal never confers configured status (pi)", () => {
    // Pi has supportsMcp=false and no project dir — only ~/.pi/agent exists,
    // which hasCommandArtifacts/isEditorConfigured must ignore.
    expect(isEditorConfigured(piAdapter, projectRoot)).toBe(false);
  });

  it("legacy skill directory counts as configured (claude only)", () => {
    mkdirSync(join(projectRoot, ".claude", "skills", "openspec-e2e"), { recursive: true });
    expect(isEditorConfigured(claudeAdapter, projectRoot)).toBe(true);
    expect(isEditorConfigured(cursorAdapter, projectRoot)).toBe(false);
  });

  it("openspec-pw MCP entry counts as configured", () => {
    mkdirSync(join(projectRoot, ".cursor"), { recursive: true });
    writeFileSync(
      join(projectRoot, ".cursor", "mcp.json"),
      JSON.stringify({ mcpServers: { "playwright-test": { command: "npx", args: [] } } }),
    );
    expect(isEditorConfigured(cursorAdapter, projectRoot)).toBe(true);
  });

  it("anyEditorConfigured + agentsFileHasMarkers", () => {
    expect(anyEditorConfigured([claudeAdapter, cursorAdapter], projectRoot)).toBe(false);
    expect(agentsFileHasMarkers(projectRoot)).toBe(false);
    writeFileSync(
      join(projectRoot, "AGENTS.md"),
      "user\n\n<!-- OPENSPEC-PW:START -->\ns\n<!-- OPENSPEC-PW:END -->\n",
    );
    // Marker alone is state, but not editor-level configuration
    expect(agentsFileHasMarkers(projectRoot)).toBe(true);
    expect(anyEditorConfigured([claudeAdapter, cursorAdapter], projectRoot)).toBe(false);
  });

  it("legacy namespace counts only with our migration signature (official block ≠ ours)", () => {
    // Official openspec CLI init block: bare legacy markers, no signature
    writeFileSync(
      join(projectRoot, "AGENTS.md"),
      "official\n\n<!-- OPENSPEC:START -->\nofficial rules\n<!-- OPENSPEC:END -->\n",
    );
    expect(agentsFileHasMarkers(projectRoot)).toBe(false);

    // Our pre-migration block carries the Employee-Grade Standards body
    writeFileSync(
      join(projectRoot, "AGENTS.md"),
      "ours\n\n<!-- OPENSPEC:START -->\n## Employee-Grade Standards\ncontent\n<!-- OPENSPEC:END -->\n",
    );
    expect(agentsFileHasMarkers(projectRoot)).toBe(true);
  });
});

describe("init pre-select: artifact manifest tier", () => {
  let tmpRoot: string;
  let cwdSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), "ospw-pw-preselect-"));
    mkdirSync(join(tmpRoot, "openspec"), { recursive: true });
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tmpRoot);
  });

  afterEach(() => {
    cwdSpy.mockRestore();
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("only configured editors are pre-selected when some products exist", async () => {
    // Four detected, but only claude carries openspec-pw products
    mkdirSync(join(tmpRoot, ".claude"), { recursive: true });
    mkdirSync(join(tmpRoot, ".claude", "commands", "opsx"), { recursive: true });
    writeFileSync(join(tmpRoot, CLAUDE_COMMAND), "cmd");
    mkdirSync(join(tmpRoot, ".opencode", "commands"), { recursive: true });
    writeFileSync(join(tmpRoot, ".opencode", "commands", "opsx-apply.md"), "official");
    mkdirSync(join(tmpRoot, ".cursor"), { recursive: true });

    let preselected: string[] = [];
    let names: string[] = [];
    await init(
      { mcp: false },
      {
        isTTY: true,
        prompt: async (allEditors, pre, configured) => {
          preselected = [...pre];
          names = allEditors
            .map((a) => configured.has(a.id) ? `${a.displayName} (configured)` : a.displayName);
          return ["claude"];
        },
        confirm: async () => true,
      },
    );

    expect(preselected).toEqual(["claude"]);
    expect(names).toContain("Claude Code (configured)");
    expect(names).not.toContain("Cursor (configured)");
  });

  it("first-run bypass: zero openspec-pw state → project-level detected pre-selected, no suffix", async () => {
    // Project marker dirs only; empty injected home so global pi/omp stay silent
    const home = mkdtempSync(join(tmpdir(), "ospw-preselect-home-"));
    mkdirSync(join(tmpRoot, ".claude"), { recursive: true });
    mkdirSync(join(tmpRoot, ".cursor"), { recursive: true });

    let preselected: string[] = [];
    let names: string[] = [];
    try {
      await init(
        { mcp: false },
        {
          isTTY: true,
          homeDir: home,
          prompt: async (allEditors, pre, configured) => {
            preselected = [...pre];
            names = allEditors.map((a) => (configured.has(a.id) ? "(configured)" : ""));
            return ["claude"];
          },
          confirm: async () => true,
        },
      );
    } finally {
      rmSync(home, { recursive: true, force: true });
    }

    expect(preselected).toEqual(["claude", "cursor"]);
    expect(names.every((n) => n === "")).toBe(true); // no (configured) suffix in bypass tier
  });

  it("first-run: globally-installed editors are listed unchecked with a hint", async () => {
    // Machine has ~/.pi/agent + ~/.omp/agent; project has only .claude/ →
    // pre-select is claude only; pi/omp listed unchecked with the gray hint.
    const home = mkdtempSync(join(tmpdir(), "ospw-preselect-home-"));
    mkdirSync(join(home, ".pi", "agent"), { recursive: true });
    mkdirSync(join(home, ".omp", "agent"), { recursive: true });
    mkdirSync(join(tmpRoot, ".claude"), { recursive: true });

    const logs: string[] = [];
    const logSpy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      logs.push(args.join(" "));
    });
    try {
      let preselected: string[] = [];
      await init(
        { mcp: false },
        {
          isTTY: true,
          homeDir: home,
          prompt: async (_a, pre) => {
            preselected = [...pre];
            return ["claude"];
          },
          confirm: async () => true,
        },
      );
      expect(preselected).toEqual(["claude"]);
      const gray = logs.filter((l) => l.includes("Globally detected, not pre-selected"));
      expect(gray).toHaveLength(1);
      expect(gray[0]).toContain("pi, omp");
    } finally {
      logSpy.mockRestore();
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("first-run: root CLAUDE.md alone pre-checks claude (intent-file signal)", async () => {
    const home = mkdtempSync(join(tmpdir(), "ospw-preselect-home-"));
    writeFileSync(join(tmpRoot, "CLAUDE.md"), "# project memory");

    try {
      let preselected: string[] = [];
      await init(
        { mcp: false },
        {
          isTTY: true,
          homeDir: home,
          prompt: async (_a, pre) => {
            preselected = [...pre];
            return ["claude"];
          },
          confirm: async () => true,
        },
      );
      expect(preselected).toContain("claude");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("first-run: cursor and opencode intent files pre-check their editors", async () => {
    const home = mkdtempSync(join(tmpdir(), "ospw-preselect-home-"));
    const cases: Array<[string, string, string]> = [
      [".cursorrules", "cursor", "legacy cursor rules"],
      ["opencode.json", "opencode", "opencode config"],
      ["opencode.jsonc", "opencode", "opencode jsonc config"],
    ];
    try {
      for (const [file, editorId, label] of cases) {
        rmSync(tmpRoot, { recursive: true, force: true });
        mkdirSync(join(tmpRoot, "openspec"), { recursive: true });
        writeFileSync(join(tmpRoot, file), `# ${label}`);
        let preselected: string[] = [];
        await init(
          { mcp: false },
          {
            isTTY: true,
            homeDir: home,
            prompt: async (_a, pre) => {
              preselected = [...pre];
              return ["claude"];
            },
            confirm: async () => true,
          },
        );
        expect(preselected, `${file} should pre-check ${editorId}`).toContain(editorId);
        expect(preselected).not.toContain("claude"); // no other intent file present
      }
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("intent files are pre-select-only: non-TTY with only root CLAUDE.md configures nothing", async () => {
    writeFileSync(join(tmpRoot, "CLAUDE.md"), "# project memory");

    await expect(
      init({ mcp: false }, { isTTY: false }),
    ).rejects.toThrow(/--tools/);
    // No editor received anything: no command file, no project rules write.
    expect(existsSync(join(tmpRoot, ".claude", "commands", "opsx", "e2e.md"))).toBe(false);
  });

  it("stateful project prints 'Configured (pre-select): <ids>'", async () => {
    mkdirSync(join(tmpRoot, ".claude", "commands", "opsx"), { recursive: true });
    writeFileSync(join(tmpRoot, CLAUDE_COMMAND), "cmd");

    const logs: string[] = [];
    const logSpy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      logs.push(args.join(" "));
    });
    try {
      await init(
        { mcp: false },
        { isTTY: true, prompt: async () => ["claude"], confirm: async () => true },
      );
    } finally {
      logSpy.mockRestore();
    }
    expect(logs.some((l) => l.includes("Configured (pre-select): claude"))).toBe(true);
    expect(logs.some((l) => l.includes("Detected"))).toBe(false);
  });

  it("marker-block-only state prints 'Configured: none'", async () => {
    // AGENTS.md marker block present, zero configured editors (products
    // hand-deleted) — the pre-select hint fork reports Configured: none.
    writeFileSync(
      join(tmpRoot, "AGENTS.md"),
      "ours\n\n<!-- OPENSPEC-PW:START -->\nstandards\n<!-- OPENSPEC-PW:END -->\n",
    );

    const logs: string[] = [];
    const logSpy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      logs.push(args.join(" "));
    });
    try {
      await init(
        { mcp: false },
        { isTTY: true, prompt: async () => ["claude"], confirm: async () => true },
      );
    } finally {
      logSpy.mockRestore();
    }
    expect(logs.some((l) => l.includes("Configured: none"))).toBe(true);
  });

  it("after deselect-removal + confirm → removed editor no longer pre-selected", async () => {
    mkdirSync(join(tmpRoot, ".cursor", "commands"), { recursive: true });
    writeFileSync(join(tmpRoot, CURSOR_COMMAND), "cmd");
    mkdirSync(join(tmpRoot, ".cursor"), { recursive: true });
    writeFileSync(
      join(tmpRoot, ".cursor", "mcp.json"),
      JSON.stringify({ mcpServers: { "playwright-test": { command: "npx", args: ["p"] } } }),
    );
    mkdirSync(join(tmpRoot, ".claude"), { recursive: true });

    await init({ mcp: false }, { isTTY: true, prompt: async () => ["claude"], confirm: async () => true });

    let preselectedNext: string[] = [];
    await init({ mcp: false }, { isTTY: true, prompt: async (_a, pre) => { preselectedNext = [...pre]; return ["claude"]; }, confirm: async () => true });
    expect(preselectedNext).not.toContain("cursor");
  });

  it("pi's global home signal never enters the pre-select once the project has state", async () => {
    // personal-resume scenario: ~/.pi/agent exists globally, pi carries zero
    // project-side products, claude is configured → pre-select = claude only
    const home = mkdtempSync(join(tmpdir(), "ospw-preselect-home-"));
    mkdirSync(join(home, ".pi", "agent"), { recursive: true });
    mkdirSync(join(tmpRoot, ".claude"), { recursive: true });
    mkdirSync(join(tmpRoot, ".claude", "commands", "opsx"), { recursive: true });
    writeFileSync(join(tmpRoot, CLAUDE_COMMAND), "cmd");

    try {
      let preselected: string[] = [];
      const logs: string[] = [];
      const logSpy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
        logs.push(args.join(" "));
      });
      await init(
        { mcp: false },
        {
          isTTY: true,
          homeDir: home,
          prompt: async (_a, pre) => {
            preselected = [...pre];
            return ["claude"];
          },
          confirm: async () => true,
        },
      );
      logSpy.mockRestore();
      expect(preselected).not.toContain("pi");
      expect(preselected).toContain("claude");
      // Manifest tier never prints the global hint (first-run tier only).
      expect(logs.some((l) => l.includes("Globally detected, not pre-selected"))).toBe(false);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("full deselect + confirm removes the shared marker block → next init resets to first-run semantics", async () => {
    // A foreign-content editor dir: detected on the bypass tier, never "configured"
    mkdirSync(join(tmpRoot, ".cursor"), { recursive: true });
    writeFileSync(join(tmpRoot, ".cursor", "settings.json"), "{}");
    mkdirSync(join(tmpRoot, ".claude", "commands", "opsx"), { recursive: true });
    writeFileSync(join(tmpRoot, CLAUDE_COMMAND), "cmd");
    writeFileSync(
      join(tmpRoot, "AGENTS.md"),
      "user content\n\n<!-- OPENSPEC-PW:START -->\ns\n<!-- OPENSPEC-PW:END -->\n",
    );

    await init({ mcp: false }, { isTTY: true, prompt: async () => [], confirm: async () => true });
    // Full-cancel removal cleared products AND the shared block
    expect(agentsFileHasMarkers(tmpRoot)).toBe(false);

    let preselectedNext: string[] = [];
    await init({ mcp: false }, { isTTY: true, prompt: async (_a, pre) => { preselectedNext = [...pre]; return []; }, confirm: async () => true });
    // Zero state left on disk = indistinguishable from first run: bypass re-fires
    // and pre-checks every detected editor (incl. the foreign-content cursor)
    expect(preselectedNext).toContain("cursor");
  });

  it("hand-deleted products with marker block remaining → no bypass (pre-select empty)", async () => {
    mkdirSync(join(tmpRoot, ".claude", "commands", "opsx"), { recursive: true });
    writeFileSync(join(tmpRoot, CLAUDE_COMMAND), "cmd");
    writeFileSync(
      join(tmpRoot, "AGENTS.md"),
      "user content\n\n<!-- OPENSPEC-PW:START -->\ns\n<!-- OPENSPEC-PW:END -->\n",
    );
    // User hand-removes the product; marker survives
    rmSync(join(tmpRoot, CLAUDE_COMMAND));
    expect(existsSync(join(tmpRoot, CLAUDE_COMMAND))).toBe(false);

    let preselected: string[] = [];
    await init(
      { mcp: false },
      {
        isTTY: true,
        prompt: async (_a, pre, _c) => { preselected = [...pre]; return []; },
        confirm: async () => true,
      },
    );
    // Pre-select (computed before any removal): no bypass, no configured editors
    expect(preselected).toEqual([]);
    // The empty selection + confirm is a full-cancel run — the shared block
    // is removed as part of it (v0.3.81 semantics), so the project fully resets
    expect(agentsFileHasMarkers(tmpRoot)).toBe(false);
  });
});