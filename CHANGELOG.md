# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Changed

- **精简 employee-standards（−20% token，零约束损失）**. 163 行 → 130 行（9.4KB → 8.0KB）：删除机器特定内容（`agent-reach` / `frontend-design` / `ui-ux-pro-max` skill 引用、「用中文回复用户」全局语言强制——装入任意项目不再突袭改语言）、§1 四组合并（保留依赖优先级链「已有依赖 > 新包 > 自写」与「清理与重构分开提交」）、§3 工作流表压成一行（保留「AI 不自动进入下一阶段」🔴）、§5 三段式压 2 行、§2/§5 WHY 删（§4/§6 WHY 保留——立法意图）。诚实性条「未执行检查标注『未运行』」⚪ 升 🟡。已装项目 AGENTS.md 标记内内容会 drift，下次 update 自动重写；标记外手动复制的副本不随 update（既有语义）。同步 `docs/script.js` 中英内嵌副本与本仓库根 `AGENTS.md`。
  - `employee-standards.md`、`docs/script.js`、`AGENTS.md`

- **编辑器写入授权收窄（领土语义）**. `update` 从「检测到就写」改为「只维护已授权编辑器」：授权判据 = 项目内已有 openspec-pw 命令工件（零新状态，删除即撤回授权），全局配置目录（`~/.pi/agent`、`~/.omp/agent`、`~/.dsh`）或手建的编辑器标记目录（如手建 `.cursor/`）不再触发写入——此前 `openspec init --tools claude` 的项目跑一次 `update` 会为机器上装了的 omp/pi/dsh 凭空新建命令文件与 MCP 配置并写回 AGENTS.md。`update` 不再新增编辑器：未授权编辑器打印信息行提示 `openspec-pw init --tools <id>`（幂等，扩展入口）；MCP 缺失但命令工件在 = 部分安装漂移，照常自愈。standards 相位同步改「标记即领土」：AGENTS.md 无 OPENSPEC 标记/缺失 ⇒ 跳过不写回（`--tools none` 项目 update 零写入）；CLAUDE.md wrapper 门控改为 claude 命令工件授权。`init` 非 TTY fallback 从 any-scope 检测收窄为仅项目内信号（TTY 交互预选保留全局信号）；fallback 无编辑器报错文案移除已失效的全局目录指引。`doctor` 分档：未授权编辑器的 MCP / Cursor E2E 检查降为 `ok: true` 信息行（提示 init，不再误导 run update）；AGENTS.md 无标记恒 `ok: true`（消除 doctor 报错 → update 修不了的死循环）；`--json` 编辑器相关检查新增 `authorized` 字段（⚠ `--json` checks 数组构成有变化，消费方需注意）。`uninstall` 不变（宽检测 + 存在性守卫）。openspec change: `scope-editor-writes`。
  - `src/commands/editors/types.ts`、`src/commands/editors/registry.ts`（`detectProjectAdapters` / `hasCommandArtifacts`）、`src/commands/editors/adapters/{pi,omp,dsh}.ts`、`src/commands/update.ts`、`src/commands/init.ts`、`src/commands/doctor.ts`
  - MCP 安装范围同步改「已授权编辑器」（原「检测到的编辑器」）；update 的前端 gate 静默跳过改为打印跳过说明行（对齐 init——修复「update 后 MCP 没装也没有任何解释」的排查黑洞）
  - `tests/update.test.ts`、`tests/update.standards.test.ts`（重写为新签名 + 标记即领土用例）、`tests/init.test.ts`、`tests/editors-tools.test.ts`、`tests/commands/doctor.test.ts`
  - `README.md`、`README.zh-CN.md`

## [0.3.75] - 2026-08-27
### Added

- **MCP 收敛为官方 test-runner server（playwright-test）**. `init`/`update` 的 MCP 相位在前端信号 gate 下安装**单个**项目级 server：官方 `playwright-test`（`npx playwright run-test-mcp-server`，playwright 包自带子命令，零新增依赖），与 Playwright 官方 `playwright init-agents` 布局一致。实测该 server 是 @playwright/mcp 的**超集**（87 工具：78 browser_* + 3 test_* + 6 generator/planner）——单 server 免去双装的 78 个重复 browser 工具（估 20-40K token/会话）。`uninstall` 移除 test-runner 条目并清理历史 `playwright` 条目；已装项目重跑 update 幂等补齐。`doctor` 的 per-adapter MCP 检查改为 `test-runner-mcp-<editor>`（可选，缺失黄 ⚠ 提示 update），新增 `playwright-cli` PATH 感知（与编辑器无关，0.x 仅探测）。`templates/e2e-command.md` Healer 段接入结构化工具语义（`test_list → test_debug`（id 来自 test_list）`→ 修 → test_run`（locations 定向单测），shell 回退）+ guardrails 出口（单错误循环；测试正确但持续失败 → `test.fixme()` + 注释说明 ACTUAL vs EXPECTED；自主修复路径内禁止放宽断言——Phase 3 人工决策合法）。openspec change: `add-test-runner-mcp`。
  - `src/shared/mcp.ts`、`src/shared/index.ts`、`src/commands/init.ts`、`src/commands/update.ts`、`src/commands/uninstall.ts`、`src/commands/doctor.ts`
  - `templates/e2e-command.md`
  - `tests/shared/mcp.test.ts`（+4）、`tests/init-mcp-scope.test.ts`（单 server 收敛 2 用例）、`tests/update.test.ts`（+1 源码守卫）、`tests/commands/uninstall.test.ts`（+2）、`tests/commands/doctor.test.ts`（镜像同步 +4）
  - `README.md`、`README.zh-CN.md`

### Changed

- **清理死代码（review 修复）**. 单 server 收敛后 `isPlaywrightMcpInstalled` / `ensurePlaywrightMcp` / `PLAYWRIGHT_MCP_COMMAND` 已无生产调用者，按 AGENTS.md §1「过时的直接删」清除；`removePlaywrightMcp` 保留供 `uninstall` 清理历史 `playwright` 条目。同步移除 `src/shared/index.ts` re-export 与 `tests/shared/mcp.test.ts` 中相应测试块。
  - `src/shared/mcp.ts`、`src/shared/index.ts`、`tests/shared/mcp.test.ts`

