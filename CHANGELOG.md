# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
- **fix(windows): 外部命令改用 cross-spawn**. 移除 `needsShell` 与 `shell: true` 参数数组用法，统一走 `src/shared/exec.ts`；npm/npx/claude/git 等调用不再触发 Node DEP0190。
  - `package.json`、`package-lock.json`、`src/shared/exec.ts`、`src/shared/platform.ts`（删除）、`src/commands/*.ts`、`src/shared/*.ts`、测试、`CHANGELOG.md`
- **fix(exec): 异步包装器忽略 stdin**. 避免 `stdio: "pipe"` 留下 stdin 管道导致读取 stdin 的命令挂起；新增 Windows 真实 npm/npx 集成测试与 CI `update --no-cli` smoke。
  - `src/shared/exec.ts`、`tests/shared/exec-windows.test.ts`、`.github/workflows/ci.yml`、`CHANGELOG.md`
- **fix(exec): 超时与 maxBuffer 超限立即终止**. 包装器自行计时，超时立即 kill 并销毁 stdout/stderr；输出超限时移除监听并销毁流，避免后代进程持管道导致挂起或内存累积。
  - `src/shared/exec.ts`、`tests/shared/exec.test.ts`、`CHANGELOG.md`
- **fix(cli): 版本提示改写到 stderr**. `--json` 命令的 stdout 不再混入升级提示；Windows CI smoke 改为断言 `update` 的 npm-pack 成功路径。
  - `src/shared/version-check.ts`、`tests/shared/version-check.test.ts`、`.github/workflows/ci.yml`、`CHANGELOG.md`

## [0.3.112] - 2026-11-07
- **fix(standards): §1 必做清理**. 删除 gate 异常的 import 旁路；「无须买断」改为「无须额外论证」；两处「2 轮」标注 lint/typecheck 与任务验证范围。
  - `employee-standards.md`、`AGENTS.md`、`docs/script.js`、`CHANGELOG.md`
- **fix(standards): 澄清四处高影响规则**. 竞态条件改为「四项都不存在」；try 控制流改为「捕获驱动控制流」；就地消化补明「上述两种」与「最外层/入口」；盲点改为「确实存在」。
  - `employee-standards.md`、`AGENTS.md`、`docs/script.js`、`tests/docs-sync.test.ts`、`CHANGELOG.md`
- **refactor(standards): 压缩默认上抛，补显式失败值边界**. 合并异步/重复记录/降级子项；吞错形状移到 lint 清单；窄类型 catch + 显式失败值不算兜底；主句改为默认/例外结构。
  - `employee-standards.md`、`AGENTS.md`、`docs/script.js`、`tests/docs-sync.test.ts`、`templates/lint-guidelines.md`、`CHANGELOG.md`
- **fix(templates): 模板改用 type-only import，补模板 typecheck**. BasePage/seed/e2e-test 改 `type` 导入；BasePage 头部标明工具所有；新增 `tsconfig.templates.json` 与 CI 检查。
  - `templates/pages/BasePage.ts`、`templates/seed.spec.ts`、`templates/e2e-test.ts`、`tsconfig.templates.json`、`package.json`、`.github/workflows/ci.yml`、`CHANGELOG.md`

## [0.3.111] - 2026-11-07
- **fix(lint-guidelines): 校正 E722/BLE001 边界与 jsdoc 默认说明**. E722 改为 bare handlers；BLE001 补 re-raised 豁免；jsdoc 标注 ESLint core 默认关闭、插件 recommended 会开启。
  - `templates/lint-guidelines.md`、`src/shared/lint-guidelines.ts`、`CHANGELOG.md`
- **fix(standards): 修正 lint 清单与注释规则**. `jsdoc/require-jsdoc` 默认范围改准并补插件注册示例；补 `D102`；注释规则补 lint 跳过条件；三副本与测试锚点同步。
  - `templates/lint-guidelines.md`、`src/shared/lint-guidelines.ts`、`employee-standards.md`、`AGENTS.md`、`docs/script.js`、`tests/docs-sync.test.ts`、`tests/shared/lint-guidelines.test.ts`、`CHANGELOG.md`
- **refactor(standards): §3 任务审查与停止规则**. 审查按风险分级（2 轮，高风险独立）；门槛改多文件/架构；修复预算 2 轮、连续 3 轮无进展即停。
  - `employee-standards.md`、`AGENTS.md`、`docs/script.js`、`tests/docs-sync.test.ts`、`CHANGELOG.md`
- **fix(standards): §1 验证与注释纪律收口**. 验证重试改为「最多 2 轮修复」；注释纪律压缩为一段；恢复 `spec 锚` 豁免；删除悬空的「失效定义」引用。
  - `employee-standards.md`、`AGENTS.md`、`docs/script.js`、`tests/docs-sync.test.ts`、`CHANGELOG.md`
- **feat(lint-guidelines): 清单扩到文档注释，注释「存在性」下沉 lint**. 清单由 9 条扩到 16 条，§1 只保留签名外的契约；三副本同步。
  - `templates/lint-guidelines.md`、`src/shared/lint-guidelines.ts`、`employee-standards.md`、`AGENTS.md`、`docs/script.js`、`tests/shared/lint-guidelines.test.ts`、`tests/docs-sync.test.ts`、`README.md`、`README.zh-CN.md`、`CHANGELOG.md`
- **fix(standards): §2 工具规则收口**. 搜索规则补回代码索引降级路径；变更完成只报已验证盲点；等待后台任务时不发空调用。
  - `employee-standards.md`、`AGENTS.md`、`docs/script.js`、`tests/docs-sync.test.ts`、`CHANGELOG.md`
- **refactor(standards): 测试规则收口**. UI 测试禁令并入无断言价值条；验收期望不得从实现反推；补异步吞错与网络超时；删具体值断言条。
  - `employee-standards.md`、`AGENTS.md`、`docs/script.js`、`tests/docs-sync.test.ts`、`CHANGELOG.md`
- **refactor(standards): 压缩 WHY 行与重复子句**. 删 §5 超 24 小时条、§6 连跑两次、§7 哈希查找/CPU 分片；补规模门槛例外与「不同失败分别计」。
  - `employee-standards.md`、`AGENTS.md`、`docs/script.js`、`tests/docs-sync.test.ts`、`CHANGELOG.md`

## [0.3.110] - 2026-10-29
- **fix(standards): 注释纪律改为「只写三类 + 一句判据」**. 三类：接口注释、实现 why、机制标注豁免；一句判据收口。
  - `employee-standards.md`、`AGENTS.md`、`docs/script.js`、`tests/docs-sync.test.ts`、`CHANGELOG.md`
- **fix(standards): 捕获条补两条机械规则，默认「上抛」**. 补「同一错误只处理一次」与「try 块只包可能失败的那一句」。
  - `employee-standards.md`、`AGENTS.md`、`docs/script.js`、`tests/docs-sync.test.ts`、`CHANGELOG.md`
- **feat(standards): §6 补两条底层原则**. 补「测试钉住行为，不钉实现」与「测试自足且确定」；合并两条重复的证据规则。
  - `employee-standards.md`、`AGENTS.md`、`docs/script.js`、`tests/docs-sync.test.ts`、`CHANGELOG.md`
- **refactor(standards): 两个超长条目拆成决策子项，§1 加分组标题**. §3 自动链与 §4 数据分支拆为子项，§1 加 6 个分组标题；纯结构，措辞未改。
  - `employee-standards.md`、`AGENTS.md`、`docs/script.js`、`CHANGELOG.md`
- **fix(standards): 组件测试禁令收窄到「无行为断言」**. 行为级组件测试改按点名标准判断，不再一并禁止；三副本同步。
  - `employee-standards.md`、`AGENTS.md`、`docs/script.js`、`tests/docs-sync.test.ts`、`CHANGELOG.md`

## [0.3.109] - 2026-10-28
- **fix(init): 已装 auto-pipeline 的项目重跑 init 不再忽略 `openspec/`**. 受管忽略按 flag 与已有 workflow 取并集；补回归测试。
  - `src/commands/init.ts`、`tests/auto-pipeline.test.ts`、`CHANGELOG.md`
- **feat(init): 受管 .gitignore 路径改为初始化时可勾选**. init 增加受管路径多选，取消项以 `# openspec-pw: skip=…` 记录，后续不再补回。
  - `src/shared/gitignore-managed.ts`、`src/commands/init.ts`、`src/commands/update.ts`、`tests/gitignore-managed.test.ts`、`tests/init.test.ts`、`README.md`、`openspec/specs/cli/init/spec.md`、`CHANGELOG.md`
- **fix(standards): 堵住 §6「测试红 → 更新断言」对重构的放行**. 条件改为「行为本次有意变更」，并写明重构只改结构、红即改坏；三副本同步。
  - `employee-standards.md`、`AGENTS.md`、`docs/script.js`、`tests/docs-sync.test.ts`、`CHANGELOG.md`
- **fix(standards): 补 3 处规则内部的漏口，拆开 2 处合写条**. 重试出口补幂等前提，§5 的 🔴 只保留禁提交，§3 两轮审查拆成两条；三副本同步。
  - `employee-standards.md`、`AGENTS.md`、`docs/script.js`、`CHANGELOG.md`
- **fix(standards): 修掉 4 处执行不了的规则 + 3 处按判据精简**. 修正失效指向与生态措辞，补自动链兜底与 lint 清单缺失出口，删 3 处重复；三副本同步。
  - `employee-standards.md`、`AGENTS.md`、`docs/script.js`、`CHANGELOG.md`
- **fix(standards): 守卫条按「失败是否可见」重写**. 守卫只能把失败变成显式拒绝或默认值，不能静默消失；根因在别处时修根因；三副本同步。
  - `employee-standards.md`、`AGENTS.md`、`docs/script.js`、`tests/docs-sync.test.ts`、`CHANGELOG.md`
- **feat(standards): 补三条设计律（非法组合挡在构造处 / 写操作幂等 / 可变状态单写入口）**. 三条均限定作用域并让位 YAGNI 优先链；三副本同步。
  - `employee-standards.md`、`AGENTS.md`、`docs/script.js`、`tests/docs-sync.test.ts`、`CHANGELOG.md`
- **fix(standards): 给「停下」补执行内容**. 停下前须写出各次尝试共同依赖的假设；复现的失败须来自预期的那条断言。
  - `employee-standards.md`、`AGENTS.md`、`docs/script.js`、`tests/docs-sync.test.ts`、`CHANGELOG.md`
- **fix(standards): 四条工程纪律并入既有条款**. 守卫不得静默、空变异判据、失败测试先行并入条款；第四条由「精准改动」覆盖。
  - `employee-standards.md`、`AGENTS.md`、`docs/script.js`、`tests/docs-sync.test.ts`、`CHANGELOG.md`

## [0.3.108] - 2026-10-26
- **fix(docs): 内嵌规范改用哨兵收尾**. 改用 `// spec-embed:zh|en` 哨兵抽取，正文含反引号+分号不再截断；补 §3 提案入口锚点。
  - `docs/script.js`、`tests/docs-sync.test.ts`、`CHANGELOG.md`
- **fix(standards): 审阅驱动的一轮语义修正 + 措辞收敛**. 经验沉淀改为不指名载体；§3 门槛去掉编辑器分派；措辞收敛。
  - `employee-standards.md`、`AGENTS.md`、`docs/script.js`、`CLAUDE.md`、`CHANGELOG.md`
- **feat(editors): 恢复 DeepSeek Harness（dsh）适配器**. 恢复 dsh 适配器，装 `.dsh/skills/opsx-e2e/SKILL.md`；旧 `--tools minimax` 项目需重跑 init 落到 rank 100。
  - 新增 `src/commands/editors/adapters/dsh.ts`、`tests/editors-dsh.test.ts`；修改 `src/commands/editors/{types,registry}.ts`、`src/commands/editors.ts`、`src/commands/{init,doctor,uninstall,update}.ts`、`src/index.ts`、`src/shared/gitignore-managed.ts`、`tests/{editors-contract,editors-tools,editors-cursor,init,gitignore-managed,doctor}.test.ts`、`tests/commands/{doctor,uninstall-command}.test.ts`、`README.md`、`README.zh-CN.md`、`docs/index.html`、`CHANGELOG.md`
- **fix(templates): 移除指向已删除命令与不存在命令名的两处说明**. 删除指向已删 `vision-check` 与不存在的 `/handoff` 的说明，改为人工填写与人工交接。
  - `templates/app-exploration.md`、`templates/test-plan.md`、`CHANGELOG.md`
- **docs(claude-md): 文档同步表去掉已删除路径，模板产物描述区分命令与 skill**. 删除失效同步表行，并把模板产物描述改为命令与 skill 两种形态。
  - `CLAUDE.md`、`CHANGELOG.md`

## [0.3.107] - 2026-10-26
- **feat(cli): `flake` 与 `gate` 覆盖「调大超时掩盖竞态」**. 新增 `timeout-increase` 检测器并接入 `gate`；§0 命令改为 `openspec --help`。
  - `src/commands/flake.ts`、`src/commands/gate.ts`、`src/index.ts`、`templates/auto-pipeline.yml`、`tests/commands/flake.test.ts`、`tests/gate.test.ts`、`tests/auto-pipeline.test.ts`、`employee-standards.md`、`docs/script.js`、`README.md`、`README.zh-CN.md`、`CHANGELOG.md`
- **fix(standards): 封住「记日志 + 宽 catch 兜底返回」的逃生口**. 兜底返回按形状判吞错；无类型 catch 枚举不出即上抛。
  - `employee-standards.md`、`AGENTS.md`、`docs/script.js`、`tests/docs-sync.test.ts`、`CHANGELOG.md`
- **fix(standards): 「## 状态」补记提案阶段两轮审查的完成情况**. tasks.md 状态项补记两轮审查完成情况，避免会话中断后重做或漏检；三副本同步。
  - `employee-standards.md`、`AGENTS.md`、`docs/script.js`、`CHANGELOG.md`
- 未采纳的复审建议（记录取舍）：「`debug` 与必须可见」若改成固定 warning 会破坏「按影响」分级；审计日志例外已由 §1「简化有边界」覆盖；「带因包装不泄给外部」与同子弹「不带因=丢因果」互斥且属输出边界问题，另案处理；`finally`/`defer` 属语言机制不属准入与出口语义。已知未修：准入第三形态「失败本会就此丢失」需知道调用方行为，单文件编辑下判定不可本地化，存在「加/删日志」的方向性方差——修它要第三次改动准入语义且无实测支撑。

## [0.3.106] - 2026-10-25
- **fix(standards): 异常处理条款改为「默认不捕获」**. 只在能改变结果的地方捕获，并补三形态准入判据。
  - `employee-standards.md`、`AGENTS.md`、`docs/script.js`、`tests/docs-sync.test.ts`、`CHANGELOG.md`
- **feat(cli): 新增 `openspec-pw gate` 组合门禁**. 按 validate → lint → typecheck → test → flake → e2e 执行，三值退出码，含两条假绿护栏。
  - `src/commands/gate.ts`、`src/index.ts`、`tests/gate.test.ts`、`README.md`、`README.zh-CN.md`
- **feat(cli): `coverage` 与 `audit` 补齐判定退出码**. `coverage --fail-under` 与 `audit --gate` 低于阈值或有问题时退 1，默认行为不变。
  - `src/commands/coverage.ts`、`src/commands/audit.ts`、`src/index.ts`、`tests/check-exit-codes.test.ts`、`README.md`、`README.zh-CN.md`
- **feat(cli): 新增 Claude Code Stop hook（`init --hook`）**. `init --hook` 把 gate 装成 Stop hook，门禁红则阻断收尾；static/full 两档，合并写入并保留用户钩子。
  - `src/commands/hooks.ts`、`src/commands/gate.ts`、`src/commands/init.ts`、`src/commands/uninstall.ts`、`src/index.ts`、`tests/hooks.test.ts`、`tests/gate.test.ts`、`README.md`、`README.zh-CN.md`
