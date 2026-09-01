import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock-heavy harness for syncEmployeeStandards + update()'s early return.
// The sibling update.test.ts uses REAL os.tmpdir() fixtures — vi.mock is
// hoisted file-wide, so these cases live in their own file.
//
// update.ts imports fs from plain "fs" and child_process from
// "node:child_process" — both factories must list every named import the
// module graph pulls from them.
vi.mock("fs", () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  rmSync: vi.fn(),
  readdirSync: vi.fn(),
  statSync: vi.fn(),
  lstatSync: vi.fn(),
}));
vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
  execFileSync: vi.fn(),
}));
vi.mock("node:module", () => ({
  createRequire: vi.fn(() => ({ resolve: vi.fn() })),
}));
// installOpenSpecBlock / installClaudeWrapper are the side effects under
// assertion; everything else from editors.js stays real.
vi.mock("../src/commands/editors.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../src/commands/editors.js")>();
  return {
    ...actual,
    installOpenSpecBlock: vi.fn(),
    installClaudeWrapper: vi.fn(),
    installProjectRules: vi.fn(),
  };
});

import {
  existsSync,
  readFileSync,
  writeFileSync,
  lstatSync,
} from "fs";
import { execFile } from "node:child_process";
import { join } from "path";
import { update, syncEmployeeStandards } from "../src/commands/update.js";
import {
  installOpenSpecBlock,
  installClaudeWrapper,
} from "../src/commands/editors.js";
import { OPENSPEC_START, OPENSPEC_END } from "../src/shared/drift.js";

const existsSyncMock = vi.mocked(existsSync);
const readFileSyncMock = vi.mocked(readFileSync);
const lstatSyncMock = vi.mocked(lstatSync);
const execFileMock = vi.mocked(execFile);
const installOpenSpecBlockMock = vi.mocked(installOpenSpecBlock);
const installClaudeWrapperMock = vi.mocked(installClaudeWrapper);

const STANDARDS = "employee-grade standards body v1";

describe("update() early return", () => {
  const root = "/tmp/fake-update-project";
  let cwdSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(root);
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    existsSyncMock.mockReturnValue(false);
  });

  afterEach(() => {
    cwdSpy.mockRestore();
    logSpy.mockRestore();
  });

  function logText(): string {
    return logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
  }

  it("exits with a hint when no command artifact and no openspec dir exist", async () => {
    await update({});

    expect(logText()).toContain("not initialized");
    expect(logText()).toContain("openspec-pw init");
    // No CLI update attempted after the early return
    expect(execFileMock).not.toHaveBeenCalled();
  });
});