- **CLAUDE.md CodeGraph 优先块措辞再优化**. `CODE_GRAPH_FIRST_BLOCK` 去条件前置（「有 \`.codegraph/\` 时：」）改为祈使主句，否定式「别先 grep/read」改正向限定「grep/read 仅作补充」，8 个语义点（触发/任务类型/默认动作/直接用结果/grep 例外/禁子 agent/无索引跳过）全部保留。已初始化项目 CLAUDE.md 会 drift，下次 `update` 自动重写。
  - `src/commands/editors/project-rules.ts`

- **employee-standards §0 约定下新增 OpenSpec 命令帮助行**. 「约定」后加一行：**OpenSpec 命令**跑 `npx openspec --help` 查看可用命令（无条件祈使）。同步 `AGENTS.md`（git 忽略，磁盘生效）与 `docs/script.js` 内嵌标准（ZH + EN），docs-sync 新增 2 个锚点用例。
  - `employee-standards.md`、`docs/script.js`、`tests/docs-sync.test.ts`

## [0.3.74] - 2026-08-24
### Changed

- **`editors.ts` 拆分为 `editors/` 目录（纯重构，行为不变）**. 1279 行单文件逼近 CI 1500 行门禁（余量仅 221），实现下沉为职责单一的子模块：`types.ts`（类型+defineAdapter 工厂）、`shared.ts`（YAML/mcpServers helpers）、`tool-selection.ts`（--tools 解析）、`project-rules.ts`（规则块管理）、`registry.ts`（注册表+安装 helper）、`adapters/<editor>.ts` ×7（每编辑器的 format/path/detect 函数与 adapter 实例合体）。**`editors.ts` 保留为薄门面**（~119 行纯 re-export）：实验证实 Node ESM / TS nodenext 不支持目录 index 自动解析，删除单文件会让现有 `"./editors.js"` 导入 TS2307，故门面保留以维持调用方 import 零改动；re-export 顺序即 adapter 自注册顺序（claude→opencode→cline→cursor→pi→omp→dsh），由 editors-tools ALL 断言守护。`registerAdapter` 从模块私有改为 registry 导出（内部 API）。
  - `src/commands/editors.ts` — 1279 行 → 119 行门面
  - `src/commands/editors/` — 新增 12 个文件，最大 project-rules.ts 313 行
  - 第 N 个编辑器的新增模式定型：新增 adapters/<editor>.ts + registry 注册顺序一处


- **CI verify 矩阵扩展至三平台**. `ubuntu(20,22) + macos@22 + windows@22` 共 4 jobs，全局 CLI 的平台路径（`needsShell`、`where`/`which`）首次被 CI 验证；文件行数检查步骤显式 `shell: bash`（windows runner 默认 pwsh 解析不了 heredoc bash）。首跑暴露 27 个 Windows 失败全部为测试侧路径可移植性问题（src 零改动）：`new URL().pathname` 在 win32 产生 `D:\D:\` 前缀 → `fileURLToPath()`；正则断言假设 `/` 分隔符 vs `join()` 反斜杠；bsdtar CRLF 输出 → `split(/\r?\n/)`；mock fixture 硬编码前向斜杠路径 vs `join()` 产出；migrate 测试字符串拼接改 `join()` 构造。
  - `.github/workflows/ci.yml`、8 个测试文件
- **依赖刷新 + build 脚本可移植化**. in-range 全量升级（71 packages：playwright 1.62 / eslint 10.9 / vitest 4.1.11 / prettier / @inquirer 等）；commander **12→15** 零改动全绿（用面仅核心 API：47 处 name/version/command/option/action/parse）；build 脚本 `rm -rf dist/ && tsc` → `node -e fs.rmSync(...) && tsc`（Windows cmd.exe 下 POSIX 命令必炸）。**刻意不升**：chalk 6（engines node>=22 超 engines 下限 20，与 Node 20 矩阵腿冲突）、typescript 7（新一代编译器生态未稳，待 @typescript-eslint 明确支持后单独跟进）、@types/node 26（types 高于 engines 下限会引入运行时不存在的 API）。
  - `package.json`、`package-lock.json`

### Added

- **`audit` / `update` 测试盲点清剿**. 覆盖率实测 audit.ts 15% / update.ts 23%（总体 63%）后补齐最大缺口。新增 mock-heavy 测试文件两个：`tests/commands/audit.main.test.ts`（9 用例覆盖 `audit()` 主函数 7 相位——无 tests/playwright 早退、sitemap 失败 note、orphaned spec 含空列表守卫、URL 不在 sitemap、prefix 豁免不误报、缺 auth.setup、old-style 位置、healthy + shared 跳过；fs/child_process/fetch 全 mock，readdirSync 按 `withFileTypes` 分发 Dirent/string 两形态）与 `tests/update.standards.test.ts`（7 用例——`update()` not-initialized 早退零副作用，`syncEmployeeStandards` 无编辑器跳过 / 模板缺失静默 / symlink CLAUDE.md 经 AGENTS.md 追踪 / stale 重写调 installProjectRules / in-sync 短路 / 裸 `@AGENTS.md` 导入警告）。现有真实文件系统测试文件不动语义：`tests/commands/audit.test.ts` 仅追加 2 个 `getSitemapRoutes` 边缘用例（malformed `<loc>` 静默跳过、50 条截断）。
- **`syncEmployeeStandards` 导出**（一行可见性变更）. update.ts 私有函数加 `export` 以便直测（项目 export-for-testability 惯例）；经 `update()` 间接测试不可行——该函数在 CLI 更新网络 phase 之后才可达。无行为影响。
  - `src/commands/update.ts` — `function syncEmployeeStandards` → `export function syncEmployeeStandards`
  - `tests/commands/audit.main.test.ts`（新增）、`tests/commands/audit.test.ts`（+2）、`tests/update.standards.test.ts`（新增）

## [0.3.73] - 2026-08-19
### Added

- **`init` / `update` 末尾新增 CodeGraph 索引同步提示**. 检测到项目存在 `.codegraph/` 目录时，在命令末尾提示 `codegraph sync` 与 `codegraph install --target=auto --location=local`（代码变更后保持索引与 hook 同步）；`init` 原有「CLI 已装但未索引 → `codegraph init`」提示保留，与刷新提示构成互斥分支，共用 Next steps 第 6 步位置。纯提示，不影响生成行为与 exit code。
  - `src/commands/init.ts` — codegraph 提示块扩展 `else if` 分支
  - `src/commands/update.ts` — Summary 末尾（Restart 提示后）追加 codegraph 提示

- **`doctor` 新增 CodeGraph 检查项 + `init`/`update` 提示缺口化 + `uninstall` 清理提示**. 共享检测模块 `detectCodeGraphStatus`（CLI 可用性 / `.codegraph/` 索引 / codegraph MCP 是否装入 agents）统一驱动四个命令：`doctor` 新增 `─── CodeGraph ───` 类别（`codegraph-cli` / `codegraph-index` / `codegraph-mcp`，全为可选检查，失败黄 ⚠ 不改变 `--json` 退出码，缺失时给出 `codegraph init` / `codegraph install --target=auto --location=local` 修复命令）；`init`/`update` 提示改为缺口感知（MCP 已装只提示 `codegraph sync`，MCP 缺失才提示 install，无索引但有 CLI 提示 `codegraph init`）；`uninstall` 检测到 codegraph MCP 已装时提示 `codegraph uninstall`（不删 `.codegraph/`，那是 codegraph 资产）。
  - `src/shared/codegraph.ts`（新增）、`src/shared/index.ts`
  - `src/commands/doctor.ts`、`src/commands/init.ts`、`src/commands/update.ts`、`src/commands/uninstall.ts`
  - `tests/shared/codegraph.test.ts`（新增）、`tests/commands/doctor.test.ts`、`tests/init.test.ts`、`tests/update.test.ts`、`tests/commands/uninstall.test.ts`

- **CLAUDE.md 工作流提示**. `claudeWrapperStandardsContent` 在 OPENSPEC 块中新增「**工作流**：优先使用 OpenSpec 工作流（/opsx 命令），而非 plan mode」提示，`init`/`update` 写入 CLAUDE.md 时自动带上（仅 CLAUDE.md，AGENTS.md 不受影响）。
  - `src/commands/editors.ts`

- **CLAUDE.md CodeGraph 优先块文案精简**. `CODE_GRAPH_FIRST_BLOCK` 从 ~130 字压缩到 ~100 字：拆短句、去冗余词（存在→有、定位定义→定义、不要→别、分号→括号），8 个语义点（触发条件/任务类型/默认动作/直接用结果/禁止 grep/grep 例外/禁止子 agent/兜底）全部保留。已初始化项目的 CLAUDE.md 会 drift，下次 `update` 自动重写。
  - `src/commands/editors.ts`

## [0.3.72] - 2026-08-18
### Changed

- **employee-standards 删除 §2 上下文管理**. 章节整体移除（500 行分次读取、压缩恢复协议、跨 change 改动禁令等 6 条规则），后续章节重编号（3→2、4→3、5→4、6→5、7→6），§5→§4 / §7→§6 交叉引用同步更新。同步 `AGENTS.md`（git 忽略，磁盘生效）与 `docs/script.js` 内嵌标准（ZH + EN），docs-sync 测试章节计数 8→7。
  - `employee-standards.md`、`docs/script.js`、`tests/docs-sync.test.ts`

- **`editors.ts` 引入 `defineAdapter` 工厂**. 7 个适配器对象字面量改用 `defineAdapter({...})` 构造：默认 `supportsMcp: true`、`projectRulesPath` 默认 `<root>/AGENTS.md`、`isMcpInstalled/installMcp/removeMcp` 默认 no-op。`claudeAdapter` 显式声明 `CLAUDE.md` 覆盖默认；`piAdapter` / `dshAdapter` 设 `supportsMcp: false` 后删三处 no-op；其余适配器省略冗余 `projectRulesPath`。**行为完全不变**，全部 181 个 editors 测试通过；新增 `EditorAdapterInit` 接口明示 required vs optional 字段。文件 1236 → 1279 行（+43：factory 注释 + JSDoc 抵消了去重收益，可读性提升为主要价值）。
  - `src/commands/editors.ts` — 新增 `EditorAdapterInit` interface + `defineAdapter` 函数；7 个适配器重写

- **`coverage` 末尾补 `checkForUpdate`**. 与 `init` / `doctor` / `audit` / `explore` / `migrate` / `uninstall` 对齐（`flake` 故意不加 —— `flake --gate HIGH` 是 CI 主用例，每次 PR 多 0–10s `npm view` 延迟无收益，CI runner 通过 `npm install` 更新）。`checkForUpdate` 已有 24h 缓存 + never-throws + 非阻塞执行，加到交互式命令不影响 CI 性能（首次最多多 10s 网络）。
  - `src/index.ts` — `coverage` action 末尾追加 `await checkForUpdate(pkg.version);`；`flake` 注释说明跳过原因

### Added

- **`migrate.ts` 单测补全**. 132 行的迁移函数原本零测试，现新增 7 个用例覆盖全部分支：无 `tests/playwright/` 目录 → yellow message；0 old 文件 → "Nothing to migrate"；正常迁移 → 调 `mkdirSync({ recursive: true })` + `renameSync`；`--dry-run` → 不调 `renameSync`；目标存在无 `--force` → skip + warning；`--force` 覆盖 → 调 `renameSync` 一次；**TOCTOU**（`readdirSync` 返回文件名但 `existsSync(oldPath)` 返 false）→ "not found, skipping"。用 `vi.mock("fs", ...)` + `vi.spyOn(process, "cwd")` 隔离，不依赖真实文件系统。
  - `tests/commands/migrate.test.ts`（新增 7 用例）

### Fixed

- **`docs/index.html` quickstart 第 03 步命令漂移修复**. 命令串补 `--scope project`（与 `README.md` line 173 对齐），避免用户安装到 global scope；该步骤标为"可选"，并新增小字注释说明新版 `openspec-pw init` **在检测到前端项目时**自动安装 MCP（详见 0.3.70 `feat(init): gate Playwright MCP install on frontend signal`）—— 纯 API 项目跳过 MCP，用 Playwright `request` fixture；保留该步骤仅服务老用户迁移。
  - `docs/index.html` — quickstart 第 03 步命令 + label 改"可选" + 小字注释

## [0.3.71] - 2026-08-18
### Added

- **`openspec-pw init` 无前端项目引导提示**. 生成测试文件前轻量检测前端信号：读 `findNpmRoot` 定位的 `package.json`（与 `detectAppServer` 同源，monorepo 下探一致），deps/devDeps **精确键名匹配**前端框架关键词（react/next/vue/nuxt/svelte/sveltekit/astro/angular/solid/preact/remix/vite/@angular/core——substring 会误命中 vitest/nextra），`scripts.dev` substring 匹配 vite/next/nuxt/svelte-kit/astro。无前端信号时在 Summary Next steps 打印两行"如果…"并列建议（monorepo 子目录 → 在应用目录运行 init；纯 API → Playwright `request` fixture + `BASE_URL` 指向 API），不影响生成行为与 exit code；无 package.json 时跳过检测不提示（webServer fallback 行为不变）。
  - `src/shared/app-detect.ts` — 新增 `hasFrontendSignal`（`boolean | null`：null = 无 package.json 跳过检测），框架关键词常量与 `frameworkDefaultPort` 同模块并注释关系
  - `src/commands/init.ts` — 生成前检测 + Summary 提示（灰色，与 Next steps 同格式）
  - `tests/shared/app-detect.test.ts` / `tests/init.test.ts` — 信号匹配（含 vitest 不误命中、monorepo 下探）与提示输出用例
  - `README.md` / `README.zh-CN.md` — init 行为说明补充一行

- **`audit` / `explore` 的 BASE_URL 解析统一走 `detectAppServer` 检测链**. 此前两命令在无 `BASE_URL` 时硬编码回退 `localhost:3000`（与 `doctor` 的完整检测结论不一致——vite/astro 等项目 audit 拿错 sitemap、explore 打不开页面）。现统一为 env `BASE_URL` →（explore）探索文件记录的 `BASE_URL:` → 检测链（scripts `--port` / vite.config / .env / 框架默认端口 / seed）→ `localhost:3000` 兜底；CLI 侧 `3000` 字面量从 3 处收敛到 1 处（`detectAppServer` 链尾）。`parseExplorationFile` 保持纯函数（无 `BASE_URL:` 行返回 `undefined`），命令级决议提取为可测的 `resolveExploreBaseUrl`；audit 失败消息改报真实来源（`fell back to X (source)`）。行为向后兼容：设了 `BASE_URL` 结果不变；模板（auth.setup/teardown/playwright.config/e2e-test）的独立 `|| 3000` 不动（测试时运行的独立文件，用户契约）。
  - `src/commands/audit.ts` — `getSitemapRoutes(projectRoot)` 改用 `detectAppServer`（导出以便测试）
  - `src/commands/explore.ts` — `parseExplorationFile` 导出 + `baseUrl?: string`；新增导出 `resolveExploreBaseUrl`
  - `tests/commands/audit.test.ts`（新增 4 用例）、`tests/commands/explore.test.ts`（新增 6 用例）——两命令首次测试覆盖
  - `openspec/specs/cli/base-url/spec.md` — 新增 capability 契约（env > 文件 > 检测 > 兜底）

- **Playwright MCP 仅在有前端信号时自动安装**. `init` 第 4 步由无条件安装改为 `hasFrontendSignal === true` 才装（纯 API / 无 package.json 项目跳过并打印灰色说明——API 测试走 `request` fixture，不需要浏览器 MCP），与无前端引导提示语义对齐。检测计算上移（MCP gate 与 Summary 提示共用一处）。**非破坏性**：已安装的 MCP 不被移除，`--mcp=false` 覆盖不变；E2E 命令安装不受影响（API 项目仍装命令）。
  - `src/commands/init.ts` — `frontendSignal` 上移 + MCP 步骤 gate + 跳过说明
  - `tests/init-mcp-scope.test.ts` — fixtures 补前端信号 package.json；新增 gating 用例 3 个（纯 API 跳过 / 无 package.json 跳过 / 前端照装）
  - `README.md` / `README.zh-CN.md` — MCP 段落补充"检测到前端信号时自动安装"

- **Deploy Docs 工作流双站部署**. `pages.yml` 在 GitHub Pages 部署后追加 Cloudflare Pages 直传步骤（`wrangler pages deploy`），配置 `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` 两个 repo secret 后，一次 push 自动更新 GitHub Pages 与 Cloudflare 两个站点；secrets 未配置时步骤自动跳过（不报错）。
  - `.github/workflows/pages.yml`

### Fixed

- **release 脚本 badge commit message 版本号取旧值**. `npm_package_version` 环境变量在脚本启动时快照，`npm version patch` 改版本后不刷新，导致 commit message 显示旧版本号（如 v0.3.68）。改为 `$(node -p "require('./package.json').version")` 动态读取。
- **新增 `deploy:docs` 脚本固定 wrangler 版本**. wrangler 4.123+ 在非交互环境要求 `CLOUDFLARE_API_TOKEN`（OAuth 被拒），固定 `wrangler@4.119.0` 恢复 OAuth 部署。`npm run deploy:docs` 一键部署 Cloudflare 站。
  - `package.json`

- **CLAUDE.md 为 symlink 时 init/update 覆盖 AGENTS.md 标准**. 项目用官方 symlink 方式复用 AGENTS.md（`CLAUDE.md -> AGENTS.md`，如 deepseek-harness）时，`installClaudeWrapper` 写 CLAUDE.md 会**跟随 symlink 覆盖 AGENTS.md**：init 先正确写入完整标准，随后 wrapper 又把它替换成 CodeGraph 优先段（还产生 `@AGENTS.md` 自引用）；update 每次重复「写入→覆盖」循环，永远无法收敛。修复：`installClaudeWrapper` 用 `lstatSync` 检测 symlink 直接跳过（标准已在 AGENTS.md，无需 wrapper）；update 漂移检查对 symlink 的 CLAUDE.md 视为非 stale（AGENTS.md 检查已覆盖）；doctor 的 `standards-claude` 对 symlink 记 `ok:true`（covered by standards-agents），不再误报。
  - `src/commands/editors.ts`、`src/commands/update.ts`、`src/commands/doctor.ts`
  - `tests/editors.test.ts` — symlink 场景 2 用例（skip on win32）+ update/doctor 源码守卫 2 用例

- **`--no-skill` 不再静默跳过标准漂移检查**. 原 `update --no-skill` 跳过整个命令+标准相位，AGENTS.md/CLAUDE.md 漂移被无声忽略。现标准同步独立执行（提取 `fetchLatestBundle`/`syncEmployeeStandards`），`--no-skill` 只跳过命令/模板安装并明确提示。
  - `src/commands/update.ts`

- **docs/script.js 内嵌标准一致性测试**. 新增 `tests/docs-sync.test.ts` 16 个锚点用例（ZH/EN），`employee-standards.md` 变更忘同步 docs 网页内嵌副本时测试失败——0.3.65 的漂移不再复发（编写时即抓到两处真实措辞漂移）。
  - `tests/docs-sync.test.ts`

- **release 自动归档 CHANGELOG**. `scripts/bump-docs.js` 顺带把 `[Unreleased]` 归档为 `vX.Y.Z - 今日`（无 Unreleased 则跳过），release 脚本同步 `git add CHANGELOG.md`——0.3.64 的漏归档不再可能。
  - `scripts/bump-docs.js`、`package.json`

- **doctor 检出旧版全局 playwright MCP 残留**. Claude Code MCP 改项目级（0.3.69）后，旧版 user-scope 残留（`~/.claude.json`）对项目级检查不可见。doctor 在项目级已装时读取全局配置，发现残留记提示性 `ok:true` 并给出 `claude mcp remove playwright` 清理命令。
  - `src/commands/doctor.ts`

## [0.3.69] - 2026-08-17

### Added

- **`openspec-pw init --tools` 编辑器选择**（补回：该功能已实现提交，本条目在 rebase 合并时被 0.3.67/0.3.68 归档段落吞掉，现恢复）。对齐 `openspec init --tools`：`all` / `none` / 逗号分隔 id 列表非交互式选择要配置的编辑器；无 `--tools` + TTY 弹 `@inquirer/prompts` 多选（预选已检测编辑器，可全不选 = `--tools none`）；非 TTY 回退到检测结果，零检测时报错退出并提示 `--tools`。选择列表驱动 MCP / 命令 / 规则各阶段，`--tools none` 仍生成测试脚手架；未知 id 或 `all`/`none` 与具体 id 混用报错非零退出，重复 id 去重保序，`oh-my-pi` 映射 `omp`，`dsh` 自动并入全量。
  - `src/index.ts` — `init` 命令注册 `--tools`；action 捕获 init 抛错打印并 `exit(1)`
  - `src/commands/editors.ts` — `resolveToolsArg` 纯函数与 `getAllAdapters()`；`installCommand` 自动建目录使未检测编辑器可装
  - `src/commands/init.ts` — `InitOptions.tools`、`InitDeps`（prompt/isTTY/homeDir 注入）、`promptSelectEditors`；移除 `detected.length === 0` 提前 return
  - `package.json` — 新增依赖 `@inquirer/prompts`
  - `tests/editors-tools.test.ts`、`tests/init.test.ts` — `resolveToolsArg` 13 个用例 + `--tools` 分支/交互注入共 10 个用例
  - `README.md` / `README.zh-CN.md` —「Selecting Editors on Init / 初始化时选择编辑器」一节

- **Claude Code 的 Playwright MCP 改为 project scope**. `claude mcp add/remove` 全部加 `--scope project`，写入项目根 `.mcp.json`（可随版本控制共享），不再碰全局 `~/.claude.json`；已安装检查改为直读 `.mcp.json`（不再调用 `claude mcp list`，零 CLI 依赖且天然不混淆全局残留）。与其余编辑器（OpenCode/Cline/Cursor/Oh My Pi 本就项目级）保持一致。**行为变更**：旧版全局残留需手动 `claude mcp remove playwright` 清理；项目级 server 首次交互使用时 Claude Code 会弹批准提示。
  - `src/commands/editors.ts` — `claudeAdapter` 三方法（`isMcpInstalled`/`installMcp`/`removeMcp`）；删除废弃的 `claudeMcpOutputIncludes`
  - `src/commands/init.ts` — MCP 安装失败时手动命令提示含 `--scope project`，并提示旧 CLI 升级
  - `tests/editors-claude-mcp.test.ts`（新增 6 用例）、`tests/init-mcp-scope.test.ts`（新增 2 用例）、`tests/shared/mcp.test.ts`、`tests/commands/doctor.test.ts`、`tests/commands/uninstall.test.ts` — 全部按文件读取行为重写
  - `README.md` / `README.zh-CN.md` — MCP 段落 + 迁移说明 + First-Time Setup 表；编辑器计数适配 dsh（6→7）

### Fixed

- **`--tools` 帮助文本遗漏 `dsh`**. `openspec-pw init --tools` 的帮助文本只列了 `claude,opencode,cline,cursor,pi,omp`，漏掉有效 editor id `dsh`（DeepSeek Harness），与 `resolveToolsArg` 实际接受值及 init 错误提示不一致。已补全。
  - `src/index.ts`

## [0.3.68] - 2026-08-16

### Added

- **DeepSeek Harness (dsh) 支持**. 新增编辑器适配器：通过 `.dsh/skills/opsx-e2e/SKILL.md` 安装 project-dsh skill（rank 100，本地最高优先级，`name` + `description` frontmatter，经 `skill` 工具调用）。dsh 原生读 `AGENTS.md`，无需包装文件；检测信号为项目 `.dsh/` 目录或全局 `~/.dsh/`（DSH_HOME）目录。dsh 通过 `cordis.yml` 插件配置 MCP（`@deepseek-ai/dsh-mcp-client`）而非简单文件，故 `supportsMcp:false`，MCP 相位跳过、探索走 `openspec-pw explore`。
  - `src/commands/editors.ts` — `EditorId` 扩为 7 个、`hasDsh` / `formatDshCommand` / `getDshCommandPath` / `dshAdapter`
  - `src/commands/init.ts` / `doctor.ts` / `update.ts` — 检测列表、无编辑器提示、`hasCommand` 判定同步 dsh skill 路径
  - `tests/editors.test.ts` — 新增 dsh 用例；既有 detectAdapters 全量用例扩为 7 个
  - `README.md` / `README.zh-CN.md` — 编辑器支持、init 检测、doctor 表、架构树同步

## [0.3.67] - 2026-08-12

### Added

- **`openspec-pw init --tools` 编辑器选择**. 对齐 `openspec init --tools`：`all` / `none` / 逗号分隔 id 列表非交互式选择要配置的编辑器；无 `--tools` + TTY 弹 `@inquirer/prompts` 多选（预选已检测编辑器，可全不选 = `--tools none`）；非 TTY 回退到检测结果，零检测时报错退出并提示 `--tools`。选择列表驱动 MCP / 命令 / 规则各阶段，`--tools none` 仍生成测试脚手架；未知 id 或 `all`/`none` 与具体 id 混用报错非零退出，重复 id 去重保序，`oh-my-pi` 映射 `omp`。`--tools` 与 `--no-mcp` 正交。
  - `src/index.ts` — `init` 命令注册 `--tools`；action 捕获 init 抛错打印并 `exit(1)`（原未知 id 场景 exit 0）
  - `src/commands/editors.ts` — 新增 `resolveToolsArg` 纯函数与 `getAllAdapters()`；`installCommand` 已自动建目录使未检测编辑器可装
  - `src/commands/init.ts` — `InitOptions.tools`、`InitDeps`（prompt/isTTY/homeDir 注入）、`promptSelectEditors`；移除 `detected.length === 0` 提前 return（原 0 检测连脚手架都不生成）
  - `package.json` — 新增依赖 `@inquirer/prompts`
  - `tests/editors-tools.test.ts` — `resolveToolsArg` 13 个用例；`tests/init.test.ts` — `--tools` 分支 + 交互注入共 10 个用例
  - `README.md` / `README.zh-CN.md` — CLI 注释、Usage「Selecting Editors on Init / 初始化时选择编辑器」一节

### Changed

- **employee-standards 新增「工具调用纪律（防循环）」**. §3 工具使用新增子节：一次只发一个工具调用、并行仅限真正独立调用、发现重复调用立即停止、长会话接近上限先压缩上下文。同步 `docs/script.js` 内嵌标准（ZH + EN）。

- **init/update 对裸 `@AGENTS.md` 的 CLAUDE.md 加提示**. 检测到 CLAUDE.md 只有裸 `@AGENTS.md` 导入（openspec CLI 或用户手写、无 OPENSPEC 标记）时，行为保持不干预，但提示「CodeGraph 优先约束未写入，删除该行后重跑 openspec-pw update 可启用」。
  - `src/commands/editors.ts` — `installClaudeWrapper` 裸导入分支
  - `src/commands/update.ts` — standards 相位漂移检查

### Fixed

- **release 脚本 commit message 变量未展开**. `git commit -m 'docs: bump version badge to v${npm_package_version}'` 用单引号导致 `${npm_package_version}` 字面输出，每次发布留下 `v${npm_package_version}` 字面 commit message。改为双引号，shell 展开 npm 注入的环境变量。
  - `package.json`

## [0.3.66] - 2026-08-11

### Added

- **Pi 与 Oh My Pi (omp) 支持**. 新增两个编辑器适配器：Pi 通过 `.pi/prompts/opsx-e2e.md` 提示词模板（文件名即命令名，`argument-hint` 提示参数）；Oh My Pi 通过 `.omp/commands/opsx-e2e.md` 原生命令（`name` + `description` frontmatter）。两者原生读 `AGENTS.md`，无需包装文件；检测信号为项目 `.pi/` / `.omp/` 目录或全局 `~/.pi/agent/` / `~/.omp/agent/` 配置目录（`detectAdapters` 新增可注入 `homeDir`，测试保持封闭）。
  - `src/commands/editors.ts` — `EditorId` 扩为 6 个、接口新增 `supportsMcp`、Pi / omp 适配器
  - `src/shared/mcp.ts` — `supportsMcp:false` 的适配器跳过全部 MCP 相位（Pi 无 MCP 客户端，探索走 `openspec-pw explore`）
  - `src/commands/doctor.ts` — MCP 分类对 Pi 记录 `ok:true` 信息性检查（不阻断 exit code）
  - `tests/editors.test.ts` — 新增 21 个 pi/omp 用例；既有 detectAdapters 用例注入 fake home 防环境依赖
  - `README.md` / `README.zh-CN.md` — 编辑器支持、init 检测、doctor 表、架构树同步

### Changed

- **CLAUDE.md wrapper 沉淀官方依据**. `@AGENTS.md` 是 Claude Code 官方记载的复用 AGENTS.md 机制（AGENTS.md 默认不读），位置无关（官方 "anywhere in your CLAUDE.md"）、唯一要求是 `@` 行不在反引号/代码块内；相对 CLAUDE.md 解析、递归上限 4 跳；OPENSPEC:START/END 块级注释在注入上下文前被剥离，marker 内的 `@AGENTS.md` 仍生效。
  - `src/commands/editors.ts` — `claudeWrapperStandardsContent` JSDoc 记录契约
  - `README.md` / `README.zh-CN.md` — AGENTS.md 加载机制补充官方依据

## [0.3.65] - 2026-08-08

### Added

- **docs 网页版内嵌标准同步**. `docs/script.js` ZH + EN 补齐「过时的直接删（不留 fallback）」🔴、管道命令改源码升级 🔴；删除已从通用规范移除的「禁止跨阶段跳步」残留行。与 employee-standards 保持关键一致。
  - `docs/script.js`

- **employee-standards 补齐 6 条工程选型/架构原则**. §1 代码质量新增「过时直接删（不留兼容层/迁移/fallback）」「优先成熟库」「选型先翻已有依赖」「用成熟产品验证过的模式」；§4 大规模任务新增「先跑通最小端到端再增量」「架构决策往长了做（不留临时方案）」。其中 3 条标 🔴（违反→静默 bug/安全漏洞）：fallback 静默降级、数据编撰、管道命令改源码。
  - `employee-standards.md`

### Changed

- **employee-standards 收敛去重**. §2/§3/§5 重复规则改为单一事实源：跨阶段跳步并入 §4、编辑循环引用 §1、验证证据归 §7；删除 §3 搜索分层残留的 CodeGraph 覆盖说明行；CodeGraph 优先节违反理由句删除（规则自足）。docs 版本 badge 边框改 rgba 兼容旧浏览器。

## [0.3.64] - 2026-08-06

### Added

- **`openspec-pw doctor` Sync 分类**. 检测已初始化项目里 AGENTS.md / CLAUDE.md 的 OPENSPEC 标记段与当前已装包模板是否漂移。纳入 `--json` 与 exit code，但以"是否初始化过"为闸门——未初始化项目记 `ok:true`（不阻断 CI），已初始化但标准过期记 `ok:false` 并提示 `openspec-pw update`。措辞中性（"OPENSPEC block differs from bundled version（手动修改或旧版模板）"），不归因用户修改。
  - `src/shared/drift.ts` — 新增纯函数（提取 OPENSPEC 段、内容相等比较、定位本地已装包模板，零网络）
  - `src/commands/doctor.ts` — 新增 Sync 分类 + 初始化闸门

- **employee-standards.md 新增 §7「浏览器验证证据链」**. 定义「什么算浏览器验证通过」的证据标准：改了用户可见可交互的东西就必须在浏览器里证明；自检不留测试代码，验证须覆盖（构建新鲜度 / 登录态真实性 / 期望锚定 spec / 控制台与网络无错）；截图不等于行为验证；有验证价值的浏览器路径必须写成 Playwright 测试、**提交前实跑（不依赖 CI / commit / PR 机制）**；含断言的临时脚本转正或删除。§5 数据编撰禁令同步扩展：验证期望值禁止编造、验证证据不得编造或复用旧证据。
  - `employee-standards.md`、`docs/script.js`（ZH + EN 内嵌标准）

### Changed

- **`openspec-pw update` 改为漂移感知**. 命令/标准相位先比较内容，与当前已装包模板一致时 no-op（不改文件 mtime），不一致才覆盖；覆盖前打印"检测到非模板内容将被覆盖"。AGENTS.md / CLAUDE.md 标记段、BasePage.ts 仅在漂移时重写；seed.spec.ts 仅警告不覆盖。
  - `src/commands/update.ts` — standards/commands 相位漂移判断
  - `src/commands/editors.ts` — 新增 `readOpenSpecBlock` / `blockMatchesExpected`，导出 `claudeWrapperStandardsContent`
  - `tests/drift.test.ts` — 新增纯函数测试；`tests/update.test.ts` / `tests/editors.test.ts` / `tests/doctor.test.ts` 扩展

### Fixed

- **`--no-mcp` 未注册 bug**. `openspec-pw update` 的 `--no-mcp` 之前未被 `index.ts` 注册，用户传入被静默忽略（`options.mcp` 恒为 undefined）。现已补注册，`update --no-mcp` 跳过 Playwright MCP 相位；CLI 自重启时也正确转发 `--no-mcp` / `--no-skill`，避免重启进程重跑已跳过的相位。

- **漂移判断边缘情况（code review 确认 7 个 bug）**. `compareBlock` 做 CRLF 归一化（Windows / macOS 不再误报）；单边 marker（只有 START 或只有 END）判为 stale 而非跳过，`installOpenSpecBlock` 遇到截断 marker 修复重建干净完整段，不再死胡同；AGENTS.md 作为唯一事实源**总是**检查（claude-only 项目也不例外）、无 marker 判 stale 需追加；Cursor skill 的 `extraArtifacts` 纳入命令 drift 检查；`installClaudeWrapper` 改用内容比对，过期内容能被正确清除。
  - `src/shared/drift.ts`、`src/commands/editors.ts`、`src/commands/update.ts`、`src/commands/doctor.ts`

## [0.3.63] - 2026-08-05

### Changed

- **CodeGraph 规则升级为「默认第一步」**. `employee-standards.md` 文首「CodeGraph 优先」从引导式（先…自行判断）改为明确默认动作：结构性任务（定位定义、调用链、影响面、流程）默认第一步调用 `codegraph_explore`，grep/read 仅用于字面文本、已打开文件、或结果不足时补查。`openspec-pw init`/`update` 现在把 CodeGraph 优先节直接写入 Claude 的 `CLAUDE.md`（OPENSPEC 标记段内、`@AGENTS.md` 引用之前），不再依赖引用文件；init 末尾检测到 codegraph 已安装但项目未索引时提示 `codegraph init`。同步 `docs/script.js` 内嵌标准（ZH + EN）。

## [0.3.62] - 2026-08-05

### Changed

- **CodeGraph 优先规则改为引导式，不再禁止内置工具**. `employee-standards.md` 文首「CodeGraph 优先」从「必须先调用 `codegraph_explore`，不要直接 grep / find / 读文件」改为「结构/定位问题先 `codegraph_explore`，字面文本/已打开文件用 grep/read，自行判断」，并补充无 `.codegraph/` 时跳过的说明。同步 `docs/script.js` 内嵌标准（ZH + EN）。

## [0.3.61] - 2026-08-05

### Added

- **CodeGraph 优先规则置顶员工标准**. `employee-standards.md` 新增文首「CodeGraph 优先」节：存在 `.codegraph/` 时理解/定位代码前必须先调用 `codegraph_explore`（🔴 CRITICAL）。§4 搜索分层改为引用文首，去除重复指令。同步更新 `docs/script.js` 内嵌标准（中英文各加 CodeGraph First 节）。

- **移除 §3 架构 Invariants**. `employee-standards.md` 删除「3. 架构 Invariants」整节（项目特定约束，不再作为通用员工标准下发），后续章节重编号（4→3、5→4、6→5、7→6），§6→§5 交叉引用同步更新。

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

- **Cline editor support**. `openspec-pw init` now auto-detects Cline (`.cline/` or `.clinerules/` directory) alongside Claude Code and OpenCode, installing the `/opsx-e2e` skill and Playwright MCP for it.
  - `src/commands/editors.ts` — new `clineAdapter` (id `"cline"`), `formatClineCommand`, `getClineCommandPath`, `hasCline`; `.cline/mcp.json` read/write helpers; registered in adapter registry
  - `src/commands/init.ts` — detection prompt and MCP error messages updated for three editors
  - `src/commands/update.ts` — `hasCommand` check includes `.cline/skills/opsx-e2e/SKILL.md`
  - `src/commands/doctor.ts` — fallback hint lists all three editors
  - Cline conventions: skill at `.cline/skills/opsx-e2e/SKILL.md` (YAML frontmatter `name`+`description`, body rewritten `/opsx:`→`/opsx-`), MCP at `.cline/mcp.json` (`mcpServers` structure), `AGENTS.md` auto-detected natively (no wrapper file)
  - `tests/editors.test.ts` — 25 new Cline tests (adapter metadata, detection, command path/format, MCP CRUD, installCommand)
  - `tests/smoke.test.ts` — Cline added to `installCommand` and dist-exports checks
  - `README.md`, `README.zh-CN.md` — Cline added to supported editors, usage, prerequisites, architecture diagram

## [0.3.57] - 2026-07-16

### Enhanced

- **`openspec-pw doctor` checks expanded by 5 items.** Previously the command verified basic tool presence (Node, npm, Playwright CLI, OpenSpec directory) but missed several failure modes users actually hit:
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

- **`init --seed` flag removed (BREAKING)**. The `--seed` flag only force-overwrote `seed.spec.ts` but no other generated files. Same effect achieved by `rm tests/playwright/seed.spec.ts && openspec-pw init`. Reduces CLI surface and maintenance burden.
  - `src/index.ts` — removed `--seed` option
  - `src/commands/init.ts` — removed `seed` from `InitOptions` and `generateSeedTest` `force` parameter
  - `README.md`, `README.zh-CN.md` — removed `--seed` from CLI description

- **`openspec-pw run <name>` command removed (BREAKING)**. The command was never end-to-end validated: CI ran unit tests on its parser helpers but never spawned `playwright test` against a real project, and users overwhelmingly run `npx playwright test` directly. The reported benefits (markdown report generation, port-conflict detection) never shipped in a way users actually used. Removed to reduce CLI surface and stop pretending a feature is production-ready when it has never been exercised.
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

- **Docs site: removed decorative clutter**. Removed `bg-grid-overlay` (Vercel-style grid) and `bg-bottom-glow` (bottom-right amber glow) layers from the hero background. The hero's mesh-gradient and animated SVG decorations are retained.
  - `docs/index.html`, `docs/style-base.css` — removed two decoration layers

- **Docs site: removed hero CLI demo**. The hero previously rendered a fabricated `openspec-pw run` transcript (Planner → Generator → Healer with invented timings) which never matched real output. Removed because the decoration conveyed no product meaning and its content violated the "no fabricated data" rule.
  - `docs/index.html`, `docs/style-sections.css` — removed `.cli-demo` block (124 lines)

## [0.3.55] - 2026-07-12

### Changed

- **Employee standards: frontend UI design trio**. Added `frontend-design` + `ui-ux-pro-max` + `web-design-guidelines` skill combination to §4 tool usage, with explicit invocation order.
  - `employee-standards.md` — new 🟡 rule
  - `docs/script.js` — ZH + EN templates synced

- **Employee standards: agent-reach priority upgraded**. Promoted `联网调研优先 agent-reach skill` from `⚪ STANDARD` to `🟡 IMPORTANT` in §4 tool usage, reflecting that anti-bot blocks make WebFetch/WebSearch unreliable for site-specific research.
  - `employee-standards.md`, `docs/script.js` — synced


## [0.3.52] - 2026-07-06

### Fixed

- **`openspec-pw update`: AGENTS.md not created on first run after upgrade**. The old binary ran `npm install -g` but continued with stale code that predated AGENTS.md support. After successful CLI update, the process now re-executes `openspec-pw update --no-cli` with the freshly-installed binary so post-CLI steps (templates, commands, AGENTS.md) run with the latest code. Falls back gracefully to the old binary if re-execution fails.
  - `src/commands/update.ts` — re-execution block after CLI update

### Changed

- **CI: 1500-line max per source file**. New CI step fails if any scanned source file (`*.ts`/`*.tsx`/`*.js`/`*.mjs`/`*.css`/`*.md`/`*.html`) exceeds 1500 lines. Skips vendored dirs (`node_modules`, `dist`, `.git`, `.opencode`).
- **Deploy Docs auto-retry**. GitHub Pages deploys occasionally fail with a transient `Deployment failed, try again later` error. The `pages.yml` workflow now retries via `gh api` and falls back to re-triggering the workflow.
  - `.github/workflows/pages.yml` — `continue-on-error` + retry step (env-var based, no Actions injection)
- **Employee-grade standards: 1500-line rule**. Added to `employee-standards.md` §1 and the `docs/script.js` CLAUDE.md templates (ZH + EN).

### Added

- **Tests for `cleanProjectRules`**. 9 new unit tests covering AGENTS.md always-clean, CLAUDE.md conditional clean, blank-line collapse, empty-file deletion, idempotency, CRLF line endings, and missing-file / no-marker no-ops. Plus an OpenCode-only assertion that `opencode.jsonc` registers `AGENTS.md` in `instructions`.
  - `tests/editors.test.ts` — 233 → 242 tests

## [0.3.51] - 2026-07-05

### Changed

- **`editors.ts`: AGENTS.md is now the single source of truth (SSOT) for employee-grade standards**, regardless of which editors are detected. CLAUDE.md becomes a thin wrapper with `@AGENTS.md` import (when Claude is in use); `opencode.jsonc` instructions register `AGENTS.md`. Migrates old-format CLAUDE.md (direct standards inside OPENSPEC markers) to the wrapper on next install.
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

- **AI Coding Assistants section** on the docs site — Claude Code and OpenCode shown side-by-side as first-class citizens, each with its own icon, command (`/opsx:e2e` vs `/opsx-e2e`), and feature list. Nav gains an "Editors" link.
- **Artistic background layers** on the docs site: SVG fractal noise (film grain), Vercel-style grid pattern with radial mask, top aurora gradient, bottom-corner amber glow, and an animated 4-blob mesh gradient in the hero.
- **Stripe/Cursor-grade design polish** on the docs site: 500-weight display type, `tabular-nums` on all numeric UI, glassmorphism cards (`backdrop-filter` + inset highlight), hairline borders (`rgba(28,25,23,0.08)`), magnetic primary CTA, scroll-reveal via `IntersectionObserver`, shimmer-sweep button hover.
- **Split `docs/index.html`** (2533 lines) into `index.html` (~850) + `style-base.css` + `style-sections.css` + `style-extra.css` + `script.js`. All resources served as separate files; GitHub Pages compatible.
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

- **Temp file management rule** (`employee-standards.md` §7): all non-source temp files (Chrome DevTools MCP screenshots, logs, heapdumps, etc.) must go in `tmp/` at the project root, flat layout, timestamped filenames; files older than 24h may be deleted before commit. Mirrored into the `docs/script.js` CLAUDE.md templates (ZH + EN).
  - `employee-standards.md` — new §7
  - `.gitignore` — `tmp/` ignored, `tmp/.gitkeep` tracked
  - `docs/script.js` — CLAUDE_MD_ZH + CLAUDE_MD_EN

## [0.3.46] - 2026-07-01

### Added

- **`openspec-pw coverage [change-name]`**: New command for spec–test coverage analysis. Analyzes OpenSpec changes against Playwright test files across 5 levels (L1 directory → L5 edit-distance similarity). Reports per-change coverage %, uncovered scenarios, orphaned tests, and recommendations. Supports `--json` output.
  - `src/commands/coverage.ts` — core analysis (scenario parsing, test case parsing, L1-L5 matching, route extraction, report rendering)
  - `src/index.ts` — registered as lazy-imported command
- **`openspec-pw flake [change-name]`**: New command for static flake pattern detection in Playwright test files. Detects 4 patterns: `waitForLoadState('networkidle')` in SPAs, `page.route()` registered after `page.goto()`, `storageState` leakage across isolation boundaries, and conflicting `test.use({ storageState })` scopes. Supports `--json` and `--gate <severity>` (HIGH/MEDIUM/ALL).
  - `src/commands/flake.ts` — core detection (regex, line-ordering, and heuristic analyzers)
  - `tests/commands/flake.test.ts` — 25 unit tests covering all detectors and report helpers

### Fixed

- `openspec list --json` returns `{"changes": [...]}` format in openspec v1.4.1; `getChangeNames` in both `audit` and `coverage` commands now handles the wrapped format in addition to the legacy formats
- `/opsx-e2e` not responding in OpenCode: compressed `e2e-command.md` template from 1173 to 313 lines (75%); the 65KB template exceeded OpenCode's config output size limit, causing the command to register silently but never match. Simplified structure with all decision logic, Healer phases, and guards preserved.

### Performance

- **CLI startup time reduced 93%**: replaced top-level static imports of all 8 command modules with dynamic `import()` in action handlers. `--help` now loads only `commander` (~0.17s vs ~2.3s). Command module loading deferred to first execution — ESM cache ensures no overhead on repeat calls.

## [0.3.45] - 2026-06-30

### Fixed
- `openspec-pw explore`: `## Exploration Failures` section in `app-exploration.md` is now replaced on re-run instead of duplicated (stale tables on every invocation).

