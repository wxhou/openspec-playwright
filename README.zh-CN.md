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
2. **Claude Code**（带 `.claude/` 目录）和/或 **OpenCode**（带 `.opencode/` 目录）和/或 **Cline**（带 `.cline/` 或 `.clinerules/` 目录）和/或 **Cursor**（带 `.cursor/` 目录）
3. **OpenSpec** 已初始化：`npm install -g @fission-ai/openspec@latest && openspec init`
4. **Playwright MCP**（用于测试执行 + Healer）— `openspec-pw init` 会按检测到的编辑器自动安装：
   - **Claude Code**：`claude mcp add playwright npx @playwright/mcp@latest`
   - **OpenCode**：合并到 `opencode.jsonc` 的 `mcp.playwright = { type: "local", command: ["npx", "@playwright/mcp@latest"] }`
   - **Cline**：合并到 `.cline/mcp.json` 的 `mcpServers.playwright = { "command": "npx", "args": ["@playwright/mcp@latest"] }`
   - **Cursor**：合并到 `.cursor/mcp.json` 的 `mcpServers.playwright = { "command": "npx", "args": ["@playwright/mcp@latest"] }`

浏览器探索能力由 Playwright MCP 和 `openspec-pw explore` 内置提供，无需额外工具。

## 初始化

```bash
# 在项目目录下
openspec init              # 初始化 OpenSpec
openspec-pw init          # 安装 Playwright E2E 集成
```

> **注意**：运行 `openspec-pw init` 后，手动安装 Playwright 浏览器：`npx playwright install --with-deps`

## 支持的 AI 编码助手

**Claude Code**（Anthropic）— E2E 工作流由 `探索 + 测试执行` 两步组成：Playwright MCP + `openspec-pw explore`。

**OpenCode**（SST）— E2E 工作流由 `/opsx-e2e` 命令驱动（按 OpenSpec 惯例使用连字符），使用相同的浏览器探索 + Playwright MCP 技术栈。Playwright MCP 通过 `opencode.jsonc` 的 `mcp.playwright` 配置。

**Cline** — E2E 工作流由 `/opsx-e2e` skill 驱动（安装为 `.cline/skills/opsx-e2e/SKILL.md`），使用相同的浏览器探索 + Playwright MCP 技术栈。Playwright MCP 通过 `.cline/mcp.json` 的 `mcpServers.playwright` 配置。Cline 原生自动识别 `AGENTS.md` 作为项目规则 — 无需包装文件。

**Cursor** — E2E 工作流双份安装：斜杠命令 `.cursor/commands/opsx-e2e.md`（纯 markdown，`$1` = change 名）+ Agent Skill `.cursor/skills/opsx-e2e/SKILL.md`（`disable-model-invocation: true`）。调用 `/opsx-e2e`。Playwright MCP 合并进 `.cursor/mcp.json` 的 `mcpServers.playwright`。Cursor 原生识别 `AGENTS.md`。Skill 名为 `opsx-e2e`（不是 OpenSpec 的 `openspec-*` 前缀）。若要用 Cursor 但还没有 `.cursor/`：`mkdir -p .cursor`。

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

### CLI 命令

