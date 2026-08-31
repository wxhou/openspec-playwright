# OpenSpec + Playwright E2E 验证

[English version](./README.md)

将 OpenSpec 的规格驱动开发工作流与 Playwright 三 Agent 测试管道集成，实现自动化 E2E 验证。

## 安装

```bash
npm install -g openspec-playwright@latest
```

## 前置条件

**必需：**

1. **Node.js >= 20**
2. **Claude Code**（带 `.claude/` 目录）和/或 **OpenCode**（带 `.opencode/` 目录）和/或 **Cline**（带 `.cline/` 或 `.clinerules/` 目录）和/或 **Cursor**（带 `.cursor/` 目录）和/或 **Pi**（项目 `.pi/` 或全局 `~/.pi/agent/`）和/或 **Oh My Pi**（项目 `.omp/` 或全局 `~/.omp/agent/`）
3. **OpenSpec** 已初始化：`npm install -g @fission-ai/openspec@latest && openspec init`
4. **Playwright MCP**（用于测试执行 + Healer）— `openspec-pw init` 会在检测到前端信号时按编辑器自动安装（纯 API 项目跳过——API 测试用 `request` fixture），**全部项目级**（写入项目内文件；Claude Code 用 `--scope project` 写项目根 `.mcp.json`，不碰全局 `~/.claude.json`）。安装**单个** server，与 Playwright 官方 `playwright init-agents` 布局一致：
   - `playwright-test` — 官方 test-runner server（`npx playwright run-test-mcp-server`，`playwright` 包自带）。是 `@playwright/mcp` 的**超集**：一个条目同时暴露 `browser_*` 浏览器工具（探索 + Healer 页面检查）和结构化的 `test_run` / `test_debug` / `test_list` 工作流工具（Healer 闭环）。
   - **Claude Code**：`claude mcp add --scope project playwright-test npx playwright run-test-mcp-server`（写入项目根 `.mcp.json`，可随版本控制供团队共享）
   - **OpenCode**：合并到 `opencode.jsonc` 的 `mcp["playwright-test"] = { type: "local", command: ["npx", "playwright", "run-test-mcp-server"] }`
   - **Cline**：合并到 `.cline/mcp.json` 的 `mcpServers["playwright-test"] = { "command": "npx", "args": ["playwright", "run-test-mcp-server"] }`
   - **Cursor**：合并到 `.cursor/mcp.json` 的 `mcpServers["playwright-test"] = { "command": "npx", "args": ["playwright", "run-test-mcp-server"] }`
   - **Oh My Pi**：合并到 `.omp/mcp.json` 的 `mcpServers["playwright-test"] = { "command": "npx", "args": ["playwright", "run-test-mcp-server"] }`
   - **Pi**：无 MCP 客户端，跳过安装 — 浏览器探索改用 `openspec-pw explore`

> **旧版本迁移**：早期版本把 Claude Code 的 Playwright MCP 装到全局 user 域（`~/.claude.json`）。若你用旧版 `openspec-pw` 初始化过，全局残留仍会对所有项目生效，清理一次即可：`claude mcp remove playwright`（user 域）。注意：项目级 server 首次交互使用时 Claude Code 会弹出批准提示（`claude mcp reset-project-choices` 可重置选择）。

浏览器探索能力由 Playwright MCP 和 `openspec-pw explore` 内置提供，无需额外工具。

## 初始化

```bash
# 在项目目录下
openspec init              # 初始化 OpenSpec
openspec-pw init          # 安装 Playwright E2E 集成（--tools 可选编辑器）
```

> **注意**：运行 `openspec-pw init` 后，手动安装 Playwright 浏览器：`npx playwright install --with-deps`

## 支持的 AI 编码助手

**Claude Code**（Anthropic）— E2E 工作流由 `探索 + 测试执行` 两步组成：Playwright MCP + `openspec-pw explore`。

