
## Input

- **Change name**: `/opsx:e2e <name>` or `/opsx:e2e all` (full app exploration, no OpenSpec needed)
- **Specs**: `openspec/changes/<name>/specs/*.md` (if change mode)
- **Credentials**: `E2E_USERNAME` + `E2E_PASSWORD` env vars

## Output

- **Test file**: `tests/playwright/changes/<name>/<name>.spec.ts`
- **Page Objects** (all mode): `tests/playwright/pages/<Route>Page.ts`
- **Auth setup**: `tests/playwright/auth.setup.ts` (if auth required)
- **Report**: `openspec/reports/playwright-e2e-<name>-<timestamp>.md`
- **App Bug Registry**: `openspec/reports/app-bug-registry.md` (cumulative)
- **Test plan**: `openspec/changes/<name>/specs/playwright/test-plan.md` (change mode only)

## Architecture

| Mode   | Command             | Route source             | Output                         |
| ------ | ------------------- | ------------------------ | ------------------------------- |
| Change | `/opsx:e2e <name>`  | OpenSpec specs           | `changes/<name>/<name>.spec.ts` |
| All    | `/opsx:e2e all`     | sitemap + homepage crawl | `pages/*.ts` (Page Objects)     |

> **Full regression is opt-in only.** `openspec-pw run <name>` → one spec file. Do NOT run `npx playwright test` (no file) or `--only-changed` unless user explicitly requests.
> **Roles**: Planner (Steps 4–5) → test-plan.md; Generator (Step 6) → `.spec.ts` + Page Objects; Healer (Step 9) → repairs failures via MCP.

Browser exploration is tool-agnostic: Playwright MCP or `openspec-pw explore --parallel N`.

## Testing Principles

**UI first.** Every assertion about visible UI state must use `page.getByRole/ByLabel/ByText + expect()`. `page.request` is acceptable only for precondition setup or HTTP-level mocking via `page.route()`.

```
Can user SEE this on screen?
  → Yes → MUST use: UI selector + expect()
  → No  → Record reason → page.request acceptable
```

**Business logic assertion rule**: computed/counted values (balance, total, count, percentage) MUST use API assertion. UI assertions verify rendering, not calculation.

**Mock data rule**: Frontend mocking forbidden (no JS stubs, module stubs). API mocking via `page.route()` allowed for 4xx/5xx, edge cases, third-party failures — with user consent and at HTTP level only. Never mock below HTTP (DB, backend service).

**API assertion examples**: computed/counted values → MUST use `page.request` to verify, not UI:

```
// ✅ API assertion catches calculation bugs
const order = await page.request.get(`${BASE_URL}/api/orders/${id}`);
expect((await order.json()).total).toBe(800);

// ✅ Optimistic update with API verification
await expect(page.getByText('总金额: ¥800')).toBeVisible();
await page.waitForResponse(r => r.url().includes('/api/like'));
```

**Never use API to replace routine UI flow.** If a test completes in <200ms, it skips real UI.

## Steps

### 1. Select the change or mode

**Change mode**: Use provided name, infer from context, or auto-select if only one exists. If ambiguous → `openspec list --json` + AskUserQuestion. If specs empty → STOP, suggest "all" mode.

**"all" mode**: Route discovery priority:
1. sitemap.xml (navigate to `${BASE_URL}/sitemap.xml` → parse URLs)
2. Link extraction (navigate home → extract `<a href>` for internal paths)
3. Fallback common paths (`/`, `/login`, `/dashboard`, `/admin`, `/profile`, `/settings`)

| Situation | Action |
| --------- | ------ |
| sitemap.xml returns 200 with URLs | Parse → extract pathname |
| sitemap.xml 404/5xx | Skip → link extraction |
| Link extraction → 0 links | Fallback common paths |
| Duplicates | Deduplicate by pathname |

Persist routes to `app-knowledge.md` → **Routes** table (replace entire table, do not append). Group routes: Guest vs Protected (by direct access attempt).

### 2. Detect auth

**Change mode**: Read specs, detect auth from keywords. **"all" mode**: Try accessing protected paths → redirected to `/login` → auth required.

