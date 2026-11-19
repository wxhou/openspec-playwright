import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  buildCommandMeta,
  geminiAdapter,
  getGeminiCommandPath,
  formatGeminiCommand,
  hasGemini,
} from "../src/commands/editors.js";

const META = buildCommandMeta("Run /opsx:e2e for the change.\n");

let root: string;
let home: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "ospw-gemini-"));
  home = mkdtempSync(join(tmpdir(), "ospw-gemini-home-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  rmSync(home, { recursive: true, force: true });
});

describe("Gemini CLI adapter", () => {
  it("writes a TOML command at .gemini/commands/opsx/e2e.toml", () => {
    expect(getGeminiCommandPath("e2e").replace(/\\/g, "/")).toBe(
      ".gemini/commands/opsx/e2e.toml",
    );
    const output = formatGeminiCommand(META);
    expect(output).toContain(
      'description = "Run Playwright E2E verification for an OpenSpec change"',
    );
    expect(output).toContain('prompt = """');
    // namespace-dir naming keeps the colon form.
    expect(output).toContain("Run /opsx:e2e for the change.");
  });

  it("escapes quotes and backslashes in the TOML prompt", () => {
    const output = formatGeminiCommand(
      buildCommandMeta('Say "hi" and C:\\path\nnext'),
    );
    // Multi-line basic strings keep single quotes raw; backslashes double.
    expect(output).toContain('Say "hi" and C:\\\\path');
  });

  it("detects the project marker and the global home directory separately", () => {
    expect(hasGemini(root, home)).toBe(false);
    mkdirSync(join(home, ".gemini"), { recursive: true });
    expect(hasGemini(root, home)).toBe(true);
    expect(geminiAdapter.projectSignal(root)).toBe(false);
    mkdirSync(join(root, ".gemini"), { recursive: true });
    expect(geminiAdapter.projectSignal(root)).toBe(true);
  });

  it("installs and removes MCP in .gemini/settings.json", () => {
    geminiAdapter.installMcp(root, "playwright-test", ["npx", "pw"]);
    const settings = JSON.parse(
      readFileSync(join(root, ".gemini", "settings.json"), "utf-8"),
    );
    expect(settings.mcpServers["playwright-test"]).toEqual({
      command: "npx",
      args: ["pw"],
    });
    expect(geminiAdapter.isMcpInstalled(root, "playwright-test")).toBe(true);
    geminiAdapter.removeMcp(root, "playwright-test");
    expect(geminiAdapter.isMcpInstalled(root, "playwright-test")).toBe(false);
  });

  it("uses GEMINI.md in full-standards mode", () => {
    expect(geminiAdapter.projectRulesPath(root)).toBe(join(root, "GEMINI.md"));
    expect(geminiAdapter.declaration?.rules?.mode).toBe("full");
  });
});
