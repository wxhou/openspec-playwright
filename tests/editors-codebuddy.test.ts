import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
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
import {
  buildCommandMeta,
  cleanProjectRules,
  codebuddyAdapter,
  claudeWrapperStandardsContent,
  enumerateAdapterArtifacts,
  formatCodebuddyCommand,
  getCodebuddyCommandPath,
  hasCodebuddy,
  hasRuleFileMarkers,
  installProjectRules,
  installThinWrapper,
  migrateLegacyMarkers,
  removeWrapper,
  slashCommandForAdapter,
} from "../src/commands/editors.js";
import { syncEmployeeStandards } from "../src/commands/update.js";

// Shared temp-dir lifecycle for filesystem-touching tests below.
let tmpRoot: string;
beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), "openspec-pw-codebuddy-"));
});
afterEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
});

// ─── CodeBuddy adapter ───────────────────────────────────────────────────

describe("codebuddyAdapter", () => {
  it("has correct metadata", () => {
    expect(codebuddyAdapter.id).toBe("codebuddy");
    expect(codebuddyAdapter.displayName).toBe("CodeBuddy CLI");
    expect(slashCommandForAdapter(codebuddyAdapter)).toBe("/opsx:e2e");
  });

  it("detects .codebuddy/ directory only", () => {
    expect(hasCodebuddy(tmpRoot)).toBe(false);
    mkdirSync(join(tmpRoot, ".codebuddy"));
    expect(hasCodebuddy(tmpRoot)).toBe(true);
    expect(codebuddyAdapter.detect(tmpRoot)).toBe(true);
    expect(codebuddyAdapter.projectSignal!(tmpRoot)).toBe(true);
  });

  it("command path is .codebuddy/commands/opsx/<id>.md", () => {
    expect(getCodebuddyCommandPath("e2e")).toBe(
      join(".codebuddy", "commands", "opsx", "e2e.md"),
    );
  });

  it("formats description + argument-hint frontmatter and keeps colon commands", () => {
    const meta = buildCommandMeta("Run `/opsx:propose` first, then verify.");
    const out = formatCodebuddyCommand(meta);
    expect(out).toMatch(/^---\ndescription: /);
    expect(out).toContain('argument-hint: "<change-name|all>"');
    // Official frontmatter field set has no `name` field.
    expect(out).not.toMatch(/^name:/m);
    // Subdirectory colon naming — body must NOT be hyphen-transformed.
    expect(out).toContain("/opsx:propose");
    expect(out).not.toContain("/opsx-propose");
  });
});

// ─── MCP (.mcp.json at project root) ─────────────────────────────────────

describe("codebuddyAdapter MCP", () => {
  const mcpJson = () => join(tmpRoot, ".mcp.json");

  it("isMcpInstalled returns false when .mcp.json is missing", () => {
    expect(codebuddyAdapter.isMcpInstalled(tmpRoot, "playwright-test")).toBe(false);
  });

  it("installMcp writes mcpServers entry at project root", () => {
    codebuddyAdapter.installMcp(tmpRoot, "playwright-test", [
      "npx",
      "playwright",
      "run-test-mcp-server",
    ]);
    expect(existsSync(mcpJson())).toBe(true);
    const parsed = JSON.parse(readFileSync(mcpJson(), "utf-8"));
    expect(parsed.mcpServers["playwright-test"]).toEqual({
      command: "npx",
      args: ["playwright", "run-test-mcp-server"],
    });
    expect(codebuddyAdapter.isMcpInstalled(tmpRoot, "playwright-test")).toBe(true);
  });

  it("installMcp preserves the user's own server entries", () => {
    writeFileSync(
      mcpJson(),
      JSON.stringify(
        { mcpServers: { "user-server": { command: "uvx", args: ["foo"] } } },
        null,
        2,
      ) + "\n",
    );
    codebuddyAdapter.installMcp(tmpRoot, "playwright-test", ["npx", "pw"]);
    const parsed = JSON.parse(readFileSync(mcpJson(), "utf-8"));
    expect(parsed.mcpServers["user-server"]).toEqual({ command: "uvx", args: ["foo"] });
    expect(parsed.mcpServers["playwright-test"]).toEqual({ command: "npx", args: ["pw"] });
  });

  it("removeMcp deletes only its own entry and keeps others", () => {
    codebuddyAdapter.installMcp(tmpRoot, "playwright-test", ["npx", "pw"]);
    codebuddyAdapter.installMcp(tmpRoot, "user-server", ["uvx", "foo"]);
    codebuddyAdapter.removeMcp(tmpRoot, "playwright-test");
    const parsed = JSON.parse(readFileSync(mcpJson(), "utf-8"));
    expect(parsed.mcpServers["playwright-test"]).toBeUndefined();
    expect(parsed.mcpServers["user-server"]).toEqual({ command: "uvx", args: ["foo"] });
  });

  it("removeMcp is a no-op when the server or file is missing", () => {
    expect(() => codebuddyAdapter.removeMcp(tmpRoot, "playwright-test")).not.toThrow();
    codebuddyAdapter.installMcp(tmpRoot, "playwright-test", ["npx", "pw"]);
    expect(() => codebuddyAdapter.removeMcp(tmpRoot, "playwright-test")).not.toThrow();
    expect(codebuddyAdapter.isMcpInstalled(tmpRoot, "playwright-test")).toBe(false);
  });
});

