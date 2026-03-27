---
name: openspec-e2e
description: Run Playwright E2E verification for an OpenSpec change. Use when the user wants to validate that the implementation works end-to-end by running Playwright tests generated from the specs.
license: MIT
compatibility: Requires openspec CLI, Playwright (with browsers installed), and @playwright/mcp (globally installed via claude mcp add).
metadata:
  author: openspec-playwright
  version: "2.0"
---

Run Playwright E2E verification for an OpenSpec change. This skill reads specs from `openspec/changes/<name>/specs/`, generates test files, detects auth requirements, and delegates test execution to the `openspec-pw run` CLI.

**Architecture**: Schema owns templates. CLI handles execution. Skill handles cognitive work.

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

Detect if auth is required. Mark as **auth required** only when BOTH conditions are met:

**Condition A — Explicit markers**: "login", "signin", "logout", "authenticate", "protected", "authenticated", "session", "unauthorized"

**Condition B — Context indicators**: Protected routes ("/dashboard", "/profile", "/admin"), role mentions ("admin", "user"), redirect flows

**Exclude false positives** — HTTP header examples (`Authorization: Bearer ...`) and code snippets do not count.

**Confidence levels**:
- High (auto-proceed): Multiple explicit markers AND context indicators
- Medium (proceed with note): Single explicit marker, context unclear
- Low (skip auth): No explicit markers found

### 3. Generate test plan

Create `openspec/changes/<name>/specs/playwright/test-plan.md` by:
- Listing each functional requirement as a test case
- Marking each with `@role(user|admin|guest|none)` and `@auth(required|none)`
- Including happy path AND key error paths
- Referencing the route/page each test targets

**Idempotency**: If test-plan.md already exists → read it, use it, do NOT regenerate unless user explicitly asks.

### 4. Generate test file

Create `tests/playwright/<name>.spec.ts`:
- Follow the page object pattern from `tests/playwright/seed.spec.ts`
- Prefer `data-testid` selectors, fall back to semantic selectors
- Each test maps to one test case from the test-plan
- Use `@project(admin)` / `@project(user)` for role-specific tests
- Cover happy path AND key error paths

**Idempotency**: If test file exists → diff against test-plan, add only missing test cases, preserve existing implementations.

### 5. Configure auth (if required)

If auth is required:

**API login**: If specs mention `/api/auth/login` or similar → generate `tests/playwright/auth.setup.ts` using API login with `E2E_USERNAME`/`E2E_PASSWORD`.

**UI login**: Otherwise → generate `tests/playwright/auth.setup.ts` using UI login. Update selectors to match the login page (look for `data-testid` attributes or fallback to `input[name="..."]`).

**Multi-user**: If specs mention multiple roles (admin + user) → generate separate `auth.setup.ts` blocks for each role with different `storageState` paths.

**Prompt user** with:
```
Auth required. To set up credentials:

1. Customize tests/playwright/credentials.yaml with your test user
2. Export: export E2E_USERNAME=xxx E2E_PASSWORD=yyy
3. Run auth: npx playwright test --project=setup
4. Then re-run /opsx:e2e to execute tests
```

**Idempotency**: If `auth.setup.ts` already exists → verify format, update only if stale.

### 6. Configure playwright.config.ts (non-destructive)

If `playwright.config.ts` does not exist → generate it from the schema template at `openspec/schemas/playwright-e2e/templates/playwright.config.ts`. The template auto-detects:
- **BASE_URL**: from `process.env.BASE_URL`, falling back to `tests/playwright/seed.spec.ts` → `BASE_URL` value, then `http://localhost:3000`
- **Dev command**: from `package.json` → scripts in order: `dev` → `start` → `serve` → `preview` → `npm run dev`

If `playwright.config.ts` exists → READ it first. Extract existing `webServer`, `use.baseURL`, and `projects`. Preserve ALL existing fields. Add `webServer` block if missing. Do NOT replace existing config values.

### 7. Execute tests via CLI

```bash
openspec-pw run <name> --project=<role>
```
(Add `--project=user` or `--project=admin` for role-specific tests.)

The CLI handles:
- Server lifecycle (start → wait for HTTP → test → stop)
- Port mismatch detection
- Report generation at `openspec/reports/playwright-e2e-<name>-<timestamp>.md`

If tests fail → analyze failures, use Playwright MCP tools to inspect UI state, fix selectors in the test file, and re-run.

**Cap auto-heal attempts at 3** to prevent infinite loops.

### 8. Report results

Read the report generated by `openspec-pw run` and present it to the user:
- Summary table (tests run, passed, failed, duration, final status)
- Any auto-heal notes
- Recommendations for failed tests (with specific file:line references)

---

## Verification Heuristics

- **Coverage**: Every functional requirement → at least one test
- **Selector robustness**: Prefer `data-testid`, fallback to semantic selectors
- **False positives**: If test fails due to test bug (not app bug) → fix the test
- **Actionability**: Every failed test needs a specific recommendation

## Guardrails

- Read specs from `openspec/changes/<name>/specs/` as source of truth
- Do NOT generate tests that contradict the specs
- Do NOT overwrite files outside: `specs/playwright/`, `tests/playwright/`, `openspec/reports/`, `playwright.config.ts`, `tests/auth.setup.ts`
- Cap auto-heal at 3 attempts
- If no change specified → always ask user to select
