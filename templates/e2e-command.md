
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

> **Full regression is opt-in only.** Run `npx playwright test` for one spec file or full suite. Do NOT use `--only-changed` unless the user explicitly requests it.
> **Roles**: Planner (Steps 4–5) → test-plan.md; Generator (Step 6) → `.spec.ts` + Page Objects; Healer (Step 9) → repairs failures via MCP.

> **STOP semantics**: **STOP** = end the current turn — output the blocking message, make no further tool calls, and wait for the user. Two flavors:
> - **HARD STOP** (backend 5xx, seed failure, Phase 3 escalation, test-plan gate): report and wait.
> - **SELF-HEAL** (only where explicitly stated, e.g. missing app-exploration → run Step 4): run the referenced step, then continue.

**Mode × step matrix** (where the two modes diverge — everywhere else both modes run the step):

| Step | Change mode | All mode |
| ---- | ----------- | -------- |
| 1–4 select / auth / seed / explore | run | run |
| 5 test plan + human gate | run, HARD STOP at the gate | skip — print route summary, continue (no reply needed) |
| 6 generate | `<name>.spec.ts` | Page Objects only |
| 7 auth / 8 config | if required | if required |
| 9 execute | generated spec | seed smoke only (`npx playwright test tests/playwright/seed.spec.ts`) |
| 10 report | full report | routes + Page Objects + seed result; omit Healer sections |

Browser exploration is tool-agnostic: the `playwright-test` MCP server's browser tools or `openspec-pw explore --parallel N`.

## Testing Principles

**UI first.** Every assertion about visible UI state must use `page.getByTestId/ByRole/ByLabel/ByText + expect()`. `page.request` is acceptable only for precondition setup or HTTP-level mocking via `page.route()`.

**Selector priority (single source of truth)**: verified selector from app-exploration.md > `[data-testid]` (getByTestId) > getByRole > getByLabel > getByText > CSS id/class > positional. The Step 4 element table, Phase 2-5 repair ladder, and app-knowledge.md conventions all defer to this order.

```
Can user SEE this on screen?
  → Yes → MUST use: UI selector + expect()
  → No  → Record reason → page.request acceptable
```

**Business logic assertion rule**: computed/counted values (balance, total, count, percentage) MUST use API assertion. UI assertions verify rendering, not calculation.

**Mock data rule**: Frontend mocking forbidden (no JS stubs, module stubs). API mocking via `page.route()` allowed for 4xx/5xx, edge cases, third-party failures — with user consent and at HTTP level only. Never mock below HTTP (DB, backend service).

**API assertion examples**:

```
// ✅ API assertion catches calculation bugs
const order = await page.request.get(`${BASE_URL}/api/orders/${id}`);
expect((await order.json()).total).toBe(800);

// ✅ Optimistic update: assert UI AND verify the API response
const likeResp = page.waitForResponse(r => r.url().includes('/api/like'));
await page.getByRole('button', { name: 'Like' }).click();
expect((await likeResp).status()).toBe(200);
await expect(page.getByText('总金额: ¥800')).toBeVisible();
```

**Never replace routine UI flow with pure API calls.** A test that only uses `page.request` and never asserts visible UI is not an E2E test — put it in an API/integration suite instead.

## Steps

### 1. Select the change or mode

**Change mode**: Use provided name, or auto-select if exactly one change exists. If no name was passed and more than one change exists → `openspec list --json`, present the list, ask the user to choose, and wait (do not use editor-specific prompt tooling names — this workflow runs in every supported editor). "Infer from context" applies only when the conversation clearly references one change. If specs empty → STOP, suggest "all" mode.

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
| Medium | Single marker, context unclear | Proceed assuming auth is required + note the uncertainty in app-exploration.md |
| Low | No markers | Skip auth, test as guest |

Exclude false positives: HTTP header examples and code snippets do not count.

### 3. Validate environment

```bash
npx playwright test tests/playwright/seed.spec.ts
```