// ─── CODEBUDDY.md thin wrapper (project rules phase) ─────────────────────

describe("codebuddy wrapper install", () => {
  it("installProjectRules writes CODEBUDDY.md wrapper when codebuddy is selected", () => {
    installProjectRules(tmpRoot, "# standards body", [codebuddyAdapter]);
    const dest = join(tmpRoot, "CODEBUDDY.md");
    expect(existsSync(dest)).toBe(true);
    const content = readFileSync(dest, "utf-8");
    expect(content).toContain("<!-- OPENSPEC-PW:START -->");
    expect(content).toContain("@AGENTS.md");
    expect(content).toContain("CodeGraph");
    // AGENTS.md is still the single source of truth.
    expect(readFileSync(join(tmpRoot, "AGENTS.md"), "utf-8")).toContain("# standards body");
  });

  it("does not install the wrapper when codebuddy is not selected", () => {
    installProjectRules(tmpRoot, "# standards body", []);
    expect(existsSync(join(tmpRoot, "CODEBUDDY.md"))).toBe(false);
  });

  it("is idempotent — content-equal wrapper is left untouched", () => {
    installThinWrapper(codebuddyAdapter, tmpRoot);
    const dest = join(tmpRoot, "CODEBUDDY.md");
    const before = readFileSync(dest, "utf-8");
    installThinWrapper(codebuddyAdapter, tmpRoot);
    expect(readFileSync(dest, "utf-8")).toBe(before);
  });

  it("skips a symlinked CODEBUDDY.md (→ AGENTS.md) without writing through", () => {
    writeFileSync(join(tmpRoot, "AGENTS.md"), "shared standards\n");
    symlinkSync(join(tmpRoot, "AGENTS.md"), join(tmpRoot, "CODEBUDDY.md"));
    const logs: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((m) => logs.push(String(m)));
    try {
      installThinWrapper(codebuddyAdapter, tmpRoot);
    } finally {
      spy.mockRestore();
    }
    expect(logs.some((l) => l.includes("symlink"))).toBe(true);
    expect(readFileSync(join(tmpRoot, "AGENTS.md"), "utf-8")).toBe("shared standards\n");
  });

  it("leaves a bare @AGENTS.md import (no markers) untouched with a hint", () => {
    writeFileSync(join(tmpRoot, "CODEBUDDY.md"), "@AGENTS.md\n");
    const logs: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((m) => logs.push(String(m)));
    try {
      installThinWrapper(codebuddyAdapter, tmpRoot);
    } finally {
      spy.mockRestore();
    }
    expect(logs.some((l) => l.includes("裸 @AGENTS.md 导入"))).toBe(true);
    expect(readFileSync(join(tmpRoot, "CODEBUDDY.md"), "utf-8")).toBe("@AGENTS.md\n");
  });

  it("never touches a user-owned CODEBUDDY.md without our markers", () => {
    writeFileSync(join(tmpRoot, "CODEBUDDY.md"), "# my own notes\n");
    cleanProjectRules(codebuddyAdapter, tmpRoot);
    expect(readFileSync(join(tmpRoot, "CODEBUDDY.md"), "utf-8")).toBe("# my own notes\n");
  });
});

