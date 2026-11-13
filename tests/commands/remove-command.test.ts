import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { fileURLToPath } from "url";

// Keep real shared exports, stub only detectCodeGraphStatus so the
// CodeGraph cleanup note is controllable without touching the real CLI.
// removeChecklist stays real unless a test overrides it.
vi.mock("../../src/shared/index.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../src/shared/index.js")>();
  return { ...actual, detectCodeGraphStatus: vi.fn(), removeChecklist: vi.fn(actual.removeChecklist) };
});

// Keep real editors exports, stub detectAdapters so the removal only sees
// the adapters this test controls (no real ~/.claude.json etc).
vi.mock("../../src/commands/editors.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../src/commands/editors.js")>();
  return { ...actual, detectAdapters: vi.fn() };
});

import {
  detectCodeGraphStatus,
  removeChecklist,
  generatedEslintConfigVariants,
} from "../../src/shared/index.js";
import { detectAdapters, cursorAdapter } from "../../src/commands/editors.js";
import {
  removeInProject,
  removeSingle,
  RemoveError,
} from "../../src/commands/remove.js";

const mockedDetectCodeGraphStatus = vi.mocked(detectCodeGraphStatus);
const mockedDetectAdapters = vi.mocked(detectAdapters);
const mockedRemoveChecklist = vi.mocked(removeChecklist);

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "ospw-remove-"));
  mockedDetectCodeGraphStatus.mockReset();
  mockedDetectAdapters.mockReset();
  mockedDetectAdapters.mockReturnValue([]);
  mockedDetectCodeGraphStatus.mockReturnValue({
    cliInstalled: false,
    indexed: false,
    mcpInstalledAdapters: [],
  });
  mockedRemoveChecklist.mockClear();
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("removeInProject() CodeGraph cleanup note", () => {
  it("prints codegraph uninstall note when the MCP is installed", async () => {
    mockedDetectAdapters.mockReturnValue([cursorAdapter]);
    mockedDetectCodeGraphStatus.mockReturnValue({
      cliInstalled: true,
      indexed: true,
      mcpInstalledAdapters: ["cursor"],
    });

    const spy = vi.spyOn(console, "log");
    await removeInProject(tmp);
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("codegraph uninstall"),
    );
    spy.mockRestore();
  });

  it("prints no codegraph note when the MCP is not installed", async () => {
    mockedDetectAdapters.mockReturnValue([cursorAdapter]);

    const spy = vi.spyOn(console, "log");
    await removeInProject(tmp);
    expect(spy).not.toHaveBeenCalledWith(
      expect.stringContaining("codegraph uninstall"),
    );
    spy.mockRestore();
  });
});

// ─── Characterization: section order + artifact removal ───────────────────

describe("removeInProject() characterization (section output + file removal)", () => {
  it("removes cursor artifacts + MCP entry + legacy skill + AGENTS.md block in section order", async () => {
    mockedDetectAdapters.mockReturnValue([cursorAdapter]);

    mkdirSync(join(tmp, ".cursor", "commands"), { recursive: true });
    writeFileSync(join(tmp, ".cursor", "commands", "opsx-e2e.md"), "cmd");
    mkdirSync(join(tmp, ".cursor", "skills", "opsx-e2e"), { recursive: true });
    writeFileSync(join(tmp, ".cursor", "skills", "opsx-e2e", "SKILL.md"), "s");
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
      await removeInProject(tmp);
    } finally {
      spy.mockRestore();
    }

    const sectionOrder = [
      "Removing Playwright MCP",
      "Removing E2E Commands",
      "Removing Legacy Skill",
      "Removing Schema",
      "Cleaning Rules Files",
      "Summary",
    ];
    const positions = sectionOrder.map((s) =>
      lines.findIndex((l) => String(l).includes(s)),
    );
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(lines.join("\n")).not.toContain("Retired");

    expect(existsSync(join(tmp, ".cursor", "commands", "opsx-e2e.md"))).toBe(false);
    expect(existsSync(join(tmp, ".cursor", "skills", "opsx-e2e", "SKILL.md"))).toBe(false);
    const mcpAfter = JSON.parse(readFileSync(join(tmp, ".cursor", "mcp.json"), "utf-8"));
    expect(mcpAfter.mcpServers["playwright-test"]).toBeUndefined();
    expect(existsSync(join(tmp, ".claude", "skills", "openspec-e2e"))).toBe(false);
    const agentsAfter = readFileSync(join(tmp, "AGENTS.md"), "utf-8");
    expect(agentsAfter).toContain("user");
    expect(agentsAfter).not.toContain("OPENSPEC-PW:START");
  });
});

