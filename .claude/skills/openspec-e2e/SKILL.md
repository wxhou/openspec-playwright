---
name: openspec-e2e
description: Run Playwright E2E verification for an OpenSpec change. Use when the user wants to validate that the implementation works end-to-end by running Playwright tests generated from the specs.
license: MIT
compatibility: Requires openspec CLI, Playwright (with browsers installed), and @playwright/mcp (globally installed via `claude mcp add playwright npx @playwright/mcp@latest`).
metadata:
  author: openspec-playwright
  version: "2.8"
---

## Input

- **Change name**: `/opsx:e2e <name>` or auto-detected from context
- **Specs**: `openspec/changes/<name>/specs/*.md`
- **Credentials**: `E2E_USERNAME` + `E2E_PASSWORD` env vars

## Output

- **Test file**: `tests/playwright/<name>.spec.ts`
- **Auth setup**: `tests/playwright/auth.setup.ts` (if auth required)
- **Report**: `openspec/reports/playwright-e2e-<name>-<timestamp>.md`
- **Test plan**: `openspec/changes/<name>/specs/playwright/test-plan.md`

## Architecture

Pipeline: **Planner** (Step 4) → **Generator** (Step 5) → **Healer** (Step 8).

Uses CLI + SKILLs (not `init-agents`). CLI is ~4x more token-efficient than loading MCP tool schemas. MCP is used only for Healer (UI inspection on failure).

**Schema owns templates. CLI handles execution. Skill handles cognitive work.**

## Steps

### 1. Select the change

If a name is provided (e.g., `/opsx:e2e add-auth`), use it. Otherwise:
- Infer from conversation context if the user mentioned a change
- Auto-select if only one active change exists
- If ambiguous, run `openspec list --json` and use the **AskUserQuestion tool** to let the user select

After selecting, announce: "Using change: `<name>`" and how to override.

Verify specs exist:
```bash
openspec status --change "<name>" --json
```
If `openspec/changes/<name>/specs/` is empty, inform the user and stop. E2E requires specs.

### 2. Read specs and detect auth

Read all files from `openspec/changes/<name>/specs/*.md`. Extract functional requirements.

Detect if auth is required only when BOTH conditions are met:

**Condition A — Explicit markers**: "login", "signin", "logout", "authenticate", "protected", "authenticated", "session", "unauthorized"

**Condition B — Context indicators**: Protected routes ("/dashboard", "/profile", "/admin"), role mentions ("admin", "user"), redirect flows

**Exclude false positives** — HTTP header examples (`Authorization: Bearer ...`) and code snippets do not count.

**Confidence levels**:
- High (auto-proceed): Multiple explicit markers AND context indicators
- Medium (proceed with note): Single explicit marker, context unclear
- Low (skip auth): No explicit markers found

### 3. Validate environment

Run the seed test before generating tests:
```bash
npx playwright test tests/playwright/seed.spec.ts --project=chromium
```

This validates: app server reachable, auth fixtures initialized, Playwright working.

**If seed test fails**: Stop and report. Fix the environment before proceeding.

### 4. Generate test plan

Create `openspec/changes/<name>/specs/playwright/test-plan.md`:
- List each functional requirement as a test case
- Mark with `@role(user|admin|guest|none)` and `@auth(required|none)`
- Include happy path AND error paths
- Reference the route/page each test targets

**Idempotency**: If test-plan.md already exists → read it, use it, do NOT regenerate.

### 5. Generate test file

Create `tests/playwright/<name>.spec.ts`:

**Read inputs first**:
- `openspec/changes/<name>/specs/playwright/test-plan.md`
- `tests/playwright/seed.spec.ts`

**Generate** Playwright code for each test case:
- Follow `seed.spec.ts` structure
- Prefer `data-testid`; fallback to `getByRole`, `getByLabel`, `getByText`
- Include happy path AND error/edge cases
- Use `test.describe(...)` for grouping
- Each test: `test('描述性名称', async ({ page }) => { ... })`

#### Anti-Pattern Warnings

