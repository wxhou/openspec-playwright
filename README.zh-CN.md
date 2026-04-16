# OpenSpec + Playwright E2E 验证

[English version](./README.md)

将 OpenSpec 的规格驱动开发工作流与 Playwright 三 Agent 测试管道集成，实现自动化 E2E 验证。

## 安装

```bash
npm install -g openspec-playwright
```

## 前置条件

1. **Node.js >= 20**
2. **Claude Code** 且项目中有 `.claude/` 目录
3. **gstack**（用于探索 + 浏览器 QA）：`git clone --single-branch --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack && cd ~/.claude/skills/gstack && ./setup`
4. **OpenSpec** 已初始化: `npm install -g @fission-ai/openspec && openspec init`
5. **Playwright MCP**（用于测试执行 + Healer）：`claude mcp add playwright npx @playwright/mcp@latest`

## 初始化

```bash
# 在项目目录下
openspec init              # 初始化 OpenSpec
openspec-pw init          # 安装 Playwright E2E 集成
```

> **注意**：运行 `openspec-pw init` 后，手动安装 Playwright 浏览器：`npx playwright install --with-deps`

## 支持的 AI 编码助手

Claude Code — E2E 工作流由 SKILL.md 驱动，使用 /browse（探索）+ Playwright MCP（测试执行）。

## 使用

### 在 Claude Code 中

```bash
/opsx:e2e <change-name>
```

### CLI 命令

```bash
openspec-pw init          # 初始化集成（一次性设置）
openspec-pw update        # 更新 CLI 和命令到最新版本
openspec-pw doctor        # 检查前置条件（含 Vision Check）
openspec-pw audit         # 检查测试文件是否有孤儿文件和配置问题
openspec-pw migrate       # 迁移旧测试文件到新目录结构
openspec-pw explore       # 并行探索路由
openspec-pw vision-check  # 使用 Ollama VLM 检测布局问题
openspec-pw uninstall     # 移除项目中的集成
```

## 工作原理

```
/opsx:e2e <change-name>
  │
  ├── 1. 选择 change → 读取 openspec/changes/<name>/specs/
  │
  ├── 2. 检测 auth → 从 specs 识别登录/认证标记
  │
  ├── 3. 验证环境 → 运行 seed.spec.ts
  │
  ├── 4. 探索应用 → /browse 探索真实 DOM
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
  ├── 9. 执行测试 → openspec-pw run <name>
  │
  ├── 10. Healer（如需要）→ 通过 MCP 自动修复失败
  │
  └── 11. 报告 → openspec/reports/playwright-e2e-<name>.md
```

## `openspec-pw init` 做了什么

1. 检测项目中的 Claude Code
2. 安装 E2E 命令（`/opsx:e2e`）和 SKILL.md
3. 从最新 `@playwright/mcp` 同步 Healer 工具
4. 生成 `tests/playwright/seed.spec.ts`、`auth.setup.ts`、`credentials.yaml`、`app-knowledge.md`

## 首次配置清单

首次使用 E2E 工作流，按顺序执行以下步骤：

| 步骤 | 命令 | 失败时快速修复 |
|------|------|----------------|
| 1. 安装 CLI | `npm install -g openspec-playwright` | 检查 Node.js 版本 `node -v`（需 >= 20） |
| 2. 安装 gstack | `git clone --single-branch --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack && cd ~/.claude/skills/gstack && ./setup` | 需要 Bun：`curl -fsSL https://bun.sh/install \| bash` |
| 3. 安装 OpenSpec | `npm install -g @fission-ai/openspec && openspec init` | `npm cache clean -f && npm install -g @fission-ai/openspec` |
| 4. 初始化 E2E | `openspec-pw init` | 运行 `openspec-pw doctor` 查看具体缺失项 |
| 5. 安装 Playwright MCP | `claude mcp add playwright npx @playwright/mcp@latest` | `claude mcp list` 确认安装成功 |
| 6. 安装浏览器 | `npx playwright install --with-deps` | macOS 可能需先运行 `xcode-select --install` |
| 7. 启动开发服务器 | `npm run dev`（在另一个终端） | 确认端口，配置 `BASE_URL` |
| 8. 验证环境 | `npx playwright test tests/playwright/seed.spec.ts` | 检查 `playwright.config.ts` 中的 `webServer` 配置 |
| 9. 配置认证（如需要） | 见下方"认证配置" | `npx playwright test --project=setup` 调试 |
| 10. 运行第一个 E2E | `/opsx:e2e <change-name>` | 查看 `openspec/reports/` 中的报告 |

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

支持 **API 登录**（推荐）和 **UI 登录**（备选）。多用户测试（管理员 vs 普通用户）在 `credentials.yaml` 中添加多个用户，`/opsx:e2e` 会从 specs 自动检测角色。

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
模板（内置于 npm 包，安装到 .claude/skills/openspec-e2e/templates/）
  └── test-plan.md, report.md, playwright.config.ts, e2e-test.ts, app-exploration.md

CLI (openspec-pw)
  ├── init       → 安装命令、skill 和模板到 .claude/
  ├── update     → 从 npm 同步命令、skill 和模板
  ├── run        → 执行 E2E 测试并管理服务器生命周期
  ├── migrate    → 迁移旧测试文件到新目录结构
  ├── audit      → 检查测试文件是否有孤儿文件和配置问题
  ├── doctor     → 检查前置条件
  └── uninstall  → 移除项目中的集成

Claude Code (/opsx:e2e)
  ├── .claude/commands/opsx/e2e.md    → 命令文件
  ├── .claude/skills/openspec-e2e/   → SKILL.md + 模板
  └── @playwright/mcp                 → Healer Agent 工具

测试资产 (tests/playwright/)
  ├── seed.spec.ts       → 环境验证
  ├── auth.setup.ts      → 会话录制
  ├── credentials.yaml   → 测试用户
  └── app-knowledge.md   → 项目级选择器模式（跨 change 复用）

探索结果 (openspec/changes/<name>/specs/playwright/)
  ├── app-exploration.md → 本次 change 的路由 + 已验证选择器
  └── test-plan.md       → 本次 change 的测试用例

Healer Agent (@playwright/mcp)
  └── browser_snapshot, browser_navigate, browser_run_code 等
```

## 许可

MIT
