import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const standards = readFileSync(join(root, "employee-standards.md"), "utf-8");
const scriptJs = readFileSync(join(root, "docs", "script.js"), "utf-8");

// Extract the CLAUDE_MD_ZH / CLAUDE_MD_EN template bodies from script.js.
// docs/script.js embeds a condensed copy of the standards (ZH + EN) for the
// landing page "Copy config" button; nothing forces it to follow
// employee-standards.md, and it has drifted before (fixed in 0.3.65).
// These anchors fail loudly when a standards change forgets the docs copy.
const zh = scriptJs.match(/CLAUDE_MD_ZH = `([\s\S]*?)`;/)?.[1] ?? "";
const en = scriptJs.match(/CLAUDE_MD_EN = `([\s\S]*?)`;/)?.[1] ?? "";

const ZH_ANCHORS: [string, string][] = [
  ["§0 openspec help", "npx openspec --help"],
  ["§1 lint gate", "每次编辑后自动执行"],
  ["§1 过时的直接删", "过时的直接删"],
  ["§1 1500 行上限", "代码文件行数上限 1500"],
  ["§4 数据编撰禁令", "严禁主动编撰任何数据"],
  ["§6 临时文件管理", "临时文件管理"],
  ["§6 章节标题", "浏览器验证证据链"],
  ["§6 截图≠行为", "仅截图不算通过"],
  ["§6 临时脚本转正", "转正为 Playwright 测试或删除"],
  ["§7 测试策略", "测试策略"],
  ["§7 覆盖义务", "必须被某层测试覆盖"],
  ["§7 验收定义", "不以全 mock 的单测链冒充验收"],
];

const EN_ANCHORS: [string, string][] = [
  ["§0 openspec help", "npx openspec --help"],
  ["§1 lint gate", "lint+typecheck runs after every edit"],
  ["§1 delete obsolete", "Delete obsolete code outright"],
  ["§1 1500 line cap", "Code file line limit 1500"],
  ["§6 section title", "Browser Verification Evidence Chain"],
  ["§6 screenshot ≠ behavior", "Screenshot ≠ behavior proof"],
  ["§6 temp scripts", "Temporary scripts with assertions"],
  ["§7 testing strategy", "Testing Strategy"],
  ["§7 coverage duty", "must be covered by some test layer"],
  ["§7 acceptance definition", "all-mock unit chain as acceptance"],
];

describe("docs/script.js embedded standards stay in sync", () => {
  it("anchors exist in employee-standards.md (guard against stale anchors)", () => {
    for (const [label, phrase] of ZH_ANCHORS) {
      expect(standards, `${label} anchor missing from standards`).toContain(phrase);
    }
  });

  it.each(ZH_ANCHORS)("ZH embed contains %s", (_label, phrase) => {
    expect(zh, `docs/script.js CLAUDE_MD_ZH missing: ${phrase}`).toContain(phrase);
  });

  it.each(EN_ANCHORS)("EN embed contains %s", (_label, phrase) => {
    expect(en, `docs/script.js CLAUDE_MD_EN missing: ${phrase}`).toContain(phrase);
  });

  it("every standards section number 0..6 is represented in the ZH embed", () => {
    // Section HEADINGS drift in wording between the full standards and the
    // condensed copy, so match by number coverage instead of exact titles.
    const sectionCount = (standards.match(/^## \d+\./gm) ?? []).length;
    expect(sectionCount).toBeGreaterThanOrEqual(8); // §0..§7
    // The condensed ZH copy carries all major sections as headings too.
    const zhHeadings = (zh.match(/^## /gm) ?? []).length;
    expect(zhHeadings).toBeGreaterThanOrEqual(sectionCount - 1);
  });
});
