---
name: openspec-e2e
description: Run Playwright E2E verification for an OpenSpec change. Use when the user wants to validate that the implementation works end-to-end by running Playwright tests generated from the specs.
license: MIT
compatibility: Requires openspec CLI, Playwright (with browsers installed), and @playwright/mcp (globally installed via `claude mcp add playwright npx @playwright/mcp@latest`).
metadata:
  author: openspec-playwright
  version: "2.11"
---

## Input

- **Change name**: `/opsx:e2e <name>` or `/opsx:e2e all` (full app exploration, no OpenSpec needed)
- **Specs**: `openspec/changes/<name>/specs/*.md` (if change mode)
- **Credentials**: `E2E_USERNAME` + `E2E_PASSWORD` env vars

## Output

- **Test file**: `tests/playwright/<name>.spec.ts` (e.g. `app-all.spec.ts` for "all")
- **Auth setup**: `tests/playwright/auth.setup.ts` (if auth required)
- **Report**: `openspec/reports/playwright-e2e-<name>-<timestamp>.md`
- **Test plan**: `openspec/changes/<name>/specs/playwright/test-plan.md` (change mode only)

## Architecture

Two modes, same pipeline:

| Mode   | Command            | Route source             | Output            |
| ------ | ------------------ | ------------------------ | ----------------- |
| Change | `/opsx:e2e <name>` | OpenSpec specs           | `<name>.spec.ts`  |
| All    | `/opsx:e2e all`    | sitemap + homepage crawl | `app-all.spec.ts` |

Both modes update `app-knowledge.md` and `app-exploration.md`. All `.spec.ts` files run together as regression suite.

**Role mapping** (Playwright Test Agents terminology):

| Role      | This SKILL | What it does                                                 |
| --------- | ---------- | ------------------------------------------------------------ |
| Planner   | Step 4–5   | Explores app via Playwright MCP → produces test-plan.md      |
| Generator | Step 6     | Transforms test-plan.md → `.spec.ts` with verified selectors |
| Healer    | Step 9     | Executes tests, repairs failures via Playwright MCP          |

## Testing principles

**UI first** — Test every user flow through the browser UI. E2E validates that users can accomplish tasks in the real interface, not just that the backend responds correctly.

```
用户操作 → 浏览器 UI → 后端 → 数据库 → UI 反馈
```

**API only as fallback** — Use `page.request` only when UI genuinely cannot cover the scenario:

- Triggering HTTP 5xx/4xx error responses (hard to reach via UI)
- Edge cases requiring pre-condition data that UI cannot set up
- Cases where Step 4 exploration confirmed no UI element exists

**Decision rule**:

```
Can this be tested through the UI?
  → Yes → page.getByRole/ByLabel/ByText + click/fill/type + assert UI
  → No  → record reason → use page.request
```

**Never use API calls to replace routine UI flows.** If a test completes in < 200ms, it is almost certainly using `page.request` instead of real UI interactions.

## Steps

### 1. Select the change or mode

**Change mode** (`/opsx:e2e <name>`):

- Use provided name, or infer from context, or auto-select if only one exists
- If ambiguous → `openspec list --json` + AskUserQuestion
- Verify specs exist: `openspec status --change "<name>" --json`
- If specs empty → **STOP: E2E requires specs.** Use "all" mode instead.

**"all" mode** (`/opsx:e2e all` — no OpenSpec needed):

- Announce: "Mode: full app exploration"
- Discover routes via:
  1. Navigate to `${BASE_URL}/sitemap.xml` (if exists)
  2. Navigate to `${BASE_URL}/` → extract all links from snapshot
  3. Fallback common paths: `/`, `/login`, `/dashboard`, `/admin`, `/profile`, `/api/`
- Group routes: Guest vs Protected (by attempting direct access)

### 2. Detect auth

**Change mode**: Read specs and extract functional requirements. Detect auth from keywords.

**"all" mode**: Detect auth by attempting to access known protected paths (e.g. `/dashboard`, `/profile`). If redirected to `/login` → auth required.

**Auth detection — both modes** (BOTH conditions required):

**Condition A — Explicit markers**: "login", "signin", "logout", "authenticate", "protected", "authenticated", "session", "unauthorized", "jwt", "token", "refresh", "middleware"

**Condition B — Context indicators**: Protected routes ("/dashboard", "/profile", "/admin"), role mentions ("admin", "user"), redirect flows

**Exclude false positives**: HTTP header examples (`Authorization: Bearer ...`) and code snippets do not count.