// ─── Lint-config products ─────────────────────────────────────────────────

describe("removeInProject() lint config", () => {
  it("removes the ruff managed block and deletes a block-only file", async () => {
    const ruffConfig =
      '# openspec-pw: lint-guidelines begin\n[lint]\nextend-select = ["B904"]\n# openspec-pw: lint-guidelines end\n';
    writeFileSync(join(tmp, "ruff.toml"), ruffConfig);

    await removeInProject(tmp);

    expect(existsSync(join(tmp, "ruff.toml"))).toBe(false);
  });

  it("keeps bytes outside the ruff block intact", async () => {
    const before = '[project]\nname = "demo"\n\n';
    const after = "\n[tool.black]\nline-length = 88\n";
    writeFileSync(
      join(tmp, "pyproject.toml"),
      `${before}# openspec-pw: lint-guidelines begin\n[tool.ruff.lint]\nextend-select = ["B904"]\n# openspec-pw: lint-guidelines end\n${after}`,
    );

    await removeInProject(tmp);

    const content = readFileSync(join(tmp, "pyproject.toml"), "utf-8");
    expect(content).toBe(`${before}${after}`);
  });

  it("removes an unmodified generated eslint config", async () => {
    const generated = generatedEslintConfigVariants()[0];
    writeFileSync(join(tmp, "eslint.config.mjs"), generated);

    await removeInProject(tmp);

    expect(existsSync(join(tmp, "eslint.config.mjs"))).toBe(false);
  });

  it("keeps a modified generated eslint config with a notice", async () => {
    const modified = `${generatedEslintConfigVariants()[0]}\n// my tweak\n`;
    writeFileSync(join(tmp, "eslint.config.mjs"), modified);

    const lines: string[] = [];
    const spy = vi.spyOn(console, "log");
    spy.mockImplementation((msg?: unknown) => lines.push(String(msg)));
    try {
      await removeInProject(tmp);
    } finally {
      spy.mockRestore();
    }

    expect(readFileSync(join(tmp, "eslint.config.mjs"), "utf-8")).toBe(modified);
    expect(lines.some((l) => l.includes("differs from the generated config"))).toBe(true);
  });

  it("never touches a user-authored eslint config", async () => {
    const own = "export default [];\n";
    writeFileSync(join(tmp, "eslint.config.mjs"), own);

    await removeInProject(tmp);

    expect(readFileSync(join(tmp, "eslint.config.mjs"), "utf-8")).toBe(own);
  });
});

// ─── CI workflow ─────────────────────────────────────────────────────────

