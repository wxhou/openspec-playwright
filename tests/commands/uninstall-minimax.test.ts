import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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

// Keep real shared exports, stub only detectCodeGraphStatus so the
// CodeGraph cleanup note is deterministic without touching the real CLI.
vi.mock("../../src/shared/index.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../src/shared/index.js")>();
  return { ...actual, detectCodeGraphStatus: vi.fn(() => ({
    cliInstalled: false,
    indexed: false,
    mcpInstalledAdapters: [],
  })) };
});

import { uninstall } from "../../src/commands/uninstall.js";

// Real detection on purpose: this suite proves the MiniMax Code skill
// artifact alone is enough for uninstall to find the editor.
let tmp: string;
let cwd: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "ospw-uninstall-minimax-"));
  cwd = process.cwd();
  process.chdir(tmp);
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  process.chdir(cwd);
  rmSync(tmp, { recursive: true, force: true });
});

const SKILL = join(".agents", "skills", "opsx-e2e", "SKILL.md");

describe("uninstall() removes MiniMax Code artifacts", () => {
  it("removes the skill and the shared MCP entry, keeps user entries and sibling skills", async () => {
    mkdirSync(join(tmp, ".agents", "skills", "opsx-e2e"), { recursive: true });
    writeFileSync(join(tmp, SKILL), "---\nname: opsx-e2e\n---\n\nbody\n");
    const sibling = join(tmp, ".agents", "skills", "other-skill", "SKILL.md");
    mkdirSync(join(tmp, ".agents", "skills", "other-skill"), { recursive: true });
    writeFileSync(sibling, "# other skill\n");
    writeFileSync(
      join(tmp, ".mcp.json"),
      JSON.stringify({
        mcpServers: {
          "playwright-test": { command: "npx", args: ["p"] },
          "user-server": { command: "uvx", args: ["foo"] },
        },
      }),
    );
    writeFileSync(
      join(tmp, "AGENTS.md"),
      "user content\n\n<!-- OPENSPEC-PW:START -->\nstandards\n<!-- OPENSPEC-PW:END -->\n",
    );

    await uninstall();

    // The openspec-pw skill is gone…
    expect(existsSync(join(tmp, SKILL))).toBe(false);
    // …its MCP entry is gone…
    const mcp = JSON.parse(readFileSync(join(tmp, ".mcp.json"), "utf-8"));
    expect(mcp.mcpServers["playwright-test"]).toBeUndefined();
    // …user-owned MCP entries survive…
    expect(mcp.mcpServers["user-server"]).toBeDefined();
    // …sibling skills survive…
    expect(existsSync(sibling)).toBe(true);
    // …and the openspec-pw block is cleaned out of AGENTS.md.
    const agents = readFileSync(join(tmp, "AGENTS.md"), "utf-8");
    expect(agents).not.toContain("OPENSPEC-PW:START");
    expect(agents).toContain("user content");
  });
});
