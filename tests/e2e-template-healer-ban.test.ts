import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { bundledTemplatePath } from "../src/shared/drift.js";
const template = readFileSync(
  bundledTemplatePath("templates/e2e-command.md"),
  "utf-8",
);

// The healer subagent (vendored from official `playwright init-agents`) is
// allowed to edit assertions and expected values to force tests green — the
// exact opposite of the e2e pipeline's honest-failure exit (test.fixme +
// human Phase 3 decision). The guardrail below is the only thing keeping the
// installed /opsx:e2e command from delegating repair to it once users opt
// into --agents. These anchors fail loudly if a template rewrite drops the
// red line.
describe("e2e-command template keeps the healer delegation ban", () => {
  it("explicitly bans delegating repair to the playwright-test-healer subagent", () => {
    expect(template).toContain("**No subagent delegation for repair**");
    expect(template).toContain("playwright-test-healer");
  });

  it("states the honest-failure exit (never loosen assertions autonomously)", () => {
    expect(template).toContain("**Honest failure exit**");
    expect(template).toContain("never** loosen assertions");
  });

  it("keeps planner/generator delegation allowed (the ban is healer-scoped)", () => {
    expect(template).toMatch(/Delegating the Planner\/Generator steps IS allowed/);
  });
});