### Changed
- `openspec-pw doctor`: Node < 22 reports `⚠ Node < 22 deprecated by GitHub Actions; recommend Node 22+` inline.
- `openspec-pw audit`: when sitemap fetch fails or no `BASE_URL` is set, an explicit note is shown explaining the route coverage check was skipped (previously silent skip).
- `openspec-pw explore`: dropped the fake "worker N" abstraction; routes now run sequentially in a single browser with honest output. `--parallel` flag is kept for backward compat but ignored.

## [0.3.44] - 2026-06-29

### Added

- **App server auto-detection**: generated `playwright.config.ts` now detects `BASE_URL` from env, package script `--port`, `vite.config.*` `server.port`, `.env*` port variables, and framework defaults (Vite 5173, Astro 4321, Next/Nuxt 3000).
- **Doctor app diagnostics**: `openspec-pw doctor` now reports detected dev script, detected base URL, and a non-blocking reachability check so `webServer` timeouts are easier to diagnose.
- **Existing config patch hints**: `openspec-pw init` now prints recommended checks when `playwright.config.ts` already exists instead of silently skipping all config guidance.
- **OpenCode support** (SST): auto-detected during `init` when `.opencode/` exists; the E2E command is installed as `/opsx-e2e <change-name>` (hyphenated per OpenSpec convention; command body rewritten from `/opsx:` to `/opsx-` during install and stored at `.opencode/commands/opsx-e2e.md`).
- **EditorAdapter pattern**: multi-editor architecture in `src/commands/editors.ts` with `claudeAdapter` (existing) and `opencodeAdapter` (new) — any future editor only needs a new adapter, no CLI rewiring.
- **Project rules routing**: `installProjectRules` helper writes employee-grade standards to `CLAUDE.md` (Claude Code, or both editors present) or `AGENTS.md` (OpenCode only), and sets `opencode.jsonc.instructions` so OpenCode picks the file up natively.

