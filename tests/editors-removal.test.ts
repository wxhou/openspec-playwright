import { describe, it, expect, beforeEach, afterEach } from "vitest";
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
  claudeAdapter,
  clineAdapter,
  cursorAdapter,
  piAdapter,
} from "../src/commands/editors.js";
import {
  enumerateAdapterArtifacts,
  isInventoryEmpty,
  removeAdapterCommandArtifacts,
  removeAdapterMcp,
  removeClaudeLegacySkill,
  removeClaudeWrapper,
  OPENSPEC_PW_MCP_SERVERS,
} from "../src/commands/editors/removal.js";

let projectRoot: string;

beforeEach(() => {
  projectRoot = mkdtempSync(join(tmpdir(), "openspec-pw-removal-"));
});

afterEach(() => {
  rmSync(projectRoot, { recursive: true, force: true });
});

describe("enumerateAdapterArtifacts", () => {
  it("is dry: prints nothing and reports nothing for an untouched project", () => {
    let printed = 0;
    const logSpy = console.log;
    console.log = () => {
      printed++;
    };
    try {
      const inv = enumerateAdapterArtifacts(cursorAdapter, projectRoot);
      expect(inv.commandPaths).toEqual([]);
      expect(inv.mcpServers).toEqual([]);
      expect(isInventoryEmpty(inv)).toBe(true);
    } finally {
      console.log = logSpy;
    }
    expect(printed).toBe(0);
  });

  it("detects existing cursor command artifact, skill artifact, and mcp entry", () => {
    mkdirSync(join(projectRoot, ".cursor", "commands"), { recursive: true });
    writeFileSync(
      join(projectRoot, ".cursor", "commands", "opsx-e2e.md"),
      "cmd",
    );
    mkdirSync(join(projectRoot, ".cursor", "skills", "opsx-e2e"), { recursive: true });
    writeFileSync(
      join(projectRoot, ".cursor", "skills", "opsx-e2e", "SKILL.md"),
      "skill",
    );
    mkdirSync(join(projectRoot, ".cursor"), { recursive: true });
    writeFileSync(
      join(projectRoot, ".cursor", "mcp.json"),
      JSON.stringify({
        mcpServers: { "playwright-test": { command: "npx", args: ["playwright"] } },
      }),
    );

    const inv = enumerateAdapterArtifacts(cursorAdapter, projectRoot);

    expect(inv.commandPaths).toEqual([
      join(".cursor", "commands", "opsx-e2e.md"),
      join(".cursor", "skills", "opsx-e2e", "SKILL.md"),
    ]);
    expect(inv.mcpServers).toEqual(["playwright-test"]);
    expect(isInventoryEmpty(inv)).toBe(false);
  });

  it("returns no mcp servers for adapters without an MCP client (pi)", () => {
    expect(piAdapter.supportsMcp).toBe(false);
    const inv = enumerateAdapterArtifacts(piAdapter, projectRoot);
    expect(inv.mcpServers).toEqual([]);
    expect(OPENSPEC_PW_MCP_SERVERS).toContain("playwright-test");
  });

  it("lists both openspec-pw server names, current and legacy", () => {
    mkdirSync(join(projectRoot, ".cursor"), { recursive: true });
    writeFileSync(
      join(projectRoot, ".cursor", "mcp.json"),
      JSON.stringify({
        mcpServers: {
          playwright: { command: "npx", args: ["@playwright/mcp"] },
        },
      }),
    );
    const inv = enumerateAdapterArtifacts(cursorAdapter, projectRoot);
    expect(inv.mcpServers).toEqual(["playwright"]);
  });

  it("flags claude wrapper markers and skips symlinked CLAUDE.md", () => {
    const dest = join(projectRoot, "CLAUDE.md");
    writeFileSync(
      dest,
      "x\n<!-- OPENSPEC-PW:START -->\n@AGENTS.md\n<!-- OPENSPEC-PW:END -->\n",
    );
    expect(enumerateAdapterArtifacts(claudeAdapter, projectRoot).hasClaudeWrapper).toBe(true);

    rmSync(dest);
    writeFileSync(join(projectRoot, "AGENTS.md"), "shared standards");
    symlinkSync(join(projectRoot, "AGENTS.md"), dest);
    expect(enumerateAdapterArtifacts(claudeAdapter, projectRoot).hasClaudeWrapper).toBe(false);
  });

  it("flags the claude legacy skill dir only for claude", () => {
    mkdirSync(join(projectRoot, ".claude", "skills", "openspec-e2e"), { recursive: true });
    expect(enumerateAdapterArtifacts(claudeAdapter, projectRoot).legacySkillPath).toBe(
      join(".claude", "skills", "openspec-e2e"),
    );
    expect(enumerateAdapterArtifacts(cursorAdapter, projectRoot).legacySkillPath).toBeNull();
  });
});