**OpenCode**（SST）— E2E 工作流由 `/opsx-e2e` 命令驱动（按 OpenSpec 惯例使用连字符），使用相同的浏览器探索 + Playwright MCP 技术栈。Playwright MCP 通过 `opencode.jsonc` 的 `mcp["playwright-test"]` 配置。

**Cline** — E2E 工作流由 `/opsx-e2e` skill 驱动（安装为 `.cline/skills/opsx-e2e/SKILL.md`），使用相同的浏览器探索 + Playwright MCP 技术栈。Playwright MCP 通过 `.cline/mcp.json` 的 `mcpServers["playwright-test"]` 配置。Cline 原生自动识别 `AGENTS.md` 作为项目规则 — 无需包装文件。

**Cursor** — E2E 工作流双份安装：斜杠命令 `.cursor/commands/opsx-e2e.md`（纯 markdown，`$1` = change 名）+ Agent Skill `.cursor/skills/opsx-e2e/SKILL.md`（`disable-model-invocation: true`）。调用 `/opsx-e2e`。Playwright MCP 合并进 `.cursor/mcp.json` 的 `mcpServers["playwright-test"]`。Cursor 原生识别 `AGENTS.md`。Skill 名为 `opsx-e2e`（不是 OpenSpec 的 `openspec-*` 前缀）。若要用 Cursor 但还没有 `.cursor/`：`mkdir -p .cursor`。

**Pi**（earendil-works）— E2E 工作流由 `/opsx-e2e` 提示词模板驱动（安装为 `.pi/prompts/opsx-e2e.md`，文件名即命令名）。Pi **没有 MCP 客户端**，浏览器探索改用 `openspec-pw explore`，测试执行用 shell 跑 `npx playwright test`。Pi 原生加载 `AGENTS.md` — 无需包装文件。检测信号：项目 `.pi/` 目录或全局 `~/.pi/agent/` 配置目录。

**Oh My Pi（omp）** — E2E 工作流由 `/opsx-e2e` 命令驱动（安装为 `.omp/commands/opsx-e2e.md`）。Playwright MCP 配置在 `.omp/mcp.json` 的 `mcpServers["playwright-test"]`（omp 也会继承 `.claude/` / `.cursor/` / opencode 的 MCP 配置）。omp 原生识别 `AGENTS.md` — 无需包装文件。检测信号：项目 `.omp/` 目录或全局 `~/.omp/agent/` 配置目录。

**Oh My Pi（omp）** — E2E 工作流由 `/opsx-e2e` 命令驱动（安装为 `.omp/commands/opsx-e2e.md`）。Playwright MCP 配置在 `.omp/mcp.json` 的 `mcpServers["playwright-test"]`（omp 也会继承 `.claude/` / `.cursor/` / opencode 已有 MCP 配置）。omp 原生自动识别 `AGENTS.md` — 无需包装文件。检测信号：项目 `.omp/` 目录或全局 `~/.omp/agent/` 配置目录。

## 使用

### 在 Claude Code 中

```bash
/opsx:e2e <change-name>
```

### 在 OpenCode 中

```bash
/opsx-e2e <change-name>
```

命令 id 按 OpenSpec 惯例使用连字符；正文在安装时从 `/opsx:` 改写为 `/opsx-`，存储在 `.opencode/commands/opsx-e2e.md`。

### 在 Cline 中

```bash
/opsx-e2e <change-name>
```

Skill 安装在 `.cline/skills/opsx-e2e/SKILL.md`，通过 `/opsx-e2e` 斜杠命令触发。正文在安装时从 `/opsx:` 改写为 `/opsx-`。

### 在 Cursor 中

```bash
/opsx-e2e <change-name>
```

安装为 `.cursor/commands/opsx-e2e.md` 与 `.cursor/skills/opsx-e2e/SKILL.md`。命令正文为纯 markdown（无 frontmatter）；skill 设置 `disable-model-invocation: true`，仅在显式调用时加载。

