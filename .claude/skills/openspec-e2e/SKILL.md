---
name: openspec-e2e
description: Run Playwright E2E verification for an OpenSpec change. Use when the user wants to validate that the implementation works end-to-end by running Playwright tests generated from the specs.
license: MIT
compatibility: Requires openspec CLI, Playwright (with browsers installed), and @playwright/mcp (globally installed via `claude mcp add playwright npx @playwright/mcp@latest`).
metadata:
  author: openspec-playwright
  version: "2.13"
---

## Input

- **Change name**: `/opsx:e2e <name>` or `/opsx:e2e all` (full app exploration, no OpenSpec needed)
- **Specs**: `openspec/changes/<name>/specs/*.md` (if change mode)
- **Credentials**: `E2E_USERNAME` + `E2E_PASSWORD` env vars

## Output

- **Test file**: `tests/playwright/<name>.spec.ts`
- **Page Objects** (all mode): `tests/playwright/pages/<Route>Page.ts`
- **Auth setup**: `tests/playwright/auth.setup.ts` (if auth required)
- **Report**: `openspec/reports/playwright-e2e-<name>-<timestamp>.md`
- **Test plan**: `openspec/changes/<name>/specs/playwright/test-plan.md` (change mode only)

## Architecture

Two modes, same pipeline:

| Mode   | Command            | Route source             | Output                         |
| ------ | ------------------ | ------------------------ | ------------------------------- |
| Change | `/opsx:e2e <name>` | OpenSpec specs           | `<name>.spec.ts`                |
| All    | `/opsx:e2e all`    | sitemap + homepage crawl | `pages/*.ts` (Page Objects)     |

Both modes update `app-knowledge.md` and `app-exploration.md`. All `.spec.ts` files run together as regression suite.

> **Role mapping**: Planner (Step 4–5) → test-plan.md; Generator (Step 6) → `.spec.ts` + Page Objects; Healer (Step 9) → repairs failures via MCP.

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

- Announce: "Mode: full app exploration + Page Object discovery"
- **Goal**: Discover new routes, extract selectors, and build `pages/*.ts` Page Objects — accumulated asset for future Change tests
- **Route discovery** (in order):
  1. **sitemap.xml**: `browser_navigate(${BASE_URL}/sitemap.xml)` → parse URLs
  2. **Link extraction**: Navigate to `${BASE_URL}/` → `browser_evaluate` extracts all `<a href>`:
     ```javascript
     // Extract all internal links from current page
     () => {
       const origin = window.location.origin;
       const links = Array.from(document.querySelectorAll('a[href]'));
       return links
         .map(a => a.href)
         .filter(h => h.startsWith(origin) && !h.includes('/logout') && !h.includes('/api/'))
         .map(h => new URL(h).pathname);
     }
     ```
  3. **Fallback common paths**: `/`, `/login`, `/dashboard`, `/admin`, `/profile`, `/settings`

**Decision table — route discovery fallback:**

| Situation | Action |
| — | — |
| `sitemap.xml` returns 200 with URLs | Parse all URLs → extract pathname |
| `sitemap.xml` returns 404/5xx | Skip → use link extraction |
| Link extraction finds 0 links | Fall back to common paths |
| Common path returns 200 | Add to routes |
| Duplicate routes from multiple sources | Deduplicate by pathname |

- **Persist routes**: Write discovered routes to `app-knowledge.md` → **Routes** table. Replace the entire table (including header) with fresh data — do not append.
- Group routes: Guest vs Protected (by attempting direct access)

### 2. Detect auth

**Change mode**: Read specs and extract functional requirements. Detect auth from keywords.

**"all" mode**: Detect auth by attempting to access known protected paths (e.g. `/dashboard`, `/profile`). If redirected to `/login` → auth required.

**Auth detection — both modes** (BOTH conditions required):

