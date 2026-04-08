# OpenSpec + Playwright E2E 验证

[English version](./README.md)

将 OpenSpec 的规格驱动开发工作流与 Playwright 三 Agent 测试管道集成，实现自动化 E2E 验证。

## 安装

```bash
npm install -g openspec-playwright
```

## 初始化

```bash
# 在项目目录下
openspec init              # 初始化 OpenSpec
openspec-pw init          # 安装 Playwright E2E 集成
```

## 支持的 AI 编码助手

Claude Code — E2E 工作流由 SKILL.md 驱动，使用 Playwright MCP 工具（`/opsx:e2e <change-name>`）。

## 使用

### 在 Claude Code 中

```bash
/opsx:e2e <change-name>
```

### CLI 命令

```bash
openspec-pw init          # 初始化集成（一次性设置）
openspec-pw update        # 更新 CLI 和命令到最新版本
openspec-pw doctor        # 检查前置条件
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
  ├── 4. 探索应用 → Playwright MCP 探索真实 DOM
  │       ├─ 读取 app-knowledge.md（项目级知识）
  │       ├─ 从 specs 提取路由
  │       ├─ 遍历每个路由 → snapshot → screenshot
  │       └─ 写入 app-exploration.md（change 级发现）
  │           └─ 提取模式 → 更新 app-knowledge.md
  │
  ├── 5. Planner → 生成 test-plan.md
  │
  ├── 6. Generator → 创建 tests/playwright/<name>.spec.ts
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

### 两层验证

| 层级 | 命令 | 验证内容 |
|------|------|---------|
| 静态验证 | `/opsx:verify` | 实现是否符合 artifacts |
| E2E 验证 | `/opsx:e2e` | 应用运行是否正常 |

## 前置条件

1. **Node.js >= 20**
2. **OpenSpec** 已初始化: `npm install -g @fission-ai/openspec && openspec init`
3. **任一 5 编辑器**: Claude Code、Cursor、Cline、Gemini CLI、GitHub Copilot（自动检测）
4. **仅 Claude Code**: Playwright MCP — `claude mcp add playwright npx @playwright/mcp@latest`

## `openspec-pw init` 做了什么

1. 检测已安装的 AI 编码助手（支持全部 5 个编辑器）
2. 为每个检测到的编辑器安装 E2E 命令/工作流文件
3. 为 Claude Code 安装 `/openspec-e2e` skill
4. 为 Claude Code 全局安装 Playwright MCP（通过 `claude mcp add`）
5. 生成 `tests/playwright/seed.spec.ts`、`auth.setup.ts`、`credentials.yaml`、`app-knowledge.md`

> **注意**：运行 `openspec-pw init` 后，手动安装 Playwright 浏览器：`npx playwright install --with-deps`

## 认证

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

### MCP 服务器（仅 Claude Code）

Playwright MCP 通过 `claude mcp add` 全局安装，启用 Healer Agent（通过 UI 检查自动修复测试失败）。设置后需重启 Claude Code 生效。

## 架构

```
模板（内置于 npm 包，安装到 .claude/skills/openspec-e2e/templates/）
  └── test-plan.md, report.md, playwright.config.ts, e2e-test.ts, app-exploration.md

CLI (openspec-pw)
  ├── init       → 安装命令、skill 和模板到 .claude/
  ├── update     → 从 npm 同步命令、skill 和模板
  ├── run        → 执行 E2E 测试并管理服务器生命周期
  ├── verify     → 检查实现是否符合 artifacts
  └── doctor     → 检查前置条件

Skill/命令（按编辑器）
  ├── Claude Code → /opsx:e2e (skill) + /opsx:e2e (command) + MCP
  ├── Cursor      → /opsx-e2e (command)
  ├── Cline      → /opsx-e2e (workflow)
  ├── Gemini CLI → /opsx-e2e (command)
  └── GitHub Copilot → /opsx-e2e (command)

测试资产 (tests/playwright/)
  ├── seed.spec.ts       → 环境验证
  ├── auth.setup.ts      → 会话录制
  ├── credentials.yaml   → 测试用户
  └── app-knowledge.md   → 项目级选择器模式（跨 change 复用）

探索结果 (openspec/changes/<name>/specs/playwright/)
  ├── app-exploration.md → 本次 change 的路由 + 已验证选择器
  └── test-plan.md       → 本次 change 的测试用例

Healer Agent（仅 Claude Code + MCP）
  └── browser_snapshot, browser_navigate, browser_run_code 等
```

## 许可

MIT
