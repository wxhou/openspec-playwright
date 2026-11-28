# OpenSpec + Playwright E2E 验证

[English version](./README.md)

[![npm version](https://img.shields.io/npm/v/openspec-playwright.svg)](https://www.npmjs.com/package/openspec-playwright)
[![npm 下载量（月）](https://img.shields.io/npm/dm/openspec-playwright.svg)](https://www.npmjs.com/package/openspec-playwright)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node >= 22](https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg)](https://nodejs.org)

**OpenSpec 项目获得与代码同住的 AI 驱动 E2E 验证。** 一条 `/openspec-e2e <change>` 命令（支持十六款编辑器）按 spec 规划、生成、执行并自愈 Playwright 测试，附每 change 报告，无需手搭脚手架。

> **为什么有这个工具**：spec 驱动的开发没有测试自动化是半截闭环。本工具把它补完——写 change spec，跑一条命令，拿到可追溯到 spec 锚的测试，外加一份说明什么通过、什么自愈、什么留待人工的报告。

## 目录

- [安装](#安装)
- [前置条件](#前置条件)
- [初始化](#初始化)
- [支持的 AI 编码助手](#支持的-ai-编码助手)
- [使用](#使用)
- [工作原理](#工作原理)
- [CLI 命令](#cli-命令)
- [初始化时选择编辑器](#初始化时选择编辑器)
- [受管 `.gitignore` 路径](#受管-gitignore-路径)
- [官方 Playwright Agents](#官方-playwright-agents)
- [`openspec-pw init` 做了什么](#openspec-pw-init-做了什么)
- [`openspec-pw doctor` 检查清单](#openspec-pw-doctor-检查清单)
- [认证配置](#认证配置)
- [自定义](#自定义)
- [架构](#架构)
- [许可](#许可)

## 安装

```bash
npm install -g openspec-playwright@latest
```

> 仅支持通过 npm 安装。`openspec-pw update` 通过 `npm install -g` 自更新——用 pnpm/bun/yarn 全局安装会装出第二份冲突副本，不受支持。

## 前置条件

**必需：**

1. **Node.js >= 22**
2. **至少一个受支持编辑器** — 见 [支持的 AI 编码助手](#支持的-ai-编码助手) 表。Pi、Oh My Pi、MiniMax Code、DeepSeek Harness、Gemini CLI、Qwen Code、GitHub Copilot、Roo Code、Codex 与 Kimi Code 也会通过全局配置目录（`~/.pi/agent/`、`~/.omp/agent/`、`~/.minimax-code/`、`~/.dsh/`、`~/.gemini/`、`~/.qwen/`、`~/.copilot/`、`~/.roo/`、`~/.codex/`、`~/.kimi-code/`）检测。
3. **OpenSpec** 已初始化——见[初始化](#初始化)（也支持 1.x：安装 `@1` 后运行 `openspec init`）
4. **Playwright MCP**（用于测试执行 + Healer）— `openspec-pw init` 会在检测到前端信号时自动安装（纯 API 项目跳过——API 测试用 `request` fixture），**全部项目级**（写入上表所列的编辑器项目文件，不碰全局配置）：
   - `playwright-test` — 官方 `playwright init-agents` 的 test-runner server：`{ "command": "npx", "args": ["playwright", "run-test-mcp-server"] }`，写在 `mcpServers` 下（Claude Code 用 `claude mcp add --scope project` 写入项目根 `.mcp.json`；`opencode.jsonc` 嵌在 `mcp` 下）。CodeBuddy 与 MiniMax Code 直接文件读写，不经各自 CLI——CodeBuddy 的 `mcp` CLI 会启动占端口的服务，与运行中的会话冲突。
   - Pi 与 DeepSeek Harness 没有项目级 MCP 客户端，浏览器探索改用 `openspec-pw explore`。

> **同时支持 OpenSpec 1.x 与 2.x**：命名跟随已装主版本（见[命名说明](#支持的-ai-编码助手)）。`openspec-pw doctor` 对两者均通过，3.x 会被拒绝。

> 项目级 server 首次交互使用时 Claude Code 会弹出批准提示（`claude mcp reset-project-choices` 可重置选择）。

> **server 名 `playwright-test` 的来历**：这是 Playwright 官方 `playwright init-agents` CLI 的产物名——同名、同 transport（`npx playwright run-test-mcp-server`，`playwright` 包内置子命令）。它**不是** `@playwright/mcp`（独立 npm 包，注册名 `playwright`，约 67 个 `browser_*` 工具）；test-runner 是它的**超集**（约 80 个工具：完整 `browser_*` 集 + Healer 闭环用的结构化 `test_run` / `test_debug` / `test_list` 工作流工具）。两个 server 名字不同、可共存；搜「Playwright MCP」通常先看到的是 `@playwright/mcp` 的文档。

## 初始化

```bash
# 在项目目录下
openspec init              # 初始化 OpenSpec
openspec-pw init          # 安装 Playwright E2E 集成（--tools 选编辑器，--agents 加装官方 agents）
```

然后每个项目执行一次：

1. `npx playwright install chromium`——Linux CI 镜像加 `--with-deps`；macOS 安装失败时先运行 `xcode-select --install`。
2. 另开终端启动开发服务器（`npm run dev`）；应用不在探测到的端口时设置 `BASE_URL`。
3. `npx playwright test tests/playwright/seed.spec.ts` 验证环境——失败时检查 `playwright.config.ts` 的 `webServer`。
4. 运行 `/openspec-e2e <change-name>`，报告落在 `openspec/reports/`。应用需要登录时先配置认证（[认证配置](#认证配置)；调试用 `npx playwright test --project=setup`）。

## 支持的 AI 编码助手

命名跟随已装 OpenSpec 主版本：下表为 2.x 名称；1.x 下同一批产物装在 `opsx-` 路径（如 `.claude/commands/opsx/e2e.md`），调用名为 Claude Code、CodeBuddy CLI、Gemini CLI 用 `/opsx:e2e`，其余用 `/opsx-e2e`，Codex 为 `$opsx-e2e`，Kimi Code 为 `/skill:opsx-e2e`。

| 编辑器 | 命令 | 产物位置 | Playwright MCP | AGENTS.md 加载方式 |
|---|---|---|---|---|
| **Claude Code**（Anthropic） | `/openspec-e2e <change-name>` | `.claude/skills/openspec-e2e/SKILL.md` + 共享 `.agents/skills/openspec-e2e/SKILL.md` | 是（项目 `.mcp.json`） | 经 `CLAUDE.md` → `@AGENTS.md` |
| **OpenCode**（SST） | `/openspec-e2e <change-name>` | `.opencode/commands/openspec-e2e.md` | 是（`opencode.jsonc`） | `instructions` 字段 |
| **Cline** | `/openspec-e2e <change-name>` | `.cline/skills/openspec-e2e/SKILL.md` | 是（`.cline/mcp.json`） | 原生 |
| **Cursor** | `/openspec-e2e <change-name>` | `.cursor/commands/openspec-e2e.md` + `.cursor/skills/openspec-e2e/SKILL.md` | 是（`.cursor/mcp.json`） | 原生 |
| **Pi**（earendil-works） | `/openspec-e2e <change-name>` | `.pi/prompts/openspec-e2e.md`（文件名即命令名） | **无 MCP 客户端**——改用 `openspec-pw explore` + `npx playwright test`，无 Healer 步骤 | 原生 |
| **Oh My Pi（omp）** | `/openspec-e2e <change-name>` | `.omp/commands/openspec-e2e.md` | 是（`.omp/mcp.json`） | 原生 |
| **CodeBuddy CLI**（腾讯） | `/openspec-e2e <change-name>` | `.codebuddy/commands/openspec-e2e.md` | 是（项目根 `.mcp.json`） | 经 `CODEBUDDY.md` → `@AGENTS.md` |
| **MiniMax Code**（`mcode` CLI） | `/openspec-e2e <change-name>` | `.agents/skills/openspec-e2e/SKILL.md`（技能） | 是（项目根 `.mcp.json`） | 原生（`AGENTS.md`） |
| **DeepSeek Harness**（`dsh`） | `openspec-e2e` 技能 | `.dsh/skills/openspec-e2e/SKILL.md`（技能） | **无项目级载体**——需在 `$DSH_HOME` 的 profile patch 中配置 Playwright MCP | 原生（`AGENTS.md`） |
| **Gemini CLI** | `/openspec-e2e <change-name>` | `.gemini/commands/openspec-e2e.toml`（TOML） | 是（`.gemini/settings.json`） | `GEMINI.md` |
| **Qwen Code** | `/openspec-e2e <change-name>` | `.qwen/commands/openspec-e2e.md` | 是（`.qwen/settings.json`） | `QWEN.md` |
| **GitHub Copilot**（VS Code） | `/openspec-e2e <change-name>` | `.github/prompts/openspec-e2e.prompt.md` | 是（项目根 `.mcp.json`） | `.github/copilot-instructions.md` |
| **Roo Code** | `/openspec-e2e <change-name>` | `.roo/commands/openspec-e2e.md` | 是（`.roo/mcp.json`） | `.roo/rules/openspec-pw.md` |
| **Trae** | `/openspec-e2e <change-name>` | `.trae/commands/openspec-e2e.md` | 是（`.trae/mcp.json`，Project MCP beta） | `.trae/rules/project_rules.md` |
| **Codex** | `$openspec-e2e <change-name>` | `.agents/skills/openspec-e2e/SKILL.md`（技能） | **无 JSON 载体**——项目级 MCP 在 `.codex/config.toml`（TOML，暂不支持） | 原生（`AGENTS.md`） |
| **Kimi Code** | `/skill:openspec-e2e <change-name>` | `.kimi-code/skills/openspec-e2e/SKILL.md`（技能） | 是（`.kimi-code/mcp.json`） | 原生（`AGENTS.md`） |

## 使用

各编辑器命令体相同，只有名称与产物位置不同。带 change 名调用即可，例如 `/openspec-e2e add-checkout`（Codex 为 `$openspec-e2e add-checkout`，Kimi Code 为 `/skill:openspec-e2e add-checkout`）。各编辑器的 MCP、检测与认证细节见 [前置条件](#前置条件)。

<details>
<summary><strong>各编辑器的差异</strong>（默认折叠；只有 init 报错时才需要展开）</summary>

- **Cursor**：skill 设置 `disable-model-invocation: true`（仅在显式调用时加载）。若要用 Cursor 但还没有 `.cursor/`：`mkdir -p .cursor`。
- **Oh My Pi**：若 `.claude/` / `.cursor/` / `opencode.jsonc` 已存在并配置了 MCP，omp 会一并继承。
- **MiniMax Code**：`mcode` CLI 不加载任何用户自定义命令文件，技能是它唯一可扩展的命令机制。**集成目标是 `mcode` CLI；桌面端不在覆盖范围。**
- **DeepSeek Harness**：`.dsh/skills` 是 dsh 的 rank 100 项目级根，优先级高于 MiniMax 方案留下的 `.agents/skills` 副本。dsh 仍是 developer preview，适配器只依赖其已文档化的技能发现契约。
- **GitHub Copilot**：面向 VS Code——MCP 条目为 `stdio`，与 Claude/CodeBuddy/MiniMax 共享；检测只用 Copilot 专属标记，任意仓库的 `.github/` 目录不算。
- **Roo Code**：Roo 会加载 `.roo/rules/` 下全部文件。
- **Trae**：Project MCP 为 beta，旧版 IDE 可能忽略 `.trae/mcp.json`。
- **Codex**：技能目录与 MiniMax Code 共用——取消勾选 Codex 但保留 MiniMax 时技能文件保留；浏览器探索回退 `openspec-pw explore`，测试执行走 `npx playwright test`。
- **Kimi Code**：Kimi 是否自动加载 `AGENTS.md` 官方未明确，该钩子暂按未验证处理。

</details>

### 初始化时选择编辑器

<details>
<summary>预选逻辑、取消勾选 = 移除、编辑器领土</summary>

`openspec-pw init` 默认自动检测项目中的编辑器并全部配置。如需只装一部分（或不装），用 `--tools` —— 语义与 `openspec init --tools` 一致：

```bash
openspec-pw init --tools claude,cursor   # 只配置 Claude Code 与 Cursor
openspec-pw init --tools all             # 配置所有受支持编辑器
openspec-pw init --tools none            # 不配置编辑器，只生成脚手架
```

受支持 id：`claude`、`opencode`、`cline`、`cursor`、`pi`、`omp`、`codebuddy`、`minimax`、`dsh`、`gemini`、`qwen`、`github-copilot`、`roocode`、`trae`、`codex`、`kimi`（`oh-my-pi` 是 `omp` 的别名，`minimax-code` 是 `minimax` 的别名）。id 大小写不敏感、重复自动去重、`all`/`none` 不能与具体 id 混用。被 `--tools` 指定的编辑器即使未被检测到也会配置（会自动创建其配置目录）。

未提供 `--tools` 时：TTY 终端弹出多选，按 `Configured` / `Detected` / `Other` 分组——项目已在用的编辑器预勾选，机器上装有但项目未用的列出不勾选；首次运行只看项目自身信号（根 `CLAUDE.md`、`.cursorrules`、`opencode.json(c)`、`CODEBUDDY.md`）。`--tools` 决定*哪些*编辑器，`--no-mcp` 决定*是否*为它们安装 Playwright MCP。

**规范语言。** `init --lang zh|en` 选择 AGENTS.md 规范块的语言；未传时依次沿用已安装块的语言、操作系统 locale、终端 locale，最后英文。`update --lang` 切换已安装块。不判断 IP 或地区。

**规范版本。** `init --standards general|ml` 选择安装哪一套规范；未传时沿用已安装块的版本，最后 `general`。TTY 下未传标志时会询问一次，默认选中已安装版本（回车即保持）；非交互运行不询问。`update --standards` 切换已安装块。ML 版以机器学习条款为主体——评测完整性、数据边界、训练预算、可复现、依赖、制品、结果汇报与通用底线——并承接外部制品源与加载信任条款；通用版面向前端、后端与通用代码库。

init 打印的预选提示**不是**安装集；`Selected editors:` 行才是。

**选择忽略。** 交互式 init 以四个分组开关展示受管 `.gitignore` 路径（`--auto-pipeline` 下 `openspec/` 保持可提交），默认全选——回车保持忽略；取消整组即提交该组全部路径，聚焦组行时列表下方显示该组全部路径，「自定义」进入逐项列表。被提交的路径记录在块首 `# openspec-pw: skip=…` 行，`update` 不再补回，之后可重新勾选恢复精确记录的单条路径。若 opt-out 落在某个受管目录内部，整个目录都会保持可提交（git 无法在被忽略的目录里重新包含文件），该目录也不再作为候选项出现。规范文件始终注入（`--no-rule-files` 只装 AGENTS.md）。非交互运行沿用先前选择；新项目忽略全部受管路径。

**取消勾选 = 移除。** 交互式 init 中取消勾选已探测的编辑器，会先确认一次再删除其 openspec-pw 产物；只动工具自有领土，你自己的配置条目和改过的 vendored agent 保留。共用的 `.mcp.json` 条目在仍有其他选中编辑器（Claude Code、CodeBuddy、MiniMax、Copilot）读取时保留。`--tools` 与非 TTY 运行不做移除。

**编辑器领土**：`update` 只维护项目内已配置的编辑器；新增请跑 `openspec-pw init --tools <id>`。

</details>

### 受管 `.gitignore` 路径

该块自身列出了它覆盖的 40 条路径（AI 编码助手、测试产物与凭据、MCP 配置、其他工具与运行时文件，以及始终忽略的规范文件）——打开 `.gitignore` 即可查看。编辑器根目录按整目录忽略，你在其中放的自有文件（如 `.agents/skills/team-skill/`）需 `git add -f`。无法写入时降级为警告并列出未覆盖路径。ignore 规则对已被 git 追踪的文件无效——若凭据曾提交过，请执行 `git rm --cached tests/playwright/credentials.yaml`。

### 初始化模式：frontend 与 minimal

`openspec-pw init` 根据前端信号选择安装模式（`vite/next/nuxt/...` 配置文件 > 框架依赖 > `dev` 脚本关键词 > monorepo workspace 成员）：

- **frontend 模式**（命中信号）：完整 Playwright 脚手架——e2e 命令、seed 测试、`BasePage`、测试计划、`playwright.config.ts`、auth setup、credentials、MCP 门控、agents 门控。
- **minimal 模式**（无信号，或 `package.json` 不可读，例如 Python/Go 后端）：只有描述验收测试契约的 `tests/README.md`（对真实运行的服务发真实请求，框架自选）加员工级规范块。无 Playwright 脚手架、无 e2e 命令、无 MCP、无 agents。

Summary 会打印模式与依据（`Mode: frontend (signal: vite.config.ts)` / `Mode: minimal (no frontend signal)`），误判当场可见。检测盲区（前端在未纳入跟踪的子目录；`vite.config.ts` 只服务 vitest）可用显式覆盖：

```bash
openspec-pw init --frontend      # 无信号时强制完整脚手架
openspec-pw init --no-frontend   # 有信号时强制 minimal
```

后续：出现前端信号（或传 `--frontend`）后重跑 `init` 会增量安装完整脚手架，并清理未被修改的 `tests/README.md`；minimal 项目持续受 `update`、`doctor`、`remove` 支持。

### 小程序目标

`init` 也可以为微信小程序生成 E2E 脚手架。目标与安装模式是两个维度：小程序项目始终是 frontend 模式。

检测依据 `project.config.json`、已构建的 `mp-weixin` 产物、`@tarojs/*` / `@dcloudio/*` 依赖，或真正的 `app.json`（含 `pages` 与伴生文件）；用 `--miniprogram` / `--no-miniprogram` 覆盖。生成之后，`update` / `remove` / `doctor` 按生成物（`wxa-test.ts` 或 `wxaProject`）判定目标而不再重新检测，对已有 Web 脚手架重跑 `init --miniprogram` 会停止并给出迁移指令，不留下半转换状态。

脚手架使用官方 [`@open-wxa/wxa-runner-playwright`](https://open-wxa.github.io/wxa-runner/) fixture：`wxa-test.ts` wrapper、`wxa.setup.ts`（登录态放这里——不生成 `auth.setup.ts` 与 `credentials.yaml`）、Chrome channel 的 `playwright.config.ts`，以及 seed 测试。依赖：`@playwright/test@^1.65`、`@open-wxa/wxa-runner-{playwright,core}@^0.13`、`wxa-runner@^0.13`，以及 Chrome（`npx playwright install chrome`）。生成的 CI 会安装 Chrome，并在测试前执行应用构建（Taro `build:weapp`、uni-app `build:mp-weixin`）。

限制：测试运行在无头 Chrome 中，不是微信开发者工具。仅在开发者工具中可用的 API（真实登录、支付、原生组件）不在覆盖范围。CI 支持面向 x86-64 Linux；没有 WebKit 或 Firefox project。Taro 项目可以解析与构建，但 Taro 运行时可能在浏览器运行器里初始化失败（`没有找到页面实例`）；先跑 seed，seed 失败即视为该应用不受支持，不要转而写 spec。

### 官方 Playwright Agents

<details>
<summary>opt-in <code>--agents</code> —— 装哪些、更新如何处理</summary>

```bash
openspec-pw init --tools claude --agents   # 额外安装官方 planner agent 定义
```

`--agents`（默认关）把 Playwright 官方 `init-agents` 输出的一个定义**逐字快照**装进 `.claude/agents/`：`playwright-test-planner.md`——探索应用、产出测试计划（可委托执行以隔离上下文）。官方 `generator` 与 `healer` 刻意不安装：生成在管道内完成；官方 healer 会修改断言强行让测试变绿，与本管道 Healer 步骤的诚实失败出口相反。

归属按内容判定：未修改的快照由 `update` 刷新、由 `remove` 删除；改过的副本永不覆盖、永不删除；其 `playwright-test` MCP 条目缺失时 `doctor` 给出非阻断 ⚠。交互式 init 询问一次（默认 No）；minimal 项目与 MCP 一起跳过。

> **自己跑 `npx playwright init-agents` 是清场重写型**：整文件重写 `.mcp.json`（你自己的条目会被销毁），已有 `opencode.jsonc` 时另立一个 `opencode.json`。必须跑的话请带上编辑器的 `--loop`（`claude` / `opencode` / `codex` / `copilot` / `vscode`；省略会写成 Copilot 那套），在 `openspec-pw init` **之前**执行，并检查 `git diff .mcp.json`。用 `--agents` 则不需要它。

</details>

### CLI 命令

```bash
openspec-pw -v            # 打印版本（也支持 -V / --version）
openspec-pw init          # 初始化集成（--tools all|none|ids… 可选编辑器；--agents 加装官方 agents；--frontend/--no-frontend 强制安装模式；--miniprogram/--no-miniprogram 选择小程序目标；--rule-files/--no-rule-files 开关各编辑器的规则副本；--lint-config 生成/扩展吞错清单的 ESLint 与 ruff 配置；--hook[=static|full] 安装 Claude Code Stop hook；--auto-pipeline 生成无头 CI 工作流；--lang zh|en 选择员工规范语言；--standards general|ml 选择规范版本）
openspec-pw update        # 更新 CLI 和命令到最新版本（--lang zh|en 与 --standards general|ml 切换已安装的规范块）
openspec-pw doctor        # 检查前置条件 (Node, Playwright, OpenSpec, 配置, 测试) + 应用服务器诊断
openspec-pw install --claude # 通过官方 native installer 安装或验证 Claude Code（默认只打印；--run 才执行；--verify 检查）
openspec-pw audit         # 检查测试文件是否有孤儿文件和配置问题（--gate 有问题时退出码 1）
openspec-pw coverage      # 分析 spec 与测试之间的覆盖率（--fail-under <pct> 低于阈值时退出码 1；--plan <file> 要求 delta spec 的每条 scenario 都出现在该测试计划中，否则退出码 1）
openspec-pw flake         # 检测测试文件中的不稳定模式（静态模式 + 被调大的超时）
openspec-pw gate [change]  # 跑全部质量检查，退出码 0 / 1 / 2（通过 / 不达标 / 无法判定；--repeat N 重跑失败的 E2E 以区分 flaky 与真失败）
openspec-pw migrate       # 迁移旧测试文件到新目录结构
openspec-pw explore       # 探索应用路由（--file <path> 指定 app-exploration.md）
openspec-pw remove        # 移除集成（--all 扫描 home 与 Windows 盘根；TTY 下确认后执行，--yes 跳过确认）
```

`install --claude` 打印官方 native installer 命令（`--run` 执行，`--verify` 检查已有安装，`--channel stable|latest`，`--version x.y.z`）。只走 Anthropic 官方渠道——不提供镜像、代理或地区绕过。

**`remove`** 只删工具自有产物（编辑器命令、MCP 条目、规则块、受管 `.gitignore` 块、钩子、schema、lint 清单、vendored agents），以及仍与内置模板字节一致的模板文件。你自己的文件、`tests/**`、`credentials.yaml`、`openspec/specs` 永不触碰；改过的工具文件保留并提示；经 symlink 指向项目外的路径跳过。

`remove --all` 扫描 home 目录（Windows 上再加各盘根），找持有上述任一产物的项目。先列出待删计划：TTY 下删除前询问一次，`--yes` 跳过询问，非 TTY 只打印计划。`--root <dir>`（可重复）替换扫描根。单个项目失败不阻断其余项目；结束时打印 `removed N / skipped M / failed K`，有失败则退出码非零。

`openspec-pw gate` 按 `validate → lint → typecheck → test → flake → e2e` 执行，默认首败即停（`--keep-going` 跑完全部），退出 `0` / `1` / `2`（通过 / 不达标 / 无法判定）。它还会让声明了 scenario 却无 E2E 测试的 change、以及新出现的 `test.fixme(` 判失败；lint/TS/Playwright 配置或超时被调大只出现在 `flags` 中，不判失败。

**运行时 flake 证据。** `gate --repeat <N>` 只重跑首跑失败的 E2E 用例（`--retries=N`）。至少通过一次的用例列为 flaky，除非加 `--strict-flake` 否则不判失败。Playwright 产物落在 `tmp/gate-flake-*`。`--hook` 不能与 `--repeat` 同时使用。

**Stop hook。** `init --hook` 安装 Claude Code Stop hook 执行 `gate --hook`：`static`（默认）或 `full`（加 flake 与 e2e——只在该 change 的 E2E 测试已存在后再用）。门禁为红时以退出码 2 结束，agent 继续修而不是宣布完成。`--no-hook` 或 `remove` 可移除；你自己的钩子不受影响。

**全自动流水线。** `init --auto-pipeline` 写一次 `.github/workflows/openspec-auto.yml`，之后不再覆盖。每个 PR 只跑 `gate`——把该 job 设为**必需状态检查**；`openspec:auto` 标签或手动触发才起无头 agent（apply → 静态门禁 → 生成 E2E → 全量门禁）并开 PR。必需 secret：`ANTHROPIC_API_KEY`；需要认证的应用还要 `E2E_USERNAME` / `E2E_PASSWORD` secrets 与 `E2E_AUTH_*` 变量。阶段按最便宜在前排列；apply 以 `openspec list --json` 的任务计数判定，末尾的 verify 只作 advisory。CI 是 checkout 仓库跑的，所以流水线项目里 `openspec/` 必须提交。

## 工作原理

### Spec 锚与过时测试审计

Generator 生成的每条测试上方带一行 **spec 锚** 注释：

```typescript
// spec: coupon#优惠券七天后过期
test('coupon expires after 7 days', async ({ page }) => { ... });
```

锚的 `<capability>#<requirement>` 使用 delta spec 中 requirement 的**标题原文**（不做 slug 转换），`openspec-pw audit` 因此能用纯文本匹配对主 spec 核验。它标记已不存在的 requirement（候删项）、被写成 change 名的 capability（生成笔误——修锚即可），以及缺失的 capability 目录（大概率改名）；无锚测试列为 info，`test.fixme` 跳过。audit **只报告**——从不删除或修改测试。

<details>
<summary><strong>工作流树</strong> —— 从 change 选择到报告共 10 步</summary>

```
/openspec-e2e <change-name>          # Codex 用 `$openspec-e2e`，Kimi 用 `/skill:openspec-e2e`
/openspec-e2e <change-name> --auto   # 无头——无人工确认点（见「全自动流水线」）
  │
  ├── 1. 选择 change → 读取 openspec/changes/<name>/specs/
  │
  ├── 2. 检测 auth → 从 specs 识别登录/认证标记
  │
  ├── 3. 验证环境 → 运行 seed.spec.ts
  │
  ├── 4. 探索应用 → 浏览器探索（Playwright MCP / `openspec-pw explore`）
  │       └─ 写入 app-exploration.md；提取共享模式 → app-knowledge.md
  │
  ├── 5. Planner → 生成 test-plan.md
  │
  ├── 6. Generator → 创建 tests/playwright/changes/<name>/<name>.spec.ts
  │
  ├── 7. 配置 auth → auth.setup.ts（如需要）
  │
  ├── 8. 配置 playwright → playwright.config.ts
  │
  ├── 9. 执行测试 → npx playwright test（Healer 通过 MCP 修复失败）
  │
  └── 10. 报告 → openspec/reports/playwright-e2e-<name>-<timestamp>.md
```

OpenSpec 1.x 下步骤不变，只是命令名不同（见[命名说明](#支持的-ai-编码助手)）。

</details>

## `openspec-pw init` 做了什么

1. 检测项目中的受支持编辑器——项目标记，或 [前置条件](#前置条件) 中列出的全局配置目录——并读取已由 openspec-pw 配置过的编辑器（见[初始化时选择编辑器](#初始化时选择编辑器)）
2. 为每个选中的编辑器安装 E2E 命令或技能（路径见 [支持的 AI 编码助手](#支持的-ai-编码助手) 表）
3. 生成 `tests/playwright/seed.spec.ts`、`auth.setup.ts`、`credentials.yaml`、`app-knowledge.md`、`test-plan.template.md`、`pages/BasePage.ts`，以及项目根的 `lint-guidelines.md` 吞错与文档注释 lint 清单（未手改时由 `update` 刷新，`remove` 清理）

> **`--lint-config`（opt-in）**：为 eslint 9+ 且至 git 根均无配置的项目生成最小 `eslint.config.mjs`，并向 ruff 配置追加受管 `extend-select = ["B904"]` 块。已有配置绝不编辑——只打印可粘贴片段。
4. 生成 `playwright.config.ts`，自动检测 dev 脚本与端口（Vite/Next/Nuxt/Astro、`.env`、`--port`）
5. 按前端信号选择安装模式（见[初始化模式](#初始化模式frontend-与-minimal)）；未检测到时在 Summary 打印引导提示——monorepo 去应用目录运行 `openspec-pw init`，纯 API 项目用 Playwright `request` fixture
6. 把员工级规范块装入 `AGENTS.md`（以及每个选中编辑器的规则副本），语言与版本由 `--lang zh|en`、`--standards general|ml` 决定；TTY 下会就版本询问一次，默认选中已安装版本

## `openspec-pw doctor` 检查清单

`openspec-pw doctor` 验证前置条件，**必需**项失败时退出码非零。

| 类别 | 必需检查项 | 可选检查项 |
|---|---|---|
| **Node.js** | `node` 版本 | `engines` 兼容性 |
| **npm** | `npm` 可用性 | — |
| **Playwright 配置** | 配置文件存在（`ts`/`js`/`mjs`/`mts`） | — |
| **OpenSpec** | 目录已初始化、CLI 主版本为 1 或 2 | `.spec.md` 数量 |
| **Playwright 浏览器** | CLI 版本、Chromium 二进制已下载 | — |
| **Playwright 测试框架** | `@playwright/test` 已安装 | — |
| **小程序** | Chrome、wxa fixture、`@playwright/test` >=1.64、`wxaProject` 产物 | — |
| **Playwright MCP** | 每个已配置编辑器的 server 配置 | PATH 上的 `playwright-cli` |
| **Cursor E2E** | Cursor 已配置时，命令与技能文件存在 | 提示 `init --tools cursor` |
| **Vendored Agents** | — | 快照的存在与归属 |
| **Sync** | 已初始化时规范同步 | 未初始化 |
| **测试目录** | `tests/playwright/` 存在 | `auth.setup.ts` 存在、`storageState` 文件存在 |
| **种子测试** | — | `seed.spec.ts` 存在 |
| **Lint** | — | 吞错清单覆盖（linter 能解析配置时作语义检查，否则文本探测） |
| **应用服务器** | — | 开发脚本、基础 URL、可达性 |
| **CodeGraph** | — | CLI 可用性、索引存在、MCP 安装 |

加 `--json` 参数输出机器可读格式。

## 认证配置

如果你的应用需要登录，配置一次凭证后，所有测试自动以已登录状态运行。

> **凭据自动忽略**：受管 `.gitignore` 块已覆盖（见 [受管 `.gitignore` 路径](#受管-gitignore-路径)）。ignore 规则对已被 git 追踪的文件无效——若凭据曾提交过，请执行 `git rm --cached tests/playwright/credentials.yaml`。也可以改用 `E2E_USERNAME` / `E2E_PASSWORD` 环境变量。

```bash
# 1.（可选）编辑测试用户（角色测试）
vim tests/playwright/credentials.yaml

# 2. 启用认证并设置环境变量
export E2E_AUTH_REQUIRED=true # 未设置时 auth.setup.ts 会被跳过
export E2E_AUTH_METHOD=api # 或 ui
export E2E_AUTH_API=/api/auth/login # 可选；默认为此值
export E2E_USERNAME=your-email@example.com
export E2E_PASSWORD=your-password

# 3. 录制登录（一次性；UI 登录会打开浏览器）
npx playwright test --project=setup

# 4. 后续所有测试自动复用登录状态
/openspec-e2e my-feature
```

支持 **API 登录**（推荐，基于 cookie）和 **UI 登录**（备选，用于 token/localStorage 认证）。多用户测试（管理员 vs 普通用户）在 `credentials.yaml` 中添加多个用户，运行 `/openspec-e2e`（Codex `$openspec-e2e`、Kimi `/skill:openspec-e2e`）— 它从 specs 读取角色标签、从 `credentials.yaml` 读取用户，然后为每个角色生成一份 setup。每份 setup 读取 `E2E_<ROLE>_USERNAME` 与 `E2E_<ROLE>_PASSWORD`（角色名大写；非字母数字字符变为 `_`）。

## 自定义

### 自定义 seed 测试

编辑 `tests/playwright/seed.spec.ts` 以匹配你的应用：
- 基础 URL
- 常用选择器
- Page Object 方法

### 认证凭证

编辑 `tests/playwright/credentials.yaml`：
- 为角色测试添加每个角色的用户条目

认证变量见上方快速开始；`E2E_AUTH_CHECK_PATH` 可选，用于在保存会话前断言该路径可访问。

CI 中把 `E2E_AUTH_*` 设为仓库变量；workflow 会将它们传给测试步骤。多用户 CI 需要把每个角色的凭据设为 secrets，并在 workflow env 中转发——内置 workflow 只转发 `E2E_USERNAME` / `E2E_PASSWORD`。

## 架构

<details>
<summary>规范下发与共存</summary>

员工级规范统一存放在 **AGENTS.md** 作为唯一事实源；上表的「AGENTS.md 加载方式」列即各编辑器的到达路径。Claude Code 必须用 CLAUDE.md 的 `@AGENTS.md` 导入（它默认并不读取 AGENTS.md）：`@` 行可位于任意位置，只要不在反引号/代码块内、也不在 OPENSPEC-PW 标记内。CodeBuddy 双文件并存时优先读 CODEBUDDY.md。

**各编辑器的规则副本。** AGENTS.md 是唯一必需的规则文件，wrapper 与各编辑器的规则文件只是便利副本。`init --no-rule-files` 只装 AGENTS.md 并移除这些副本（块外有用户内容时除外）；`init --rule-files` 恢复它们。选择记录在受管 `.gitignore` 块的 skip 行，后续运行沿用。

> **与官方 `@fission-ai/openspec` CLI 共存**：官方 `openspec update` 会删除根 AGENTS.md/CLAUDE.md 中以普通 `OPENSPEC:START/END` 标记包裹的块。openspec-pw 使用专属 `OPENSPEC-PW:` 命名空间，该匹配器看不到；块若已被清掉，跑 `openspec-pw init` 即可恢复。

</details>

## 许可

MIT
