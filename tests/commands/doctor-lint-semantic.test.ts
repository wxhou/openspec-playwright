import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { tmpdir } from "os";
import { join } from "path";
// "fs" is file-wide mocked below — pull the real fns for test fixtures via
// importActual (vitest aliases node:fs onto the same mock).
const realFs = await vi.importActual<typeof import("node:fs")>("node:fs");

// Mock child_process.execFileSync
vi.mock("child_process", () => ({
  execFileSync: vi.fn(),
}));

// Mock fs modules
vi.mock("fs", () => ({
  existsSync: vi.fn(),
  readdirSync: vi.fn(),
  readFileSync: vi.fn(),
  lstatSync: vi.fn(),
}));

// Keep real shared exports, stub CodeGraph detection so doctor's other
// categories stay deterministic without touching the real CLI.
vi.mock("../../src/shared/index.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../src/shared/index.js")>();
  return { ...actual, detectCodeGraphStatus: vi.fn() };
});

// Stub editor detection so the Playwright MCP check sees a healthy editor.
vi.mock("../../src/commands/editors.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../src/commands/editors.js")>();
  return { ...actual, detectAdapters: vi.fn() };
});

// Stub standards drift so the Sync checks pass during the full doctor() run.
vi.mock("../../src/shared/drift.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../src/shared/drift.js")>();
  return {
    ...actual,
    compareBlock: vi.fn(() => ({ stale: false })),
    bundledStandardsPath: vi.fn(() => "/bundled/employee-standards.md"),
  };
});

import { execFileSync } from "child_process";
import { readFileSync, existsSync, readdirSync, lstatSync } from "fs";
import { claudeAdapter, detectAdapters } from "../../src/commands/editors.js";
import { detectCodeGraphStatus } from "../../src/shared/index.js";
import { doctor } from "../../src/commands/doctor.js";

// Semantic lint probes (eslint --print-config / ruff --show-settings).
// Split from doctor.test.ts to keep that file under the 1500-line limit.

