---
name: openspec-e2e
description: Run Playwright E2E verification for an OpenSpec change. Use when the user wants to validate that the implementation works end-to-end by running Playwright tests generated from the specs.
license: MIT
compatibility: Requires openspec CLI, Playwright (with browsers installed), and @playwright/mcp (globally installed via `claude mcp add playwright npx @playwright/mcp@latest`).
metadata:
  author: openspec-playwright
  version: "2.19"
---

## Input

- **Change name**: `/opsx:e2e <name>` or `/opsx:e2e all` (full app exploration, no OpenSpec needed)
- **Specs**: `openspec/changes/<name>/specs/*.md` (if change mode)
- **Credentials**: `E2E_USERNAME` + `E2E_PASSWORD` env vars

## Output

- **Test file**: `tests/playwright/changes/<name>/<name>.spec.ts`
- **Page Objects** (all mode): `tests/playwright/pages/<Route>Page.ts`
- **Auth setup**: `tests/playwright/auth.setup.ts` (if auth required)
- **Report**: `openspec/reports/playwright-e2e-<name>-<timestamp>.md`
- **App Bug Registry**: `openspec/reports/app-bug-registry.md` (cumulative, per-project)
- **Test plan**: `openspec/changes/<name>/specs/playwright/test-plan.md` (change mode only)

## Architecture

Two modes, same pipeline:

| Mode   | Command            | Route source             | Output                         |
| ------ | ------------------ | ------------------------ | ------------------------------- |
| Change | `/opsx:e2e <name>` | OpenSpec specs           | `changes/<name>/<name>.spec.ts` |
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

**Setup vs Assertion**: API is acceptable for **setup/precondition** (preparing test data). Every **final assertion** about visible UI state must use UI selectors — never use `page.request` to assert something the user can see on screen.

**Decision rule (per assertion)**:

```
Can the user SEE this on screen?
  → Yes → MUST use: page.getByRole/ByLabel/ByText + expect()
  → No  → Record reason → page.request acceptable
```

**Business logic assertion rule — numerical/calculated values MUST use API assertion**:

UI assertions verify **rendering** correctness, not **calculation** correctness. A UI that correctly displays a wrong value will pass UI-only tests.

```
Is the assertion about a computed/counted/calculated value?
  (e.g., balance, total, discount, count, percentage, score, ranking)
  → Yes → Use page.request to fetch backend data → assert the raw value
  → No  → UI assertion is sufficient
```

**Examples where API assertion is required:**

