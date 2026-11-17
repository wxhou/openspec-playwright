export type StandardsLanguage = "zh" | "en";

/** Stable content anchors used to tell which language an installed block holds.
 * These strings are load-bearing: rewording either one requires updating the
 * other side's detection and its tests. */
const ZH_ANCHOR = "这份代码库是你的";
const EN_ANCHOR = "This codebase is yours";

/** Returns null for a valid value (or no value), or an error message. */
export function validateLanguageFlag(value: string | undefined): string | null {
  if (value === undefined) return null;
  if (value === "zh" || value === "en") return null;
  return `Invalid --lang "${value}" — use "zh" or "en".`;
}

export function parseLanguageFlag(value: string | undefined): StandardsLanguage | null {
  return value === "zh" || value === "en" ? value : null;
}

const EN_REQUIRED_SECTIONS = ["0", "1", "2", "3", "4", "5", "6", "7"];

/** Section numbers (§0–§7) missing from an English SSOT; §8 is Chinese-only. */
export function missingEnglishSections(content: string): string[] {
  return EN_REQUIRED_SECTIONS.filter(
    (n) => !new RegExp(`^## ${n}\\.`, "m").test(content),
  );
}

/** Parse one locale value; C/POSIX and any non-zh locale map to English. */
function languageOf(raw: string | undefined): StandardsLanguage | null {
  if (!raw) return null;
  const first = raw.split(":")[0]?.trim();
  if (!first) return null;
  const normalized = first.toLowerCase().replace(/-/g, "_").split(/[._@]/)[0] ?? "";
  if (!normalized) return null;
  if (normalized === "c" || normalized === "posix") return "en";
  return normalized.startsWith("zh") ? "zh" : "en";
}

export interface SystemLanguageOptions {
  /** Injected for tests; defaults to process.env. */
  env?: Record<string, string | undefined>;
  /** Injected for tests; defaults to Intl's resolved locale. */
  intlLocale?: string;
}

/**
 * Resolve the terminal's language. GNU gettext gives LANGUAGE the highest
 * priority, so follow the same order; C/POSIX and unknown values mean English.
 */
export function detectSystemLanguage(
  options: SystemLanguageOptions = {},
): StandardsLanguage {
  const env = options.env ?? process.env;
  for (const key of ["LANGUAGE", "LC_ALL", "LC_MESSAGES", "LANG"] as const) {
    const language = languageOf(env[key]);
    if (language) return language;
  }
  const intl =
    options.intlLocale ?? new Intl.DateTimeFormat().resolvedOptions().locale;
  return languageOf(intl) ?? "en";
}

/** null when the content is missing, has neither anchor, or has both. */
export function detectInstalledLanguage(
  content: string | null | undefined,
): StandardsLanguage | null {
  if (!content) return null;
  const zh = content.includes(ZH_ANCHOR);
  const en = content.includes(EN_ANCHOR);
  if (zh === en) return null;
  return zh ? "zh" : "en";
}

export interface ResolveLanguageOptions extends SystemLanguageOptions {
  flag?: string;
  installed?: StandardsLanguage | null;
}

/** Explicit flag > installed block > system locale > English. */
export function resolveStandardsLanguage(
  options: ResolveLanguageOptions = {},
): StandardsLanguage {
  const flag = parseLanguageFlag(options.flag);
  if (flag) return flag;
  if (options.installed) return options.installed;
  return detectSystemLanguage(options);
}