### Changed

- `seed.spec.ts` and `pages/BasePage.ts` now use Playwright `use.baseURL` when `BASE_URL` env is unset, so auto-detected ports work without duplicating the URL in every generated test helper.
- Internal TypeScript API change: `isPlaywrightMcpInstalled` / `ensurePlaywrightMcp` / `removePlaywrightMcp` now take an `EditorAdapter` first argument. This affects source consumers only; CLI behavior is unchanged.

### Dependencies

- Added `jsonc-parser` for safe `opencode.jsonc` editing (preserves comments and formatting while merging MCP + `instructions` entries).

## [0.3.35] - 2026-06-10

### Added

- **Version update hint**: after each command (except `update`), the CLI checks npm for a newer version once per 24 hours (cached in `~/.openspec-pw-version.json`). Shows a one-line hint when outdated: `💡 A new version of openspec-pw is available: X → Y. Run: npm install -g openspec-playwright@latest`

### Changed

- **Unified `execFile` style**: replaced all remaining `execSync` calls in `doctor.ts` and `init.ts` with `execFileSync` + args array + `shell: needsShell`. All child_process calls now use the same cross-platform pattern.

### Fixed

- **Removed redundant `bin/openspec-pw` shell wrapper**: this script caused npm publish warnings (`"bin[openspec-pw]" script name was invalid and removed`). The `.js` wrapper already handles CWD restoration and package root resolution.