### 在 Pi 中

```bash
/opsx-e2e <change-name>
```

安装为 `.pi/prompts/opsx-e2e.md` — 提示词模板，文件名即命令名。Pi 没有 MCP 客户端，浏览器探索改用 `openspec-pw explore`，测试执行用 `npx playwright test`（无 Healer）。

### 在 Oh My Pi 中

```bash
/opsx-e2e <change-name>
```

安装为 `.omp/commands/opsx-e2e.md`（omp 原生命令，含 `name` + `description` frontmatter）。Playwright MCP 配置在 `.omp/mcp.json`；omp 也会继承 `.claude/` / `.cursor/` / `opencode.json` 中已有的 MCP 配置。

### 初始化时选择编辑器

`openspec-pw init` 默认自动检测项目中的编辑器并全部配置。如需只装一部分（或不装），用 `--tools` —— 语义与 `openspec init --tools` 一致：

```bash
openspec-pw init --tools claude,cursor   # 只配置 Claude Code 与 Cursor
openspec-pw init --tools all             # 配置所有受支持编辑器
openspec-pw init --tools none            # 不配置编辑器，只生成脚手架
```

受支持 id：`claude`、`opencode`、`cline`、`cursor`、`pi`、`omp`（`oh-my-pi` 是 `omp` 的别名）。id 大小写不敏感、重复自动去重、`all`/`none` 不能与具体 id 混用。被 `--tools` 指定的编辑器即使未被检测到也会配置（会自动创建其配置目录）。

未提供 `--tools` 时：TTY 终端弹出交互式多选（预选已检测的编辑器——含 Pi / Oh My Pi 的全局配置目录信号）；非交互终端回退到**仅项目内检测**（全局配置目录只是预选建议，不构成写入授权）。`--tools` 与 `--no-mcp` 正交：前者选择*哪些*编辑器，后者决定*是否*为它们安装 Playwright MCP。

init 打印两种输出信号：`Detected (pre-select):` 行（仅未传 `--tools` 时出现）是 TTY 多选的预选提示——any-scope 检测，**不是**实际安装集；`Selected editors:` 行（总是打印，位于任何编辑器配置之前）才是实际安装集。判断装了什么，看 `Selected editors`。

**编辑器领土**：`update` 只维护项目内已有 openspec-pw 命令工件的编辑器——不会新增编辑器（全局配置目录或手建的 `.cursor/` 不构成写入授权）。给已初始化项目新增编辑器请重跑 `openspec-pw init --tools <id>`（幂等）。

### CLI 命令

```bash
openspec-pw init          # 初始化集成（--tools all|none|ids… 可选编辑器）
openspec-pw update        # 更新 CLI 和命令到最新版本
openspec-pw doctor        # 检查前置条件 (Node, Playwright, OpenSpec, 配置, 测试) + 应用服务器诊断
openspec-pw audit         # 检查测试文件是否有孤儿文件和配置问题
openspec-pw coverage      # 分析 spec 与测试之间的覆盖率
openspec-pw flake         # 检测测试文件中的静态不稳定模式
openspec-pw migrate       # 迁移旧测试文件到新目录结构
openspec-pw explore       # 探索应用路由
openspec-pw uninstall     # 移除项目中的集成
```

## 工作原理

```
# 由 /opsx:e2e <change-name>（Claude Code）或 /opsx-e2e <change-name>（OpenCode/Cline/Cursor/Pi/Oh My Pi）触发
/opsx:e2e <change-name>
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
  │
  ├── 10. Healer（如需要）→ 通过 MCP 自动修复失败
  │
  └── 11. 报告 → openspec/reports/playwright-e2e-<name>-<timestamp>.md
```

## `openspec-pw init` 做了什么

