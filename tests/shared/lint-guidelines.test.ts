import { describe, expect, it } from "vitest";
import {
  mkdirSync,
  readFileSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  LINT_ESLINT_CONFIG_FILE,
  LINT_ESLINT_GENERATED_MARKER,
  LINT_GUIDELINE_RULES,
  LINT_GUIDELINES_CHECKSUM_PREFIX,
  LINT_GUIDELINES_RELPATH,
  LINT_RUFF_BLOCK_BEGIN,
  LINT_RUFF_BLOCK_END,
  buildRuffManagedBlock,
  computeChecklistChecksum,
  eslintMajorFromSpec,
  findRuffManagedBlock,
  findSourceFile,
  hasDedicatedRuffLintTable,
  hasRuffLintTable,
  installLintConfig,
  installOrRefreshChecklist,
  isChecklistUnmodified,
  removeChecklist,
} from "../../src/shared/lint-guidelines.js";
import { normalizeEol } from "../../src/commands/editors/agents.js";

const template = readFileSync(
  join(import.meta.dirname, "..", "..", "templates", "lint-guidelines.md"),
  "utf-8",
);
// Fixture baseline in LF — on a Windows checkout the template reads as CRLF,
// and literal replaces anchored on "\n" would silently miss.
const templateLf = normalizeEol(template);