## [0.3.34] - 2026-06-09

### Fixed

- **Windows: `spawn EINVAL`** — v0.3.33 attempted a `.cmd` suffix approach (`npm.cmd`) which caused `EINVAL` on Windows. The correct fix is `shell: true` — Node properly quotes args-array items, so paths with spaces are safe. Changed `cmd()` helper to `needsShell` boolean constant.

## [0.3.33] - 2026-06-09

### Fixed

- **Windows: `spawn npm ENOENT`** in `update`, `init`, `doctor`, `audit`, `run`, `mcp` commands. On Windows, `npm`/`npx`/`claude` are `.cmd` batch files — not bare executables. Node's `execFile()` (without `shell: true`) only looks for exact executable names and fails because there is no `npm` binary, only `npm.cmd`. Added cross-platform `needsShell` constant in `src/shared/platform.ts` (`true` on `win32`) and added `shell: needsShell` to all `execFile`/`execFileSync` calls across 6 files.


### Fixed

- `src/commands/update.ts`: cross-platform `update` command fixes for Windows + devDep-shadow scenarios. Three issues were stacked:

  1. `npm pack --pack-destination ${tmpDir}` used shell string interpolation. On Windows with paths containing spaces (OneDrive, CJK user names), cmd.exe tokenized the path incorrectly. Replaced with `execFile("npm", ["pack", "openspec-playwright", "--pack-destination", tmpDir])` so the path is passed verbatim.
  2. `npm install -g` and `npm install -D` calls used `execSync` with a shell string. Migrated to `execFile` with arg arrays for the same reason.
  3. Three `catch {}` blocks silently dropped `err` so users saw only "Failed to update" with no clue why. Now every catch binds `err` and prints `err.message` so the actual npm stderr reaches the user.

  Also added a `checkVersionShadow` self-check that runs at the end of `update()`. It compares the package version Node actually loaded (via `createRequire(import.meta.url).resolve("openspec-playwright/package.json")`) against the latest published version. If they differ — most commonly because a `devDependencies` entry in the user's `package.json` is shadowing the global CLI binary (Node module resolution prefers local `node_modules` over global) — it prints a clear warning with the resolved path and the fix (`npm uninstall openspec-playwright` then re-run update, or `npm install -D openspec-playwright@latest`).

