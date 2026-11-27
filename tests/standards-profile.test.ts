import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  STANDARDS_FILES,
  detectInstalledProfile,
  parseStandardsFlag,
  resolveStandardsProfile,
  validateStandardsFlag,
} from "../src/shared/standards-profile.js";
import { detectInstalledLanguage } from "../src/shared/standards-language.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (name: string) =>
  readFileSync(join(root, "standards", name), "utf-8");

const generalZh = read(STANDARDS_FILES.zh.general);
const generalEn = read(STANDARDS_FILES.en.general);
const mlZh = read(STANDARDS_FILES.zh.ml);
const mlEn = read(STANDARDS_FILES.en.ml);

describe("validateStandardsFlag", () => {
  it("accepts both profiles and no value", () => {
    expect(validateStandardsFlag(undefined)).toBeNull();
    expect(validateStandardsFlag("general")).toBeNull();
    expect(validateStandardsFlag("ml")).toBeNull();
  });

  it("rejects anything else with a copy-pasteable message", () => {
    expect(validateStandardsFlag("ML")).toContain('Invalid --standards "ML"');
    expect(validateStandardsFlag("")).toContain('Invalid --standards ""');
  });
});

describe("detectInstalledProfile", () => {
  it("returns null for missing content or text that is not a standards block", () => {
    expect(detectInstalledProfile(null)).toBeNull();
    expect(detectInstalledProfile("")).toBeNull();
    expect(detectInstalledProfile("# Some other document")).toBeNull();
  });

  it("recognises the general block in both languages", () => {
    expect(detectInstalledProfile(generalZh)).toBe("general");
    expect(detectInstalledProfile(generalEn)).toBe("general");
  });

  it("recognises the ML block in both languages", () => {
    expect(detectInstalledProfile(mlZh)).toBe("ml");
    expect(detectInstalledProfile(mlEn)).toBe("ml");
  });
});

describe("resolveStandardsProfile", () => {
  it("prefers the explicit flag over the installed block", () => {
    expect(
      resolveStandardsProfile({ flag: "general", installed: "ml" }),
    ).toBe("general");
    expect(resolveStandardsProfile({ flag: "ml", installed: "general" })).toBe(
      "ml",
    );
  });

  it("keeps the installed profile when no flag is given", () => {
    expect(resolveStandardsProfile({ installed: "ml" })).toBe("ml");
    expect(resolveStandardsProfile({ installed: "general" })).toBe("general");
  });

  it("defaults to general — there is no system-wide signal", () => {
    expect(resolveStandardsProfile({})).toBe("general");
    expect(resolveStandardsProfile({ installed: null })).toBe("general");
  });

  it("ignores an invalid flag instead of silently changing profiles", () => {
    expect(resolveStandardsProfile({ flag: "bogus", installed: "ml" })).toBe(
      "ml",
    );
    expect(parseStandardsFlag("bogus")).toBeNull();
  });
});

describe("standards variant files", () => {
  it("keeps the general profile at §0–§7", () => {
    expect(generalZh).not.toContain("## 8.");
    expect(generalEn).not.toContain("## 8.");
  });

  it("gives the ML profile §0–§8 with ML-first sections", () => {
    for (const content of [mlZh, mlEn]) {
      const sections = [...content.matchAll(/^## (\d+)\./gm)].map((m) => m[1]);
      expect(sections).toEqual(["0", "1", "2", "3", "4", "5", "6", "7", "8"]);
    }
    expect(mlZh).toContain("## 1. 评测完整性");
    expect(mlEn).toContain("## 1. Evaluation Integrity");
  });

  it("keeps the language anchors so language detection still works", () => {
    expect(detectInstalledLanguage(generalZh)).toBe("zh");
    expect(detectInstalledLanguage(mlZh)).toBe("zh");
    expect(detectInstalledLanguage(generalEn)).toBe("en");
    expect(detectInstalledLanguage(mlEn)).toBe("en");
  });
});
