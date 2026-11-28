import { existsSync, readFileSync } from "fs";
import { basename, join } from "path";
import { fileURLToPath } from "url";
import chalk from "chalk";
import {
  STANDARDS_FILES,
  detectInstalledLanguage,
  detectInstalledProfile,
  missingEnglishSections,
  resolveStandardsLanguage,
  resolveStandardsProfile,
  type StandardsLanguage,
  type StandardsProfile,
} from "../shared/index.js";
import { extractRuleBlockContent } from "../shared/drift.js";
import { readEmployeeStandards } from "./editors/project-rules.js";

export interface ProjectStandards {
  language: StandardsLanguage;
  profile: StandardsProfile;
  content: string;
}

export interface StandardsSourceOptions {
  lang?: string;
  standards?: string;
}

/** Absolute paths to the four bundled standards files, keyed by language and profile. */
export function bundledStandardsSources(): Record<
  StandardsLanguage,
  Record<StandardsProfile, string>
> {
  const resolve = (language: StandardsLanguage, profile: StandardsProfile) =>
    fileURLToPath(
      new URL(
        `../../standards/${STANDARDS_FILES[language][profile]}`,
        import.meta.url,
      ),
    );
  return {
    zh: { general: resolve("zh", "general"), ml: resolve("zh", "ml") },
    en: { general: resolve("en", "general"), ml: resolve("en", "ml") },
  };
}

export interface InstalledStandards {
  raw: string | null;
  block: string | null;
  language: StandardsLanguage | null;
  profile: StandardsProfile | null;
}

export interface StandardsSignals {
  block: string | null;
  language: StandardsLanguage | null;
  profile: StandardsProfile | null;
}

/** Derive the installed language/profile from a file body (any carrier). */
export function detectStandardsSignals(
  content: string | null,
): StandardsSignals {
  const block = content === null ? null : extractRuleBlockContent(content);
  return {
    block,
    language: detectInstalledLanguage(block),
    profile: detectInstalledProfile(block),
  };
}

/** Read AGENTS.md once and derive every installed-standards signal from it. */
export function readInstalledStandards(projectRoot: string): InstalledStandards {
  const agentsPath = join(projectRoot, "AGENTS.md");
  const raw = existsSync(agentsPath) ? readFileSync(agentsPath, "utf-8") : null;
  return { raw, ...detectStandardsSignals(raw) };
}

/**
 * Pick and load the bundled standards SSOT for a project. Returns `null` after
 * printing a visible error when the file is missing or the English SSOT is
 * incomplete; callers turn that into their own exit path.
 */
export function loadProjectStandards(
  projectRoot: string,
  sources: Record<StandardsLanguage, Record<StandardsProfile, string>>,
  options: StandardsSourceOptions = {},
): ProjectStandards | null {
  const installed = readInstalledStandards(projectRoot);
  const language = resolveStandardsLanguage({
    flag: options.lang,
    installed: installed.language,
  });
  const profile = resolveStandardsProfile({
    flag: options.standards,
    installed: installed.profile,
  });
  const src = sources[language][profile];
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
  return { language, profile, content };
}
