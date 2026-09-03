import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "fs";
import { tmpdir } from "os";
import { basename, join } from "path";

// init shells `npx openspec --version`, `node --version`, `npm --version`
// during prerequisites — stub execFileSync so hermetic runs don't depend on PATH.
vi.mock("child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("child_process")>();
  return {
    ...actual,
    execFileSync: vi.fn((file: string, args: string[]) => {
      if (file === "npx" && args[0] === "openspec") return "1.11.0";
      if (file === "npx" && args[0] === "playwright") return "1.62.1";
      if (file === "node") return "v22.0.0";
      if (file === "npm") return "10.0.0";
      // uninstall/removeMcp swallows claude CLI failures — safe to throw here.
      throw new Error(`unexpected execFileSync: ${file}`);
    }),
  };
});

import { init } from "../src/commands/init.js";
import { uninstall } from "../src/commands/uninstall.js";
import { doctor, isOptionalCheck } from "../src/commands/doctor.js";
import {
  claudeAdapter,
  listCommandArtifactPaths,
  opencodeAdapter,
} from "../src/commands/editors.js";
import {
  classifyAgentFile,
  enumerateVendoredAgents,
  installedAgentsSnapshotDir,
  loadAgentSnapshots,
  readAgentsManifest,
  roleForRelPath,
  sha256Contents,
  syncVendoredAgents,
  vendoredAgentRelPaths,
  type AgentsManifest,
  type VendoredAgentRole,
} from "../src/commands/editors/agents.js";
import {
  installOptionalArtifacts,
  listOptionalArtifactPaths,
} from "../src/commands/editors/registry.js";

const AGENT_RELS = vendoredAgentRelPaths();
const SNAPSHOT_DIR = installedAgentsSnapshotDir();

function roleOf(relPath: string): VendoredAgentRole {
  return roleForRelPath(relPath)!;
}

function frontendPkg(tmpRoot: string): void {
  // React dependency = frontend signal for the MCP/agents gate.
  writeFileSync(
    join(tmpRoot, "package.json"),
    JSON.stringify({ name: "fixture", version: "1.0.0", dependencies: { react: "18.0.0" } }),
  );
}

/**
 * A snapshot dir simulating a bumped baseline: the shipped snapshots become
 * the historical hashes, and the bundle's files hold new "upstream" content.
 */
function makeBumpedBundle(baseDir: string): string {
  const dir = join(baseDir, "bundle-agents");
  mkdirSync(join(dir, "claude"), { recursive: true });
  const manifest = readAgentsManifest(SNAPSHOT_DIR)!;
  const historicalHashes: NonNullable<AgentsManifest["historicalHashes"]> = {};
  const files: AgentsManifest["files"] = {} as AgentsManifest["files"];
  for (const snapshot of loadAgentSnapshots(SNAPSHOT_DIR)) {
    const role = roleOf(snapshot.relativePath);
    historicalHashes[role] = [manifest.files[role]];
    const bumped = snapshot.contents + "\n<!-- upstream 9.99.9 -->";
    writeFileSync(join(dir, "claude", basename(snapshot.relativePath)), bumped);
    files[role] = sha256Contents(bumped);
  }
  writeFileSync(
    join(dir, "manifest.json"),
    JSON.stringify({ baseline: "9.99.9", files, historicalHashes }, null, 2),
  );
  return dir;
}

describe("vendored agent snapshots", () => {
  it("claude adapter optionalArtifacts returns the three files byte-identical to templates", () => {
    const artifacts = claudeAdapter.optionalArtifacts!(true);
    expect(artifacts.map((a) => a.relativePath)).toEqual(AGENT_RELS);
    for (const artifact of artifacts) {
      const template = readFileSync(
        join(SNAPSHOT_DIR, "claude", basename(artifact.relativePath)),
        "utf-8",
      );
      expect(artifact.contents).toBe(template);
    }
  });

  it("consent=false yields no paths; adapters without the field yield none", () => {
    expect(opencodeAdapter.optionalArtifacts).toBeUndefined();
    expect(listOptionalArtifactPaths(claudeAdapter, false)).toEqual([]);
    expect(listOptionalArtifactPaths(claudeAdapter, true)).toEqual(AGENT_RELS);
    expect(listOptionalArtifactPaths(opencodeAdapter, true)).toEqual([]);
  });

  it("optionalArtifacts never enter listCommandArtifactPaths (no configured status)", () => {
    const commandPaths = listCommandArtifactPaths(claudeAdapter, {
      id: "e2e",
    } as Parameters<typeof listCommandArtifactPaths>[1]);
    for (const rel of AGENT_RELS) {
      expect(commandPaths).not.toContain(rel);
    }
  });

  it("manifest hashes match the shipped snapshot files", () => {
    const manifest = readAgentsManifest(SNAPSHOT_DIR)!;
    for (const snapshot of loadAgentSnapshots(SNAPSHOT_DIR)) {
      expect(manifest.files[roleOf(snapshot.relativePath)]).toBe(
        sha256Contents(snapshot.contents),
      );
    }
  });
});

