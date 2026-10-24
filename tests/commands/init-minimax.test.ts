import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from "fs";
import { tmpdir } from "os";
import { join } from "path";

// init shells `npx openspec --version`, `node --version`, `npm --version`
// during prerequisites — stub execFileSync so hermetic runs don't depend on PATH.
vi.mock("child_process", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("child_process")>();
  return {
    ...actual,
    execFileSync: vi.fn((file: string, args: string[]) => {
      if (file === "npx" && args[0] === "openspec") return "1.11.0";
      if (file === "node") return "v22.0.0";
      if (file === "npm") return "10.0.0";
      throw new Error(`unexpected execFileSync: ${file}`);
    }),
  };
});

import { init } from "../../src/commands/init.js";

const SKILL_REL = join(".agents", "skills", "opsx-e2e", "SKILL.md");

describe("init --tools minimax", () => {
  let tmpRoot: string;
  let cwdSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), "ospw-pw-init-minimax-"));
    mkdirSync(join(tmpRoot, "openspec"), { recursive: true });
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tmpRoot);
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cwdSpy.mockRestore();
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("installs the skill, the AGENTS.md block and the MCP entry", async () => {
    await init({ mcp: true, tools: "minimax", frontend: true }, { isTTY: false });

    // The skill is the only command artifact MiniMax Code needs.
    const skill = join(tmpRoot, SKILL_REL);
    expect(existsSync(skill)).toBe(true);
    const content = readFileSync(skill, "utf-8");
    expect(content).toContain("name: opsx-e2e");
    expect(content).not.toContain("/opsx:");

    // AGENTS.md stays the single source of truth — no wrapper file.
    expect(existsSync(join(tmpRoot, "AGENTS.md"))).toBe(true);
    expect(existsSync(join(tmpRoot, "MINIMAX.md"))).toBe(false);

    // Playwright MCP lands in the project-root .mcp.json.
    const mcp = JSON.parse(readFileSync(join(tmpRoot, ".mcp.json"), "utf-8"));
    expect(mcp.mcpServers["playwright-test"]).toBeDefined();
  });

  it("writes no MCP entry when MCP is disabled", async () => {
    await init({ mcp: false, tools: "minimax", frontend: true }, { isTTY: false });

    // The skill still installs — only the MCP phase is skipped.
    expect(existsSync(join(tmpRoot, SKILL_REL))).toBe(true);
    expect(existsSync(join(tmpRoot, ".mcp.json"))).toBe(false);
  });

  it("is idempotent — a second run leaves the artifacts unchanged", async () => {
    await init({ mcp: true, tools: "minimax", frontend: true }, { isTTY: false });
    const skill = join(tmpRoot, SKILL_REL);
    const before = readFileSync(skill, "utf-8");

    await init({ mcp: true, tools: "minimax", frontend: true }, { isTTY: false });

    expect(readFileSync(skill, "utf-8")).toBe(before);
    const mcp = JSON.parse(readFileSync(join(tmpRoot, ".mcp.json"), "utf-8"));
    expect(Object.keys(mcp.mcpServers)).toEqual(["playwright-test"]);
  });
});
