import {
  detectInstalledLanguage,
  type StandardsLanguage,
} from "./standards-language.js";

export type StandardsProfile = "general" | "ml";

/**
 * Bundled standards file names per language × profile. Load-bearing: the
 * installer, drift checks, and pristine-copy removal all resolve through this
 * table, so a new profile must be added here or it will be silently skipped.
 */
export const STANDARDS_FILES: Record<
  StandardsLanguage,
  Record<StandardsProfile, string>
> = {
  zh: { general: "employee-standards.md", ml: "employee-standards.ml.md" },
  en: {
    general: "employee-standards.en.md",
    ml: "employee-standards.ml.en.md",
  },
};

/** First section heading unique to the ML profile; installs keep no metadata,
 * so the installed block itself is the only persisted signal. */
const ML_ANCHORS: Record<StandardsLanguage, string> = {
  zh: "## 1. 评测完整性",
  en: "## 1. Evaluation Integrity",
};

/** Returns null for a valid value (or no value), or an error message. */
export function validateStandardsFlag(value: string | undefined): string | null {
  if (value === undefined) return null;
  if (value === "general" || value === "ml") return null;
  return `Invalid --standards "${value}" — use "general" or "ml".`;
}

export function parseStandardsFlag(
  value: string | undefined,
): StandardsProfile | null {
  return value === "general" || value === "ml" ? value : null;
}

/** null when the content is empty or is not a standards block at all. */
export function detectInstalledProfile(
  content: string | null | undefined,
): StandardsProfile | null {
  if (!content) return null;
  if (content.includes(ML_ANCHORS.zh) || content.includes(ML_ANCHORS.en)) {
    return "ml";
  }
  return detectInstalledLanguage(content) === null ? null : "general";
}

export interface ResolveProfileOptions {
  flag?: string;
  installed?: StandardsProfile | null;
}

/** Explicit flag > installed block > general (there is no system-wide signal). */
export function resolveStandardsProfile(
  options: ResolveProfileOptions = {},
): StandardsProfile {
  return (
    parseStandardsFlag(options.flag) ?? options.installed ?? "general"
  );
}