1. 检测项目中的受支持编辑器（Claude Code 和/或 OpenCode 和/或 Cline 和/或 Cursor 和/或 Pi 和/或 Oh My Pi；Pi 与 Oh My Pi 也会通过全局配置目录 `~/.pi/agent/` / `~/.omp/agent/` 检测）
2. 为每个检测到的编辑器安装 E2E 命令（Claude Code 用 `/opsx:e2e`，OpenCode / Cline / Cursor / Pi / Oh My Pi 用 `/opsx-e2e`；Cursor 另装 Agent Skill）
3. 生成 `tests/playwright/seed.spec.ts`、`auth.setup.ts`、`credentials.yaml`、`app-knowledge.md`、`pages/BasePage.ts`
4. 检测前端信号（分层检测：框架配置文件 → 前端框架依赖 → dev 命令关键词，含 monorepo workspace 成员检测——前端在 `apps/*` 的 pnpm/npm workspace 也能识别）；未检测到时在 Summary 打印引导提示——monorepo 去应用目录运行 `openspec-pw init`，纯 API 项目用 Playwright `request` fixture

## 首次配置清单

首次使用 E2E 工作流，按顺序执行以下步骤：

| 步骤 | 命令 | 失败时快速修复 |
|------|------|----------------|
| 1. 安装 CLI | `npm install -g openspec-playwright@latest` | 检查 Node.js 版本 `node -v`（需 >= 20） |
| 2. 安装 OpenSpec | `npm install -g @fission-ai/openspec@latest && openspec init` | `npm cache clean -f && npm install -g @fission-ai/openspec@latest` |
| 3. 初始化 E2E | `openspec-pw init` | 运行 `openspec-pw doctor` 查看具体缺失项 |
| 4. 安装 Playwright MCP | `claude mcp add --scope project playwright-test npx playwright run-test-mcp-server`（Claude，写入项目根 `.mcp.json`），或将 `mcp["playwright-test"]` 加入 `opencode.jsonc`（OpenCode），或将 `mcpServers["playwright-test"]` 加入 `.cline/mcp.json`（Cline）/ `.cursor/mcp.json`（Cursor）/ `.omp/mcp.json`（Oh My Pi）；Pi 无简单 MCP 配置文件，跳过 | `cat .mcp.json`（Claude，检查 `mcpServers["playwright-test"]`）/ `cat opencode.jsonc`（OpenCode）/ `cat .cline/mcp.json`（Cline）/ `cat .cursor/mcp.json`（Cursor）/ `cat .omp/mcp.json`（Oh My Pi）确认安装成功 |
| 5. 安装浏览器 | `npx playwright install --with-deps` | macOS 可能需先运行 `xcode-select --install` |
| 6. 启动开发服务器 | `npm run dev`（在另一个终端） | 确认端口，配置 `BASE_URL` |
| 7. 验证环境 | `npx playwright test tests/playwright/seed.spec.ts` | 检查 `playwright.config.ts` 中的 `webServer` 配置 |
| 8. 配置认证（如需要） | 见下方"认证配置" | `npx playwright test --project=setup` 调试 |
| 9. 运行第一个 E2E | `/opsx:e2e <change-name>`（Claude）或 `/opsx-e2e <change-name>`（OpenCode/Cline/Cursor/Pi/Oh My Pi） | 查看 `openspec/reports/` 中的报告 |

### `openspec-pw doctor` 检查清单

`openspec-pw doctor` 在 10 个类别中验证前置条件，**必需**项失败时退出码非零。