- **feat(cli): 新增全自动流水线模板（`init --auto-pipeline`）**. 生成 `.github/workflows/openspec-auto.yml`，PR 跑 gate，标签或手动作业跑 apply → e2e → gate 并开 PR。
  - `templates/auto-pipeline.yml`、`src/commands/pipeline.ts`、`src/commands/init.ts`、`src/index.ts`、`tests/auto-pipeline.test.ts`、`README.md`、`README.zh-CN.md`
- **feat(cli): E2E 命令支持无头运行（`/opsx:e2e <name> --auto`）**. 无头模式用 `coverage --plan` 替代人工确认，HARD STOP 改为结构化中止；交互流程不变。
  - `templates/e2e-command.md`、`src/commands/coverage.ts`、`src/index.ts`、`tests/check-exit-codes.test.ts`、`tests/e2e-template-auto.test.ts`、`README.md`、`README.zh-CN.md`
- **fix(ci): 流水线补齐 verify 阶段与 PR 正文契约**. 补 verify 与 PR 正文明细；修正预检：先生成命令、profile 改 custom、allowedTools 改 Bash。
  - `templates/auto-pipeline.yml`、`tests/auto-pipeline.test.ts`、`README.md`、`README.zh-CN.md`
- **feat(e2e): 补上无浏览器 MCP 时的第三条探索路径**. 补一次性脚本探索路径，并明确工具路由是一条链而非菜单。
  - `templates/e2e-command.md`、`tests/e2e-template-auto.test.ts`、`CHANGELOG.md`
- **fix(gate): 无需变更名的检查不再因「多个活跃变更」判红**. 只有 validate / e2e / coverage 需要变更名，其余检查直接在当前工作树运行。
  - `src/commands/gate.ts`、`tests/gate.test.ts`、`CHANGELOG.md`
- **fix(ci): 流水线阶段改为「便宜的在前」**. apply 阶段改 `gate --skip e2e`，新增静态闸门，并补 pipefail 与关闭 e2e 时的 skip。
  - `templates/auto-pipeline.yml`、`tests/auto-pipeline.test.ts`、`README.md`、`README.zh-CN.md`
- **fix(ci): 流水线项目不再把 `openspec/` 写进受管 gitignore 块**. `--auto-pipeline` 项目把 `openspec/` 排除出受管块，update 检测到工作流时同步不再忽略。
  - `src/shared/gitignore-managed.ts`、`src/commands/init.ts`、`src/commands/update.ts`、`src/commands/pipeline.ts`、`tests/gitignore-managed.test.ts`、`tests/auto-pipeline.test.ts`、`README.md`、`README.zh-CN.md`
- **docs(site): 修正 MiniMax Code 的官方链接并明确 CLI 集成目标**. 官方链接改指 homepage，并补 `mcode` CLI 标注，避免只装桌面端的用户误判。
  - `docs/index.html`、`README.md`、`README.zh-CN.md`、`CHANGELOG.md`

## [0.3.105] - 2026-10-25
- **fix(standards): 自动链真正落到 verify**. 补「不受规模门槛限制」，收尾要求同回合调用 `/opsx:verify`，并修复 `sync-standards.mjs` 的静默失败。
  - `employee-standards.md`、`docs/script.js`（ZH/EN 副本）、`tests/docs-sync.test.ts`、`scripts/sync-standards.mjs`、`tests/standards-sync.test.ts`、`CHANGELOG.md`
- **refactor(editors): 适配器契约收敛为四维**. 契约收敛为 artifacts / detection / mcp / rules 四维；删除单点扩展点。
  - `src/commands/editors/{types,declaration,shared,registry,mcp-carriers,removal,preselect,project-rules}.ts`、`src/commands/editors/adapters/*.ts`、`src/commands/editors.ts`、`src/commands/init.ts`、`tests/editors-contract.test.ts`、`tests/format-artifact.test.ts`、`tests/mcp-carriers.test.ts`、`tests/editors-removal.test.ts`、`CHANGELOG.md`
- **fix(editors): 命令形式随适配器声明**. 命令形式移入适配器声明，受管忽略收窄到 `.agents/skills/opsx-e2e/`。
  - `src/commands/editors/{types,registry}.ts`、`src/commands/editors/adapters/{claude,codebuddy,minimax}.ts`、`src/commands/init.ts`、`src/shared/gitignore-managed.ts`、`tests/editors-command-form.test.ts`、`tests/editors-minimax.test.ts`、`tests/gitignore-managed.test.ts`、`tests/commands/init-deselect.test.ts`、`README.md`、`README.zh-CN.md`、`CHANGELOG.md`
- **fix(cli): doctor 兜底命令提示按各编辑器的实际命令形式分组**. 兜底提示按适配器实际命令形式分组生成，并补齐共享 `.mcp.json` 的保留语义。
  - `src/commands/doctor.ts`、`src/commands/editors/adapters/cline.ts`、`src/commands/editors/types.ts`、`tests/doctor.test.ts`、`tests/commands/init-deselect.test.ts`、`README.md`、`README.zh-CN.md`、`CHANGELOG.md`
- **feat(editors): 新增 MiniMax Code 适配器**. 以 `.agents/skills/opsx-e2e/SKILL.md` 交付；共享 `.mcp.json` 按文件比对保留。
  - `src/commands/editors/adapters/minimax.ts`、`src/commands/editors/{types,shared,removal,tool-selection}.ts`、`src/commands/{init,update,doctor,uninstall}.ts`、`src/shared/gitignore-managed.ts`、`src/index.ts`、`tests/editors-minimax.test.ts`、`tests/commands/{init-deselect,doctor,uninstall-minimax}.test.ts`、`README.md`、`README.zh-CN.md`、`docs/index.html`、`CHANGELOG.md`
- **fix(cli): `update` 强制刷新 npm 缓存，版本不一致提示按来源分流**. `npm install` 加 `--prefer-online`，版本不一致提示按解析路径落在项目内还是全局分流。
  - `src/commands/update.ts`、`tests/update.version-shadow.test.ts`、`CHANGELOG.md`

## [0.3.104] - 2026-10-24
- **docs(standards): 补齐不可逆命令授权**. §2 新增破坏性命令授权；§7 询问条件收窄；§1 异常出口改用可观察判据。
  - `employee-standards.md`、`docs/script.js`（ZH/EN 副本）、`tests/docs-sync.test.ts`、`CHANGELOG.md`
- **docs(standards): 归档授权收敛到一处**. 授权清单补 `archive`，删归档条目的「默认人工」表述，触发词收窄为「自动归档」。
  - `employee-standards.md`、`docs/script.js`（ZH/EN 副本）、`tests/docs-sync.test.ts`（锚点 −1 ZH / −1 EN / +2）、`CHANGELOG.md`
- **docs(standards): 自动链条目去重——e2e 排除合并、凑绿禁令改为指路**. 合并 e2e 排除的重复表述，凑绿禁令改为指向 §6 断言分歧条款；语义未变。
  - `employee-standards.md`、`docs/script.js`（ZH/EN 副本）、`CHANGELOG.md`
- **docs(standards): 密集规则改为嵌套列表**. §0 与 §1 四条规则拆成父项 + 子项；落地页渲染器支持缩进嵌套并补 3 条测试。
  - `employee-standards.md`、`docs/script.js`（渲染器 + ZH/EN 副本）、`docs/style.css`、`tests/docs-sync.test.ts`、`CHANGELOG.md`
- **docs(standards): 合并碎片条款（规则与条件不变）**. 合并 5 组碎片条款，条目 70 → 67；规则与条件不变。
  - `employee-standards.md`、`docs/script.js`（ZH/EN 副本）、`CHANGELOG.md`
- **docs(standards): e2e 移出自动链——自动链止于 verify**. 自动链改为 apply → verify 即止，e2e 仅在用户显式调用时运行；任务状态字段同步。
  - `employee-standards.md`、`docs/script.js`（ZH/EN 副本）、`tests/docs-sync.test.ts`（+1 ZH / +1 EN 锚点）、`CHANGELOG.md`

## [0.3.103] - 2026-10-24
- **docs(standards): 「点名」术语归位——只保留验收语义**. 「点名」只保留 §6 验收语义，另三处改为「明确要求 / 明确指定」。
  - `employee-standards.md`、`docs/script.js`（ZH/EN 副本）、`CHANGELOG.md`
- **fix(standards): 两处标记档位归位，WHY 去重**. 「无断言价值的测试」与「不编造 URL/路径/字段名」升 🔴，§6 WHY 删去重复句。
  - `employee-standards.md`、`docs/script.js`（ZH/EN 副本）、`CHANGELOG.md`
- **docs(standards): 规范减法第一轮——合并重复表述（不改变语义）**. 六处重复表述合并，规则语义不变。
  - `employee-standards.md`、`docs/script.js`（ZH/EN 副本）、`CHANGELOG.md`
- **fix(standards): 跨章节矛盾与副本漂移修正（`standards-consistency-fixes`）**. 修 6 处：冲突裁决、规模门槛、上界确认、裸 `return null`。
  - `employee-standards.md`、`docs/script.js`（ZH/EN 副本）、`tests/docs-sync.test.ts`（+4 ZH / +4 EN 锚点）、`CHANGELOG.md`
- **docs(standards): OpenSpec 阶段自动串联——两端人工 + 中间自动**. 新增阶段自动串联规则：两端人工、中间自动，含两轮审查、高风险确认与归档条件。
  - `employee-standards.md`、`docs/script.js`（ZH/EN 内嵌副本）、`tests/docs-sync.test.ts`（+5 ZH / +5 EN 锚点）、`CHANGELOG.md`

## [0.3.102] - 2026-10-23
- **refactor(standards): wrapper 只保留 `@AGENTS.md` 导入**. 移除 CodeGraph 块与工作流提示；已装项目 update 自动重写。
  - `src/commands/editors/project-rules.ts`、`src/commands/update.ts`、`tests/editors.test.ts`、`tests/editors-codebuddy.test.ts`、`tests/update.standards.test.ts`、`README.md`、`README.zh-CN.md`、`CLAUDE.md`、`CHANGELOG.md`
- **fix(standards): UI 文案删除测试补用户要求豁免（`ui-copy-restraint` 修订）**. 删除测试补「用户明确要求的除外」，消除与保留段的冲突；中英同步。
  - `employee-standards.md`、`AGENTS.md`（本地镜像）、`docs/script.js`（ZH 1 处、EN 1 处）、`CHANGELOG.md`
- **docs(standards): 通篇审阅修三处范围边界**. 修模块化、UI 删除测试范围、买断条款概率依据三处边界。
  - `employee-standards.md`、`AGENTS.md`（本地镜像）、`docs/script.js`（ZH 3 处、EN 3 处）、`CHANGELOG.md`
- **docs(standards): 推测性边界条款按二审加固**. 买断条款改用证据缺口、统一「信任边界」、补默认不加并去重。
  - `employee-standards.md`、`AGENTS.md`（本地镜像）、`docs/script.js`（ZH 2 处、EN 2 处）、`tests/docs-sync.test.ts`（锚换 2）、`CHANGELOG.md`
- **docs(standards): §1 新增推测性边界买断条款**. 为推测性竞态/安全边界增加复杂度前，须说明失败模式、概率与代价并取得同意。
  - `employee-standards.md`、`AGENTS.md`（本地镜像）、`docs/script.js`（ZH 1 处、EN 1 处）、`tests/docs-sync.test.ts`（锚 +2）、`CHANGELOG.md`
- **docs(standards): §1 新增条款按审阅加固**. UI 文案、库能力、模块化三条按审阅加固，合并重复并要求先查证据。
  - `employee-standards.md`、`AGENTS.md`（本地镜像）、`docs/script.js`（ZH 3 处、EN 3 处）、`tests/docs-sync.test.ts`（锚换 2）、`CHANGELOG.md`
- **docs(standards): §1 补模块化与库能力假设条款（`modularity-and-capability-check`）**. 补模块化与「先查文档/类型再断言库缺能力」两条。
  - `employee-standards.md`、`AGENTS.md`（本地镜像）、`docs/script.js`（ZH 2 处、EN 2 处）、`tests/docs-sync.test.ts`（锚 +4）、`CHANGELOG.md`
- **docs(standards): §1 新增界面文案克制条款**. 不写冗余次级标签、副标题与 slogan，能用布局/层级消解的不加文案。
  - `employee-standards.md`、`AGENTS.md`（本地镜像）、`docs/script.js`（ZH 1 处、EN 1 处）、`tests/docs-sync.test.ts`（锚 +2）、`CHANGELOG.md`

## [0.3.101] - 2026-10-20
- **fix(lint): 配置代写与语义探测 review 轮修复**. 修 8 项：ruff 配置优先级、ESLint 片段分派、TS parser 作用域、静默失败改为可见记录。
  - `src/shared/lint-guidelines.ts`、`src/commands/init.ts`、`src/commands/doctor.ts`、`tests/shared/lint-guidelines.test.ts`、`tests/commands/init-lint-config.test.ts`、`tests/commands/doctor-lint-semantic.test.ts`、`openspec/changes/lint-config-bootstrap/{design,proposal,specs/lint-guidelines/spec}.md`、`CHANGELOG.md`
- **fix(lint): 清单 checksum 归一化 EOL，CRLF checkout 不再误判手改**. checksum 先归一化 EOL 再 hash，CRLF checkout 不再误判用户手改。
  - `src/shared/lint-guidelines.ts`、`tests/shared/lint-guidelines.test.ts`、`CHANGELOG.md`
- **feat(lint): `init --lint-config` 配置代写 + doctor 语义探测**. 生成或追加最小配置（opt-in、幂等、手改块保留）；doctor 用官方解析器探测规则生效。
  - `src/shared/lint-guidelines.ts`、`src/shared/index.ts`、`src/commands/init.ts`、`src/commands/doctor.ts`、`src/index.ts`、`tests/shared/lint-guidelines.test.ts`、`tests/commands/init-lint-config.test.ts`（新）、`tests/commands/doctor.test.ts`、`README.md`、`README.zh-CN.md`、`CHANGELOG.md`
- **fix(lint): review 轮修复——doctor 探测与模板片段**. 修 9 项：配置读取守卫、清单刷新、模板片段拆分、删同义反复断言。
  - `src/commands/doctor.ts`、`src/commands/update.ts`、`src/shared/lint-guidelines.ts`、`templates/lint-guidelines.md`、`tests/commands/doctor.test.ts`、`tests/shared/lint-guidelines.test.ts`、`tests/update.test.ts`、`CHANGELOG.md`
- **feat(lint): 吞错清单 + doctor 覆盖 + 安装分发**. 新增吞错 lint 清单；doctor 探测覆盖；init/update/uninstall 按内容所有权分发。
  - `src/shared/lint-guidelines.ts`（新）、`templates/lint-guidelines.md`（新）、`src/commands/init.ts`、`src/commands/update.ts`、`src/commands/uninstall.ts`、`src/commands/doctor.ts`、`src/shared/index.ts`、`tests/shared/lint-guidelines.test.ts`（新）、`tests/commands/doctor.test.ts`（+6 用例）、`README.md`、`README.zh-CN.md`、`CHANGELOG.md`
- **fix(lint): 本仓开启 no-empty 并修复 audit.ts 空 catch（词面层自证）**. 本仓启用 `no-empty` 并修掉 `audit.ts` 唯一空 catch，实证「lint 封不住带注释黑洞」。
  - `eslint.config.mjs`、`src/commands/audit.ts`、`dist/commands/audit.js`(+map)、`CHANGELOG.md`

## [0.3.100] - 2026-10-19
- **docs(standards): 吞错条款重写为出口白名单**. 包含上抛带因、窄类型记录后继续、catch-all 隔离点；§6 新增反断言弱化条。
  - `employee-standards.md`、`AGENTS.md`（本地镜像）、`docs/script.js`（ZH 3 处、EN 3 处）、`CHANGELOG.md`
- **fix(doctor): config 不可读时记录 skip 而非静默吞掉（`doctor-unreadable-config-skip`）**. config 不可读时推 info 行而非静默吞掉，配套第六态测试。
  - `src/commands/doctor.ts`、`tests/commands/doctor.test.ts`（+1 用例）、`CHANGELOG.md`
