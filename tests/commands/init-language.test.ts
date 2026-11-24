import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

// The OpenSpec CLI version comes from the machine — pin it so the suite does
// not depend on which CLI is installed.
vi.mock("../../src/shared/openspec-version.js", () => ({
  OPENSPEC_LATEST_MAJOR: 2,
  openSpecCliStatus: vi.fn(() => ({ ok: true, major: 1 })),
}));

// init shells `npx openspec --version`, `node --version`, `npm --version`
// during prerequisites — stub the command wrapper so hermetic runs don't depend on PATH.
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

const ZH_ANCHOR = "这份代码库是你的";
const EN_ANCHOR = "This codebase is yours";

describe("init employee-standards language selection", () => {
  let tmpRoot: string;
  let cwdSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;
  const savedEnv = { ...process.env };

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), "ospw-lang-init-"));
    mkdirSync(join(tmpRoot, "openspec"), { recursive: true });
    mkdirSync(join(tmpRoot, ".claude"), { recursive: true });
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tmpRoot);
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    cwdSpy.mockRestore();
    logSpy.mockRestore();
    process.env = { ...savedEnv };
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  function agentsText(): string {
    return readFileSync(join(tmpRoot, "AGENTS.md"), "utf-8");
  }

  function logText(): string {
    return logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
  }

  // The exec mock makes the OS probe unavailable, so this pins the fallback path.
  function setSystemLocale(value: string): void {
    for (const key of ["LANGUAGE", "LC_ALL", "LC_MESSAGES", "LANG"]) {
      delete process.env[key];
    }
    process.env.LANG = value;
  }

  async function runInit(lang?: string): Promise<void> {
    await init(
      { mcp: false, ...(lang ? { lang } : {}) },
      { isTTY: true, prompt: async () => ["claude"], confirm: async () => true },
    );
  }

  it("installs the English standards when --lang en is passed", async () => {
    setSystemLocale("zh_CN.UTF-8");

    await runInit("en");

    expect(existsSync(join(tmpRoot, "AGENTS.md"))).toBe(true);
    expect(agentsText()).toContain(EN_ANCHOR);
    expect(agentsText()).not.toContain(ZH_ANCHOR);
    expect(logText()).toContain("installed in English");
  });

  it("falls back to a Chinese terminal locale when the OS language is unavailable", async () => {
    setSystemLocale("zh_CN.UTF-8");

    await runInit();

    expect(agentsText()).toContain(ZH_ANCHOR);
    expect(agentsText()).not.toContain(EN_ANCHOR);
    expect(logText()).toContain("installed in Chinese");
  });

  it("keeps an installed English block over a Chinese system locale", async () => {
    setSystemLocale("zh_CN.UTF-8");
    writeFileSync(
      join(tmpRoot, "AGENTS.md"),
      `user content\n\n<!-- OPENSPEC-PW:START -->\n${EN_ANCHOR}\n<!-- OPENSPEC-PW:END -->\n`,
    );

    await runInit();

    expect(agentsText()).toContain(EN_ANCHOR);
    expect(agentsText()).not.toContain(ZH_ANCHOR);
    expect(logText()).toContain("installed in English");
  });

  it("does not install standards with --tools none", async () => {
    await init(
      { mcp: false, tools: "none", lang: "en" },
      { isTTY: true, prompt: async () => ["claude"], confirm: async () => true },
    );

    expect(existsSync(join(tmpRoot, "AGENTS.md"))).toBe(false);
    expect(logText()).not.toContain("installed in English");
  });
});
