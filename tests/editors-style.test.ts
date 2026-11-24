/**
 * 2.x artifact matrix: every adapter declares an `openspec-e2e` set, and the
 * compiled adapter for the `openspec` style writes those paths and hints.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  existsSync,
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
  getAllAdapters,
  getAdapter,
  installCommand,
  listCommandArtifactPaths,
  migrateOldStyleArtifacts,
  slashCommandForAdapter,
  type EditorId,
} from "../src/commands/editors.js";

const META = buildCommandMeta("Run /opsx:e2e <name> to verify.\n");

const EXPECTED_2X: Record<EditorId, string[]> = {
  claude: [
    join(".claude", "skills", "openspec-e2e", "SKILL.md"),
    join(".agents", "skills", "openspec-e2e", "SKILL.md"),
  ],
  opencode: [join(".opencode", "commands", "openspec-e2e.md")],
  cline: [join(".cline", "skills", "openspec-e2e", "SKILL.md")],
  cursor: [
    join(".cursor", "commands", "openspec-e2e.md"),
    join(".cursor", "skills", "openspec-e2e", "SKILL.md"),
  ],
  pi: [join(".pi", "prompts", "openspec-e2e.md")],
  omp: [join(".omp", "commands", "openspec-e2e.md")],
  codebuddy: [join(".codebuddy", "commands", "openspec-e2e.md")],
  minimax: [join(".agents", "skills", "openspec-e2e", "SKILL.md")],
  dsh: [join(".dsh", "skills", "openspec-e2e", "SKILL.md")],
  gemini: [join(".gemini", "commands", "openspec-e2e.toml")],
  qwen: [join(".qwen", "commands", "openspec-e2e.md")],
  "github-copilot": [join(".github", "prompts", "openspec-e2e.prompt.md")],
  roocode: [join(".roo", "commands", "openspec-e2e.md")],
  trae: [join(".trae", "commands", "openspec-e2e.md")],
  codex: [join(".agents", "skills", "openspec-e2e", "SKILL.md")],
  kimi: [join(".kimi-code", "skills", "openspec-e2e", "SKILL.md")],
};

describe("adapter style matrix", () => {
  it("compiles 16 adapters for each style", () => {
    expect(getAllAdapters("opsx")).toHaveLength(16);
    expect(getAllAdapters("openspec")).toHaveLength(16);
  });

  it("writes the 2.x path for every adapter", () => {
    for (const [id, paths] of Object.entries(EXPECTED_2X)) {
      const adapter = getAdapter(id as EditorId, "openspec");
      expect(adapter, id).toBeDefined();
      expect(listCommandArtifactPaths(adapter!, META), id).toEqual(paths);
      // 1.x paths stay on the opsx family.
      const old = getAdapter(id as EditorId, "opsx");
      for (const rel of listCommandArtifactPaths(old!, META)) {
        expect(paths, id).not.toContain(rel);
      }
    }
  });

  it("uses the 2.x invocation hints", () => {
    expect(slashCommandForAdapter(getAdapter("claude", "openspec")!)).toBe(
      "/openspec-e2e",
    );
    expect(slashCommandForAdapter(getAdapter("codex", "openspec")!)).toBe(
      "$openspec-e2e",
    );
    expect(slashCommandForAdapter(getAdapter("kimi", "openspec")!)).toBe(
      "/skill:openspec-e2e",
    );
    expect(slashCommandForAdapter(getAdapter("claude", "opsx")!)).toBe(
      "/opsx:e2e",
    );
  });

  it("renders 2.x artifacts with the openspec name and body", () => {
    const adapter = getAdapter("claude", "openspec")!;
    const out = adapter.formatCommand(META);
    expect(out).toContain("name: openspec-e2e");
    expect(out).toContain("/openspec-e2e");
    expect(out).not.toContain("/opsx:e2e");
  });
});

describe("1.x → 2.x e2e migration", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "ospw-style-migrate-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("removes an untouched 1.x artifact and installs the 2.x one", () => {
    const old = getAdapter("claude", "opsx")!;
    const next = getAdapter("claude", "openspec")!;
    installCommand(old, META, root);
    const oldPath = join(root, old.commandFilePath("e2e"));
    const newPath = join(root, next.commandFilePath("e2e"));

    const removed = migrateOldStyleArtifacts(next, root, META);
    installCommand(next, META, root);

    expect(removed).toEqual([old.commandFilePath("e2e")]);
    expect(existsSync(oldPath)).toBe(false);
    expect(existsSync(newPath)).toBe(true);
    expect(readFileSync(newPath, "utf-8")).toContain("/openspec-e2e");
  });

  it("keeps a user-edited 1.x artifact", () => {
    const old = getAdapter("claude", "opsx")!;
    const next = getAdapter("claude", "openspec")!;
    installCommand(old, META, root);
    const oldPath = join(root, old.commandFilePath("e2e"));
    writeFileSync(oldPath, "my own workflow\n");

    const removed = migrateOldStyleArtifacts(next, root, META);

    expect(removed).toEqual([]);
    expect(readFileSync(oldPath, "utf-8")).toBe("my own workflow\n");
  });

  it("is a no-op when only the 1.x artifacts exist and style is 2.x (then installs)", () => {
    const old = getAdapter("codex", "opsx")!;
    installCommand(old, META, root);
    const next = getAdapter("codex", "openspec")!;
    expect(migrateOldStyleArtifacts(next, root, META)).toEqual([
      old.commandFilePath("e2e"),
    ]);
  });

  it("removes the emptied 1.x skill directory but leaves populated command dirs", () => {
    const skillOld = getAdapter("codex", "opsx")!;
    const skillNext = getAdapter("codex", "openspec")!;
    installCommand(skillOld, META, root);
    expect(migrateOldStyleArtifacts(skillNext, root, META)).toEqual([
      skillOld.commandFilePath("e2e"),
    ]);
    expect(existsSync(join(root, ".agents", "skills", "opsx-e2e"))).toBe(false);

    const cmdOld = getAdapter("claude", "opsx")!;
    const cmdNext = getAdapter("claude", "openspec")!;
    installCommand(cmdOld, META, root);
    writeFileSync(join(root, ".claude", "commands", "opsx", "apply.md"), "x");
    migrateOldStyleArtifacts(cmdNext, root, META);
    expect(existsSync(join(root, ".claude", "commands", "opsx"))).toBe(true);
  });

  it("does nothing under the 1.x style", () => {
    const old = getAdapter("claude", "opsx")!;
    installCommand(old, META, root);
    expect(migrateOldStyleArtifacts(old, root, META)).toEqual([]);
    expect(existsSync(join(root, old.commandFilePath("e2e")))).toBe(true);
  });
});

describe("MiniMax 2.x detection", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "ospw-style-minimax-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("detects a project that only has the 2.x shared skill", () => {
    mkdirSync(join(root, ".agents", "skills", "openspec-e2e"), {
      recursive: true,
    });
    writeFileSync(
      join(root, ".agents", "skills", "openspec-e2e", "SKILL.md"),
      "skill\n",
    );
    expect(getAdapter("minimax", "openspec")!.projectSignal(root)).toBe(true);
    // Cross-style detection: a 1.x-style probe still recognizes the 2.x skill.
    expect(getAdapter("minimax", "opsx")!.projectSignal(root)).toBe(true);
  });
});