```bash
openspec-pw init          # 初始化集成（一次性设置）
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
# 由 /opsx:e2e <change-name>（Claude Code）或 /opsx-e2e <change-name>（OpenCode/Cline/Cursor）触发
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

1. 检测项目中的受支持编辑器（Claude Code 和/或 OpenCode 和/或 Cline 和/或 Cursor）
2. 为每个检测到的编辑器安装 E2E 命令（Claude Code 用 `/opsx:e2e`，OpenCode / Cline / Cursor 用 `/opsx-e2e`；Cursor 另装 Agent Skill）
3. 生成 `tests/playwright/seed.spec.ts`、`auth.setup.ts`、`credentials.yaml`、`app-knowledge.md`、`pages/BasePage.ts`

## 首次配置清单

首次使用 E2E 工作流，按顺序执行以下步骤：

| 步骤 | 命令 | 失败时快速修复 |
|------|------|----------------|
| 1. 安装 CLI | `npm install -g openspec-playwright@latest` | 检查 Node.js 版本 `node -v`（需 >= 20） |
| 2. 安装 OpenSpec | `npm install -g @fission-ai/openspec@latest && openspec init` | `npm cache clean -f && npm install -g @fission-ai/openspec@latest` |
| 3. 初始化 E2E | `openspec-pw init` | 运行 `openspec-pw doctor` 查看具体缺失项 |
| 4. 安装 Playwright MCP | `claude mcp add playwright npx @playwright/mcp@latest`（Claude），或将 `mcp.playwright` 加入 `opencode.jsonc`（OpenCode），或将 `mcpServers.playwright` 加入 `.cline/mcp.json`（Cline）/ `.cursor/mcp.json`（Cursor） | `claude mcp list`（Claude）/ `cat opencode.jsonc`（OpenCode）/ `cat .cline/mcp.json`（Cline）/ `cat .cursor/mcp.json`（Cursor）确认安装成功 |
| 5. 安装浏览器 | `npx playwright install --with-deps` | macOS 可能需先运行 `xcode-select --install` |
| 6. 启动开发服务器 | `npm run dev`（在另一个终端） | 确认端口，配置 `BASE_URL` |
| 7. 验证环境 | `npx playwright test tests/playwright/seed.spec.ts` | 检查 `playwright.config.ts` 中的 `webServer` 配置 |
| 8. 配置认证（如需要） | 见下方"认证配置" | `npx playwright test --project=setup` 调试 |
| 9. 运行第一个 E2E | `/opsx:e2e <change-name>`（Claude）或 `/opsx-e2e <change-name>`（OpenCode/Cline/Cursor） | 查看 `openspec/reports/` 中的报告 |

### `openspec-pw doctor` 检查清单

`openspec-pw doctor` 在 8 个类别中验证前置条件，**必需**项失败时退出码非零。

| 类别 | 必需检查项 | 可选检查项 |
|---|---|---|
| **Node.js** | `node` 版本 | `engines` 兼容性（对比 `package.json`） |
| **npm** | `npm` 可用性 | — |
| **Playwright 配置** | 配置文件存在（`ts`/`js`/`mjs`/`mts`） | — |
| **OpenSpec** | 目录已初始化 | `.spec.md` 规范文件数量 |
| **Playwright 浏览器** | CLI 版本、Chromium 二进制已下载 | — |
| **Playwright 测试框架** | `@playwright/test` 已安装 | — |
| **Playwright MCP** | 每个检测到的编辑器均已配置 | — |
| **测试目录** | `tests/playwright/` 目录存在 | `auth.setup.ts` 是否存在 |
| **种子测试** | — | `seed.spec.ts` 是否存在 |
| **应用服务器** | — | 开发脚本、基础 URL、可达性 |

加 `--json` 参数输出机器可读格式。

## 认证配置

如果你的应用需要登录，配置一次凭证后，所有测试自动以已登录状态运行。

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

支持 **API 登录**（推荐）和 **UI 登录**（备选）。多用户测试（管理员 vs 普通用户）在 `credentials.yaml` 中添加多个用户，运行 `/opsx:e2e`（OpenCode/Cline/Cursor 中用 `/opsx-e2e`）— 会从 specs 自动检测角色。

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
  │   ├── @playwright/mcp                 → Healer Agent 工具（通过 `claude mcp add playwright …`）
  │   └── CLAUDE.md                       → CodeGraph 优先节 + 通过 `@AGENTS.md` 引入 AGENTS.md
  ├── OpenCode (/opsx-e2e)
  │   ├── .opencode/commands/opsx-e2e.md  → 命令文件（正文由 /opsx: 改写为 /opsx-）
  │   ├── opencode.jsonc                  → Playwright MCP (mcp.playwright) + 指令路由
  │   └── AGENTS.md                       → 员工级规范（单一数据源）
  ├── Cline (/opsx-e2e)
  │   ├── .cline/skills/opsx-e2e/SKILL.md → Skill 文件（正文由 /opsx: 改写为 /opsx-）
  │   ├── .cline/mcp.json                 → Playwright MCP (mcpServers.playwright)
  │   └── AGENTS.md                       → 员工级规范（Cline 原生自动识别）
  └── Cursor (/opsx-e2e)
      ├── .cursor/commands/opsx-e2e.md    → 斜杠命令（纯 MD，$1 = change 名）
      ├── .cursor/skills/opsx-e2e/SKILL.md → Skill（disable-model-invocation: true）
      ├── .cursor/mcp.json                → Playwright MCP (mcpServers.playwright)
      └── AGENTS.md                       → 员工级规范（Cursor 原生自动识别）

员工级规范统一存放在 **AGENTS.md** 中。Claude Code 通过 CLAUDE.md 加载——前置 CodeGraph 优先节，
后接 `@AGENTS.md` 导入；OpenCode 在 `opencode.jsonc` 的 `instructions` 中注册 AGENTS.md；
Cline 与 Cursor 原生自动识别 `AGENTS.md`，无需包装文件。

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

Healer Agent (@playwright/mcp)
  └── browser_snapshot, browser_navigate, browser_run_code 等
```

## 许可

MIT
