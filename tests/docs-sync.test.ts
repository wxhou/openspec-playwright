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
//
// The end of each literal is marked by a `// spec-embed:<tag>` sentinel rather
// than by the closing backtick: the body may legitimately contain a
// backtick-semicolon pair, and a backtick-anchored scan stops there and
// truncates the copy.
function extractEmbed(script: string, name: string, tag: "zh" | "en"): string {
  const head = `const ${name} = \``;
  const start = script.indexOf(head);
  if (start === -1) return "";
  const bodyStart = start + head.length;
  const end = script.indexOf(`\`; // spec-embed:${tag}`, bodyStart);
  return end === -1 ? "" : script.slice(bodyStart, end);
}

const zh = extractEmbed(scriptJs, "CLAUDE_MD_ZH", "zh");
const en = extractEmbed(scriptJs, "CLAUDE_MD_EN", "en");

const ZH_ANCHORS: [string, string][] = [
  ["§0 openspec help", "npx openspec --help"],
  ["§0 代码库所有权", "这份代码库是你的"],
  ["§0 用户指令优先", "用户显式指令可偏离"],
  ["§0 未标注档位", "未标注的条款按 🟡 处理"],
  ["§1 lint gate", "每次编辑后自动执行"],
  ["§1 过时的直接删", "过时的直接删"],
  ["§1 1500 行上限", "代码文件行数上限 1500"],
  ["§1 依赖幻觉禁令", "幻觉包名"],
  ["§1 修复循环上限", "最多 2 轮"],
  ["§1 停下先写假设", "共同依赖的假设"],
  ["§1 无 linter 自查", "每次编辑后对改动自查"],
  ["§1 注释纪律自检", "删掉这句，读者会不会调用错或改错"],
  ["§1 公共接口文档注释", "公共接口必须写明用途"],
  ["§1 lint 清单未装跳过", "未安装或该语言无对应规则"],
  ["§1 机制标注豁免", "机制标注（lint/类型抑制"],
  ["§1 spec 锚豁免", "spec 锚"],
  ["§1 UI 文案克制", "界面不写冗余"],
  ["§1 推测性扩展买断", "四项都不存在"],
  ["§1 库能力假设", "断言现成依赖缺少某能力"],
  ["§1 模块化", "模块化与关注点分离"],
  ["§1 非法组合挡在构造处", "把非法组合挡在构造处"],
  ["§1 状态建模", "状态建模"],
  ["§1 数据库迁移", "数据库迁移"],
  ["§1 写操作幂等", "不重复插入"],
  ["§1 并发与事务", "事务只包临界读写"],
  ["§1 应用层锁边界", "应用层锁只保护进程内状态"],
  ["§1 默认上抛", "默认上抛"],
  ["§1 异步路径吞错", "未 await、未 catch 视同吞错"],
  ["§1 注释存在性下沉 lint", "文档注释的存在性交给 lint"],
  ["§1 兜底返回形状", "只记录或只加注释不构成豁免"],
  ["§1 显式失败值边界", "调用方按契约消费"],
  ["§1 守卫不掩盖失败", "不能让它静默消失"],
  ["§1 修根因", "根因在别处时修根因"],
  ["§1 错误类枚举逃生口", "枚举不出就直接上抛"],
  ["§2 挪动随迁", "其 import 随迁"],
  ["§2 豁免标注", "例外须行内注明缘由"],
  ["§2 破坏性命令授权", "破坏性/不可逆命令"],
  ["§2 只报确实存在的盲点", "确实存在的盲点"],
  ["§2 改动清单以 diff 为准", "改动清单以实际 diff 为准"],
  ["§2 占位调用", "等后台任务通知期间不发占位/空调用"],
  ["§3 阶段自动串联", "做到绿"],
  ["§3 完成前不收尾", "完成前不得自行收尾"],
  ["§3 审查分级", "审查按风险分级"],
  ["§3 全局修复上限", "失败项未减少即停"],
  ["§3 失败分别计", "不同失败分别计"],
  ["§3 独立视角", "独立上下文"],
  ["§3 高风险设计确认", "高风险变更"],
  ["§3 自动归档条件", "要求「自动归档」，且"],
  ["§3 归档授权", "commit/push/merge/release/archive 须用户授权"],
  ["§3 自动链止于 verify", "e2e 不在自动链内"],
  ["§3 自动链同一回合调用 verify", "同一回合调用"],
  ["§3 自动链覆盖全部 apply 变更", "适用于任何经"],
  ["§3 规模门槛", "跨多个文件的代码修改"],
  ["§3 规模门槛例外", "纯文档、注释、格式除外"],
  ["§3 提案入口", "必须走 OpenSpec 提案流程"],
  ["§0 同档冲突处置", "先按该条款执行"],
  ["§1 授权标注豁免", "来源与授权"],
  ["§7 确认上界例外", "已有确认的上界"],
  ["§4 数据编撰禁令", "严禁主动编撰模拟现实实体"],
  ["§5 临时文件管理", "临时文件管理"],
  ["§6 测试与验证策略", "测试与验证策略"],
  ["§6 截图≠行为", "仅截图不算通过"],
  ["§6 质量滤网", "点名不豁免"],
  ["§6 无效测试判据", "测试仍过"],
  ["§6 测试随验收", "测试只随验收存在"],
  ["§6 测试提议义务", "不静默略过"],
  ["§6 测试行为不钉实现", "测试钉住行为，不钉实现"],
  ["§6 测试确定性", "测试自足且确定"],
  ["§6 架构层审查", "验证不止于跑测试"],
  ["§6 无限循环检查", "预期外的无限循环"],
  ["§6 循环清理", "终止条件或清理"],
  ["§6 验证证据尾句", "先核对加载的是本次产物"],
  ["§6 覆盖义务", "必须被某层测试覆盖"],
  ["§6 点名滤网仲裁", "停下向用户裁决"],
  ["§6 验收定义", "对真实运行的服务发真实请求"],
  ["§6 期望不反推", "不得从实现反推"],
  ["§6 UI 组件禁令", "UI 渲染冒烟/快照/纯存在断言"],
  ["§6 修复复现时序", "完成前后各重现 bug 一次"],
  ["§6 失败测试先行", "会失败的测试"],
  ["§6 失败原因正确", "失败来自预期的那条断言"],
  ["§6 重构只改结构", "重构只改结构"],
  ["§7 量级确认", "前先确认量级"],
  ["§7 无界读取禁令", "禁止无界读取进内存"],
  ["§7 无界并发禁令", "禁止无界并发"],
  ["§7 外部调用超时", "禁止无超时的外部调用"],
  ["§0 经验沉淀载体", "非工具托管的载体"],
];

