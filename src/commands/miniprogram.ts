import { existsSync, readFileSync, writeFileSync } from "fs";
import { readFile } from "fs/promises";
import { join } from "path";
import { fileURLToPath } from "url";
import chalk from "chalk";
import {
  resolveBuildScript,
  resolvePageManifest,
  resolveProjectTarget,
  type TemplateTarget,
} from "../shared/index.js";

const TEMPLATE_DIR = fileURLToPath(new URL("../../templates", import.meta.url));

/**
 * Files that make a project a Web scaffold. The mini-program target must not
 * run against them: init skips existing files, so it would add `wxa-test.ts`
 * (the e2e target marker) while leaving the Web config and BasePage in place.
 */
export function webScaffoldConflicts(projectRoot: string): string[] {
  // Any listed marker means the file already belongs to the mini scaffold.
  const checks: Array<[string, string[]]> = [
    ...["ts", "js", "mjs", "mts"].map(
      (ext) => [`playwright.config.${ext}`, ["wxaProject"]] as [string, string[]],
    ),
    [
      join("tests", "playwright", "seed.spec.ts"),
      ["./wxa-test", "@open-wxa/wxa-runner-playwright"],
    ],
    [join("tests", "playwright", "pages", "BasePage.ts"), ["miniProgram"]],
  ];
  const conflicts: string[] = [];
  for (const [rel, markers] of checks) {
    const abs = join(projectRoot, rel);
    if (!existsSync(abs)) continue;
    try {
      const content = readFileSync(abs, "utf-8");
      if (!markers.some((marker) => content.includes(marker))) conflicts.push(rel);
    } catch {
      conflicts.push(rel);
    }
  }
  return conflicts;
}

/**
 * Refuse a half migration before init writes anything. Only frontend mode
 * writes a Playwright scaffold, so a minimal-mode refresh is never blocked.
 */
export function assertScaffoldCompatible(
  projectRoot: string,
  target: TemplateTarget,
  mode: "frontend" | "minimal",
  explicitWeb: boolean,
): void {
  if (mode !== "frontend") return;
  if (target === "miniprogram") {
    const conflicts = webScaffoldConflicts(projectRoot);
    if (conflicts.length > 0) {
      throw new Error(
        `Existing web Playwright scaffold detected (${conflicts.join(", ")}). ` +
          "Re-running init cannot convert it in place. Move or delete these files " +
          "(keep your tests), then run `openspec-pw init --miniprogram` again.",
      );
    }
    return;
  }
  if (explicitWeb && resolveProjectTarget(projectRoot) === "miniprogram") {
    throw new Error(
      "Existing mini-program Playwright scaffold detected (tests/playwright/wxa-test.ts or wxaProject). " +
        "`--no-miniprogram` cannot convert it in place. Move or delete the mini-program scaffold " +
        "(keep your tests), then re-run `openspec-pw init`.",
    );
  }
}

export async function generateMiniProgramScaffold(projectRoot: string, testsDir: string) {
  const manifest = resolvePageManifest(projectRoot);
  const seedPath = join(testsDir, "seed.spec.ts");
  if (existsSync(seedPath)) {
    console.log(chalk.gray("  - seed.spec.ts already exists, skipping"));
  } else {
    const template = await readFile(
      join(TEMPLATE_DIR, "miniprogram", "seed.spec.ts"),
      "utf-8",
    );
    const homePage = manifest.homePage ?? "";
    // A missing manifest must not turn into a guessed path: skip with the
    // real reason instead of failing with "No tests found".
    const skipLine = manifest.homePage
      ? ""
      : `test.skip(true, ${JSON.stringify(manifest.reason ?? "page manifest unavailable")});`;
    const content = template
      .replace("__HOME_PAGE__", homePage)
      .replace("// __SKIP_LINE__", skipLine);
    writeFileSync(seedPath, content);
    console.log(chalk.green("  ✓ Generated: tests/playwright/seed.spec.ts"));
    if (!manifest.homePage) {
      console.log(
        chalk.yellow(
          `  ⚠ Page manifest unavailable — seed is skipped: ${manifest.reason}`,
        ),
      );
    }
  }

  for (const [srcName, destName, label] of [
    ["wxa-test.ts", "wxa-test.ts", "tests/playwright/wxa-test.ts"],
    ["wxa.setup.ts", "wxa.setup.ts", "tests/playwright/wxa.setup.ts"],
    ["tests-readme.md", "README.md", "tests/playwright/README.md"],
  ] as const) {
    const dest = join(testsDir, destName);
    if (existsSync(dest)) {
      console.log(chalk.gray(`  - ${label} already exists, skipping`));
      continue;
    }
    writeFileSync(dest, readFileSync(join(TEMPLATE_DIR, "miniprogram", srcName)));
    console.log(chalk.green(`  ✓ Generated: ${label}`));
  }

  console.log(
    chalk.gray(
      "  (Auth and login state live in wxa.setup.ts; no auth.setup.ts or credentials.yaml for this target)",
    ),
  );
  console.log(
    chalk.gray(
      "  (Browser runs use base library 3.7.0 — passing here is not proof of real-device behavior)",
    ),
  );
}

export function printMiniProgramNextSteps(projectRoot: string) {
  console.log(
    chalk.gray(
      "  1. Install deps: npm i -D @playwright/test@^1.65 @open-wxa/wxa-runner-playwright@^0.13 @open-wxa/wxa-runner-core@^0.13",
    ),
  );
  console.log(
    chalk.gray("  2. Install Google Chrome: npx playwright install chrome"),
  );
  const build = resolveBuildScript(projectRoot);
  console.log(
    chalk.gray(
      build
        ? `  3. Build the mini program: npm run ${build}`
        : "  3. Build the mini program output (mp-weixin) before running tests",
    ),
  );
  console.log(
    chalk.gray(
      "  4. Preset login state or mocks in tests/playwright/wxa.setup.ts",
    ),
  );
  console.log(
    chalk.gray(
      "  5. Page objects: extend tests/playwright/pages/BasePage.ts for shared selectors",
    ),
  );
}