describe("classifyAgentFile", () => {
  let tmpRoot: string;
  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), "ospw-agents-classify-"));
  });
  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("missing / owned / modified states", () => {
    const manifest = readAgentsManifest(SNAPSHOT_DIR)!;
    const rel = AGENT_RELS[0];
    expect(classifyAgentFile(tmpRoot, rel, "SNAPSHOT", manifest)).toBe("missing");
    mkdirSync(join(tmpRoot, ".claude", "agents"), { recursive: true });
    writeFileSync(join(tmpRoot, rel), "SNAPSHOT");
    expect(classifyAgentFile(tmpRoot, rel, "SNAPSHOT", manifest)).toBe("owned");
    writeFileSync(join(tmpRoot, rel), "user edited");
    expect(classifyAgentFile(tmpRoot, rel, "SNAPSHOT", manifest)).toBe("modified");
  });

  it("CRLF checkout content still classifies as owned (Windows git autocrlf)", () => {
    const manifest = readAgentsManifest(SNAPSHOT_DIR)!;
    const rel = AGENT_RELS[0];
    mkdirSync(join(tmpRoot, ".claude", "agents"), { recursive: true });
    const snapshot = loadAgentSnapshots(SNAPSHOT_DIR)[0].contents.replace(/\n/g, "\r\n");
    writeFileSync(join(tmpRoot, rel), snapshot);
    expect(classifyAgentFile(tmpRoot, rel, loadAgentSnapshots(SNAPSHOT_DIR)[0].contents, manifest)).toBe("owned");
    expect(sha256Contents(snapshot)).toBe(sha256Contents(loadAgentSnapshots(SNAPSHOT_DIR)[0].contents));
  });

  it("old-baseline hash counts as owned via historicalHashes", () => {
    const manifest = readAgentsManifest(SNAPSHOT_DIR)!;
    const rel = AGENT_RELS[0];
    mkdirSync(join(tmpRoot, ".claude", "agents"), { recursive: true });
    // File holds the shipped snapshot; the "new" snapshot differs → only the
    // historical hash chain makes it owned.
    writeFileSync(join(tmpRoot, rel), loadAgentSnapshots(SNAPSHOT_DIR)[0].contents);
    const bumpedManifest: AgentsManifest = {
      ...manifest,
      baseline: "9.99.9",
      historicalHashes: { [roleOf(rel)]: [manifest.files[roleOf(rel)]] },
    };
    expect(classifyAgentFile(tmpRoot, rel, "NEW SNAPSHOT", bumpedManifest)).toBe("owned");
  });
});

describe("installOptionalArtifacts", () => {
  let tmpRoot: string;
  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), "ospw-agents-install-"));
  });
  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("install=false writes nothing; install=true writes all three", () => {
    installOptionalArtifacts(claudeAdapter, tmpRoot, false);
    expect(existsSync(join(tmpRoot, ".claude", "agents"))).toBe(false);
    installOptionalArtifacts(claudeAdapter, tmpRoot, true);
    for (const snapshot of loadAgentSnapshots(SNAPSHOT_DIR)) {
      expect(readFileSync(join(tmpRoot, snapshot.relativePath), "utf-8")).toBe(
        snapshot.contents,
      );
    }
  });

  it("re-install: owned stays byte-identical, user-modified is never overwritten", () => {
    installOptionalArtifacts(claudeAdapter, tmpRoot, true);
    const healerRel = AGENT_RELS[2];
    writeFileSync(join(tmpRoot, healerRel), "# my custom healer");
    installOptionalArtifacts(claudeAdapter, tmpRoot, true);
    expect(readFileSync(join(tmpRoot, healerRel), "utf-8")).toBe("# my custom healer");
  });
});

