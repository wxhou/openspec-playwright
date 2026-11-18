import { execFileSync } from "./exec.js";

export type StandardsLanguage = "zh" | "en";

/** Stable content anchors used to tell which language an installed block holds.
 * These strings are load-bearing: rewording either one requires updating the
 * other side's detection and its tests. */
const ZH_ANCHOR = "这份代码库是你的";
const EN_ANCHOR = "This codebase is yours";
/** Pre-anchor Chinese blocks (before the language-selection release) start
 * their §0 with this heading; current blocks contain it too, so it is only a
 * fallback when neither current anchor matches. */
const LEGACY_ZH_HEADING = "## 0. 适用范围";

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

/** First quoted entry of `defaults read -g AppleLanguages`. */
function firstAppleLanguage(output: string): string | null {
  const match = output.match(/"([^"]+)"/);
  return match?.[1]?.trim() || null;
}

/** Value of a `reg query` line (`REG_SZ` / `REG_MULTI_SZ`, first entry). */
function firstRegValue(output: string): string | null {
  const match = output.match(/\bREG_(?:MULTI_)?SZ\s+([^\r\n]+)/);
  const value = match?.[1]?.trim().split(/\\0/)[0]?.trim();
  return value || null;
}

/** A missing preference value or command is the normal "unavailable" case. */
function tryRead(
  run: (command: string, args: string[]) => string,
  command: string,
  args: string[],
): string | null {
  try {
    const output = run(command, args);
    return typeof output === "string" ? output : null;
  } catch {
    return null;
  }
}

function runCommand(command: string, args: string[]): string {
  const output: unknown = execFileSync(command, args, {
    encoding: "utf-8",
    timeout: 2_000,
  });
  return typeof output === "string" ? output : "";
}

/**
 * Locale tag of the operating system's UI language, or null when it cannot be
 * read. macOS keeps it in AppleLanguages; Windows in the user's preferred UI
 * languages, with the format locale as the fallback. The runner is injectable
 * so tests never spawn a process.
 */
export function readOsLocale(
  platform: NodeJS.Platform = process.platform,
  run: (command: string, args: string[]) => string = runCommand,
): string | null {
  if (platform === "darwin") {
    const languages = tryRead(run, "defaults", [
      "read",
      "-g",
      "AppleLanguages",
    ]);
    const language = languages ? firstAppleLanguage(languages) : null;
    if (language) return language;
    const locale = tryRead(run, "defaults", ["read", "-g", "AppleLocale"]);
    return locale?.trim() || null;
  }
  if (platform === "win32") {
    const ui = tryRead(run, "reg", [
      "query",
      "HKCU\\Control Panel\\Desktop",
      "/v",
      "PreferredUILanguages",
    ]);
    const preferred = ui ? firstRegValue(ui) : null;
    if (preferred) return preferred;
    const locale = tryRead(run, "reg", [
      "query",
      "HKCU\\Control Panel\\International",
      "/v",
      "LocaleName",
    ]);
    return locale ? firstRegValue(locale) : null;
  }
  return null;
}

export interface SystemLanguageOptions {
  /** Injected for tests; defaults to process.env. */
  env?: Record<string, string | undefined>;
  /** Injected for tests; defaults to Intl's resolved locale. */
  intlLocale?: string;
  /** Injected for tests; null disables the OS source. Defaults to readOsLocale(platform). */
  osLocale?: string | null;
  /** Injected for tests; defaults to process.platform. */
  platform?: NodeJS.Platform;
}

/**
 * Resolve the system's language: the OS UI language first (macOS/Windows),
 * then the terminal locale in gettext order; C/POSIX and unknown values mean
 * English.
 */
export function detectSystemLanguage(
  options: SystemLanguageOptions = {},
): StandardsLanguage {
  const osLocale =
    options.osLocale !== undefined
      ? options.osLocale
      : readOsLocale(options.platform ?? process.platform);
  const osLanguage = languageOf(osLocale ?? undefined);
  if (osLanguage) return osLanguage;
  const env = options.env ?? process.env;
  for (const key of ["LANGUAGE", "LC_ALL", "LC_MESSAGES", "LANG"] as const) {
    const language = languageOf(env[key]);
    if (language) return language;
  }
  const intl =
    options.intlLocale ?? new Intl.DateTimeFormat().resolvedOptions().locale;
  return languageOf(intl) ?? "en";
}

/**
 * null when the content is missing, has both current anchors, or matches
 * neither; pre-anchor Chinese blocks fall back to the legacy §0 heading.
 */
export function detectInstalledLanguage(
  content: string | null | undefined,
): StandardsLanguage | null {
  if (!content) return null;
  const zh = content.includes(ZH_ANCHOR);
  const en = content.includes(EN_ANCHOR);
  if (zh && en) return null;
  if (zh) return "zh";
  if (en) return "en";
  return content.includes(LEGACY_ZH_HEADING) ? "zh" : null;
}

export interface ResolveLanguageOptions extends SystemLanguageOptions {
  flag?: string;
  installed?: StandardsLanguage | null;
}

/** Explicit flag > installed block > system language (OS first) > English. */
export function resolveStandardsLanguage(
  options: ResolveLanguageOptions = {},
): StandardsLanguage {
  const flag = parseLanguageFlag(options.flag);
  if (flag) return flag;
  if (options.installed) return options.installed;
  return detectSystemLanguage(options);
}
