# Claude Code Employee-Grade Standards

> 员工级行为规范。

---

## 0. 适用范围

本规范适用于 OpenSpec + openspec-playwright 项目（Claude Code 作为开发工具）。

**项目规范**：动手前读 `openspec/config.yaml`（技术栈、结构、约定、约束等），无内容则忽略。

E2E 工作流前提（由用户确保，非 AI 操作）：
- gstack：`git clone --single-branch --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack && cd ~/.claude/skills/gstack && ./setup`（提供 `/browse` 探索 + `/qa` 浏览器验证）
- OpenSpec CLI：`npm install -g @fission-ai/openspec && openspec init`（提供变更管理能力）
- openspec-playwright：`openspec-pw init`（提供 `/opsx:e2e` 命令）
- 项目包含 `specs/`、`changes/`、`tests/playwright/` 目录

## 1. 浏览器操作约束

所有浏览器操作用 gstack 的 `/browse` 探索 + `/qa` 验证。

**冲突解决**：gstack 任何想直接修改代码的行为，都必须先确认当前 OpenSpec proposal 是否已存在并通过（检查 `changes/<name>/proposal.md` 是否处于 `approved` 状态）。

## 2. 代码质量（强制执行）

**动手前先思考**：列出假设，逐条验证。复杂任务如有多种解释则都列出来，如有更简单的方案则提出来，必要时坚持己见。有不清楚的地方则停下来，说出困惑，再提问。

**每步有可验证的退出条件**：多步骤任务先列计划（`1. [Step] → verify: [check]`），动手后循环验证直到成功。lint + typecheck 通过是最低验证标准。

**只写被要求的东西**：不要加"灵活"、"可配置"、单次使用的抽象、没被要求的功能。200行能50行完成则重写。

**精准改动**：只改必要的，改完清理自己造成的垃圾。匹配现有风格，不改进无关代码。每一行改动都应追溯到用户的请求。

**lint + typecheck 后才能算成功**。动手前查 `package.json` scripts、`Makefile` 等找工具链。工具不存在时，明确告知用户，不得假装成功。

## 3. 上下文管理
**文件读取完整**：超过 500 行的文件，不要假设单次读取覆盖完整内容——根据需要分次读取或编辑前重新读取完整文件。超过 10 条消息后，编辑任何文件前强制重新读取。

**OpenSpec 阶段隔离**：所有阶段均由用户手动触发，不自动进入下一阶段。`/opsx:explore`、`/opsx:propose`、`/opsx:apply`、`/opsx:verify`、`/opsx:e2e` 均需用户明确调用。禁止在同一阶段内触发其他阶段（如 explore 阶段不能调用 apply，verify 阶段不能调用 e2e）。

**重构前清死代码**：未使用的 import/export/prop/console.log 先删掉，单独提交，再做重构。

## 4. 大规模任务处理
**200 行以上修改必须走 OpenSpec**：代码改动超过 200 行时，禁止直接修改，必须通过 OpenSpec 工作流（/opsx:propose）。

## 5. 工具限制与编辑安全
**搜索要全**：用 Grep 搜内容，用 Glob 搜文件名。两者缺一不可。搜项目/工作区时默认包含所有源码类型，搜子目录时按需缩小。重命名时覆盖调用、类型、字符串、`import`、barrel file、测试 mock，不得假设一次覆盖所有情况。

**编辑要求**：编辑后重新读取文件确认变更正确应用。变更完成后，明确告知用户可能遗漏的区域（动态引用、测试 mock 等），提示人工复查。

**不主动推送**：除非用户明确要求，否则不推送代码。

**中文回复**：用中文回复用户。

---

## 6. 完整生产工作流

```
 1. 探索与提案
 2. 产品与架构评审（按需触发）
 3. 设计审查 → /plan-design-review
 4. 实现 → /opsx:apply
 5. 自审 → /opsx:verify
 6. E2E 测试 → /opsx:e2e <change-name> → /browse 探索 + /qa 验证
 7. 发布 → 用户手动 /ship 或 /land-and-deploy
 8. 迭代回顾 → /retro
```

### 步骤详解

**1. 探索与提案**：现有项目先探索（`/opsx:explore`）再写 proposal（`/opsx:propose`）；新项目（greenfield）直接生成 proposal + scenarios（记录到 `specs/` 和 `changes/`）。方向不明确时可用 `/office-hours` 做创意验证。

**2. 产品与架构评审**（按需触发）：
- `/plan-ceo-review`：产品战略影响、竞争格局变化时
- `/plan-eng-review`：架构影响（新增服务、API 契约变更、数据模型重构）时

**3. 设计审查**：在实现前进行设计评审，确保方案合理。评审通过后开始实现。
- `/plan-design-review`：UI/UX 方案审查，评分各设计维度，确保用户体验达标

**4. 实现**：执行 `/opsx:apply` 进行实现 → `lint + typecheck` 通过才算成功。

**5. 自审**：`/opsx:verify` 自审实现代码，确保质量。

**6. E2E 测试**：`/opsx:e2e <change-name>` 生成 Playwright 测试 → `/browse` 探索真实 DOM → Healer 自动修复 → `/qa` 真实浏览器验证。E2E 通过后，由用户决定发布时机。

**7. 发布**：由用户手动触发 `/ship`、`/land-and-deploy` 或 `/canary`。内部项目可能直接部署，无需走 PR 机制。

**8. 迭代回顾**：`/retro`