describe("init --agents", () => {
  let tmpRoot: string;
  let cwdSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), "ospw-agents-init-"));
    mkdirSync(join(tmpRoot, "openspec"), { recursive: true });
    mkdirSync(join(tmpRoot, ".claude"), { recursive: true });
    frontendPkg(tmpRoot);
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tmpRoot);
  });
  afterEach(() => {
    cwdSpy.mockRestore();
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("explicit --agents installs the three files byte-identically (non-TTY)", async () => {
    await init({ tools: "claude", agents: true, mcp: false }, { isTTY: false });
    for (const snapshot of loadAgentSnapshots(SNAPSHOT_DIR)) {
      expect(readFileSync(join(tmpRoot, snapshot.relativePath), "utf-8")).toBe(
        snapshot.contents,
      );
    }
  });

  it("non-TTY without --agents never installs agents", async () => {
    await init({ tools: "claude", mcp: false }, { isTTY: false });
    expect(existsSync(join(tmpRoot, ".claude", "agents"))).toBe(false);
    // Command artifacts still installed — only the agents phase is skipped.
    expect(existsSync(join(tmpRoot, ".claude", "commands", "opsx", "e2e.md"))).toBe(true);
  });

  it("--tools none --agents fails without writing files", async () => {
    await expect(
      init({ tools: "none", agents: true, mcp: false }, { isTTY: false }),
    ).rejects.toThrow(/--agents/);
    expect(existsSync(join(tmpRoot, ".claude", "agents"))).toBe(false);
  });

  it("--agents without claude in the selection is an informational no-op", async () => {
    mkdirSync(join(tmpRoot, ".cursor"), { recursive: true });
    await init({ tools: "cursor", agents: true, mcp: false }, { isTTY: false });
    expect(existsSync(join(tmpRoot, ".claude", "agents"))).toBe(false);
  });

  it("API-only project skips agents even with --agents", async () => {
    rmSync(join(tmpRoot, "package.json"));
    await init({ tools: "claude", agents: true, mcp: false }, { isTTY: false });
    expect(existsSync(join(tmpRoot, ".claude", "agents"))).toBe(false);
  });

  it("interactive confirm declining installs no agents; agreeing installs them", async () => {
    const confirms: string[] = [];
    await init(
      { mcp: false },
      {
        isTTY: true,
        prompt: async () => ["claude"],
        confirm: async (message: string) => {
          confirms.push(message);
          return false;
        },
      },
    );
    expect(confirms).toHaveLength(1);
    expect(confirms[0]).toMatch(/agents/i);
    expect(existsSync(join(tmpRoot, AGENT_RELS[0]))).toBe(false);

    await init(
      { mcp: false },
      { isTTY: true, prompt: async () => ["claude"], confirm: async () => true },
    );
    expect(existsSync(join(tmpRoot, AGENT_RELS[0]))).toBe(true);
  });

  it("explicit --agents bypasses the interactive prompt", async () => {
    const confirm = vi.fn(async () => {
      throw new Error("confirm must not be called");
    });
    await init(
      { tools: "claude", agents: true, mcp: false },
      { isTTY: true, prompt: async () => ["claude"], confirm },
    );
    expect(confirm).not.toHaveBeenCalled();
    expect(existsSync(join(tmpRoot, AGENT_RELS[0]))).toBe(true);
  });

  it("re-init rewrites owned idempotently and leaves user-modified files untouched", async () => {
    await init({ tools: "claude", agents: true, mcp: false }, { isTTY: false });
    const healerRel = AGENT_RELS[2];
    writeFileSync(join(tmpRoot, healerRel), "# my custom healer");
    await init({ tools: "claude", agents: true, mcp: false }, { isTTY: false });
    expect(readFileSync(join(tmpRoot, healerRel), "utf-8")).toBe("# my custom healer");
    for (const snapshot of loadAgentSnapshots(SNAPSHOT_DIR)) {
      if (snapshot.relativePath === healerRel) continue;
      expect(readFileSync(join(tmpRoot, snapshot.relativePath), "utf-8")).toBe(
        snapshot.contents,
      );
    }
  });
});

