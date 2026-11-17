import { describe, it, expect } from "vitest";
import {
  detectInstalledLanguage,
  detectSystemLanguage,
  missingEnglishSections,
  resolveStandardsLanguage,
  validateLanguageFlag,
} from "../../src/shared/standards-language.js";

describe("detectSystemLanguage", () => {
  it("reads LANG when nothing higher is set", () => {
    expect(detectSystemLanguage({ env: { LANG: "zh_CN.UTF-8" } })).toBe("zh");
    expect(detectSystemLanguage({ env: { LANG: "en_US.UTF-8" } })).toBe("en");
  });

  it("gives LANGUAGE the highest priority (gettext order)", () => {
    expect(
      detectSystemLanguage({
        env: { LANGUAGE: "en:zh", LANG: "zh_CN.UTF-8" },
      }),
    ).toBe("en");
  });

  it("lets LC_ALL override LC_MESSAGES and LANG", () => {
    expect(
      detectSystemLanguage({
        env: { LC_ALL: "en_US.UTF-8", LC_MESSAGES: "zh_CN.UTF-8", LANG: "zh_CN.UTF-8" },
      }),
    ).toBe("en");
  });

  it("falls back to LC_MESSAGES when LC_ALL is empty", () => {
    expect(
      detectSystemLanguage({
        env: { LC_ALL: "", LC_MESSAGES: "zh_CN.UTF-8", LANG: "en_US.UTF-8" },
      }),
    ).toBe("zh");
  });

  it("ignores case and accepts hyphen separators", () => {
    expect(detectSystemLanguage({ env: { LANG: "ZH-CN" } })).toBe("zh");
  });

  it("treats C and POSIX as English", () => {
    expect(detectSystemLanguage({ env: { LC_ALL: "C" } })).toBe("en");
    expect(detectSystemLanguage({ env: { LANG: "POSIX" } })).toBe("en");
  });

  it("falls back to Intl when no locale variable is set", () => {
    expect(detectSystemLanguage({ env: {}, intlLocale: "zh-Hans-CN" })).toBe("zh");
    expect(detectSystemLanguage({ env: {}, intlLocale: "en-US" })).toBe("en");
    expect(detectSystemLanguage({ env: {}, intlLocale: "" })).toBe("en");
  });
});

describe("detectInstalledLanguage", () => {
  it("detects the Chinese block", () => {
    expect(detectInstalledLanguage("x\n这份代码库是你的\n")).toBe("zh");
  });

  it("detects the English block", () => {
    expect(detectInstalledLanguage("x\nThis codebase is yours\n")).toBe("en");
  });

  it("returns null when both anchors appear", () => {
    expect(
      detectInstalledLanguage("这份代码库是你的\nThis codebase is yours"),
    ).toBeNull();
  });

  it("returns null when neither anchor appears", () => {
    expect(detectInstalledLanguage("some other content")).toBeNull();
    expect(detectInstalledLanguage("")).toBeNull();
    expect(detectInstalledLanguage(null)).toBeNull();
  });
});

describe("resolveStandardsLanguage", () => {
  it("prefers the explicit flag", () => {
    expect(
      resolveStandardsLanguage({ flag: "en", installed: "zh", env: { LANG: "zh_CN" } }),
    ).toBe("en");
  });

  it("prefers the installed block over the system locale", () => {
    expect(
      resolveStandardsLanguage({ installed: "zh", env: { LANG: "en_US.UTF-8" } }),
    ).toBe("zh");
  });

  it("uses the system locale when nothing is installed", () => {
    expect(
      resolveStandardsLanguage({ installed: null, env: { LANG: "zh_CN.UTF-8" } }),
    ).toBe("zh");
  });

  it("ignores an invalid flag value", () => {
    expect(resolveStandardsLanguage({ flag: "fr", env: { LANG: "zh_CN" } })).toBe("zh");
  });
});

describe("validateLanguageFlag", () => {
  it("accepts zh, en, and no value", () => {
    expect(validateLanguageFlag(undefined)).toBeNull();
    expect(validateLanguageFlag("zh")).toBeNull();
    expect(validateLanguageFlag("en")).toBeNull();
  });

  it("rejects other values", () => {
    expect(validateLanguageFlag("fr")).toContain("Invalid --lang");
    expect(validateLanguageFlag("EN")).toContain("Invalid --lang");
  });
});

describe("missingEnglishSections", () => {
  const complete = ["0", "1", "2", "3", "4", "5", "6", "7"]
    .map((n) => `## ${n}. Section ${n}`)
    .join("\n\n");

  it("accepts a full §0–§7 English SSOT without §8", () => {
    expect(missingEnglishSections(complete)).toEqual([]);
  });

  it("lists every missing section number", () => {
    const partial = complete.replace("## 5. Section 5\n\n", "");
    expect(missingEnglishSections(partial)).toEqual(["5"]);
    expect(missingEnglishSections("## 0. only")).toEqual([
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
    ]);
  });
});