**Condition A — Explicit markers**: "login", "signin", "logout", "authenticate", "protected", "authenticated", "session", "unauthorized", "jwt", "token", "refresh", "middleware"

**Condition B — Context indicators**: Protected routes ("/dashboard", "/profile", "/admin"), role mentions ("admin", "user"), redirect flows

**Exclude false positives**: HTTP header examples (`Authorization: Bearer ...`) and code snippets do not count.

**Confidence — decision table:**

| Confidence | Condition | Action |
| — | — | — |
| High | Multiple markers AND context indicators | Auto-proceed |
| Medium | Single marker, context unclear | Proceed + note in output |
| Low | No markers found | Skip auth, test as guest |

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
| Suspicious network request     | API returned 4xx/5xx             | Continue — mark `⚠️ API error: <endpoint> returned <code>` in app-exploration.md               |

**Network monitoring**: After navigating, use `browser_network_requests` to check for failed API calls. Failed requests (status ≥ 400) on a route indicate an API/backend issue — record in `app-exploration.md` for reference.

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
| CAPTCHA | `.g-recaptcha`, `.h-captcha`, `[data-sitekey]`, canvas+slider | recaptcha score via API (if configured) | High |
| OTP / SMS | 6-digit input, countdown timer | Check if dev bypass exists | High |
| Shadow DOM | `role="generic"` with no children | Check `shadowRoot` via evaluate | Medium |
| Rich text editor | `[contenteditable]`, `role="textbox"` | `innerHTML`, `getContent()` | Medium |
| Video / Audio | `role="application"` or name contains "video"/"audio" | `evaluate` checks both `<video>` and `<audio>` tags | Medium |
| File upload | `<input type="file">` | `accept` attribute, `multiple` flag | Medium |
| Drag-and-drop | drag events in JS | Simulate DnD via coordinate clicks | Low |
| Date picker | specific `data-testid` or class patterns | Click triggers → evaluate value | Low (skip unless specs mention) |
| Infinite scroll | Dynamic row insertion | Count elements before/after scroll | Low |
| WebSocket / SSE | No DOM signal | Check `browser_console_messages` for WS events | Low |

**For each detected special element, capture:**

```javascript
// Canvas — get metadata (check WebGL first to avoid consuming 2D context)
const canvasData = await browser_evaluate(() => {
  const c = document.querySelector('canvas');
  if (!c) return null;
  // getContext consumes the context — check WebGL2 first, then WebGL1, then 2D
  let context = 'unknown';
  if (c.getContext('webgl2')) context = 'webgl2';
  else if (c.getContext('webgl')) context = 'webgl';
  else if (c.getContext('2d')) context = '2d';
  return {
    id: c.id || '',
    context,
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

// Video / Audio — get state via evaluate (snapshot doesn't expose tagName)
const mediaState = await browser_evaluate(() => {
  const v = document.querySelector('video');
  if (v) return { type: 'video', paused: v.paused, duration: v.duration };
  const a = document.querySelector('audio');
  if (a) return { type: 'audio', paused: a.paused, duration: a.duration };
  return null;
});

// contenteditable — detect via evaluate
const isContentEditable = await browser_evaluate(() => {
  const el = document.querySelector('[contenteditable]');
  return !!el;
});

// CAPTCHA — detect type
const captchaInfo = await browser_evaluate(() => {
  const recaptcha = document.querySelector('.g-recaptcha, [data-sitekey]');
  if (recaptcha) return { type: 'recaptcha', sitekey: recaptcha.getAttribute('data-sitekey') };
  const hcaptcha = document.querySelector('.h-captcha');
  if (hcaptcha) return { type: 'hcaptcha', sitekey: hcaptcha.getAttribute('data-sitekey') };
  const turnstile = document.querySelector('[data-sitekey*="cloudflare"]');
  if (turnstile) return { type: 'turnstile' };
  const canvas = document.querySelector('canvas[class*="captcha"]');
  if (canvas) return { type: 'canvas-captcha' };
  const slider = document.querySelector('[class*="slider"], [class*="drag"]');
  if (slider) return { type: 'slider-captcha' };
  return null;
});

// OTP input — detect
const otpInfo = await browser_evaluate(() => {
  const inputs = document.querySelectorAll('input');
  const otpInputs = Array.from(inputs).filter(i => i.maxLength === 1 && i.type === 'text' || i.type === 'tel');
  if (otpInputs.length >= 4) return { type: 'otp-sms', digits: otpInputs.length };
  return null;
});
```