**Confidence**:

- High (auto-proceed): Multiple markers AND context indicators
- Medium (proceed with note): Single marker, context unclear
- Low (skip auth): No markers found

### 3. Validate environment

Run the seed test before generating tests:

```bash
npx playwright test tests/playwright/seed.spec.ts --project=chromium
```

Seed test initializes the `page` context — it runs all fixtures, hooks, and globalSetup. Not just a smoke check: it also validates that auth setup, BASE_URL, and Playwright are fully functional.

**If seed test fails**: Stop and report. Fix the environment before proceeding.

### 4. Explore application

Explore to collect real DOM data before writing test plan. This eliminates blind selector guessing.

**Prerequisites**: seed test pass. If auth is required, ensure `auth.setup.ts` has been run (Step 7). BASE_URL must be verified reachable (see 4.1).

#### 4.1. Verify BASE_URL + Read app-knowledge.md

1. **Verify BASE_URL**: `browser_navigate(BASE_URL)` → if HTTP 5xx → **STOP: backend error. Fix app first.**
2. **Read app-knowledge.md**: known risks, project conventions
3. **Routes** (from Step 1): use already-discovered routes — no need to re-extract

#### 4.2. Explore each route via Playwright MCP

For each route:

```
browser_navigate → browser_console_messages → browser_snapshot → browser_take_screenshot
```

**After navigating, check for app-level errors**:

| Signal                        | Meaning                           | Action                                                                                        |
| ----------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------- |
| HTTP 5xx or unreachable       | Backend/server error              | **STOP** — tell user: "App has a backend error (HTTP <code>). Fix it, then re-run /opsx:e2e." |
| JS error in console           | App runtime error                 | **STOP** — tell user: "Page has JS errors. Fix them, then re-run /opsx:e2e."                  |
| HTTP 404                      | Route not in app (metadata issue) | Continue — mark `⚠️ route not found` in app-exploration.md                                    |
| Auth required, no credentials | Missing auth setup                | Continue — skip protected routes, explore login page                                          |

**For guest routes** (no auth):

```javascript
// Navigate directly
await browser_navigate(`${BASE_URL}/<route>`);
```

**For protected routes** (auth required):

```javascript
// Option A: use existing storageState (recommended)
// Option B: navigate to /login first, fill form, then navigate to target
// Option C: use browser_run_code to set auth cookies directly
```

**If credentials are not yet available**:

1. Skip protected routes — mark `⚠️ auth needed — explore after auth.setup.ts`
2. Explore the login page itself (guest route) — extract form selectors
3. After auth.setup.ts runs, re-run exploration for protected routes

Wait for page stability:

- Prefer `browser_wait_for` with text or selector
- Avoid `networkidle` / `load` — too slow or unreliable
- Ready signal: heading, spinner disappears, or URL change

#### 4.3. Parse the snapshot

From `browser_snapshot` output, extract **interactive elements** for each route:

| Element type         | What to capture                      | Selector priority                                          |
| -------------------- | ------------------------------------ | ---------------------------------------------------------- |
| **Buttons**          | text, selector                       | `[data-testid]` > `getByRole` > `getByLabel` > `getByText` |
| **Form fields**      | name, type, label, selector          | `[data-testid]` > `name` > `label`                         |
| **Navigation links** | text, href, selector                 | `text` > `href`                                            |
| **Headings**         | text content, selector               | for assertions                                             |
| **Error messages**   | text patterns, selector              | for error path testing                                     |
| **Dynamic content**  | structure — row counts, card layouts | for data-driven tests                                      |
| **Special elements** | type, selector, dimensions           | for canvas/iframe/Shadow DOM test strategies               |

#### 4.3.1. Detect special elements

From `browser_snapshot` + `browser_evaluate`, identify these special elements per route:

**Special element detection matrix:**

| Element | Snapshot signal | Evaluate supplement                            | Exploration priority |
| ------- | --------------- | ---------------------------------------------- | ------------------- |
| `<canvas>` | `role="img"`, `tagName="CANVAS"` | `canvas.getContext('2d'/'webgl')`, `width`, `height` | High |
| `<iframe>` | `role="iframe"`, `src` attribute | `frameLocator` available | High |
| Shadow DOM | `role="generic"` with no children | Check `shadowRoot` via evaluate | Medium |
| Rich text editor | `[contenteditable]`, `role="textbox"` | `innerHTML`, `getContent()` | Medium |
| Video / Audio | `tagName="VIDEO"/"AUDIO"` | `paused`, `currentTime`, `volume` | Medium |
| Date picker | specific `data-testid` or class patterns | Click triggers → evaluate value | Low (skip unless specs mention) |
| Drag-and-drop | drag events in JS | Simulate DnD via coordinate clicks | Low |
| Infinite scroll | Dynamic row insertion | Count elements before/after scroll | Low |
| WebSocket / SSE | No DOM signal | Check `browser_console_messages` for WS events | Low |