| 类别 | 必需检查项 | 可选检查项 |
|---|---|---|
| **Node.js** | `node` 版本 | `engines` 兼容性（对比 `package.json`） |
| **npm** | `npm` 可用性 | — |
| **Playwright 配置** | 配置文件存在（`ts`/`js`/`mjs`/`mts`） | — |
| **OpenSpec** | 目录已初始化 | `.spec.md` 规范文件数量 |
| **Playwright 浏览器** | CLI 版本、Chromium 二进制已下载 | — |
| **Playwright 测试框架** | `@playwright/test` 已安装 | — |
| **Playwright MCP** | 每个已授权（有命令工件）编辑器的 test-runner server 配置；未授权编辑器降为信息行（提示 `init --tools` 添加，不阻断） | `playwright-cli`（PATH 上的 @playwright/cli）——可选 ⚠，不阻断 |
| **Sync** | 已初始化时标准同步（漂移 → `openspec-pw update`；AGENTS.md 无标记视为未初始化，恒 ok:true） | 未初始化（闸门，不阻断） |
| **测试目录** | `tests/playwright/` 目录存在 | `auth.setup.ts` 是否存在 |
| **种子测试** | — | `seed.spec.ts` 是否存在 |
| **应用服务器** | — | 开发脚本、基础 URL、可达性 |
| **CodeGraph** | — | CLI 可用性、索引存在、MCP 安装（警告，不阻断） |

加 `--json` 参数输出机器可读格式。

## 认证配置

如果你的应用需要登录，配置一次凭证后，所有测试自动以已登录状态运行。

> **别把凭证提交进 git**：把 `tests/playwright/credentials.yaml`（以及 `openspec-pw update` 会写的 `credentials.yaml.bak`）加入 `.gitignore`，或改用 `E2E_USERNAME` / `E2E_PASSWORD` 环境变量。未忽略时 init 和 update 会打印黄色警告行。

```bash
# 1. 编辑凭证
vim tests/playwright/credentials.yaml

# 2. 设置环境变量
export E2E_USERNAME=your-email@example.com
export E2E_PASSWORD=your-password

# 3. 录制登录（一次性 — 打开浏览器，手动登录一次）
npx playwright test --project=setup

# 4. 后续所有测试自动复用登录状态
/opsx:e2e my-feature
```

支持 **API 登录**（推荐）和 **UI 登录**（备选）。多用户测试（管理员 vs 普通用户）在 `credentials.yaml` 中添加多个用户，运行 `/opsx:e2e`（OpenCode/Cline/Cursor/Pi/Oh My Pi 中用 `/opsx-e2e`）— 会从 specs 自动检测角色。

## 自定义

### 自定义 seed 测试

编辑 `tests/playwright/seed.spec.ts` 以匹配你的应用：
- 基础 URL
- 常用选择器
- Page Object 方法

### 认证凭证

编辑 `tests/playwright/credentials.yaml`：
- 设置登录 API 端点（或留空使用 UI 登录）
- 配置测试用户凭证
- 为角色测试添加多用户

## 架构

