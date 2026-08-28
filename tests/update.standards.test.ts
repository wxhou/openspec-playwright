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

    syncEmployeeStandards(tmpDir, root, false);

    expect(logText()).toBe("");
    expect(installOpenSpecBlockMock).not.toHaveBeenCalled();
  });

  it("skips AGENTS.md write-back when it has no OPENSPEC block (标记即领土) — even with editors detected", () => {
    existingPaths.add(agentsPath);
    contentsByPath.set(agentsPath, "user-authored rules without markers\n");

    syncEmployeeStandards(tmpDir, root, false);

    expect(logText()).toContain("has no OPENSPEC block");
    expect(installOpenSpecBlockMock).not.toHaveBeenCalled();
    expect(installClaudeWrapperMock).not.toHaveBeenCalled();
  });

  it("skips AGENTS.md write-back when the file is missing — regardless of detected editors", () => {
    syncEmployeeStandards(tmpDir, root, false);

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

    syncEmployeeStandards(tmpDir, root, false);

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

    syncEmployeeStandards(tmpDir, root, false);

    expect(logText()).toContain("already in sync");
    expect(installOpenSpecBlockMock).not.toHaveBeenCalled();
  });

  it("treats a symlinked CLAUDE.md as drift-tracked via AGENTS.md", () => {
    agentsInSync();
    existingPaths.add(claudePath);
    symlinks.set(claudePath, true);

    syncEmployeeStandards(tmpDir, root, true);

    expect(logText()).toContain("drift tracked via AGENTS.md");
    expect(logText()).toContain("already in sync");
    expect(installClaudeWrapperMock).not.toHaveBeenCalled();
  });

  it("warns on a bare @AGENTS.md import in CLAUDE.md without rewriting", () => {
    agentsInSync();
    existingPaths.add(claudePath);
    contentsByPath.set(claudePath, "my project notes\n@AGENTS.md\nmore notes\n");

    syncEmployeeStandards(tmpDir, root, true);

    expect(logText()).toContain("裸 @AGENTS.md 导入");
    expect(installClaudeWrapperMock).not.toHaveBeenCalled();
  });

  it("gates the CLAUDE.md wrapper on claude command-artifact authorization", () => {
    agentsInSync();
    // CLAUDE.md missing + claude NOT authorized → wrapper is not created
    syncEmployeeStandards(tmpDir, root, false);
    expect(installClaudeWrapperMock).not.toHaveBeenCalled();

    // claude authorized + wrapper missing → installed
    syncEmployeeStandards(tmpDir, root, true);
    expect(installClaudeWrapperMock).toHaveBeenCalledTimes(1);
  });
});