describe("lint-guidelines checklist data ↔ template pairing", () => {
  it("template contains every rule id from the data source", () => {
    for (const rule of LINT_GUIDELINE_RULES) {
      expect(template.includes(`\`${rule.id}\``), `missing \`${rule.id}\``).toBe(
        true,
      );
    }
  });

  it("template checksum matches its body (tool-owned, refreshed safely)", () => {
    expect(isChecklistUnmodified(template)).toBe(true);
    const line = template
      .split("\n")
      .find((l) => l.startsWith(LINT_GUIDELINES_CHECKSUM_PREFIX));
    expect(line).toBeDefined();
    expect(line).toContain(computeChecklistChecksum(template));
  });

  it("CRLF content (Windows checkout) hashes to the same checksum", () => {
    const crlf = templateLf.replace(/\n/g, "\r\n");
    expect(computeChecklistChecksum(crlf)).toBe(
      computeChecklistChecksum(templateLf),
    );
    expect(isChecklistUnmodified(crlf)).toBe(true);
  });

  it("default-state contract: only B904 is off by default", () => {
    const offByDefault = LINT_GUIDELINE_RULES.filter((r) => !r.defaultOn);
    expect(offByDefault.map((r) => r.id)).toEqual(["B904"]);
  });

  it("no-empty boundary (comment exemption) is stated in the template", () => {
    expect(template).toMatch(/comment/i);
    expect(template).toMatch(/\.catch\(\(\) => null/);
  });
});

describe("lint-guidelines install / refresh (content-based ownership)", () => {
  const staleBody = templateLf.replace("## Rules\n", "## Rules (old)\n");

  /** A checklist file whose checksum is valid for its (older) body = tool-owned. */
  function staleToolOwnedFixture(): string {
    const checksum = computeChecklistChecksum(staleBody);
    const line = `${LINT_GUIDELINES_CHECKSUM_PREFIX}${checksum} -->`;
    return staleBody.replace(
      /^<!-- openspec-pw: lint-guidelines [0-9a-f]{8} -->$/m,
      line,
    );
  }

  it("missing file → created with template content, bare temp root works (no scaffold)", () => {
    const root = mkdtempSync(join(tmpdir(), "ospw-lintguidelines-"));
    try {
      const disposition = installOrRefreshChecklist(root);
      expect(disposition).toBe("created");
      expect(readFileSync(join(root, LINT_GUIDELINES_RELPATH), "utf-8")).toBe(
        template,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("identical content → unchanged (idempotent second run)", () => {
    const root = mkdtempSync(join(tmpdir(), "ospw-lintguidelines-"));
    try {
      expect(installOrRefreshChecklist(root)).toBe("created");
      expect(installOrRefreshChecklist(root)).toBe("unchanged");
      expect(readFileSync(join(root, LINT_GUIDELINES_RELPATH), "utf-8")).toBe(
        template,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("tool-owned stale file (old checksum, never user-modified) → refreshed", () => {
    const root = mkdtempSync(join(tmpdir(), "ospw-lintguidelines-"));
    try {
      const stale = staleToolOwnedFixture();
      expect(isChecklistUnmodified(stale)).toBe(true);
      writeFileSync(join(root, LINT_GUIDELINES_RELPATH), stale);
      const disposition = installOrRefreshChecklist(root);
      expect(disposition).toBe("refreshed");
      expect(readFileSync(join(root, LINT_GUIDELINES_RELPATH), "utf-8")).toBe(
        template,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("user-modified file (checksum no longer matches body) → kept-modified, untouched", () => {
    const root = mkdtempSync(join(tmpdir(), "ospw-lintguidelines-"));
    try {
      const handEdited = templateLf.replace("## Rules\n", "## My Rules\n");
      writeFileSync(join(root, LINT_GUIDELINES_RELPATH), handEdited);
      expect(isChecklistUnmodified(handEdited)).toBe(false);
      const disposition = installOrRefreshChecklist(root);
      expect(disposition).toBe("kept-modified");
      expect(readFileSync(join(root, LINT_GUIDELINES_RELPATH), "utf-8")).toBe(
        handEdited,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("caller-supplied template content (fetched tarball) is the install/refresh source", () => {
    const root = mkdtempSync(join(tmpdir(), "ospw-lintguidelines-"));
    try {
      const fetched = staleToolOwnedFixture();
      expect(installOrRefreshChecklist(root, fetched)).toBe("created");
      expect(readFileSync(join(root, LINT_GUIDELINES_RELPATH), "utf-8")).toBe(
        fetched,
      );
      expect(installOrRefreshChecklist(root)).toBe("refreshed");
      expect(readFileSync(join(root, LINT_GUIDELINES_RELPATH), "utf-8")).toBe(
        template,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("stripped checksum line counts as user-modified → kept-modified", () => {
    const root = mkdtempSync(join(tmpdir(), "ospw-lintguidelines-"));
    try {
      const noChecksum = templateLf.replace(
        /^<!-- openspec-pw: lint-guidelines [0-9a-f]{8} -->\n/m,
        "",
      );
      writeFileSync(join(root, LINT_GUIDELINES_RELPATH), noChecksum);
      expect(installOrRefreshChecklist(root)).toBe("kept-modified");
      expect(readFileSync(join(root, LINT_GUIDELINES_RELPATH), "utf-8")).toBe(
        noChecksum,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("lint-guidelines uninstall (content-based ownership)", () => {
  it("tool-owned checklist → removed", () => {
    const root = mkdtempSync(join(tmpdir(), "ospw-lintguidelines-rm-"));
    try {
      writeFileSync(join(root, LINT_GUIDELINES_RELPATH), template);
      expect(removeChecklist(root)).toBe("removed");
      expect(() =>
        readFileSync(join(root, LINT_GUIDELINES_RELPATH), "utf-8"),
      ).toThrow();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("user-modified checklist → kept as-is (content preserved)", () => {
    const root = mkdtempSync(join(tmpdir(), "ospw-lintguidelines-rm-"));
    try {
      const handEdited = templateLf.replace("## Rules\n", "## My Rules\n");
      writeFileSync(join(root, LINT_GUIDELINES_RELPATH), handEdited);
      expect(removeChecklist(root)).toBe("kept-modified");
      expect(readFileSync(join(root, LINT_GUIDELINES_RELPATH), "utf-8")).toBe(
        handEdited,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("absent checklist → absent, no touch", () => {
    const root = mkdtempSync(join(tmpdir(), "ospw-lintguidelines-rm-"));
    try {
      expect(removeChecklist(root)).toBe("absent");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("findSourceFile (bounded scan)", () => {
  it("prefers src/ even when an alphabetically earlier tree exhausts the entry budget", () => {
    const root = mkdtempSync(join(tmpdir(), "ospw-findsource-"));
    try {
      mkdirSync(join(root, "aaa"));
      for (let i = 0; i < 210; i++) {
        writeFileSync(join(root, "aaa", `f${i}.txt`), "");
      }
      mkdirSync(join(root, "src"));
      writeFileSync(join(root, "src", "app.ts"), "export {};\n");
      expect(findSourceFile(root, [".ts"])).toBe(join(root, "src", "app.ts"));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("skips node_modules, dot dirs and tool config files", () => {
    const root = mkdtempSync(join(tmpdir(), "ospw-findsource-"));
    try {
      mkdirSync(join(root, "node_modules"));
      writeFileSync(join(root, "node_modules", "dep.ts"), "export {};\n");
      mkdirSync(join(root, ".cache"));
      writeFileSync(join(root, ".cache", "hidden.ts"), "export {};\n");
      writeFileSync(join(root, "eslint.config.mjs"), "export default [];\n");
      writeFileSync(join(root, "vitest.config.ts"), "export default {};\n");
      expect(findSourceFile(root, [".ts", ".mjs"])).toBeNull();
      writeFileSync(join(root, "app.mjs"), "export {};\n");
      expect(findSourceFile(root, [".ts", ".mjs"])).toBe(join(root, "app.mjs"));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("ruff managed block helpers", () => {
  it("block is built with begin/end markers around the table", () => {
    expect(buildRuffManagedBlock("[tool.ruff.lint]")).toBe(
      [
        LINT_RUFF_BLOCK_BEGIN,
        "[tool.ruff.lint]",
        'extend-select = ["B904"]',
        LINT_RUFF_BLOCK_END,
      ].join("\n"),
    );
  });

  it("findRuffManagedBlock returns the body, normalizing CRLF", () => {
    const block = buildRuffManagedBlock("[lint]");
    const crlfFile = `[project]\r\nname = "x"\r\n${block.split("\n").join("\r\n")}\r\n`;
    expect(findRuffManagedBlock(crlfFile)).toBe(
      '[lint]\nextend-select = ["B904"]',
    );
  });

  it("findRuffManagedBlock returns null when markers are absent or unpaired", () => {
    expect(findRuffManagedBlock("[lint]\nextend-select = [\"B904\"]\n")).toBe(
      null,
    );
    expect(findRuffManagedBlock(`${LINT_RUFF_BLOCK_BEGIN}\n[lint]\n`)).toBe(
      null,
    );
  });

  it("hasRuffLintTable matches the pyproject table as a wide literal", () => {
    expect(hasRuffLintTable("[tool.ruff.lint]\nextend-select = []")).toBe(true);
    expect(hasRuffLintTable("# see tool.ruff.lint docs")).toBe(true);
    expect(hasRuffLintTable("[tool.ruff]\nline-length = 88")).toBe(false);
  });

  it("hasDedicatedRuffLintTable matches [lint], subtables and dotted keys", () => {
    expect(hasDedicatedRuffLintTable("[lint]\nselect = []")).toBe(true);
    expect(
      hasDedicatedRuffLintTable("[lint.per-file-ignores]\n\"a.py\" = []"),
    ).toBe(true);
    expect(hasDedicatedRuffLintTable("lint.select = [\"E\"]")).toBe(true);
    expect(hasDedicatedRuffLintTable("[tool.ruff.lint]\nselect = []")).toBe(
      false,
    );
  });
});

describe("eslintMajorFromSpec", () => {
  it.each([
    ["^9.0.0", 9],
    ["~9.20.1", 9],
    [">=9", 9],
    ["9.x", 9],
    ["^10.2.0", 10],
    ["16.0.0", 16],
  ])("%s → %i", (spec, expected) => {
    expect(eslintMajorFromSpec(spec)).toBe(expected);
  });

  it.each(["workspace:*", "npm:eslint@9.0.0", "latest", "file:../eslint", "github:o/r"])(
    "unresolvable spec %s → null (conservative skip)",
    (spec) => {
      expect(eslintMajorFromSpec(spec)).toBeNull();
    },
  );
});

interface TempPair {
  /** Parent directory containing `.git` (git-root fixture). */
  parent: string;
  /** Project directory under the parent. */
  child: string;
}

function makeTempPair(prefix: string): TempPair {
  const parent = mkdtempSync(join(tmpdir(), prefix));
  mkdirSync(join(parent, ".git"));
  const child = join(parent, "project");
  mkdirSync(child);
  return { parent, child };
}

function writePackageJson(root: string, deps: Record<string, string>): void {
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({ name: "fixture", devDependencies: deps }, null, 2),
  );
}

describe("installLintConfig: ESLint 面", () => {
  it("eslint 9 without config → creates minimal flat config flagged as generated", () => {
    const root = mkdtempSync(join(tmpdir(), "ospw-lintconfig-eslint-"));
    try {
      writePackageJson(root, { eslint: "^9.0.0" });
      const [eslint] = installLintConfig(root);
      expect(eslint).toMatchObject({ tool: "ESLint", action: "created" });
      const generated = readFileSync(
        join(root, LINT_ESLINT_CONFIG_FILE),
        "utf-8",
      );
      expect(generated.startsWith(LINT_ESLINT_GENERATED_MARKER)).toBe(true);
      // Self-contained: eslint 10 no longer depends on @eslint/js, so the
      // generated config enables no-empty directly instead of importing it.
      expect(generated).toContain('"no-empty": "error"');
      expect(generated).not.toContain("@eslint/js");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("second run recognizes the generated marker → generated-existing, file untouched", () => {
    const root = mkdtempSync(join(tmpdir(), "ospw-lintconfig-eslint-"));
    try {
      writePackageJson(root, { eslint: "^9.0.0" });
      expect(installLintConfig(root)[0].action).toBe("created");
      const first = readFileSync(join(root, LINT_ESLINT_CONFIG_FILE), "utf-8");
      expect(installLintConfig(root)[0].action).toBe("generated-existing");
      expect(readFileSync(join(root, LINT_ESLINT_CONFIG_FILE), "utf-8")).toBe(
        first,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("existing user config → snippet-only, file not edited", () => {
    const root = mkdtempSync(join(tmpdir(), "ospw-lintconfig-eslint-"));
    try {
      writePackageJson(root, { eslint: "^9.0.0" });
      const userConfig = '{"rules": {"no-console": "warn"}}\n';
      writeFileSync(join(root, ".eslintrc.json"), userConfig);
      const [eslint] = installLintConfig(root);
      expect(eslint).toMatchObject({
        tool: "ESLint",
        action: "snippet",
        file: join(root, ".eslintrc.json"),
      });
      expect(readFileSync(join(root, ".eslintrc.json"), "utf-8")).toBe(
        userConfig,
      );
      expect(() =>
        readFileSync(join(root, LINT_ESLINT_CONFIG_FILE), "utf-8"),
      ).toThrow();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("ancestor config → snippet-only, no child config generated (monorepo shadowing)", () => {
    const { parent, child } = makeTempPair("ospw-lintconfig-eslint-anc-");
    try {
      writePackageJson(child, { eslint: "^9.0.0" });
      writeFileSync(join(parent, "eslint.config.js"), "export default [];\n");
      const [eslint] = installLintConfig(child);
      expect(eslint.action).toBe("snippet");
      expect(eslint.file).toBe(join(parent, "eslint.config.js"));
      expect(eslint.reason).toContain("ancestor");
      expect(() =>
        readFileSync(join(child, LINT_ESLINT_CONFIG_FILE), "utf-8"),
      ).toThrow();
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it("TypeScript project without typescript-eslint → skipped (minimal config has no TS parser)", () => {
    const root = mkdtempSync(join(tmpdir(), "ospw-lintconfig-eslint-ts-"));
    try {
      writePackageJson(root, { eslint: "^9.0.0", typescript: "^5.6.0" });
      writeFileSync(join(root, "tsconfig.json"), "{}\n");
      const [eslint] = installLintConfig(root);
      expect(eslint.action).toBe("skipped");
      expect(eslint.reason).toContain("typescript-eslint");
      expect(() =>
        readFileSync(join(root, LINT_ESLINT_CONFIG_FILE), "utf-8"),
      ).toThrow();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("TypeScript project with typescript-eslint → generated", () => {
    const root = mkdtempSync(join(tmpdir(), "ospw-lintconfig-eslint-ts-"));
    try {
      writePackageJson(root, {
        eslint: "^9.0.0",
        typescript: "^5.6.0",
        "typescript-eslint": "^8.0.0",
      });
      writeFileSync(join(root, "tsconfig.json"), "{}\n");
      expect(installLintConfig(root)[0].action).toBe("created");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it.each([
    ["eslint < 9", { eslint: "^8.57.0" }, "flat-config"],
    ["eslint absent", { typescript: "^5.6.0" }, "not in dependencies"],
    ["unresolvable eslint spec", { eslint: "workspace:*" }, "not resolvable"],
  ])("%s → skipped with reason", (_label, deps, reasonPart) => {
    const root = mkdtempSync(join(tmpdir(), "ospw-lintconfig-eslint-skip-"));
    try {
      writePackageJson(root, deps);
      const [eslint] = installLintConfig(root);
      expect(eslint.action).toBe("skipped");
      expect(eslint.reason).toContain(reasonPart);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("no package.json → skipped", () => {
    const root = mkdtempSync(join(tmpdir(), "ospw-lintconfig-eslint-skip-"));
    try {
      const [eslint] = installLintConfig(root);
      expect(eslint.action).toBe("skipped");
      expect(eslint.reason).toContain("package.json");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("installLintConfig: ruff 面", () => {
  function lastResult(root: string) {
    const results = installLintConfig(root);
    expect(results).toHaveLength(2);
    return results[1];
  }

  it("no Python signal → skipped", () => {
    const root = mkdtempSync(join(tmpdir(), "ospw-lintconfig-ruff-skip-"));
    try {
      const result = lastResult(root);
      expect(result).toMatchObject({ tool: "ruff", action: "skipped" });
      expect(result.reason).toContain("Python");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("pyproject without ruff tables → managed [tool.ruff.lint] block appended, rest untouched", () => {
    const root = mkdtempSync(join(tmpdir(), "ospw-lintconfig-ruff-pyproject-"));
    try {
      const original = '[project]\nname = "fixture"\nversion = "0.1.0"\n';
      writeFileSync(join(root, "pyproject.toml"), original);
      const result = lastResult(root);
      expect(result).toMatchObject({ tool: "ruff", action: "appended" });
      const content = readFileSync(join(root, "pyproject.toml"), "utf-8");
      expect(content.startsWith(original)).toBe(true);
      expect(content).toContain(
        buildRuffManagedBlock("[tool.ruff.lint]"),
      );
      expect(content.endsWith("\n")).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("second run → unchanged; hand-edited block → kept-modified without overwrite", () => {
    const root = mkdtempSync(join(tmpdir(), "ospw-lintconfig-ruff-pyproject-"));
    try {
      writeFileSync(join(root, "pyproject.toml"), '[project]\nname = "x"\n');
      expect(lastResult(root).action).toBe("appended");
      expect(lastResult(root).action).toBe("unchanged");

      const edited = readFileSync(join(root, "pyproject.toml"), "utf-8").replace(
        'extend-select = ["B904"]',
        'extend-select = ["B904", "E501"]',
      );
      writeFileSync(join(root, "pyproject.toml"), edited);
      expect(lastResult(root).action).toBe("kept-modified");
      expect(readFileSync(join(root, "pyproject.toml"), "utf-8")).toBe(edited);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("pyproject already carrying [tool.ruff.lint] → snippet-only, untouched", () => {
    const root = mkdtempSync(join(tmpdir(), "ospw-lintconfig-ruff-snippet-"));
    try {
      const original = '[tool.ruff.lint]\nselect = ["E", "F"]\n';
      writeFileSync(join(root, "pyproject.toml"), original);
      const result = lastResult(root);
      expect(result.action).toBe("snippet");
      expect(readFileSync(join(root, "pyproject.toml"), "utf-8")).toBe(original);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("pyproject with [tool.ruff] but no lint table → append (project config already active)", () => {
    const root = mkdtempSync(join(tmpdir(), "ospw-lintconfig-ruff-pyproject-"));
    try {
      writeFileSync(
        join(root, "pyproject.toml"),
        '[tool.ruff]\nline-length = 88\n',
      );
      expect(lastResult(root).action).toBe("appended");
      expect(readFileSync(join(root, "pyproject.toml"), "utf-8")).toContain(
        "[tool.ruff.lint]",
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("pyproject without ruff tables but ancestor ruff config → snippet-only (no shadowing)", () => {
    const { parent, child } = makeTempPair("ospw-lintconfig-ruff-anc-");
    try {
      const original = '[project]\nname = "sub"\n';
      writeFileSync(join(child, "pyproject.toml"), original);
      writeFileSync(join(parent, "ruff.toml"), 'line-length = 100\n');
      const result = lastResult(child);
      expect(result.action).toBe("snippet");
      expect(result.reason).toContain("ancestor");
      expect(readFileSync(join(child, "pyproject.toml"), "utf-8")).toBe(
        original,
      );
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it("dedicated ruff.toml without [lint] → [lint] block appended", () => {
    const root = mkdtempSync(join(tmpdir(), "ospw-lintconfig-ruff-dedicated-"));
    try {
      const original = 'line-length = 100\ntarget-version = "py311"\n';
      writeFileSync(join(root, "ruff.toml"), original);
      const result = lastResult(root);
      expect(result.action).toBe("appended");
      const content = readFileSync(join(root, "ruff.toml"), "utf-8");
      expect(content.startsWith(original)).toBe(true);
      expect(content).toContain(buildRuffManagedBlock("[lint]"));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it(".ruff.toml wins over pyproject when both exist", () => {
    const root = mkdtempSync(join(tmpdir(), "ospw-lintconfig-ruff-dedicated-"));
    try {
      writeFileSync(join(root, "pyproject.toml"), '[project]\nname = "x"\n');
      writeFileSync(join(root, ".ruff.toml"), "line-length = 90\n");
      expect(lastResult(root).action).toBe("appended");
      expect(readFileSync(join(root, "pyproject.toml"), "utf-8")).toBe(
        '[project]\nname = "x"\n',
      );
      expect(readFileSync(join(root, ".ruff.toml"), "utf-8")).toContain(
        "[lint]",
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("dedicated ruff.toml already carrying [lint] → snippet-only", () => {
    const root = mkdtempSync(join(tmpdir(), "ospw-lintconfig-ruff-snippet-"));
    try {
      const original = "[lint]\nselect = [\"E\"]\n";
      writeFileSync(join(root, "ruff.toml"), original);
      expect(lastResult(root).action).toBe("snippet");
      expect(readFileSync(join(root, "ruff.toml"), "utf-8")).toBe(original);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("no config files but a .py file → creates ruff.toml with managed block", () => {
    const root = mkdtempSync(join(tmpdir(), "ospw-lintconfig-ruff-create-"));
    try {
      mkdirSync(join(root, "src"));
      writeFileSync(join(root, "src", "app.py"), "print('hi')\n");
      const result = lastResult(root);
      expect(result).toMatchObject({ tool: "ruff", action: "created" });
      const content = readFileSync(join(root, "ruff.toml"), "utf-8");
      expect(content).toBe(`${buildRuffManagedBlock("[lint]")}\n`);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("ancestor config with no local files → snippet-only, no ruff.toml created", () => {
    const { parent, child } = makeTempPair("ospw-lintconfig-ruff-anc-");
    try {
      writeFileSync(join(parent, "ruff.toml"), "[lint]\nselect = [\"E\"]\n");
      mkdirSync(join(child, "src"));
      writeFileSync(join(child, "src", "app.py"), "print('hi')\n");
      const result = lastResult(child);
      expect(result.action).toBe("snippet");
      expect(() => readFileSync(join(child, "ruff.toml"), "utf-8")).toThrow();
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it("CRLF pyproject keeps CRLF in the appended block", () => {
    const root = mkdtempSync(join(tmpdir(), "ospw-lintconfig-ruff-crlf-"));
    try {
      const original = '[project]\r\nname = "x"\r\n';
      writeFileSync(join(root, "pyproject.toml"), original);
      expect(lastResult(root).action).toBe("appended");
      const content = readFileSync(join(root, "pyproject.toml"), "utf-8");
      expect(content.startsWith(original)).toBe(true);
      expect(content).toContain(
        buildRuffManagedBlock("[tool.ruff.lint]").split("\n").join("\r\n"),
      );
      expect(lastResult(root).action).toBe("unchanged");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("file missing a trailing newline still gets the block on its own line", () => {
    const root = mkdtempSync(join(tmpdir(), "ospw-lintconfig-ruff-eol-"));
    try {
      writeFileSync(join(root, "pyproject.toml"), '[project]\nname = "x"');
      expect(lastResult(root).action).toBe("appended");
      expect(readFileSync(join(root, "pyproject.toml"), "utf-8")).toBe(
        `[project]\nname = "x"\n${buildRuffManagedBlock("[tool.ruff.lint]")}\n`,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("py with ancestor pyproject carrying [tool.ruff] is treated as an ancestor config", () => {
    const { parent, child } = makeTempPair("ospw-lintconfig-ruff-anc-");
    try {
      writeFileSync(
        join(parent, "pyproject.toml"),
        '[tool.ruff]\nline-length = 100\n',
      );
      writeFileSync(join(child, "pyproject.toml"), '[project]\nname = "sub"\n');
      expect(lastResult(child).action).toBe("snippet");
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });
});