- `src/commands/init.ts`, `src/commands/doctor.ts`: two more `npx ... --version` calls used `execSync` / shell string with bash-isms (`2>/dev/null`, `||`) and would tokenize wrong on Windows. Migrated both to `execFileSync` with arg arrays, matching the `update.ts` migration above.

- Documentation install commands: every `npm install -g openspec-playwright` (and `@fission-ai/openspec`) reference across `README.md`, `README.zh-CN.md`, `docs/index.html`, and the user-facing prompt strings in `src/commands/init.ts` and `src/commands/update.ts` was missing the `@latest` tag. Without it, `npm install -g openspec-playwright` may resolve to a cached older version instead of the current release. All 12+ call sites now pin to `@latest`.

### Changed

- `openspec-pw init`: removed the `--no-seed` option. The default behavior (skip seed generation if `tests/playwright/seed.spec.ts` already exists) already covers the use case. To refresh a stale seed, run `openspec-pw init --seed`; to skip seed entirely, delete the existing `seed.spec.ts` and re-run `init`. Two remaining options: `--seed` (force overwrite) and the implicit "skip if exists" default. ⚠️ Minor breaking change — any script passing `--no-seed` will see "unknown option" and fail.

- gstack is no longer a hard prerequisite. Previously `README.md`, `docs/index.html`, and `templates/e2e-command.md` treated gstack (which provides the `/browse` slash command) as required for browser exploration. In practice, `openspec-pw explore --parallel N` (built-in) and Playwright MCP (already required for the Healer) cover the same need without an extra Bun + gstack install. Reorganized `README.md` / `README.zh-CN.md` Prerequisites into Required (4) + Optional (1, gstack) and added a "Optional" hint at the end of the 9-step First-Time Setup Checklist. `docs/index.html` now shows gstack as an Optional card with a `（可选）` label and a one-line command at the bottom of the quickstart section. The "How It Works" workflow diagram no longer says `/browse explores real DOM`; it lists the three available tools.