describe("deselection removal with agents", () => {
  let tmpRoot: string;
  let cwdSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), "ospw-agents-deselect-"));
    mkdirSync(join(tmpRoot, "openspec"), { recursive: true });
    mkdirSync(join(tmpRoot, ".claude"), { recursive: true });
    mkdirSync(join(tmpRoot, ".claude", "commands", "opsx"), { recursive: true });
    writeFileSync(join(tmpRoot, ".claude", "commands", "opsx", "e2e.md"), "cmd");
    frontendPkg(tmpRoot);
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tmpRoot);
  });
  afterEach(() => {
    cwdSpy.mockRestore();
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("owned agents join the confirm list and are removed; modified agents are kept", async () => {
    // Install owned snapshots, then modify the healer (user-owned).
    await init({ tools: "claude", agents: true, mcp: false }, { isTTY: false });
    const healerRel = AGENT_RELS[2];
    writeFileSync(join(tmpRoot, healerRel), "# my custom healer");

    // Re-init interactively, deselecting claude.
    await init(
      { mcp: false },
      {
        isTTY: true,
        prompt: async () => [],
        confirm: async () => true,
      },
    );
    // Owned files removed with the command file; modified healer kept.
    expect(existsSync(join(tmpRoot, ".claude", "commands", "opsx", "e2e.md"))).toBe(false);
    expect(existsSync(join(tmpRoot, AGENT_RELS[0]))).toBe(false);
    expect(existsSync(join(tmpRoot, healerRel))).toBe(true);
    expect(readFileSync(join(tmpRoot, healerRel), "utf-8")).toBe("# my custom healer");
  });

  it("agents-only residue produces no removal candidates", async () => {
    // Agents present, no command artifacts, no MCP, no wrapper.
    mkdirSync(join(tmpRoot, ".claude", "agents"), { recursive: true });
    writeFileSync(join(tmpRoot, AGENT_RELS[0]), loadAgentSnapshots(SNAPSHOT_DIR)[0].contents);
    const confirm = vi.fn(async () => true);
    await init(
      { mcp: false },
      { isTTY: true, prompt: async () => ["claude"], confirm },
    );
    // Nothing configured → no removal confirm; the only confirm (agents) ran.
    for (const call of confirm.mock.calls) {
      expect(String(call[0])).not.toMatch(/removal/i);
    }
    expect(existsSync(join(tmpRoot, AGENT_RELS[0]))).toBe(true);
  });
});

describe("uninstall with agents", () => {
  let tmpRoot: string;
  let cwdSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), "ospw-agents-uninstall-"));
    mkdirSync(join(tmpRoot, "openspec"), { recursive: true });
    mkdirSync(join(tmpRoot, ".claude"), { recursive: true });
    frontendPkg(tmpRoot);
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tmpRoot);
  });
  afterEach(() => {
    cwdSpy.mockRestore();
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("removes owned agents, keeps modified ones", async () => {
    installOptionalArtifacts(claudeAdapter, tmpRoot, true);
    const healerRel = AGENT_RELS[2];
    writeFileSync(join(tmpRoot, healerRel), "# my custom healer");

    await uninstall();

    expect(existsSync(join(tmpRoot, AGENT_RELS[0]))).toBe(false);
    expect(existsSync(join(tmpRoot, healerRel))).toBe(true);
  });
});

describe("syncVendoredAgents (update phase)", () => {
  let tmpRoot: string;
  let bundleDir: string;
  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), "ospw-agents-sync-"));
    bundleDir = makeBumpedBundle(tmpRoot);
  });
  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("refreshes stale tool-owned files, skips user-owned, never creates missing", () => {
    const snapshots = loadAgentSnapshots(SNAPSHOT_DIR);
    mkdirSync(join(tmpRoot, ".claude", "agents"), { recursive: true });
    // planner: old baseline (historical → refreshable); generator: user edit;
    // healer: absent.
    writeFileSync(join(tmpRoot, snapshots[0].relativePath), snapshots[0].contents);
    writeFileSync(join(tmpRoot, snapshots[1].relativePath), "# user edited generator");

    syncVendoredAgents(bundleDir, tmpRoot, true);

    // Old-baseline file was refreshed to the bumped snapshot.
    expect(readFileSync(join(tmpRoot, snapshots[0].relativePath), "utf-8")).toBe(
      snapshots[0].contents + "\n<!-- upstream 9.99.9 -->",
    );
    // User-owned file untouched; missing file not created.
    expect(readFileSync(join(tmpRoot, snapshots[1].relativePath), "utf-8")).toBe(
      "# user edited generator",
    );
    expect(existsSync(join(tmpRoot, snapshots[2].relativePath))).toBe(false);
  });

  it("leaves everything untouched when claude is not authorized", () => {
    const snapshots = loadAgentSnapshots(SNAPSHOT_DIR);
    mkdirSync(join(tmpRoot, ".claude", "agents"), { recursive: true });
    writeFileSync(join(tmpRoot, snapshots[0].relativePath), snapshots[0].contents);

    syncVendoredAgents(bundleDir, tmpRoot, false);

    expect(readFileSync(join(tmpRoot, snapshots[0].relativePath), "utf-8")).toBe(
      snapshots[0].contents,
    );
  });
});