- **feat(e2e): 浏览器工具角色路由 + doctor storageState 诊断**. e2e 模板改为角色路由并补会话状态语义，doctor 新增 `storage-state` 检查。
  - `templates/e2e-command.md`、`src/commands/doctor.ts`、`tests/commands/doctor.test.ts`、`README.md`、`README.zh-CN.md`、`CHANGELOG.md`

## [0.3.99] - 2026-10-10
- **feat(gitignore): 受管块新增探索截图目录（`managed-screenshots-local`）**. `tests/playwright/screenshots/` 入受管忽略（21→22 项），截图改为本地证据。
  - `src/shared/gitignore-managed.ts`、`tests/gitignore-managed.test.ts`（+1 用例）、`README.md`、`README.zh-CN.md`、`CHANGELOG.md`
- **docs(standards): 用户校准 6 处 + 复审去重 1 处**. 经验沉淀、防循环、PR 门、询问句、证据指向、WHY；双语嵌入同步。
  - `employee-standards.md`、`AGENTS.md`（本地镜像）、`docs/script.js`（ZH 4 处、EN 4 处）、`CHANGELOG.md`
- **docs(standards): 落地审计延后三处 🟡 中的两处**. 选型链尾句改挂自实现层，§6 复现条款补「≥2 次未复现」分支。
  - `employee-standards.md`、`AGENTS.md`（本地镜像）、`docs/script.js`（ZH 2 处、EN 2 处）、`CHANGELOG.md`
- **docs(standards): 审计后措辞精简收 4 处**. 11 个候选收 4 个，驳回 6 个并留档失败场景。
  - `employee-standards.md`、`AGENTS.md`（本地镜像）、`docs/script.js`（ZH 嵌入 3 处、EN 嵌入 2 处）、`CHANGELOG.md`
- **docs(standards): 全规范弱模型解析审计（`standards-weak-model-audit`）**. §0-§7 收敛：新增用户指令优先、未标注默认 🟡、冲突出口；受管忽略补 `tmp/`。
  - `employee-standards.md`、`AGENTS.md`（本地镜像）、`docs/script.js`（双语嵌入全量同步）、`tests/docs-sync.test.ts`（锚 +4 换 1）、`src/shared/gitignore-managed.ts`（受管块 20→21 项）、`CHANGELOG.md`
- **docs(standards): §1 注释纪律按弱模型证据升级**. 默认不写 + 正误示例 + 黑名单 + 自检门，锚 +2。
  - `employee-standards.md`、`AGENTS.md`（本地镜像）、`docs/script.js`（双语嵌入各 1 行）、`tests/docs-sync.test.ts`（锚 +2）、`CHANGELOG.md`

## [0.3.98] - 2026-10-09
- **fix(audit): 锚的 capability 段误用 change 名时给精确诊断（`anchor-change-name-diagnosis`）**. 不再误报「retired capability」；模板补定义与正误示例。
  - `src/commands/audit.ts`、`tests/commands/audit.anchors.test.ts`（+2 用例：active/archive change 名各一）、`templates/e2e-command.md`、`CHANGELOG.md`
- **docs(standards): §6 测试取向反转**. 测试只随验收存在，未点名高价值场景须提议；修复类任务完成前后各复现一次。
  - `employee-standards.md`、`AGENTS.md`（本地镜像）、`docs/script.js`（双语嵌入）、`tests/docs-sync.test.ts`（锚更新）、`CHANGELOG.md`
- **feat(editors): CodeBuddy CLI 编辑器适配（`codebuddy-adapter`）**. 新增第七款编辑器 CodeBuddy CLI：冒号命名 + CODEBUDDY.md wrapper + `.mcp.json`，受管忽略 18→20 项。
  - `src/commands/editors/adapters/codebuddy.ts`、`src/shared/gitignore-managed.ts`（+2 项）、`doctor/update/init/uninstall/editors/editors/*`（wrapper 泛化）、`tests/editors-codebuddy.test.ts`（+25 用例）及既有六套测试更新、双语 README（编辑器矩阵/使用表/首配清单/架构树/gitignore 注记等全量同位补齐；EN 侧顺带补齐既缺的 omp/Pi MCP 条目）、`docs/index.html`（meta description）、`CHANGELOG.md`
- **docs(standards): §1/§2 融合补 import 随迁与归位纪律（`import-relocation-discipline`）**. 补 import 随迁与静态 import 置顶，动态/函数内 import 豁免；锚 +4。
  - `employee-standards.md`、`AGENTS.md`（本地镜像）、`docs/script.js`（双语嵌入各 2 行）、`tests/docs-sync.test.ts`（锚 +4）、`CHANGELOG.md`
- **docs(standards): 审计驱动的四处措辞加固**. 豁免补运行顺序依赖、豁免须注明缘由、无 linter 自查操作化、覆盖义务开裁决口。
  - `employee-standards.md`、`AGENTS.md`（本地镜像）、`docs/script.js`（双语嵌入各 4 行）、`tests/docs-sync.test.ts`（锚 +4 换 3）、`CHANGELOG.md`
- **docs(standards): 最少语言修剪——新增条款九处减字（`standards-wordiness-slim`）**. 九处减字，一处「多处」误删已恢复；语义零损失。
  - `employee-standards.md`、`AGENTS.md`（本地镜像）、`docs/script.js`（双语嵌入各 4 行）、`tests/docs-sync.test.ts`（锚换 1）、`CHANGELOG.md`
- **chore(scripts): AGENTS.md 镜像收敛为 SSOT 生成物（`standards-mirror-generator`）**. 新增 `npm run standards:sync`，AGENTS.md 镜像由 SSOT 再生；手工同步面 4→3。
  - `scripts/sync-standards.mjs`（新增）、`package.json`（`standards:sync`）、`tests/standards-sync.test.ts`（+14 用例，tempdir 全隔离——CI 安全）、`CHANGELOG.md`

## [0.3.97] - 2026-10-08
- **docs(standards): §1 新增 🔴 静默吞错禁令 + §2 断言证据纪律**. 补空 catch 等四族禁令；§2 补「引用作依据的文件先通读」。
  - `employee-standards.md`、`AGENTS.md`（本地镜像）、`docs/script.js`（双语嵌入各 2 行）、`CHANGELOG.md`

## [0.3.96] - 2026-09-29
- **chore(scripts): 字体子集化固化为 `npm run fonts:subset`**. landing 文案引入新字符后可直接重跑。
  - `scripts/subset-fonts.py`（新增，~180 行）、`package.json`（`fonts:subset`）、`docs/fonts/noto-serif-sc-subset-600.woff2`（脚本再生成）、`CHANGELOG.md`
- **feat(init/update/uninstall): 受管 .gitignore 新增 4 条路径**. 新增 `.codegraph/`、`.playwright-mcp/`、`.mcp.json`、`playwright/.auth/`（14→18 项）。
  - `src/shared/gitignore-managed.ts`、`tests/gitignore-managed.test.ts`（新增 1 用例）、`README.md`、`README.zh-CN.md`、`CHANGELOG.md`
- **docs(standards): 规范校准锚点改为「弱一档前沿模型」**. 保留假设验证与分步验证激励，e2e 模板补不可信内容提示。
  - `employee-standards.md`、`AGENTS.md`（本地镜像）、`docs/script.js`（双语嵌入各 2 行）、`templates/e2e-command.md`、`CHANGELOG.md`

## [0.3.95] - 2026-09-21
- **docs(standards): §1 DO NOT 九条压缩为两条**. DO NOT 九条并两簇（输入校验 / 写法纪律），AGENTS.md 继续忽略入库。
  - `employee-standards.md`、`AGENTS.md`（本地镜像）、`CLAUDE.md`、`docs/script.js`、`CHANGELOG.md`
- **docs(standards): 删「交付前自问」独立条与「即使你更倾向别的写法」尾缀**. 删重复的交付前自问与口味尾缀，并以 SSOT 重建镜像消除漂移。
  - `employee-standards.md`、`AGENTS.md`、`docs/script.js`、`CHANGELOG.md`
## [0.3.94] - 2026-09-21
- **feat(init/update/uninstall): .gitignore 受管标记块**. 14 项敏感/运行时文件自动忽略，块外不动；含幂等、CRLF 容错与反向清理。
  - 新增 `src/shared/gitignore-managed.ts`；修改 `src/commands/{init,update,uninstall}.ts`、`src/shared/index.ts`（barrel）
  - 新增 `tests/gitignore-managed.test.ts`（16 用例）；`tests/init.test.ts`（advisory→受管块断言更新）
  - `README.md`、`README.zh-CN.md`

## [0.3.93] - 2026-09-20
- **refactor(standards): CLAUDE.md wrapper 的 CodeGraph 块精简至核心指令**. wrapper 的 CodeGraph 块只留核心四要素，删两句重复后果说明；已装项目 update 重写。
  - `src/commands/editors/project-rules.ts`
- **docs(standards): §0 自主边界/经验沉淀 + 选型链 + debt**. 补七级选型链与 debt 机制，§3 中止条款与 §6 证据条；同步嵌入。
  - `employee-standards.md`、`docs/script.js`、`.gitignore`、`CHANGELOG.md`

## [0.3.92] - 2026-09-18
- **docs(standards): 新增 §7 性能与资源边界**. 新增 §7（量级确认、无界读取/并发禁令、循环 I/O 与无界缓存），六章扩为七章。
  - `employee-standards.md`、`AGENTS.md`、`docs/script.js`、`tests/docs-sync.test.ts`、`CHANGELOG.md`
- **docs(standards): §1 补依赖幻觉禁令与有界修复循环**. 补依赖幻觉禁令与修复循环 2 轮上限，折进既有 lint gate 条。
  - `employee-standards.md`、`AGENTS.md`、`docs/script.js`、`tests/docs-sync.test.ts`、`CHANGELOG.md`

## [0.3.91] - 2026-09-16
- **docs(landing): 全页居中 + 命令序修正**. 落地页改中轴居中；终端命令按依赖链重排，浏览器安装收窄为 `install chromium`。
  - `docs/index.html`、`docs/style.css`、`docs/script.js`、`src/commands/init.ts`、`README.md`、`dist/`
- **fix(agents): 退役角色 historicalHashes 判定链补通——旧项目干净副本恢复 tool-owned**. 补退役角色判定链：旧项目干净副本恢复 tool-owned，可卸载可报告。
  - `src/commands/editors/agents.ts`、`README.md`、`tests/agents.test.ts`、`CHANGELOG.md`
- **feat(agents)!: --agents 缩为单件 planner（generator、healer 全部退役）**. `--agents` 只装 planner，generator / healer 退役；模板 healer 禁令原样保留。
  - `src/commands/editors/agents.ts`、`src/commands/init.ts`、`src/index.ts`、`templates/agents/`（manifest.json、SOURCE.md、删 healer 快照）、`README.md`、`tests/agents.test.ts`、`tests/init.test.ts`、`CHANGELOG.md`
- **feat(agents): --agents 缩为 planner + healer（退役 generator）**. `--agents` 缩为 planner + healer，并删落地页过时的 MCP 手装说明。
  - `src/commands/editors/agents.ts`、`src/commands/init.ts`、`templates/agents/`（manifest.json、SOURCE.md、删 generator 快照）、`README.md`、`docs/index.html`、`tests/agents.test.ts`、`tests/init.test.ts`、`CHANGELOG.md`
- **docs(landing): 首页 11→4 section + 暗色 token 重构**. 首页由 11 节压到 4 节，换暗色单色 token；本地验收 19 项通过。
  - `docs/index.html`（1072→155 行）、`docs/style.css`（新增）、`docs/style-{base,sections,extra,storytelling}.css`（删除）、`docs/script.js`（467→487 行，删 counters 增打字机）
- **chore(agents): healer 价值错位知情提示 + e2e 模板 healer 禁令测试锁守卫**. 安装确认与 README 补 healer 知情提示，新增模板禁令守卫测试。
  - `src/commands/init.ts`、`README.md`、`tests/e2e-template-healer-ban.test.ts`（新增）、`CHANGELOG.md`

## [0.3.90] - 2026-09-14
- **docs(standards): §6 单测生成禁令化**. §6 单测清单升级为禁止生成，新增 UI 组件禁测与 3 项 AI 反模式；锚 +2。
  - `employee-standards.md`、`AGENTS.md`、`docs/script.js`（ZH/EN 同步）、`tests/docs-sync.test.ts`（+2 锚）、`CHANGELOG.md`
- **docs(standards): §2 两处微修**. 「压缩上下文」移入 DO，格式化工具句改可读措辞。
  - `employee-standards.md`、`AGENTS.md`、`docs/script.js`（ZH/EN 同步）、`CHANGELOG.md`
- **docs(standards): §6 结构统一为 DO / DO NOT**. §6 改为 DO / DO NOT 结构，语义不变，并合并两处正反双说。
  - `employee-standards.md`、`AGENTS.md`、`docs/script.js`（ZH/EN 同步）、`CHANGELOG.md`

## [0.3.89] - 2026-09-11
- **fix(init): pre-existing `tests/README.md` 时 Summary 契约指引按所有权分叉**. `tests/README.md` 按所有权三态处理，用户文件不被误伤。
  - `src/commands/init.ts`、`tests/init.test.ts`、`CHANGELOG.md`
- **feat(init): minimal-mode-init——无前端项目最小初始化**. 无前端信号的项目只生成 README + 规范块，`--frontend/--no-frontend` 可覆盖。
  - `src/commands/init.ts`、`src/index.ts`、`src/shared/app-detect.ts`、`src/shared/index.ts`、`src/commands/update.ts`、`src/commands/doctor.ts`、`src/commands/uninstall.ts`、`src/commands/editors.ts`、`src/commands/editors/project-rules.ts`、`templates/tests-readme.md`、`tests/`（init/update/doctor/uninstall/app-detect 扩展）、`README.md`、`CHANGELOG.md`

## [0.3.88] - 2026-09-10
- **docs(standards): §1 补平台假设 DO NOT + 两处清理**. 补平台路径分隔符与换行格式假设禁令，并清理两处标点/枚举残句。
  - `employee-standards.md`、`AGENTS.md`、`docs/script.js`（ZH/EN 同步）、`CHANGELOG.md`
- **docs(standards): §6 删除 B. 交付节——E2E 交付完全归 `/opsx:e2e` 工作流管**. 删 §6 交付节，E2E 回归资产只由显式工作流产生；移除两个锚。
  - `employee-standards.md`、`AGENTS.md`、`docs/script.js`、`tests/docs-sync.test.ts`、`CHANGELOG.md`

## [0.3.87] - 2026-09-10
- **docs(standards): 全篇精简——§1–§5 同尺清理**. 补「不为想象中的场景写防御」，规范 5.9K→3.9K。
  - `employee-standards.md`、`AGENTS.md`、`docs/script.js`、`tests/docs-sync.test.ts`（锚句等价替换）、`CHANGELOG.md`
- **docs(standards): §1 新增注释纪律条款（🟡）**. 新增注释纪律条款：只写 why，不留改动叙述与失效注释；含机制标注豁免。
  - `employee-standards.md`、`AGENTS.md`、`docs/script.js`（ZH/EN 同步）、`CHANGELOG.md`

## [0.3.86] - 2026-09-04
- **feat(audit): spec 锚 + 锚差集审计**. 新增四态报告，只报告不删除；模板补锚规则。
  - `templates/e2e-command.md`（Spec idempotency 锚句 + MCP recording flow review 补锚）、`src/commands/audit.ts`（`extractSpecAnchors`/`extractFixmeLines`/`auditAnchorsCore` 纯函数层 + 检查 4c）、`tests/commands/audit.anchors.test.ts`（新，8 用例四态）、`README.md`、`README.zh-CN.md`、`CHANGELOG.md`
- **docs(standards): §6 深度精简——条目 15→9，🔴 密度 46.7%→44.4%（B. 交付子节 60%→50%）**. §6 条目 15→9，删重复与框架内建行为，🔴 义务全部保留。
  - `employee-standards.md`、`AGENTS.md`、`docs/script.js`、`CHANGELOG.md`