**🚫 False Pass** — never silently skip when element is missing:
```typescript
// WRONG
if (await btn.isVisible().catch(() => false)) { ... }
// ✅ CORRECT
await expect(page.getByRole('button', { name: '取消' })).toBeVisible();
```

**🚫 Permission filtering** — use `@tag` with `--grep`, not projects:
```typescript
test('admin only', { tag: '@admin' }, async ({ page }) => { ... });
// Run with: npx playwright test --grep "@admin"
```

**🚫 Auth guard** — test with FRESH browser context (no inherited cookies):
```typescript
test('redirects unauthenticated user to login', async ({ browser }) => {
  const freshPage = await browser.newContext().newPage();
  await freshPage.goto(`${BASE_URL}/dashboard`);
  await expect(freshPage).toHaveURL(/login|auth/);
});
```

#### Playwright API Guardrails

These are the most common mistakes that cause test failures. **Always follow these rules:**

**API calls — use `request` API, NOT `page.evaluate()`:**
```typescript
// ❌ WRONG — page.evaluate timeout, wrong context, CORS issues
const result = await page.evaluate(async () => {
  const res = await fetch('/api/data');
  return res.json();
});

// ✅ CORRECT — direct HTTP, no browser context, fast
const res = await page.request.get(`${BASE_URL}/api/data`);
expect(res.status()).toBe(200);
const data = await res.json();
```

**Browser context cleanup — `dispose()` NOT `close()`:**
```typescript
// ❌ WRONG — close() is not a function on APIRequestContext
const ctx = await page.request.newContext();
await ctx.dispose(); // actually correct, but this is CommonContext
const context = await browser.newContext();
await context.close(); // ← WRONG

// ✅ CORRECT
const context = await browser.newContext();
await context.close(); // close() is correct for BrowserContext

// For APIRequestContext (from page.request):
// No cleanup needed — it's managed by Playwright automatically
```

**File uploads — use `setInputFiles()`, NOT `page.evaluate()` + fetch:**
```typescript
// ❌ WRONG
await page.evaluate(() => {
  const input = document.querySelector('input[type=file]');
  // ...
});

// ✅ CORRECT
await page.locator('input[type="file"]').setInputFiles('/path/to/file.pdf');
```

**Form submissions — prefer Playwright locators, not JS clicks:**
```typescript
// ❌ WRONG — bypasses Playwright's actionability checks
await page.evaluate(() => document.querySelector('button[type=submit]').click());

// ✅ CORRECT — respects visibility, enabled, stable
await page.getByRole('button', { name: 'Submit' }).click();
```

**Always include error path tests** — API 500, 404, network timeout, invalid input.

If the file exists → diff against test-plan, add only missing test cases.

### 6. Configure auth (if required)

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

### 7. Configure playwright.config.ts

If missing → generate from `openspec/schemas/playwright-e2e/templates/playwright.config.ts`.

**Auto-detect BASE_URL** (in priority order):
1. `process.env.BASE_URL` if already set
2. `tests/playwright/seed.spec.ts` → extract `BASE_URL` value
3. Read `vite.config.ts` (or `vite.config.js`) → extract `server.port` + infer protocol (`https` if `server.https`, else `http`)
4. Read `package.json` → `scripts.dev` or `scripts.start` → extract port from `--port` flag
5. Fallback: `http://localhost:3000`

**Auto-detect dev command**:
1. `package.json` → scripts in order: `dev` → `start` → `serve` → `preview` → `npm run dev`

If playwright.config.ts exists → READ first, preserve ALL existing fields, add only missing `webServer` block.

### 8. Execute tests

```bash
openspec-pw run <name> --project=<role>
```

The CLI handles: server lifecycle, port mismatch, report generation.

If tests fail → use Playwright MCP tools to inspect UI, fix selectors, re-run.

**Healer MCP tools** (in order of use):
<!-- MCP_VERSION: 0.0.68 -->

| Tool | Purpose |
|------|---------|
| `browser_navigate` | Go to the failing test's page |
| `browser_snapshot` | Get page structure to find equivalent selectors |
| `browser_console_messages` | Diagnose JS errors that may cause failures |
| `browser_take_screenshot` | Visually compare before/after fixes |
| `browser_run_code` | Execute custom fix logic (optional) |

