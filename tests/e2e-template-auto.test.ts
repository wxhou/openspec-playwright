import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
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
    expect(template).toContain("Your own reading is not approval");
  });

  // CI has no browser MCP. Without a documented third rung the agent improvises
  // and reports "the tool was denied" instead of producing exploration data.
  it("documents the no-MCP fallback for headless exploration", () => {
    expect(template).toContain("No browser MCP");
    expect(template).toContain("npx playwright test <file>");
    expect(template).toContain("Step down only when the tool above");
    expect(template).toContain("delete after Step 4");
  });

  it("closes every ask-user path in --auto", () => {
    expect(template).toContain("E2E ABORTED: change name required");
    expect(template).toContain("E2E ABORTED: no specs");
    expect(template).toContain("E2E ABORTED: test data required");
    expect(template).toContain("keep the test and note it in the report");
  });

  it("passes the exploration file to the CLI in change mode", () => {
    expect(template).toContain(
      "openspec-pw explore --file <path-to-app-exploration.md>",
    );
    expect(template).toContain(
      "openspec/changes/<name>/specs/playwright/app-exploration.md",
    );
  });

  it("does not mark tasks verified when tests were skipped", () => {
    expect(template).toContain("0 active App Bugs and 0 skipped");
    expect(template).toContain("E2E incomplete");
  });
});

describe("e2e-command template: mini-program target", () => {
  it("documents target detection and fixture imports", () => {
    expect(template).toContain("## Mini-program target");
    expect(template).toContain("tests/playwright/wxa-test.ts");
    expect(template).toContain("from `./wxa-test`");
  });

  it("uses the fixture API instead of URL navigation", () => {
    expect(template).toContain("miniProgram.open('<page>?<query>')");
    expect(template).toContain("miniProgram.current");
    expect(template).toContain("toHavePath");
    expect(template).toContain("toHavePageData");
    expect(template).toContain("waitForRequest");
  });

  it("forbids web-only exploration and auth", () => {
    expect(template).toContain("Do not call `openspec-pw explore`");
    expect(template).toContain("never sitemap.xml");
    expect(template).toContain("tests/playwright/wxa.setup.ts");
    expect(template).toContain("never URL login");
    expect(template).toContain("`storageState`");
    expect(template).toContain("`auth.setup.ts`");
  });

  it("keeps the installed Claude command in sync with the template body", () => {
    const installed = readFileSync(
      join(__dirname, "..", ".claude", "commands", "opsx", "e2e.md"),
      "utf-8",
    );
    const body = installed.replace(/^---[\s\S]*?---\n/, "");
    expect(body.trim()).toBe(template.trim());
  });
});
