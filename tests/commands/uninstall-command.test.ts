import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

// Keep real shared exports, stub only detectCodeGraphStatus so the
// CodeGraph cleanup note is controllable without touching the real CLI.
vi.mock("../../src/shared/index.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../src/shared/index.js")>();
  return { ...actual, detectCodeGraphStatus: vi.fn() };
});

// Keep real editors exports, stub detectAdapters so uninstall only sees
// the adapters this test controls (no real ~/.claude.json etc).
vi.mock("../../src/commands/editors.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../src/commands/editors.js")>();
  return { ...actual, detectAdapters: vi.fn() };
});

import { detectCodeGraphStatus } from "../../src/shared/index.js";
import { detectAdapters, cursorAdapter } from "../../src/commands/editors.js";
import { uninstall } from "../../src/commands/uninstall.js";

const mockedDetectCodeGraphStatus = vi.mocked(detectCodeGraphStatus);
const mockedDetectAdapters = vi.mocked(detectAdapters);

let tmp: string;
let cwd: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "ospw-uninstall-"));
  cwd = process.cwd();
  process.chdir(tmp);
  mockedDetectCodeGraphStatus.mockReset();
  mockedDetectAdapters.mockReset();
});

afterEach(() => {
  process.chdir(cwd);
  rmSync(tmp, { recursive: true, force: true });
});

describe("uninstall() CodeGraph cleanup note", () => {
  it("prints codegraph uninstall note when the MCP is installed", async () => {
    mockedDetectAdapters.mockReturnValue([cursorAdapter]);
    mockedDetectCodeGraphStatus.mockReturnValue({
      cliInstalled: true,
      indexed: true,
      mcpInstalledAdapters: ["cursor"],
    });

    const spy = vi.spyOn(console, "log");
    await uninstall();
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("codegraph uninstall"),
    );
    spy.mockRestore();
  });

  it("prints no codegraph note when the MCP is not installed", async () => {
    mockedDetectAdapters.mockReturnValue([cursorAdapter]);
    mockedDetectCodeGraphStatus.mockReturnValue({
      cliInstalled: true,
      indexed: true,
      mcpInstalledAdapters: [],
    });

    const spy = vi.spyOn(console, "log");
    await uninstall();
    expect(spy).not.toHaveBeenCalledWith(
      expect.stringContaining("codegraph uninstall"),
    );
    spy.mockRestore();
  });
});

// ─── Characterization: section order + artifact removal ───────────────────
// Guards the section-major output and cleanup semantics before/while the
// implementation is refactored to call removal.ts primitives.

describe("uninstall() characterization (section output + file removal)", () => {
  let cwd: string;

  beforeEach(() => {
    cwd = process.cwd();
  });

  afterEach(() => {
    process.chdir(cwd);
  });

  it("removes cursor artifacts + MCP entry + legacy skill + AGENTS.md block in section order", async () => {
    mockedDetectAdapters.mockReturnValue([cursorAdapter]);
    mockedDetectCodeGraphStatus.mockReturnValue({
      cliInstalled: false,
      indexed: false,
      mcpInstalledAdapters: [],
    });

    // Set up a full cursor install + AGENTS.md shared block
    mkdirSync(join(tmp, ".cursor", "commands"), { recursive: true });
    writeFileSync(join(tmp, ".cursor", "commands", "opsx-e2e.md"), "cmd");
    mkdirSync(join(tmp, ".cursor", "skills", "opsx-e2e"), { recursive: true });
    writeFileSync(join(tmp, ".cursor", "skills", "opsx-e2e", "SKILL.md"), "s");
    mkdirSync(join(tmp, ".cursor"), { recursive: true });
    writeFileSync(
      join(tmp, ".cursor", "mcp.json"),
      JSON.stringify({
        mcpServers: { "playwright-test": { command: "npx", args: ["p"] } },
      }),
    );
    mkdirSync(join(tmp, ".claude", "skills", "openspec-e2e"), { recursive: true });
    writeFileSync(join(tmp, ".claude", "skills", "openspec-e2e", "SKILL.md"), "legacy");
    writeFileSync(
      join(tmp, "AGENTS.md"),
      "user\n\n<!-- OPENSPEC-PW:START -->\nstandards\n<!-- OPENSPEC-PW:END -->\n",
    );

    const lines: string[] = [];
    const spy = vi.spyOn(console, "log");
    spy.mockImplementation((msg?: unknown) => lines.push(String(msg)));
    try {
      await uninstall();
    } finally {
      spy.mockRestore();
    }

    // Section headers appear in the fixed section-major order
    const sectionOrder = [
      "Removing Playwright MCP",
      "Removing E2E Commands",
      "Removing Legacy Skill",
      "Removing Retired dsh Skill",
      "Removing Schema",
      "Cleaning Rules Files",
      "Summary",
    ];
    const positions = sectionOrder.map((s) =>
      lines.findIndex((l) => String(l).includes(s)),
    );
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);

    // Artifacts are gone
    expect(existsSync(join(tmp, ".cursor", "commands", "opsx-e2e.md"))).toBe(false);
    expect(existsSync(join(tmp, ".cursor", "skills", "opsx-e2e", "SKILL.md"))).toBe(false);
    // mcp.json is rewritten, not deleted — the entry inside it is gone
    const mcpAfter = JSON.parse(
      (await import("fs")).readFileSync(join(tmp, ".cursor", "mcp.json"), "utf-8"),
    );
    expect(mcpAfter.mcpServers["playwright-test"]).toBeUndefined();
    expect(existsSync(join(tmp, ".claude", "skills", "openspec-e2e"))).toBe(false);
    // AGENTS.md marker block removed, user content kept
    const agents = existsSync(join(tmp, "AGENTS.md"))
      ? String(join(tmp, "AGENTS.md"))
      : "";
    if (agents) {
      const content = (await import("fs")).readFileSync(agents, "utf-8");
      expect(content).toContain("user");
    }
  });
});