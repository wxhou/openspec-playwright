import { existsSync, readFileSync } from "fs";
import { basename, join } from "path";
import chalk from "chalk";
import {
  detectInstalledLanguage,
  missingEnglishSections,
  resolveStandardsLanguage,
  type StandardsLanguage,
} from "../shared/index.js";
import { extractRuleBlockContent } from "../shared/drift.js";
import { readEmployeeStandards } from "./editors/project-rules.js";

export interface ProjectStandards {
  language: StandardsLanguage;
  content: string;
}

/**
 * Pick and load the bundled standards SSOT for a project. Returns `null` after
 * printing a visible error when the file is missing or the English SSOT is
 * incomplete; callers turn that into their own exit path.
 */
export function loadProjectStandards(
  projectRoot: string,
  sources: { zh: string; en: string },
  flag?: string,
): ProjectStandards | null {
  const agentsPath = join(projectRoot, "AGENTS.md");
  const installed = detectInstalledLanguage(
    existsSync(agentsPath)
      ? extractRuleBlockContent(readFileSync(agentsPath, "utf-8"))
      : null,
  );
  const language = resolveStandardsLanguage({ flag, installed });
  const src = language === "en" ? sources.en : sources.zh;
  const content = readEmployeeStandards(src);
  if (!content) {
    console.error(
      chalk.red(`  ✗ Employee standards file missing: ${basename(src)}`),
    );
    console.error(
      chalk.gray("    Reinstall the CLI: npm install -g openspec-playwright@latest"),
    );
    return null;
  }
  if (language === "en") {
    const missing = missingEnglishSections(content);
    if (missing.length > 0) {
      console.error(
        chalk.red(
          `  ✗ English standards incomplete — missing ${missing.map((n) => `§${n}`).join(", ")}`,
        ),
      );
      console.error(chalk.gray("    Reinstall the CLI or pass --lang zh"));
      return null;
    }
  }
  return { language, content };
}