Record findings in `app-exploration.md` → **Special Elements Detected** table.

#### 4.4. Write app-exploration.md

Output: `openspec/changes/<name>/specs/playwright/app-exploration.md`

Template: read from `.claude/skills/openspec-e2e/templates/app-exploration.md` (project-local skill directory)

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
| Dynamic content (user-specific)                   | Record structure — use `toContainText` or regex, not `toHaveText` |

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

> **"all" mode: skip this step.** No OpenSpec specs → no test-plan to generate. All mode skips test-plan verification — Page Objects are discovered incrementally from exploration, not from structured specs.

**All mode — brief confirmation before Step 6:**
```
## All Mode: Page Object Discovery
Discovered <N> routes (<M> guest, <K> protected)
Special elements: <element summary>
Ready to generate Page Objects for: <page-name>Page.ts, <page-name>Page.ts, ...
Reply **yes** to proceed, or tell me to exclude routes or adjust strategies.
```

**Change mode — prerequisite**: If `openspec/changes/<name>/specs/playwright/app-exploration.md` does not exist → **STOP**. Run Step 4 (explore application) before generating tests. Without real DOM data from exploration, selectors are guesses and tests will be fragile.

**Change mode**: Create `openspec/changes/<name>/specs/playwright/test-plan.md`.

**Read inputs**: specs, app-exploration.md, app-knowledge.md

**Create test cases**: functional requirement → test case, with `@role` and `@auth` tags. Reference verified selectors from app-exploration.md.

Template: `.claude/skills/openspec-e2e/templates/test-plan.md`

**Idempotency**: If test-plan.md exists → read and use, do NOT regenerate.

**⚠️ Human verification — STOP before generating code.**

After creating (or reading existing) test-plan.md, **stop and display the test plan summary** for user confirmation:

**Output format** — show the test plan in markdown directly in the conversation:

````markdown
## Test Plan Summary: `<change-name>`

**Auth**: required / not required | Roles: ...

### Test Cases
- ✅ `<test-name>` — `<route>`, happy path
- ✅ `<test-name>` — `<route>`, error path: `<error condition>`

### Special Elements
- ⚠️ **CAPTCHA** at `<route>` — strategy: `auth.setup bypass / skip / api-only`
- ⚠️ **Canvas/WebGL** at `<route>` — strategy: screenshot + dimensions
- ⚠️ **OTP** at `<route>` — strategy: test credentials / dev bypass
- ⚠️ **Iframe** at `<route>` — strategy: frameLocator + assert inner content
- ⚠️ **Video/Audio** at `<route>` — strategy: play() + assert !paused
- ⚠️ **File Upload** at `<route>` — strategy: setInputFiles + assert upload
- ⚠️ **Drag-and-Drop** at `<route>` — strategy: dragAndDrop or evaluate events
- ⚠️ **WebSocket/SSE** at `<route>` — strategy: waitForResponse + waitForFunction

### Not Covered
- `<element or scenario not testable>`
````

Then ask: "Does this coverage match your intent? Reply **yes** to proceed, or tell me what to add/change."

**Why this matters**: Step 5 is the last human-reviewable checkpoint before code generation. Once test code is written, fixes address *how* tests run, not *what* they verify. Reviewing the test plan takes seconds and catches logic errors that Healer cannot fix.