**Both conditions required**:
- **A — Explicit markers**: "login", "signin", "logout", "authenticate", "protected", "session", "unauthorized", "jwt", "token", "refresh", "middleware"
- **B — Context indicators**: Protected routes, role mentions ("admin", "user"), redirect flows

| Confidence | Condition | Action |
| ---------- | --------- | ------ |
| High | Multiple markers + context indicators | Auto-proceed |
| Medium | Single marker, context unclear | Proceed + note |
| Low | No markers | Skip auth, test as guest |

Exclude false positives: HTTP header examples and code snippets do not count.

### 3. Validate environment

```bash
npx playwright test tests/playwright/seed.spec.ts --project=chromium
```

If seed test fails → STOP. Fix environment before proceeding. This validates BASE_URL, auth setup, and Playwright are functional.

### 4. Explore application

**Prerequisites**: browser tool installed, seed test passed, BASE_URL reachable.

**4.1. Verify BASE_URL**: navigate → if HTTP 5xx → **STOP: backend error**. Read `app-knowledge.md` for known risks and conventions.

**4.2. Explore each route**: navigate → check console errors → snapshot DOM → screenshot. For ≥5 routes, use `openspec-pw explore --parallel N` for genuine parallel browsers.

**App-level error decisions**:

| Signal | Action |
| ------ | ------ |
| HTTP 5xx / unreachable | **STOP** — backend error, fix app first |
| JS error in console | **STOP** — page has JS errors |
| HTTP 404 | Continue — mark `⚠️ route not found` |
| Auth required, no credentials | Continue — skip protected routes, explore login page |
| API 4xx/5xx | Continue — mark `⚠️ API error` |

**Redirect/Refresh loop detection**: Navigate → wait networkidle → capture URL → wait 2s → capture URL again. If URL changed → redirect loop (auth issue or middleware bug). If console errors > 10 → refresh loop. Skip route, record as App Bug.

**Page wait stability**: React 19 / Next.js App Router → `page.waitForLoadState('networkidle')` (concurrent mode batches async). Vue/Angular/React 18/plain JS → `waitForSelector(targetElement)` (DOM updates synchronous). Prefer specific element waits over generic load states.

**Element extraction from snapshot**:

| Element type | Selector priority |
| ------------ | ----------------- |
| Buttons | `[data-testid]` > `getByRole` > `getByLabel` > `getByText` |
| Form fields | `[data-testid]` > `name` > `label` |
| Navigation | `text` > `href` |
| Headings, errors | For assertions |
| Special (canvas, iframe, CAPTCHA, OTP, Shadow DOM, file upload) | Detect & note strategy |

**Special elements — quick reference**:

| Element | Snapshot signal | Strategy |
| ------- | --------------- | -------- |
| `<canvas>` | role="img" | `evaluate: getContext`, boundingBox > 0 |
| `<iframe>` | role="iframe" | frameLocator + src attr |
| CAPTCHA | `.g-recaptcha`, `[data-sitekey]` | auth.setup bypass / test.skip |
| OTP | 6-digit input fields, maxLength=1 | Dev bypass / E2E_OTP_CODE |
| Shadow DOM | role="generic" no children | `evaluate: el.shadowRoot` |
| Rich text | `[contenteditable]` | type + textContent |
| File upload | `<input type="file">` | setInputFiles |

Record findings in `app-exploration.md`. Output path:
- Change mode: `openspec/changes/<name>/specs/playwright/app-exploration.md`
- All mode: `<root>/app-exploration.md`

**Idempotency**: If `app-exploration.md` exists → read, verify routes, update only changed/new routes. **Route Snapshot Hash**: Navigate to sitemap.xml → hash content → if unchanged since last exploration, skip re-exploration entirely. Store hash in `app-knowledge.md` → `Exploration State`.

**4.3. Update shared knowledge**: Extract project-level findings to `tests/playwright/app-knowledge.md`. Auto-de-duplicate by key.

### 5. Generate test plan (change mode only)

**All mode**: skip — show confirmation, proceed to Step 6.

