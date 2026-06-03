# Claude Code Employee-Grade Standards

> 员工级行为规范。

---

## 0. 适用范围

本规范适用于 OpenSpec + openspec-playwright 项目（Claude Code 作为开发工具）。

**项目规范**：动手前读 `openspec/config.yaml`（技术栈、结构、约定、约束等），无内容则忽略。

**E2E 工作流前提**：工具链（gstack / OpenSpec CLI / openspec-playwright）由用户安装并维护，AI 不做安装操作。

## 1. 代码质量（强制执行）

**动手前先思考**：列出假设，逐条验证。复杂任务如有多种解释则都列出来，如有更简单的方案则提出来，必要时坚持己见。有不清楚的地方则停下来，说出困惑，再提问。

**每步有可验证的退出条件**：多步骤任务先列计划（`1. [Step] → verify: [check]`），动手后循环验证直到成功。lint + typecheck 自动执行，任一失败则停止。lint 失败时优先运行 `npm run lint:fix`。

**只写被要求的东西**：不要加"灵活"、"可配置"、单次使用的抽象、没被要求的功能。200行能50行完成则重写。

**精准改动**：只改必要的，改完清理自己造成的垃圾。匹配现有风格，不改进无关代码。

**lint + typecheck 通过（项目标准工具链）才算成功**。动手前扫描项目根目录源码文件扩展名检测主语言——`.py`→Python（ruff + mypy）、`.ts`/`.tsx`→TypeScript（ESLint + tsc）、`.go`→Go（gofmt + vet），工具不存在时告知用户。

**禁止非通用性改动**：
- 不写只适配特定输入值的逻辑
- 禁止假设外部数据有效 → 必须校验类型/范围/null
- 处理数据时考虑边界情况（空值、异常值、边界值）
- 断言用通用规则，不用具体值（除非明确要求）
- 禁止魔法数字 → 用常量或枚举，注释说明原因（例如：`const MAX_RETRIES = 3; // 网络请求最大重试次数`）
- 禁止隐式成功假设 → 异步/外部操作必须处理失败情况
- 禁止响应结构假设 → 先校验返回结构再访问深层属性
- 禁止精度/范围假设 → 计算前确认数值在安全范围内
- 禁止资源泄漏假设 → 文件/连接/cursor 等使用后必须释放

## 2. 上下文管理

**文件读取完整**：超过 500 行的文件，不要假设单次读取覆盖完整内容——根据需要分次读取或编辑前重新读取完整文件。超过 10 条消息后，编辑任何文件前强制重新读取。

**上下文压缩恢复后（Apply 阶段）**：
1. `git status` — 确认已改动的内容
2. 重读 `changes/<name>/proposal.md` + `design.md` + `tasks.md` — 确认范围、设计决策、任务状态
3. 对照 design.md 检查关键实现（路径、命名、目录结构）
4. 运行对应语言的 lint + typecheck 验证
5. 然后继续实施

**OpenSpec 阶段隔离**：每个阶段由用户手动触发，禁止跨阶段跳步（explore 阶段不能调 apply，verify 阶段不能调 e2e）。

**禁止跨 change 改动**：执行 `/opsx:apply <X>` 期间，不得修改 `changes/<Y>/`（X≠Y）下任何文件。看到其它 open change 的"顺手清理"诱惑一律拒绝。

**重构前清死代码**：未使用的 import/export/prop/console.log 先删掉，单独提交，再做重构。

## 3. 大规模任务处理

**200 行以上修改或显著架构变更必须走 OpenSpec**：代码改动超过 200 行、或涉及新增服务/API 契约/数据模型重构时，禁止直接修改，必须通过 OpenSpec 工作流（/opsx:propose）。

## 4. 工具限制与编辑安全

**搜索要全**：用 Grep 搜内容，用 Glob 搜文件名。两者缺一不可。搜项目/工作区时默认包含所有源码类型，跳过 node_modules/、vendor/、__pycache__ 等依赖目录（调试依赖时除外）；搜子目录时按需缩小。重命名时覆盖调用、类型、字符串、`import`、barrel file、测试 mock，不得假设一次覆盖所有情况。

**编辑要求**：编辑后重新读取文件确认变更正确应用。变更完成后，明确告知用户可能遗漏的区域（动态引用、测试 mock 等），提示人工复查。

**禁止脚本改文件**：修改源码文件只能使用内置编辑工具（Read/Edit/Write），禁止用 sed/awk/node -e/python -c 等管道命令改文件。格式化工具（ruff fmt、prettier）除外。

**不主动推送**：除非用户明确要求，否则不推送代码。

**中文回复**：用中文回复用户。

**安全规范**：密钥与 `.env` 文件不入版本控制。示例代码用占位符（如 `YOUR_API_KEY`）不用真实凭据。调试日志不打印凭据/密钥/token。

## 5. 完整生产工作流

按需叠加的评审：`/plan-ceo-review`（产品战略）/ `/plan-eng-review`（架构）/ `/plan-design-review`（UX）。

阶段命令即触发器：`/opsx:propose` → `/opsx:apply` → `/opsx:verify` → `/opsx:e2e` → `/opsx:archive`。**所有阶段由用户手动触发，AI 不自动进入下一阶段**（详见 §2 阶段隔离）。

可用 `npx openspec --help` 查看更多 OpenSpec 命令。

方向不明时可用 `/office-hours` 做创意验证。**Healer 需要 Playwright 环境**；非 Node.js 项目请参考各自语言的 OpenSpec 测试集成。
