/**
 * Characterization tests for the editor-adapter contract.
 *
 * These assertions freeze the CURRENT observable behavior of all eight
 * adapters before the contract refactor (see
 * openspec/changes/consolidate-editor-adapter-contract). After the refactor
 * every expectation here must still hold byte-for-byte; if one fails, the
 * refactor changed behavior and must be fixed — do not "update" a snapshot
 * unless the change is a separately reviewed fix.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  buildCommandMeta,
  claudeAdapter,
  clineAdapter,
  codebuddyAdapter,
  cursorAdapter,
  detectAdapters,
  enumerateAdapterArtifacts,
  getAllAdapters,
  installCommand,
  intentFileEditors,
  minimaxAdapter,
  ompAdapter,
  opencodeAdapter,
  piAdapter,
  retainedMcpConfigFiles,
  slashCommandForAdapter,
  type EditorAdapter,
} from "../src/commands/editors.js";

// Fixed command metadata so every formatted artifact is deterministic.
const META = buildCommandMeta(
  "Run /opsx:e2e for the change.\nSee /opsx:propose for planning.\n",
);

const REGISTRATION_ORDER = [
  "claude",
  "opencode",
  "cline",
  "cursor",
  "pi",
  "omp",
  "codebuddy",
  "minimax",
];

const byId = () => new Map(getAllAdapters().map((a) => [a.id, a]));

/**
 * Inventory legacy field: `legacySkillPath` before the contract refactor,
 * `legacyArtifacts` after it. Asserting the semantic list keeps this test
 * stable across the planned field rename.
 */
function legacyPaths(inv: Record<string, unknown>): string[] {
  const list = inv.legacyArtifacts as string[] | undefined;
  if (Array.isArray(list)) return list;
  const single = inv.legacySkillPath as string | null | undefined;
  return single ? [single] : [];
}

let root: string;
let home: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "ospw-contract-"));
  home = mkdtempSync(join(tmpdir(), "ospw-contract-home-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  rmSync(home, { recursive: true, force: true });
});

function projectDir(...segments: string[]): string {
  const dir = join(root, ...segments);
  mkdirSync(dir, { recursive: true });
  return dir;
}

// ─── 1.1 Artifact formatting ─────────────────────────────────────────────

describe("artifact formatting is byte-stable", () => {
  it("formatCommand output per adapter", () => {
    expect(
      Object.fromEntries(
        getAllAdapters().map((a) => [a.id, a.formatCommand(META)]),
      ),
    ).toMatchInlineSnapshot(`
      {
        "claude": "---
      description: Run Playwright E2E verification for an OpenSpec change
      argument-hint: "<change-name|all>"
      ---

      Run /opsx:e2e for the change.
      See /opsx:propose for planning.

      ",
        "cline": "---
      name: opsx-e2e
      description: Run Playwright E2E verification for an OpenSpec change
      ---

      Run /opsx-e2e for the change.
      See /opsx-propose for planning.

      ",
        "codebuddy": "---
      description: Run Playwright E2E verification for an OpenSpec change
      argument-hint: "<change-name|all>"
      ---

      Run /opsx:e2e for the change.
      See /opsx:propose for planning.

      ",
        "cursor": "<!-- Change name: $1 (e.g. /opsx-e2e my-change) -->

      Run /opsx-e2e for the change.
      See /opsx-propose for planning.

      ",
        "minimax": "---
      name: opsx-e2e
      description: Run Playwright E2E verification for an OpenSpec change
      ---

      Run /opsx-e2e for the change.
      See /opsx-propose for planning.

      ",
        "omp": "---
      name: opsx-e2e
      description: Run Playwright E2E verification for an OpenSpec change
      ---

      Run /opsx-e2e for the change.
      See /opsx-propose for planning.

      ",
        "opencode": "---
      description: Run Playwright E2E verification for an OpenSpec change
      ---

      Run /opsx-e2e for the change.
      See /opsx-propose for planning.

      ",
        "pi": "---
      description: Run Playwright E2E verification for an OpenSpec change
      argument-hint: "<change-name>"
      ---

      Run /opsx-e2e for the change.
      See /opsx-propose for planning.

      ",
      }
    `);
  });

  it("paths, secondary artifacts, and slash hints", () => {
    expect(
      getAllAdapters().map((a) => ({
        id: a.id,
        commandForm: a.commandForm,
        path: a.commandFilePath("e2e"),
        extras: (a.extraArtifacts?.(META) ?? []).map((e) => ({
          path: e.relativePath,
          contents: e.contents,
        })),
        slash: slashCommandForAdapter(a),
      })),
    ).toMatchInlineSnapshot(`
      [
        {
          "commandForm": "colon",
          "extras": [],
          "id": "claude",
          "path": ".claude/commands/opsx/e2e.md",
          "slash": "/opsx:e2e",
        },
        {
          "commandForm": "hyphen",
          "extras": [],
          "id": "opencode",
          "path": ".opencode/commands/opsx-e2e.md",
          "slash": "/opsx-e2e",
        },
        {
          "commandForm": "hyphen",
          "extras": [],
          "id": "cline",
          "path": ".cline/skills/opsx-e2e/SKILL.md",
          "slash": "/opsx-e2e",
        },
        {
          "commandForm": "hyphen",
          "extras": [
            {
              "contents": "---
      name: opsx-e2e
      description: Run Playwright E2E verification for an OpenSpec change
      disable-model-invocation: true
      ---

      Run /opsx-e2e for the change.
      See /opsx-propose for planning.

      ",
              "path": ".cursor/skills/opsx-e2e/SKILL.md",
            },
          ],
          "id": "cursor",
          "path": ".cursor/commands/opsx-e2e.md",
          "slash": "/opsx-e2e",
        },
        {
          "commandForm": "hyphen",
          "extras": [],
          "id": "pi",
          "path": ".pi/prompts/opsx-e2e.md",
          "slash": "/opsx-e2e",
        },
        {
          "commandForm": "hyphen",
          "extras": [],
          "id": "omp",
          "path": ".omp/commands/opsx-e2e.md",
          "slash": "/opsx-e2e",
        },
        {
          "commandForm": "colon",
          "extras": [],
          "id": "codebuddy",
          "path": ".codebuddy/commands/opsx/e2e.md",
          "slash": "/opsx:e2e",
        },
        {
          "commandForm": "hyphen",
          "extras": [],
          "id": "minimax",
          "path": ".agents/skills/opsx-e2e/SKILL.md",
          "slash": "/opsx-e2e",
        },
      ]
    `);
  });
});

