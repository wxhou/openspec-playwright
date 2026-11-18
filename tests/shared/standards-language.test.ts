import { describe, it, expect } from "vitest";
import {
  detectInstalledLanguage,
  detectSystemLanguage,
  missingEnglishSections,
  readOsLocale,
  resolveStandardsLanguage,
  validateLanguageFlag,
} from "../../src/shared/standards-language.js";

describe("detectSystemLanguage", () => {
  it("reads LANG when nothing higher is set", () => {
    expect(detectSystemLanguage({ osLocale: null, env: { LANG: "zh_CN.UTF-8" } })).toBe("zh");
    expect(detectSystemLanguage({ osLocale: null, env: { LANG: "en_US.UTF-8" } })).toBe("en");
  });

  it("gives LANGUAGE the highest priority (gettext order)", () => {
    expect(
      detectSystemLanguage({
        osLocale: null,
        env: { LANGUAGE: "en:zh", LANG: "zh_CN.UTF-8" },
      }),
    ).toBe("en");
  });

  it("lets LC_ALL override LC_MESSAGES and LANG", () => {
    expect(
      detectSystemLanguage({
        osLocale: null,
        env: { LC_ALL: "en_US.UTF-8", LC_MESSAGES: "zh_CN.UTF-8", LANG: "zh_CN.UTF-8" },
      }),
    ).toBe("en");
  });

  it("falls back to LC_MESSAGES when LC_ALL is empty", () => {
    expect(
      detectSystemLanguage({
        osLocale: null,
        env: { LC_ALL: "", LC_MESSAGES: "zh_CN.UTF-8", LANG: "en_US.UTF-8" },
      }),
    ).toBe("zh");
  });

  it("ignores case and accepts hyphen separators", () => {
    expect(detectSystemLanguage({ osLocale: null, env: { LANG: "ZH-CN" } })).toBe("zh");
  });

  it("treats C and POSIX as English", () => {
    expect(detectSystemLanguage({ osLocale: null, env: { LC_ALL: "C" } })).toBe("en");
    expect(detectSystemLanguage({ osLocale: null, env: { LANG: "POSIX" } })).toBe("en");
  });

  it("falls back to Intl when no locale variable is set", () => {
    expect(detectSystemLanguage({ osLocale: null, env: {}, intlLocale: "zh-Hans-CN" })).toBe("zh");
    expect(detectSystemLanguage({ osLocale: null, env: {}, intlLocale: "en-US" })).toBe("en");
    expect(detectSystemLanguage({ osLocale: null, env: {}, intlLocale: "" })).toBe("en");
  });

  it("prefers the OS language over the terminal locale", () => {
    expect(
      detectSystemLanguage({
        osLocale: "zh-Hans-US",
        env: { LANG: "en_US.UTF-8" },
      }),
    ).toBe("zh");
    expect(
      detectSystemLanguage({
        osLocale: "en-US",
        env: { LANG: "zh_CN.UTF-8" },
      }),
    ).toBe("en");
  });
});

describe("readOsLocale", () => {
  it("reads the first AppleLanguages entry on macOS", () => {
    const calls: Array<[string, string[]]> = [];
    const locale = readOsLocale("darwin", (command, args) => {
      calls.push([command, args]);
      return '(\n    "zh-Hans-US",\n    "en-US"\n)';
    });

    expect(locale).toBe("zh-Hans-US");
    expect(calls).toEqual([["defaults", ["read", "-g", "AppleLanguages"]]]);
  });

  it("falls back to AppleLocale on macOS", () => {
    const locale = readOsLocale("darwin", (_command, args) => {
      if (args.includes("AppleLanguages")) throw new Error("missing");
      return "zh-Hans_US\n";
    });

    expect(locale).toBe("zh-Hans_US");
  });

  it("reads the preferred UI language on Windows", () => {
    const locale = readOsLocale(
      "win32",
      () => "    PreferredUILanguages    REG_MULTI_SZ    zh-CN\\0en-US\r\n",
    );

    expect(locale).toBe("zh-CN");
  });

  it("falls back to LocaleName on Windows", () => {
    const locale = readOsLocale("win32", (_command, args) => {
      if (args.includes("PreferredUILanguages")) throw new Error("missing");
      return "    LocaleName    REG_SZ    zh-CN\r\n";
    });

    expect(locale).toBe("zh-CN");
  });

  it("returns null off macOS and Windows without running a command", () => {
    let called = false;
    const locale = readOsLocale("linux", () => {
      called = true;
      return "";
    });

    expect(locale).toBeNull();
    expect(called).toBe(false);
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

  it("detects a pre-anchor Chinese block by its §0 heading", () => {
    expect(
      detectInstalledLanguage("## 0. 适用范围\n**约定**：动手前先读"),
    ).toBe("zh");
  });

  it("keeps a block with both current anchors unknown", () => {
    expect(
      detectInstalledLanguage(
        "这份代码库是你的\nThis codebase is yours\n## 0. 适用范围",
      ),
    ).toBeNull();
  });
});

describe("resolveStandardsLanguage", () => {
  it("prefers the explicit flag", () => {
    expect(
      resolveStandardsLanguage({ osLocale: null, flag: "en", installed: "zh", env: { LANG: "zh_CN" } }),
    ).toBe("en");
  });

  it("prefers the installed block over the system locale", () => {
    expect(
      resolveStandardsLanguage({ osLocale: null, installed: "zh", env: { LANG: "en_US.UTF-8" } }),
    ).toBe("zh");
  });

  it("uses the system locale when nothing is installed", () => {
    expect(
      resolveStandardsLanguage({ osLocale: null, installed: null, env: { LANG: "zh_CN.UTF-8" } }),
    ).toBe("zh");
  });

  it("ignores an invalid flag value", () => {
    expect(resolveStandardsLanguage({ osLocale: null, flag: "fr", env: { LANG: "zh_CN" } })).toBe("zh");
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