**For each detected special element, capture:**

```javascript
// Canvas — get metadata
const canvasData = await browser_evaluate(() => {
  const c = document.querySelector('canvas');
  if (!c) return null;
  return {
    id: c.id || c.className,
    context: (c.getContext('2d') ? '2d' : c.getContext('webgl') ? 'webgl' : c.getContext('webgl2') ? 'webgl2' : 'unknown'),
    width: c.width,
    height: c.height,
  };
});

// Iframe — record frameLocator
// Note: iframe has src or name attribute

// Rich text editor — get content
const editorContent = await browser_evaluate(() => {
  const el = document.querySelector('[contenteditable]');
  return el ? { tag: el.tagName, content: el.innerHTML, length: el.textContent.length } : null;
});

// Video — get state
const videoState = await browser_evaluate(() => {
  const v = document.querySelector('video');
  return v ? { paused: v.paused, duration: v.duration, src: v.src } : null;
});
```

Record findings in `app-exploration.md` → **Special Elements Detected** table.

#### 4.4. Write app-exploration.md

Output: `openspec/changes/<name>/specs/playwright/app-exploration.md`

Use template: `templates/app-exploration.md`

Key fields per route:

- **URL**: `${BASE_URL}<path>`
- **Auth**: none / required (storageState: `<path>`)
- **Ready signal**: how to know the page is loaded
- **Elements**: interactive elements with verified selectors (see 4.3 table)
- **Screenshot**: `__screenshots__/<slug>.png`

After exploration, add route-level notes (redirects, dynamic content → see 4.5).

#### 4.5. Exploration behavior notes

