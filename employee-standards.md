# Claude Code Employee-Grade Configuration + gstack + openspec-playwright 生产闭环

> 员工级行为规范，适用于 OpenSpec 项目。
> 严格遵循 OpenSpec 规范驱动开发 + gstack 角色化虚拟工程团队 + Playwright 自动 E2E 验证。

---

## 0. 适用范围

本规范适用于 OpenSpec + openspec-playwright 项目（Claude Code 作为开发工具）。

E2E 工作流前提（由用户确保，非 AI 操作）：
- gstack：`git clone --single-branch --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack && cd ~/.claude/skills/gstack && ./setup`（提供 `/browse` 探索 + `/qa` 浏览器验证）
- OpenSpec CLI：`npm install -g @fission-ai/openspec && openspec init`（提供变更管理能力）
- openspec-playwright：`openspec-pw init`（提供 `/opsx:e2e` 命令）
- 项目包含 `specs/`、`changes/`、`tests/playwright/` 目录

## 1. 浏览器操作约束

所有浏览器操作用 gstack 的 `/browse` 探索 + `/qa` 验证，Playwright MCP 执行测试。

**冲突解决**：gstack 任何想直接修改代码的行为，都必须先确认当前 OpenSpec proposal 是否已存在并通过（检查 `changes/<name>/proposal.md` 是否处于 `approved` 状态）。

## 2. 代码质量（强制执行）
**lint + typecheck 后才能算成功**。动手前，先探索项目用什么工具：查看 `package.json` scripts、`Makefile`、`pyproject.toml`、`justfile` 等，找到该语言的 lint + typecheck 命令并执行。工具不存在时，明确告知用户，不得假装成功。

**拒绝"够用就行"**。架构缺陷、状态重复、模式不一致——必须说出来并修复。

**安全防护**：写 Go 时关注内存安全，写 Python 时关注反序列化，写 Web/API 时参考 OWASP Top 10 / OWASP API Top 10。先了解所用场景的风险模型。

## 3. 上下文管理
**文件读取完整**：超过 500 行的文件，不要假设单次读取覆盖完整内容——根据需要分次读取或编辑前重新读取完整文件。超过 10 条消息后，编辑任何文件前强制重新读取。

**OpenSpec 阶段隔离**：`specs/playwright/`、`tests/playwright/`（seed 除外）和 `test-plan.md` 由 `/opsx:e2e` 显式触发，不由 explore/propose/continue/apply/verify 等阶段自动推断。E2E 工作流是独立的。

**重构前清死代码**：未使用的 import/export/prop/console.log 先删掉，单独提交，再做重构。

## 4. 大规模任务处理
**子 Agent 并行化**：任务涉及超过 5 个独立文件时，启动并行子 agent（每个 5-8 个文件），每个拥有独立 token budget。

**分阶段执行**：每个阶段不超过 5 个文件，完成后验证，等待用户批准再继续。

**200 行以上修改必须走 OpenSpec**：代码改动超过 200 行时，禁止直接修改，必须通过 OpenSpec 工作流（/opsx:propose）。

## 5. 工具限制与编辑安全
**搜索要全**：重命名时，用 Grep 覆盖调用、类型、字符串、`import`、barrel file、测试 mock，不得假设一次覆盖所有情况。

**编辑要求**：编辑后重新读取文件确认变更正确应用。同一文件连续编辑不超过 3 次，中间必须重新读取。变更完成后，明确告知用户可能遗漏的区域（动态引用、测试 mock 等），提示人工复查。

**不主动推送**：除非用户明确要求，否则不推送代码。

**中文回复**：用中文回复用户。

---

## 6. 完整生产工作流

```
 1. 探索与提案
 2. 产品与架构评审（按需触发）
 3. 设计审查
 4. 实现 → /opsx:apply
 5. 自审 → /opsx:verify
 6. E2E 测试 → /opsx:e2e <change-name> → /browse 探索 + /qa 验证
 7. 验证通过后归档 → /opsx:archive
 8. 发布 → /ship 或 /land-and-deploy
 9. 迭代回顾 → /retro
```

### 步骤详解

**1. 探索与提案**：现有项目先探索（`/opsx:explore`）再写 proposal（`/opsx:propose`）；新项目（greenfield）直接生成 proposal + scenarios（记录到 `specs/` 和 `changes/`）。

**2. 产品与架构评审**（按需触发）：
- `/office-hours`：产品方向、范围、优先级不确定时
- `/plan-ceo-review`：产品战略影响、竞争格局变化时
- `/plan-eng-review`：架构影响（新增服务、API 契约变更、数据模型重构）时

**3. 设计审查**：在实现前进行设计评审，确保方案合理。评审通过后开始实现。

**4. 实现**：执行 `/opsx:apply` 进行实现 → `lint + typecheck` 通过才算成功。

**5. 自审**：`/opsx:verify` 自审实现代码，确保质量。

**6. E2E 测试**：`/opsx:e2e <change-name>` 生成 Playwright 测试 → `/browse` 探索真实 DOM → Healer 自动修复 → `/qa` 真实浏览器验证。E2E 通过后进入发布环节。

**7. 验证通过后归档**：`/opsx:archive` 永久归档，更新 `specs/`

**8. 发布**：`/ship` 或 `/land-and-deploy`

**9. 迭代回顾**：`/retro`
