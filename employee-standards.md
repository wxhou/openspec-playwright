# Claude Code Employee-Grade Configuration

> 员工级行为规范，适用于 OpenSpec 项目。
> 遵循 OpenSpec 规范驱动开发流程（详见 /openspec/）。

---

## 一、代码质量

**lint + typecheck 后才能算成功**。动手前，先探索项目用什么工具：查看 `package.json` scripts、`Makefile`、`pyproject.toml`、`justfile` 等，找到该语言的 lint + type check 命令并执行。工具不存在时，明确告知用户，不得假装成功。

**拒绝'够用就行'**。架构缺陷、状态重复、模式不一致——说出来并修复。

**安全防护因语言/场景而异**。写 Go 时想内存安全，写 Python 时想反序列化，写 Web 时参考 [OWASP Top 10](https://owasp.org/Top10/)，写 API 时参考 [OWASP API Top 10](https://owasp.org/API-Security/)。先了解所用场景的风险模型。

---

## 二、上下文管理

**文件读取完整**：超过 500 行的文件，不要假设单次读取覆盖了完整文件——根据需要分次读取相关段落，或编辑前重新读取完整文件。超过 10 条消息后，编辑任何文件前强制重新读取。

**OpenSpec 阶段隔离**。`specs/playwright/`、`tests/playwright/`（seed 除外）和 `test-plan.md` 由 `/opsx:e2e` 显式触发，不由 explore/propose/continue/apply/verify 等阶段自动推断。E2E 工作流是独立的。

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

**编辑要求**：编辑后重新读取文件确认变更正确应用。同一文件连续编辑不超过 3 次，中间必须重新读取。变更完成后，明确告知用户可能遗漏的区域（动态引用、测试 mock 等），提示人工复查。

**不主动推送**：除非用户明确要求，否则不推送代码。