- `templates/e2e-command.md` rewritten to be tool-agnostic. Removed all 18 hard-coded `$B <sub>` calls (gstack-specific shell syntax) and replaced with intent-level descriptions: "navigate to <url>", "snapshot DOM", "evaluate JS", "check console for errors", "check network requests", "take a screenshot". Step 4 prerequisites reduced to "at least one browser exploration tool installed". The Parallel Exploration section header was clarified to read "Alternative" and now explicitly says "skip 4.2 and use the dedicated CLI". Step 4.1's "Verify BASE_URL" no longer shows `$B goto` (it just says "navigate to <BASE_URL>"). Step 4.2's "Explore each route" is now one line of intent. The Step 9 "Available options" list under `openspec-pw run` was expanded from 3 placeholder options (`--project <role>`, `--headed`, `--update-snapshots`) to the full set of 12 options actually declared in `src/index.ts:55-72` (corrected the `--project <role>` typo to `--project <name>`, and added `--timeout`, `--json`, `--grep`, `--smoke`, `--workers`, `--app-bugs`, `--healed`, `--raft`, `--escalated`). The RAFT detection hint was rephrased from "Full suite: test fails" (which contradicted the L28 "Do NOT run npx playwright test" rule) to "If you already ran the suite and a test failed".

- `employee-standards.md` §0 was tightened: the redundant "E2E 工作流前提" line (which said "工具链（gstack / OpenSpec CLI / openspec-playwright）由用户安装并维护，AI 不做安装操作") was removed, leaving only the single rule the project agreed on: "动手前读 openspec/config.yaml".

