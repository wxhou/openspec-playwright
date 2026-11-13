import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
  };
});

vi.mock("../../src/commands/editors.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../src/commands/editors.js")>();
  return { ...actual, detectAdapters: vi.fn() };
});

import { removeChecklist } from "../../src/shared/index.js";
import {
  LINT_GUIDELINES_RELPATH,
  installOrRefreshChecklist,
} from "../../src/shared/lint-guidelines.js";
import { detectAdapters, cursorAdapter } from "../../src/commands/editors.js";
import { removeOptionError, runRemoveAll } from "../../src/commands/remove.js";

const mockedDetectAdapters = vi.mocked(detectAdapters);
const mockedRemoveChecklist = vi.mocked(removeChecklist);

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
    expect(out).toContain("removed 0 / skipped 1 / failed 1");
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

  it("finds and cleans a project whose only leftover is an MCP entry", async () => {
    // A previous test installs a throwing implementation; this case exercises
    // the happy path and has no checklist on disk.
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
    expect(logs.join("\n")).toContain("removed 3 / skipped 0 / failed 0");
    expect(readFileSync(opencode, "utf-8")).not.toContain("playwright-test");
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

  it("puts the cwd project first in the plan", async () => {
    const outside = join(base, "outside-proj");
    mkdirSync(outside, { recursive: true });
    writeFileSync(join(outside, "AGENTS.md"), MARKERS);

    const logs: string[] = [];
    vi.mocked(console.log).mockImplementation((msg?: unknown) =>
      logs.push(String(msg)),
    );

    await runRemoveAll({ root: [roots], cwd: outside });

    const out = logs.join("\n");
    expect(out.indexOf(`─── ${outside} ───`)).toBeGreaterThan(-1);
    expect(out.indexOf(`─── ${outside} ───`)).toBeLessThan(
      out.indexOf(`─── ${projectA} ───`),
    );
    expect(existsSync(outside)).toBe(true);
  });
});