```typescript
// ❌ UI-only assertion — hides calculation bugs
await page.getByText('¥800').click(); // buy item
await expect(page.getByText('总金额: ¥800')).toBeVisible(); // passes even if backend rounded wrong

// ✅ API assertion — catches calculation bugs
const order = await page.request.get(`${BASE_URL}/api/orders/${orderId}`);
const body = await order.json();
expect(body.total).toBe(800); // backend calculation is verified

// ❌ UI-only assertion — hides optimistic update failures
await page.getByRole('button', { name: '点赞' }).click();
await expect(page.getByText('1 个赞')).toBeVisible(); // passes even if POST failed silently

// ✅ API assertion — catches backend sync failures
const post = await page.request.get(`${BASE_URL}/api/posts/${postId}`);
const body = await post.json();
expect(body.likeCount).toBeGreaterThan(0); // backend state is verified

// ✅ Optimistic update with API verification
await page.getByRole('button', { name: '点赞' }).click();
await expect(page.getByText('1 个赞')).toBeVisible(); // optimistic UI
await page.waitForResponse(r => r.url().includes('/api/like')); // wait for backend
const post = await page.request.get(`${BASE_URL}/api/posts/${postId}`);
expect((await post.json()).likeCount).toBeGreaterThan(0); // verify persistence
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

**Prerequisites**: seed test pass. BASE_URL must be verified reachable (see 4.1). If auth is required and `auth.setup.ts` already exists → auth is ready. If auth is not yet configured → use the workaround below (Option B for protected routes).

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
| HTTP 5xx or unreachable       | Backend/server error              | **STOP** — tell user: "App has a backend error (HTTP <code>). Fix it, then re-run `/opsx:e2e <name>` to re-explore." |
| JS error in console           | App runtime error                 | **STOP** — tell user: "Page has JS errors. Fix them, then re-run `/opsx:e2e <name>` to re-explore." |
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

- **React 19 / Next.js App Router**: use `page.waitForLoadState('networkidle')` — React 19 concurrent mode batches events asynchronously; 200-500ms timeouts are unreliable under resource contention
- **Vue 2/3 / Angular / React 18 / Plain JS / jQuery**: `waitForSelector(targetElement)` is sufficient and faster — DOM updates are synchronous; Playwright's actionability checks auto-wait correctly
- Prefer specific element waits (`waitForSelector`) over generic load states
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
| Infinite scroll | Dynamic row insertion | Count elements before/after scroll | Low (skip unless specs mention dynamic lists/pagination) |
| WebSocket / SSE | No DOM signal | Check `browser_console_messages` for WS events | Low (check only if app uses real-time features) |

**For each detected special element, capture via `browser_evaluate` with targeted DOM queries:**
- Canvas: `getContext('webgl2'/'webgl'/'2d')`, `width`, `height`
- Iframe: `src` attribute → use `frameLocator` in tests
- CAPTCHA: `.g-recaptcha`, `.h-captcha`, `[data-sitekey]`, canvas+slider detection
- OTP: `input` elements with `maxLength === 1` or `type === 'tel'`
- Rich text: `[contenteditable]` → `innerHTML`, `textContent.length`
- Video/Audio: `querySelector('video'/'audio')` → `paused`, `duration`
- Shadow DOM: `role="generic"` with no children → check `shadowRoot`

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

**Idempotency**: If `app-exploration.md` already exists → read it, verify routes still match the live app, update only new routes or changed pages.

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

> **"all" mode: skip test-plan generation.** No OpenSpec specs → no test-plan to generate. Still show confirmation below, then proceed to Step 6.

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

**Idempotency**: If test-plan.md exists → read and use, **but you MAY supplement missing test cases**. "Do not regenerate" means: do not discard existing cases, but you CAN add new ones discovered during Step 4 exploration that weren't in the original spec (e.g., empty states, error paths found during DOM exploration).

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

**Important**: Only list special elements that were actually detected in Step 4. Do not pre-populate with all possible types. If no special elements were found → omit the **Special Elements** section entirely.

Then ask: "Does this coverage match your intent? Reply **yes** to proceed, or tell me what to add/change."

If the user requests changes → update test-plan.md → re-display summary → re-confirm → proceed.

### 6. Generate (Generator role)

**"all" mode**: Build and expand Page Objects for future Change tests.

**Prerequisite** (change mode only): If `app-exploration.md` does not exist → **STOP**. Run Step 4 first. For **all mode**, exploration is embedded dynamically in Step 6 — no pre-existing app-exploration.md is required.

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
5. Also write `tests/playwright/app-all.spec.ts` — smoke test. **Minimum standard**: verify at least one heading or key interactive element is visible — not just "no crash". If the page loads but shows an empty shell or an error, the test must fail.

**Output priority**: Page Objects (`pages/*.ts`) are the primary asset. Smoke test is secondary. Existing Page Objects are never overwritten — only extended.

**Change mode** → `tests/playwright/changes/<name>/<name>.spec.ts` (functional):

- Read: test-plan.md, app-exploration.md, app-knowledge.md, seed.spec.ts
- For each test case: verify selectors in real browser, then write Playwright code

**Per-assertion UI check** (before writing each assertion):
```
Is this assertion about a visible UI result?
  → Yes → MUST use: expect(locator) with page selector
  → No  → Is this a precondition or unreachable HTTP error?
    → Yes → page.request is acceptable (record reason)
    → No → This is a bug — rewrite with UI selector
```
**Never use page.request for assertions the user can see on screen.** If you wrote page.request.get() for a visible result → rewrite with expect(locator) from the browser snapshot.

**Selector verification (change mode)**:

1. Navigate to route with correct auth state
2. browser_snapshot to confirm page loaded
3. For each selector: verify from current snapshot (see 4.3 table for priority)
4. Write test code with verified selectors
5. If selector unverifiable → note for Healer (Step 9)

**Test coverage — empty states**: For list/detail pages, explore the empty state. If the app shows a "no data" UI when the list is empty, generate a test to verify it. Empty states are often missing from specs but are real user paths.

**Test coverage — special elements**: Check `app-exploration.md` → **Special Elements Detected** table. For each special element, generate tests using templates from `.claude/skills/openspec-e2e/templates/test-plan.md` → **Special Element Test Cases**:
- Canvas: screenshot + boundingBox → dimensions > 0, or 2D pixel verification
- WebGL: screenshot only (no pixel comparison — rendering varies)
- Iframe: `frameLocator` + assert inner content visible
- Rich text: `contenteditable` → type + `textContent` assertion
- Video/Audio: `play()` → assert `!paused`
- CAPTCHA/OTP/File upload/Drag-drop: See AI-Opaque Elements section in templates

**Test coverage — AI-opaque elements**: For CAPTCHA, OTP, slider CAPTCHA, file upload, and drag-drop — elements that Playwright cannot reliably automate:

1. Mark the element in `app-exploration.md` → **Special Elements Detected** table with type and automation strategy
2. Generate the test using the appropriate strategy from `.claude/skills/openspec-e2e/templates/test-plan.md` → **AI-Opaque Elements** section:
   - **CAPTCHA**: Bypass via `auth.setup.ts` storageState, or skip with `test.skip()`, or verify via API
   - **OTP**: Use pre-verified test credentials (`E2E_OTP_CODE` env var), or development bypass flag
   - **File upload**: Use `page.setInputFiles()` with fixture files
   - **Drag-drop**: Use `page.dragAndDrop()` or `page.evaluate()` with custom event dispatching
3. If the element is truly non-automatable, write `test.skip()` with a comment explaining why, and mark with `/handoff` for manual testing

**Test coverage — performance**: Generate a Core Web Vitals test **only if** the OpenSpec spec or app-exploration.md specifies explicit performance targets (e.g., "LCP must be under 2s"). If no business target is defined, skip performance testing — hard-coded thresholds (lcp < 2500ms) produce false passes and add noise.

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
// tests/playwright/changes/<name>/<name>.spec.ts
import { LoginPage } from '../pages/LoginPage';

test('user can login', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.login('user@example.com', 'password123');
  await loginPage.expectURL(/dashboard/);
});
```

**If a shared page object doesn't exist yet**: define it inline in the spec AND write it to `tests/playwright/pages/<PageName>.ts` so future tests can reuse it.

#### 6.2. Selector patterns

| Prefer (robust) | Avoid (fragile) |
| — | — |
| `getByRole`, `getByTestId`, `getByLabel` | CSS class (`'.notification-bell'`), CSS ID (`'#avatarBtn'`) |
| `waitForSelector(targetElement)` | hardcoded `200ms` / `500ms` delays |

See `.claude/skills/openspec-e2e/templates/e2e-test.ts` for full examples of Page Object pattern, UI-first flows, error paths, auth guards, session handling, and visual regression.

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
4. Then run tests: openspec-pw run <name>   # skips to Step 9 directly (artifacts are reused)
```

**Idempotency**: If `auth.setup.ts` already exists → verify format, update only if stale.

**Post-auth re-exploration**: If Step 4 skipped protected routes due to missing auth, re-run exploration for those routes now that auth is configured. Navigate to each protected route with auth context → `browser_snapshot` → update `app-exploration.md`. Selectors verified now are better than guesses used during test generation.

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
openspec-pw run <name> [--project <role>] [--headed] [--update-snapshots]
```

The CLI handles: server lifecycle, port mismatch, report generation.

If tests fail → use Playwright MCP tools to inspect UI, fix selectors, re-run.

**Browser visibility**: The Healer uses browser MCP tools (snapshot, screenshot, console messages) to inspect failures — no need for `--headed`. If you want to **watch the browser yourself** during debugging, add `--headed`: `openspec-pw run <name> --headed`.

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

When a test fails, classify before attempting repair.

**Batch Failure Detection — run this FIRST when multiple tests fail:**

```
Collect ALL failing test names + their failure reasons.
Group by: same route + same action + same error pattern.
If ≥2 tests fall into the same group:
  → Pause individual healing
  → Navigate to that route + perform the action manually
  → Check browser_console_messages + browser_network_requests
  → If console error or 4xx/5xx present:
      → This is an App Bug (backend/API change), NOT Test Bugs
      → Classify all tests in this group as App Bug
      → Skip all → record 1 App Bug in registry (not N bugs)
      → Skip the rest of individual Triage for this group
  → If no console/network error but all still fail:
      → Likely a shared state issue → RAFT
      → Skip all → note RAFT in report
Proceed with individual Triage only for tests NOT in a batch failure group.
```

**After Batch Detection, individual Triage:**

| Failure Type | Signal | Classification | Action |
| — | — | — | — |
| **Network/Backend** | `net::ERR`, 4xx/5xx in console/network | **App Bug** | `test.skip()` + record in `app-bug-registry.md` |
| **JS Runtime Error** | Console error (non-network) | **App Bug** | `test.skip()` + record in `app-bug-registry.md` |
| **Auth Expired** | Redirected to login mid-test | **Flaky** | Re-run auth.setup → re-run |
| **Selector Not Found** | Element not found | **Test Bug** | → Phase 2 Healer |
| **Assertion Mismatch** | Wrong content/value | **Ambiguous** | → Phase 2 Healer |
| **Timeout** | waitFor/evaluate timeout | **Flaky** | Retry isolated: `openspec-pw run <name> --grep "<test-name>"` (1×, not counted in heal attempts). If it passes isolated but fails in suite → **RAFT**. If it consistently times out → check framework: React 19 / Next.js App Router: add `page.waitForLoadState('networkidle')`. Vue/Angular/React 18 / Plain JS / jQuery: use `waitForSelector(targetElement)` instead of timeout tuning. |
| **Same test fails in suite, passes isolated** | — | **RAFT** | `test.skip()` in suite, note RAFT in report |

- **App Bug** → skip immediately (no healing needed) → record in App Bug Registry
- **Flaky** → retry once isolated
- **Test Bug / Ambiguous** → Phase 2

#### App Bug Registry

For every App Bug classified in Phase 1, record it in `openspec/reports/app-bug-registry.md` (create if missing):

```markdown
# App Bug Registry

<!-- Auto-generated. Do not edit manually. -->

## Active App Bugs

| # | Test | Route | Signal | First Detected | Status |
|---|------|-------|--------|---------------|--------|
| 1 | test-name | /route | net::ERR_CONNECTION_REFUSED | 2026-04-09 | open |
```

**Update rules**:
- **New App Bug**: Append new row, increment `#`
- **App Bug re-run and now passes**: Keep row, change status to `resolved` + add `Resolved` column with date
- **Keep all rows** (never delete) — the resolved count is the signal that bugs are being fixed

> **Why this matters**: `test.skip()` hides App Bugs from the pass/fail count. Without an explicit registry, "all tests passed" is a false positive when App Bugs exist. The registry makes the invisible visible.

> **Global attempt guard**: Each test has an independent heal counter (max 3 per test). If the same test enters Phase 2 more than once and reaches the cap each time → treat as "consecutive escalation without progress" → Phase 3 immediately.

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

   **⚠️ Assertion modification guard — never skip Phase 3 unless ALL conditions are met:**

   - The test has **never passed with the current assertion** (newly generated test, or this is the first time this assertion fails)
   - The ACTUAL value is **verifiably** from a different spec section (e.g., this test was in the wrong describe block)
   - You can point to the **specific line in the spec** that defines the ACTUAL behavior

   **If ANY condition is uncertain → Phase 3 immediately.** Do NOT modify the assertion.

   **Safe to fix without Phase 3:**
   - Typo in assertion (e.g., "Submmit" vs "Submit" in the expected text)
   - Selector was correct but the element was moved to a different location (same text, different selector)
   - Explicit spec drift confirmed by reading the spec (e.g., spec says "button says Submit" but test says "button says Submit Form")

   **Never fix without Phase 3:**
   - App behavior changed after an action (e.g., "after clicking submit, balance should decrease" → ACTUAL shows no change → **Phase 3**, could be optimistic update bug, backend failure, or spec mismatch)
   - Data values differ (e.g., expected "¥1000" but got "¥999" → **Phase 3**, could be rounding, discount, or calculation bug)
   - Missing elements after interaction (e.g., "after creating order, success message should appear" → no message → **Phase 3**)

5. If selector issue → find equivalent stable selector from snapshot
6. Apply fix → re-run **only that test** (attempt 1/3)
7. If healed → append to `app-knowledge.md` → **Selector Fixes** table (route, old → new selector, reason)

**Element Missing handling (when browser_snapshot shows element not found):**

| Situation | Check | Action |
| — | — | — |
| JS error in console after action | `browser_console_messages` | **App Bug** → Phase 1 → App Bug classification |
| Auth redirected mid-action | URL changed to `/login` | **Flaky** → re-run with fresh auth |
| SPA route didn't update | URL is correct but element missing | Wait for SPA hydration → `page.waitForLoadState('networkidle')` or `waitForSelector(target)` |
| Element genuinely missing | None of the above | **Test Bug** → find alternative selector or **Phase 3** if no equivalent exists |

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

**Decision tree — follow the path based on user's choice:**

| Choice | What to do | After fix, do this |
|--------|-----------|-------------------|
| **(a)** Fix the app to match the spec | Fix the app code | Re-run: `openspec-pw run <change-name>` to verify fix |
| **(b)** Update the spec to match the app | Edit the spec file | Then update the test assertion (→ option c), or regenerate the affected part of the test |
| **(c)** Update the test assertion | Fix the assertion in `tests/playwright/changes/<name>/<name>.spec.ts` | Re-run: `openspec-pw run <change-name>` to verify |
| **(d)** Skip with `test.skip()` | Add `test.skip()` to the test | Note in `app-knowledge.md` → `Selector Fixes` table with reason "human escalation — skipped pending resolution" |

**Stuck in escalation loop**: If 3 consecutive Phase 3 escalations result in no progress (test still failing), STOP and ask: "This test has been escalated 3 times without resolution. Are you sure the root cause is still the same, or has something changed?"

After the issue is resolved, re-run tests:
```
openspec-pw run <change-name>
```
`/opsx:e2e <change-name>` re-runs the full 11-step workflow — unnecessary after Phase 3. The test file and auth context are already correct. Use `openspec-pw run` to verify fixes directly.

### 10. False Pass Detection + RAFT Detection + App Bug Accumulation

Run after test suite completes (even if all pass).

**False Pass patterns** (test passed but shouldn't have):

- **Conditional visibility**: `if (locator.isVisible().catch(() => false))` — if test passes, locator may not exist
- **Too fast**: < 200ms for a complex flow is suspicious
- **No fresh auth context**: Protected routes without `browser.newContext()`

**RAFT detection** (Resource-Affected Flaky Test):

- Full suite: test fails → run isolated: `openspec-pw run <name> --grep "<test-name>"` → if it passes in isolation but fails in suite → **RAFT**
- This is **NOT** a test bug or app bug. Mark as RAFT, add `test.skip()` in suite, note in report
- RAFTs are infrastructure coupling issues (CPU/memory/I/O contention), not fixable by changing test or app

**App Bug Accumulation Detection** (most critical):

1. Read `openspec/reports/app-bug-registry.md`
2. Count `open` status rows
3. If ≥ 3 active App Bugs → add "⚠️ App Bug accumulation: N bugs unresolved" to report summary. **Do NOT suppress or hide this warning.** The test suite may report "all passed" (skipped ≠ failed), but N broken features is not a passing system.
4. Check for **App Bugs that became "resolved"** (passing on re-run) → this is the signal that bugs were fixed. Update `app-bug-registry.md` accordingly, and remove `test.skip()` from those tests so they re-enter the regression suite.

### 11. Report results

Read report at `openspec/reports/playwright-e2e-<name>-<timestamp>.md`. Present:

- **Summary table** with failure type breakdown (App Bugs, Test Bugs/healed, Flaky-RAFT, Human Escalations)
- **App Bug Summary**: Table of all active App Bugs from `app-bug-registry.md` — test name, route, signal, first detected. If ≥ 3 active → display "⚠️ App Bug accumulation warning" prominently.
- **Conditional "All Pass" conclusion**:
  - ✅ **"All tests passed"** — only if 0 active App Bugs and 0 skipped tests
  - ⚠️ **"All tests passed (N skipped)"** — if skipped tests exist but no active App Bugs
  - ⚠️ **"All tests passed (N skipped, M App Bugs unresolved)"** — if active App Bugs exist
- Failure Classification table (test, type, action, healed?)
- Auto-heal log (assertion vs actual comparison, fix applied, result)
- RAFT Summary (if any detected)
- Human Escalations (if any, with user decision)
- Recommendations with `file:line` references

Report template: `.claude/skills/openspec-e2e/templates/report.md`

**Update tasks.md**:
- If 0 active App Bugs → find E2E-related items, append `✅ Verified via Playwright E2E (<timestamp>)`.
- If active App Bugs exist → **do not mark as verified**. Append instead: `⚠️ App Bug blocked: <bug summary> (<timestamp>)`.

## Graceful Degradation

**When these critical failures occur → STOP immediately:**

| Scenario | Behavior |
| ------- | ------- |
| No specs / app-exploration.md missing (change mode) | **STOP** |
| JS errors or HTTP 5xx during exploration | **STOP** → user fixes app → re-run `/opsx:e2e <name>` to re-explore from Step 4 |
| Sitemap fails ("all" mode) | Continue with homepage links fallback |
| File already exists (app-exploration, test-plan, app-all.spec.ts, Page Objects) | Read and use — never regenerate |
| Test fails (network/backend) | **App Bug** — `test.skip()` + record in `app-bug-registry.md` |
| Test fails (selector/assertion) | **Test Bug/Ambiguous** — Healer Phase 1→2 (≤3 attempts) |
| RAFT detected (suite fail, isolated pass) | **Flaky** — `test.skip()` in suite, note RAFT in report |
| Phase 3 escalation | **Human needed** — STOP + ask user |
| False pass detected | Add "⚠️ Coverage Gap" to report |
| App Bug skip accumulation (≥3 active App Bugs) | **Warning** — add "⚠️ App Bug accumulation: N bugs unresolved" to report summary. Do not suppress. |

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
`tests/playwright/`, `openspec/changes/<name>/specs/playwright/`, `openspec/reports/`, `playwright.config.ts`, `auth.setup.ts`

> `tests/playwright/` — spec files, Page Objects, auth, credentials, app-knowledge.md
> `openspec/changes/<name>/specs/playwright/` — app-exploration.md, test-plan.md (change mode)
> `openspec/reports/` — test reports, app-bug-registry.md

**Never write to:** any other directory