describe("removeInProject() CI workflow", () => {
  const template = readFileSync(
    fileURLToPath(new URL("../../templates/github-workflow.yml", import.meta.url)),
    "utf-8",
  );

  it("removes the workflow when it matches the bundled template", async () => {
    mkdirSync(join(tmp, ".github", "workflows"), { recursive: true });
    writeFileSync(join(tmp, ".github", "workflows", "openspec-pw.yml"), template);

    await removeInProject(tmp);

    expect(existsSync(join(tmp, ".github", "workflows", "openspec-pw.yml"))).toBe(false);
    // The empty .github/workflows chain is cleaned too.
    expect(existsSync(join(tmp, ".github"))).toBe(false);
  });

  it("keeps a user-modified workflow with a notice", async () => {
    mkdirSync(join(tmp, ".github", "workflows"), { recursive: true });
    const modified = `${template}\n# local tweak\n`;
    writeFileSync(join(tmp, ".github", "workflows", "openspec-pw.yml"), modified);

    const lines: string[] = [];
    const spy = vi.spyOn(console, "log");
    spy.mockImplementation((msg?: unknown) => lines.push(String(msg)));
    try {
      await removeInProject(tmp);
    } finally {
      spy.mockRestore();
    }

    expect(
      readFileSync(join(tmp, ".github", "workflows", "openspec-pw.yml"), "utf-8"),
    ).toBe(modified);
    expect(lines.some((l) => l.includes("differs from the bundled template"))).toBe(true);
  });

  it("removes the auto pipeline workflow when it matches the bundled template", async () => {
    const auto = readFileSync(
      fileURLToPath(new URL("../../templates/auto-pipeline.yml", import.meta.url)),
      "utf-8",
    );
    mkdirSync(join(tmp, ".github", "workflows"), { recursive: true });
    writeFileSync(join(tmp, ".github", "workflows", "openspec-auto.yml"), auto);

    await removeInProject(tmp);

    expect(existsSync(join(tmp, ".github", "workflows", "openspec-auto.yml"))).toBe(false);
  });

  it("keeps a user-modified auto pipeline workflow with a notice", async () => {
    const auto = readFileSync(
      fileURLToPath(new URL("../../templates/auto-pipeline.yml", import.meta.url)),
      "utf-8",
    );
    mkdirSync(join(tmp, ".github", "workflows"), { recursive: true });
    writeFileSync(join(tmp, ".github", "workflows", "openspec-auto.yml"), `${auto}\n# local tweak\n`);

    await removeInProject(tmp);

    expect(existsSync(join(tmp, ".github", "workflows", "openspec-auto.yml"))).toBe(true);
  });
});

// ─── MCP ownership ──────────────────────────────────────────────────────

describe("removeInProject() MCP ownership", () => {
  it("removes a lone playwright-test entry when invoked explicitly", async () => {
    const opencode = join(tmp, "opencode.json");
    writeFileSync(
      opencode,
      JSON.stringify({ mcp: { "playwright-test": { type: "local", command: ["npx"] } } }),
    );

    await removeInProject(tmp);

    expect(readFileSync(opencode, "utf-8")).not.toContain("playwright-test");
  });

  it("leaves the ambiguous legacy playwright entry alone in batch mode", async () => {
    const mcp = join(tmp, ".mcp.json");
    writeFileSync(
      mcp,
      JSON.stringify({ mcpServers: { playwright: { command: "npx" } } }),
    );

    await removeInProject(tmp, { all: true });

    expect(readFileSync(mcp, "utf-8")).toContain("playwright");
  });
});

// ─── Stop hook ───────────────────────────────────────────────────────────

describe("removeInProject() stop hook", () => {
  it("reports failure instead of success when settings.json is unparsable", async () => {
    mkdirSync(join(tmp, ".claude"), { recursive: true });
    writeFileSync(join(tmp, ".claude", "settings.json"), "{ not json");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(await removeSingle(tmp)).toBe(1);
    } finally {
      spy.mockRestore();
    }
  });
});

// ─── Error path ──────────────────────────────────────────────────────────

