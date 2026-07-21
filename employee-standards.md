# AI Coding Assistant Employee-Grade Standards

---

## 0. 适用范围

**约定**：动手前先读 `openspec/config.yaml`（技术栈、结构、约定、约束等），无内容则忽略。

**语言**：用中文回复用户。

**优先级决策规则**：🔴 CRITICAL（违反→静默 bug / 安全漏洞，必须修正）→ **停下确认后再执行**｜🟡 IMPORTANT（偏离需说明理由）→ **谨慎执行，偏离说明原因**｜⚪ STANDARD（标准实践，可调整）→ 按标准执行

---

## 1. 代码质量

> WHY：AI 默认倾向多写、快写、猜写。本节约束将这些倾向转化为可验证的生产代码。

**DO**
- 🔴 **lint + typecheck 每次编辑后自动执行，通过才算成功**。扫源码扩展名判断主语言：.ts/.tsx→ESLint+tsc、.py→ruff+mypy、.go→gofmt+vet。工具不存在时告知用户，不假装跑过
- 🟡 不隐藏任何 gate 失败结果——lint / typecheck / test 任一失败时，完整输出错误日志并停止，不继续后续步骤
- ⚪ 未执行的检查步骤明确标注「未运行」，不暗示已通过
- 🟡 需求理解不清或存在可见风险时，先停下来提问，不直接执行。偏离标准实践需说明理由
- 🟡 动手前列假设 → 逐条验证。有不清→停下来，说出困惑，再提问
- 🟡 多解释则全列，更简单方案则提出并坚持
- 🟡 多步任务先列计划（`1. [Step] → verify: [check]`），循环验证直到成功
- 🟡 lint 失败时优先运行 `npm run lint:fix`
- 🟡 只写被要求的：不加"灵活"、"可配置"、单次使用抽象、未要求功能。200行能50行则重写
- 🟡 精准改动：只改必要的，改完清理自己造成的垃圾。匹配现有风格
- 🟡 代码文件行数上限 1500：超过即违例，必须按职责拆分，不得继续堆叠
- ⚪ 重构前清理未使用的 import/export/prop/console.log，单独提交再做重构

**DO NOT**
- 不写只适配特定输入值的逻辑 → 上游格式变化即失效
- 不假设外部数据有效 → 必须校验类型/范围/null，处理空/异常/边界值，防 NPE 和注入
- 不假设异步/外部操作一定成功 → 网络、磁盘、下游随时可能失败
- 不假设响应结构一定如预期 → 先校验再访问深层属性，API 升级增减字段不通知你
- 不假设精度/范围安全 → 计算前确认安全范围，数值溢出和精度损失是隐蔽 bug
- 不假设资源自动释放 → 文件/连接/cursor 用后必须释放
- 不写魔法数字 → 用常量或枚举并注释原因
- 不断言具体值（除非明确要求）→ 脆性断言，换环境即碎

**REQUIRE**
- linter/typechecker 不存在 → 告知用户并建议安装
- mock 数据 / fixture → 参见 §6 数据编撰禁令
- 涉及 API 定义 → 查阅真实 OpenAPI/MCP 定义并标注来源

---

## 2. 上下文管理

> WHY：AI 上下文窗口有限，压缩恢复时刻丢失状态。本节建立恢复协议。

**DO**
- 🟡 超过 500 行文件：分次读取或编辑前重新读取完整文件
- 🟡 上下文压缩恢复后：`git status` → 重读 proposal/design/tasks → 对照 design 检查实现 → lint + typecheck → 继续
- ⚪ 超过 10 条消息后，编辑任何文件前强制重新读取

**DO NOT**
- 禁止跨阶段跳步（explore→apply→verify→e2e 各阶段由用户触发）
- 禁止跨 change 改动：`/opsx:apply <X>` 期间不改 `changes/<Y>/`
- 禁止"顺手清理"其他 open change 文件 → 告知用户，由用户决定

---

## 3. 架构 Invariants

> **[项目特定]** 以下仅适用于 openspec-playwright 项目结构。WHY：这些约束一违反即产生 review 难发现的 bug。Anthropic 称其为最高杠杆的 agent 代码质量措施。

- 🔴 CLI 命令向 `src/index.ts` 注册，`src/commands/` 下按职责分文件
- 🔴 模板文件放 `templates/`，不与其他源码混放
- 🟡 OpenSpec change artifacts 放 `changes/<name>/`，遵循命名规范
- 🟡 E2E 测试生成代码放 `e2e/`（如 `e2e/auth.setup.ts`）
- 🔴 文档同步规则：改 `src/commands/*.ts`/`src/index.ts` 时必须同步更新 README + CHANGELOG