**Prerequisite**: `app-exploration.md` must exist → STOP and run Step 4 if missing.

Create `openspec/changes/<name>/specs/playwright/test-plan.md`. Read inputs: specs, app-exploration.md, app-knowledge.md. Create test cases (functional requirement → test case, with `@role` and `@auth` tags). Reference verified selectors from exploration.

**State mutual exclusion**: before each test case, identify state boundaries and which elements disappear/appear. Assert mutual exclusion explicitly.

**Idempotency**: If test-plan.md exists → read and supplement missing cases, never regenerate.

**⚠️ Human verification**: After creating/reading test-plan.md, **STOP** and display summary. Ask user to confirm before proceeding to Step 6.

### 6. Generate (Generator role)

**All mode**: Build Page Objects for future tests. **Change mode**: Generate `tests/playwright/changes/<name>/<name>.spec.ts`.

**Page Object pattern** (read BasePage.ts first):
```typescript
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
```

**Page Object file handling**:
- File doesn't exist → Create
- File exists with getters → Extend (preserve existing, add missing)
- File has inline locators → Rewrite with Page Object pattern

**Per-assertion check**:
```
Is this assertion about a visible UI result?
  → Yes → MUST use: expect(locator) with page selector
  → No  → page.request acceptable (record reason)
```

**Selector caching**: Use already-verified selectors from `app-exploration.md`. Only navigate to verify if selector is missing or marked Fragile.

**Test data fabrication**: Never invent. Follow §6 of employee standards — ask user, use `TODO(user)` markers.

**Test coverage — empty states**: For list/detail pages, explore and test empty state UI.

**Performance tests**: Only if spec or app-exploration.md defines explicit targets. No hard-coded thresholds.

### 7. Configure auth (if required)

- **API login**: Generate `auth.setup.ts` using `E2E_USERNAME`/`E2E_PASSWORD` + POST
- **UI login**: Generate using browser form fill
- **Multi-user**: Separate `storageState` paths per role

Always use env vars, never hardcode. If auth.setup.ts exists → verify, update only if stale.

**Post-auth re-exploration**: If Step 4 skipped protected routes, re-run exploration for those routes now.

### 8. Configure playwright.config.ts

If missing → generate minimal config with webServer, projects, reporters. If exists → preserve all fields, add only missing webServer block.

**BASE_URL auto-detect**: process.env.BASE_URL → seed.spec.ts → vite.config.ts → package.json scripts → fallback `http://localhost:3000`.

### 9. Execute tests

```bash
openspec-pw run <name> [options]
```

Flags: `-p --project`, `-t --timeout`, `--json`, `-g --grep`, `--smoke`, `-w --workers`, `--headed`, `--update-snapshots`.

When tests fail → **Healer** (3 phases):

**Phase 1 — Triage**: Classify each failure before repairing.

| Failure Type | Signal | Classification | Action |
| ------------ | ------ | -------------- | ------ |
| Network/Backend | `net::ERR`, 4xx/5xx | **App Bug** | `test.skip()` + App Bug Registry |
| JS Runtime Error | Console error | **App Bug** | `test.skip()` + App Bug Registry |
| Auth Expired | Redirected to /login | **Flaky** | Re-run auth.setup |
| Selector Not Found | Element not found | **Test Bug** | → Phase 2 |
| Assertion Mismatch | Wrong content | **Ambiguous** | → Phase 2 |
| Timeout | waitFor timeout | **Flaky** | Retry isolated |
| Same test: fails in suite, passes isolated | — | **RAFT** | `test.skip()` in suite, note in report |

**Batch Detection**: When ≥2 tests fail with same route + error type, check console/network first. If backend error → all App Bug (1 entry). If timeout → check RAFT. If all same root cause → bulk classify.

