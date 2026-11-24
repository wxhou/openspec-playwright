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
- [官方 Playwright Agents](#官方-playwright-agents)
- [`openspec-pw init` 做了什么](#openspec-pw-init-做了什么)
- [首次配置清单](#首次配置清单)
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
3. **OpenSpec** 已初始化：`npm install -g @fission-ai/openspec@2 && openspec init --scope project`（也支持 1.x：安装 `@1` 后运行 `openspec init`）
4. **Playwright MCP**（用于测试执行 + Healer）— `openspec-pw init` 会在检测到前端信号时按编辑器自动安装（纯 API 项目跳过——API 测试用 `request` fixture），**全部项目级**（写入项目内文件；Claude Code 用 `--scope project` 写项目根 `.mcp.json`，不碰全局 `~/.claude.json`）。安装**单个** server，与 Playwright 官方 `playwright init-agents` 布局一致：
   - `playwright-test` — 官方 test-runner server（`npx playwright run-test-mcp-server`，`playwright` 包自带）。是 `@playwright/mcp` 的**超集**：一个条目同时暴露 `browser_*` 浏览器工具（探索 + Healer 页面检查）和结构化的 `test_run` / `test_debug` / `test_list` 工作流工具（Healer 闭环）。
   - **Claude Code**：`claude mcp add --scope project playwright-test npx playwright run-test-mcp-server`（写入项目根 `.mcp.json`；受管 `.gitignore` 块默认忽略以保护凭据——自加 server 常含 API key，团队确需共享须显式 `git add -f .mcp.json`）
   - **OpenCode**：合并到 `opencode.jsonc` 的 `mcp["playwright-test"] = { type: "local", command: ["npx", "playwright", "run-test-mcp-server"] }`
   - **Cline**：合并到 `.cline/mcp.json` 的 `mcpServers["playwright-test"] = { "command": "npx", "args": ["playwright", "run-test-mcp-server"] }`
   - **Cursor**：合并到 `.cursor/mcp.json` 的 `mcpServers["playwright-test"] = { "command": "npx", "args": ["playwright", "run-test-mcp-server"] }`
   - **Oh My Pi**：合并到 `.omp/mcp.json` 的 `mcpServers["playwright-test"] = { "command": "npx", "args": ["playwright", "run-test-mcp-server"] }`
   - **CodeBuddy CLI**：合并到项目根 `.mcp.json` 的 `mcpServers["playwright-test"] = { "command": "npx", "args": ["playwright", "run-test-mcp-server"] }`（直接文件读写，不经 `codebuddy mcp` CLI——CLI 会与运行中的会话抢端口）
   - **MiniMax Code**：合并到项目根 `.mcp.json` 的 `mcpServers["playwright-test"] = { "command": "npx", "args": ["playwright", "run-test-mcp-server"] }`（直接文件读写——MiniMax Code 自动加载项目根 `.mcp.json`）
   - **Pi**：无 MCP 客户端，跳过安装 — 浏览器探索改用 `openspec-pw explore`

> **同时支持 OpenSpec 1.x 与 2.x**：命名跟随已装主版本。2.x 使用 `/openspec-e2e` 与 `openspec-e2e` 产物（装在 `.agents/skills/` 下的 skill）；1.x 使用 `/opsx:e2e` / `/opsx-e2e` 与 `opsx-e2e` 产物。`openspec-pw doctor` 对两者均通过，3.x 会被拒绝。

> 项目级 server 首次交互使用时 Claude Code 会弹出批准提示（`claude mcp reset-project-choices` 可重置选择）。

> **server 名 `playwright-test` 的来历**：这是 Playwright 官方 `playwright init-agents` CLI 的产物名——同名、同 transport（`npx playwright run-test-mcp-server`，`playwright` 包内置子命令）。它**不是** `@playwright/mcp`（独立 npm 包，注册名 `playwright`，约 67 个 `browser_*` 工具）；test-runner 是它的**超集**（约 80 个工具：完整 `browser_*` 集 + Healer 闭环用的结构化 `test_run` / `test_debug` / `test_list` 工作流工具）。两个 server 名字不同、可共存；搜「Playwright MCP」通常先看到的是 `@playwright/mcp` 的文档。

浏览器探索能力由 Playwright MCP 和 `openspec-pw explore` 内置提供，无需额外工具。

## 初始化

```bash
# 在项目目录下
openspec init              # 初始化 OpenSpec
openspec-pw init          # 安装 Playwright E2E 集成（--tools 选编辑器，--agents 加装官方 agents）
```

> **注意**：运行 `openspec-pw init` 后，手动安装 Chromium 浏览器：`npx playwright install chromium`

## 支持的 AI 编码助手

命名跟随已装 OpenSpec 主版本：下表为 2.x 名称；1.x 下同一批产物为 `opsx-e2e`（Claude Code、CodeBuddy CLI、Gemini CLI 用 `/opsx:e2e`，其余用 `/opsx-e2e`，Codex 为 `$opsx-e2e`，Kimi Code 为 `/skill:opsx-e2e`）。

| 编辑器 | 命令 | Playwright MCP | AGENTS.md 加载方式 |
|---|---|---|---|
| **Claude Code**（Anthropic） | `/openspec-e2e` | 是（项目 `.mcp.json`） | 经 `CLAUDE.md` → `@AGENTS.md` |
| **OpenCode**（SST） | `/openspec-e2e` | 是（`opencode.jsonc`） | `instructions` 字段 |
| **Cline** | `/openspec-e2e` | 是（`.cline/mcp.json`） | 原生 |
| **Cursor** | `/openspec-e2e` | 是（`.cursor/mcp.json`） | 原生 |
| **Pi**（earendil-works） | `/openspec-e2e` | **否** — 改用 `openspec-pw explore` + `npx playwright test` | 原生 |
| **Oh My Pi（omp）** | `/openspec-e2e` | 是（`.omp/mcp.json`） | 原生 |
| **CodeBuddy CLI**（腾讯） | `/openspec-e2e` | 是（项目根 `.mcp.json`） | 经 `CODEBUDDY.md` → `@AGENTS.md` |
| **MiniMax Code**（`mcode` CLI） | `/openspec-e2e` | 是（项目根 `.mcp.json`） | 原生（`AGENTS.md`） |
| **DeepSeek Harness**（`dsh`） | `openspec-e2e` 技能 | **无项目级载体**——需在 `$DSH_HOME` 的 profile patch 中配置 Playwright MCP | 原生（`AGENTS.md`） |
| **Gemini CLI** | `/openspec-e2e` | 是（`.gemini/settings.json`） | `GEMINI.md` |
| **Qwen Code** | `/openspec-e2e` | 是（`.qwen/settings.json`） | `QWEN.md` |
| **GitHub Copilot**（VS Code） | `/openspec-e2e` | 是（项目根 `.mcp.json`） | `.github/copilot-instructions.md` |
| **Roo Code** | `/openspec-e2e` | 是（`.roo/mcp.json`） | `.roo/rules/openspec-pw.md` |
| **Trae** | `/openspec-e2e` | 是（`.trae/mcp.json`，Project MCP beta） | `.trae/rules/project_rules.md` |
| **Codex** | `$openspec-e2e` 技能 | **无 JSON 载体**——项目级 MCP 在 `.codex/config.toml`（TOML，暂不支持） | 原生（`AGENTS.md`） |
| **Kimi Code** | `/skill:openspec-e2e` 技能 | 是（`.kimi-code/mcp.json`） | 原生（`AGENTS.md`） |

各编辑器命令体完全相同：2.x 统一写 `/openspec-e2e`；1.x 在安装时把 `/opsx:` 改写为 `/opsx-`（Claude Code、CodeBuddy CLI、Gemini CLI 保留冒号形式）。具体安装路径、检测信号、auth/MCP 细节见下方 [使用](#使用) 与 [前置条件](#前置条件) 两节。

## 使用

选匹配你项目的编辑器，发对应的命令。十六款编辑器共用同一工作流；OpenSpec 2.x 下全部使用 `/openspec-e2e`（Codex 为 `$openspec-e2e`，Kimi Code 为 `/skill:openspec-e2e`）。1.x 下同一批产物沿用 `opsx` 名称——Claude Code、CodeBuddy CLI、Gemini CLI 用 `/opsx:e2e`，其余用 `/opsx-e2e`，Codex / Kimi 为 `$opsx-e2e` / `/skill:opsx-e2e`——落盘在 `opsx-` 路径（如 `.claude/commands/opsx/e2e.md`）。只有名称与工件位置不同。

| 编辑器 | 命令 | 安装位置 |
|---|---|---|
| Claude Code | `/openspec-e2e <change-name>` | `.claude/skills/openspec-e2e/SKILL.md` + 共享 `.agents/skills/openspec-e2e/SKILL.md` |
| OpenCode | `/openspec-e2e <change-name>` | `.opencode/commands/openspec-e2e.md` |
| Cline | `/openspec-e2e <change-name>` | `.cline/skills/openspec-e2e/SKILL.md` |
| Cursor | `/openspec-e2e <change-name>` | `.cursor/commands/openspec-e2e.md` + `.cursor/skills/openspec-e2e/SKILL.md` |
| Pi | `/openspec-e2e <change-name>` | `.pi/prompts/openspec-e2e.md`（文件名即命令名） |
| Oh My Pi | `/openspec-e2e <change-name>` | `.omp/commands/openspec-e2e.md` |
| CodeBuddy CLI | `/openspec-e2e <change-name>` | `.codebuddy/commands/openspec-e2e.md` |
| MiniMax Code CLI | `/openspec-e2e <change-name>` | `.agents/skills/openspec-e2e/SKILL.md`（技能） |
| DeepSeek Harness（`dsh`） | `openspec-e2e` 技能 | `.dsh/skills/openspec-e2e/SKILL.md`（技能） |
| Gemini CLI | `/openspec-e2e <change-name>` | `.gemini/commands/openspec-e2e.toml`（TOML） |
| Qwen Code | `/openspec-e2e <change-name>` | `.qwen/commands/openspec-e2e.md` |
| GitHub Copilot（VS Code） | `/openspec-e2e <change-name>` | `.github/prompts/openspec-e2e.prompt.md` |
| Roo Code | `/openspec-e2e <change-name>` | `.roo/commands/openspec-e2e.md` |
| Trae | `/openspec-e2e <change-name>` | `.trae/commands/openspec-e2e.md` |
| Codex | `$openspec-e2e <change-name>` | `.agents/skills/openspec-e2e/SKILL.md`（技能） |
| Kimi Code | `/skill:openspec-e2e <change-name>` | `.kimi-code/skills/openspec-e2e/SKILL.md`（技能） |

<details>
<summary><strong>各编辑器的差异</strong>（默认折叠；只有 init 报错时才需要展开）</summary>

- **Cursor**：skill 设置 `disable-model-invocation: true`（仅在显式调用时加载）。若要用 Cursor 但还没有 `.cursor/`：`mkdir -p .cursor`。
- **Pi**：没有 MCP 客户端——浏览器探索改用 `openspec-pw explore`，测试执行用 shell 跑 `npx playwright test`（无 Healer 步骤）。
- **Oh My Pi**：若 `.claude/` / `.cursor/` / `opencode.jsonc` 已存在并配置了 MCP，omp 会一并继承。
- **CodeBuddy CLI**：1.x 用冒号命名（同 Claude Code，`/opsx:e2e`）；2.x 与所有编辑器一样用 `/openspec-e2e`。
- **MiniMax Code**：工作流以 **Skill**（`SKILL.md`）形式交付——`mcode` CLI 不加载任何用户自定义命令文件，技能是它唯一可扩展的命令机制。原生读取 `AGENTS.md`，无包装文件。**集成目标是 `mcode` CLI；桌面端不在覆盖范围。**
- **DeepSeek Harness**：工作流以 **Skill** 形式装在 `.dsh/skills/openspec-e2e/SKILL.md`——dsh 的 rank 100 项目级根，优先级高于 MiniMax 方案留下的 `.agents/skills` 副本。dsh 没有项目级 MCP 载体（MCP 服务器在 `$DSH_HOME` 的 profile patch 层、默认关闭），浏览器探索回退到 `openspec-pw explore`，测试执行走 `npx playwright test`。dsh 仍是 developer preview，适配器只依赖其已文档化的技能发现契约。
- **Gemini CLI**：命令为 TOML（`description` + `prompt`）；1.x 命令正文保留 `/opsx:` 冒号形式，2.x 使用 `/openspec-e2e`。MCP 写入 `.gemini/settings.json` 的 `mcpServers`，规范块写入 `GEMINI.md`。
- **Qwen Code**：带 `description` frontmatter 的 Markdown 命令；MCP 写入 `.qwen/settings.json`，规范写入 `QWEN.md`。
- **GitHub Copilot**：面向 VS Code——prompt 文件在 `.github/prompts/`，MCP 在工作区根 `.mcp.json`（`mcpServers` 映射，stdio 条目带 `type: "stdio"`，与 Claude/CodeBuddy/MiniMax 共享），规范在 `.github/copilot-instructions.md`。检测只用 Copilot 专属标记，任意仓库的 `.github/` 目录不算。
- **Roo Code**：标题 + 说明的 Markdown 命令；MCP 在 `.roo/mcp.json`；规范写入本工具专属的 `.roo/rules/openspec-pw.md`（Roo 会加载该目录下全部文件）。
- **Trae**：name/description frontmatter 的 Markdown 命令；项目级 MCP 在 `.trae/mcp.json`（Project MCP，beta——旧版 IDE 可能忽略）；规范写入 `.trae/rules/project_rules.md`。
- **Codex**：工作流以 **Skill** 形式装在 `.agents/skills/openspec-e2e/SKILL.md`，用 `$openspec-e2e` 调用（1.x：`.agents/skills/opsx-e2e/SKILL.md`，`$opsx-e2e`）。该目录与 MiniMax Code 共用：取消勾选 Codex 但保留 MiniMax 时技能文件保留。Codex 的项目级 MCP 在 `.codex/config.toml`（TOML），本工具不做合并——浏览器探索回退 `openspec-pw explore`，测试执行走 `npx playwright test`。
- **Kimi Code**：工作流以 **Skill** 形式装在 `.kimi-code/skills/openspec-e2e/SKILL.md`，用 `/skill:openspec-e2e` 调用（1.x：`.kimi-code/skills/opsx-e2e/SKILL.md`，`/skill:opsx-e2e`）。MCP 在 `.kimi-code/mcp.json`；项目规则走 `AGENTS.md`（Kimi 是否自动加载 `AGENTS.md` 官方未明确）。

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

未提供 `--tools` 时：TTY 终端弹出交互式多选。**预选读取 openspec-pw 配置清单，而非目录存在性**：实际拥有 openspec-pw 产物（命令文件、MCP 条目、claude legacy 技能目录）的编辑器被预勾选并标注 `(configured)`。项目完全没有任何 openspec-pw 状态时（首次运行）预选**仅看项目自身信号**——marker 目录加根目录意图文件（根 `CLAUDE.md` → claude、根 `.cursorrules` → cursor、根 `opencode.json(c)` → opencode、根 `CODEBUDDY.md` → codebuddy）；机器上装有但项目未用的编辑器（如经全局 `~/.pi/agent/`、`~/.omp/agent/`、`~/.minimax-code/` 检测到的 Pi / Oh My Pi / MiniMax Code）**列出但不勾选**，并有一行灰字提示。一旦配置过任何编辑器，撑着目录存在性的外部文件（官方 `openspec` CLI 自己的 `opsx-*` 文件、你自己的配置、全局目录）就不再影响预选。`--tools` 与 `--no-mcp` 正交：前者选择*哪些*编辑器，后者决定*是否*为它们安装 Playwright MCP。

init 打印两种输出信号：预选提示行（仅未传 `--tools` 时出现）——有 openspec-pw 状态的项目是 `Configured (pre-select):`，首次运行回退则是 `Detected (pre-select):`——**不是**实际安装集；`Selected editors:` 行（总是打印，位于任何编辑器配置之前）才是实际安装集。判断装了什么，看 `Selected editors`。

**规范语言。** `AGENTS.md` 里的员工级规范块以中文或英文写入。`init --lang zh|en` 显式选择；未传时优先沿用已安装块的语言，其次看操作系统语言（macOS `AppleLanguages`/`AppleLocale`，Windows `PreferredUILanguages`/`LocaleName`），再回退终端 locale（`LANGUAGE` > `LC_ALL` > `LC_MESSAGES` > `LANG`），最后英文。`update --lang` 切换已安装块的语言；没有规范块时该参数不生效。不判断 IP 或地区。

**取消勾选 = 移除**。交互式多选里，*已被探测但你取消勾选的*编辑器的 openspec-pw 产物会被移除——命令/技能文件、该编辑器的 openspec-pw MCP 条目（含 claude 的 wrapper 块与 legacy 技能目录，以及归本工具所有的 vendored agents），前置一次列出全部待移除项的确认（拒绝则保持旧行为：本次仅跳过写入）。只动 openspec-pw 自有领土——同一文件中你自有的配置条目不受影响；你手改过的 vendored agent 文件会被保留并报告，绝不删除。共享规则：AGENTS.md 的 openspec-pw 块仅在**没有任何编辑器保留**时移除；symlink 的 CLAUDE.md 永不穿透写入。MCP 条目按**配置文件**判定：Claude Code / CodeBuddy CLI / MiniMax Code / GitHub Copilot 共用项目根 `.mcp.json`，只要仍有被选中的编辑器读取该文件，共享条目即保留（确认清单中标注为「保留」）——该文件是这几个编辑器运行时直接读取的，删掉会连带切断仍被选中编辑器的 Playwright MCP；把四者全部取消勾选时条目照常移除。`--tools` 与非 TTY 运行不做任何移除（`--tools` 是显式授权清单）。移除直接反哺预选：被移除的编辑器下次 init 不再预勾选（预选读 openspec-pw 清单——保留的 `mcp.json`、你自己的文件、全局目录都不再重要）；*全部*取消并确认的项目下次 init 重置回首-运行预选语义。

**编辑器领土**：`update` 只维护项目内已有 openspec-pw 命令工件的编辑器——不会新增编辑器（全局配置目录或手建的 `.cursor/` 不构成写入授权）。给已初始化项目新增编辑器请重跑 `openspec-pw init --tools <id>`（幂等）。

</details>

### 初始化模式：frontend 与 minimal

`openspec-pw init` 根据前端信号选择安装模式（`vite/next/nuxt/...` 配置文件 > 框架依赖 > `dev` 脚本关键词 > monorepo workspace 成员）：

- **frontend 模式**（命中信号）：完整 Playwright 脚手架——e2e 命令、seed 测试、`BasePage`、测试计划、`playwright.config.ts`、auth setup、credentials、MCP 门控、agents 门控。行为与模式出现之前的版本一致。
- **minimal 模式**（无信号，或 `package.json` 不可读，例如 Python/Go 后端）：只有描述验收测试契约的 `tests/README.md`（对真实运行的服务发真实请求，框架自选）加员工级规范块。无 Playwright 脚手架、无 e2e 命令、无 MCP、无 agents。

Summary 会打印模式与依据（`Mode: frontend (signal: vite.config.ts)` / `Mode: minimal (no frontend signal)`），误判当场可见。检测盲区（前端在未纳入跟踪的子目录；`vite.config.ts` 只服务 vitest）可用显式覆盖：

```bash
openspec-pw init --frontend      # 无信号时强制完整脚手架
openspec-pw init --no-frontend   # 有信号时强制 minimal
```

后续升级：项目出现前端信号（或传 `--frontend`）后，重跑 `init` 会增量安装完整脚手架，并清理工具拥有的 `tests/README.md`（被修改过的保留并提示）。minimal 模式项目是一等公民：`update` 同步其规范块与 wrapper，`doctor` 检查时不因缺少 Playwright 失败，`remove` 清理 README 与标记。

### 小程序目标

`init` 也可以为微信小程序生成 E2E 脚手架。目标与安装模式是两个维度：小程序项目始终是 frontend 模式。

检测分强弱两级。强信号——`project.config.json`、已构建的 `mp-weixin` 产物目录、`@tarojs/*` 或 `@dcloudio/*` 依赖——优先于任何 Web 信号。裸 `app.json` 属弱信号：只有含 `pages` 数组且存在伴生文件（`app.wxss`、`sitemap.json`、`project.private.config.json`）才算命中，避免把 Expo Web 应用误判为小程序。可显式覆盖：

```bash
openspec-pw init --miniprogram      # 强制小程序目标
openspec-pw init --no-miniprogram   # 强制 Web 目标
```

生成之后，`update` / `remove` / `doctor` 按生成物（`wxa-test.ts` 或 `wxaProject`）判定目标，不再重新检测，既有 Web 脚手架不会被后续 `update` 切换。对已有 Web 脚手架重跑 `init --miniprogram` 会停止并给出迁移指令，不留下半转换状态。

脚手架使用官方 [`@open-wxa/wxa-runner-playwright`](https://open-wxa.github.io/wxa-runner/) fixture，在 Chrome 中按官方基础库运行构建产物。生成文件：`playwright.config.ts`（`channel: 'chrome'`、`wxaProject`、`wxaServerOptions.setup`）、`wxa-test.ts` 重导出 wrapper、`wxa.setup.ts`、`pages/BasePage.ts`，以及打开 `entryPagePath`（或 `pages[0]`）并断言 `toHavePath` 的 seed 测试。不生成 `auth.setup.ts` 与 `credentials.yaml`——登录态放 `wxa.setup.ts`。

依赖：`@playwright/test@^1.65`、`@open-wxa/wxa-runner-playwright@^0.13`、`@open-wxa/wxa-runner-core@^0.13`、`wxa-runner@^0.13`（`/openspec-e2e` 探索步骤调用的 CLI），以及 Google Chrome（`npx playwright install chrome`）。Taro 用 `build:weapp`，uni-app 用 `build:mp-weixin`；monorepo 中在拥有该脚本的包里执行（`npm --prefix <member> run <script>`）。生成的 CI 会安装 Chrome，并在 `npx playwright test` 前执行该构建；`doctor` 检查 Chrome、fixture、Playwright 版本（>=1.64）与 `wxaProject` 产物目录。升级 fixture 导入请改 `tests/playwright/wxa-test.ts`——`update` 会保留你改过的副本。

限制：测试运行在无头 Chrome 中，不是微信开发者工具。仅在开发者工具中可用的 API（真实登录、支付、原生组件）不在覆盖范围。CI 支持面向 x86-64 Linux；没有 WebKit 或 Firefox project。Taro 项目可以解析与构建，但 Taro 运行时可能在浏览器运行器里初始化失败（`没有找到页面实例`）；先跑 seed，seed 失败即视为该应用不受支持，不要转而写 spec。

### 官方 Playwright Agents

<details>
<summary>opt-in <code>--agents</code> —— 装哪些、归属规则、与工作流的分工</summary>

```bash
openspec-pw init --tools claude --agents   # 额外安装官方 planner agent 定义
```

`--agents`（默认关）把 Playwright 官方 `playwright init-agents`（claude loop）生成的、适合本工具管道的一个 agent 定义**逐字快照**装进 `.claude/agents/`：

- `playwright-test-planner.md` — 探索应用、产出测试计划（`/openspec-e2e` Step 5 的委托目标，用于上下文隔离）

官方 `generator` 与 `healer` agent 不 vendoring：生成在 `/openspec-e2e` 管道内完成（录制流），带上了委托子 agent 不会继承的工作流规则；官方 healer 会修改断言/期望值来强行让测试变绿——与本管道的诚实失败出口相反。旧版安装保留这些文件：未修改的副本仍视为工具所有（`doctor` 列出，`remove` 删除），修改过的归用户所有，永不触碰。

它的 `tools:` frontmatter 引用的正是 `playwright-test` MCP server——本工具装好的那一条目，MCP 前提天然满足。交互式 init 会在编辑器确认后追加一个默认 **No** 的确认项；minimal 模式项目与 MCP 一起跳过（该相位跟随同一前端信号门控——agent 的工具全是 MCP 工具）。归属按内容判定：与内置快照一致的文件（上游基线见 `templates/agents/SOURCE.md`）归本工具所有——`update` 在快照升级时刷新、移除路径一并删除；你手改过的（或用新版官方 init-agents 刷过的）文件**永不覆盖、永不删除**，仅提示。`doctor` 报告其存在、归属状态，并在 `playwright-test` MCP 条目缺失时给出非阻断 ⚠。

**与 `/openspec-e2e` 的分工**：命令模板是 OpenSpec 锚定的完整管道（计划 → 生成 → 带 App Bug Registry 的治疗闭环 → Phase 3 人工升级）；vendored agents 是无 change 在飞时可单独召唤的子 agent。工作流内部，Planner 与 Generator 两个阶段在子 agent 已安装时可委托执行（规则随委托提示词传递，产物由主 agent 核验）；Healer 阶段**永不委托**——管道护栏取代官方 healer 的自主改断言行为。项目 AGENTS.md §6 约束一切来源的 agent。

> **官方 healer 与本工具护栏的差异**：官方 healer 被指示「不要问用户、可通过修改断言和期望值修复失败测试」；本工具的 Healer 管道**禁止未授权放宽断言**——更新断言或 spec 是 Phase 3 的人工决策。单独召唤官方 healer 快速修测试是你的选择，但不要把它的输出混入 `/openspec-e2e` 交付流。

> **如果你坚持自己跑 `npx playwright init-agents`**：它是清场重写型——整文件重写 `.mcp.json`（你自装的 MCP 条目会被销毁，fixture 已实证）、已有 `opencode.jsonc` 时另立 `opencode.json`、且要求随 Playwright 升级重跑。必须跑的话请在 `openspec-pw init` **之前**，跑完 `git diff .mcp.json` 检查其他条目幸存。用 `--agents` 则不需要跑它——官方新版快照由 `update` 同步。

</details>

### CLI 命令

```bash
openspec-pw -v            # 打印版本（也支持 -V / --version）
openspec-pw init          # 初始化集成（--tools all|none|ids… 可选编辑器；--agents 加装官方 agents；--frontend/--no-frontend 强制安装模式；--miniprogram/--no-miniprogram 选择小程序目标；--rule-files/--no-rule-files 开关各编辑器的规则副本；--lint-config 生成/扩展吞错清单的 ESLint 与 ruff 配置；--hook[=static|full] 安装 Claude Code Stop hook；--auto-pipeline 生成无头 CI 工作流；--lang zh|en 选择员工规范语言）
openspec-pw update        # 更新 CLI 和命令到最新版本（--lang zh|en 切换已安装的规范块语言）
openspec-pw doctor        # 检查前置条件 (Node, Playwright, OpenSpec, 配置, 测试) + 应用服务器诊断
openspec-pw install --claude # 通过官方 native installer 安装或验证 Claude Code（默认只打印；--run 才执行；--verify 检查）
openspec-pw audit         # 检查测试文件是否有孤儿文件和配置问题（--gate 有问题时退出码 1）
openspec-pw coverage      # 分析 spec 与测试之间的覆盖率（--fail-under <pct> 低于阈值时退出码 1；--plan <file> 要求 delta spec 的每条 scenario 都出现在该测试计划中，否则退出码 1）
openspec-pw flake         # 检测测试文件中的不稳定模式（静态模式 + 被调大的超时）
openspec-pw gate [change]  # 跑全部质量检查，退出码 0 / 1 / 2（通过 / 不达标 / 无法判定；--repeat N 重跑失败的 E2E 以区分 flaky 与真失败）
openspec-pw migrate       # 迁移旧测试文件到新目录结构
openspec-pw explore       # 探索应用路由（--file <path> 指定 app-exploration.md）
openspec-pw remove        # 移除集成（--all 扫描 home 与 Windows 盘根；--yes 才执行）
```

`install --claude` 安装 Claude Code CLI 本体；`init` 安装项目集成。默认只打印官方 native installer 命令；`--run` 执行，`--verify` 检查已有安装，`--channel stable|latest` 选择通道（默认 `latest`），`--version x.y.z` 固定版本。native 安装后若找不到 `claude`，请打开新终端或把 `~/.local/bin` 加入 `PATH`。只走 Anthropic 官方渠道；Claude Code 仅在 Anthropic 支持的国家/地区可用（https://www.anthropic.com/supported-countries），本命令不提供镜像、代理或地区绕过。

**`remove`** 清理当前项目的工具痕迹（非脚手架）：编辑器命令载体、`playwright-test` 与遗留 `playwright` 的 MCP 条目、规则文件标记块、`.gitignore` managed block、Stop hook、`openspec/schemas/playwright-e2e/`、lint 清单、vendored agents、legacy skill 目录，以及仍与内置模板字节一致的 `tests/README.md`、`tests/playwright/README.md`（小程序目标）、`.github/workflows/openspec-pw.yml`、`.github/workflows/openspec-auto.yml`、工具生成的 `eslint.config.mjs` 与 ruff managed block。用户数据永不删除（`tests/**`、`credentials.yaml`、`openspec/specs`），被改过的工具文件保留并提示；例外是规则文件移除标记块后只剩生成标题时整文件删除，块体是否与内置内容一致不影响该判定。符号链接解析到项目外的路径一律不删不写，官方 OpenSpec 的 `OPENSPEC:` 块不视为本工具产物。init 写入 OpenCode `instructions` 的 `AGENTS.md` 条目保留——无法与用户自己添加的条目区分；需要你编辑的脚手架文件（`playwright.config.ts`、`tests/playwright/seed.spec.ts`、`auth.setup.ts`、`pages/`、`test-plan.template.md`）保留；只剩空容器的配置文件（`{"mcpServers":{}}`）也保留——无法证明归属。

`remove --all` 扫描本机带 openspec-pw 痕迹的项目——编辑器命令文件、schema 目录、标记块、`.gitignore` managed block，或工具拥有的残留（`tests/README.md`、lint 清单、生成的 CI workflow、工具生成的 ESLint/ruff 配置、遗留 skill 目录、工具拥有的 vendored agents、Stop hook）任一命中即可。单独的 MCP 条目不作为发现信号（`playwright-test` 也是 Playwright 官方 agent 初始化写入的 server 名），只有显式单项目 `remove` 会清理它；批量模式只清理 `playwright-test`，遗留 `playwright` 不处理。默认扫描根是 home 目录，Windows 上再加所有存在的盘根。**默认只列计划不删除**：打印每个项目与将删除的产物组；加 `--yes` 才执行；`--root <dir>`（可重复，支持 `~`）替换默认扫描根——显式给出 `--root` 时扫描范围就是这些根，不再并入当前项目；路径不存在或是 UNC 路径时退出 2。不传 `--root` 时，当前项目包含在计划中并排在首位。单个项目失败不阻断其余项目；因权限不可写的项目记为 skipped，其他错误记为 failed；结束时打印 `removed N / skipped M / failed K`（项目数），有失败则退出码非零。

`openspec-pw gate` 是其余所有环节共用的唯一裁决入口——Claude Code 的 Stop hook 与生成的 CI 工作流都调用它，不再各自维护一份检查清单。它按「validate → lint → typecheck → test → flake → e2e」的顺序执行（廉价在前，默认首败即停，`--keep-going` 跑完全部），退出码三值：`0` 全部通过、`1` 有检查不达标、`2` 无法判定（工具缺失、超时、变更名有歧义）。

两条确定性护栏专门堵假绿：

- delta spec 声明了 scenario，但 `tests/playwright/changes/<change>/` 下没有任何测试文件 → E2E 判失败。仅当项目根存在 Playwright 配置时生效，纯后端项目不受影响；
- 本次 diff 新增 `test.fixme(` → 判失败，并列出文件与行号。

改动 lint 配置、`tsconfig*.json`、Playwright 或 Vitest 配置，或把测试文件里的超时调大（`timeout: N` / `test.setTimeout(N)`），都会出现在裁决的 `flags` 中。只报告不判失败：放宽配置或延长超时有时正当，但评审者需要知道尺子被挪过——调大超时只会让失败的测试变绿，并没有修掉它撞上的竞态。

**运行时 flake 证据。** `gate --repeat <N>` 只重跑首跑失败的 E2E 用例（`--last-failed`），并带 `--retries=N`。重跑期间至少通过一次的用例进入裁决的 `flaky` 明细（`--json` 中给出通过/失败次数与失败尝试的 trace），所有尝试都失败的仍是真失败。flaky 默认只报告，加 `--strict-flake` 才判失败，首跑偶发失败不再直接把门禁变红。该功能默认关闭，不修改 `playwright.config.*`；Playwright 产物落在 `tmp/gate-flake-<pid>-<timestamp>/`（`tmp/` 未被忽略时改用系统临时目录）。它是概率性检测：只覆盖首跑失败、重跑通过的用例。Stop hook 不传 `--repeat`；`--hook` 与 `--repeat` 同时使用会被拒绝（退出码 2）。

**Stop hook。** `openspec-pw init --hook` 会向 `.claude/settings.json` 合并一个 `Stop` 钩子，调用 `openspec-pw gate --hook`。门禁为红时钩子以退出码 2 结束、把失败项写到 stderr，agent 必须继续修而不是宣布完成。两档：`static`（默认——validate、lint、typecheck、单元测试）与 `full`（额外含 flake 与 e2e）。`full` 只在该变更的 E2E 测试已存在后再用：此前「有 scenario 无测试」护栏会让每回合都判红，把进展正常的活儿卡住。每回合最多阻断一次（读取 Claude Code 的 `stop_hook_active`），并按工作树指纹缓存结论，工作树没变就不重复检查。`--no-hook` 或 `openspec-pw remove` 可移除；同一文件里你自己的钩子不会被改动。

**全自动流水线。** `openspec-pw init --auto-pipeline` 生成 `.github/workflows/openspec-auto.yml`，只写一次、之后不再覆盖。两种触发是刻意的：每个 PR 只跑 `gate`——请把该 job 设为**必需状态检查**，否则门禁为红的 PR 仍能合并；`openspec:auto` 标签或手动触发才起无头 agent（apply → 静态门禁 → 生成 E2E → 全量门禁）并开 PR。需要 secret：`ANTHROPIC_API_KEY`。需要认证的应用还要提供 `E2E_USERNAME` / `E2E_PASSWORD` secrets 与 `E2E_AUTH_*` 仓库变量；E2E 阶段会转发它们。阶段按「便宜的在前」排列：apply 用 `gate --skip e2e` 自证（此时该变更的 E2E 测试还不存在，「有 scenario 无测试」护栏会让全量 gate 判红——那是个永远不会结束的循环），随后是零 token 的静态门禁，再到需要浏览器的 E2E 阶段，最后才用全量 gate 作作业侧裁决。apply 的完成度以 `openspec list --json` 的任务计数判定，因为无头运行停下来提问时退出码同样是 0。末尾的 `/opsx:verify` 只作 advisory——报告与各阶段 `total_cost_usd` 写进 PR 正文，不拦截流程。E2E 步骤以 `/opsx:e2e --auto` 运行：人工确认测试计划改为 `openspec-pw coverage --plan`，所有原本「等用户」的节点改为结构化中止并以非零码退出。CI 是 checkout 仓库跑的，所以流水线项目里 `openspec/` 不进受管 `.gitignore` 块——规格与变更必须提交，否则 agent 无可应用；块外自己写的忽略规则只提示、不改写。

> **升级已有流水线？** 生成器不会覆盖 `.github/workflows/openspec-auto.yml`。如果文件里仍是 `--plan "tests/playwright/changes/$CHANGE/test-plan.md"`，改成 `--plan "openspec/changes/$CHANGE/specs/playwright/test-plan.md"`，并补上 E2E 认证环境变量；或删除该文件后重跑 `openspec-pw init --auto-pipeline`。

## 工作原理

### Spec 锚与过时测试审计

Generator 生成的每条测试上方带一行 **spec 锚** 注释：

```typescript
// spec: coupon#优惠券七天后过期
test('coupon expires after 7 days', async ({ page }) => { ... });
```

锚的 `<capability>#<requirement>` 直接使用 delta spec 中 requirement 的**标题原文**（不做 slug 转换），`openspec-pw audit` 因此能用纯文本匹配对主 spec 核验。审计报告五态：

| 状态 | 信号 | 含义 |
|---|---|---|
| 锚指向的 requirement 已不在主 spec | ⚠ issue，引证删除它的归档 change | 测试是候删项——删除 / `test.fixme` 附理由 / 行为仍存活则保留 |
| 锚的 capability 段写成了 change/提案名 | ⚠ issue，精确诊断 | 生成端笔误——修锚即可，测试本身无需 review |
| 锚指向的 capability 目录缺失（且非 change 名） | ⚠ issue（单独类别） | 大概率是 capability 改名——先核验再处置 |
| 某 change 目录下有测试无锚 | ℹ 每目录一行 info | 锚机制之前的存量或漏写——仅可见性提示，不计入 issue 数 |
| `test.fixme` 的测试 | 跳过 | fixme 即「已知过时、故意保留」的声明，报告它是噪音 |

audit **只报告、绝不删除**——测试退役永远是人工决策。存量无锚测试不迁移，随新测试自然带锚而逐步退役。MCP 录制流（`generator_write_test`）产物按操作步骤切、天然无锚，模板 review 清单含补锚步骤。

<details>
<summary><strong>工作流树</strong> —— 从 change 选择到报告共 10 步</summary>

```
/openspec-e2e <change-name>          # 所有编辑器；Codex 用 $openspec-e2e，Kimi 用 /skill:openspec-e2e
/openspec-e2e <change-name> --auto   # 无头——无人工确认点（见「全自动流水线」）
  │
  ├── 1. 选择 change → 读取 openspec/changes/<name>/specs/
  │
  ├── 2. 检测 auth → 从 specs 识别登录/认证标记
  │
  ├── 3. 验证环境 → 运行 seed.spec.ts
  │
  ├── 4. 探索应用 → 浏览器探索（Playwright MCP / `openspec-pw explore`）
  │       ├─ 读取 app-knowledge.md（项目级知识）
  │       ├─ 从 specs 提取路由
  │       ├─ 遍历每个路由 → snapshot → screenshot
  │       └─ 写入 app-exploration.md（change 级发现）
  │           └─ 提取模式 → 更新 app-knowledge.md
  │
  ├── 5. Planner → 生成 test-plan.md
  │
  ├── 6. Generator → 创建 tests/playwright/changes/<name>/<name>.spec.ts
  │       └─ 写测试前先在真实浏览器验证选择器
  │
  ├── 7. 配置 auth → auth.setup.ts（如需要）
  │
  ├── 8. 配置 playwright → playwright.config.ts
  │
  ├── 9. 执行测试 → npx playwright test
  │       └─ Healer（如需要）→ 通过 MCP 自动修复失败
  │
  └── 10. 报告 → openspec/reports/playwright-e2e-<name>-<timestamp>.md
```

OpenSpec 1.x 下同一工作流用 `/opsx:e2e`（Claude Code / CodeBuddy CLI / Gemini CLI）或 `/opsx-e2e`（多数其它编辑器）触发；步骤不变。

</details>

## `openspec-pw init` 做了什么

1. 检测项目中的受支持编辑器（见 [支持的 AI 编码助手](#支持的-ai-编码助手) 表；Pi、Oh My Pi、MiniMax Code、DeepSeek Harness、Gemini CLI、Qwen Code、GitHub Copilot、Roo Code、Codex 与 Kimi Code 也会通过全局配置目录 `~/.pi/agent/` / `~/.omp/agent/` / `~/.minimax-code/` / `~/.dsh/` / `~/.gemini/` / `~/.qwen/` / `~/.copilot/` / `~/.roo/` / `~/.codex/` / `~/.kimi-code/` 检测）
2. 为每个选中的编辑器安装 E2E 命令或技能（路径见 [使用](#使用) 表）
3. 生成 `tests/playwright/seed.spec.ts`、`auth.setup.ts`、`credentials.yaml`、`app-knowledge.md`、`test-plan.template.md`、`pages/BasePage.ts`，以及项目根的 `lint-guidelines.md` 吞错与文档注释 lint 清单（未手改时由 `update` 刷新，`remove` 清理）

> **`--lint-config`（opt-in）**：项目声明 eslint 9+ 且项目及祖先目录（至 git 根）均无 ESLint 配置时生成最小 `eslint.config.mjs`（TypeScript 项目接入已声明的 parser——`typescript-eslint` 或 `@typescript-eslint/parser`——并写入 `files`/`languageOptions`）；ruff 侧按 `.ruff.toml` > `ruff.toml` > `pyproject.toml` 的优先级（ruff 自身规则）创建或追加受管 `extend-select = ["B904"]` 块。已有配置绝不编辑——只打印可粘贴片段。重复运行幂等；受管块被手改时保留原样。
4. 检测前端信号（分层检测：框架配置文件 → 前端框架依赖 → dev 命令关键词，含 monorepo workspace 成员检测——前端在 `apps/*` 的 pnpm/npm workspace 也能识别）；未检测到时在 Summary 打印引导提示——monorepo 去应用目录运行 `openspec-pw init`，纯 API 项目用 Playwright `request` fixture

## 首次配置清单

首次使用 E2E 工作流，按顺序执行以下步骤：

| 步骤 | 命令 | 失败时快速修复 |
|------|------|----------------|
| 1. 安装 CLI | `npm install -g openspec-playwright@latest` | 检查 Node.js 版本 `node -v`（需 >= 22） |
| 2. 安装 OpenSpec | `npm install -g @fission-ai/openspec@2 && openspec init --scope project` | `npm cache clean -f && npm install -g @fission-ai/openspec@2` |
| 3. 初始化 E2E | `openspec-pw init` | 运行 `openspec-pw doctor` 查看具体缺失项 |
| 4. 安装浏览器 | `npx playwright install chromium` | Linux CI 镜像可能需系统依赖：`npx playwright install --with-deps chromium`（macOS 可能需先运行 `xcode-select --install`） |
| 5. 启动开发服务器 | `npm run dev`（在另一个终端） | 确认端口，配置 `BASE_URL` |
| 6. 验证环境 | `npx playwright test tests/playwright/seed.spec.ts` | 检查 `playwright.config.ts` 中的 `webServer` 配置 |
| 7. 配置认证（如需要） | 见下方"认证配置" | `npx playwright test --project=setup` 调试 |
| 8. 运行第一个 E2E | `/openspec-e2e <change-name>`（所有编辑器；Codex `$openspec-e2e`、Kimi `/skill:openspec-e2e`；1.x 用 `/opsx:e2e` / `/opsx-e2e`） | 查看 `openspec/reports/` 中的报告 |

`openspec-pw init` 会为选中的编辑器安装 Playwright MCP server；`openspec-pw doctor` 负责校验。

### `openspec-pw doctor` 检查清单

`openspec-pw doctor` 验证前置条件，**必需**项失败时退出码非零。

| 类别 | 必需检查项 | 可选检查项 |
|---|---|---|
| **Node.js** | `node` 版本 | `engines` 兼容性（对比 `package.json`） |
| **npm** | `npm` 可用性 | — |
| **Playwright 配置** | 配置文件存在（`ts`/`js`/`mjs`/`mts`） | — |
| **OpenSpec** | 目录已初始化、CLI 主版本为 1 或 2（缺失、不可读或 3.x 即失败） | `.spec.md` 规范文件数量 |
| **Playwright 浏览器** | CLI 版本、Chromium 二进制已下载 | — |
| **Playwright 测试框架** | `@playwright/test` 已安装 | — |
| **小程序** | Chrome、`@open-wxa/wxa-runner-playwright`、`@playwright/test` >=1.64、`wxaProject` 产物（仅小程序目标） | — |
| **Playwright MCP** | 每个已授权（有命令工件）编辑器的 test-runner server 配置；未授权编辑器降为信息行（提示 `init --tools` 添加，不阻断） | `playwright-cli`（PATH 上的 @playwright/cli）——可选 ⚠，不阻断 |
| **Cursor E2E** | Cursor 已授权时，命令与技能文件存在 | 未配置 → 信息行提示 `init --tools cursor` |
| **Vendored Agents** | — | 官方 agents 快照的存在与归属（owned/modified）；依赖的 `playwright-test` MCP 缺失时 ⚠（不阻断） |
| **Sync** | 已初始化时标准同步（漂移 → `openspec-pw update`；AGENTS.md 无标记视为未初始化，恒 ok:true） | 未初始化（闸门，不阻断） |
| **测试目录** | `tests/playwright/` 目录存在 | `auth.setup.ts` 是否存在 · `storage-state` 完整性——config 声明 `storageState` 而 state 文件缺失 → ⚠ + `npx playwright test --project=setup`（不阻断） |
| **种子测试** | — | `seed.spec.ts` 是否存在 |
| **Lint** | — | 吞错清单覆盖检查，语义优先（linter 能解析配置时用 `eslint --print-config` / `ruff check --show-settings` 对代表源文件判定；项目及祖先目录至 git 根的配置均计入），失败回退字面量探测（不阻断）：ESLint 未见生效的 `no-empty` → 提示对照 `lint-guidelines.md`；ruff 未见生效的 `B904` → 缺口提示；`ruff`/`pylint` PATH 感知；单面缺配置 → 该面静默，两面全无 → 单行信息 |
| **应用服务器** | — | 开发脚本、基础 URL、可达性 |
| **CodeGraph** | — | CLI 可用性、索引存在、MCP 安装（警告，不阻断） |

加 `--json` 参数输出机器可读格式。

## 认证配置

如果你的应用需要登录，配置一次凭证后，所有测试自动以已登录状态运行。

> **凭据自动忽略**：init 和 update 会在 `.gitignore` 尾部维护一个标记块，忽略 `tests/playwright/credentials.yaml`、其 `.bak`、`tests/playwright/test-results/` 和探索截图（`tests/playwright/screenshots/`——随开发过时，本地留档）——以及 auth storageState（`playwright/.auth/`，已登录会话 cookie）、MCP 配置（`.mcp.json`、`opencode.json(c)`、`.gemini/settings.json`、`.qwen/settings.json`、`.roo/mcp.json`、`.trae/mcp.json`、`.kimi-code/mcp.json`——用户自加的 server 常在 env/headers 里放 API key）、工具本地数据（`.codegraph/`、`.playwright-mcp/`）、第一层名如 `.claude/`、`.cursor/`、`.codebuddy/`、`.agents/skills/openspec-e2e/`、`.dsh/skills/openspec-e2e/`、`.gemini/commands/openspec-e2e.toml`、`.qwen/commands/openspec-e2e.md`、`.github/prompts/openspec-e2e.prompt.md`、`.roo/commands/openspec-e2e.md`、`.trae/commands/openspec-e2e.md`、`.kimi-code/skills/openspec-e2e/`（对应的 1.x `opsx-` 路径同样受管）、`openspec/`、`AGENTS.md`、`CLAUDE.md`、`CODEBUDDY.md`、`GEMINI.md`、`QWEN.md`、`.github/copilot-instructions.md`、`.roo/rules/openspec-pw.md`、`.trae/rules/project_rules.md`（生成的产物按设计留在本地）。标记块幂等、不碰你自己的规则，`remove` 时自动清理。无法写入时会降级为警告并列出未覆盖路径。注意：ignore 规则对已被 git 追踪的文件无效——若凭据曾提交过，请执行 `git rm --cached tests/playwright/credentials.yaml`。也可以改用 `E2E_USERNAME` / `E2E_PASSWORD` 环境变量。

```bash
# 1.（可选）编辑测试用户（角色测试）
vim tests/playwright/credentials.yaml

# 2. 启用认证并设置环境变量
export E2E_AUTH_REQUIRED=true
export E2E_AUTH_METHOD=api # 或 ui
export E2E_AUTH_API=/api/auth/login # 可选；默认为此值
export E2E_USERNAME=your-email@example.com
export E2E_PASSWORD=your-password

# 3. 录制登录（一次性；UI 登录会打开浏览器）
npx playwright test --project=setup

# 4. 后续所有测试自动复用登录状态
/openspec-e2e my-feature
```

支持 **API 登录**（推荐，基于 cookie）和 **UI 登录**（备选，用于 token/localStorage 认证）。多用户测试（管理员 vs 普通用户）在 `credentials.yaml` 中添加多个用户，运行 `/openspec-e2e`（Codex `$openspec-e2e`、Kimi `/skill:openspec-e2e`；1.x 下 Claude/CodeBuddy/Gemini 用 `/opsx:e2e`，其余用 `/opsx-e2e`）— 它从 specs 读取角色标签、从 `credentials.yaml` 读取用户，然后为每个角色生成一份 setup。每份 setup 读取 `E2E_<ROLE>_USERNAME` 与 `E2E_<ROLE>_PASSWORD`（角色名大写；非字母数字字符变为 `_`）。

## 自定义

### 自定义 seed 测试

编辑 `tests/playwright/seed.spec.ts` 以匹配你的应用：
- 基础 URL
- 常用选择器
- Page Object 方法

### 认证凭证

编辑 `tests/playwright/credentials.yaml`：
- 为角色测试添加每个角色的用户条目

认证环境变量：
- `E2E_AUTH_REQUIRED=true` — 实际运行 `auth.setup.ts`；未设置时 setup 测试会跳过
- `E2E_AUTH_API` — API 登录端点（默认 `/api/auth/login`）；API 登录假定使用 cookie 认证
- `E2E_AUTH_METHOD=ui` — 改用 UI 登录，用于 token/localStorage 认证
- `E2E_AUTH_CHECK_PATH` — 可选；登录后、保存会话前断言该路径可访问
- `E2E_<ROLE>_USERNAME` / `E2E_<ROLE>_PASSWORD` — 多用户时每个角色一对

CI 中把 `E2E_AUTH_*` 设为仓库变量；workflow 会将它们传给测试步骤。多用户 CI 需要把每个角色的凭据设为 secrets，并在 workflow env 中转发——内置 workflow 只转发 `E2E_USERNAME` / `E2E_PASSWORD`。

> **升级已有项目？** `openspec-pw update` 不会改动已有的 `auth.setup.ts` 和 `.github/workflows/openspec-pw.yml`。请手动合并当前模板里的 `E2E_AUTH_*` 处理，或重新生成这两个文件；否则新变量会被忽略。

## 架构

<details>
<summary>模板、CLI、编辑器、规范、测试资产、探索文件树</summary>

```
模板（内置于 npm 包，安装到 tests/playwright/）
  └── seed.spec.ts, auth.setup.ts, credentials.yaml, app-knowledge.md, test-plan.template.md, pages/BasePage.ts

CLI (openspec-pw)
  ├── init       → 安装命令和模板
  ├── update     → 从 npm 同步命令和模板
  ├── migrate    → 迁移旧测试文件到新目录结构
  ├── audit      → 检查测试文件是否有孤儿文件和配置问题
  ├── coverage   → 分析 spec 与测试之间的覆盖率
  ├── flake      → 检测测试文件中的不稳定模式（静态 + 被调大的超时）
  ├── doctor     → 检查前置条件
  ├── explore    → 探索应用路由
  └── remove     → 移除集成（--all：扫描 home 与 Windows 盘根；--yes 才执行）

编辑器 → 命令/技能路径与 MCP 配置文件见上方「使用」与「前置条件」两节。
```

员工级规范统一存放在 **AGENTS.md** 中。Claude Code 通过 CLAUDE.md 的 `@AGENTS.md` 导入加载
（Claude Code 官方记载的复用 AGENTS.md 机制，默认并不读取 AGENTS.md）。
导入位置无约束（官方原文 "anywhere in your CLAUDE.md"），唯一要求是 `@` 行不能放在反引号或代码块内。
导入行位于 OPENSPEC-PW:START/END 注释之外（注释在注入上下文前被剥离），marker 作为工具领地边界、
导入仍生效；OpenCode 在 `opencode.jsonc` 的 `instructions` 中注册 AGENTS.md；
Cline、Cursor、MiniMax Code、DeepSeek Harness、Codex 与 Kimi Code 原生自动识别 `AGENTS.md`，无需包装文件。Gemini CLI、Qwen Code、GitHub Copilot、Roo Code 与 Trae 读取各自的规则文件（GEMINI.md、QWEN.md、`.github/copilot-instructions.md`、`.roo/rules/openspec-pw.md`、`.trae/rules/project_rules.md`），这些文件直接承载完整规范块。CodeBuddy CLI 加载方式与 Claude Code 相同——
thin CODEBUDDY.md wrapper，同样的 `@AGENTS.md` 导入（CodeBuddy 双文件并存时优先读 CODEBUDDY.md）。

**规则副本退出。** AGENTS.md 是唯一必需的规则文件，上面的 wrapper 与 full 规则文件都只是便利副本。`init --no-rule-files` 只装 AGENTS.md，跳过这些副本并清理上次遗留的副本（含 `update` 刷新过的；块外有用户内容时保留）；`init --rule-files` 恢复它们。退出记录写在受管 `.gitignore` 块头的 `# openspec-pw: skip=…` 行，后续 `init` / `update` 无需重复传参即沿用；两个开关都不传时保持已记录的退出决定，`doctor` 把已退出的载体报告为「主动禁用」而非缺失。

> **与官方 `@fission-ai/openspec` CLI 共存**：官方 `openspec update` 内置「legacy 清理」，会删除根
> AGENTS.md/CLAUDE.md 中以普通 `OPENSPEC:START/END` 包裹的块（2026-08-28 曾因此误删本工具的规范块）。
> openspec-pw 的块使用专属 `OPENSPEC-PW:` 命名空间，官方匹配器不可见（已对照官方 v1.11.0 实测）。
> 旧版项目会在下次 `openspec-pw update`/`init` 时自动迁移标记；若块已被官方清掉，
> `openspec-pw update` 会黄色警告，跑 `openspec-pw init` 即可恢复。

```
测试资产 (tests/playwright/)
  ├── seed.spec.ts        → 环境验证
  ├── auth.setup.ts       → 会话录制
  ├── global.teardown.ts  → 测试后清理（可选）
  ├── credentials.yaml    → 测试用户
  ├── app-knowledge.md    → 项目级选择器模式（跨 change 复用）
  ├── test-plan.template.md → 新 change 的测试计划结构
  └── pages/BasePage.ts   → 共享页面对象基类

探索结果 (openspec/changes/<name>/specs/playwright/)
  ├── app-exploration.md → 本次 change 的路由 + 已验证选择器
  └── test-plan.md       → 本次 change 的测试用例

Healer Agent (playwright-test MCP server)
  └── test_run / test_debug / test_list + browser_* 工具
```

</details>

## 许可

MIT
