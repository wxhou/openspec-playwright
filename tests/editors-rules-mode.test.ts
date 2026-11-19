import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, readFileSync, rmSync, existsSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  claudeAdapter,
  cleanProjectRules,
  geminiAdapter,
  installProjectRules,
  roocodeAdapter,
  traeAdapter,
} from "../src/commands/editors.js";

const STANDARDS = readFileSync(
  join(process.cwd(), "standards", "employee-standards.md"),
  "utf-8",
);

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "ospw-rules-mode-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("rules mode: full vs wrapper", () => {
  it("full mode writes the complete standards into the editor's own file", () => {
    installProjectRules(root, STANDARDS, [geminiAdapter]);
    const gemini = readFileSync(join(root, "GEMINI.md"), "utf-8");
    expect(gemini).toContain("# ");
    expect(gemini).toContain("OPENSPEC-PW");
    expect(gemini).toContain("## 0. 适用范围");
    // AGENTS.md remains the shared source of truth.
    expect(readFileSync(join(root, "AGENTS.md"), "utf-8")).toContain(
      "## 0. 适用范围",
    );
  });

  it("creates missing parent directories for nested rules files", () => {
    installProjectRules(root, STANDARDS, [roocodeAdapter]);
    const rooRules = join(root, ".roo", "rules", "openspec-pw.md");
    expect(existsSync(rooRules)).toBe(true);
    expect(readFileSync(rooRules, "utf-8")).toContain("## 0. 适用范围");
  });

  it("wrapper mode still writes only the @AGENTS.md import", () => {
    installProjectRules(root, STANDARDS, [claudeAdapter]);
    const wrapper = readFileSync(join(root, "CLAUDE.md"), "utf-8");
    expect(wrapper).toContain("@AGENTS.md");
    expect(wrapper).not.toContain("## 0. 适用范围");
  });

  it("cleanProjectRules removes the pristine full-mode file whole", () => {
    installProjectRules(root, STANDARDS, [traeAdapter]);
    const traeRules = join(root, ".trae", "rules", "project_rules.md");
    expect(existsSync(traeRules)).toBe(true);
    cleanProjectRules(traeAdapter, root, { agents: false });
    expect(existsSync(traeRules)).toBe(false);
  });

  it("cleanProjectRules leaves a user-edited full-mode file in place", () => {
    installProjectRules(root, STANDARDS, [geminiAdapter]);
    const geminiPath = join(root, "GEMINI.md");
    const edited = readFileSync(geminiPath, "utf-8").replace(
      "## 0. 适用范围",
      "## 0. 适用范围（已修改）",
    );
    writeFileSync(geminiPath, edited);
    cleanProjectRules(geminiAdapter, root, { agents: false });
    expect(existsSync(geminiPath)).toBe(true);
    expect(readFileSync(geminiPath, "utf-8")).not.toContain("OPENSPEC-PW");
  });
});

describe("stale full-rules detection (update refresh)", () => {
  it("is clean right after install and stale after a manual edit", async () => {
    const { staleFullRulesAdapters } = await import(
      "../src/commands/update.js"
    );
    installProjectRules(root, STANDARDS, [geminiAdapter]);
    expect(staleFullRulesAdapters(root, STANDARDS)).toEqual([]);

    const geminiPath = join(root, "GEMINI.md");
    writeFileSync(
      geminiPath,
      readFileSync(geminiPath, "utf-8").replace(
        "## 0. 适用范围",
        "## 0. 适用范围（旧）",
      ),
    );
    expect(staleFullRulesAdapters(root, STANDARDS).map((a) => a.id)).toEqual([
      "gemini",
    ]);
  });

  it("ignores a rules file without our markers", async () => {
    const { staleFullRulesAdapters } = await import(
      "../src/commands/update.js"
    );
    writeFileSync(join(root, "GEMINI.md"), "# user rules only\n");
    expect(staleFullRulesAdapters(root, STANDARDS)).toEqual([]);
  });
});
