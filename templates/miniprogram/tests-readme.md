# tests/ — 小程序 E2E 契约

这个目录存放微信小程序的可执行验收测试。测试由 Playwright 驱动，wxa-runner 在 Chrome 里运行小程序编译产物。

## 目录

- `tests/playwright/seed.spec.ts` — 首页冒烟测试
- `tests/playwright/wxa-test.ts` — fixture 导入面；spec 从这里导入 `test` / `expect`
- `tests/playwright/wxa.setup.ts` — 启动前预置登录态、mock 原生 API、拦截 `wx.request`
- `tests/playwright/pages/` — Page Objects，继承 `BasePage`
- `tests/playwright/app-knowledge.md` — 项目级测试知识
- `openspec/changes/<name>/specs/playwright/test-plan.md` — 每个 Scenario 的测试计划

## 运行

```bash
npx playwright test
```

首次运行前：

```bash
npm i -D @playwright/test@^1.65 @open-wxa/wxa-runner-playwright@^0.13 @open-wxa/wxa-runner-core@^0.13
npx playwright install chrome
```

## 断言

- 页面跳转用 `toHavePath`，页面 `data` 用 `toHavePageData`，请求用 `waitForRequest`。编译框架（uni-app / Taro）会重命名 data 键，先读 `pageData()` 确认真实结构，只断言稳定键。
- 用例结束时 fixture 默认检查运行时错误；关闭 `wxaCheckErrors` 必须写明理由。
- 截图只作辅助证据，不单独判定通过。

## 限制

浏览器运行使用内置基础库 3.7.0，编译器较旧，单页有节点上限。它不替代微信开发者工具的预览、上传和真机调试；浏览器测试通过不等于真机通过。