| Situation                                         | Action                                                           |
| ------------------------------------------------- | ---------------------------------------------------------------- |
| SPA routing (URL changes but page doesn't reload) | Explore via navigation clicks from known routes, not direct URLs |
| Page loads but no interactive elements            | Wait longer for SPA hydration                                    |
| Dynamic content (user-specific)                   | Record structure — use `toContainText`, not `toHaveText`         |

**Idempotency**: If `app-exploration.md` already exists → read it, verify routes still match specs, update only new routes or changed pages.

#### 4.6. Update app-knowledge.md

After writing `app-exploration.md`, extract **project-level shared knowledge** and append to `tests/playwright/app-knowledge.md`:

| Section                  | What to extract                                                           |
| ------------------------ | ------------------------------------------------------------------------- |
| Architecture             | Monolith or separated? Backend port? Restart command?                     |
| Credential Format        | Login endpoint, username format (email vs username)                       |
| Common Selector Patterns | New patterns discovered that apply across routes                          |
| SPA Routing              | SPA framework, routing behavior                                           |
| Project Conventions      | BASE_URL, auth method, multi-user roles                                   |
| Selector Fixes           | Healed selectors (see Step 9) — route, old selector, new selector, reason |

Append only new/changed items — preserve existing content.

#### 4.7. After exploration

Pass `app-exploration.md` to:

- **Step 5 (Planner)**: reference real routes, auth states, and elements in test-plan.md
- **Step 6 (Generator)**: use verified selectors instead of inferring

Read `tests/playwright/app-knowledge.md` as context for cross-change patterns.

### 5. Generate test plan

> **"all" mode: skip this step — go directly to Step 6.**

**Change mode — prerequisite**: If `openspec/changes/<name>/specs/playwright/app-exploration.md` does not exist → **STOP**. Run Step 4 (explore application) before generating tests. Without real DOM data from exploration, selectors are guesses and tests will be fragile.

**Change mode**: Create `openspec/changes/<name>/specs/playwright/test-plan.md`.

**Read inputs**: specs, app-exploration.md, app-knowledge.md

**Create test cases**: functional requirement → test case, with `@role` and `@auth` tags. Reference verified selectors from app-exploration.md.

Template: `templates/test-plan.md`

**Idempotency**: If test-plan.md exists → read and use, do NOT regenerate.

### 6. Generate test file

**"all" mode** → `tests/playwright/app-all.spec.ts` (smoke regression):

- For each discovered route: navigate → assert HTTP 200 → assert ready signal visible
- No detailed assertions — just "this page loads without crashing"
- This is a regression baseline — catches when existing pages break

**Change mode** → `tests/playwright/<name>.spec.ts` (functional):

- Read: test-plan.md, app-exploration.md, app-knowledge.md, seed.spec.ts
- For each test case: verify selectors in real browser, then write Playwright code

**Selector verification (change mode)**:

1. Navigate to route with correct auth state
2. browser_snapshot to confirm page loaded
3. For each selector: verify from current snapshot (see 4.3 table for priority)
4. Write test code with verified selectors
5. If selector unverifiable → note for Healer (Step 9)

**Test coverage — empty states**: For list/detail pages, explore the empty state. If the app shows a "no data" UI when the list is empty, generate a test to verify it. Empty states are often missing from specs but are real user paths.

**Test coverage — special elements**: Check `app-exploration.md` → **Special Elements Detected** table. For each special element:

```typescript
// Canvas — screenshot + dimensions
test('canvas renders with correct dimensions', async ({ page }) => {
  await page.goto(`${BASE_URL}/<route>`);
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  expect(box.width).toBeGreaterThan(0);
  await canvas.screenshot({ path: '__screenshots__/canvas.png' });
});

// Canvas — 2D pixel verification
test('canvas 2D content is not blank', async ({ page }) => {
  await page.goto(`${BASE_URL}/<route>`);
  const hasContent = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    if (!c) return false;
    const ctx = c.getContext('2d');
    if (!ctx) return false;
    const data = ctx.getImageData(0, 0, c.width, c.height).data;
    return data.some((v, i) => i % 4 !== 3 && v !== 0); // non-transparent non-black pixel
  });
  expect(hasContent).toBe(true);
});

// Canvas — WebGL screenshot
test('canvas WebGL renders', async ({ page }) => {
  await page.goto(`${BASE_URL}/<route>`);
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
  await canvas.screenshot({ path: '__screenshots__/webgl.png' });
  // No pixel comparison — WebGL rendering may vary
});

// Iframe — switch context
test('iframe content is accessible', async ({ page }) => {
  await page.goto(`${BASE_URL}/<route>`);
  const frame = page.frameLocator('iframe[name="<name>"]');
  await expect(frame.locator('<selector-inside-frame>')).toBeVisible();
});

// Rich text editor — evaluate content
test('editor content persists', async ({ page }) => {
  await page.goto(`${BASE_URL}/<route>`);
  const editor = page.locator('[contenteditable]');
  await editor.click();
  await page.keyboard.type('Hello E2E');
  const content = await page.evaluate(() => {
    const el = document.querySelector('[contenteditable]');
    return el?.textContent;
  });
  expect(content).toContain('Hello E2E');
});

// Video — playback state
test('video can be played', async ({ page }) => {
  await page.goto(`${BASE_URL}/<route>`);
  const video = page.locator('video');
  await expect(video).toBeVisible();
  await video.evaluate((v: HTMLVideoElement) => { v.play(); });
  const isPlaying = await video.evaluate((v: HTMLVideoElement) => !v.paused);
  expect(isPlaying).toBe(true);
});
```

See `templates/test-plan.md` → **Special Element Test Cases** for full templates.

```typescript
// 🚫 Avoid for special elements:
await canvas.screenshot() // screenshot alone — no dimension/size assertion
await expect(canvas).toHaveScreenshot() // pixel-to-pixel comparison for WebGL

// ✅ Always:
const box = await canvas.boundingBox();
expect(box.width).toBeGreaterThan(0);
```

**Output format**:

- Follow `seed.spec.ts` structure
- Use `test.describe(...)` for grouping
- Each test: `test('描述性名称', async ({ page }) => { ... })`
- Prefer `data-testid` selectors (see 4.3 table)

**Code examples — UI first:**

```typescript
// ✅ UI 测试 — 用户在界面上的真实操作
await page.goto(`${BASE_URL}/orders`);
await page.getByRole("button", { name: "新建订单" }).click();
await page.getByLabel("订单名称").fill("Test Order");
await page.getByRole("button", { name: "提交" }).click();
await expect(page.getByText("订单创建成功")).toBeVisible();

// ✅ Error path — 通过 UI 触发错误
await page.goto(`${BASE_URL}/orders`);
await page.getByRole("button", { name: "新建订单" }).click();
await page.getByRole("button", { name: "提交" }).click();
await expect(page.getByRole("alert")).toContainText("名称不能为空");

// ✅ API fallback — 仅在 UI 无法触发时使用
const res = await page.request.get(`${BASE_URL}/api/orders/99999`);
expect(res.status()).toBe(404);
```

```typescript
// 🚫 False Pass — 元素不存在时静默跳过
if (await btn.isVisible().catch(() => false)) { ... }

// ✅ CORRECT
await expect(page.getByRole('button', { name: '取消' })).toBeVisible();

// 🚫 用 API 替代 UI — 失去了端到端的意义
const res = await page.request.post(`${BASE_URL}/api/login`, { data: credentials });

// ✅ CORRECT — 通过 UI 登录
await page.goto(`${BASE_URL}/login`);
await page.getByLabel('邮箱').fill(process.env.E2E_USERNAME);
await page.getByLabel('密码').fill(process.env.E2E_PASSWORD);
await page.getByRole('button', { name: '登录' }).click();
await expect(page).toHaveURL(/dashboard/);
```

```typescript
// ✅ Fresh browser context for auth guard
test("unauthenticated user redirected to login", async ({ browser }) => {
  const freshPage = await browser.newContext().newPage();
  await freshPage.goto(`${BASE_URL}/dashboard`);
  await expect(freshPage).toHaveURL(/login|auth/);
});
// ✅ Session — logout clears protected state
await page.getByRole("button", { name: "退出登录" }).click();
await expect(page).toHaveURL(/login|auth/);
const freshPage2 = await browser.newContext().newPage();
await freshPage2.goto(`${BASE_URL}/dashboard`);
await expect(freshPage2).toHaveURL(/login|auth/); // session revoked

// ✅ Browser history — SPA back/forward navigation
await page.goto(`${BASE_URL}/list`);
await page.getByRole("link", { name: "详情" }).first().click();
await expect(page).toHaveURL(/detail/);
await page.goBack();
await expect(page).toHaveURL(/list/);
await page.goForward();
await expect(page).toHaveURL(/detail/);

// ✅ File uploads — UI 操作
await page.locator('input[type="file"]').setInputFiles("/path/to/file.pdf");
```

Always include error path tests: UI validation messages, network failure, invalid input. Use `page.request` only for scenarios confirmed unreachable via UI.

If the file exists → diff against test-plan, add only missing test cases.

### 7. Configure auth (if required)

- **API login**: Generate `auth.setup.ts` using `E2E_USERNAME`/`E2E_PASSWORD` + POST to login endpoint
- **UI login**: Generate `auth.setup.ts` using browser form fill. Update selectors to match your login page
- **Multi-user**: Separate `storageState` paths per role

**Credential format guidance**:

- If the app uses **email** for login → use `CHANGE_ME@example.com`
- If the app uses **username** (alphanumeric + underscore) → use `test_user_001` (more universal)
- Check existing test files or login page to determine the format
- Always set credentials via environment variables — never hardcode

**Prompt user**:

```
Auth required. To set up:
1. Customize tests/playwright/credentials.yaml
2. Export: export E2E_USERNAME=xxx E2E_PASSWORD=yyy
3. Run auth: npx playwright test --project=setup
4. Re-run /opsx:e2e to execute tests
```

**Idempotency**: If `auth.setup.ts` already exists → verify format, update only if stale.

### 8. Configure playwright.config.ts

If missing → generate from `templates/playwright.config.ts`.

**Auto-detect BASE_URL** (in priority order):

1. `process.env.BASE_URL` if already set
2. `tests/playwright/seed.spec.ts` → extract `BASE_URL` value
3. Read `vite.config.ts` (or `vite.config.js`) → extract `server.port` + infer protocol (`https` if `server.https`, else `http`)
4. Read `package.json` → `scripts.dev` or `scripts.start` → extract port from `--port` flag
5. Fallback: `http://localhost:3000`

**Auto-detect dev command**:

1. `package.json` → scripts in order: `dev` → `start` → `serve` → `preview` → `npm run dev`

If playwright.config.ts exists → READ first, preserve ALL existing fields, add only missing `webServer` block.

### 9. Execute tests

```bash
openspec-pw run <name> --project=<role>
```

The CLI handles: server lifecycle, port mismatch, report generation.

If tests fail → use Playwright MCP tools to inspect UI, fix selectors, re-run.

**Healer MCP tools** (in order of use):

<!-- MCP_VERSION: 0.0.70 -->

| Tool                       | Purpose                                         |
| -------------------------- | ----------------------------------------------- |
| `browser_navigate`         | Go to the failing test's page                   |
| `browser_snapshot`         | Get page structure to find equivalent selectors |
| `browser_console_messages` | Diagnose JS errors that may cause failures      |
| `browser_take_screenshot`  | Visually compare before/after fixes             |
| `browser_run_code`         | Execute custom fix logic (optional)             |

**Healer workflow**:

1. Read the failing test → identify failure type
2. Classify:

| Failure type                 | Signal                                  | Action                                                |
| ---------------------------- | --------------------------------------- | ----------------------------------------------------- |
| **Network/backend**          | `fetch failed`, `net::ERR`, 5xx         | `browser_console_messages` → `test.skip()`            |
| **Selector changed**         | Element not found                       | `browser_snapshot` → fix selector → re-run            |
| **Assertion mismatch**       | Wrong content/value                     | `browser_snapshot` → compare → fix assertion → re-run |
| **Timing issue**             | `waitFor`/`page.evaluate` timeout       | Switch to `request` API or add `waitFor` → re-run     |
| **page.evaluate with fetch** | `fetch` in browser context, CORS errors | Switch to `page.request` API → re-run                 |

3. **Heal** (≤3 attempts): snapshot → fix → re-run. If healed successfully → append to `app-knowledge.md` → **Selector Fixes** table: route, old selector → new selector, reason.
4. **After 3 failures**: collect evidence checklist → `test.skip()` if app bug, report recommendation if test bug

### 10. False Pass Detection

Run after test suite completes (even if all pass). Common patterns (see Step 6 Anti-Pattern Warnings for fixes):

- **Conditional visibility**: `if (locator.isVisible().catch(() => false))` — if test passes, locator may not exist
- **Too fast**: < 200ms for a complex flow is suspicious
- **No fresh auth context**: Protected routes without `browser.newContext()`

Report any gaps in a **⚠️ Coverage Gap** section.

### 11. Report results

Read report at `openspec/reports/playwright-e2e-<name>-<timestamp>.md`. Present:

- Summary table (tests, passed, failed, duration, status)
- Auto-heal notes
- Recommendations with `file:line` references

Report template: `templates/report.md`

**Update tasks.md** if all tests pass: find E2E-related items, append `✅ Verified via Playwright E2E (<timestamp>)`.

## Report Structure

Reference: `templates/report.md`

## Graceful Degradation

| Scenario                                         | Behavior                                                                              |
| ------------------------------------------------ | ------------------------------------------------------------------------------------- |
| No specs (change mode)                           | Stop — E2E requires specs. Use "all" mode instead.                                    |
| Sitemap discovery fails ("all" mode)             | Continue — use homepage links + common paths fallback                                 |
| App has JS errors or HTTP 5xx during exploration | **STOP** — see app-knowledge.md → Architecture for restart instructions               |
| app-all.spec.ts exists                           | Read and use (never regenerate — regression baseline)                                 |
| app-exploration.md missing (change mode)         | **STOP** — Step 4 exploration is mandatory. Explore before generating tests.          |
| app-exploration.md exists                        | Read and use (verify routes still match specs — re-explore if page structure changed) |
| app-knowledge.md exists                          | Read and use (append new patterns only)                                               |
| test-plan.md exists (change mode)                | Read and use (never regenerate)                                                       |
| auth.setup.ts exists                             | Verify format (update only if stale)                                                  |
| playwright.config.ts exists                      | Preserve all fields (add only missing)                                                |
| Test fails (backend)                             | `test.skip()` + report                                                                |
| Test fails (selector/assertion)                  | Healer: snapshot → fix → re-run (≤3)                                                  |
| 3 heals failed                                   | Evidence checklist → app bug: `test.skip()`; unclear: report                          |
| False pass detected                              | Add "⚠️ Coverage Gap" to report                                                       |

## Guardrails

- Read specs from `openspec/changes/<name>/specs/` as source of truth
- Do NOT generate tests that contradict the specs
- **DO generate real, runnable Playwright test code** — not placeholders or TODOs
- Do NOT overwrite files outside: `specs/playwright/`, `tests/playwright/`, `openspec/reports/`, `playwright.config.ts`, `auth.setup.ts`
- **Always explore before generating** — Step 4 is mandatory for accurate selectors
- Cap auto-heal at 3 attempts
- If no change specified → always ask user to select