// ─── 1.2 Detection tiers ─────────────────────────────────────────────────

interface DetectionRow {
  id: EditorAdapter["id"];
  project: string[];
  global?: string;
  intent?: string;
}

const DETECTION: DetectionRow[] = [
  { id: "claude", project: [".claude"], intent: "CLAUDE.md" },
  { id: "opencode", project: [".opencode"], intent: "opencode.json" },
  { id: "cline", project: [".cline"] },
  { id: "cursor", project: [".cursor"], intent: ".cursorrules" },
  { id: "pi", project: [".pi"], global: ".pi/agent" },
  { id: "omp", project: [".omp"], global: ".omp/agent" },
  { id: "codebuddy", project: [".codebuddy"], intent: "CODEBUDDY.md" },
  { id: "minimax", project: [".minimax"], global: ".minimax-code" },
];

describe("detection tiers", () => {
  for (const row of DETECTION) {
    it(`${row.id}: marker / artifact / intent / none`, () => {
      const adapter = byId().get(row.id)!;

      // None of the signals present.
      const empty = projectDir("detect", row.id, "none");
      expect(adapter.detect(empty, home)).toBe(false);
      expect(adapter.projectSignal!(empty)).toBe(false);
      expect(intentFileEditors(empty)).toEqual([]);

      // Project marker directory present.
      const marker = projectDir("detect", row.id, "marker");
      for (const path of row.project) {
        mkdirSync(join(marker, path), { recursive: true });
      }
      expect(adapter.detect(marker, home)).toBe(true);
      expect(adapter.projectSignal!(marker)).toBe(true);
      expect(detectAdapters(marker, home).map((a) => a.id)).toContain(row.id);

      // Tool-owned artifact present (with no marker for minimax).
      const artifact = projectDir("detect", row.id, "artifact");
      installCommand(adapter, META, artifact);
      expect(adapter.detect(artifact, home)).toBe(true);
      expect(adapter.projectSignal!(artifact)).toBe(true);

      // Intent file alone: pre-select only — never detect / project signal.
      if (row.intent) {
        const intent = projectDir("detect", row.id, "intent");
        writeFileSync(
          join(intent, row.intent),
          row.intent.endsWith(".json") ? "{}\n" : "# notes\n",
        );
        expect(adapter.detect(intent, home)).toBe(false);
        expect(adapter.projectSignal!(intent)).toBe(false);
        expect(intentFileEditors(intent)).toEqual([row.id]);
      }
    });
  }

  it("a global install root is never a project signal", () => {
    for (const row of DETECTION) {
      if (!row.global) continue;
      const adapter = byId().get(row.id)!;
      const empty = projectDir("global", row.id);
      const rowHome = join(home, row.id);
      mkdirSync(join(rowHome, row.global), { recursive: true });
      expect(adapter.detect(empty, rowHome)).toBe(true);
      expect(adapter.projectSignal!(empty)).toBe(false);
    }
  });
});

// ─── 1.3 MCP carriers ────────────────────────────────────────────────────

