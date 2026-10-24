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
