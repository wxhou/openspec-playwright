import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, readFileSync, rmSync, existsSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { basename, join } from "path";
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

  it("cleanProjectRules deletes a file whose only block-external content is the generated title", () => {
    installProjectRules(root, STANDARDS, [geminiAdapter]);
    const geminiPath = join(root, "GEMINI.md");
    const edited = readFileSync(geminiPath, "utf-8").replace(
      "## 0. 适用范围",
      "## 0. 适用范围（已修改）",
    );
    writeFileSync(geminiPath, edited);
    cleanProjectRules(geminiAdapter, root, { agents: false });
    expect(existsSync(geminiPath)).toBe(false);
  });

  it("cleanProjectRules keeps user content outside the block", () => {
    installProjectRules(root, STANDARDS, [geminiAdapter]);
    const geminiPath = join(root, "GEMINI.md");
    writeFileSync(
      geminiPath,
      readFileSync(geminiPath, "utf-8") + "\nUser notes\n",
    );
    cleanProjectRules(geminiAdapter, root, { agents: false });
    expect(existsSync(geminiPath)).toBe(true);
    const after = readFileSync(geminiPath, "utf-8");
    expect(after).toContain("User notes");
    expect(after).not.toContain("OPENSPEC-PW");
  });

  it("a second install rewrites the block in creation format, so cleanup still deletes it", () => {
    installProjectRules(root, STANDARDS, [geminiAdapter]);
    const geminiPath = join(root, "GEMINI.md");
    const first = readFileSync(geminiPath, "utf-8");
    installProjectRules(root, STANDARDS, [geminiAdapter]);
    expect(readFileSync(geminiPath, "utf-8")).toBe(first);
    cleanProjectRules(geminiAdapter, root, { agents: false });
    expect(existsSync(geminiPath)).toBe(false);
  });

  it("cleanProjectRules deletes a legacy single-newline copy", () => {
    const geminiPath = join(root, "GEMINI.md");
    writeFileSync(
      geminiPath,
      `# ${basename(root)}\n<!-- OPENSPEC-PW:START -->\n\n${STANDARDS.trim()}\n\n<!-- OPENSPEC-PW:END -->\n`,
    );
    cleanProjectRules(geminiAdapter, root, { agents: false });
    expect(existsSync(geminiPath)).toBe(false);
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
