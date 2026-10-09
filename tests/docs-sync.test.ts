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
  ["§1 依赖幻觉禁令", "幻觉包名"],
  ["§1 修复循环上限", "最多 2 轮"],
  ["§1 无 linter 自查", "每次编辑后对改动自查"],
  ["§2 挪动随迁", "其 import 随迁"],
  ["§2 豁免标注", "例外须行内注明缘由"],
  ["§4 数据编撰禁令", "严禁主动编撰任何数据"],
  ["§5 临时文件管理", "临时文件管理"],
  ["§6 测试与验证策略", "测试与验证策略"],
  ["§6 截图≠行为", "仅截图不算通过"],
  ["§6 质量滤网", "点名不豁免"],
  ["§6 测试随验收", "测试只随验收存在"],
  ["§6 测试提议义务", "不静默略过"],
  ["§6 覆盖义务", "必须被某层测试覆盖"],
  ["§6 点名滤网仲裁", "停下向用户裁决"],
  ["§6 验收定义", "对真实运行的服务发真实请求"],
  ["§6 UI 组件禁令", "禁止生成 UI 组件测试"],
  ["§6 修复复现时序", "完成前后各重现 bug 一次"],
  ["§7 量级确认", "前先确认量级"],
  ["§7 无界读取禁令", "禁止无界读取进内存"],
  ["§7 无界并发禁令", "禁止无界并发"],
];

const EN_ANCHORS: [string, string][] = [
  ["§0 openspec help", "npx openspec --help"],
  ["§1 lint gate", "lint+typecheck runs after every edit"],
  ["§1 delete obsolete", "Delete obsolete code outright"],
  ["§1 1500 line cap", "Code file line limit 1500"],
  ["§1 dependency hallucination", "hallucinate package names"],
  ["§1 fix loop bound", "at most 2 rounds"],
  ["§1 no-linter self-check", "PEP8 E402"],
  ["§6 testing & verification", "Testing & Verification Strategy"],
  ["§6 screenshot ≠ behavior", "Screenshot alone does not pass"],
  ["§1 selection chain", "priority chain"],
  ["§2 move migration", "its imports migrate with it"],
  ["§2 exemption annotation", "annotated inline with its reason"],
  ["§6 tests follow acceptance", "Tests exist only where acceptance demands them"],
  ["§6 test proposal duty", "never skip silently"],
  ["§6 quality filter", "Tests without assertion value are never written"],
  ["§6 coverage duty", "must be covered by some test layer"],
  ["§6 named-filter arbitration", "stop and let the user decide"],
  ["§6 acceptance definition", "real requests against a real running service"],
  ["§6 UI component ban", "Never generate UI component tests"],
  ["§6 fix repro timing", "reproduce before and after completion"],
  ["§7 performance section", "Performance & Resource Bounds"],
  ["§7 unbounded reads", "Never read unbounded data into memory"],
  ["§7 unbounded concurrency", "Never fan out unbounded concurrency"],
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

  it("every standards section number 0..7 is represented in the ZH embed", () => {
    // Section HEADINGS drift in wording between the full standards and the
    // condensed copy, so match by number coverage instead of exact titles.
    const sectionCount = (standards.match(/^## \d+\./gm) ?? []).length;
    expect(sectionCount).toBeGreaterThanOrEqual(8); // §0..§7
    // The condensed ZH copy carries all major sections as headings too.
    const zhHeadings = (zh.match(/^## /gm) ?? []).length;
    expect(zhHeadings).toBeGreaterThanOrEqual(sectionCount - 1);
  });

  // Landing-page rendering contracts in script.js (beyond the embed text):
  // the dark preview renders priority emoji as single-voice glyphs, and the
  // embed's headings are demoted so the page keeps exactly one h1. Both were
  // deliberate (0.3.90-era tuning) and are easy to lose in a rewrite.
  it("renders priority emoji as monochrome prio spans, not raw emoji", () => {
    expect(scriptJs).toContain(".replace(/🔴/g, '<span class=\"prio prio-critical\"></span>')");
    expect(scriptJs).toContain(".replace(/🟡/g, '<span class=\"prio prio-important\"></span>')");
    expect(scriptJs).toContain(".replace(/⚪/g, '<span class=\"prio prio-standard\"></span>')");
  });

  it("demotes embed headings (renderMarkdown never emits an h1)", () => {
    expect(scriptJs).not.toMatch(/<h1>/);
    expect(scriptJs).toContain('h${level + offset}');
  });
});