const EN_ANCHORS: [string, string][] = [
  ["§0 openspec help", "npx openspec --help"],
  ["§0 codebase ownership", "This codebase is yours"],
  ["§0 user-instruction primacy", "explicit user instructions may override"],
  ["§0 unmarked tier", "unmarked rules are treated as"],
  ["§1 lint gate", "lint+typecheck runs after every edit"],
  ["§1 delete obsolete", "Delete obsolete code outright"],
  ["§1 1500 line cap", "Code file line limit 1500"],
  ["§1 dependency hallucination", "hallucinate package names"],
  ["§1 fix loop bound", "at most 2 rounds"],
  ["§1 name the shared assumption", "the assumption every attempt relied on"],
  ["§1 no-linter self-check", "self-check the changes after every edit"],
  ["§1 comment self-check scope", "if deleting this line would not make a reader"],
  ["§1 public API doc comments", "state its purpose"],
  ["§1 lint checklist skip guard", "if it is not installed, or the language has no matching rule"],
  ["§1 mechanism-marking exemption", "Mechanism markings (lint/type suppression"],
  ["§1 spec anchor exemption", "spec anchors"],
  ["§1 UI copy restraint", "redundant secondary labels"],
  ["§1 speculative robustness buy-in", "if all four are absent"],
  ["§1 library capability check", "lacks a capability"],
  ["§1 modularity", "separation of concerns"],
  ["§1 illegal combinations at construction", "make illegal combinations impossible at construction"],
  ["§1 state modeling", "State modeling"],
  ["§1 database migrations", "Database migrations"],
  ["§1 idempotent writes", "no duplicate inserts"],
  ["§1 concurrency and transactions", "keep transactions limited to the critical reads and writes"],
  ["§1 application lock boundary", "Application-level locks protect in-process state only"],
  ["§1 propagate by default", "Propagate by default"],
  ["§1 async paths swallow", "an unawaited or uncaught promise counts as swallowing"],
  ["§1 docstring existence to lint", "leave docstring existence to lint"],
  ["§1 broad-catch fallback shape", "merely logging or commenting does not exempt them"],
  ["§1 explicit failure value boundary", "consumed by the caller under its contract"],
  ["§1 guard vs silent failure", "never let it disappear silently"],
  ["§1 fix the root cause", "fix the cause instead of stopping this one instance"],
  ["§1 catch class-enumeration escape", "if the classes can't be enumerated"],
  ["§6 testing & verification", "Testing & Verification Strategy"],
  ["§6 screenshot ≠ behavior", "Screenshot alone does not pass"],
  ["§1 selection chain", "priority chain"],
  ["§2 move migration", "its imports migrate with it"],
  ["§2 exemption annotation", "annotated inline with its reason"],
  ["§2 destructive command consent", "Destructive/irreversible commands"],
  ["§2 actual blind spots", "blind spots that actually exist"],
  ["§2 change list from diff", "report the change list from the actual diff"],
  ["§2 placeholder calls", "send no placeholder/no-op calls"],
  ["§3 phase auto-chain", "run this change through"],
  ["§3 do not wrap up early", "Do not wrap up before the work the user requested is done"],
  ["§3 risk-tiered review", "review is risk-tiered"],
  ["§3 global repair cap", "no reduction in failing items"],
  ["§3 per-failure counting", "different failures count separately"],
  ["§3 independent review", "independent context"],
  ["§3 high-risk design gate", "High-risk changes"],
  ["§3 auto-archive conditions", "Auto-archive only when explicitly requested"],
  ["§3 archive authorization", "commit/push/merge/release/archive require user authorization"],
  ["§3 auto-chain stops at verify", "e2e is not part of the auto-chain"],
  ["§3 auto-chain same-turn verify", "the moment the last task is checked"],
  ["§3 auto-chain scope", "is not gated by the size threshold"],
  ["§3 size gate", "Code changes across multiple files"],
  ["§3 size gate exception", "docs, comments and formatting excepted"],
  ["§3 proposal entry", "must go through the OpenSpec proposal flow"],
  ["§0 same-tier conflict handling", "follow that clause first"],
  ["§1 authorization annotation exemption", "source and authorization"],
  ["§7 confirmed upper bound", "confirmed upper bound"],
  ["§6 tests follow acceptance", "Tests exist only where acceptance demands them"],
  ["§6 test proposal duty", "never skip silently"],
  ["§6 test behavior not implementation", "Tests pin behavior, not implementation"],
  ["§6 deterministic tests", "self-contained and deterministic"],
  ["§6 architecture audit", "Verification goes beyond running tests"],
  ["§6 infinite loop check", "unintended infinite loops"],
  ["§6 loop cleanup", "termination condition or cleanup"],
  ["§6 verification evidence tail", "first confirm the tested build is the current one"],
  ["§6 quality filter", "Tests without assertion value are never written"],
  ["§6 valueless test check", "if it still passes"],
  ["§6 coverage duty", "must be covered by some test layer"],
  ["§6 named-filter arbitration", "stop and let the user decide"],
  ["§6 acceptance definition", "real requests against a real running service"],
  ["§6 expectations not reverse-engineered", "must never be reverse-engineered from the implementation"],
  ["§6 UI component ban", "UI render-smoke/snapshot/existence assertions"],
  ["§6 fix repro timing", "reproduce before and after completion"],
  ["§6 failing test first", "a test that fails before the fix"],
  ["§6 failure from the expected assertion", "failure coming from the expected assertion"],
  ["§6 refactor changes structure only", "red means the structure broke"],
  ["§7 performance section", "Performance & Resource Bounds"],
  ["§7 unbounded reads", "Never read unbounded data into memory"],
  ["§7 unbounded concurrency", "Never fan out unbounded concurrency"],
  ["§7 external call timeout", "Never make external calls without a timeout"],
  ["§0 experience-distillation carrier", "carrier the tooling does not own"],
];