Run across all configured projects — do not assume a project name (the user's own `playwright.config.ts` may name projects differently).

If seed test fails → **HARD STOP**. Report the failing check output to the user and wait — environment repair (deps, auth setup, init) has side effects and needs user consent. This validates BASE_URL, auth setup, and Playwright are functional.

### 4. Explore application

**Prerequisites**: browser tool installed, seed test passed, BASE_URL reachable.

**4.1. Verify BASE_URL**: navigate → if HTTP 5xx → **STOP: backend error**. Read `app-knowledge.md` for known risks and conventions. Also verify the served page actually belongs to **your app** (check a known element or the title) — a foreign dev server on the same port would silently invalidate every downstream test (false green).

**4.2. Explore each route**: navigate → check console errors → snapshot DOM → screenshot. For ≥5 routes, use `openspec-pw explore --parallel N` for genuine parallel browsers.

**App-level error decisions**:

| Signal | Action |
| ------ | ------ |
| HTTP 5xx / unreachable | **STOP** — backend error, fix app first |
| JS error that breaks the page (blank render, error overlay, uncaught exception on load) | **STOP** — page unusable |
| Non-blocking console errors (favicon/asset 404, blocked analytics, extension noise, deprecation warnings) | Continue — record in app-exploration.md → Exploration Failures |
| HTTP 404 | Continue — mark `⚠️ route not found` |
| Auth required, no credentials | Continue — skip protected routes, explore login page |
| API 4xx/5xx | Continue — mark `⚠️ API error` |

**Redirect/Refresh loop detection**: After the page settles, sample the URL every 1s for 5s. Loop = the URL alternates between ≥2 addresses ≥3 times, the browser reports `ERR_TOO_MANY_REDIRECTS`, or a ready signal never appears. A single post-load URL change (SPA client-side routing, query params) is normal — not a loop. On a real loop: skip route, record as App Bug.

**Wait strategy (applies to test code written in Step 6)**: prefer the route's Ready Signal from app-exploration.md (`waitForSelector(readySignal)`); fall back to `waitForLoadState('networkidle')` only when no ready signal exists. During MCP exploration, rely on the browser tool's built-in settle plus a short wait before snapshotting.

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

**All mode**: skip — print the route summary and continue to Step 6 (no reply needed; see the mode × step matrix).

**Prerequisite**: `app-exploration.md` must exist — if missing, SELF-HEAL: run Step 4 first, then continue here.

Create `openspec/changes/<name>/specs/playwright/test-plan.md`. Read inputs: specs, app-exploration.md, app-knowledge.md. Create test cases (functional requirement → test case, with `@role` and `@auth` tags). Reference verified selectors from exploration.

**State mutual exclusion**: before each test case, identify state boundaries and which elements disappear/appear. Assert mutual exclusion explicitly.

**Idempotency**: If test-plan.md exists → read and supplement missing cases, never regenerate.

**MCP planner tools (conditional)**: if the `playwright-test` MCP server exposes `planner_setup_page` / `planner_save_plan`, prefer driving exploration-to-plan through them — have `planner_save_plan` write to (or copy its output into) the `test-plan.md` path above so exactly one plan artifact exists, and the human-verification gate below still applies.

**Subagent delegation (conditional)**: if the editor supports subagent delegation and `.claude/agents/playwright-test-planner.md` exists (installed via `openspec-pw init --agents`), you may delegate the exploration-to-plan work to that planner subagent for context isolation. Pin the delegation prompt to the inputs (specs, app-exploration.md, app-knowledge.md) and the output path above. You retain accountability: after it returns, verify the plan covers every requirement — then the human-verification gate below applies unchanged.

**⚠️ Human verification**: After creating/reading test-plan.md, **STOP** and display summary. Ask user to confirm before proceeding to Step 6.

### 6. Generate (Generator role)

**All mode**: Build Page Objects for future tests. **Change mode**: Generate `tests/playwright/changes/<name>/<name>.spec.ts`.

**Generation scope**: Generate tests only for routes that have exploration data. If auth-protected routes were skipped in Step 4, do NOT hand-write selectors for them — list them as "pending post-auth exploration" and generate their tests after Step 7's re-exploration.

**Spec idempotency**: If the .spec.ts exists → read it first. Add tests for requirements not yet covered; update tests whose source requirement changed; keep existing passing tests (confirm with the user before deleting any). Never wholesale-regenerate. Each test() carries one **spec anchor** comment line above it: `// spec: <capability>#<requirement-title-verbatim>` (the delta requirement's exact `### Requirement:` title text, no slug conversion) — this is how `openspec-pw audit` later finds tests whose behavior was deleted from the main spec. One anchor per test; describe blocks carry none.

**MCP recording flow (conditional)**: if the `playwright-test` MCP server exposes `generator_setup_page` / `generator_write_test` / `generator_read_log`, prefer record-then-write over hand-writing: execute each step once in the real browser → `generator_write_test` emits the spec → review the generated file against the per-assertion check, the selector rules below, and the spec-anchor rule above (recorded output is step-cut and carries no anchors — add them during review, one `// spec: <capability>#<requirement-title>` per test). Fall back to hand-writing when the tools are absent (they only exist on the test-runner MCP server).

**Subagent delegation (conditional)**: if the editor supports subagent delegation and `.claude/agents/playwright-test-generator.md` exists, you may delegate code generation to that generator subagent — but the delegation prompt MUST carry the rules the subagent does not inherit: Generation scope, Spec idempotency, the per-assertion check, the selector priority (single source of truth), and the Write scope. Verify its output against those rules before continuing.

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

**Test data fabrication**: Never invent. Follow §4 of employee standards (数据编撰禁令) — ask user, use `TODO(user)` markers.

**Test coverage — empty states**: For list/detail pages, explore and test empty state UI.

**Performance tests**: Only if spec or app-exploration.md defines explicit targets. No hard-coded thresholds.

### 7. Configure auth (if required)

- **API login**: Generate `auth.setup.ts` using `E2E_USERNAME`/`E2E_PASSWORD` + POST
- **UI login**: Generate using browser form fill
- **Multi-user**: Separate `storageState` paths per role

Always use env vars, never hardcode. If auth.setup.ts exists → verify, update only if stale.

**Post-auth re-exploration**: If Step 4 skipped protected routes, re-run exploration for those routes now, then return to Step 6 to generate their tests before continuing to Step 8.

### 8. Configure playwright.config.ts

If missing → generate minimal config with webServer, projects, reporters. If exists → preserve all fields, add only missing webServer block.

**BASE_URL auto-detect**: process.env.BASE_URL → seed.spec.ts → vite.config.ts → package.json scripts → fallback `http://localhost:3000`.

### 9. Execute tests

```bash
npx playwright test [options]
```

**All mode**: run the seed smoke only (see the mode × step matrix) — there is no generated spec to execute.

When tests fail → **Healer** (3 phases):

**Phase 1 — Triage**: Classify each failure before repairing.

| Failure Type | Signal | Classification | Action |
| ------------ | ------ | -------------- | ------ |
| Network/Backend | `net::ERR`, 4xx/5xx | **App Bug** | `test.fixme()` + reason comment + App Bug Registry |
| JS Runtime Error | Console error | **App Bug** | `test.fixme()` + reason comment + App Bug Registry |
| Auth Expired | Redirected to /login | **Flaky** | Re-run auth.setup |
| Selector Not Found | Element not found | **Test Bug** | → Phase 2 |
| Assertion Mismatch | Wrong content | **Ambiguous** | → Phase 2 |
| Timeout | waitFor timeout | **Flaky** | Retry isolated |
| Same test: fails in suite, passes isolated | — | **RAFT** | `test.fixme()` in suite + reason comment, note in report |

**Batch Detection**: When ≥2 tests fail with same route + error type, check console/network first. If backend error → all App Bug (1 entry). If timeout → check RAFT. If all same root cause → bulk classify.

**App Bug Registry**: `openspec/reports/app-bug-registry.md`. For each App Bug, append row (#, Test, Route, Signal, Date, Status). Never delete rows — resolved bugs change status to `resolved`.

**Phase 2 — Repair** (for Test Bug / Ambiguous):

2-0. **Batch diagnosis**: Read failing test specs + app-knowledge.md fixes. Output per test: TEST, ROUTE, ASSERTION, EXPECTED_BEHAVIOR, KNOWN_FIX. Classify: `ready-to-fix` / `needs-assertion-fix` / `needs-phase3` / `needs-more-diagnosis`.

2-1. **Navigate + snapshot**: ASSERTION vs ACTUAL comparison. Safe to fix without Phase 3 (selector-level only): selector typo, moved element, selector drift — the assertion's expected value is unchanged and the test still asserts the same behavior. **Never fix without Phase 3** (human decision — options (b)/(c) below): behavior changed after an action, data values differ, elements missing after interaction, or requirement drift (the OpenSpec requirement changed and the assertion now contradicts it — the assertion update itself is always a Phase 3 decision).

2-5. **Selector repair**: Pick per the selector priority (Testing Principles — single source of truth): verified selector from app-exploration.md > `[data-testid]` (getByTestId) > getByRole > getByLabel > getByText > CSS id/class > positional. If the `playwright-test` MCP exposes `browser_generate_locator`, use it to generate and validate the candidate against the live page before rewriting.

2-6. **Fix + verify**: Apply fix → verify via the test-runner MCP tools when available (`test_list` → `test_debug` (pass the test id from `test_list`) → repair → `test_run` with `locations` scoped to the single test file for structured results; fall back to `npx playwright test --grep "<test-name>"` if the playwright-test MCP server is not configured) → if passes, log to app-knowledge.md (Selector Fixes / Assertion Fixes). Max 3 heal attempts per test. **One error per round**: fix a single error, re-run, then address the next.

2-7. **Log**: Append healed selector/assertion to `app-knowledge.md`. Auto-de-duplicate by Route + Old Selector (selectors) or Test + Old Assertion (assertions).

**Phase 3 — Escalate** (after ≥3 heals or ambiguous comparison): STOP and output:
```
E2E Test Failed — Human Decision Required
Test: <name> | Failure: <type>
Assertion: "<expected>" | Actual: "<actual>"
Options: (a) Fix app, (b) Update spec, (c) Update assertion, (d) Skip
```

Wait for user input. Track escalation attempts — if 3 consecutive Phase 3 with no progress, STOP and flag.

**Healer guardrails** (non-negotiable during autonomous repair; aligned with the official Playwright healer):
- **One error per round**: fix a single error, re-run (`test_run` or `npx playwright test --grep`), then move to the next. Never batch multiple repairs.
- **Honest failure exit**: if the test logic is verified correct and the failure persists, the product behavior is wrong — mark the test `test.fixme()` with a comment before the failing step explaining ACTUAL vs EXPECTED behavior. During autonomous repair, **never** loosen assertions, edit expected values, or delete checks to make a failing test pass. (Updating assertions or specs remains a legitimate *human* Phase 3 decision — option (c) below.)
- **No subagent delegation for repair**: never delegate the repair phase to the `playwright-test-healer` subagent, even when installed — its prompt allows editing assertions and expected values without asking. Repair inside this workflow runs only through Phases 1–3 above. (Delegating the Planner/Generator steps IS allowed — see Steps 5–6; you remain accountable for verifying their output against this workflow's rules.)

**Post-heal**: After all Phase 2 tests healed, re-run the healed test file (change mode: `npx playwright test tests/playwright/changes/<name>/<name>.spec.ts`) to confirm the suite is green before reporting. Full regression stays opt-in per the rule at the top of this document.

### 10. Report results

**All mode**: report routes, Page Objects, and the seed result only — omit Healer sections.

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
| No specs (change mode, Step 1) | Blocker | **HARD STOP** — suggest "all" mode |
| app-exploration missing at Step 5 | Recoverable | **SELF-HEAL** — run Step 4, then continue |
| JS errors that break the page or HTTP 5xx during exploration | Blocker | **HARD STOP** |
| Redirect/refresh loop during exploration | App Bug | Skip route → record in registry |
| File already exists | Idempotency | Read first; merge per artifact (exploration: update routes; plan: supplement cases; spec: add/update per requirement; knowledge: append) |
| Test fails (network/backend) | App Bug | `test.fixme()` + registry |
| Test fails (selector/assertion) | Test Bug | Healer Phase 1→2 (≤3 attempts) |
| RAFT detected | Flaky | `test.fixme()` in suite |
| Test plan ready | Human gate | **HARD STOP** — present the plan summary and wait for confirmation (Step 5) |
| Phase 3 escalation | Human needed | **HARD STOP** — wait for user |
| ≥3 active App Bugs | Warning | Add accumulation warning to report |

## Guardrails

| Rule | Why |
| ---- | --- |
| Read specs as source of truth | Generated tests must match requirements |
| Step 4 before Step 6 | Real DOM data → accurate selectors |
| Never contradict specs | E2E validates implementation, not design |
| Cap heal at 3 attempts per test | Prevents infinite loops |
| Write runnable code, not TODOs | Placeholders fail CI |

**Write scope**: `tests/playwright/` (specs, Page Objects, auth, credentials, app-knowledge.md, screenshots), `playwright/.auth/` (storageState written by auth.setup.ts), `openspec/changes/<name>/specs/playwright/` (exploration, test plan), `<root>/app-exploration.md` (all mode), `openspec/reports/` (reports, bug registry), `playwright.config.ts`, `auth.setup.ts`. **Never write to any other directory.**