describe("MCP carriers", () => {
  const command = ["npx", "playwright", "run-test-mcp-server"];

  it("own-file adapters write their own mcp.json", () => {
    for (const [adapter, rel] of [
      [clineAdapter, join(".cline", "mcp.json")],
      [cursorAdapter, join(".cursor", "mcp.json")],
      [ompAdapter, join(".omp", "mcp.json")],
    ] as const) {
      const proj = projectDir("mcp", adapter.id);
      adapter.installMcp(proj, "playwright-test", command);
      const parsed = JSON.parse(readFileSync(join(proj, rel), "utf-8"));
      expect(parsed.mcpServers["playwright-test"]).toEqual({
        command: "npx",
        args: ["playwright", "run-test-mcp-server"],
      });
      expect(adapter.isMcpInstalled(proj, "playwright-test")).toBe(true);
      adapter.removeMcp(proj, "playwright-test");
      expect(adapter.isMcpInstalled(proj, "playwright-test")).toBe(false);
    }
  });

  it("project-root .mcp.json is shared by claude / codebuddy / minimax", () => {
    const proj = projectDir("mcp", "shared");
    minimaxAdapter.installMcp(proj, "playwright-test", command);

    expect(codebuddyAdapter.isMcpInstalled(proj, "playwright-test")).toBe(true);
    expect(claudeAdapter.isMcpInstalled(proj, "playwright-test")).toBe(true);
    expect(minimaxAdapter.mcpConfigPath!(proj)).toBe(join(proj, ".mcp.json"));

    const retained = retainedMcpConfigFiles([claudeAdapter], proj);
    expect(retained.has(join(proj, ".mcp.json"))).toBe(true);

    const inv = enumerateAdapterArtifacts(minimaxAdapter, proj, retained);
    expect(inv.mcpServers).toEqual([]);
    expect(inv.retainedMcpServers).toEqual(["playwright-test"]);
  });

  it("opencode keeps MCP inside opencode.json(c)", () => {
    const proj = projectDir("mcp", "opencode");
    opencodeAdapter.installMcp(proj, "playwright-test", command);
    const parsed = JSON.parse(readFileSync(join(proj, "opencode.jsonc"), "utf-8"));
    expect(parsed.mcp["playwright-test"]).toEqual({
      type: "local",
      command,
    });
    expect(opencodeAdapter.isMcpInstalled(proj, "playwright-test")).toBe(true);
    opencodeAdapter.removeMcp(proj, "playwright-test");
    expect(opencodeAdapter.isMcpInstalled(proj, "playwright-test")).toBe(false);
  });

  it("pi has no MCP client", () => {
    expect(piAdapter.supportsMcp).toBe(false);
    const proj = projectDir("mcp", "pi");
    expect(piAdapter.isMcpInstalled(proj, "playwright-test")).toBe(false);
  });
});

// ─── 1.4 Removal inventory + slash hints ─────────────────────────────────

describe("removal inventory", () => {
  it("lists command artifacts, the claude legacy dir, and MCP entries", () => {
    const proj = projectDir("inventory");
    installCommand(claudeAdapter, META, proj);
    mkdirSync(join(proj, ".claude", "skills", "openspec-e2e"), {
      recursive: true,
    });
    writeFileSync(
      join(proj, ".claude", "skills", "openspec-e2e", "SKILL.md"),
      "legacy\n",
    );
    minimaxAdapter.installMcp(proj, "playwright-test", ["npx", "pw"]);

    const inv = enumerateAdapterArtifacts(claudeAdapter, proj);
    expect({
      commandPaths: inv.commandPaths,
      legacy: legacyPaths(inv as unknown as Record<string, unknown>),
      mcpServers: inv.mcpServers,
      retainedMcpServers: inv.retainedMcpServers,
      hasWrapper: inv.hasWrapper,
    }).toMatchInlineSnapshot(`
      {
        "commandPaths": [
          ".claude/commands/opsx/e2e.md",
        ],
        "hasWrapper": false,
        "legacy": [
          ".claude/skills/openspec-e2e",
        ],
        "mcpServers": [
          "playwright-test",
        ],
        "retainedMcpServers": [],
      }
    `);
  });

  it("slash hints follow the adapter", () => {
    expect(
      getAllAdapters().map((a) => [a.id, slashCommandForAdapter(a)]),
    ).toMatchInlineSnapshot(`
      [
        [
          "claude",
          "/opsx:e2e",
        ],
        [
          "opencode",
          "/opsx-e2e",
        ],
        [
          "cline",
          "/opsx-e2e",
        ],
        [
          "cursor",
          "/opsx-e2e",
        ],
        [
          "pi",
          "/opsx-e2e",
        ],
        [
          "omp",
          "/opsx-e2e",
        ],
        [
          "codebuddy",
          "/opsx:e2e",
        ],
        [
          "minimax",
          "/opsx-e2e",
        ],
      ]
    `);
  });
});

// ─── 1.5 Registration order ──────────────────────────────────────────────

describe("registration order", () => {
  it("matches the documented order", () => {
    expect(getAllAdapters().map((a) => a.id)).toEqual(REGISTRATION_ORDER);
  });
});