**Confirmation criteria**:
- All scenarios from OpenSpec specs are covered
- Special elements (Canvas, Iframe, Video, Audio, CAPTCHA, OTP, File Upload, Drag-drop, WebSocket) have correct automation strategy
- Auth states and roles are accurate
- Nothing important is missing

If the user requests changes → update test-plan.md → re-display summary → re-confirm → proceed.

### 6. Generate (Generator role)

**"all" mode**: Build and expand Page Objects for future Change tests.

**Prerequisite**: If `app-exploration.md` does not exist → **STOP**. Run Step 4 first. All mode explores routes via browser MCP to build exploration data.

**Page Object pattern** — read before writing any page file:

Read: `.claude/skills/openspec-e2e/templates/e2e-test.ts` → LoginPage example

```typescript
// ✅ 正确：getters + async actions + this.click/fill
export class LoginPage extends BasePage {
  get usernameInput() { return this.byLabel('用户名'); }
  get submitBtn() { return this.byRole('button', { name: '登录' }); }
  constructor(page: Page) { super(page); }
  async login(user: string, pass: string) {
    await this.goto('/login');
    await this.fillAndVerify(this.usernameInput, user);
    await this.click(this.submitBtn);
  }
}

// ❌ 错误：测试文件里写 inline locators
test('login', async ({ page }) => {
  await page.getByLabel('用户名').fill('user'); // ← never do this!
});
```

**Decision table — Page Object file handling**:

| Situation | Action |
| — | — |
| `pages/<Route>Page.ts` does not exist | Create from LoginPage pattern |
| File exists with some getters | Extend — add missing, preserve existing |
| File exists but uses inline locators | Rewrite with Page Object pattern, keep selector strings |
| Route removed from app | Remove corresponding Page Object file |

**File naming**: `pages/<Route>Page.ts` — use kebab-case route → PascalCase. `/login` → `LoginPage.ts`, `/user-profile` → `UserProfilePage.ts`.

For each discovered route:

1. Read existing `pages/<Route>Page.ts` (if any — incremental, not overwrite)
2. Navigate to route with correct auth state
3. browser_snapshot to extract interactive elements (see 4.3 table)
4. Write or update `pages/<Route>Page.ts` — extend with newly discovered elements
5. Also write `tests/playwright/app-all.spec.ts` — smoke test (route loads without crash)

**Output priority**: Page Objects (`pages/*.ts`) are the primary asset. Smoke test is secondary. Existing Page Objects are never overwritten — only extended.

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

