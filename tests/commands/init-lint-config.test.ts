import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
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

// init shells tool version probes during prerequisites — stub them so
// hermetic runs don't depend on PATH (same pattern as tests/agents.test.ts).
vi.mock("child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("child_process")>();
  return {
    ...actual,
    execFileSync: vi.fn((file: string, args: string[]) => {
      if (file === "npx" && args[0] === "openspec") return "1.11.0";
      if (file === "npx" && args[0] === "playwright") return "1.62.1";
      if (file === "node") return "v22.0.0";
      if (file === "npm") return "10.0.0";
      throw new Error(`unexpected execFileSync: ${file}`);
    }),
  };
});

import { init, lintConfigSnippet } from "../../src/commands/init.js";
import { LINT_ESLINT_GENERATED_MARKER } from "../../src/shared/index.js";

describe("lintConfigSnippet (existing-config guidance)", () => {
  it("flat config → flat-config snippet object", () => {
    const snippet = lintConfigSnippet({
      tool: "ESLint",
      action: "snippet",
      file: "/repo/eslint.config.mjs",
    });
    expect(snippet.lines).toEqual(['{ rules: { "no-empty": "error" } }']);
  });

  it.each([".eslintrc.json", ".eslintrc.yaml", ".eslintrc.yml", ".eslintrc"])(
    "%s → JSON/YAML-compatible quoted form",
    (name) => {
      const snippet = lintConfigSnippet({
        tool: "ESLint",
        action: "snippet",
        file: `/repo/${name}`,
      });
      expect(snippet.lines).toEqual(['"rules": { "no-empty": "error" }']);
    },
  );

  it.each([".eslintrc.js", ".eslintrc.cjs"])(
    "%s → JS object-literal form",
    (name) => {
      const snippet = lintConfigSnippet({
        tool: "ESLint",
        action: "snippet",
        file: `/repo/${name}`,
      });
      expect(snippet.lines).toEqual(['rules: { "no-empty": "error" }']);
    },
  );

  it("ruff pyproject → [tool.ruff.lint] header", () => {
    const snippet = lintConfigSnippet({
      tool: "ruff",
      action: "snippet",
      file: "/repo/pyproject.toml",
    });
    expect(snippet.lines).toEqual([
      "[tool.ruff.lint]",
      'extend-select = ["B904"]',
    ]);
  });

  it("ruff dedicated config → [lint] header", () => {
    const snippet = lintConfigSnippet({
      tool: "ruff",
      action: "snippet",
      file: "/repo/.ruff.toml",
    });
    expect(snippet.lines[0]).toBe("[lint]");
  });
});

describe("init --lint-config (real fs, minimal mode)", () => {
  let tmpRoot: string;
  let cwdSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), "ospw-init-lintconfig-"));
    mkdirSync(join(tmpRoot, "openspec"), { recursive: true });
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tmpRoot);
  });

  afterEach(() => {
    cwdSpy.mockRestore();
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("generates eslint.config.mjs in minimal mode (not gated by the frontend scaffold)", async () => {
    // No react dependency → minimal mode; eslint 9 present → generation gate passes.
    writeFileSync(
      join(tmpRoot, "package.json"),
      JSON.stringify({ name: "fixture", devDependencies: { eslint: "^9.0.0" } }),
    );
    await init({ tools: "none", mcp: false, lintConfig: true }, { isTTY: false });
    const config = readFileSync(join(tmpRoot, "eslint.config.mjs"), "utf-8");
    expect(config.startsWith(LINT_ESLINT_GENERATED_MARKER)).toBe(true);
  });

  it("without the flag, init never writes lint configs (default behavior unchanged)", async () => {
    writeFileSync(
      join(tmpRoot, "package.json"),
      JSON.stringify({ name: "fixture", devDependencies: { eslint: "^9.0.0" } }),
    );
    await init({ tools: "none", mcp: false }, { isTTY: false });
    expect(existsSync(join(tmpRoot, "eslint.config.mjs"))).toBe(false);
  });

  it("appends the ruff managed block to pyproject.toml when no eslint is declared", async () => {
    writeFileSync(
      join(tmpRoot, "package.json"),
      JSON.stringify({ name: "fixture" }),
    );
    const original = '[project]\nname = "fixture"\n';
    writeFileSync(join(tmpRoot, "pyproject.toml"), original);
    await init({ tools: "none", mcp: false, lintConfig: true }, { isTTY: false });
    const content = readFileSync(join(tmpRoot, "pyproject.toml"), "utf-8");
    expect(content.startsWith(original)).toBe(true);
    expect(content).toContain("[tool.ruff.lint]");
    expect(content).toContain('extend-select = ["B904"]');
    expect(existsSync(join(tmpRoot, "eslint.config.mjs"))).toBe(false);
  });
});
