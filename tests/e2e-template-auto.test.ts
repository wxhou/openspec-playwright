import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { bundledTemplatePath } from "../src/shared/drift.js";

const template = readFileSync(
  bundledTemplatePath("templates/e2e-command.md"),
  "utf-8",
);

// `--auto` exists so CI can run the e2e pipeline unattended. It must not turn
// the template into a no-gate run: the human plan approval is swapped for a
// deterministic coverage check, and every "wait for a human" path becomes a
// structured failure instead of silently continuing.
describe("e2e-command template: autonomous mode", () => {
  it("documents the flag and its substitutions", () => {
    expect(template).toContain("`--auto`");
    expect(template).toContain("**Autonomous mode (`--auto`)**");
  });

  it("replaces the plan gate with the deterministic coverage command", () => {
    expect(template).toContain("openspec-pw coverage <name> --plan");
    expect(template).toContain("Do not continue past a red plan gate");
  });

  it("turns human checkpoints into structured aborts", () => {
    expect(template).toContain("ABORT");
    expect(template).toContain("E2E ABORTED");
    expect(template).toContain("Repairs attempted:");
  });

  it("keeps the interactive gate and the healer guardrails untouched", () => {
    expect(template).toContain("**⚠️ Human verification**");
    expect(template).toContain("Ask user to confirm before proceeding to Step 6");
    expect(template).toContain("never** loosen assertions");
    expect(template).toContain("**Honest failure exit**");
  });

  it("says out loud that a self-read plan is not approval", () => {
    expect(template).toContain("Your own reading of the plan is not approval");
  });

  // CI has no browser MCP. Without a documented third rung the agent improvises
  // and reports "the tool was denied" instead of producing exploration data.
  it("documents the no-MCP fallback for headless exploration", () => {
    expect(template).toContain("No browser MCP at all");
    expect(template).toContain("npx playwright test <file>");
    expect(template).toContain("The routing is a chain, not a menu");
    expect(template).toContain("delete them when Step 4 ends");
  });
});