---

## 4. 工具使用

> WHY：工具使用方式直接影响搜索覆盖面和结果准确性。

**DO**
- 🟡 搜索要全：Grep 搜内容 + Glob 搜文件名，两者缺一不可。跳过 node_modules/vendor/__pycache__（调试依赖时除外），搜子目录时按需缩小
- 🟡 重命名覆盖：调用、类型、字符串、import、barrel file、测试 mock，不得假设一次覆盖
- 🟡 联网调研优先 agent-reach skill
- 🟡 涉及前端 UI 设计时，按序使用：frontend-design skill 定方向 → ui-ux-pro-max skill 选风格 → web-design-guidelines skill 审查，三步组合避免"千篇一律 AI 风"
- 🟡 编辑 → 重新读取确认 → lint+typecheck → 任一失败则回退
- 🟡 变更完成告知用户可能遗漏区域，提示人工复查

**DO NOT**
- 禁止用 sed/awk/node -e/python -c 等管道命令改源码文件（跳过编辑工具验证层）
- 不主动推送，除非用户明确要求
- 不假设单次 grep 覆盖所有情况（glob 可能漏嵌套文件或非标准扩展名）

**REQUIRE**
- 使用格式化工具（ruff fmt / prettier 除外——不改语义）
- 密钥与 .env 不入版本控制。示例用占位符（如 `YOUR_API_KEY`）。调试日志不打印凭据

**Agent 编排**
- 🔴 每个任务最多 spawn 3 个子 Agent
- 🔴 禁止嵌套子 Agent（子 Agent 不得再 spawn 子 Agent）
- 🟡 单文件读取/搜索不要用子 Agent，直接用 Read / Grep 工具

---

## 5. 大规模任务

> WHY：200+ 行直接修改缺乏评审，OpenSpec 工作流强制提案→设计→评审→实现。

- 🔴 200+ 行修改或架构变更（新增服务/API 契约/数据模型重构）必须走 OpenSpec（`/opsx:propose`），禁止直接修改

### 工作流参考

| 阶段 | 命令 | 退出条件 |
|------|------|---------|
| 提案 | `/opsx:propose` | proposal + scenarios 生成 |
| 实现 | `/opsx:apply` | lint + typecheck 通过 |
| 自审 | `/opsx:verify` | 实现匹配 design，无遗漏 |
| E2E | `/opsx:e2e` / `/opsx-e2e` | 测试生成 + Healer 验证通过 |
| 归档 | `/opsx:archive` | specs 更新，归档完成 |

所有阶段由用户手动触发，**AI 不自动进入下一阶段**。Superpowers（可选）：`/plugin install superpowers@claude-plugins-official`，提供对话式 spec 探索、TDD、subagent 并行实现，不改变主流程。

---

## 6. 数据编撰禁令

> WHY：AI 有"填空"倾向——缺乏数据时编造看似合理的值，引入静默 bug。

**DO NOT**
- 严禁主动编撰任何数据填充代码，除非用户明确同意
- 编撰示例：mock 用户/邮箱/手机号、编造测试期望值、凭空出现配置默认值、假装存在的接口/字段/枚举值
- 不编造 URL/路径 → 引用真实来源，勿凭印象编造 endpoint/path/字段名
- 遇需数据的代码位必须显式询问用户
- 用户拒绝时，用 stub / `throw` / `return null` 显式失败，禁止静默编造

**REQUIRE**
- 用户同意占位 → `TODO(user)` 标注并附问询上下文
- 用户提供数据 → 使用真实数据
- 无论前后端一体还是纯前端，存在 OpenAPI/接口文档 → 查阅真实定义并标注来源（如 `// 来源: docs/api/openapi.yaml#/paths/...`）

---

## 7. 临时文件管理

> WHY：临时文件散落在项目根目录而非集中存放，会在 commit 时被意外加入版本控制（导致仓库膨胀），或积累到难以清理（占用磁盘空间）。本节建立可自动化管理协议，避免这两类问题。

**DO**
- 🟡 非源码临时文件（截图、日志、heapdump 等）放项目根 `tmp/` 下
- 🟡 文件名含时间戳（如 `screenshot-20260721T143000.png`）以避免冲突和重复
- ⚪ 平铺存放，不分子目录，简化清理脚本

**DO NOT**
- 🔴 禁止将临时文件提交到版本控制（确保 `.gitignore` 包含 `tmp/`）

**REQUIRE**
- 🟡 超 24 小时的文件应在 commit 前删除
- ⚪ 文件命名遵循 `kebab-case` 风格，避免空格和特殊字符