describe("doctor lint semantic probes", () => {
  const execLintMock = vi.mocked(execFileSync);
  const existsLintMock = vi.mocked(existsSync);
  const readFileLintMock = vi.mocked(readFileSync);
  const readdirLintMock = vi.mocked(readdirSync);
  const lstatLintMock = vi.mocked(lstatSync);
  const detectCgLintMock = vi.mocked(detectCodeGraphStatus);
  const detectAdaptersLintMock = vi.mocked(detectAdapters);

  let parentRoot: string;
  let semanticRoot: string;
  let cwdSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    detectCgLintMock.mockReturnValue({
      cliInstalled: false,
      indexed: false,
      mcpInstalledAdapters: [],
    });
    execLintMock.mockImplementation((cmd: string) =>
      cmd === "node" || cmd === "npm" || cmd === "npx" ? "v22.0.0" : "",
    );
    existsLintMock.mockImplementation((p: Parameters<typeof existsSync>[0]) => {
      const s = String(p).replace(/\\/g, "/");
      return (
        s.endsWith("playwright.config.ts") ||
        s.endsWith("openspec") ||
        s.endsWith("tests/playwright") ||
        s.endsWith("AGENTS.md") ||
        s.endsWith("CLAUDE.md")
      );
    });
    readFileLintMock.mockImplementation(
      () => "<!-- OPENSPEC-PW:START -->\ncontent\n<!-- OPENSPEC-PW:END -->",
    );
    readdirLintMock.mockReturnValue([] as never);
    lstatLintMock.mockReturnValue({ isSymbolicLink: () => false } as never);
    detectAdaptersLintMock.mockReturnValue([claudeAdapter]);

    parentRoot = realFs.mkdtempSync(join(tmpdir(), "ospw-doctor-semantic-"));
    realFs.mkdirSync(join(parentRoot, ".git"));
    semanticRoot = join(parentRoot, "app");
    realFs.mkdirSync(semanticRoot);
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(semanticRoot);
  });

  afterEach(() => {
    cwdSpy.mockRestore();
    realFs.rmSync(parentRoot, { recursive: true, force: true });
  });

  async function runLintDoctorJson() {
    const logs: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((...args) => {
      logs.push(args.join(" "));
    });
    try {
      await doctor({ json: true });
    } finally {
      spy.mockRestore();
    }
    return JSON.parse(logs.join("\n")) as {
      ok: boolean;
      checks: Array<{ category: string; name: string; ok: boolean; message: string }>;
    };
  }

  const lintRows = (parsed: Awaited<ReturnType<typeof runLintDoctorJson>>) =>
    parsed.checks.filter((c) => c.category === "Lint");

  function fileDirent(name: string) {
    return { name, isFile: () => true, isDirectory: () => false };
  }

  /** Exact-path exists mock: only listed files (plus the health baseline) exist. */
  function mockExists(...files: string[]) {
    const wanted = new Set(files.map((f) => f.replace(/\\/g, "/")));
    existsLintMock.mockImplementation((p: Parameters<typeof existsSync>[0]) => {
      const s = String(p).replace(/\\/g, "/");
      if (wanted.has(s)) return true;
      if (s === join(parentRoot, ".git").replace(/\\/g, "/")) return true;
      return (
        s.endsWith("playwright.config.ts") ||
        s.endsWith("openspec") ||
        s.endsWith("tests/playwright") ||
        s.endsWith("AGENTS.md") ||
        s.endsWith("CLAUDE.md")
      );
    });
  }

  function mockConfigText(file: string, text: string) {
    const target = file.replace(/\\/g, "/");
    readFileLintMock.mockImplementation(
      (p: Parameters<typeof readFileSync>[0]) => {
        const s = String(p).replace(/\\/g, "/");
        if (s === target) return text;
        return "<!-- OPENSPEC-PW:START -->\ncontent\n<!-- OPENSPEC-PW:END -->";
      },
    );
  }

  function mockExec(
    handler: (cmd: string, args: string[]) => string | undefined,
  ) {
    execLintMock.mockImplementation((cmd: string, args: string[]) => {
      if (cmd === "node" || cmd === "npm" || cmd === "npx") return "v22.0.0";
      const result = handler(cmd, args);
      return result ?? "";
    });
  }

  it("inherited recommended resolves no-empty as in effect → silent (literal text lacks it)", async () => {
    const config = join(semanticRoot, "eslint.config.mjs");
    mockExists(config);
    mockConfigText(
      config,
      'import js from "@eslint/js";\nexport default [js.configs.recommended];\n',
    );
    readdirLintMock.mockReturnValue([fileDirent("app.ts")] as never);
    mockExec((cmd, args) =>
      cmd === "eslint" && args[0] === "--print-config"
        ? JSON.stringify({ rules: { "no-empty": [2] } })
        : undefined,
    );
    const parsed = await runLintDoctorJson();
    expect(
      lintRows(parsed).find((c) => c.name === "lint-eslint"),
    ).toBeUndefined();
  });

  it("explicitly disabled no-empty (severity 0) → gap row", async () => {
    const config = join(semanticRoot, "eslint.config.mjs");
    mockExists(config);
    mockConfigText(config, "export default [];\n");
    readdirLintMock.mockReturnValue([fileDirent("app.ts")] as never);
    mockExec((cmd, args) =>
      cmd === "eslint" && args[0] === "--print-config"
        ? JSON.stringify({ rules: { "no-empty": [0, { allowEmptyCatch: true }] } })
        : undefined,
    );
    const parsed = await runLintDoctorJson();
    const row = lintRows(parsed).find((c) => c.name === "lint-eslint");
    expect(row?.ok).toBe(false);
    expect(parsed.ok).toBe(true);
  });

  it("unparsable print-config output → stderr note + literal fallback", async () => {
    const config = join(semanticRoot, "eslint.config.mjs");
    mockExists(config);
    mockConfigText(config, "export default [];\n");
    readdirLintMock.mockReturnValue([fileDirent("app.ts")] as never);
    mockExec((cmd, args) =>
      cmd === "eslint" && args[0] === "--print-config" ? "not json" : undefined,
    );
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const parsed = await runLintDoctorJson();
      expect(errorSpy.mock.calls.join(" ")).toContain(
        "semantic probe unavailable",
      );
      const row = lintRows(parsed).find((c) => c.name === "lint-eslint");
      expect(row?.ok).toBe(false);
      expect(parsed.ok).toBe(true);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("no representative source file → stderr note + literal fallback", async () => {
    const config = join(semanticRoot, "eslint.config.mjs");
    mockExists(config);
    mockConfigText(config, 'export default [{ rules: { "no-empty": "error" } }];\n');
    readdirLintMock.mockReturnValue([] as never);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const parsed = await runLintDoctorJson();
      expect(errorSpy.mock.calls.join(" ")).toContain("no representative");
      // Literal fallback sees no-empty → covered → silent.
      expect(
        lintRows(parsed).find((c) => c.name === "lint-eslint"),
      ).toBeUndefined();
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("ancestor eslint config is discovered (not reported as 'no config')", async () => {
    const config = join(parentRoot, "eslint.config.mjs");
    mockExists(config);
    mockConfigText(config, 'export default [{ rules: { "no-empty": "error" } }];\n');
    readdirLintMock.mockReturnValue([fileDirent("app.ts")] as never);
    mockExec((cmd, args) => {
      if (cmd === "eslint" && args[0] === "--print-config") {
        throw new Error("config load failed");
      }
      return undefined;
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const parsed = await runLintDoctorJson();
      const rows = lintRows(parsed);
      expect(rows.find((c) => c.name === "lint-eslint")).toBeUndefined();
      expect(rows.find((c) => c.name === "lint-config")).toBeUndefined();
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("ancestor ruff config is discovered (not reported as 'no config')", async () => {
    const config = join(parentRoot, "ruff.toml");
    mockExists(config);
    mockConfigText(config, '[lint]\nselect = ["E4"]\n');
    readdirLintMock.mockReturnValue([fileDirent("app.py")] as never);
    mockExec((cmd, args) =>
      cmd === "ruff" && args[0] === "check"
        ? "linter.rules.enabled = [\n    E4 (pycodestyle),\n]\nlinter.rules.preview = []\n"
        : undefined,
    );
    const parsed = await runLintDoctorJson();
    const rows = lintRows(parsed);
    expect(rows.find((c) => c.name === "lint-config")).toBeUndefined();
    expect(rows.find((c) => c.name === "lint-ruff")?.ok).toBe(false);
  });

  it("ruff show-settings lists B904 → silent even though config text lacks it", async () => {
    const config = join(semanticRoot, "ruff.toml");
    mockExists(config);
    mockConfigText(config, '[lint]\nselect = ["E4"]\n');
    readdirLintMock.mockReturnValue([fileDirent("app.py")] as never);
    mockExec((cmd, args) =>
      cmd === "ruff" && args[0] === "check"
        ? "linter.rules.enabled = [\n    E4 (pycodestyle),\n    raise-without-from-inside-except (B904),\n]\nlinter.rules.preview = []\n"
        : undefined,
    );
    const parsed = await runLintDoctorJson();
    const rows = lintRows(parsed);
    expect(rows.find((c) => c.name === "lint-ruff")).toBeUndefined();
    expect(rows.find((c) => c.name === "lint-ruff-cli")?.ok).toBe(true);
  });

  it("ruff show-settings without B904 → gap row", async () => {
    const config = join(semanticRoot, "ruff.toml");
    mockExists(config);
    mockConfigText(config, '[lint]\nselect = ["E4"]\n');
    readdirLintMock.mockReturnValue([fileDirent("app.py")] as never);
    mockExec((cmd, args) =>
      cmd === "ruff" && args[0] === "check"
        ? "linter.rules.enabled = [\n    E4 (pycodestyle),\n]\nlinter.rules.preview = []\n"
        : undefined,
    );
    const parsed = await runLintDoctorJson();
    const row = lintRows(parsed).find((c) => c.name === "lint-ruff");
    expect(row?.ok).toBe(false);
    expect(row?.message).toContain("B904");
  });

  it("ruff timeout → stderr note + literal fallback (covered config stays silent)", async () => {
    const config = join(semanticRoot, "ruff.toml");
    mockExists(config);
    mockConfigText(config, '[lint]\nextend-select = ["B904"]\n');
    readdirLintMock.mockReturnValue([fileDirent("app.py")] as never);
    mockExec((cmd, args) => {
      if (cmd === "ruff" && args[0] === "check") {
        throw Object.assign(new Error("ETIMEDOUT"), { code: "ETIMEDOUT" });
      }
      return undefined;
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const parsed = await runLintDoctorJson();
      expect(errorSpy.mock.calls.join(" ")).toContain(
        "semantic probe unavailable",
      );
      expect(
        lintRows(parsed).find((c) => c.name === "lint-ruff"),
      ).toBeUndefined();
      expect(parsed.ok).toBe(true);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("no representative .py file → literal fallback", async () => {
    const config = join(semanticRoot, "ruff.toml");
    mockExists(config);
    mockConfigText(config, '[lint]\nselect = ["E4"]\n');
    readdirLintMock.mockReturnValue([] as never);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const parsed = await runLintDoctorJson();
      expect(errorSpy.mock.calls.join(" ")).toContain("no representative");
      expect(lintRows(parsed).find((c) => c.name === "lint-ruff")?.ok).toBe(
        false,
      );
    } finally {
      errorSpy.mockRestore();
    }
  });
});