## [0.3.85] - 2026-09-04
- **BREAKING fix(init): 首跑预选只看项目自身信号（`first-run-preselect-project-scope`）**. 首跑预选改用项目信号集，不再混入机器全局安装；非 TTY 行为不变。
  - 新增 `src/commands/editors/preselect.ts`；修改 `src/commands/init.ts`、`src/commands/editors.ts`；`tests/commands/init-preselect.test.ts`（+3 翻转/新增、:246 补无灰字断言）；`README.md`、`README.zh-CN.md`、`CHANGELOG.md`

## [0.3.84] - 2026-09-03
- **fix(templates): 修 `reuseExistingServer` 假绿风险（真实 E2E 冒烟实测发现）**. 生成 config 改 `reuseExistingServer: !process.env.CI`，模板加反假绿守卫。
  - `templates/playwright.config.ts`、`templates/e2e-command.md`、`CHANGELOG.md`
- **fix(templates): 通用工具视角两处加固（seed 去 project 名耦合 + npm 安装渠道声明）**. seed 去掉 project 名耦合，README 声明 npm 为唯一受支持安装渠道。
  - `templates/e2e-command.md`、`README.md`、`README.zh-CN.md`、`CHANGELOG.md`
- **feat(templates): `/opsx:e2e` 与 vendored agents 结合**. 允许条件委托 Planner / Generator，显式禁止委托 Healer。
  - `templates/e2e-command.md`（Step 5/6 注记 + Healer 护栏禁令）、`README.md`、`README.zh-CN.md`、`CHANGELOG.md`
- **fix(templates): 评审 16 项 findings 全量落地**. 修复护栏冲突、STOP 语义、selector 阶梯、主产物幂等、report 对齐。
  - `templates/e2e-command.md`、`templates/app-exploration.md`、`templates/test-plan.md`、`templates/report.md`、`templates/app-knowledge.md`、`templates/seed.spec.ts`、`src/commands/init.ts`（`generateTestPlanTemplate`）、`src/commands/update.ts`（同步相位）、`src/commands/editors/adapters/claude.ts`、`tests/init.test.ts`（+2）、`tests/update.test.ts`（+1）、`tests/editors.test.ts`（frontmatter 断言翻转）、`CHANGELOG.md`
- **fix(templates): e2e-command.md 三处修正 + 官方 MCP 工具条件注记**. 修三处内部矛盾与不可移植引用，补官方 MCP 工具的条件注记。
  - `templates/e2e-command.md`、`CLAUDE.md`、`CHANGELOG.md`
- **feat(init): `--agents` opt-in 安装官方 Playwright agents 快照**. 逐字安装 planner / generator / healer，归属按内容判定；doctor 新增 Vendored Agents 类目。
  - 新增 `templates/agents/`（3 快照 + SOURCE.md + manifest.json）、`src/commands/editors/agents.ts`；修改 `types.ts`（`optionalArtifacts(install)`）、`adapters/claude.ts`、`registry.ts`（`listOptionalArtifactPaths`/`installOptionalArtifacts`）、`removal.ts`（`removeOwnedVendoredAgents`）、`init.ts`、`uninstall.ts`、`update.ts`（`syncVendoredAgents`）、`doctor.ts`、`src/index.ts`
  - 新增 `tests/agents.test.ts`（25 用例）；`README.md`、`README.zh-CN.md`、`CLAUDE.md`（release checklist 打包校验）
- **docs: 澄清 `playwright-test` server 名来历（官方 init-agents 产物名，非自编）**. README 与 init 提示澄清 `playwright-test` 名为官方产物名，行为不变。
  - `README.md`、`README.zh-CN.md`、`src/commands/init.ts`（+1 提示行）、`CHANGELOG.md`

## [0.3.83] - 2026-09-01
- **docs(specs): 主 spec 追认 v0.3.81/0.3.82 行为（`sync-init-selection-spec`）**. 主 spec 追认两级预选与取消勾选移除语义，纯 spec 改动无代码变更。
  - `openspec/specs/init-tool-selection/spec.md`（归档时）、`tests/commands/init-preselect.test.ts`（+2）、`CHANGELOG.md`
- **docs(standards): §6 精简 + §2 两条互斥 🔴 删除**. §6 重写为 15 bullet（路由与交付合并）；§2 两条互斥 🔴 经裁决删除。
  - `employee-standards.md`、`AGENTS.md`、`CLAUDE.md`、`docs/script.js`、`tests/update.standards.test.ts`（+1 replace 分支用例）

## [0.3.82] - 2026-09-01
- **feat(init): 交互多选预选改用产物清单**. 按 `(configured)` 判定，零状态项目回退全检测；与 update/doctor 授权门控同源。
  - 新增 `src/commands/editors/configured.ts`（`isEditorConfigured`/`anyEditorConfigured`/`agentsFileHasMarkers`）；修改 `src/commands/init.ts`（两段式预选 + `Configured (pre-select):` 输出行）
  - 新增 `tests/commands/init-preselect.test.ts`（11 用例）；`tests/commands/init-deselect.test.ts`（mcp.json 残留场景翻转断言）
  - `README.md`、`README.zh-CN.md`

## [0.3.81] - 2026-08-31
- **BREAKING feat(init): 取消勾选的编辑器产物被移除**. 经整体确认移除该编辑器的命令/MCP/wrapper 产物；拒绝则仅跳过写入。
  - 新增 `src/commands/editors/removal.ts`（dry 枚举 `enumerateAdapterArtifacts` + 分部分删除小函数 `removeAdapterMcp`/`removeAdapterCommandArtifacts`/`removeClaudeLegacySkill`/`removeClaudeWrapper` + `cleanupEmptyDirs`）；修改 `src/commands/{init,uninstall}.ts`（init 新增 deselected-removal 阶段 + `InitDeps.confirm` 注入点；uninstall 按 section 复用原语，输出顺序不变）、`src/commands/editors/{project-rules,}.ts`（导出 `removeMarkersFromFile`）
  - 新增 `tests/editors-removal.test.ts`（13 用例）、`tests/commands/init-deselect.test.ts`（10 用例：确认/拒绝/run 级共享块/symlink/--tools/收敛与不收敛/pi 全局残留）；`tests/commands/uninstall-command.test.ts`（+characterization 保护网）
  - `README.md`、`README.zh-CN.md`

## [0.3.80] - 2026-08-31
- **feat: 测试凭据 git 忽略检测 + advisory 提示**. 未忽略时打印 advisory，不改写 `.gitignore`；`ignore` 升为直接依赖。
  - 新增 `src/shared/ignore-check.ts`、`tests/shared/ignore-check.test.ts`（10 用例：含 git 优先级顺序与「被排除目录内 negation 无效」两条 git 语义回归）；修改 `src/commands/{init,update}.ts`、`templates/credentials.yaml`、`tests/{init,update}.test.ts`（+7）；`dependencies` + `ignore@^7.0.7`（自 devDependencies 传递链升级为直接依赖——不升级则发布包运行时 `Cannot find module 'ignore'`）
  - `README.md`、`README.zh-CN.md`
- **fix(update): Summary 零授权行改为「No configured editors」**. 纯文案修正，替代「No supported editor detected」。
  - `src/commands/update.ts`、`tests/update.test.ts`（+1 源码守卫）
- **fix(init): Detected 仅作 TTY 预选信号，新增 `Selected editors:` 行**. `Selected editors:` 明示实际安装集。
  - `src/commands/init.ts`、`tests/init.test.ts`（+6 用例：--tools 抑制 Detected / 非 TTY fallback 双行 / TTY 覆盖预选 / `--tools none` / 无检测双 none 行 / --tools 扩展未检测编辑器）
  - `README.md`、`README.zh-CN.md`

## [0.3.79] - 2026-08-28
- **移除 DeepSeek Harness（dsh）编辑器支持**. 移除 dsh 支持（编辑器收窄为 6 个），保留退役清理与加回条件。
  - 删除：`src/commands/editors/adapters/dsh.ts`；修改：`src/commands/editors/{types,registry}.ts`、`src/commands/editors.ts`、`src/commands/{doctor,update,init,uninstall,index}.ts`
  - `tests/editors-cursor.test.ts`（自 editors-dsh-cursor 更名 + 退役清理 3 用例）、`tests/{editors,editors-tools,init}.test.ts`
  - `README.md`、`README.zh-CN.md`、`docs/index.html`

## [0.3.78] - 2026-08-28
- **专属标记命名空间 `OPENSPEC-PW:` + 存量自动迁移**. 防官方 openspec CLI 误删；doctor 检测块消失。
  - `src/shared/drift.ts`、`src/commands/editors/project-rules.ts`、`src/commands/update.ts`、`src/commands/doctor.ts`、`src/commands/init.ts`、`src/commands/editors.ts`
  - `tests/migrate-markers.test.ts`（新）、`tests/{editors,editors-dsh-cursor,update.standards,update,drift}.test.ts`、`tests/commands/doctor.test.ts`
  - `README.md`、`README.zh-CN.md`（共存注意事项）、根 `CLAUDE.md`/`AGENTS.md`（自吃狗粮迁移）

## [0.3.77] - 2026-08-28
- **前端信号分层检测 + monorepo workspace 感知**. 前端信号改分层检测并支持 workspace 成员扫描，修复 monorepo 漏装 MCP。
  - `src/shared/app-detect.ts`、`tests/shared/app-detect.test.ts`（+13 用例）、`README.md`、`README.zh-CN.md`

## [0.3.76] - 2026-08-28
### Changed
- **规范 review 修复（架构师二轮）**. 修 4 处：管道禁令扩到项目内已有文件、§6 补后端交付、内嵌补回「不重复堆」、锚标签纠错。
  - `employee-standards.md`、`AGENTS.md`、`docs/script.js`、`tests/docs-sync.test.ts`
- **新增 §6 测试与验证策略**. 单测命中才测、验收重心在集成层，覆盖义务与验收定义落地。
  - `employee-standards.md`、`docs/script.js`、`tests/docs-sync.test.ts`、`AGENTS.md`
- **精简 employee-standards（−20% token，零约束损失）**. 规范精简 163→130 行：删机器特定内容、合并小节、压缩工作流表；「未运行」升 🟡。
  - `employee-standards.md`、`docs/script.js`、`AGENTS.md`
- **编辑器写入授权收窄（领土语义）**. update 只维护已授权编辑器（命令工件为判据），未授权只提示 init；doctor 分档。
  - `src/commands/editors/types.ts`、`src/commands/editors/registry.ts`（`detectProjectAdapters` / `hasCommandArtifacts`）、`src/commands/editors/adapters/{pi,omp,dsh}.ts`、`src/commands/update.ts`、`src/commands/init.ts`、`src/commands/doctor.ts`
  - MCP 安装范围同步改「已授权编辑器」（原「检测到的编辑器」）；update 的前端 gate 静默跳过改为打印跳过说明行（对齐 init——修复「update 后 MCP 没装也没有任何解释」的排查黑洞）
  - `tests/update.test.ts`、`tests/update.standards.test.ts`（重写为新签名 + 标记即领土用例）、`tests/init.test.ts`、`tests/editors-tools.test.ts`、`tests/commands/doctor.test.ts`
  - `README.md`、`README.zh-CN.md`

## [0.3.75] - 2026-08-27
### Added
- **MCP 收敛为官方 test-runner server（playwright-test）**. MCP 收敛为单个官方 `playwright-test` server，uninstall 清历史条目，doctor 检查更新。
  - `src/shared/mcp.ts`、`src/shared/index.ts`、`src/commands/init.ts`、`src/commands/update.ts`、`src/commands/uninstall.ts`、`src/commands/doctor.ts`
  - `templates/e2e-command.md`
  - `tests/shared/mcp.test.ts`（+4）、`tests/init-mcp-scope.test.ts`（单 server 收敛 2 用例）、`tests/update.test.ts`（+1 源码守卫）、`tests/commands/uninstall.test.ts`（+2）、`tests/commands/doctor.test.ts`（镜像同步 +4）
  - `README.md`、`README.zh-CN.md`

### Changed
- **清理死代码（review 修复）**. 删除无调用者的 MCP helper 与测试块。
  - `src/shared/mcp.ts`、`src/shared/index.ts`、`tests/shared/mcp.test.ts`
- **CLAUDE.md CodeGraph 优先块措辞再优化**. CodeGraph 块改祈使句，8 个语义点保留。
  - `src/commands/editors/project-rules.ts`
- **employee-standards §0 约定下新增 OpenSpec 命令帮助行**. §0 补 OpenSpec 帮助命令行，锚 +2。
  - `employee-standards.md`、`docs/script.js`、`tests/docs-sync.test.ts`

## [0.3.74] - 2026-08-24
### Changed
- **`editors.ts` 拆分为 `editors/` 目录（纯重构，行为不变）**. `editors.ts` 拆为 `editors/` 目录，保留薄门面使 import 零改动。
  - `src/commands/editors.ts` — 1279 行 → 119 行门面
  - `src/commands/editors/` — 新增 12 个文件，最大 project-rules.ts 313 行
  - 第 N 个编辑器的新增模式定型：新增 adapters/<editor>.ts + registry 注册顺序一处
- **CI verify 矩阵扩展至三平台**. CI verify 扩到三平台 4 jobs，修 27 个 Windows 测试可移植性问题。
  - `.github/workflows/ci.yml`、8 个测试文件
- **依赖刷新 + build 脚本可移植化**. 依赖全量 in-range 升级，build 脚本改 Node 实现以兼容 Windows。
  - `package.json`、`package-lock.json`

### Added
- **`audit` / `update` 测试盲点清剿**. 补 audit / update 主函数测试，覆盖率缺口收窄。
- **`syncEmployeeStandards` 导出**（一行可见性变更）. 导出 `syncEmployeeStandards` 以便直测，无行为影响。
  - `src/commands/update.ts` — `function syncEmployeeStandards` → `export function syncEmployeeStandards`
  - `tests/commands/audit.main.test.ts`（新增）、`tests/commands/audit.test.ts`（+2）、`tests/update.standards.test.ts`（新增）

## [0.3.73] - 2026-08-19
### Added
- **`init` / `update` 末尾新增 CodeGraph 索引同步提示**. init/update 末尾按缺口提示 `codegraph sync` / `install`。
  - `src/commands/init.ts` — codegraph 提示块扩展 `else if` 分支
  - `src/commands/update.ts` — Summary 末尾（Restart 提示后）追加 codegraph 提示
- **`doctor` 新增 CodeGraph 检查项 + `init`/`update` 提示缺口化 + `uninstall` 清理提示**. doctor 新增 CodeGraph 三项检查，四个命令共用检测模块。
  - `src/shared/codegraph.ts`（新增）、`src/shared/index.ts`
  - `src/commands/doctor.ts`、`src/commands/init.ts`、`src/commands/update.ts`、`src/commands/uninstall.ts`
  - `tests/shared/codegraph.test.ts`（新增）、`tests/commands/doctor.test.ts`、`tests/init.test.ts`、`tests/update.test.ts`、`tests/commands/uninstall.test.ts`
- **CLAUDE.md 工作流提示**. CLAUDE.md wrapper 补「优先用 OpenSpec 工作流」提示。
  - `src/commands/editors.ts`
- **CLAUDE.md CodeGraph 优先块文案精简**. CodeGraph 块压到约 100 字，语义点不变。
  - `src/commands/editors.ts`

## [0.3.72] - 2026-08-18
### Changed
- **employee-standards 删除 §2 上下文管理**. 删除 §2 上下文管理整节，后续章节重编号并同步交叉引用；章节计数 8→7。
  - `employee-standards.md`、`docs/script.js`、`tests/docs-sync.test.ts`
- **`editors.ts` 引入 `defineAdapter` 工厂**. 7 个适配器改用 `defineAdapter` 工厂，行为不变，可读性提升。
  - `src/commands/editors.ts` — 新增 `EditorAdapterInit` interface + `defineAdapter` 函数；7 个适配器重写
- **`coverage` 末尾补 `checkForUpdate`**. `coverage` 末尾补 `checkForUpdate`，与其余交互命令对齐；`flake` 故意不加。
  - `src/index.ts` — `coverage` action 末尾追加 `await checkForUpdate(pkg.version);`；`flake` 注释说明跳过原因

