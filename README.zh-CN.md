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

自动检测并安装 OpenSpec 支持的全部 24 个编辑器的命令文件：

| 编辑器 | 路径 | 编辑器 | 路径 |
|--------|------|--------|------|
| Claude Code | `.claude/` | Gemini CLI | `.gemini/` |
| Cursor | `.cursor/` | GitHub Copilot | `.github/` |
| Windsurf | `.windsurf/` | Kiro | `.kiro/` |
| Cline | `.clinerules/` | Kilo Code | `.kilocode/` |
| Continue | `.continue/` | iFlow | `.iflow/` |
| Amazon Q | `.amazonq/` | CoStrict | `.cospec/` |
| Antigravity | `.agent/` | OpenCode | `.opencode/` |
| Auggie | `.augment/` | Factory | `.factory/` |
| CodeBuddy | `.codebuddy/` | Pi | `.pi/` |
| Codex | `~/.codex/` (全局) | Qoder | `.qoder/` |
| Qwen Code | `.qwen/` | RooCode | `.roo/` |
| Crush | `.crush/` | | |

`openspec-pw init` 会检测项目中安装了哪些编辑器并安装对应文件。Claude Code 获得完整体验（skill + 命令 + Playwright MCP）。其他编辑器获得包含完整 E2E 工作流的命令/工作流文件。

## 使用

### 在 AI 编码助手中

```bash
/opsx:e2e my-feature    # Claude Code
/opsx-e2e my-feature   # Cursor, Windsurf, Cline, Continue
```

### CLI 命令

```bash
openspec-pw init          # 初始化集成（一次性设置）
openspec-pw update        # 更新 CLI 和命令到最新版本
openspec-pw doctor        # 检查前置条件
```

## 工作原理

```
/opsx:e2e <change-name>
  │
  ├── 1. 从 openspec/changes/<name>/specs/ 读取 OpenSpec specs
  │
  ├── 2. Planner Agent → 生成 test-plan.md
  │
  ├── 3. Generator Agent → 创建 tests/playwright/<name>.spec.ts
  │
  └── 4. Healer Agent → 运行测试 + 自动修复失败（Claude Code + MCP）
          │
          └── 报告: openspec/reports/playwright-e2e-<name>.md
```

### 两层验证

| 层级 | 命令 | 验证内容 |
|------|------|---------|
| 静态验证 | `/opsx:verify` | 实现是否符合 artifacts |
| E2E 验证 | `/opsx:e2e` | 应用运行是否正常 |

## 前置条件

1. **Node.js >= 20**
2. **OpenSpec** 已初始化: `npm install -g @fission-ai/openspec && openspec init`
3. **任一**: Claude Code、Cursor、Windsurf、Cline 或 Continue（自动检测）
4. **仅 Claude Code**: Playwright MCP — `claude mcp add playwright npx @playwright/mcp@latest`

## `openspec-pw init` 做了什么

1. 检测已安装的 AI 编码助手（Claude Code、Cursor、Windsurf、Cline、Continue）
2. 为每个检测到的编辑器安装 E2E 命令/工作流文件
3. 为 Claude Code 安装 `/openspec-e2e` skill
4. 为 Claude Code 全局安装 Playwright MCP（通过 `claude mcp add`）
5. 生成 `tests/playwright/seed.spec.ts`、`auth.setup.ts`、`credentials.yaml`

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

## 许可

MIT