describe("enumerateVendoredAgents (doctor classification source)", () => {
  it("classifies absent and installed states", () => {
    const tmpRoot = mkdtempSync(join(tmpdir(), "ospw-agents-doctor-"));
    try {
      const inv = enumerateVendoredAgents(tmpRoot, SNAPSHOT_DIR);
      expect(inv.owned).toEqual([]);
      expect(inv.modified).toEqual([]);
      expect(inv.missing).toHaveLength(3);

      installOptionalArtifacts(claudeAdapter, tmpRoot, true);
      const installed = enumerateVendoredAgents(tmpRoot, SNAPSHOT_DIR);
      expect(installed.owned).toEqual(AGENT_RELS);
      expect(installed.missing).toEqual([]);
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});

describe("doctor vendored-agents checks", () => {
  let tmpRoot: string;
  let cwdSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;

  function setupProject(): void {
    // Minimal healthy project so doctor reaches its summary without exiting:
    // openspec/ + playwright.config.ts + tests/playwright/ + .claude/.
    mkdirSync(join(tmpRoot, "openspec"), { recursive: true });
    mkdirSync(join(tmpRoot, "tests", "playwright"), { recursive: true });
    mkdirSync(join(tmpRoot, ".claude"), { recursive: true });
    writeFileSync(join(tmpRoot, "playwright.config.ts"), "export default {};");
  }

  function runDoctorJson(): { ok: boolean; checks: Array<{ category: string; name: string; ok: boolean; message?: string }> } {
    logSpy.mockClear();
    return doctor({ json: true }).then(() => {
      const output = logSpy.mock.calls.map((c) => String(c[0])).join("");
      const start = output.indexOf("{");
      return JSON.parse(output.slice(start));
    });
  }

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), "ospw-agents-doctorcat-"));
    frontendPkg(tmpRoot);
    setupProject();
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tmpRoot);
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });
  afterEach(() => {
    cwdSpy.mockRestore();
    logSpy.mockRestore();
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("reports owned agents as non-blocking info", async () => {
    installOptionalArtifacts(claudeAdapter, tmpRoot, true);
    // playwright-test MCP entry present → no dependency warning.
    writeFileSync(
      join(tmpRoot, ".mcp.json"),
      JSON.stringify({
        mcpServers: {
          "playwright-test": { command: "npx", args: ["playwright", "run-test-mcp-server"] },
        },
      }),
    );
    const result = await runDoctorJson();
    expect(result.ok).toBe(true);
    const check = result.checks.find((c) => c.name === "vendored-agents");
    expect(check?.ok).toBe(true);
    expect(check?.message).toContain("3 file(s) (3 owned, 0 modified)");
    expect(result.checks.some((c) => c.name === "vendored-agents-mcp")).toBe(false);
  });

  it("warns (optional) when agents exist but the playwright-test MCP entry is missing", async () => {
    installOptionalArtifacts(claudeAdapter, tmpRoot, true);
    const result = await runDoctorJson();
    const mcp = result.checks.find((c) => c.name === "vendored-agents-mcp");
    expect(mcp?.ok).toBe(false);
    expect(mcp?.message).toMatch(/playwright-test MCP/);
    expect(isOptionalCheck("vendored-agents-mcp")).toBe(true);
    // Non-blocking: overall ok despite the yellow warning.
    expect(result.ok).toBe(true);
  });

  it("emits a neutral drift line for modified agent files", async () => {
    installOptionalArtifacts(claudeAdapter, tmpRoot, true);
    writeFileSync(join(tmpRoot, AGENT_RELS[2]), "# my custom healer");
    const result = await runDoctorJson();
    const drift = result.checks.find((c) => c.name === "vendored-agents-drift");
    expect(drift?.ok).toBe(true);
    const summary = result.checks.find((c) => c.name === "vendored-agents");
    expect(summary?.message).toContain("2 owned, 1 modified");
  });

  it("claude-authorized project without agents gets the opt-in hint", async () => {
    mkdirSync(join(tmpRoot, ".claude", "commands", "opsx"), { recursive: true });
    writeFileSync(join(tmpRoot, ".claude", "commands", "opsx", "e2e.md"), "cmd");
    // Bare @AGENTS.md import keeps the standards-claude sync check green.
    writeFileSync(join(tmpRoot, "CLAUDE.md"), "@AGENTS.md\n");
    const result = await runDoctorJson();
    const check = result.checks.find((c) => c.name === "vendored-agents");
    expect(check?.ok).toBe(true);
    expect(check?.message).toMatch(/opt-in/);
  });
});