### Added
- **`migrate.ts` 单测补全**. 132 行迁移函数补 7 个用例覆盖全部分支。
  - `tests/commands/migrate.test.ts`（新增 7 用例）

### Fixed
- **`docs/index.html` quickstart 第 03 步命令漂移修复**. quickstart 命令补 `--scope project` 并标为可选。
  - `docs/index.html` — quickstart 第 03 步命令 + label 改"可选" + 小字注释

## [0.3.71] - 2026-08-18
### Added
- **`openspec-pw init` 无前端项目引导提示**. 无前端信号时打印两行引导建议，不影响生成行为。
  - `src/shared/app-detect.ts` — 新增 `hasFrontendSignal`（`boolean | null`：null = 无 package.json 跳过检测），框架关键词常量与 `frameworkDefaultPort` 同模块并注释关系
  - `src/commands/init.ts` — 生成前检测 + Summary 提示（灰色，与 Next steps 同格式）
  - `tests/shared/app-detect.test.ts` / `tests/init.test.ts` — 信号匹配（含 vitest 不误命中、monorepo 下探）与提示输出用例
  - `README.md` / `README.zh-CN.md` — init 行为说明补充一行
- **`audit` / `explore` 的 BASE_URL 解析统一走 `detectAppServer` 检测链**. 两个命令统一走 `detectAppServer` 检测链，CLI 兜底字面量收敛到一处。
  - `src/commands/audit.ts` — `getSitemapRoutes(projectRoot)` 改用 `detectAppServer`（导出以便测试）
  - `src/commands/explore.ts` — `parseExplorationFile` 导出 + `baseUrl?: string`；新增导出 `resolveExploreBaseUrl`
  - `tests/commands/audit.test.ts`（新增 4 用例）、`tests/commands/explore.test.ts`（新增 6 用例）——两命令首次测试覆盖
  - `openspec/specs/cli/base-url/spec.md` — 新增 capability 契约（env > 文件 > 检测 > 兜底）
- **Playwright MCP 仅在有前端信号时自动安装**. MCP 仅在前端信号为真时自动安装，纯 API 项目跳过并说明。
  - `src/commands/init.ts` — `frontendSignal` 上移 + MCP 步骤 gate + 跳过说明
  - `tests/init-mcp-scope.test.ts` — fixtures 补前端信号 package.json；新增 gating 用例 3 个（纯 API 跳过 / 无 package.json 跳过 / 前端照装）
  - `README.md` / `README.zh-CN.md` — MCP 段落补充"检测到前端信号时自动安装"
- **Deploy Docs 工作流双站部署**. Pages 部署后追加 Cloudflare Pages 直传，secrets 未配置时跳过。
  - `.github/workflows/pages.yml`

### Fixed
- **release 脚本 badge commit message 版本号取旧值**. 版本号改为动态读取，commit message 不再显示旧版本。
- **新增 `deploy:docs` 脚本固定 wrangler 版本**. 固定 `wrangler@4.119.0` 恢复 OAuth 部署。
  - `package.json`
- **CLAUDE.md 为 symlink 时 init/update 覆盖 AGENTS.md 标准**. CLAUDE.md 为 symlink 时跳过写入，避免覆盖 AGENTS.md。
  - `src/commands/editors.ts`、`src/commands/update.ts`、`src/commands/doctor.ts`
  - `tests/editors.test.ts` — symlink 场景 2 用例（skip on win32）+ update/doctor 源码守卫 2 用例
- **`--no-skill` 不再静默跳过标准漂移检查**. `--no-skill` 只跳过命令/模板安装，标准同步照常执行。
  - `src/commands/update.ts`
- **docs/script.js 内嵌标准一致性测试**. 新增 16 个锚点用例，内嵌副本漂移即失败。
  - `tests/docs-sync.test.ts`
- **release 自动归档 CHANGELOG**. release 自动把 `[Unreleased]` 归档为版本段。
  - `scripts/bump-docs.js`、`package.json`
- **doctor 检出旧版全局 playwright MCP 残留**. doctor 检出全局残留并给出清理命令。
  - `src/commands/doctor.ts`

## [0.3.69] - 2026-08-17

### Added
- **`openspec-pw init --tools` 编辑器选择（补回）**. `--tools` 编辑器选择恢复：all / none / 列表与 TTY 多选，非 TTY 回退检测。
  - `src/index.ts` — `init` 命令注册 `--tools`；action 捕获 init 抛错打印并 `exit(1)`
  - `src/commands/editors.ts` — `resolveToolsArg` 纯函数与 `getAllAdapters()`；`installCommand` 自动建目录使未检测编辑器可装
  - `src/commands/init.ts` — `InitOptions.tools`、`InitDeps`（prompt/isTTY/homeDir 注入）、`promptSelectEditors`；移除 `detected.length === 0` 提前 return
  - `package.json` — 新增依赖 `@inquirer/prompts`
  - `tests/editors-tools.test.ts`、`tests/init.test.ts` — `resolveToolsArg` 13 个用例 + `--tools` 分支/交互注入共 10 个用例
  - `README.md` / `README.zh-CN.md` —「Selecting Editors on Init / 初始化时选择编辑器」一节
- **Claude Code 的 Playwright MCP 改为 project scope**. Claude Code MCP 改项目级（写 `.mcp.json`），不再碰全局配置。
  - `src/commands/editors.ts` — `claudeAdapter` 三方法（`isMcpInstalled`/`installMcp`/`removeMcp`）；删除废弃的 `claudeMcpOutputIncludes`
  - `src/commands/init.ts` — MCP 安装失败时手动命令提示含 `--scope project`，并提示旧 CLI 升级
  - `tests/editors-claude-mcp.test.ts`（新增 6 用例）、`tests/init-mcp-scope.test.ts`（新增 2 用例）、`tests/shared/mcp.test.ts`、`tests/commands/doctor.test.ts`、`tests/commands/uninstall.test.ts` — 全部按文件读取行为重写
  - `README.md` / `README.zh-CN.md` — MCP 段落 + 迁移说明 + First-Time Setup 表；编辑器计数适配 dsh（6→7）

### Fixed
- **`--tools` 帮助文本遗漏 `dsh`**. 帮助文本补 `dsh`。
  - `src/index.ts`

## [0.3.68] - 2026-08-16

### Added
- **DeepSeek Harness (dsh) 支持**. 新增 dsh 适配器（skill 形态，无 MCP），编辑器扩为 7 个。
  - `src/commands/editors.ts` — `EditorId` 扩为 7 个、`hasDsh` / `formatDshCommand` / `getDshCommandPath` / `dshAdapter`
  - `src/commands/init.ts` / `doctor.ts` / `update.ts` — 检测列表、无编辑器提示、`hasCommand` 判定同步 dsh skill 路径
  - `tests/editors.test.ts` — 新增 dsh 用例；既有 detectAdapters 全量用例扩为 7 个
  - `README.md` / `README.zh-CN.md` — 编辑器支持、init 检测、doctor 表、架构树同步

## [0.3.67] - 2026-08-12

### Added
- **`openspec-pw init --tools` 编辑器选择**. 新增 `--tools` 编辑器选择（all / none / 列表 + TTY 多选），非 TTY 回退检测。
  - `src/index.ts` — `init` 命令注册 `--tools`；action 捕获 init 抛错打印并 `exit(1)`（原未知 id 场景 exit 0）
  - `src/commands/editors.ts` — 新增 `resolveToolsArg` 纯函数与 `getAllAdapters()`；`installCommand` 已自动建目录使未检测编辑器可装
  - `src/commands/init.ts` — `InitOptions.tools`、`InitDeps`（prompt/isTTY/homeDir 注入）、`promptSelectEditors`；移除 `detected.length === 0` 提前 return（原 0 检测连脚手架都不生成）
  - `package.json` — 新增依赖 `@inquirer/prompts`
  - `tests/editors-tools.test.ts` — `resolveToolsArg` 13 个用例；`tests/init.test.ts` — `--tools` 分支 + 交互注入共 10 个用例
  - `README.md` / `README.zh-CN.md` — CLI 注释、Usage「Selecting Editors on Init / 初始化时选择编辑器」一节

### Changed
- **employee-standards 新增「工具调用纪律（防循环）」**. §3 补工具调用防循环纪律。
- **init/update 对裸 `@AGENTS.md` 的 CLAUDE.md 加提示**. 裸 `@AGENTS.md` 时提示可删除该行重跑 update。
  - `src/commands/editors.ts` — `installClaudeWrapper` 裸导入分支
  - `src/commands/update.ts` — standards 相位漂移检查

### Fixed
- **release 脚本 commit message 变量未展开**. 单引号改双引号，commit message 变量正常展开。
  - `package.json`

## [0.3.66] - 2026-08-11

### Added
- **Pi 与 Oh My Pi (omp) 支持**. 新增 Pi / omp 适配器，编辑器扩为 6 个。
  - `src/commands/editors.ts` — `EditorId` 扩为 6 个、接口新增 `supportsMcp`、Pi / omp 适配器
  - `src/shared/mcp.ts` — `supportsMcp:false` 的适配器跳过全部 MCP 相位（Pi 无 MCP 客户端，探索走 `openspec-pw explore`）
  - `src/commands/doctor.ts` — MCP 分类对 Pi 记录 `ok:true` 信息性检查（不阻断 exit code）
  - `tests/editors.test.ts` — 新增 21 个 pi/omp 用例；既有 detectAdapters 用例注入 fake home 防环境依赖
  - `README.md` / `README.zh-CN.md` — 编辑器支持、init 检测、doctor 表、架构树同步

### Changed
- **CLAUDE.md wrapper 沉淀官方依据**. JSDoc 与 README 记录 `@AGENTS.md` 的官方加载依据。
  - `src/commands/editors.ts` — `claudeWrapperStandardsContent` JSDoc 记录契约
  - `README.md` / `README.zh-CN.md` — AGENTS.md 加载机制补充官方依据

## [0.3.65] - 2026-08-08

### Added
- **docs 网页版内嵌标准同步**. 内嵌副本补齐两条 🔴 并删残留行。
  - `docs/script.js`
- **employee-standards 补齐 6 条工程选型/架构原则**. §1/§4 补 6 条选型与架构原则，其中 3 条 🔴。
  - `employee-standards.md`

### Changed
- **employee-standards 收敛去重**. §2/§3/§5 重复规则改为单一事实源。

## [0.3.64] - 2026-08-06

### Added
- **`openspec-pw doctor` Sync 分类**. doctor 新增 Sync 分类，检测标记段与模板漂移，未初始化项目不阻断。
  - `src/shared/drift.ts` — 新增纯函数（提取 OPENSPEC 段、内容相等比较、定位本地已装包模板，零网络）
  - `src/commands/doctor.ts` — 新增 Sync 分类 + 初始化闸门
- **employee-standards.md 新增 §7「浏览器验证证据链」**. 新增 §7 浏览器验证证据链，明确证据标准与提交前实跑。
  - `employee-standards.md`、`docs/script.js`（ZH + EN 内嵌标准）

### Changed
- **`openspec-pw update` 改为漂移感知**. update 先比较内容，一致时 no-op，不一致才覆盖并提示。
  - `src/commands/update.ts` — standards/commands 相位漂移判断
  - `src/commands/editors.ts` — 新增 `readOpenSpecBlock` / `blockMatchesExpected`，导出 `claudeWrapperStandardsContent`
  - `tests/drift.test.ts` — 新增纯函数测试；`tests/update.test.ts` / `tests/editors.test.ts` / `tests/doctor.test.ts` 扩展

### Fixed
- **`--no-mcp` 未注册 bug**. 补注册 `--no-mcp` 并在自重启时转发。
- **漂移判断边缘情况（code review 确认 7 个 bug）**. 修 7 个漂移判断 bug（CRLF、单边 marker、无 marker 等）。
  - `src/shared/drift.ts`、`src/commands/editors.ts`、`src/commands/update.ts`、`src/commands/doctor.ts`

## [0.3.63] - 2026-08-05

### Changed
- **CodeGraph 规则升级为「默认第一步」**. CodeGraph 规则升级为默认第一步，并写入 CLAUDE.md。

## [0.3.62] - 2026-08-05

### Changed
- **CodeGraph 优先规则改为引导式，不再禁止内置工具**. 规则改为引导式，不再禁止内置工具。

## [0.3.61] - 2026-08-05

### Added
- **CodeGraph 优先规则置顶员工标准**. 新增文首 CodeGraph 优先节，§4 改为引用。
- **移除 §3 架构 Invariants**. 删除项目特定 Invariants 节并重编号。

## [0.3.60] - 2026-07-31

### Added
- **Cursor editor support**. `openspec-pw init` auto-detects Cursor (`.cursor/` directory) alongside Claude Code, OpenCode, and Cline.
  - Dual install: `.cursor/commands/opsx-e2e.md` (plain markdown, `$1` change name) + `.cursor/skills/opsx-e2e/SKILL.md` (`disable-model-invocation: true`)
  - Playwright MCP merged into `.cursor/mcp.json` (`mcpServers.playwright`); shared `mcpServers` JSON helpers also used by Cline
  - `EditorAdapter.extraArtifacts` so install/uninstall/doctor share a dual-file contract
  - `doctor` reports Cursor command + skill readiness; `update` `hasCommand` recognizes Cursor paths
  - `README.md`, `README.zh-CN.md` — Cursor usage, prerequisites, architecture
  - `docs/index.html`, `docs/style-sections.css`, `docs/llms.txt` — Editors section (four assistants), hero/prereq/workflow copy, 2×2 grid
  - `package.json` — description + keywords updated for multi-editor support

## [0.3.59] - 2026-07-31

### Added
- **Cline editor support**. `openspec-pw init` now auto-detects Cline (`.cline/` or `.clinerules/`) and installs the `/opsx-e2e` skill and Playwright MCP.
  - `src/commands/editors.ts` — new `clineAdapter` (id `"cline"`), `formatClineCommand`, `getClineCommandPath`, `hasCline`; `.cline/mcp.json` read/write helpers; registered in adapter registry
  - `src/commands/init.ts` — detection prompt and MCP error messages updated for three editors
  - `src/commands/update.ts` — `hasCommand` check includes `.cline/skills/opsx-e2e/SKILL.md`
  - `src/commands/doctor.ts` — fallback hint lists all three editors
  - Cline conventions: skill at `.cline/skills/opsx-e2e/SKILL.md` (YAML frontmatter `name`+`description`, body rewritten `/opsx:`→`/opsx-`), MCP at `.cline/mcp.json` (`mcpServers` structure), `AGENTS.md` auto-detected natively (no wrapper file)
  - `tests/editors.test.ts` — 25 new Cline tests (adapter metadata, detection, command path/format, MCP CRUD, installCommand)
  - `tests/smoke.test.ts` — Cline added to `installCommand` and dist-exports checks
  - `README.md`, `README.zh-CN.md` — Cline added to supported editors, usage, prerequisites, architecture diagram

## [0.3.57] - 2026-07-16

### Changed
- **`openspec-pw doctor` checks expanded by 5 items.** Adds checks for Playwright config, browsers, specs, tests directory and Node engines.
  - **Playwright Config** — verifies `playwright.config.ts/.js/.mjs/.mts` exists (required; missing blocks all tests)
  - **Playwright Browsers** — verifies Chromium binary is downloaded via `playwright.chromium.executablePath()` (required; CLI may be installed while browsers are not)
  - **OpenSpec Specs** — counts `.spec.md` files in `openspec/` (optional warning; empty directory is valid for fresh projects)
  - **Tests Directory** — verifies `tests/playwright/` directory exists (required; missing means no test files can be generated)
  - **Node.js Engines** — validates current Node version against `package.json` `engines.node` (optional warning; mismatches cause cryptic runtime errors)
  - `src/commands/doctor.ts` — new checks, `OPTIONAL_NAMES` set for precise required/optional classification
  - `tests/commands/doctor.test.ts` — 7 new test cases covering all new items (225 total)
  - `README.md` — updated doctor CLI description to list covered areas

## [0.3.56] - 2026-07-12