## [0.3.31] - 2026-06-04

### Fixed

- `docs/index.html`: "1 安装步骤" h3 was not rendering its title — `.quickstart-install h3 span` selector was too broad and leaked the 22×22 red-badge styles onto the title text spans. Tightened the selector to `:first-child` so only the numeric badge gets the badge styles.
- `docs/index.html`: `CLAUDE.md 一键配置` section header was pinned to the left edge while every other section's header sat centered. The `#claude-config` section used inline `max-width: none` so its background stripe could span the viewport, which also stretched the inner section header to full width. Added `#claude-config .section-header { max-width: 1160px; margin: 0 auto }` to re-center the header without affecting the background stripe.
- `docs/`: stale `openspec-pw vision-check` removed from CLI lists in `README.md` and `README.zh-CN.md` (the command was deleted from `src/index.ts`); `openspec-pw run <name>` added to the CLI list (was only mentioned in the Architecture section); `explore` added to the Architecture CLI tree; `doctor` description tightened.
- `package.json`: `release` script now commits the `docs/index.html` badge update after `bump-docs.js` — previously it was just `git add`, never `git commit`, so the live page badge never advanced after release.
- `.gitignore`: replaced `.github/` + bare `!.github/workflows/` with `.github/*` + `!.github/workflows/**` so workflow files are properly un-ignored; `.github/workflows/ci.yml` is now tracked.

### Changed

- `docs/index.html`: a11y + SEO pass — adjusted color tokens (`--accent #e85d04 → #9a3412`, `--muted #78716c → #57534e`, `--green #16a34a → #15803d`, `--accent-dark #c2410c → #7c2d12`, `--step6 #dc2626 → #b91c1c`; `.terminal-comment rgba(255,255,255,0.35) → #a8a8a8`; `.tag-*` inline colors updated) to fix 60+ color-contrast violations; wrapped page sections in `<main>...</main>`; added `docs/robots.txt` and `docs/llms.txt` (H1 + section format, llmstxt.org). **Lighthouse snapshot 90/100/80/50 → 100/100/100/100**.
- `docs/index.html`: hero floating card changed from "Test Status" placeholder to a "Today's E2E" dashboard with 4 KPI lines (test cases / AI verified / Healer fixed / failures).
- `docs/index.html`: quickstart terminal replaced 5-line comment block with the actual install + run command sequence (npm install → openspec init && openspec-pw init → playwright install → /opsx:e2e), with a `.terminal-divider` between sections.
- `docs/index.html`: GitHub button gained the octocat SVG icon (16×16), balancing the primary "Quick Start" CTA next to it.
- `docs/index.html`: spacing pass — `.hero-title` `line-height: 1.0 → 1.08`; `.stack-item` `gap 10 → 14px`, `padding 28 → 32px`; `.step-header` `margin-bottom 10 → 14px`; `.step-tags` `margin-top 10 → 14px`.
- `docs/index.html`: synced the `动手前读 openspec/config.yaml` rule from `employee-standards.md` §0 into the webpage's CLAUDE.md one-click config template (both `CLAUDE_MD_ZH` and `CLAUDE_MD_EN`).
- `.github/workflows/`: added `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: 'true'` to opt into Node 24 action runtime ahead of the 2026-06-16 Node 20 deprecation.

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

### Docs

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

### Dependencies

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
- `openspec-pw explore` command: parallel route exploration via N independent Chromium workers, each with its own browser context (no shared state). `--parallel <n>` sets worker count (default 4, max 16). `--dry-run` previews chunk assignment. Built-in auth redirect detection (compares final URL vs expected URL to flag protected routes), atomic write with backup, lock file to prevent concurrent runs, SIGINT/SIGTERM cleanup handlers.
- CLI: `openspec-pw run --smoke` to run only smoke tests (`--grep @smoke`)
- CLI: `openspec-pw run -w/--workers <n>` to control parallel worker count
- CLI: `openspec-pw run --grep` combined with `--smoke` produces AND pattern (all regex chars escaped)
- SKILL.md Step 4.5: Route Snapshot Hash — sitemap.xml hash to skip unchanged routes on re-runs
- SKILL.md Step 6: Selector Caching — reuse Step 4 exploration selectors in test generation (~30-50 fewer navigations per 50-test suite)
- playwright.config.ts: CI workers default raised to 4 (from 1)

### Fixed
- SKILL.md Step 4.2: removed broken `Promise.allSettled` + `$B` parallel approach (caused data pollution due to shared Chromium instance). Replaced with `openspec-pw explore` redirect.
- `openspec-pw explore`: added auth redirect detection (prevents HTTP 200 + login page being reported as "ok"), atomic write with backup, lock file (30min TTL + stale-lock auto-detection), signal handlers, max workers cap.
- `openspec-pw explore` lock file: stale locks (>30min) are auto-removed; process.alive check via `kill(pid, 0)` prevents false "already locked" errors from crashed processes.
- `openspec-pw run`: `--grep` and `--smoke` now combine into AND pattern with full regex escaping (previously last flag won, silently dropping the other).

### Performance
- **Healer Phase 2**: batch diagnosis first (read specs + app-knowledge.md, no Playwright overhead), then apply ALL fixes + single `--workers=1` run for all Phase 2 tests as one combined grep. Eliminates N×M Playwright startups where N=failures, M=heal attempts. Estimated ~15-20s saved per eliminated startup.
- **Healer Phase 2**: `--workers=1` sequential isolated execution eliminates data races from shared Playwright state (previously parallel workers polluted each other's state causing cascading failures).
- **Parallel exploration**: 4 workers default (up to 16) — each worker launches independent Chromium, true parallelism vs sequential single-process. Estimated exploration time reduced by ~3-4x.

## [0.3.0] - 2026-04-12

### Changed
- `employee-standards.md`: complete rewrite — add 6-chapter structure (适用范围、浏览器操作约束、代码质量、上下文管理、大规模任务处理、工具限制与编辑安全) + 完整生产工作流（含步骤详解 + 反馈循环表）；4轮深度检查后 P0/P1 问题全部修复

- `SKILL.md` v2.24: Mock Data Rule 大幅扩展 — Frontend mocking 禁止（禁止 mock JS 变量/组件状态，否则隐藏真实集成问题）；API mocking 仅限 HTTP 层（`page.route()` 拦截，不能 mock 数据库/后端服务）；使用前必须用户授权（列 reason + endpoint + expected behavior）；业务计算类断言必须用 API 验证（余额、总数、折扣等）；移除 5 处模板路径引用（模板已通过 `openspec-pw init/update` 同步到项目本地）；test-plan.md 的 test case 如需 API mock 则标记 `⚠️ API Mock`

- `docs/index.html`: Hero 按钮布局修复 — `.hero-desc` 和 `.hero-actions` 同处 grid row 3 导致 margin-bottom:36 + margin-top:80 = 116px 间隙；改为 grid 行 4 分离；`employee-standards.md` Step 5 同步 CSS 审计步骤

- `employee-standards.md`: Step 5 CSS 审计升级为两步式框架感知方法 — 1) 确定间距基准 → grep 提取值对比基准，列低于基准的项；2) 检查 margin hack（同一 grid/flex 容器中相邻元素 margin 和 > 基准 2 倍 → 改为 grid 行或 gap 控制）；移除写死的阈值数字；描述精简（14 行→7 行）

## [0.2.9] - 2026-04-10

### Changed
- `SKILL.md` v2.22: Phase 2 Step 5 selector repair — split into 5a Extract (structured candidate list with stability ranking: Stable/Fair/Fragile, project-specific upgrade via Common Selector Patterns) and 5b Select (top candidate with reason); Selector Fixes log adds date field; add "Before Phase 1 — check accumulated knowledge" step to leverage app-knowledge.md Selector Fixes table for known fixes (closes the learning loop); add file-missing guard

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