describe("codebuddy wrapper territory (cleanup / removal / markers)", () => {
  it("cleanProjectRules removes the wrapper block, keeps the rest, deletes empty file", () => {
    const dest = join(tmpRoot, "CODEBUDDY.md");
    writeFileSync(
      dest,
      "# Title\n\n<!-- OPENSPEC-PW:START -->\nwrapper content\n<!-- OPENSPEC-PW:END -->\n",
    );
    cleanProjectRules(codebuddyAdapter, tmpRoot);
    const after = readFileSync(dest, "utf-8");
    expect(after).toContain("# Title");
    expect(after).not.toContain("wrapper content");

    // A wrapper file holding nothing but the block is deleted entirely.
    writeFileSync(dest, "<!-- OPENSPEC-PW:START -->\nwrapper content\n<!-- OPENSPEC-PW:END -->\n");
    cleanProjectRules(codebuddyAdapter, tmpRoot);
    expect(existsSync(dest)).toBe(false);
  });

  it("enumerateAdapterArtifacts flags the wrapper for codebuddy only", () => {
    writeFileSync(
      join(tmpRoot, "CODEBUDDY.md"),
      "<!-- OPENSPEC-PW:START -->\n@AGENTS.md\n<!-- OPENSPEC-PW:END -->\n",
    );
    expect(enumerateAdapterArtifacts(codebuddyAdapter, tmpRoot).hasWrapper).toBe(true);
    rmSync(join(tmpRoot, "CODEBUDDY.md"));
    expect(enumerateAdapterArtifacts(codebuddyAdapter, tmpRoot).hasWrapper).toBe(false);
  });

  it("removeWrapper strips the block and reports the file label", () => {
    writeFileSync(
      join(tmpRoot, "CODEBUDDY.md"),
      "<!-- OPENSPEC-PW:START -->\nwrapper content\n<!-- OPENSPEC-PW:END -->\n",
    );
    expect(removeWrapper(codebuddyAdapter, tmpRoot)).toBe("CODEBUDDY.md");
  });

  it("removeWrapper skips a symlinked CODEBUDDY.md", () => {
    const agents = join(tmpRoot, "AGENTS.md");
    writeFileSync(agents, "shared standards\n");
    symlinkSync(agents, join(tmpRoot, "CODEBUDDY.md"));
    expect(removeWrapper(codebuddyAdapter, tmpRoot)).toBeNull();
    expect(readFileSync(agents, "utf-8")).toBe("shared standards\n");
  });

  it("hasRuleFileMarkers detects our block in CODEBUDDY.md", () => {
    expect(hasRuleFileMarkers(tmpRoot)).toBe(false);
    writeFileSync(
      join(tmpRoot, "CODEBUDDY.md"),
      "<!-- OPENSPEC-PW:START -->\nwrapper\n<!-- OPENSPEC-PW:END -->\n",
    );
    expect(hasRuleFileMarkers(tmpRoot)).toBe(true);
  });

  it("migrateLegacyMarkers migrates a legacy block inside CODEBUDDY.md when authorized", () => {
    writeFileSync(
      join(tmpRoot, "CODEBUDDY.md"),
      "<!-- OPENSPEC:START -->\n@AGENTS.md\n<!-- OPENSPEC:END -->\n",
    );
    const migrated = migrateLegacyMarkers(tmpRoot, true, false, true);
    expect(migrated).toBe(true);
    const content = readFileSync(join(tmpRoot, "CODEBUDDY.md"), "utf-8");
    expect(content).toContain("<!-- OPENSPEC-PW:START -->");
    expect(content).not.toContain("<!-- OPENSPEC:START -->");
  });

  it("migrateLegacyMarkers leaves CODEBUDDY.md alone when codebuddy is not authorized", () => {
    writeFileSync(
      join(tmpRoot, "CODEBUDDY.md"),
      "<!-- OPENSPEC:START -->\n@AGENTS.md\n<!-- OPENSPEC:END -->\n",
    );
    migrateLegacyMarkers(tmpRoot, true, true, false);
    expect(readFileSync(join(tmpRoot, "CODEBUDDY.md"), "utf-8")).toContain("<!-- OPENSPEC:START -->");
  });
});

// ─── update: wrapper sync gating (asset-sync delta) ──────────────────────

describe("syncEmployeeStandards codebuddy gating", () => {
  const bundle = () => {
    const dir = mkdtempSync(join(tmpdir(), "openspec-pw-bundle-"));
    writeFileSync(join(dir, "employee-standards.md"), "# bundled standards\n");
    return dir;
  };

  it("refreshes an authorized stale CODEBUDDY.md wrapper, preserving block-external content", () => {
    writeFileSync(join(tmpRoot, "CODEBUDDY.md"), "preamble\n<!-- OPENSPEC-PW:START -->\noutdated\n<!-- OPENSPEC-PW:END -->\n");
    syncEmployeeStandards(bundle(), tmpRoot, false, true, true);
    const refreshed = readFileSync(join(tmpRoot, "CODEBUDDY.md"), "utf-8");
    expect(refreshed).toContain("preamble\n");
    expect(refreshed).toContain(claudeWrapperStandardsContent().trim());
    expect(refreshed).not.toContain("outdated");
  });

  it("never creates CODEBUDDY.md when codebuddy is not authorized", () => {
    syncEmployeeStandards(bundle(), tmpRoot, false, true, false);
    expect(existsSync(join(tmpRoot, "CODEBUDDY.md"))).toBe(false);
  });

  it("creates the wrapper when authorized but missing (partial-install drift)", () => {
    syncEmployeeStandards(bundle(), tmpRoot, false, true, true);
    const content = readFileSync(join(tmpRoot, "CODEBUDDY.md"), "utf-8");
    expect(content).toContain(claudeWrapperStandardsContent().trim());
  });
});