### Removed
- **`init --seed` flag removed (BREAKING)**. Removed `--seed`; re-run init after deleting `seed.spec.ts` achieves the same.
  - `src/index.ts` — removed `--seed` option
  - `src/commands/init.ts` — removed `seed` from `InitOptions` and `generateSeedTest` `force` parameter
  - `README.md`, `README.zh-CN.md` — removed `--seed` from CLI description
- **`openspec-pw run <name>` command removed (BREAKING)**. Removed the never-validated `run` command; users run `npx playwright test` directly.
  - `src/commands/run.ts` — deleted (346 lines)
  - `src/index.ts` — removed command registration
  - `src/commands/migrate.ts` — updated verify hint to point at `/opsx:e2e` instead of `openspec-pw run`
  - `src/commands/init.ts` — removed `openspec-pw run` line from install summary
  - `templates/github-workflow.yml` — CI now calls `npx playwright test` directly
  - `templates/e2e-command.md` — Step 9 now documents `npx playwright test`
  - `templates/playwright.config.ts` — comment updated to reference `/opsx:e2e Healer`
  - `tests/run.test.ts`, `tests/commands/run.test.ts` — deleted
  - `tests/smoke.test.ts` — removed `run` import, `--help` check, `run --help` test, and `dist/commands/run.js` from critical-package-files list
  - `README.md`, `README.zh-CN.md` — removed from CLI list and Architecture tree
  - `docs/llms.txt` — removed from command list

### Changed
- **Docs site: removed decorative clutter**. Removed two hero background decoration layers.
  - `docs/index.html`, `docs/style-base.css` — removed two decoration layers
- **Docs site: removed hero CLI demo**. Removed the fabricated CLI transcript from the hero.
  - `docs/index.html`, `docs/style-sections.css` — removed `.cli-demo` block (124 lines)

## [0.3.55] - 2026-07-12

### Changed
- **Employee standards: frontend UI design trio**. Added the frontend-design / ui-ux-pro-max / web-design-guidelines skill trio to §4.
  - `employee-standards.md` — new 🟡 rule
  - `docs/script.js` — ZH + EN templates synced
- **Employee standards: agent-reach priority upgraded**. Promoted `agent-reach` to 🟡 in §4.
  - `employee-standards.md`, `docs/script.js` — synced

## [0.3.52] - 2026-07-06

### Fixed
- **`openspec-pw update`: AGENTS.md not created on first run after upgrade**. After the CLI update, update re-executes the freshly installed binary so post-CLI steps use the latest code.
  - `src/commands/update.ts` — re-execution block after CLI update

### Changed
- **CI: 1500-line max per source file**. CI fails when a scanned source file exceeds 1500 lines.
- **Deploy Docs auto-retry**. Pages deploy retries transient failures via `gh api` and re-triggers the workflow.
  - `.github/workflows/pages.yml` — `continue-on-error` + retry step (env-var based, no Actions injection)
- **Employee-grade standards: 1500-line rule**. Added to `employee-standards.md` §1 and the `docs/script.js` CLAUDE.md templates (ZH + EN).

### Added
- **Tests for `cleanProjectRules`**. Added 9 unit tests covering cleaning, idempotency, CRLF, and no-op cases.
  - `tests/editors.test.ts` — 233 → 242 tests

## [0.3.51] - 2026-07-05

### Changed
- **`editors.ts`: AGENTS.md becomes the standards SSOT**. CLAUDE.md becomes a thin `@AGENTS.md` wrapper; `opencode.jsonc` registers AGENTS.md; old-format CLAUDE.md migrates on install.
  - `src/commands/editors.ts` — `installProjectRules` rewritten; new `installClaudeWrapper`; `installProjectClaudeMd` renamed to `installOpenSpecBlock`; `cleanProjectRules` extracted to `removeMarkersFromFile`

### Fixed
- `installOpenSpecBlock`: trim `standardsContent` in create/append paths (was only trimmed in update path) — eliminates double blank lines around the `@AGENTS.md` wrapper
- `removeMarkersFromFile`: restore `\s*` capture + `\n{3,}` collapse so cleaned files don't accumulate 3+ blank lines around the removed block
- `installClaudeWrapper`: support CRLF line endings (`@AGENTS.md\r`) so the no-op guard works on Windows-authored CLAUDE.md
- `cleanProjectRules`: use `adapter.projectRulesPath` instead of hardcoding `CLAUDE.md`

## [0.3.50] - 2026-07-05

### Added
- **Cloudflare Web Analytics** on the docs site. Adds a deferred beacon script with SRI hash + `crossorigin="anonymous"` to `docs/index.html`. No cookies, no PII.
  - `docs/index.html` — `<script data-cf-beacon>` in `<head>`

## [0.3.49] - 2026-07-05

### Added
- **AI Coding Assistants section** on the docs site — Claude Code and OpenCode side-by-side, each with icon, command and feature list. Nav gains an "Editors" link.
- **Artistic background layers** on the docs site: film grain, Vercel-style grid, aurora gradient, amber glow and an animated 4-blob mesh gradient.
- **Stripe/Cursor-grade design polish** on the docs site: 500-weight display type, tabular numerals, glassmorphism cards, hairline borders, magnetic CTA, scroll reveal, shimmer hover.
- **Split `docs/index.html`** into `index.html` + `style-base.css` + `style-sections.css` + `style-extra.css` + `script.js`. GitHub Pages compatible.
- **`agent-reach` rule** added to `employee-standards.md` §4 and both `docs/script.js` CLAUDE.md templates: prefer `agent-reach` skill for web research to avoid WebFetch/WebSearch anti-bot blocks.

### Fixed
- 8 stale `max-width: 1160px` values upgraded to `1200px` for consistency with the new layout width.
- Duplicate `.section` CSS rule removed (was defined in both `style-base.css` and `style-sections.css`).
- gstack references fully removed from active files (only CHANGELOG historical entries remain).

## [0.3.48] - 2026-07-04

### Changed
- **Lazy CLI startup** continued: command modules loaded via dynamic `import()` on first use. `--help` loads only `commander`.

### Fixed
- README "How It Works" closed an unclosed code block and escaped a pipe in a template table; inline comments moved after code to avoid heading-like rendering.

## [0.3.47] - 2026-07-04

### Added
- **Temp file management rule** (`employee-standards.md` §7): non-source temp files go in `tmp/` at the project root, with timestamped names; mirrored into the ZH/EN templates.
  - `employee-standards.md` — new §7
  - `.gitignore` — `tmp/` ignored, `tmp/.gitkeep` tracked
  - `docs/script.js` — CLAUDE_MD_ZH + CLAUDE_MD_EN

## [0.3.46] - 2026-07-01

### Added
- **`openspec-pw coverage [change-name]`**: new command for spec–test coverage analysis. Reports per-change coverage, uncovered scenarios, orphaned tests and recommendations; supports `--json`.
  - `src/commands/coverage.ts` — core analysis (scenario parsing, test case parsing, L1-L5 matching, route extraction, report rendering)
  - `src/index.ts` — registered as lazy-imported command
- **`openspec-pw flake [change-name]`**: new command for flake detection. Detects networkidle, late route registration, storageState leakage and conflicting scopes; supports `--json` and `--gate`.
  - `src/commands/flake.ts` — core detection (regex, line-ordering, and heuristic analyzers)
  - `tests/commands/flake.test.ts` — 25 unit tests covering all detectors and report helpers

### Fixed
- `openspec list --json` returns `{"changes": [...]}` format in openspec v1.4.1; `getChangeNames` in both `audit` and `coverage` commands now handles the wrapped format in addition to the legacy formats
- `/opsx-e2e` not responding in OpenCode: compressed `e2e-command.md` template from 1173 to 313 lines (75%); the 65KB template exceeded OpenCode's config output size limit, causing the command to register silently but never match. Simplified structure with all decision logic, Healer phases, and guards preserved.

### Changed
- **CLI startup time reduced 93%**: command modules load via dynamic `import()` in action handlers; `--help` loads only `commander` (~0.17s vs ~2.3s). ESM cache removes repeat-call overhead.

## [0.3.45] - 2026-06-30

### Fixed
- `openspec-pw explore`: `## Exploration Failures` section in `app-exploration.md` is now replaced on re-run instead of duplicated (stale tables on every invocation).

### Changed
- `openspec-pw doctor`: Node < 22 reports `⚠ Node < 22 deprecated by GitHub Actions; recommend Node 22+` inline.
- `openspec-pw audit`: when sitemap fetch fails or no `BASE_URL` is set, an explicit note is shown explaining the route coverage check was skipped (previously silent skip).
- `openspec-pw explore`: dropped the fake "worker N" abstraction; routes now run sequentially in a single browser with honest output. `--parallel` flag is kept for backward compat but ignored.

## [0.3.44] - 2026-06-29

### Added
- **App server auto-detection**: generated `playwright.config.ts` detects `BASE_URL` from env, package script, Vite config, `.env*` and framework defaults.
- **Doctor app diagnostics**: `openspec-pw doctor` now reports detected dev script, detected base URL, and a non-blocking reachability check so `webServer` timeouts are easier to diagnose.
- **Existing config patch hints**: `openspec-pw init` now prints recommended checks when `playwright.config.ts` already exists instead of silently skipping all config guidance.
- **OpenCode support** (SST): auto-detected during `init` when `.opencode/` exists; installs `/opsx-e2e <change-name>` at `.opencode/commands/opsx-e2e.md`, with `/opsx:` rewritten to `/opsx-`.
- **EditorAdapter pattern**: multi-editor architecture with `claudeAdapter` and `opencodeAdapter`; future editors need only a new adapter.
- **Project rules routing**: `installProjectRules` writes standards to `CLAUDE.md` (Claude Code or both editors) or `AGENTS.md` (OpenCode only), and sets `opencode.jsonc.instructions`.

### Changed
- `seed.spec.ts` and `pages/BasePage.ts` now use Playwright `use.baseURL` when `BASE_URL` env is unset, so auto-detected ports work without duplicating the URL in every generated test helper.
- Internal TypeScript API change: `isPlaywrightMcpInstalled` / `ensurePlaywrightMcp` / `removePlaywrightMcp` now take an `EditorAdapter` first argument. This affects source consumers only; CLI behavior is unchanged.
- Added `jsonc-parser` for safe `opencode.jsonc` editing (preserves comments and formatting while merging MCP + `instructions` entries).

## [0.3.35] - 2026-06-10

### Added
- **Version update hint**: CLI checks npm once per 24 hours and prints a one-line upgrade hint.
### Changed
- **Unified `execFile` style**: replaced remaining `execSync` calls with `execFileSync` + args + `needsShell`.

### Fixed
- **Removed redundant `bin/openspec-pw` shell wrapper**: removed the wrapper that caused npm publish warnings.

## [0.3.34] - 2026-06-09

### Fixed
- **Windows: `spawn EINVAL`** — fixed by `shell: true` instead of a `.cmd` suffix.

## [0.3.33] - 2026-06-09

### Fixed
- **Windows: `spawn npm ENOENT`** — added cross-platform `needsShell` and applied it to all `execFile` calls.
- `src/commands/update.ts`: pass npm paths as arg arrays, bind `err` in every catch, add version-shadow self-check.
- `src/commands/init.ts`, `src/commands/doctor.ts`: migrated `npx ... --version` calls to `execFileSync` with arg arrays.
- Documentation install commands: all install references pinned to `@latest`.

### Changed
- `openspec-pw init`: removed `--no-seed` (breaking for scripts that pass it); use `--seed` or delete the seed file.
- gstack is no longer a hard prerequisite; docs list it as optional.
- `templates/e2e-command.md` rewritten to be tool-agnostic; removed gstack-specific shell calls.
- `employee-standards.md` §0 was tightened: removed the redundant E2E prerequisite line.

## [0.3.31] - 2026-06-04

### Fixed
- `docs/index.html`: fixed the "1 安装步骤" badge selector leak.
- `docs/index.html`: re-centered the `CLAUDE.md 一键配置` section header.
- `docs/`: removed stale `vision-check`, added `run` and `explore` to CLI lists, tightened `doctor` description.
- `package.json`: release now commits the badge update.
- `.gitignore`: fixed workflow un-ignore rules so `.github/workflows/ci.yml` is tracked.

### Changed
- `docs/index.html`: a11y + SEO pass; Lighthouse 90/100/80/50 → 100/100/100/100.
- `docs/index.html`: hero card replaced with a 4-KPI dashboard.
- `docs/index.html`: quickstart terminal now shows the real install sequence.
- `docs/index.html`: GitHub button gained the octocat icon.
- `docs/index.html`: spacing pass.
- `docs/index.html`: synced the `config.yaml` rule into the one-click template.
- `.github/workflows/`: opted into Node 24 action runtime ahead of the Node 20 deprecation.

## [0.3.30] - 2026-06-04

### Changed
- Migrated E2E command content from `.claude/skills/openspec-e2e/SKILL.md` to `templates/e2e-command.md` — `init` and `update` now read from the template instead of the deleted SKILL file
- Removed `installSkillTemplates`, `syncSkillTemplates`, `installSkill`, `extractSkillBody` — all SKILL-related dead code
- `update`: command content now read from `templates/e2e-command.md` in tarball instead of SKILL.md
- `update`: init detection now checks `.claude/commands/opsx/e2e.md` instead of SKILL.md
- `uninstall`: legacy skill directory removal labeled as backward-compat cleanup
- `employee-standards.md`: restructured into 6 sections (§0–§5), 127 → 81 lines
  - §0 Applicability (new): project config entry + E2E toolchain prereqs
  - §1 Code Quality (was §2): folded `lint:fix` tip from "Error Handling" into "every step has verifiable exit criteria"
  - §2 Context Management (was §3): added "no cross-change edits" sub-rule; condensed "OpenSpec phase isolation" (3 sentences → 1)
  - §3 Large-Scale Tasks (was §4): tightened 200-line gate from "prefer" to "must"
  - §4 Tool Constraints & Edit Safety (was §5): condensed "Security" spec to 3 AI-behavior rules (secrets + placeholders + log hygiene)
  - §5 Production Workflow (was §6): collapsed 8-step diagram to 1-line chain; `/ship → /retro` replaced with `/opsx:archive`
- `employee-standards.md`: removed "§1 Browser Constraints" — Chrome MCP is also a valid browser tool, no longer mandating gstack
- `docs/index.html`: synced webpage CLAUDE.md one-click config to new file content
  - Removed `## 错误处理指导` section
  - Condensed `## 安全规范` (secrets + placeholders + log hygiene)
  - Added `lint:fix` hint to `## 代码质量`
  - `## 大规模任务` "尽量使用" → "必须走" + added `(/opsx:propose)` + "禁止直接修改"
  - Added `## 安全规范` to JS const `CLAUDE_MD_ZH` (the version users actually see at runtime)

### Removed
- `.claude/skills/openspec-e2e/` directory — no longer shipped or installed
- `src/commands/mcpSync.ts` — dead code (SKILL.md sync, never called after removal)
- Related test cases for removed functions

## [0.3.24] - 2026-04-22

### Fixed
- `vision-check`: `analyzeScreenshot` API body now uses `effectivePrompt` consistently (was redundantly recomputing `selectVisionPrompt`)
- `vision-check`: HTML report screenshot path extraction uses `basename()` instead of `split("/").pop()` — fixes Windows compatibility
- `vision-check`: `screenshotHash` now computed once in `analyzeScreenshot` and passed to cache functions (was reading file 3x)
- `vision-check`: `DIFF_PROMPT` hardcoded Chinese → now has ZH/EN versions selected by model name (matching `VISION_PROMPT` behavior)
- `vision-check`: HTML report deduplicates same-name screenshots with sequential suffix; diff file lookup uses original basename (not deduplicated name)
- `vision-check`: `saveBaseline` viewport mode now includes viewport name in filename (`dashboard-mobile-baseline.png` vs `dashboard-baseline.png`); diff mode matching path updated accordingly
- `vision-check`: HTML report VLM output (element, description, position) now HTML-escaped to prevent potential XSS
- `vision-check`: Removed misleading "Auto-resize" comment in dimension mismatch path (code does not resize)
- `ollama.ts`: Removed unused `PixelDiffRegion` interface