**Healer workflow**:
1. Read the failing test → identify failure type
2. Classify:

| Failure type | Signal | Action |
|-------------|--------|--------|
| **Network/backend** | `fetch failed`, `net::ERR`, 5xx | `browser_console_messages` → `test.skip()` |
| **Selector changed** | Element not found | `browser_snapshot` → fix selector → re-run |
| **Assertion mismatch** | Wrong content/value | `browser_snapshot` → compare → fix assertion → re-run |
| **Timing issue** | `waitFor`/`page.evaluate` timeout | Switch to `request` API or add `waitFor` → re-run |
| **Wrong API usage** | `ctx.close is not a function` | Fix: `browser.newContext()` → `close()`; `request.newContext()` → no cleanup needed |
| **Auth expired** | 401 Unauthorized | Token may have expired — if long suite, recommend splitting or re-auth |
| **page.evaluate failure** | `fetch` in browser context, CORS errors | Switch to `page.request` API → re-run |

3. **Attempt heal** (≤3 times): snapshot → fix → re-run
4. **After 3 failures**: collect evidence checklist → `test.skip()` if app bug, report recommendation if test bug

### 9. False Pass Detection

Run after test suite completes (even if all pass):

- **Conditional logic**: Look for `if (locator.isVisible().catch(() => false))` — if test passes, locator may not exist
- **Too fast**: < 200ms for a complex flow is suspicious
- **No fresh auth context**: Protected routes without `browser.newContext()`

Report any gaps in a **⚠️ Coverage Gap** section.

### 10. Report results

Read report at `openspec/reports/playwright-e2e-<name>-<timestamp>.md`. Present:
- Summary table (tests, passed, failed, duration, status)
- Auto-heal notes
- Recommendations with `file:line` references

**Update tasks.md** if all tests pass: find E2E-related items, append `✅ Verified via Playwright E2E (<timestamp>)`.

## Report Structure

```markdown
# Playwright E2E Report — <name>

## Summary
| Tests | Passed | Failed | Duration | Status |
|-------|--------|--------|----------|--------|
| N     | N      | N      | Xm Xs    | ✅/❌   |

## Results
### Passed
| Test | Duration | Notes |
|------|----------|-------|
| ...  | ...      | ...   |

### Failed
| Test | Error | Recommendation |
|------|-------|----------------|
| ...  | ...   | file:line — fix |

## Auto-Heal Log
- Attempt N: selector fix → result

## Coverage
- [x] Requirement 1
- [ ] Requirement 2 (unverified)

## ⚠️ Coverage Gaps
> Tests passed but coverage gaps detected.

| Test | Gap | Recommendation |
|------|-----|----------------|
| ... | Conditional visibility check | file:line — use `expect().toBeVisible()` |
| ... | Auth guard uses inherited session | Add fresh context test |
| ... | Suspiciously fast execution (<200ms) | Verify test logic executed |
```

## Graceful Degradation

| Scenario | Behavior |
|----------|----------|
| No specs | Stop — E2E requires specs |
| Seed test fails | Stop — fix environment |
| No auth required | Skip auth setup |
| test-plan.md exists | Read and use (never regenerate) |
| auth.setup.ts exists | Verify format (update only if stale) |
| playwright.config.ts exists | Preserve all fields (add only missing) |
| Test fails (backend) | `test.skip()` + report |
| Test fails (selector/assertion) | Healer: snapshot → fix → re-run (≤3) |
| 3 heals failed | Evidence checklist → app bug: `test.skip()`; unclear: report |
| False pass detected | Add "⚠️ Coverage Gap" to report |

## Guardrails

- Read specs from `openspec/changes/<name>/specs/` as source of truth
- Do NOT generate tests that contradict the specs
- **DO generate real, runnable Playwright test code** — not placeholders or TODOs
- Do NOT overwrite files outside: `specs/playwright/`, `tests/playwright/`, `openspec/reports/`, `playwright.config.ts`
- Cap auto-heal at 3 attempts
- If no change specified → always ask user to select