describe("removeInProject() error path", () => {
  it("wraps a failure in RemoveError with the changes made so far", async () => {
    mockedDetectAdapters.mockReturnValue([cursorAdapter]);
    mkdirSync(join(tmp, ".cursor", "commands"), { recursive: true });
    writeFileSync(join(tmp, ".cursor", "commands", "opsx-e2e.md"), "cmd");
    mockedRemoveChecklist.mockImplementationOnce(() => {
      throw new Error("boom");
    });

    const err = await removeInProject(tmp).then(
      () => null,
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(RemoveError);
    expect((err as RemoveError).modified.length).toBeGreaterThan(0);
  });

  it("removeSingle returns exit code 1 and keeps completed changes", async () => {
    mockedDetectAdapters.mockReturnValue([cursorAdapter]);
    mkdirSync(join(tmp, ".cursor", "commands"), { recursive: true });
    writeFileSync(join(tmp, ".cursor", "commands", "opsx-e2e.md"), "cmd");
    mockedRemoveChecklist.mockImplementationOnce(() => {
      throw new Error("boom");
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const code = await removeSingle(tmp);

    errorSpy.mockRestore();
    expect(code).toBe(1);
    expect(existsSync(join(tmp, ".cursor", "commands", "opsx-e2e.md"))).toBe(false);
  });

  it("removeSingle returns 0 on an uninstalled project (idempotent)", async () => {
    const code = await removeSingle(tmp);
    expect(code).toBe(0);
  });
});

// ─── User data ───────────────────────────────────────────────────────────

describe("removeInProject() user data", () => {
  it("never deletes credentials, real tests, or openspec specs", async () => {
    mkdirSync(join(tmp, "tests", "playwright", "changes", "demo"), { recursive: true });
    writeFileSync(join(tmp, "tests", "playwright", "credentials.yaml"), "username: u\n");
    writeFileSync(
      join(tmp, "tests", "playwright", "changes", "demo", "demo.spec.ts"),
      "// real test\n",
    );
    mkdirSync(join(tmp, "openspec", "specs", "cap"), { recursive: true });
    writeFileSync(join(tmp, "openspec", "specs", "cap", "spec.md"), "# spec\n");

    await removeInProject(tmp);

    expect(existsSync(join(tmp, "tests", "playwright", "credentials.yaml"))).toBe(true);
    expect(
      existsSync(join(tmp, "tests", "playwright", "changes", "demo", "demo.spec.ts")),
    ).toBe(true);
    expect(existsSync(join(tmp, "openspec", "specs", "cap", "spec.md"))).toBe(true);
  });
});

// ─── Minimal / mixed projects ────────────────────────────────────────────

describe("removeInProject() minimal-mode project (standards only, no command artifacts)", () => {
  it("removes the tool-owned tests/README.md and the standards block with zero detected editors", async () => {
    const template = readFileSync(
      fileURLToPath(new URL("../../templates/tests-readme.md", import.meta.url)),
      "utf-8",
    );
    mkdirSync(join(tmp, "tests"), { recursive: true });
    writeFileSync(join(tmp, "tests", "README.md"), template);
    writeFileSync(
      join(tmp, "AGENTS.md"),
      "user\n\n<!-- OPENSPEC-PW:START -->\nstandards\n<!-- OPENSPEC-PW:END -->\n",
    );

    await removeInProject(tmp);

    expect(existsSync(join(tmp, "tests", "README.md"))).toBe(false);
    const agentsAfter = readFileSync(join(tmp, "AGENTS.md"), "utf-8");
    expect(agentsAfter).toContain("user");
    expect(agentsAfter).not.toContain("OPENSPEC-PW:START");
    expect(agentsAfter).not.toContain("standards");
  });

  it("cleans a rules file larger than the discovery signal cap", async () => {
    const filler = "x".repeat(1024 * 1024 + 16);
    writeFileSync(
      join(tmp, "AGENTS.md"),
      `user\n\n${filler}\n\n<!-- OPENSPEC-PW:START -->\nstandards\n<!-- OPENSPEC-PW:END -->\n`,
    );

    await removeInProject(tmp);

    const after = readFileSync(join(tmp, "AGENTS.md"), "utf-8");
    expect(after).not.toContain("OPENSPEC-PW:START");
    expect(after).toContain("user");
  });

  it("keeps a user-modified tests/README.md with a notice", async () => {
    mkdirSync(join(tmp, "tests"), { recursive: true });
    writeFileSync(join(tmp, "tests", "README.md"), "# my own readme");

    const lines: string[] = [];
    const spy = vi.spyOn(console, "log");
    spy.mockImplementation((msg?: unknown) => lines.push(String(msg)));
    try {
      await removeInProject(tmp);
    } finally {
      spy.mockRestore();
    }

    expect(existsSync(join(tmp, "tests", "README.md"))).toBe(true);
    expect(lines.some((l) => l.includes("kept (user-modified or user-owned)"))).toBe(true);
  });
});

describe("removeInProject() mixed project: cursor detected, claude wrapper only", () => {
  it("cleans the CLAUDE.md wrapper even when claude is not detected", async () => {
    mockedDetectAdapters.mockReturnValue([cursorAdapter]);
    writeFileSync(
      join(tmp, "AGENTS.md"),
      "user\n\n<!-- OPENSPEC-PW:START -->\nstandards\n<!-- OPENSPEC-PW:END -->\n",
    );
    writeFileSync(
      join(tmp, "CLAUDE.md"),
      "preamble\n<!-- OPENSPEC-PW:START -->\nwrapper\n<!-- OPENSPEC-PW:END -->\n",
    );

    await removeInProject(tmp);

    const agentsAfter = readFileSync(join(tmp, "AGENTS.md"), "utf-8");
    const claudeAfter = readFileSync(join(tmp, "CLAUDE.md"), "utf-8");
    expect(agentsAfter).not.toContain("OPENSPEC-PW:START");
    expect(claudeAfter).not.toContain("OPENSPEC-PW:START");
    expect(claudeAfter).toContain("preamble");
  });
});

describe("removeInProject() symlink safety", () => {
  it("does not recurse into a symlinked skills directory", async () => {
    if (process.platform === "win32") return;
    const outside = mkdtempSync(join(tmpdir(), "ospw-outside-"));
    try {
      const skill = join(outside, "skills", "openspec-e2e");
      mkdirSync(skill, { recursive: true });
      writeFileSync(join(skill, "keep.md"), "user file");
      symlinkSync(outside, join(tmp, ".claude"));

      await removeInProject(tmp);

      expect(readFileSync(join(skill, "keep.md"), "utf-8")).toBe("user file");
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it("does not rewrite a symlinked .gitignore", async () => {
    if (process.platform === "win32") return;
    const outside = mkdtempSync(join(tmpdir(), "ospw-outside-"));
    try {
      const external = join(outside, ".gitignore");
      const original =
        "node_modules\n" +
        "# openspec-pw: begin managed block\n" +
        "/tests/playwright/changes/\n" +
        "# openspec-pw: end managed block\n";
      writeFileSync(external, original);
      symlinkSync(external, join(tmp, ".gitignore"));

      await removeInProject(tmp);

      expect(readFileSync(external, "utf-8")).toBe(original);
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it("keeps an official OPENSPEC: block written by the openspec CLI", async () => {
    const official =
      "# Project\n\n<!-- OPENSPEC:START -->\nOfficial instructions.\n<!-- OPENSPEC:END -->\n";
    writeFileSync(join(tmp, "AGENTS.md"), official);

    await removeInProject(tmp);

    expect(readFileSync(join(tmp, "AGENTS.md"), "utf-8")).toBe(official);
  });

  it("skips an MCP config that resolves outside the project", async () => {
    if (process.platform === "win32") return;
    const outside = mkdtempSync(join(tmpdir(), "ospw-outside-"));
    try {
      const external = join(outside, ".mcp.json");
      const config = JSON.stringify({
        mcpServers: { "playwright-test": { command: "npx" } },
      });
      writeFileSync(external, config);
      symlinkSync(external, join(tmp, ".mcp.json"));

      const modified = await removeInProject(tmp);

      expect(modified.some((marker) => marker.startsWith("mcp:"))).toBe(false);
      expect(readFileSync(external, "utf-8")).toBe(config);
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it("skips a Stop hook whose settings resolve outside the project", async () => {
    if (process.platform === "win32") return;
    const outside = mkdtempSync(join(tmpdir(), "ospw-outside-"));
    try {
      const settings = {
        hooks: {
          Stop: [
            {
              hooks: [
                { type: "command", command: "openspec-pw gate --hook --only validate" },
              ],
            },
          ],
        },
      };
      const external = join(outside, "settings.json");
      const original = JSON.stringify(settings, null, 2) + "\n";
      writeFileSync(external, original);
      symlinkSync(outside, join(tmp, ".claude"));

      const modified = await removeInProject(tmp);

      expect(modified.some((marker) => marker.endsWith("settings.json"))).toBe(
        false,
      );
      expect(readFileSync(external, "utf-8")).toBe(original);
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });
});