### Added
- `vision-check`: `--threshold` validation (0–1 range, exits with code 2 on invalid)
- `vision-check`: Pre-flight validation — exits with error if neither `--screenshots` nor `--url + --viewport` is provided
- `.gitignore`: Added `.openspec-pw/vision-cache/` to prevent cached VLM results from being committed

## [0.3.23] - 2026-04-22

### Fixed
- `employee-standards.md` Section 2: 静态验证改为语言检测——扫描项目根目录源码文件扩展名检测主语言（.py→ruff+mypy, .ts/.tsx→ESLint+tsc, .go→gofmt+vet），不依赖特定目录名或配置文件
- `employee-standards.md` Section 3 & 4.4: 统一引用"对应语言 lint + typecheck"，替代写死的 ESLint/tsc
- `employee-standards.md` Section 5: 新增"禁止脚本改文件"规则——修改源码只能使用内置编辑工具，格式化工具（ruff fmt、prettier）除外
- `employee-standards.md` Section 5: 搜索规则补充排除目录（node_modules/、vendor/、__pycache__ 等），调试依赖时除外
- `employee-standards.md` Section 6: E2E 步骤补充注——Healer 需要 Playwright 环境，非 Node.js 项目参考各自语言集成
- `.claude/skills/openspec-e2e/SKILL.md`: 明确 scope 为 Node.js + TypeScript + Playwright 项目；Step 4 前增加 gstack 可用性检查（不可用则 STOP 并提示安装）；Step 8 BASE_URL 检测扩展支持 Python (pyproject.toml/uvicorn) 和 Go (main.go/.env)

### Added
- `employee-standards.md` Section 3: Add **上下文压缩恢复后** rule — after context compression in Apply phase, must check `git status` and re-read `proposal.md` + `tasks.md` before continuing

## [0.3.22] - 2026-04-22

### Changed
- `employee-standards.md` Section 4: Restructured implementation phase with 4 new subsections:
  - **4.1 变更边界检查**: Before/during/after scope validation against proposal.md
  - **4.2 任务类型区分**: Build/Verify/Dependent task completion criteria
  - **4.3 依赖链检查**: Check predecessor status before marking dependent tasks
  - **4.4 自动化 Gate**: Auto-run lint + typecheck, fail-fast
  - **4.5 Verify 强制化**: Must pass verify before marking complete
- Removed redundant "5. 自审" section (covered by 4.5)
- Renumbered workflow steps (removed old step 5, E2E now step 5)

## [0.3.19] - 2026-04-19

