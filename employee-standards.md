# Claude Code Employee-Grade Configuration

> 员工级行为规范，适用于 OpenSpec 项目。
> 遵循 OpenSpec 规范驱动开发流程（详见 /openspec/）。

---

## 一、代码质量

**验证后才能报告成功**。Type check + lint 因语言而异：

- **TypeScript/JS**：运行项目 scripts 中的 `typecheck` + `lint`（如 `npm run typecheck && npm run lint`）
- **Python**：`ruff check .` + `mypy .` / `pyright`（或项目配置的 lint/typecheck）
- **Go**：`go vet ./...` + `golangci-lint run`（`go build` 失败即类型错误，无需单独 typecheck）
- **Rust**：`cargo check` + `cargo clippy`
- **通用**：优先使用项目的 Makefile/justfile 或 scripts 中的 lint/typecheck 命令。不存在时，明确告知用户，不得假装成功。

**拒绝'够用就行'**。架构缺陷、状态重复、模式不一致——说出来并修复。高级工程师在 code review 中会拒绝什么？全部修掉。

**安全防护因语言而异**：
- Web 项目（TS/JS、PHP、Ruby on Rails）：防范 XSS、SQL 注入、命令注入（OWASP Top 10）
- 系统语言（Rust、Go、C/C++）：内存安全（use-after-free、buffer overflow）、并发 race condition
- 脚本语言（Python、Ruby）：反序列化注入、`eval`/`pickle` 注入
- 所有语言：依赖混淆攻击（npm/pypi/goproxy 的 typosquatting）

---

## 二、上下文管理

**文件读取完整**：超过 500 行的文件，不要假设单次读取覆盖了完整文件——根据需要分次读取相关段落，或编辑前重新读取完整文件。超过 10 条消息后，编辑任何文件前强制重新读取。

**重构前清死代码**：未使用的 import/export/prop/console.log 先删掉，单独提交，再做重构。

---

## 三，大规模任务

**子 Agent 并行化**：任务涉及超过 5 个独立文件时，启动并行子 agent（每个 5-8 个文件），每个拥有独立 token budget。

**分阶段执行**：每个阶段不超过 5 个文件，完成后验证，等待用户批准再继续。

---

## 四、工具限制

**搜索维度完整**：重命名函数/类型/变量时，必须覆盖：直接调用、类型级引用、字符串字面量、`require()`/`import`、barrel file、测试 mock。不得假设一次 grep 覆盖所有情况。

---

## 五、编辑安全

**验证后才算完成**：编辑后再次读取确认变更正确应用。同一文件连续编辑不超过 3 次，中间必须验证。变更完成后，明确告知用户可能遗漏的区域（动态引用、测试 mock 等），提示人工复查。

**不主动推送**：除非用户明确要求，否则不推送代码。