// The catch clause carries four sub-bullets. The mirrors must hold the same
// four in the same order — a standards change that adds, drops or reorders one
// has to update both mirrors and this list. A single phrase anchor cannot catch
// that drift: the EN mistranslation in 0.3.106 shipped through one.
const CATCH_SUB_BULLETS_ZH = [
  "上抛（默认出口）",
  "就地消化（仅两种）",
  "try 块只包",
  "兜底返回不算出口",
];
const CATCH_SUB_BULLETS_EN = [
  "Rethrow (the default exit)",
  "Absorb in place",
  "Try blocks contain",
  "Fallbacks outside",
];

function catchSubBullets(text: string, startMarker: string): string[] {
  const start = text.indexOf(startMarker);
  if (start === -1) return [];
  const rest = text.slice(start);
  const end = rest.search(/\n(?:- |## )/);
  const clause = end === -1 ? rest : rest.slice(0, end);
  return clause
    .split("\n")
    .filter((l) => l.startsWith("  - "))
    .map((l) => l.slice(4));
}

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

  it("extracts the whole embed when the body contains a backtick-semicolon", () => {
    const fake = "const CLAUDE_MD_ZH = `a `; b`; // spec-embed:zh";
    expect(extractEmbed(fake, "CLAUDE_MD_ZH", "zh")).toBe("a `; b");
  });

  it("keeps the catch clause's sub-bullets aligned across all three copies", () => {
    const ssot = catchSubBullets(standards, "🔴 默认上抛");
    const zhCopy = catchSubBullets(zh, "🔴 默认上抛");
    const enCopy = catchSubBullets(en, "🔴 Propagate by default");
    expect(ssot).toHaveLength(CATCH_SUB_BULLETS_ZH.length);
    expect(zhCopy).toHaveLength(CATCH_SUB_BULLETS_ZH.length);
    expect(enCopy).toHaveLength(CATCH_SUB_BULLETS_EN.length);
    ssot.forEach((line, i) => {
      expect(
        line.startsWith(CATCH_SUB_BULLETS_ZH[i]),
        `standards sub-bullet ${i + 1} must start with "${CATCH_SUB_BULLETS_ZH[i]}"`,
      ).toBe(true);
    });
    zhCopy.forEach((line, i) => {
      expect(
        line.startsWith(CATCH_SUB_BULLETS_ZH[i]),
        `ZH embed sub-bullet ${i + 1} must start with "${CATCH_SUB_BULLETS_ZH[i]}"`,
      ).toBe(true);
    });
    enCopy.forEach((line, i) => {
      expect(
        line.startsWith(CATCH_SUB_BULLETS_EN[i]),
        `EN embed sub-bullet ${i + 1} must start with "${CATCH_SUB_BULLETS_EN[i]}"`,
      ).toBe(true);
    });
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

// The renderer lives in a plain browser script, so it cannot be imported.
// Extract the two functions it needs and run them here: the standards use
// nested lists (2-space indent) for sub-rules, and flattening them would
// drop the structure the embed is read for.
function loadRenderer(): (md: string) => string {
  const start = scriptJs.indexOf("function processInline");
  const end = scriptJs.indexOf("\nfunction setLanguage");
  const source = scriptJs.slice(start, end);
  const factory = new Function(`${source}\nreturn renderMarkdown;`) as () => (md: string) => string;
  return factory();
}

describe("landing-page markdown renderer", () => {
  const render = loadRenderer();

  it("renders indented items as a nested <ul> inside the parent <li>", () => {
    const html = render("- parent\n  - child\n- sibling");
    expect(html).toContain("<li>parent<ul>");
    expect(html).toContain("<li>child</li>");
    expect(html).toContain("<li>sibling</li>");
  });

  it("closes the nested list before the next block", () => {
    const html = render("- parent\n  - child\n\ntext");
    expect(html.indexOf("</ul>")).toBeLessThan(html.indexOf("<p>text</p>"));
  });

  it("the standards embed actually uses nested lists", () => {
    expect(zh).toMatch(/^ {2}- /m);
    expect(en).toMatch(/^ {2}- /m);
  });
});