### Changed
- `employee-standards.md` Section 2: Refined code quality principles — "Surgical Changes" (only modify what's asked, clean up own mess), "Simplicity" (50-line solution in 50 lines, not 200), explicit search rule (Grep + Glob, scope defaults to all source types)
- `employee-standards.md` Section 5: Strengthened search rule — requires both content search (Grep) and filename search (Glob), scope defaults to all source types, explicit coverage of refactoring scenarios
- Clarified release flow: CI handles npm publish, local `npm publish` is forbidden

## [0.3.18] - 2026-04-17

### Fixed
- `package.json` bin: Changed from `./bin/openspec-pw` (Unix shell) to `./bin/openspec-pw.js` (Node.js) — fixes "The system cannot find the path specified" on Windows
- `bin/openspec-pw.js`: Added CWD preservation logic (save orig CWD → set env var → chdir to pkg root → restore on exit/SIGINT/SIGTERM) so `openspec-pw init` works correctly from user project directories on Windows

## [0.3.15] - 2026-04-16

### Added
- `src/utils/ollama.ts`: Vision Check config now reads from `tests/playwright/.env` (highest priority) and environment variables. No longer requires `app-knowledge.md` section.
- `src/utils/ollama.ts`: Enhanced VISION_PROMPT — adds QA engineer role, 2 new defect types (missing/incorrect), explicit exclusion rules, and clear severity definitions.
- `openspec-pw vision-check`: Three new capabilities:
  1. **Multi-viewport**: `--viewport mobile,tablet,desktop --url http://localhost:3000` captures and analyzes at multiple screen sizes
  2. **Pixel diff + baseline**: `--baseline` saves baseline screenshots; `--diff` compares with baseline using pixelmatch + VLM to detect semantic regressions
  3. **HTML report**: `--report <path>` generates a self-contained HTML report with embedded screenshots, anomaly summaries, and severity breakdown

### Fixed
- `src/utils/ollama.ts`: Fixed regex `\z` → `$` — JavaScript `\z` anchor never matches inside a lookahead
- `bin/openspec-pw`: Restore caller's working directory after node exits — `openspec-pw init --seed` now works correctly from user project directories
- `src/index.ts`: Read `OPENSPE_PW_CWD` env var and `chdir()` at startup to restore original CWD

## [0.3.14] - 2026-04-16

### Fixed
- `openspec-pw update`: Sync `openspec-playwright` in `devDependencies` when running from a project that has it as a local dependency

## [0.3.13] - 2026-04-16

### Changed
- `employee-standards.md` Section 2: Integrated LLM coding best practices — think before acting, goal-verification loops, refuse "good enough" code

## [0.3.12] - 2026-04-16

### Fixed
- `bin/openspec-pw`: Resolve symlinks to find real script location for global installs

## [0.3.11] - 2026-04-16

### Changed
- `bin/openspec-pw`: Correct CLI bin entry point to shell wrapper

## [0.3.10] - 2026-04-16

### Added
- Re-release of the vision-check feature set under the corrected version number after npm publish conflict
- `openspec-pw vision-check` command: Analyze screenshots for layout anomalies using Ollama VLM (Vision Language Model)
  - `--screenshots <pattern>` — Glob pattern or comma-separated list of screenshot paths (required)
  - `--parallel <n>` — Concurrent Ollama requests (default: 4)
  - `--severity <levels>` — Filter by severity: `blocking,warning,minor`
  - `--output <path>` — Write JSON results to file
  - `--dry-run` — List screenshots without analyzing
  - `--json` — Output JSON format
  - Exit codes: `0` = completed, `1` = Ollama unavailable (skip), `2` = disabled in config (skip)
- `src/utils/ollama.ts`: Ollama API wrapper with health check, batch analysis, and graceful degradation
- `openspec-pw doctor`: New "Vision Check" health check item — shows Ollama availability and configured vision model
- SKILL.md Step 4.5: Vision Check workflow — optional VLM-powered layout anomaly detection after exploration, before test generation
- `templates/app-exploration.md`: New "Visual Anomalies" section — auto-populated by `vision-check` command with de-duplication
- `templates/app-knowledge.md`: New "Vision Check Config" section — project-level Ollama configuration (url, model, enabled)

### Changed
- Vision Check configuration supports 2-tier priority: env vars (`OLLAMA_URL`, `OLLAMA_VISION_MODEL`) → `app-knowledge.md`. No config = disabled.
- Vision Check is optional and non-blocking — Ollama unavailable or disabled simply skips the check, workflow continues
- Added `glob` package for screenshot path resolution

## [0.3.8] - 2026-04-15

### Changed
- `.claude/skills/openspec-e2e/SKILL.md`: Require explicit `/opsx:e2e` or 'run E2E tests' trigger in SKILL.md description to prevent automatic invocation of E2E from other stages (explore/propose/apply/verify/continue).

## [0.3.7] - 2026-04-14

### Added
- `templates/global.teardown.ts`: Post-test cleanup template for database/file/cache/cache cleanup with project dependencies pattern (Playwright recommended approach)
- SKILL.md: New "Setup / Teardown" section with comparison table, implementation guidance, and teardown enablement instructions
- `playwright.config.ts`: Pre-configured teardown project (commented, ready to enable)
- README.md: Test Assets tree updated to include `global.teardown.ts`

### Fixed
- `employee-standards.md`: Removed reference to non-existent `/frontend-design` skill
- SKILL.md: Architecture section — clarified spec files are independent per change; added explicit opt-in warning for full regression
- SKILL.md: Title "Global Setup/Teardown" renamed to "Setup / Teardown" for accuracy
- `templates/playwright.config.ts`: Streamlined teardown comment block

### Changed
- `src/commands/init.ts`: `generateSeedTest`, `generateAppKnowledge`, `generateSharedPages`, `installSkillTemplates` now exported for use by other commands

## [0.3.6] - 2026-04-14

### Added
- SKILL.md v2.25: Complete Healer workflow redesign — Phase 1 Triage → Phase 2 Repair → Phase 3 Escalate replaces the original decision table
  - Phase 2 restructured into sub-steps: Phase 2-0 (batch diagnosis, no browser), Phase 2-1 (assertion fix with explicit EXPECTED vs ACTUAL comparison), Phase 2-5 (selector repair with stability ranking), Phase 2-5a/2-5b, Phase 2-6 (incremental per-test verify + targeted `--grep`), Phase 2-7 (logging with auto-de-duplicate)
  - **Phase 2-6 loop deadlock fixed**: failure type now routes to correct sub-step (assertion → Phase 2-1, selector → Phase 2-5, timeout → Flaky retry)
  - **Batch Detection**: multiple failing tests with same root cause now share one App Bug entry (not N bugs)
  - **Batch Detection Timeout handling**: now retry one isolated before labeling RAFT
  - **KNOWN_FIX shortcut**: Phase 2-0 diagnosis with `KNOWN_FIX=yes` jumps directly to Phase 2-6 using Selector Fixes table entry
  - **"same error pattern" rule**: Batch Detection now requires same root cause (console/network confirmed), not just same error type
  - **Phase 3 decision tree**: explicit 4-option (a/b/c/d) with per-choice actions and re-run instructions
  - **Global attempt guard**: per-test independent heal counter (≤3), no reset on Flaky retry
  - **Auto-de-duplicate** in Step 4.6 and Phase 2-7: composite keys prevent duplicate rows across multiple change runs
  - Graceful Degradation table: 4-column (Scenario / Classification / Action / Workflow Status)

### Fixed
- `src/commands/run.ts`: `--grep` + `--smoke` combined now correctly produces order-flexible AND pattern (all regex chars escaped)
- `templates/app-knowledge.md`: Added **Assertion Fixes** table; assertion modification guidance
- `templates/pages/BasePage.ts`: Timing fixes for React 19 concurrent mode
- `templates/playwright.config.ts`: storageState path now correctly resolves relative to cwd=projectRoot
- SKILL.md markdown: 7 instances of `| — |` fixed to `| --- |`
- SKILL.md selector priority corrected: `getByRole` > `getByLabel` > `getByPlaceholder` > `getByText` > `getByTestId`

## [0.3.4] - 2026-04-13

### Fixed
- `src/commands/editors.ts`: `installProjectClaudeMd` now replaces content inside OPENSPEC:START/END markers on every run (previously skipped if markers existed, leaving stale content forever)
- `openspec-pw update`: now syncs employee-grade standards to project CLAUDE.md alongside skill/commands/templates
- SKILL.md: removed space between `/` and command name in step tags
- Added `*.tgz` to `.gitignore`; removed stale tgz artifacts from repo root

### Added
- `scripts/bump-docs.js`: auto-updates version badge in `docs/index.html` on release
- `npm run release` now runs bump-docs.js before build/publish

## [0.3.2] - 2026-04-13

### Changed
- `employee-standards.md`: trim redundant content — removed Playwright MCP installation detail, "Claude Code auto-dispatch" boilerplate, arbitrary "3 edits max" rule, gstack skill enumeration, CSS audit code block, feedback loop table; streamlined workflow step descriptions; simplified title and header.

## [0.3.1] - 2026-04-12

### Added
- `openspec-pw explore` command: parallel route exploration with isolated Chromium workers, auth redirect detection, atomic writes, lock file, and signal cleanup.
- CLI: `openspec-pw run --smoke`, `-w/--workers <n>`, and `--grep` + `--smoke` AND pattern.
- SKILL.md Step 4.5: route snapshot hash to skip unchanged routes on re-runs.
- SKILL.md Step 6: selector caching reuses Step 4 exploration selectors.
- playwright.config.ts: CI workers default raised to 4.

### Fixed
- SKILL.md Step 4.2: replaced the broken shared-Chromium parallel approach with `openspec-pw explore`.
- `openspec-pw explore`: added auth redirect detection, atomic write with backup, stale-lock cleanup, signal handlers, and a worker cap.
- `openspec-pw run`: `--grep` and `--smoke` now combine into an AND pattern with full regex escaping.

### Changed
- **Healer Phase 2**: batch diagnosis then one combined `--workers=1` run, eliminating per-failure Playwright startups.
- **Healer Phase 2**: sequential isolated execution removes shared-state races.
- **Parallel exploration**: 4 workers by default (up to 16), roughly 3–4x faster exploration.

## [0.3.0] - 2026-04-12

### Changed
- `employee-standards.md`: complete rewrite with a 6-chapter structure and the full production workflow.
- `SKILL.md` v2.24: expanded the Mock Data Rule — no frontend mocking, API mocking only at the HTTP layer with user authorization, and business assertions verified through the API.
- `docs/index.html`: fixed the hero button layout gap.
- `employee-standards.md`: Step 5 CSS audit upgraded to a two-step framework-aware method with no hard-coded thresholds.

## [0.2.9] - 2026-04-10

### Changed
- `SKILL.md` v2.22: Phase 2 Step 5 selector repair split into 5a Extract (stability-ranked candidates) and 5b Select; selector-fix log gains a date field and a known-fix lookup step.

## [0.2.8] - 2026-04-10

### Changed
- `SKILL.md` v2.20: add redirect/refresh loop detection — navigate后两次URL对比+console累积检测；Phase 1 Triage新增Redirect Loop和Page Refresh Loop类型；Graceful Degradation新增对应条目

## [0.2.7] - 2026-04-10

### Changed
- `SKILL.md` v2.18: streamlined skill document — removed redundant Report Structure chapter, Step 5 confirmation criteria (duplicate of Test Plan Summary), and LoginPage duplicate example; compressed special element capture code and code templates into brief references pointing to templates; simplified Step 6.2 selector patterns into compact table (~230 lines reduced)

### Fixed
- `SKILL.md` v2.19: Test Plan Summary Special Elements section now only lists elements actually detected in Step 4 exploration (no longer pre-populates all 8 types); Infinite scroll and WebSocket/SSE detection now require explicit spec mention or real-time features (consistent with Date picker rule)

## [0.2.6] - 2026-04-09

### Added
- `openspec-pw audit` command: scans `tests/playwright/` for orphaned spec files, routes not in sitemap, missing auth.setup, and old-style file locations
- `openspec-pw run --update-snapshots`: passes `--update-snapshots` to Playwright for updating screenshot baselines
- `SKILL.md` Step 6: add `toHaveScreenshot()` visual regression examples for key pages, form states, and Canvas/WebGL

### Changed
- README.md & README.zh-CN.md: added `audit` and `migrate` to CLI command tree

## [0.2.5] - 2026-04-09

### Fixed
- `openspec-pw migrate`: removed OpenSpec validation to support archived/renamed changes

### Added
- `openspec-pw run`: `--headed` flag to show browser during test run

## [0.2.3] - 2026-04-09

### Changed
- Change test files now live under `tests/playwright/changes/<name>/<name>.spec.ts` (mirrors OpenSpec's change management philosophy); shared assets (seed.spec.ts, auth.setup.ts, credentials.yaml, pages/) remain at `tests/playwright/` root
- `run.ts`: test file lookup now uses `changes/<name>/` subdirectory structure
- `run.ts`: "all" mode test file lookup corrected to `tests/playwright/app-all.spec.ts` (not under changes/)
- `run.ts`: "file not found" error message now shows correct path for both change and "all" modes
- `run.ts`: added `--app-bugs`, `--healed`, `--raft`, `--escalated` flags for Healer classification reporting
- `SKILL.md`: updated all path references from `tests/playwright/<name>.spec.ts` to `tests/playwright/changes/<name>/<name>.spec.ts` (5 locations + Architecture table)
- `SKILL.md`: Phase 3 decision tree and Guardrails paths updated to new structure
- `README.md` & `README.zh-CN.md`: architecture diagram and CLI tree updated to reflect new structure
- `docs/plans/`: design doc path references updated

### Added
- `openspec-pw migrate` command: scans `tests/playwright/` for old-style `<name>.spec.ts` files and moves them to the new `changes/<name>/` structure; no longer requires OpenSpec change to exist (supports archived/renamed changes)
  - `--dry-run` / `-n`: preview without moving
  - `--force` / `-f`: overwrite existing files at destination

## [0.2.2] - 2026-04-08

### Fixed
- `SKILL.md` Signal table: re-run command was `openspec-pw run` during exploration phase (no test file exists yet) — now correctly uses `/opsx:e2e` to re-explore
- `SKILL.md` all mode: `app-all.spec.ts` filename didn't match `openspec-pw run` lookup (`all.spec.ts`) — `run.ts` now supports `all` as alias for `app-all.spec.ts`
- `SKILL.md` Graceful Degradation: exploration STOP (HTTP 5xx/JS error) had no defined follow-up — now specifies re-run `/opsx:e2e` to re-explore
- `SKILL.md` Phase 2: heal cap (3 attempts) was per-instance — same test could loop indefinitely — now added global attempt guard
- `SKILL.md` Phase 3: "same choice ≥2" guard only prevented (a→a), not (a→b→c→a) loops — now upgraded to 3 consecutive escalations trigger
- `SKILL.md` all mode: idempotency said "verify routes vs specs" — all mode has no specs — now says "verify routes vs live app"

### Changed
- `SKILL.md` Step 9 command syntax: `--project=<role>` → `[--project <role>`]` to match actual CLI interface
- `SKILL.md` Step 10 RAFT isolation: unified to `openspec-pw run --grep` (was using raw `npx playwright test`)
- `SKILL.md` Step 7 auth setup: "Re-run /opsx:e2e" → `openspec-pw run` with clarification that it jumps to Step 9 directly
- `SKILL.md` Step 5 all mode: clarified "skip" refers to test-plan generation, confirmation still shows
- `SKILL.md` Guardrails: corrected write permissions from `specs/playwright/` to accurate paths (`tests/playwright/` + `openspec/changes/<name>/specs/playwright/`)
- `run.ts`: added `--grep` / `-g` option for isolated test re-run (used by Healer Phase 1/2 and RAFT detection)

## [0.2.1] - 2026-04-08

### Changed
- `SKILL.md` Testing principles: clarify setup (API OK) vs assertion (UI required) — `page.request` only for visible results is now an explicit per-assertion rule
- `SKILL.md` Generator: add per-assertion UI check hook before writing each assertion
- `SKILL.md` Step 4: React 19/Next.js App Router → `networkidle`; Vue/Angular/React 18/Plain JS/jQuery → `waitForSelector`
- `SKILL.md` Phase 1 Timeout: add framework-aware healing path
- `employee-standards.md`: 200+ line changes must go through OpenSpec workflow

## [0.2.0] - 2026-04-08

### Changed
- `SKILL.md` Step 9 Healer: replace flat decision table with 3-phase protocol (Phase 1 Triage → Phase 2 Repair → Phase 3 Escalate)
- `SKILL.md` Step 9: add explicit "ASSERTION vs ACTUAL" comparison before fixing
- `SKILL.md` Step 9: distinguish Flaky (retry isolated, not counted) from Test Bug (Phase 2)
- `SKILL.md` Step 9: Phase 3 escalation outputs structured 4-option question to user instead of guessing test vs app bug
- `SKILL.md` Step 10: add RAFT detection guidance (suite fail → isolated pass = infrastructure coupling)
- `SKILL.md` Graceful Degradation: update failure classification with App Bug / Test Bug / RAFT / Human Escalation types
- `SKILL.md` Step 11: update report presentation to include failure type breakdown
- `templates/report.md`: redesigned with Summary metrics, Failure Classification table, Auto-Heal Log, RAFT Summary, Human Escalations sections
- `run.ts` `generateReport`: extended to output new report format with Failure Type / Healed columns and placeholder sections for Healer

### Breaking
- Drop support for Cursor, Cline, Gemini CLI, GitHub Copilot — E2E workflow is Claude Code only
- `editors.ts`: remove `detectEditors`, `installForAllEditors`, `ALL_ADAPTERS`, `EditorAdapter` interface; replace with `hasClaudeCode`, `installForClaudeCode`, `formatClaudeCommand`, `getClaudeCommandPath`
- `init.ts`: remove multi-editor detection logic; require `.claude/` to be present or exit early
- `update.ts`: same simplification
- `uninstall.ts`: remove adapter loop; use `getClaudeCommandPath` directly
- `tests/editors.test.ts`: rewrite for simplified API
- `tests/smoke.test.ts`: update smoke tests for new exports

### Fixed
- `doctor.ts`, `init.ts`, `update.ts`, `uninstall.ts`: replace direct `.claude.json` parsing with `claude mcp list` / `claude mcp remove`

## [0.1.80] - 2026-04-08

### Fixed
- `doctor.ts`, `init.ts`, `update.ts`, `uninstall.ts`: replace direct `.claude.json` parsing with `claude mcp list` / `claude mcp remove` — platform-independent, uses Claude Code CLI as source of truth instead of JSON file

## [0.1.80] - 2026-04-08

### Fixed
- `SKILL.md`: fix 6 template path references from `templates/xxx` to `.claude/skills/openspec-e2e/templates/xxx` (paths were broken in v0.1.78 refactor)
- `update.ts`: `syncProjectTemplates` now uses full content comparison instead of single-flag detection for BasePage.ts
- `update.ts`: add `syncCredentials` to preserve user credentials when updating credentials.yaml template (auto-backup + merge)
- `update.ts`: add `app-knowledge.md` generation (if missing) during update flow
- `update.ts`: add `.claude` existence check and "no editors detected" messages for consistency
- `.prettierignore`: restore `templates/` to ignore list

### Changed
- `src/index.ts`: `--seed/--no-seed` broken commander syntax replaced with two separate boolean options
- `syncSkillTemplates`: now only updates when content actually differs (no spurious output)

### Removed
- `cleanupDeprecatedSchema` from `update.ts` (schemas/ no longer in package — cleanup unnecessary)

## [0.1.79] - 2026-04-07

### Fixed
- `init.ts`: implement `--seed` flag to force regenerate `seed.spec.ts` (overwrites existing file)
- `update.ts`: fix duplicate warning when `seed.spec.ts` is outdated (`syncProjectTemplates` called twice)

### Changed
- `update.ts`: warning message now correctly suggests `openspec-pw init --seed` instead of non-existent `--seed` option

## [0.1.78] - 2026-04-07

### Added
- `SKILL.md` (v2.13): add Decision Table for Page Object file handling (create/extend/rewrite/remove)
- `SKILL.md` (v2.13): add Decision Table for route discovery fallback (sitemap→link→common paths)
- `SKILL.md` (v2.13): add Decision Table for Auth Confidence (High/Medium/Low → action)
- `SKILL.md` (v2.13): add Decision Table for Healer failure types (7 failure types with signals and actions)
- `SKILL.md` (v2.13): add complete Healer protocol (5-step workflow with STOP guard at 3 attempts)
- `SKILL.md` (v2.13): add STOP guard header to Graceful Degradation section
- `SKILL.md` (v2.13): restructure Guardrails from prose to Decision Table + file whitelist
- `SKILL.md` (v2.13): add Output path for `playwright.config.ts`
- `SKILL.md` (v2.13): clarify `app-exploration.md` template path (`.claude/skills/openspec-e2e/templates/`)
- `SKILL.md` (v2.12): add Step 1 Decision Table — Routes table replaces entirely (no append)
- `SKILL.md` (v2.12): add Step 6 Generator role identity + Page Object pattern (Read templates/e2e-test.ts)
- `SKILL.md` (v2.12): add ✅/❌ code pattern comparison for Page Objects (getters vs inline locators)
- `SKILL.md` (v2.12): add Page Object file naming convention (kebab→PascalCase)
- `templates/app-knowledge.md`: add **Routes** table for discovered routes (Route, Auth, Page Object, Notes)
- `templates/e2e-test.ts`: expand LoginPage example with full implementation pattern

### Fixed
- `SKILL.md` (v2.13): Step 6.1 LoginPage click consistency — `this.submitBtn.click()` → `this.click(this.submitBtn)`
- `SKILL.md` (v2.13): Step 8 `playwright.config.ts` template path now explicit
- `SKILL.md` (v2.13): Step 4.5 Dynamic content assertion — `toContainText` or regex (not `toHaveText`)
- `SKILL.md` (v2.13): Graceful Degradation table — remove duplicate **STOP** bold since header covers it
- `SKILL.md` (v2.13): Output section — remove duplicate "Auth setup" line
- `update.ts`: auto-sync `tests/playwright/pages/BasePage.ts` when missing `fillAndVerify()` (v0.1.75+ feature)
- `update.ts`: warn if `seed.spec.ts` is outdated and missing `fillAndVerify()` examples

## [0.1.77] - 2026-04-07

### Changed
- `run.ts`: switch from `--reporter=list` to `--reporter=json` for authoritative structured results
- `run.ts`: add `parsePlaywrightJsonReport()` to directly extract screenshot paths from Playwright JSON report output
- `run.ts`: `parsePlaywrightOutput()` (list stdout) becomes fallback when JSON report unavailable

### Added
- `JsonReporterSuite`, `JsonReporterTest`, `JsonReporterTestResult`, `JsonReporterAttachment` TypeScript interfaces for type-safe JSON parsing

## [0.1.76] - 2026-04-07

### Added
- Markdown report: add "Screenshot" column — links directly to screenshot file path from reporter attachment

## [0.1.75] - 2026-04-07

### Fixed
- `BasePage.fill()` / `type()`: add `blur()` after operation to trigger Vue/React change events and reactive updates, preventing "input not committed before next action" race conditions
- `BasePage`: add `fillAndVerify()` method for fields with debounced validation or when the next action depends on the value being fully committed

### Changed
- `SKILL.md`: update AppPage pattern example to use `fillAndVerify()`; update UI test code example to show verified fill pattern
- `auth.setup.ts`: add `toHaveValue()` verification after each fill in UI login fallback
- `seed.spec.ts`: update error path example to use `fillAndVerify()`
- `e2e-test.ts`: update login example to use `fillAndVerify()`

## [0.1.74] - 2026-04-03

### Added
- `SKILL.md`: add special element detection (Step 4.3.1) — canvas, iframe, Shadow DOM, contenteditable, video/audio, date pickers, drag-and-drop, infinite scroll, WebSocket/SSE
- `SKILL.md`: add special element test code patterns in Step 6 — with `toBeGreaterThan(0)` dimension checks and `toContainText` assertions
- `templates/app-exploration.md`: add "Special Elements Detected" table (Element, Type, Context, Dimensions, Test Strategy)
- `templates/test-plan.md`: add "Special Element Test Cases" section (canvas-2d, canvas-webgl, iframe, contenteditable, video, audio)
- `templates/pages/BasePage.ts`: new shared base class with goto, selector helpers (byTestId/byRole/byLabel/byText/byPlaceholder), safe click/fill/type with scrollIntoViewIfNeeded, waitForToast, waitForLoad, expectURL, expectText
- `templates/e2e-test.ts`: extend BasePage instead of inline AppPage class
- `templates/seed.spec.ts`: extend BasePage instead of inline AppPage class
- `init.ts`: generate `tests/playwright/pages/BasePage.ts` on init
- `SKILL.md Step 6.1`: add BasePage usage guide and AppPage pattern (extend BasePage → add page-specific selectors as getters)
- `SKILL.md Step 6.2`: add selector anti-pattern section (CSS class/ID fragility → prefer semantic selectors)

### Fixed
- `SKILL.md`: canvas context detection — check WebGL2→WebGL1→2D order to avoid consuming 2D context
- `SKILL.md`: canvas snapshot signal — use role="img" instead of tagName (tagName not in a11y tree)
- `SKILL.md`: test-plan.md heading typo ("Video — Audio Playback" → "Audio — Playback Control")
- `templates/pages/BasePage.ts`: fix expectGuest() broken logic (dead code) → use getByRole assertion
- `templates/pages/BasePage.ts`: waitForLoad comment clarified (silent timeout — caller should assert)
- `templates/pages/BasePage.ts`: expectText() — remove broken exact option for RegExp

### Changed
- `SKILL.md`: streamline Role mapping (table → inline note)
- `SKILL.md`: deduplicate Code examples section (removed redundant false-pass/API-login blocks)
- `SKILL.md`: compress Graceful Degradation table from 13 rows to 8 (merged duplicate scenarios)

## [0.1.72] - 2026-04-03

### Changed
- `update.ts`: auto-cleanup deprecated `openspec/schemas/playwright-e2e/` from pre-v0.1.71 versions
- `employee-standards.md`: streamline "搜索要全" rule wording (fewer words, same meaning)

## [0.1.71] - 2026-04-03

### Fixed
- `init.ts`: install 5 SKILL reference templates to `.claude/skills/openspec-e2e/templates/` (previously they were in npm package but never copied to project, causing SKILL references to fail)
- `update.ts`: sync SKILL reference templates from npm package
- `init.ts`: handle "already exists" gracefully when MCP is already installed (no scary error on Windows)
- `employee-standards.md`: OpenSpec 阶段隔离 title uses colon instead of period (format consistency)
- `employee-standards.md`: unify 'typecheck' spelling (remove inconsistent space)
- README.md & README.zh-CN.md: architecture diagrams updated to reflect new template location

### Changed
- Schema (openspec/schemas/playwright-e2e/) no longer installed to project — E2E workflow is fully SKILL-driven, not OpenSpec artifact-driven
- Templates migrated from `schemas/playwright-e2e/templates/` to `templates/` in npm package

## [0.1.70] - 2026-04-02

### Added
- `employee-standards.md`: E2E workflow isolation rule (prevents E2E auto-trigger from OpenSpec stages)

## [0.1.68] - 2026-04-02

### Added
- GitHub workflow for npm unpublish (temporary, later removed in this release)

### Removed
- GitHub unpublish workflow (no longer needed)

## [0.1.67] - 2026-04-02

### Changed
- (Unpublished — large refactor rolled back; see v0.1.68+)

## [0.1.66] - 2026-04-02

### Changed
- `employee-standards.md`: replace ambiguous "验证" with concrete terms ("lint + typecheck", "编辑要求")
- `employee-standards.md`: add OWASP Top 10 references for web and API projects
- `employee-standards.md`: principle-based code quality guidance (language-aware)
- Editor support: replace Windsurf with Cline (reduced supported editors from 23 to 5)
- Release workflow: add lockfile pre-check
- Smoke test: add npm pack verification and critical files check
- `package.json`: include `.claude/` and `employee-standards.md` in published package

## [0.1.65] - 2026-04-02

### Added
- `employee-standards.md`: E2E workflow isolation rule (prevents E2E auto-trigger from OpenSpec stages)

## [0.1.63] - 2026-04-02

### Added
- `openspec-pw uninstall` command to remove integration from a project
- `npm run typecheck` script (`tsc --noEmit`)
- `npm run test:smoke` script (build + smoke tests)
- `tests/smoke.test.ts` with smoke tests covering dist output, module imports, and CLI behavior
- CI workflow (`.github/workflows/ci.yml`) for pull request checks
- `package.json` `"files"` field to reduce npm package size
- Vitest coverage configuration (v8 + lcov reporter)
- CHANGELOG.md
- GitHub Issue Templates (bug report + feature request)

## [0.1.62] - 2026-04-02

### Changed
- `findNpmRoot` in `playwright.config.ts` now searches recursively (up to 5 levels) for nested monorepos
- Console listener leak fixed in `seed.spec.ts` — now properly removes listener in `test.afterEach`
- Empty `catch {}` blocks replaced with warnings in `init.ts`, `doctor.ts`, and `mcpSync.ts`
- `parseMcpReadme` now warns to stderr when README format changes and no tools are parsed
- README editor count corrected from 24 to 23

### Fixed
- Console listener leak in `seed.spec.ts` (`test.afterEach` now removes the handler)
- Release workflow version mismatch (tag now points to the version-bumped commit)
- Missing test step in release workflow (tests now run before publish)
