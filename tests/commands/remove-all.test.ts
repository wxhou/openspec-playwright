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
