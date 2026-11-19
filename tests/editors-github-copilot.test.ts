import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  buildCommandMeta,
  formatCopilotPrompt,
  getCopilotPromptPath,
  githubCopilotAdapter,
  hasGithubCopilot,
} from "../src/commands/editors.js";

const META = buildCommandMeta("Run /opsx:e2e for the change.\n");

let root: string;
let home: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "ospw-copilot-"));
  home = mkdtempSync(join(tmpdir(), "ospw-copilot-home-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  rmSync(home, { recursive: true, force: true });
});

describe("GitHub Copilot adapter", () => {
  it("writes a VS Code prompt file", () => {
    expect(getCopilotPromptPath("e2e").replace(/\\/g, "/")).toBe(
      ".github/prompts/opsx-e2e.prompt.md",
    );
    const output = formatCopilotPrompt(META);
    expect(output.startsWith("---\n")).toBe(true);
    expect(output).toContain(
      "description: Run Playwright E2E verification for an OpenSpec change",
    );
    expect(output).toContain("Run /opsx-e2e for the change.");
  });

  it("does not detect a plain GitHub repository", () => {
    mkdirSync(join(root, ".github", "workflows"), { recursive: true });
    writeFileSync(join(root, ".github", "workflows", "ci.yml"), "on: push\n");
    expect(hasGithubCopilot(root, home)).toBe(false);
  });

  it("detects Copilot-specific markers", () => {
    mkdirSync(join(root, ".github"), { recursive: true });
    writeFileSync(join(root, ".github", "copilot-instructions.md"), "# rules\n");
    expect(hasGithubCopilot(root, home)).toBe(true);
    expect(githubCopilotAdapter.projectSignal(root)).toBe(true);
  });

  it("writes MCP into the workspace .mcp.json with type stdio", () => {
    githubCopilotAdapter.installMcp(root, "playwright-test", ["npx", "pw"]);
    const config = JSON.parse(
      readFileSync(join(root, ".mcp.json"), "utf-8"),
    );
    expect(config.mcpServers["playwright-test"]).toEqual({
      type: "stdio",
      command: "npx",
      args: ["pw"],
    });
    expect(githubCopilotAdapter.isMcpInstalled(root, "playwright-test")).toBe(
      true,
    );
    githubCopilotAdapter.removeMcp(root, "playwright-test");
    expect(githubCopilotAdapter.isMcpInstalled(root, "playwright-test")).toBe(
      false,
    );
  });

  it("uses .github/copilot-instructions.md in full-standards mode", () => {
    expect(githubCopilotAdapter.projectRulesPath(root)).toBe(
      join(root, ".github", "copilot-instructions.md"),
    );
    expect(githubCopilotAdapter.declaration?.rules?.mode).toBe("full");
  });
});