// Audio — playback state
test('audio can be played', async ({ page }) => {
  await page.goto(`${BASE_URL}/<route>`);
  const audio = page.locator('audio');
  await expect(audio).toBeVisible();
  await audio.evaluate((a: HTMLAudioElement) => { a.play(); });
  const isPlaying = await audio.evaluate((a: HTMLAudioElement) => !a.paused);
  expect(isPlaying).toBe(true);
});
```

See `.claude/skills/openspec-e2e/templates/test-plan.md` → **Special Element Test Cases** for full templates including Canvas, Video, Audio, Iframe, and Rich Text Editor.

**Test coverage — AI-opaque elements**: For CAPTCHA, OTP, slider CAPTCHA, file upload, and drag-drop — elements that Playwright cannot reliably automate:

1. Mark the element in `app-exploration.md` → **Special Elements Detected** table with type and automation strategy
2. Generate the test using the appropriate strategy from `.claude/skills/openspec-e2e/templates/test-plan.md` → **AI-Opaque Elements** section:
   - **CAPTCHA**: Bypass via `auth.setup.ts` storageState, or skip with `test.skip()`, or verify via API
   - **OTP**: Use pre-verified test credentials (`E2E_OTP_CODE` env var), or development bypass flag
   - **File upload**: Use `page.setInputFiles()` with fixture files
   - **Drag-drop**: Use `page.dragAndDrop()` or `page.evaluate()` with custom event dispatching
3. If the element is truly non-automatable, write `test.skip()` with a comment explaining why, and mark with `/handoff` for manual testing

**Test coverage — performance**: Verify Core Web Vitals metrics. If the app specifies performance targets, generate a test:

```typescript
// Performance — Core Web Vitals
test('page loads within performance budget', async ({ page }) => {
  await page.goto(`${BASE_URL}/<route>`);
  await expect(page.getByRole('heading')).toBeVisible();
  const timings = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    return {
      ttfb: nav.responseStart - nav.requestStart,
      lcp: nav.loadEventEnd - nav.requestStart,
    };
  });
  expect(timings.ttfb).toBeLessThan(500);
  expect(timings.lcp).toBeLessThan(2500);
});
```

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

#### 6.1. Use BasePage for shared navigation and selectors

Read `tests/playwright/pages/BasePage.ts` for shared utilities:
- `goto(path)` — navigation with configurable `waitUntil`
- `byTestId(id)`, `byRole(role, opts)`, `byLabel(label)`, `byText(text)`, `byPlaceholder(text)` — selector helpers in priority order
- `click(locator)`, `fill(locator, value)`, `fillAndVerify(locator, value)` — safe interactions; use `fillAndVerify` when the next action depends on the value being committed
- `waitForToast(text?)`, `waitForLoad(spinnerSelector?)` — wait utilities
- `reload()` — page reload with hydration

**AppPage pattern** — extend BasePage for page-specific selectors:

```typescript
// tests/playwright/pages/LoginPage.ts
import { BasePage } from './BasePage';
import type { Page } from '@playwright/test';

export class LoginPage extends BasePage {
  get usernameInput() { return this.byLabel('用户名'); }
  get passwordInput() { return this.byLabel('密码'); }
  get submitBtn() { return this.byRole('button', { name: '登录' }); }

  constructor(page: Page) { super(page); }

  async login(user: string, pass: string) {
    await this.goto('/login');
    await this.fillAndVerify(this.usernameInput, user);
    await this.fillAndVerify(this.passwordInput, pass);
    await this.click(this.submitBtn);
  }
}
```

```typescript
// tests/playwright/<name>.spec.ts
import { LoginPage } from '../pages/LoginPage';

test('user can login', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.login('user@example.com', 'password123');
  await loginPage.expectURL(/dashboard/);
});
```

**If a shared page object doesn't exist yet**: define it inline in the spec AND write it to `tests/playwright/pages/<PageName>.ts` so future tests can reuse it.

#### 6.2. Selector anti-patterns

```typescript
// 🚫 Fragile — CSS class selectors break on style refactors
page.locator('.notification-bell')
page.locator('.header-bar')
page.locator('.skeleton-overlay')

// ✅ Robust — semantic selectors survive style changes
page.getByRole('button', { name: '通知' })
page.getByTestId('header-bar')
page.getByText('加载中')

// 🚫 Fragile — CSS ID selectors can duplicate in React HMR
page.locator('#avatarBtn')
page.locator('#userAvatarBtn')

// ✅ Robust — prefer role/label/testid over CSS ID
page.getByTestId('user-avatar')
page.getByRole('button', { name: '用户菜单' })

// 🚫 Missing wait — leads to random CI failures
await page.locator('.submit-btn').click();

// ✅ Safe — scroll into view first
await page.locator('.submit-btn').scrollIntoViewIfNeeded();
await page.locator('.submit-btn').click();

// ✅ Better — use BasePage click with built-in wait
const app = new AppPage(page);
await app.click(app.byRole('button', { name: '提交' }));
```

**Code examples — UI first:**

```typescript
// ✅ UI 测试 — fill 后必须验证值，确保框架同步完成
const app = new AppPage(page);
await app.goto(`${BASE_URL}/orders`);
await app.click(app.byRole('button', { name: '新建订单' }));
await app.fillAndVerify(app.byLabel('订单名称'), 'Test Order');
await app.click(app.byRole('button', { name: '提交' }));
await expect(page.getByText('订单创建成功')).toBeVisible();