describe("removeAdapterCommandArtifacts", () => {
  it("removes only openspec-pw artifacts, keeps user files", () => {
    mkdirSync(join(projectRoot, ".cline", "skills", "opsx-e2e"), { recursive: true });
    const skillFile = join(projectRoot, ".cline", "skills", "opsx-e2e", "SKILL.md");
    writeFileSync(skillFile, "x");
    mkdirSync(join(projectRoot, ".cline", "rules"), { recursive: true });
    const userFile = join(projectRoot, ".cline", "rules", "mine.md");
    writeFileSync(userFile, "user rules");

    const removed = removeAdapterCommandArtifacts(clineAdapter, projectRoot);

    expect(removed.length).toBeGreaterThan(0);
    expect(existsSync(artifactRelPaths(removed))).toBe(false);
    expect(existsSync(skillFile)).toBe(false);
    expect(existsSync(userFile)).toBe(true);
    // The user-owned file keeps .cline/ alive (cleanupEmptyDirs stops at non-empty)
    expect(existsSync(join(projectRoot, ".cline"))).toBe(true);
  });
});

describe("removeAdapterMcp", () => {
  it("deletes only the openspec-pw entry from a mixed mcp.json", () => {
    mkdirSync(join(projectRoot, ".cursor"), { recursive: true });
    const mcpJson = join(projectRoot, ".cursor", "mcp.json");
    writeFileSync(
      mcpJson,
      JSON.stringify({
        mcpServers: {
          "playwright-test": { command: "npx", args: ["playwright"] },
          "user-server": { command: "node", args: ["user.js"] },
        },
      }),
    );

    removeAdapterMcp(cursorAdapter, projectRoot, ["playwright-test"]);

    const config = JSON.parse(readFileSync(mcpJson, "utf-8"));
    expect(config.mcpServers["playwright-test"]).toBeUndefined();
    expect(config.mcpServers["user-server"]).toBeDefined();
  });

  it("does nothing for adapters without an MCP client (pi)", () => {
    removeAdapterMcp(piAdapter, projectRoot, ["playwright-test"]);
    expect(existsSync(join(projectRoot, ".pi", "mcp.json"))).toBe(false);
  });
});

describe("removeClaudeLegacySkill", () => {
  it("removes the legacy skill dir and cascades empty parents; null when absent", () => {
    expect(removeClaudeLegacySkill(projectRoot)).toBeNull();
    const skillDir = join(projectRoot, ".claude", "skills", "openspec-e2e");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, "SKILL.md"), "x");
    expect(removeClaudeLegacySkill(projectRoot)).toBe(
      join(".claude", "skills", "openspec-e2e"),
    );
    expect(existsSync(skillDir)).toBe(false);
    expect(existsSync(join(projectRoot, ".claude"))).toBe(false);
  });
});

describe("removeClaudeWrapper", () => {
  it("strips the wrapper block, keeps the rest of the file", () => {
    const dest = join(projectRoot, "CLAUDE.md");
    writeFileSync(
      dest,
      "# Title\n\n<!-- OPENSPEC-PW:START -->\nwrapper content\n<!-- OPENSPEC-PW:END -->\n",
    );
    expect(removeClaudeWrapper(projectRoot)).toBe("CLAUDE.md");
    const after = readFileSync(dest, "utf-8");
    expect(after).toContain("# Title");
    expect(after).not.toContain("wrapper content");
  });

  it("skips symlinked CLAUDE.md without writing through to AGENTS.md", () => {
    const agents = join(projectRoot, "AGENTS.md");
    writeFileSync(agents, "shared standards\n");
    symlinkSync(agents, join(projectRoot, "CLAUDE.md"));

    let mentionedSymlink = false;
    const logSpy = console.log;
    console.log = (msg?: unknown) => {
      if (String(msg).includes("symlink")) mentionedSymlink = true;
    };
    try {
      expect(removeClaudeWrapper(projectRoot)).toBeNull();
    } finally {
      console.log = logSpy;
    }
    expect(mentionedSymlink).toBe(true);
    expect(readFileSync(agents, "utf-8")).toBe("shared standards\n");
  });

  it("returns null when CLAUDE.md does not exist", () => {
    expect(removeClaudeWrapper(projectRoot)).toBeNull();
  });
});

/** First removed path joined back to the project root, for existence checks. */
function artifactRelPaths(removed: string[]): string {
  return join(projectRoot, removed[0]);
}