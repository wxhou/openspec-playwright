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
// installProjectRules is the side effect under assertion; everything else
// from editors.js stays real (claudeWrapperStandardsContent is pure).
vi.mock("../src/commands/editors.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../src/commands/editors.js")>();
  return { ...actual, installProjectRules: vi.fn() };
});

import {
  existsSync,
  readFileSync,
  lstatSync,
} from "fs";
import { execFile } from "node:child_process";
import { join } from "path";
import { update, syncEmployeeStandards } from "../src/commands/update.js";
import { installProjectRules } from "../src/commands/editors.js";
import { OPENSPEC_START, OPENSPEC_END } from "../src/shared/drift.js";

const existsSyncMock = vi.mocked(existsSync);
const readFileSyncMock = vi.mocked(readFileSync);
const lstatSyncMock = vi.mocked(lstatSync);
const execFileMock = vi.mocked(execFile);
const installProjectRulesMock = vi.mocked(installProjectRules);

const STANDARDS = "employee-grade standards body v1";

/** Fake detected adapter — syncEmployeeStandards only reads `.id`. */
function fakeAdapter(id: string) {
  return { id, label: id } as unknown as Parameters<
    typeof syncEmployeeStandards
  >[2][number];
}

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

  it("skips with a hint when no supported editor is detected", () => {
    syncEmployeeStandards(tmpDir, root, []);

    expect(logText()).toContain("No supported editor");
    expect(installProjectRulesMock).not.toHaveBeenCalled();
  });

  it("returns silently when the bundled standards template is missing", () => {
    existingPaths.clear();

    syncEmployeeStandards(tmpDir, root, [fakeAdapter("opencode")]);

    expect(logText()).toBe("");
    expect(installProjectRulesMock).not.toHaveBeenCalled();
  });

  it("treats a symlinked CLAUDE.md as drift-tracked via AGENTS.md", () => {
    agentsInSync();
    existingPaths.add(claudePath);
    symlinks.set(claudePath, true);

    syncEmployeeStandards(tmpDir, root, [fakeAdapter("claude")]);

    expect(logText()).toContain("drift tracked via AGENTS.md");
    expect(logText()).toContain("already in sync");
    expect(installProjectRulesMock).not.toHaveBeenCalled();
  });

  it("rewrites rules files when the AGENTS.md OPENSPEC block is stale", () => {
    existingPaths.add(agentsPath);
    contentsByPath.set(
      agentsPath,
      `${OPENSPEC_START}\noutdated standards body\n${OPENSPEC_END}`,
    );

    const detected = [fakeAdapter("opencode")];
    syncEmployeeStandards(tmpDir, root, detected);

    expect(logText()).toContain("OPENSPEC block differs");
    expect(installProjectRulesMock).toHaveBeenCalledTimes(1);
    expect(installProjectRulesMock).toHaveBeenCalledWith(
      root,
      STANDARDS,
      detected,
    );
  });

  it("short-circuits when AGENTS.md is already in sync", () => {
    agentsInSync();

    syncEmployeeStandards(tmpDir, root, [fakeAdapter("opencode")]);

    expect(logText()).toContain("already in sync");
    expect(installProjectRulesMock).not.toHaveBeenCalled();
  });

  it("warns on a bare @AGENTS.md import in CLAUDE.md without rewriting", () => {
    agentsInSync();
    existingPaths.add(claudePath);
    contentsByPath.set(claudePath, "my project notes\n@AGENTS.md\nmore notes\n");

    syncEmployeeStandards(tmpDir, root, [fakeAdapter("claude")]);

    expect(logText()).toContain("裸 @AGENTS.md 导入");
    expect(installProjectRulesMock).not.toHaveBeenCalled();
  });
});
