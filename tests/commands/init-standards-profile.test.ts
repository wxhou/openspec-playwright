import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from "fs";
import { tmpdir } from "os";
import { join } from "path";

vi.mock("../../src/shared/openspec-version.js", () => ({
  OPENSPEC_LATEST_MAJOR: 2,
  openSpecCliStatus: vi.fn(() => ({ ok: true, major: 1 })),
}));

vi.mock("../../src/shared/exec.js", () => ({
  execFileAsync: vi.fn(),
  hasCommand: vi.fn(() => true),
  execFileSync: vi.fn((file: string, args: string[]) => {
    if (file === "npx" && args[0] === "openspec") return "1.11.0";
    if (file === "node") return "v22.0.0";
    if (file === "npm") return "10.0.0";
    throw new Error(`unexpected execFileSync: ${file}`);
  }),
  spawnSync: vi.fn(),
}));

import { init } from "../../src/commands/init.js";
import type { StandardsProfile } from "../../src/shared/standards-profile.js";

const ML_ANCHOR = "## 1. 评测完整性";
const GENERAL_ANCHOR = "## 1. 代码质量";

describe("init employee-standards profile selection", () => {
  let tmpRoot: string;
  let cwdSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), "ospw-profile-init-"));
    mkdirSync(join(tmpRoot, "openspec"), { recursive: true });
    mkdirSync(join(tmpRoot, ".claude"), { recursive: true });
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tmpRoot);
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    cwdSpy.mockRestore();
    logSpy.mockRestore();
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  const agentsText = () =>
    readFileSync(join(tmpRoot, "AGENTS.md"), "utf-8");
  const logText = () =>
    logSpy.mock.calls.map((c: unknown[]) => c.join(" ")).join("\n");

  async function runInit(
    standards?: string,
    profilePrompt?: (
      installed: StandardsProfile | null,
    ) => Promise<StandardsProfile>,
  ): Promise<void> {
    await init(
      { mcp: false, lang: "zh", ...(standards ? { standards } : {}) },
      {
        isTTY: true,
        prompt: async () => ["claude"],
        confirm: async () => true,
        ...(profilePrompt ? { profilePrompt } : {}),
      },
    );
  }

  it("installs the ML profile with --standards ml", async () => {
    await runInit("ml");

    expect(agentsText()).toContain(ML_ANCHOR);
    expect(agentsText()).not.toContain(GENERAL_ANCHOR);
    expect(logText()).toContain("(ML)");
  });

  it("defaults to the general profile without a flag and no prompt", async () => {
    await runInit();

    expect(agentsText()).toContain(GENERAL_ANCHOR);
    expect(agentsText()).not.toContain(ML_ANCHOR);
    expect(logText()).toContain("(general)");
  });

  it("keeps an installed ML block on a flagless rerun", async () => {
    await runInit("ml");
    await runInit();

    expect(agentsText()).toContain(ML_ANCHOR);
    expect(logText()).toContain("(ML)");
  });

  it("switches an installed ML block back to general when asked", async () => {
    await runInit("ml");
    await runInit("general");

    expect(agentsText()).toContain(GENERAL_ANCHOR);
    expect(agentsText()).not.toContain(ML_ANCHOR);
  });

  it("uses the interactive answer and passes the installed profile as the default", async () => {
    await runInit("ml");

    const seen: (StandardsProfile | null)[] = [];
    await runInit(undefined, async (installed) => {
      seen.push(installed);
      return "general";
    });

    expect(seen).toEqual(["ml"]);
    expect(agentsText()).toContain(GENERAL_ANCHOR);
  });

  it("does not prompt when --standards is given", async () => {
    const prompt = vi.fn(async () => "general" as StandardsProfile);
    await runInit("ml", prompt);

    expect(prompt).not.toHaveBeenCalled();
    expect(agentsText()).toContain(ML_ANCHOR);
  });

  it("does not install standards with --tools none", async () => {
    await init(
      { mcp: false, tools: "none", lang: "zh", standards: "ml" },
      { isTTY: true, prompt: async () => ["claude"], confirm: async () => true },
    );

    expect(existsSync(join(tmpRoot, "AGENTS.md"))).toBe(false);
  });
});