**App Bug Registry**: `openspec/reports/app-bug-registry.md`. For each App Bug, append row (#, Test, Route, Signal, Date, Status). Never delete rows — resolved bugs change status to `resolved`.

**Phase 2 — Repair** (for Test Bug / Ambiguous):

2-0. **Batch diagnosis**: Read failing test specs + app-knowledge.md fixes. Output per test: TEST, ROUTE, ASSERTION, EXPECTED_BEHAVIOR, KNOWN_FIX. Classify: `ready-to-fix` / `needs-assertion-fix` / `needs-phase3` / `needs-more-diagnosis`.

2-1. **Navigate + snapshot**: ASSERTION vs ACTUAL comparison. Safe to fix without Phase 3: typo, moved element, confirmed spec drift. **Never fix without Phase 3**: behavior changed after action, data values differ, missing elements after interaction.

2-5. **Selector repair**: Pick highest-stability candidate: `getByRole` > `getByText/getByLabel` > `locator('#id')` > `locator('.class')` > `locator('nth-child')`.

2-6. **Fix + verify**: Apply fix → `npx playwright test --grep "<test-name>"` → if passes, log to app-knowledge.md (Selector Fixes / Assertion Fixes). Max 3 heal attempts per test.

2-7. **Log**: Append healed selector/assertion to `app-knowledge.md`. Auto-de-duplicate by Route + Old Selector (selectors) or Test + Old Assertion (assertions).

**Phase 3 — Escalate** (after ≥3 heals or ambiguous comparison): STOP and output:
```
E2E Test Failed — Human Decision Required
Test: <name> | Failure: <type>
Assertion: "<expected>" | Actual: "<actual>"
Options: (a) Fix app, (b) Update spec, (c) Update assertion, (d) Skip
```

Wait for user input. Track escalation attempts — if 3 consecutive Phase 3 with no progress, STOP and flag.

**Post-heal**: After all Phase 2 tests healed, run `npx playwright test --only-changed` as pre-commit guard.

### 10. Report results

Compile from `playwright-e2e-<name>-<timestamp>.md` and Phase 1–3 output:
- Summary table (App Bugs / Test Bugs healed / Flaky-RAFT / Escalations)
- App Bug Summary (with accumulation warning if ≥3 active)
- Failure Classification table
- Auto-heal log
- RAFT Summary
- Human Escalations
- Recommendations

**Conditional "All Pass"**:
- ✅ **"All tests passed"** — 0 active App Bugs, 0 skipped
- ⚠️ **"All tests passed (N skipped)"** — skipped exist, no active App Bugs
- ⚠️ **"All tests passed (N skipped, M App Bugs unresolved)"** — active App Bugs exist

**Update tasks.md**: If 0 active App Bugs → append `✅ Verified via Playwright E2E (<timestamp>)`. If App Bugs exist → append `⚠️ App Bug blocked: <summary> (<timestamp>)` (do not mark as verified).

## Graceful Degradation

| Scenario | Classification | Action |
| -------- | -------------- | ------ |
| No specs / app-exploration missing (change mode) | Blocker | **STOP** |
| JS errors or HTTP 5xx during exploration | Blocker | **STOP** |
| Redirect/refresh loop during exploration | App Bug | Skip route → record in registry |
| File already exists | Idempotency | Read and use — never regenerate |
| Test fails (network/backend) | App Bug | `test.skip()` + registry |
| Test fails (selector/assertion) | Test Bug | Healer Phase 1→2 (≤3 attempts) |
| RAFT detected | Flaky | `test.skip()` in suite |
| Phase 3 escalation | Human needed | **STOP** — wait for user |
| ≥3 active App Bugs | Warning | Add accumulation warning to report |

## Guardrails

| Rule | Why |
| ---- | --- |
| Read specs as source of truth | Generated tests must match requirements |
| Step 4 before Step 6 | Real DOM data → accurate selectors |
| Never contradict specs | E2E validates implementation, not design |
| Cap heal at 3 attempts per test | Prevents infinite loops |
| Write runnable code, not TODOs | Placeholders fail CI |

**Write scope**: `tests/playwright/` (specs, Page Objects, auth, credentials, app-knowledge.md), `openspec/changes/<name>/specs/playwright/` (exploration, test plan), `<root>/app-exploration.md` (all mode), `openspec/reports/` (reports, bug registry), `playwright.config.ts`, `auth.setup.ts`. **Never write to any other directory.**
