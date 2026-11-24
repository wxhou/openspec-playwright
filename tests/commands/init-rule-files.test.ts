import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "fs";
import { tmpdir } from "os";
import { join } from "path";

// The OpenSpec CLI version comes from the machine — pin it so the suite does
// not depend on which CLI is installed.
vi.mock("../../src/shared/openspec-version.js", () => ({
  OPENSPEC_LATEST_MAJOR: 2,
  openSpecCliStatus: vi.fn(() => ({ ok: true, major: 1 })),
}));

// init shells out for prerequisites — stub the wrapper so hermetic runs do
// not depend on PATH.
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
import {
  ensureGitignoreEntries,
  readManagedSkips,
} from "../../src/shared/gitignore-managed.js";

describe("init rule-copy opt-out (--no-rule-files)", () => {
  let tmpRoot: string;
  let cwdSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), "ospw-pw-rule-files-"));
    mkdirSync(join(tmpRoot, "openspec"), { recursive: true });
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tmpRoot);
  });

  afterEach(() => {
    cwdSpy.mockRestore();
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  async function runInit(ruleFiles?: boolean): Promise<void> {
    await init(
      { mcp: false, ruleFiles },
      {
        isTTY: true,
        prompt: async () => ["claude"],
        confirm: async () => true,
      },
    );
  }

  it("cleans existing copies and records the opt-out even with --tools none", async () => {
    await runInit();
    expect(existsSync(join(tmpRoot, "CLAUDE.md"))).toBe(true);

    await init(
      { mcp: false, ruleFiles: false, tools: "none" },
      {
        isTTY: true,
        prompt: async () => ["claude"],
        confirm: async () => true,
      },
    );

    expect(existsSync(join(tmpRoot, "CLAUDE.md"))).toBe(false);
    expect(readManagedSkips(tmpRoot)).toContain("CLAUDE.md");
    expect(existsSync(join(tmpRoot, "AGENTS.md"))).toBe(true);
  });

  it("records the carrier skip and still installs AGENTS.md", async () => {
    await runInit(false);

    expect(existsSync(join(tmpRoot, "AGENTS.md"))).toBe(true);
    expect(readFileSync(join(tmpRoot, "AGENTS.md"), "utf-8")).toContain(
      "<!-- OPENSPEC-PW:START -->",
    );
    expect(existsSync(join(tmpRoot, "CLAUDE.md"))).toBe(false);
    expect(readManagedSkips(tmpRoot)).toContain("CLAUDE.md");
    // Carriers leave the managed block so a user-owned same-name file stays
    // committable — only the skip line may mention them.
    const blockLines = readFileSync(join(tmpRoot, ".gitignore"), "utf-8")
      .split("\n")
      .map((line) => line.trim());
    expect(blockLines).not.toContain("CLAUDE.md");
  });

  it("skips full-standards copies for every selected editor", async () => {
    await init(
      { mcp: false, ruleFiles: false },
      {
        isTTY: true,
        prompt: async () => ["claude", "gemini", "qwen"],
        confirm: async () => true,
      },
    );

    expect(existsSync(join(tmpRoot, "AGENTS.md"))).toBe(true);
    for (const file of ["CLAUDE.md", "GEMINI.md", "QWEN.md"]) {
      expect(existsSync(join(tmpRoot, file))).toBe(false);
    }
  });

  it.skipIf(process.platform === "win32")(
    "explains that an unwritable .gitignore cannot persist the opt-out",
    async () => {
      writeFileSync(join(tmpRoot, ".gitignore"), "node_modules/\n");
      chmodSync(join(tmpRoot, ".gitignore"), 0o444);
      const logs: string[] = [];
      const logSpy = vi
        .spyOn(console, "log")
        .mockImplementation((message: unknown) => {
          logs.push(String(message));
        });
      try {
        await runInit(false);
      } finally {
        logSpy.mockRestore();
        chmodSync(join(tmpRoot, ".gitignore"), 0o644);
      }

      expect(logs.join("\n")).toContain("could not be recorded");
      expect(existsSync(join(tmpRoot, "CLAUDE.md"))).toBe(false);
    },
  );

  it.skipIf(process.platform === "win32")(
    "explains that an unwritable .gitignore cannot record the restoration",
    async () => {
      await runInit(false);
      chmodSync(join(tmpRoot, ".gitignore"), 0o444);
      const logs: string[] = [];
      const logSpy = vi
        .spyOn(console, "log")
        .mockImplementation((message: unknown) => {
          logs.push(String(message));
        });
      try {
        await runInit(true);
      } finally {
        logSpy.mockRestore();
        chmodSync(join(tmpRoot, ".gitignore"), 0o644);
      }

      expect(logs.join("\n")).toContain("restoration could not be recorded");
      expect(existsSync(join(tmpRoot, "CLAUDE.md"))).toBe(true);
    },
  );

  it.skipIf(process.platform === "win32")(
    "keeps pipeline-committed paths out of the failure advisory",
    async () => {
      writeFileSync(join(tmpRoot, ".gitignore"), "node_modules/\n");
      chmodSync(join(tmpRoot, ".gitignore"), 0o444);
      const logs: string[] = [];
      const logSpy = vi
        .spyOn(console, "log")
        .mockImplementation((message: unknown) => {
          logs.push(String(message));
        });
      try {
        await init(
          { mcp: false, ruleFiles: false, autoPipeline: true },
          {
            isTTY: true,
            prompt: async () => ["claude"],
            confirm: async () => true,
          },
        );
      } finally {
        logSpy.mockRestore();
        chmodSync(join(tmpRoot, ".gitignore"), 0o644);
      }

      const advisory = logs.find((line) =>
        line.includes("Could not update .gitignore"),
      );
      expect(advisory).toBeDefined();
      // openspec/ is committed for the pipeline, so it must not be reported
      // as an uncovered path.
      expect(advisory).not.toContain("openspec/");
    },
  );

  it("removes an existing pristine wrapper copy", async () => {
    await runInit();
    expect(existsSync(join(tmpRoot, "CLAUDE.md"))).toBe(true);

    await runInit(false);
    expect(existsSync(join(tmpRoot, "CLAUDE.md"))).toBe(false);
  });

  it("leaves a wrapper symlinked to AGENTS.md alone", async () => {
    symlinkSync("AGENTS.md", join(tmpRoot, "CLAUDE.md"));

    await runInit(false);

    expect(lstatSync(join(tmpRoot, "CLAUDE.md")).isSymbolicLink()).toBe(true);
    expect(readFileSync(join(tmpRoot, "AGENTS.md"), "utf-8")).toContain(
      "<!-- OPENSPEC-PW:START -->",
    );
  });

  it("a re-run without the flag keeps the opt-out and unrelated skips", async () => {
    await runInit(false);
    ensureGitignoreEntries(tmpRoot, { skip: ["CLAUDE.md", "tmp/"] });

    await runInit();

    expect(existsSync(join(tmpRoot, "CLAUDE.md"))).toBe(false);
    const skips = readManagedSkips(tmpRoot);
    expect(skips).toContain("CLAUDE.md");
    expect(skips).toContain("tmp/");
  });

  it("--rule-files restores the wrapper and drops the carrier skip", async () => {
    await runInit(false);
    ensureGitignoreEntries(tmpRoot, { skip: ["CLAUDE.md", "tmp/"] });

    await runInit(true);

    expect(existsSync(join(tmpRoot, "CLAUDE.md"))).toBe(true);
    const skips = readManagedSkips(tmpRoot);
    expect(skips).not.toContain("CLAUDE.md");
    expect(skips).toContain("tmp/");
    expect(
      readFileSync(join(tmpRoot, ".gitignore"), "utf-8")
        .split("\n")
        .map((line) => line.trim()),
    ).toContain("CLAUDE.md");
  });
});
