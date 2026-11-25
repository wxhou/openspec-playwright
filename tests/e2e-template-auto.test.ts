import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { bundledTemplatePath } from "../src/shared/drift.js";

const template = readFileSync(
  bundledTemplatePath("templates/e2e-command.md"),
  "utf-8",
);
// `.claude/` is gitignored, so CI has no installed copy to compare against.
const installedCommandPath = join(
  __dirname,
  "..",
  ".claude",
  "commands",
  "opsx",
  "e2e.md",
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
    expect(template).toContain("`playwright-test` and `playwright` absent (Step 4)");
    expect(template).toContain("openspec-pw explore --file");
    expect(template).toContain("npx playwright test <file>");
    expect(template).toContain("Step down only when the tool above");
    expect(template).toContain("deleted after Step 4");
  });

  it("routes each phase to one default tool", () => {
    expect(template).not.toContain("Steps 5–9");
    expect(template).toContain("First execution (Step 9)");
    expect(template).toContain("Repair loop (Step 9, Phase 2");
    expect(template).toContain("re-runs `openspec-pw init --no-mcp` in CI");
    expect(template).toContain(
      "Never write a throwaway script while a browser MCP is present",
    );
    // The MCP-conditional ban does not cover the `--no-mcp` CI path, where a
    // script is allowed; the unconditional rule must survive on its own.
    expect(template).toContain("never a substitute for `npx playwright test`");
    expect(template).toContain("`playwright-test` preferred");
    expect(template).toContain("only Planner also ships as an agent file");
  });

  // The MCP-first diagnosis loop was lost twice to prose compression: the
  // "always required" guarantee and the Healer tool table disappeared in the
  // 297-line rewrite. Lock the rung order by row label, and guard every
  // anchor — indexOf returns -1 for a missing anchor, and `-1 < positive`
  // would pass silently.
  it("keeps browser-MCP diagnosis ahead of a throwaway script", () => {
    const start = template.indexOf("**Browser tool routing**");
    const end = template.indexOf("**Context budget**");
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const routing = template.slice(start, end);
    const at = (needle: string): number => {
      const index = routing.indexOf(needle);
      if (index === -1) throw new Error(`missing routing anchor: ${needle}`);
      return index;
    };

    expect(at("Exploration (Step 4)")).toBeLessThan(
      at("`playwright-test` and `playwright` absent (Step 4)"),
    );
    expect(at("openspec-pw explore --file")).toBeLessThan(
      at("one throwaway script"),
    );
    // The repair row must name all three page-diagnosis tools in order:
    // `test_list` → diagnose in the page → `test_debug` → `test_run`.
    // Scoped to the row because `browser_snapshot` also appears in the
    // exploration row, where a slice-wide indexOf would match it instead.
    const rowStart = at("Repair loop (Step 9, Phase 2");
    const rowEnd = routing.indexOf("\n", rowStart);
    expect(rowEnd).toBeGreaterThan(rowStart);
    const repair = routing.slice(rowStart, rowEnd);
    const positions = [
      "test_list",
      "browser_snapshot",
      "browser_console_messages",
      "browser_network_requests",
      "test_debug",
      "test_run",
    ].map((tool) => {
      const index = repair.indexOf(tool);
      if (index === -1) throw new Error(`missing repair tool: ${tool}`);
      return index;
    });
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    // The failure artifact already contains the DOM at the moment of failure.
    // Without it named first, the repair loop sends every selector failure
    // through a browser round-trip that returns the same ARIA snapshot.
    const artifact = repair.indexOf("error-context.md");
    if (artifact === -1) throw new Error("missing failure artifact: error-context.md");
    expect(artifact).toBeLessThan(positions[0]);
    // Phase 2-3 is what the agent actually executes. If it drifts from the
    // routing table again, the browser-side diagnosis silently disappears —
    // the failure mode this test exists to catch.
    const fixStart = template.indexOf("2-3. **Diagnose, fix + verify**");
    const fixEnd = template.indexOf("2-4.", fixStart);
    expect(fixStart).toBeGreaterThan(-1);
    expect(fixEnd).toBeGreaterThan(fixStart);
    const fixStep = template.slice(fixStart, fixEnd);
    expect(fixStep).toContain("repair loop from the routing table");
    expect(fixStep).toContain("browser_console_messages");
    expect(fixStep).toContain("error-context.md");
    // The browser-only server is named too, so a session without
    // `playwright-test` still routes to MCP instead of a script.
    expect(at("browser-only `playwright` server")).toBeGreaterThan(-1);
  });

  // The routing rule says to record the tool, but `app-exploration.md` had no
  // slot for it — the ainovel run (2026-11-25) wrote the record into the report
  // instead. A field is what makes the requirement executable.
  it("gives the rung record a fixed slot in the exploration file", () => {
    const web = readFileSync(
      bundledTemplatePath("templates/app-exploration.md"),
      "utf-8",
    );
    const mini = readFileSync(
      bundledTemplatePath("templates/miniprogram/app-exploration.md"),
      "utf-8",
    );
    expect(web).toContain("Browser tools: <server> (rung <n>)");
    expect(mini).toContain("Browser tools: <server> (rung <n>)");
    expect(web).toContain('write "none (rung <n>)" when no browser tool is attached');
    expect(mini).toContain('write "none (rung <n>)" when no browser tool is attached');
    // The project-root file is long-lived across runs, so the rung is only
    // mandatory where the run is scoped to a change.
    expect(web).toContain("required in change mode");
    expect(mini).toContain("required in change mode");
    // A reused file must not have its recorded tool rewritten by a later run.
    expect(web).toContain("a reused file keeps it");
    expect(mini).toContain("a reused file keeps it");

    const routing = template.slice(
      template.indexOf("**Browser tool routing**"),
      template.indexOf("**Context budget**"),
    );
    expect(routing).toContain("`Browser tools:`");

    const step42 = template.slice(
      template.indexOf("**4.2. Explore each route**"),
      template.indexOf("**App-level error decisions**"),
    );
    expect(step42).toContain("`Browser tools:`");
    expect(step42).toContain("MUST be `BASE_URL:` and `Browser tools:` in change mode");
    expect(step42).toContain("may omit both");
    expect(step42).toContain("openspec/changes/<name>/specs/playwright/");

    const miniSection = template.slice(
      template.indexOf("## Mini-program target"),
    );
    expect(miniSection).toContain("`Browser tools:`");

    const reportSection = template.slice(
      template.indexOf("### 10. Report results"),
      template.indexOf("## Guardrails"),
    );
    expect(reportSection).toContain("Tool: `<server> (rung <n>)`");
    expect(reportSection).toContain("without the `Tool:` line is incomplete");
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

  it.skipIf(!existsSync(installedCommandPath))(
    "keeps the installed Claude command in sync with the template body",
    () => {
      const installed = readFileSync(installedCommandPath, "utf-8");
      const body = installed.replace(/^---[\s\S]*?---\n/, "");
      expect(body.trim()).toBe(template.trim());
    },
  );
});