// ✅ Error path
await page.goto(`${BASE_URL}/orders`);
await page.getByRole("button", { name: "提交" }).click();
await expect(page.getByRole("alert")).toContainText("名称不能为空");

// ✅ API fallback (only when UI cannot reach the scenario)
const res = await page.request.get(`${BASE_URL}/api/orders/99999`);
expect(res.status()).toBe(404);

// ✅ Auth guard — fresh browser context (no cookies)
test("redirects to login when unauthenticated", async ({ browser }) => {
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

// ✅ Browser history — SPA back/forward
await page.goto(`${BASE_URL}/list`);
await page.getByRole("link", { name: "详情" }).first().click();
await expect(page).toHaveURL(/detail/);
await page.goBack();
await expect(page).toHaveURL(/list/);

// ✅ File uploads
await page.locator('input[type="file"]').setInputFiles("/path/to/file.pdf");
```

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

**Output**: `playwright.config.ts` (project root; or `tests/playwright/playwright.config.ts` if config already exists there)

If missing → generate from `.claude/skills/openspec-e2e/templates/playwright.config.ts`.

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

| Tool                       | Purpose                                         |
| -------------------------- | ----------------------------------------------- |
| `browser_navigate`         | Go to the failing test's page                   |
| `browser_snapshot`         | Get page structure to find equivalent selectors |
| `browser_console_messages` | Diagnose JS errors that may cause failures      |
| `browser_network_requests` | Diagnose backend/API failures (4xx/5xx)          |
| `browser_take_screenshot`  | Visually compare before/after fixes             |
| `browser_run_code`         | Execute custom fix logic (optional)             |

**Healer — Phase 1: Triage**

When a test fails, classify before attempting repair:

| Failure Type | Signal | Classification | Action |
| — | — | — | — |
| **Network/Backend** | `net::ERR`, 4xx/5xx in console/network | **App Bug** | `test.skip()` + report as app bug |
| **JS Runtime Error** | Console error (non-network) | **App Bug** | `test.skip()` + report as app bug |
| **Auth Expired** | Redirected to login mid-test | **Flaky** | Re-run auth.setup → re-run |
| **Selector Not Found** | Element not found | **Test Bug** | → Phase 2 Healer |
| **Assertion Mismatch** | Wrong content/value | **Ambiguous** | → Phase 2 Healer |
| **Timeout** | waitFor/evaluate timeout | **Flaky** | Retry isolated (1×, not counted in heal attempts) |
| **Same test fails in suite, passes isolated** | — | **RAFT** | `test.skip()` in suite, note RAFT in report |

- **App Bug** → skip immediately (no healing needed)
- **Flaky** → retry once isolated
- **Test Bug / Ambiguous** → Phase 2

> **Type ≠ Blame**: "Test Bug" means the assertion or selector is wrong — it does NOT mean "blame the test author." The test was generated from the spec. Root cause may be spec ambiguity, spec→test generation error, or app→spec deviation. Only a human can determine blame.

**Healer — Phase 2: Repair**

After Triage classifies failure as "Test Bug" or "Ambiguous":

1. Navigate to the failing page
2. Get page snapshot: `browser_snapshot`
3. **EXPLICIT COMPARISON** — output before fixing:
   ```
   ASSERTION: "<what the test expects>"
   ACTUAL:   "<what the snapshot shows>"
   MATCH:    <yes/no>
   ```
4. If MATCH=no:
   - Is `ACTUAL` reasonable per the test's intended spec behavior?
     - If yes → fix the assertion to match ACTUAL (app behavior is correct)
     - If uncertain → **Phase 3**
5. If selector issue → find equivalent stable selector from snapshot
6. Apply fix → re-run **only that test** (attempt 1/3)
7. If healed → append to `app-knowledge.md` → **Selector Fixes** table (route, old → new selector, reason)

**Healer — Phase 3: Escalate**

When Phase 2 tried ≥3 heals without success, OR ASSERTION vs ACTUAL comparison is ambiguous:

**STOP** and output:

```
E2E Test Failed — Human Decision Required

Test: <test-name>
Failure: <type>
Assertion: "<what test expects>"
Actual:   "<what app shows>"

This failure could be:
1. App does not match the spec → **app bug**
2. Test was generated from ambiguous/incorrect spec → **spec issue**
3. Spec itself is outdated (app was updated) → **spec drift**

Please decide:
(a) Fix the app to match the spec
(b) Update the spec to match the app
(c) Update the test assertion
(d) Skip this test with test.skip() until resolved
```

Wait for user input before proceeding.

After the issue is resolved, re-run:
```
/opsx:e2e <change-name>
```
The existing `app-exploration.md` and `test-plan.md` will be reused (idempotent — Steps 4–6 will be fast).

### 10. False Pass Detection + RAFT Detection

Run after test suite completes (even if all pass).

**False Pass patterns** (test passed but shouldn't have):

- **Conditional visibility**: `if (locator.isVisible().catch(() => false))` — if test passes, locator may not exist
- **Too fast**: < 200ms for a complex flow is suspicious
- **No fresh auth context**: Protected routes without `browser.newContext()`

**RAFT detection** (Resource-Affected Flaky Test):

- Full suite: test fails → run test isolated → passes
- This is **NOT** a test bug or app bug. Mark as RAFT, add `test.skip()` in suite, note in report
- RAFTs are infrastructure coupling issues (CPU/memory/I/O contention), not fixable by changing test or app

### 11. Report results

Read report at `openspec/reports/playwright-e2e-<name>-<timestamp>.md`. Present:

- Summary table with failure type breakdown (App Bugs, Test Bugs/healed, Flaky-RAFT, Human Escalations)
- Failure Classification table (test, type, action, healed?)
- Auto-heal log (assertion vs actual comparison, fix applied, result)
- RAFT Summary (if any detected)
- Human Escalations (if any, with user decision)
- Recommendations with `file:line` references

Report template: `.claude/skills/openspec-e2e/templates/report.md`

**Update tasks.md** if all tests pass: find E2E-related items, append `✅ Verified via Playwright E2E (<timestamp>)`.

## Report Structure

Reference: `.claude/skills/openspec-e2e/templates/report.md`

## Graceful Degradation

**When these critical failures occur → STOP immediately:**

| Scenario | Behavior |
| ------- | ------- |
| No specs / app-exploration.md missing (change mode) | **STOP** |
| JS errors or HTTP 5xx during exploration | **STOP** |
| Sitemap fails ("all" mode) | Continue with homepage links fallback |
| File already exists (app-exploration, test-plan, app-all.spec.ts, Page Objects) | Read and use — never regenerate |
| Test fails (network/backend) | **App Bug** — `test.skip()` + report |
| Test fails (selector/assertion) | **Test Bug/Ambiguous** — Healer Phase 1→2 (≤3 attempts) |
| RAFT detected (suite fail, isolated pass) | **Flaky** — `test.skip()` in suite, note RAFT in report |
| Phase 3 escalation | **Human needed** — STOP + ask user |
| False pass detected | Add "⚠️ Coverage Gap" to report |

## Guardrails

**Decision table:**

| Rule | Why |
| — | — |
| Read specs as source of truth | Generated tests must match requirements |
| Step 4 before Step 6 | Real DOM data → accurate selectors |
| Never contradict specs | E2E validates implementation, not design |
| Cap heal at 3 attempts | Prevents infinite loops |
| Write runnable code, not TODOs | Placeholders fail CI |

**Files you can write to:**
`specs/playwright/`, `tests/playwright/`, `openspec/reports/`, `playwright.config.ts`, `auth.setup.ts`

**Never write to:** any other directory
