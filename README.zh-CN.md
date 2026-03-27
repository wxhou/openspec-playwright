# OpenSpec + Playwright E2E 验证

[English version](./README.md)

将 OpenSpec 的规格驱动开发工作流与 Playwright 三 Agent 测试管道集成，实现自动化 E2E 验证。

## 安装

```bash
npm install -g wxhou/openspec-playwright
```

或使用完整 URL：

```bash
npm install -g git+https://github.com/wxhou/openspec-playwright.git
```

## 初始化

```bash
# 在项目目录下
openspec init              # 初始化 OpenSpec（如尚未完成）
openspec config profile core
openspec update

openspec-pw init          # 安装 Playwright E2E 集成
```

## 使用

### 在 Claude Code 中

```bash
/opsx:e2e my-feature    # 主命令（遵循 OpenSpec 规范）
/openspec-e2e            # 来自 skill 的别名
```

### CLI 命令

```bash
openspec-pw init          # 初始化集成（一次性设置）
openspec-pw doctor        # 检查前置条件
```

## 工作原理

```
/openspec-e2e <change-name>
  │
  ├── 1. 从 openspec/changes/<name>/specs/ 读取 OpenSpec specs
  │
  ├── 2. Planner Agent → 生成 test-plan.md
  │
  ├── 3. Generator Agent → 创建 tests/playwright/<name>.spec.ts
  │
  └── 4. Healer Agent → 运行测试 + 自动修复失败
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
3. **Playwright** 已安装: `npx playwright install`
4. **Claude Code** 已配置 Playwright MCP

## `openspec-pw init` 做了什么

1. 运行 `npx playwright init-agents --loop=claude`
2. 在 `.claude/settings.local.json` 中配置 Playwright MCP
3. 安装 `/opsx:e2e` 命令和 `/openspec-e2e` skill
4. 生成 `tests/playwright/seed.spec.ts` 模板

## 自定义

### 自定义 seed 测试

编辑 `tests/playwright/seed.spec.ts` 以匹配你的应用：
- 基础 URL
- 常用选择器
- Page Object 方法

### MCP 服务器

Playwright MCP 配置在 `.claude/settings.local.json` 中。设置后需重启 Claude Code 生效。

## 许可

MIT