describe("syncEmployeeStandards", () => {
  const tmpDir = "/tmp/fake-update-tmp";
  const root = "/tmp/fake-update-project";
  const standardsSrc = join(tmpDir, "employee-standards.md");
  const agentsPath = join(root, "AGENTS.md");
  const claudePath = join(root, "CLAUDE.md");

  let logSpy: ReturnType<typeof vi.spyOn>;
  let existingPaths: Set<string>;
  let contentsByPath: Map<string, string>;
  let symlinks: Map<string, boolean>;

  beforeEach(() => {
    vi.clearAllMocks();
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    existingPaths = new Set([standardsSrc]);
    contentsByPath = new Map([[standardsSrc, STANDARDS]]);
    symlinks = new Map();

    existsSyncMock.mockImplementation((p) => existingPaths.has(String(p)));
    readFileSyncMock.mockImplementation(
      ((p: string) => contentsByPath.get(String(p)) ?? "") as unknown as typeof readFileSync,
    );
    lstatSyncMock.mockImplementation(
      ((p: string) => ({
        isSymbolicLink: () => symlinks.get(String(p)) ?? false,
      })) as unknown as typeof lstatSync,
    );
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  function logText(): string {
    return logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
  }

  function agentsInSync(): void {
    existingPaths.add(agentsPath);
    contentsByPath.set(
      agentsPath,
      `preamble\n${OPENSPEC_START}\n${STANDARDS}\n${OPENSPEC_END}\n`,
    );
  }

  it("returns silently when the bundled standards template is missing", () => {
    existingPaths.clear();

    syncEmployeeStandards(tmpDir, root, false, true);

    expect(logText()).toBe("");
    expect(installOpenSpecBlockMock).not.toHaveBeenCalled();
  });

  it("rewrites a stale §6 block with the slimmed text via the replace branch", () => {
    // Pre-release verification for standards-section6-slim: a project whose
    // marker block still holds the OLD §6 wording gets the NEW slimmed §6
    // (cannot use a fixture + `update` here — fetchLatestBundle pulls the
    // latest PUBLISHED package from npm, not local dist).
    const NEW_STANDARDS =
      "employee-grade standards body v2\n\n## 6. 测试与验证策略\n\n分层反馈：单测随手跑（秒级）；验收测试提交前实跑即可（分钟级）";
    const OLD_BLOCK =
      "employee-grade standards body v1\n\n## 6. 测试与验证策略\n\n分层反馈预期：单测改完随手跑（秒级量级）；验收测试提交前实跑";
    existingPaths.add(agentsPath);
    contentsByPath.set(standardsSrc, NEW_STANDARDS);
    contentsByPath.set(
      agentsPath,
      `preamble\n${OPENSPEC_START}\n${OLD_BLOCK}\n${OPENSPEC_END}\n`,
    );

    syncEmployeeStandards(tmpDir, root, false, true);

    expect(installOpenSpecBlockMock).toHaveBeenCalledTimes(1);
    expect(installOpenSpecBlockMock).toHaveBeenCalledWith(
      root,
      expect.stringContaining("分层反馈：单测随手跑"),
      expect.anything(),
    );
    const written = String(installOpenSpecBlockMock.mock.calls[0][1]);
    expect(written).not.toContain("分层反馈预期");
  });

  it("warns loudly when AGENTS.md has no marker at all and pw artifacts exist (accident shape)", () => {
    existingPaths.add(agentsPath);
    contentsByPath.set(agentsPath, "user-authored rules without markers\n");

    syncEmployeeStandards(tmpDir, root, false, true);

    expect(logText()).toContain("⚠ AGENTS.md has no OPENSPEC-PW block");
    expect(logText()).toContain("openspec update` legacy cleanup");
    expect(logText()).toContain('Restore: run "openspec-pw init"');
    expect(logText()).toContain("openspec-pw uninstall");
    expect(installOpenSpecBlockMock).not.toHaveBeenCalled();
    expect(installClaudeWrapperMock).not.toHaveBeenCalled();
  });

  it("keeps the gray hint for projects without pw artifacts (pure official project)", () => {
    existingPaths.add(agentsPath);
    contentsByPath.set(agentsPath, "user-authored rules without markers\n");

    syncEmployeeStandards(tmpDir, root, false, false);

    expect(logText()).toContain("has no OPENSPEC block");
    expect(logText()).not.toContain("⚠ AGENTS.md has no OPENSPEC-PW block");
    expect(installOpenSpecBlockMock).not.toHaveBeenCalled();
  });

  it("a surviving legacy block (signature mismatch) stays a gray info line, not migrated", () => {
    existingPaths.add(agentsPath);
    contentsByPath.set(
      agentsPath,
      `preamble\n<!-- OPENSPEC:START -->\nofficial legacy guidance\n<!-- OPENSPEC:END -->\n`,
    );

    syncEmployeeStandards(tmpDir, root, false, true);

    expect(logText()).toContain("has no OPENSPEC block");
    expect(logText()).not.toContain("⚠ AGENTS.md has no OPENSPEC-PW block");
    expect(readFileSyncMock).not.toHaveBeenCalledWith("migrated"); // no write attempted
  });

  it("migrates a surviving legacy block first, then drift-refreshes it (no warning)", () => {
    // writeFileSync mock must feed contentsByPath so the post-migration drift
    // check reads the migrated file — this asserts the migrate→drift chain.
    vi.mocked(writeFileSync).mockImplementation((p, c) => {
      contentsByPath.set(String(p), String(c));
      existingPaths.add(String(p));
    });
    existingPaths.add(agentsPath);
    contentsByPath.set(
      agentsPath,
      `preamble\n<!-- OPENSPEC:START -->\n# AI Coding Assistant Employee-Grade Standards\n\noutdated v0.3.76 body\n<!-- OPENSPEC:END -->\n`,
    );

    syncEmployeeStandards(tmpDir, root, false, true);

    expect(logText()).toContain("migrated markers to OPENSPEC-PW");
    expect(logText()).not.toContain("⚠ AGENTS.md has no OPENSPEC-PW block");
    // Migration ran before any marker judgment; the stale migrated block is
    // then refreshed by the regular drift path.
    expect(installOpenSpecBlockMock).toHaveBeenCalledTimes(1);
    expect(installOpenSpecBlockMock).toHaveBeenCalledWith(root, STANDARDS, expect.anything());
  });

  it("migrates a legacy CLAUDE.md wrapper before the bare-import check could misjudge it", () => {
    // Ordering is load-bearing: a legacy wrapper contains a bare @AGENTS.md
    // line; if the bare-import check ran before migration, it would
    // false-match and skip the wrapper — the migration must go first.
    vi.mocked(writeFileSync).mockImplementation((p, c) => {
      contentsByPath.set(String(p), String(c));
      existingPaths.add(String(p));
    });
    agentsInSync();
    existingPaths.add(claudePath);
    contentsByPath.set(
      claudePath,
      `# proj\n\n<!-- OPENSPEC:START -->\n\n## CodeGraph 优先\n\n旧版 wrapper\n\n@AGENTS.md\n\n<!-- OPENSPEC:END -->\n`,
    );

    syncEmployeeStandards(tmpDir, root, true, true);

    expect(logText()).toContain("CLAUDE.md: migrated markers to OPENSPEC-PW");
    // The bare-import warning must NOT fire — migration fixed the wrapper first.
    // (The migrated legacy wrapper content then goes through the regular drift
    // check and is refreshed to the current template — installClaudeWrapper
    // firing once is the expected convergence, not a misjudgment.)
    expect(logText()).not.toContain("裸 @AGENTS.md 导入");
    expect(installClaudeWrapperMock).toHaveBeenCalledTimes(1);
  });

  it("a legacy FULL-standards CLAUDE.md (April-2026 shape) migrates and is replaced, not appended next to", () => {
    vi.mocked(writeFileSync).mockImplementation((p, c) => {
      contentsByPath.set(String(p), String(c));
      existingPaths.add(String(p));
    });
    agentsInSync();
    existingPaths.add(claudePath);
    contentsByPath.set(
      claudePath,
      `# proj\n\n<!-- OPENSPEC:START -->\n\n# AI Coding Assistant Employee-Grade Standards\n\nfull standards body\n\n<!-- OPENSPEC:END -->\n`,
    );

    syncEmployeeStandards(tmpDir, root, true, true);

    // Migrated (signature = full-standards heading), then the regular drift
    // path REPLACES the block with the wrapper — no append, no bare-import
    // misjudgment, no permanent duplicate.
    expect(logText()).toContain("CLAUDE.md: migrated markers to OPENSPEC-PW");
    expect(logText()).not.toContain("裸 @AGENTS.md 导入");
    expect(installClaudeWrapperMock).toHaveBeenCalledTimes(1);
  });

  it("skips AGENTS.md write-back when the file is missing — regardless of detected editors", () => {
    syncEmployeeStandards(tmpDir, root, false, true);

    expect(logText()).toContain("AGENTS.md not found");
    expect(installOpenSpecBlockMock).not.toHaveBeenCalled();
    expect(installClaudeWrapperMock).not.toHaveBeenCalled();
  });

  it("rewrites the AGENTS.md block when the tool-owned block is stale", () => {
    existingPaths.add(agentsPath);
    contentsByPath.set(
      agentsPath,
      `${OPENSPEC_START}\noutdated standards body\n${OPENSPEC_END}`,
    );

    syncEmployeeStandards(tmpDir, root, false, true);

    expect(logText()).toContain("OPENSPEC block differs");
    expect(installOpenSpecBlockMock).toHaveBeenCalledTimes(1);
    expect(installOpenSpecBlockMock).toHaveBeenCalledWith(
      root,
      STANDARDS,
      expect.anything(),
    );
  });

  it("short-circuits when AGENTS.md is already in sync", () => {
    agentsInSync();

    syncEmployeeStandards(tmpDir, root, false, true);

    expect(logText()).toContain("already in sync");
    expect(installOpenSpecBlockMock).not.toHaveBeenCalled();
  });

  it("treats a symlinked CLAUDE.md as drift-tracked via AGENTS.md", () => {
    agentsInSync();
    existingPaths.add(claudePath);
    symlinks.set(claudePath, true);

    syncEmployeeStandards(tmpDir, root, true, true);

    expect(logText()).toContain("drift tracked via AGENTS.md");
    expect(logText()).toContain("already in sync");
    expect(installClaudeWrapperMock).not.toHaveBeenCalled();
  });

  it("warns on a bare @AGENTS.md import in CLAUDE.md without rewriting", () => {
    agentsInSync();
    existingPaths.add(claudePath);
    contentsByPath.set(claudePath, "my project notes\n@AGENTS.md\nmore notes\n");

    syncEmployeeStandards(tmpDir, root, true, true);

    expect(logText()).toContain("裸 @AGENTS.md 导入");
    expect(installClaudeWrapperMock).not.toHaveBeenCalled();
  });

  it("gates the CLAUDE.md wrapper on claude command-artifact authorization", () => {
    agentsInSync();
    // CLAUDE.md missing + claude NOT authorized → wrapper is not created
    syncEmployeeStandards(tmpDir, root, false, true);
    expect(installClaudeWrapperMock).not.toHaveBeenCalled();

    // claude authorized + wrapper missing → installed
    syncEmployeeStandards(tmpDir, root, true, true);
    expect(installClaudeWrapperMock).toHaveBeenCalledTimes(1);
  });
});