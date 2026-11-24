/**
 * `formatArtifact` covers the nine artifact shapes the eight adapters emit.
 * The snapshot is the byte-level contract: when adapters migrate to
 * declarations, their `formatCommand` output must still match it.
 */
import { describe, it, expect } from "vitest";
import {
  buildCommandMeta,
  formatArtifact,
  type ArtifactSpec,
} from "../src/commands/editors.js";

const META = buildCommandMeta(
  "Run /opsx:e2e for the change.\nSee /opsx:propose for planning.\n",
);

const path = (id: string) => `artifacts/${id}.md`;

const SHAPES: Record<string, ArtifactSpec> = {
  "claude/codebuddy command": {
    path,
    naming: "namespace-dir",
    frontmatter: { description: true, argumentHint: "<change-name|all>" },
  },
  "opencode command": {
    path,
    naming: "hyphen-prefix",
    frontmatter: { description: true },
  },
  "cursor command": {
    path,
    naming: "hyphen-prefix",
    header: (meta) => `<!-- Change name: $1 (e.g. /opsx-${meta.id} my-change) -->`,
  },
  "cursor skill": {
    path,
    naming: "hyphen-prefix",
    frontmatter: {
      name: true,
      description: true,
      disableModelInvocation: true,
    },
  },
  "omp command": {
    path,
    naming: "hyphen-prefix",
    frontmatter: { name: true, description: true },
  },
  "pi prompt": {
    path,
    naming: "hyphen-prefix",
    frontmatter: { description: true, argumentHint: "<change-name>" },
  },
  "cline skill": {
    path,
    naming: "hyphen-prefix",
    frontmatter: { name: true, description: true },
  },
  "minimax skill": {
    path,
    naming: "hyphen-prefix",
    frontmatter: { name: true, description: true },
  },
};

describe("formatArtifact", () => {
  it("renders every artifact shape byte-stably", () => {
    expect(
      Object.fromEntries(
        Object.entries(SHAPES).map(([name, spec]) => [
          name,
          formatArtifact(spec, META),
        ]),
      ),
    ).toMatchInlineSnapshot(`
      {
        "claude/codebuddy command": "---
      description: Run Playwright E2E verification for an OpenSpec change
      argument-hint: "<change-name|all>"
      ---

      Run /opsx:e2e for the change.
      See /opsx:propose for planning.

      ",
        "cline skill": "---
      name: opsx-e2e
      description: Run Playwright E2E verification for an OpenSpec change
      ---

      Run /opsx-e2e for the change.
      See /opsx-propose for planning.

      ",
        "cursor command": "<!-- Change name: $1 (e.g. /opsx-e2e my-change) -->

      Run /opsx-e2e for the change.
      See /opsx-propose for planning.

      ",
        "cursor skill": "---
      name: opsx-e2e
      description: Run Playwright E2E verification for an OpenSpec change
      disable-model-invocation: true
      ---

      Run /opsx-e2e for the change.
      See /opsx-propose for planning.

      ",
        "minimax skill": "---
      name: opsx-e2e
      description: Run Playwright E2E verification for an OpenSpec change
      ---

      Run /opsx-e2e for the change.
      See /opsx-propose for planning.

      ",
        "omp command": "---
      name: opsx-e2e
      description: Run Playwright E2E verification for an OpenSpec change
      ---

      Run /opsx-e2e for the change.
      See /opsx-propose for planning.

      ",
        "opencode command": "---
      description: Run Playwright E2E verification for an OpenSpec change
      ---

      Run /opsx-e2e for the change.
      See /opsx-propose for planning.

      ",
        "pi prompt": "---
      description: Run Playwright E2E verification for an OpenSpec change
      argument-hint: "<change-name>"
      ---

      Run /opsx-e2e for the change.
      See /opsx-propose for planning.

      ",
      }
    `);
  });

  it("rewrites bodies only for hyphen-prefix artifacts", () => {
    const hyphen = formatArtifact(SHAPES["cline skill"], META);
    const colon = formatArtifact(SHAPES["claude/codebuddy command"], META);
    expect(hyphen).toContain("/opsx-e2e");
    expect(hyphen).not.toContain("/opsx:");
    expect(colon).toContain("/opsx:e2e");
    expect(colon).not.toContain("/opsx-e2e");
  });

  it("rewrites bodies to the 2.x family when the style is openspec", () => {
    const out = formatArtifact(
      {
        path,
        naming: "hyphen-prefix",
        frontmatter: { name: true, description: true },
      },
      META,
      "openspec",
    );
    expect(out).toContain("name: openspec-e2e");
    expect(out).toContain("/openspec-e2e");
    expect(out).not.toContain("/opsx:e2e");
    expect(out).not.toContain("/opsx-e2e");
  });

  it("emits frontmatter before the header when both are declared", () => {
    const out = formatArtifact(
      {
        path,
        naming: "hyphen-prefix",
        frontmatter: { description: true },
        header: "<!-- note -->",
      },
      META,
    );
    expect(out.startsWith("---\n")).toBe(true);
    expect(out).toContain("<!-- note -->");
    expect(out.indexOf("<!-- note -->")).toBeGreaterThan(
      out.indexOf("description:"),
    );
  });

  it("escapes quotes in argument-hint", () => {
    const out = formatArtifact(
      {
        path,
        naming: "hyphen-prefix",
        frontmatter: { description: true, argumentHint: 'say "hi"' },
      },
      META,
    );
    expect(out).toContain('argument-hint: "say \\"hi\\""');
  });
});

describe("TOML artifacts (Gemini CLI)", () => {
  const tomlSpec: ArtifactSpec = {
    path: () => "cmd.toml",
    naming: "namespace-dir",
    format: "toml",
  };

  it("renders a description and a multi-line prompt", () => {
    const out = formatArtifact(tomlSpec, META);
    expect(out.startsWith('description = "')).toBe(true);
    expect(out).toContain('\n\nprompt = """\n');
    expect(out.endsWith('\n"""\n')).toBe(true);
    // namespace-dir keeps the colon form inside the prompt
    expect(out).toContain("/opsx:e2e");
  });

  it("doubles backslashes and splits a triple-quote run", () => {
    const out = formatArtifact(
      tomlSpec,
      buildCommandMeta('C:\\path and """quoted"""'),
    );
    expect(out).toContain("C:\\\\path");
    expect(out).toContain('""\\"quoted""\\"');
  });

  it("normalizes CRLF and escapes control characters", () => {
    const out = formatArtifact(
      tomlSpec,
      buildCommandMeta("line1\r\nline2\u0007"),
    );
    expect(out).not.toContain("\r");
    expect(out).toContain("line1\nline2\\u0007");
  });
});
