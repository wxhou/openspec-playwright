import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  existsSync,
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

vi.mock("../../src/shared/index.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../src/shared/index.js")>();
  return {
    ...actual,
    detectCodeGraphStatus: vi.fn(() => ({
      cliInstalled: false,
      indexed: false,
      mcpInstalledAdapters: [],
    })),
    removeChecklist: vi.fn(actual.removeChecklist),
    removeMcp: vi.fn(actual.removeMcp),
  };
});

vi.mock("../../src/commands/editors.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../src/commands/editors.js")>();
  return { ...actual, detectAdapters: vi.fn() };
});

import { removeChecklist, removeMcp } from "../../src/shared/index.js";
import {
  LINT_GUIDELINES_RELPATH,
  installOrRefreshChecklist,
  removeChecklist as realRemoveChecklist,
} from "../../src/shared/lint-guidelines.js";
import { removeMcp as realRemoveMcp } from "../../src/shared/mcp.js";
import { detectAdapters, cursorAdapter } from "../../src/commands/editors.js";
import { removeOptionError, runRemoveAll } from "../../src/commands/remove.js";

const mockedDetectAdapters = vi.mocked(detectAdapters);
const mockedRemoveChecklist = vi.mocked(removeChecklist);
const mockedRemoveMcp = vi.mocked(removeMcp);

const MARKERS =
  "user\n\n<!-- OPENSPEC-PW:START -->\nstandards\n<!-- OPENSPEC-PW:END -->\n";

let base: string;
let roots: string;
let projectA: string;
let projectB: string;
let emptyCwd: string;

beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), "ospw-remove-all-"));
  roots = join(base, "scan");
  projectA = join(roots, "proj-a");
  projectB = join(roots, "proj-b");
  emptyCwd = join(base, "cwd");
  for (const dir of [projectA, projectB, emptyCwd]) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(join(projectA, "AGENTS.md"), MARKERS);
  writeFileSync(join(projectB, "AGENTS.md"), MARKERS);
  mockedDetectAdapters.mockReset();
  mockedDetectAdapters.mockReturnValue([]);
  mockedRemoveChecklist.mockClear();
  mockedRemoveChecklist.mockImplementation(realRemoveChecklist);
  mockedRemoveMcp.mockClear();
  mockedRemoveMcp.mockImplementation(realRemoveMcp);
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  rmSync(base, { recursive: true, force: true });
});

describe("removeOptionError", () => {
  it("accepts plain remove and the full --all combinations", () => {
    expect(removeOptionError({})).toBeNull();
    expect(removeOptionError({ all: true })).toBeNull();
    expect(removeOptionError({ all: true, yes: true })).toBeNull();
    expect(removeOptionError({ all: true, root: ["/tmp/x"] })).toBeNull();
  });

  it("rejects --yes and --root without --all", () => {
    expect(removeOptionError({ yes: true })).toContain("require --all");
    expect(removeOptionError({ root: ["/tmp/x"] })).toContain("require --all");
  });

  it("rejects UNC roots", () => {
    expect(removeOptionError({ all: true, root: ["\\\\server\\share"] })).toContain(
      "UNC",
    );
  });
});

describe("runRemoveAll dry run", () => {
  it("prints the plan and changes nothing", async () => {
    const logs: string[] = [];
    vi.mocked(console.log).mockImplementation((msg?: unknown) =>
      logs.push(String(msg)),
    );

    const code = await runRemoveAll({ root: [roots], cwd: emptyCwd });

    expect(code).toBe(0);
    expect(logs.join("\n")).toContain(projectA);
    expect(logs.join("\n")).toContain(projectB);
    expect(logs.join("\n")).toContain("would remove");
    expect(logs.join("\n")).toContain("Dry run");
    // Nothing was written.
    expect(readFileSync(join(projectA, "AGENTS.md"), "utf-8")).toContain(
      "OPENSPEC-PW:START",
    );
    expect(readFileSync(join(projectB, "AGENTS.md"), "utf-8")).toContain(
      "OPENSPEC-PW:START",
    );
  });
});