```
模板（内置于 npm 包，安装到 tests/playwright/）
  └── seed.spec.ts, auth.setup.ts, credentials.yaml, app-knowledge.md, pages/BasePage.ts

CLI (openspec-pw)
  ├── init       → 安装命令和模板
  ├── update     → 从 npm 同步命令和模板
  ├── migrate    → 迁移旧测试文件到新目录结构
  ├── audit      → 检查测试文件是否有孤儿文件和配置问题
  ├── coverage   → 分析 spec 与测试之间的覆盖率
  ├── flake      → 检测测试文件中的静态不稳定模式
  ├── doctor     → 检查前置条件
  ├── explore    → 探索应用路由
  └── uninstall  → 移除项目中的集成

编辑器（由 openspec-pw init 自动检测）
  ├── Claude Code (/opsx:e2e)
  │   ├── .claude/commands/opsx/e2e.md    → 命令文件（从 templates/e2e-command.md 安装）
  │   ├── playwright-test server         → Healer Agent 工具（通过 `claude mcp add --scope project playwright-test …`，写入项目根 `.mcp.json`）
  │   └── CLAUDE.md                       → CodeGraph 优先节 + 工作流提示 + 通过 `@AGENTS.md` 引入 AGENTS.md
  ├── OpenCode (/opsx-e2e)
  │   ├── .opencode/commands/opsx-e2e.md  → 命令文件（正文由 /opsx: 改写为 /opsx-）
  │   ├── opencode.jsonc                  → Playwright MCP (mcp["playwright-test"]) + 指令路由
  │   └── AGENTS.md                       → 员工级规范（单一数据源）
  ├── Cline (/opsx-e2e)
  │   ├── .cline/skills/opsx-e2e/SKILL.md → Skill 文件（正文由 /opsx: 改写为 /opsx-）
  │   ├── .cline/mcp.json                 → Playwright MCP (mcpServers["playwright-test"])
  │   └── AGENTS.md                       → 员工级规范（Cline 原生自动识别）
  ├── Cursor (/opsx-e2e)
  │   ├── .cursor/commands/opsx-e2e.md    → 斜杠命令（纯 MD，$1 = change 名）
  │   ├── .cursor/skills/opsx-e2e/SKILL.md → Skill（disable-model-invocation: true）
  │   ├── .cursor/mcp.json                → Playwright MCP (mcpServers["playwright-test"])
  │   └── AGENTS.md                       → 员工级规范（Cursor 原生自动识别）
  ├── Pi (/opsx-e2e)
  │   ├── .pi/prompts/opsx-e2e.md         → 提示词模板（文件名 = 命令名）
  │   └── AGENTS.md                       → 员工级规范（Pi 原生自动识别）
  │       （无 MCP 客户端 — 探索改用 `openspec-pw explore`）
  └── Oh My Pi (/opsx-e2e)
      ├── .omp/commands/opsx-e2e.md       → 命令文件（name + description frontmatter）
      ├── .omp/mcp.json                   → Playwright MCP (mcpServers["playwright-test"])
      └── AGENTS.md                       → 员工级规范（omp 原生自动识别）

员工级规范统一存放在 **AGENTS.md** 中。Claude Code 通过 CLAUDE.md 加载——前置 CodeGraph 优先节与
OpenSpec 工作流提示，后接 `@AGENTS.md` 导入（Claude Code 官方记载的复用 AGENTS.md 机制，默认并不读取 AGENTS.md）。
导入位置无约束（官方原文 "anywhere in your CLAUDE.md"），唯一要求是 `@` 行不能放在反引号或代码块内。
导入行位于 OPENSPEC-PW:START/END 注释之外（注释在注入上下文前被剥离），marker 作为工具领地边界、
导入仍生效；OpenCode 在 `opencode.jsonc` 的 `instructions` 中注册 AGENTS.md；
Cline 与 Cursor 原生自动识别 `AGENTS.md`，无需包装文件。

> **与官方 `@fission-ai/openspec` CLI 共存**：官方 `openspec update` 内置「legacy 清理」，会删除根
> AGENTS.md/CLAUDE.md 中以普通 `OPENSPEC:START/END` 包裹的块（2026-08-28 曾因此误删本工具的规范块）。
> openspec-pw 的块使用专属 `OPENSPEC-PW:` 命名空间，官方匹配器不可见（已对照官方 v1.11.0 实测）。
> 本 change 之前安装的项目会在下次 `openspec-pw update`/`init` 时自动迁移标记；若块已被官方清掉，
> `openspec-pw update` 会黄色警告，跑 `openspec-pw init` 即可恢复。

测试资产 (tests/playwright/)
  ├── seed.spec.ts        → 环境验证
  ├── auth.setup.ts       → 会话录制
  ├── global.teardown.ts  → 测试后清理（可选）
  ├── credentials.yaml    → 测试用户
  ├── app-knowledge.md    → 项目级选择器模式（跨 change 复用）
  └── pages/BasePage.ts   → 共享页面对象基类

探索结果 (openspec/changes/<name>/specs/playwright/)
  ├── app-exploration.md → 本次 change 的路由 + 已验证选择器
  └── test-plan.md       → 本次 change 的测试用例

Healer Agent (playwright-test MCP server)
  └── browser_snapshot, browser_navigate, browser_run_code 等
```

## 许可

MIT