describe("runRemoveAll --yes", () => {
  it("cleans every discovered project and reports the summary", async () => {
    const logs: string[] = [];
    vi.mocked(console.log).mockImplementation((msg?: unknown) =>
      logs.push(String(msg)),
    );

    const code = await runRemoveAll({ root: [roots], cwd: emptyCwd, yes: true });

    expect(code).toBe(0);
    expect(readFileSync(join(projectA, "AGENTS.md"), "utf-8")).not.toContain(
      "OPENSPEC-PW:START",
    );
    expect(readFileSync(join(projectB, "AGENTS.md"), "utf-8")).not.toContain(
      "OPENSPEC-PW:START",
    );
    expect(logs.join("\n")).toContain("removed 2 / skipped 0 / failed 0");
  });

  it("keeps going after a failure and exits nonzero", async () => {
    mockedDetectAdapters.mockReturnValue([cursorAdapter]);
    // Project A can be modified before the failure (command artifact);
    // project B has nothing touchable before it.
    mkdirSync(join(projectA, ".cursor", "commands"), { recursive: true });
    writeFileSync(join(projectA, ".cursor", "commands", "opsx-e2e.md"), "cmd");
    mockedRemoveChecklist.mockImplementation(() => {
      throw new Error("boom");
    });

    const code = await runRemoveAll({ root: [roots], cwd: emptyCwd, yes: true });

    expect(code).toBe(1);
    const out = vi.mocked(console.log).mock.calls.map((c) => String(c[0])).join("\n");
    // A non-permission failure is never a skip, even when nothing was
    // changed yet — "skipped" would hide a broken project or a tool bug.
    expect(out).toContain("removed 0 / skipped 0 / failed 2");
  });

  it("counts a project that cannot be written as skipped", async () => {
    mockedRemoveChecklist.mockImplementation(() => {
      const err = Object.assign(new Error("EACCES: permission denied"), {
        code: "EACCES",
      });
      throw err;
    });

    const code = await runRemoveAll({ root: [roots], cwd: emptyCwd, yes: true });

    expect(code).toBe(0);
    const out = vi.mocked(console.log).mock.calls.map((c) => String(c[0])).join("\n");
    expect(out).toContain("removed 0 / skipped 2 / failed 0");
  });

  it("fails a project when a later rules file cannot be written", async () => {
    if (process.platform === "win32") return;
    const claude = join(projectA, "CLAUDE.md");
    writeFileSync(
      claude,
      "preamble\n<!-- OPENSPEC-PW:START -->\nwrapper\n<!-- OPENSPEC-PW:END -->\n",
    );
    chmodSync(claude, 0o444);
    try {
      const code = await runRemoveAll({ root: [roots], cwd: emptyCwd, yes: true });

      expect(code).toBe(1);
      const out = vi.mocked(console.log).mock.calls.map((c) => String(c[0])).join("\n");
      expect(out).toContain("failed 1");
      // AGENTS.md was cleaned before the wrapper write failed — a partial
      // success must count as failed, never as skipped.
      expect(readFileSync(join(projectA, "AGENTS.md"), "utf-8")).not.toContain(
        "OPENSPEC-PW:START",
      );
    } finally {
      chmodSync(claude, 0o644);
    }
  });

  it("counts an unwritable MCP config as skipped", async () => {
    // Unclosed marker = discovered but no removable change before the MCP
    // failure recheck.
    writeFileSync(
      join(projectA, "AGENTS.md"),
      "# P\n\n<!-- OPENSPEC-PW:START -->\nunclosed\n",
    );
    writeFileSync(
      join(projectA, ".mcp.json"),
      JSON.stringify({
        mcpServers: { "playwright-test": { command: "npx" } },
      }),
    );
    const original = mockedRemoveMcp.getMockImplementation();
    const permissionError = Object.assign(
      new Error("EACCES: permission denied"),
      { code: "EACCES" },
    );
    mockedRemoveMcp.mockReturnValue({
      removed: false,
      error: permissionError,
    });
    try {
      const code = await runRemoveAll({ root: [roots], cwd: emptyCwd, yes: true });

      expect(code).toBe(0);
      const out = vi.mocked(console.log).mock.calls.map((c) => String(c[0])).join("\n");
      expect(out).toContain("removed 1 / skipped 1 / failed 0");
    } finally {
      if (original) mockedRemoveMcp.mockImplementation(original);
    }
  });

  it("rejects a --root that is a file", async () => {
    const file = join(base, "not-a-dir");
    writeFileSync(file, "x");
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(await runRemoveAll({ root: [file], cwd: emptyCwd })).toBe(2);
    } finally {
      err.mockRestore();
    }
  });

  it("lists the lint checklist only when the project copy is unmodified", async () => {
    const logs: string[] = [];
    vi.mocked(console.log).mockImplementation((msg?: unknown) =>
      logs.push(String(msg)),
    );
    installOrRefreshChecklist(projectA);
    installOrRefreshChecklist(projectB);
    const checklistB = join(projectB, LINT_GUIDELINES_RELPATH);
    writeFileSync(checklistB, readFileSync(checklistB, "utf-8") + "\nuser edit\n");

    await runRemoveAll({ root: [roots], cwd: emptyCwd });

    const out = logs.join("\n");
    expect(out.split("lint checklist").length - 1).toBe(1);
  });

  it("does not target a project whose only leftover is an MCP entry", async () => {
    mockedRemoveChecklist.mockImplementation(() => "absent");
    const projectC = join(roots, "proj-c");
    mkdirSync(projectC, { recursive: true });
    const opencode = join(projectC, "opencode.json");
    writeFileSync(
      opencode,
      JSON.stringify({ mcp: { "playwright-test": { type: "local", command: ["npx"] } } }),
    );
    const logs: string[] = [];
    vi.mocked(console.log).mockImplementation((msg?: unknown) =>
      logs.push(String(msg)),
    );

    const code = await runRemoveAll({ root: [roots], cwd: emptyCwd, yes: true });

    expect(code).toBe(0);
    // The same server name is written by Playwright's own agent init, so a
    // lone entry is not evidence this project used openspec-pw.
    expect(logs.join("\n")).not.toContain(`─── ${projectC} ───`);
    expect(readFileSync(opencode, "utf-8")).toContain("playwright-test");
  });

  it("counts a discovered project with nothing removable as skipped", async () => {
    if (process.platform === "win32") return;
    const projectC = join(roots, "proj-c");
    mkdirSync(projectC, { recursive: true });
    const target = join(base, "shared-agents.md");
    writeFileSync(target, MARKERS);
    try {
      symlinkSync(target, join(projectC, "AGENTS.md"));
    } catch {
      return;
    }
    const logs: string[] = [];
    vi.mocked(console.log).mockImplementation((msg?: unknown) =>
      logs.push(String(msg)),
    );

    await runRemoveAll({ root: [roots], cwd: emptyCwd });
    expect(logs.join("\n")).toContain("(nothing detected — will be skipped)");

    logs.length = 0;
    const code = await runRemoveAll({ root: [roots], cwd: emptyCwd, yes: true });

    expect(code).toBe(0);
    expect(logs.join("\n")).toContain("skipped 1");
  });

  it("lists the stop hook only when it is this tool's hook", async () => {
    const settings = (command: string) =>
      JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: "command", command }] }] } });
    for (const [dir, command] of [
      [projectA, "npm run gate --hook"],
      [projectB, "openspec-pw gate --hook --only validate"],
    ] as const) {
      mkdirSync(join(dir, ".claude"), { recursive: true });
      writeFileSync(join(dir, ".claude", "settings.json"), settings(command));
    }
    const logs: string[] = [];
    vi.mocked(console.log).mockImplementation((msg?: unknown) =>
      logs.push(String(msg)),
    );

    await runRemoveAll({ root: [roots], cwd: emptyCwd });

    const out = logs.join("\n");
    expect(out.split("stop hook").length - 1).toBe(1);
  });

  it("lists vendored agents only for untouched copies", async () => {
    const pristine = readFileSync(
      new URL("../../templates/agents/claude/playwright-test-planner.md", import.meta.url),
      "utf-8",
    );
    for (const [dir, content] of [
      [projectA, "user edit\n"],
      [projectB, pristine],
    ] as const) {
      mkdirSync(join(dir, ".claude", "agents"), { recursive: true });
      writeFileSync(join(dir, ".claude", "agents", "playwright-test-planner.md"), content);
    }
    const logs: string[] = [];
    vi.mocked(console.log).mockImplementation((msg?: unknown) =>
      logs.push(String(msg)),
    );

    await runRemoveAll({ root: [roots], cwd: emptyCwd });

    const out = logs.join("\n");
    expect(out.split("vendored agents").length - 1).toBe(1);
  });

  it("counts a shared MCP config file once per entry", async () => {
    writeFileSync(
      join(projectA, ".mcp.json"),
      JSON.stringify({
        mcpServers: {
          playwright: { command: "npx" },
          "playwright-test": { command: "npx" },
        },
      }),
    );
    const logs: string[] = [];
    vi.mocked(console.log).mockImplementation((msg?: unknown) =>
      logs.push(String(msg)),
    );

    await runRemoveAll({ root: [roots], cwd: emptyCwd });

    // One shared file, one counted entry — not three (claude/codebuddy/minimax).
    // The legacy `playwright` entry is not part of the batch plan.
    expect(logs.join("\n")).toContain("MCP 1");
  });

  it("omits the gitignore group when the managed block is malformed", async () => {
    writeFileSync(join(projectA, ".gitignore"), "# openspec-pw: begin managed block\n");
    const logs: string[] = [];
    vi.mocked(console.log).mockImplementation((msg?: unknown) =>
      logs.push(String(msg)),
    );

    await runRemoveAll({ root: [roots], cwd: emptyCwd });

    expect(logs.join("\n")).not.toContain(".gitignore block");
  });

  it("rejects a --root that does not exist", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(
        await runRemoveAll({ root: [join(base, "missing-root")], cwd: emptyCwd }),
      ).toBe(2);
    } finally {
      err.mockRestore();
    }
  });

  it("does not add the cwd project when --root defines the scope", async () => {
    const outside = join(base, "outside-proj");
    mkdirSync(outside, { recursive: true });
    writeFileSync(join(outside, "AGENTS.md"), MARKERS);

    const logs: string[] = [];
    vi.mocked(console.log).mockImplementation((msg?: unknown) =>
      logs.push(String(msg)),
    );

    await runRemoveAll({ root: [roots], cwd: outside });

    expect(logs.join("\n")).not.toContain(`─── ${outside} ───`);
    expect(existsSync(outside)).toBe(true);
  });
});
