# Test Plan: <change-name>

Generated from: `openspec/changes/<change-name>/specs/`

## Auth Requirements

- Auth required: **yes / no**
- Preset in: `tests/playwright/wxa.setup.ts` (`storage` / `network.routes`)

## Test Cases

<!-- One case per `#### Scenario:` in the delta specs. Keep the exact scenario
     title in the heading so `openspec-pw coverage --plan` can match it. -->

### <scenario-title>

- **Page**: `pages/<name>/<name>`
- **Role**: `@role(<role>)`
- **Auth**: `@auth(required|none)`
- **Data**: prepare via `wxa.setup.ts` or `miniProgram.mock` / `miniProgram.route`

**Happy path:**
- Step 1: ...
- Step 2: ...

**Error paths:**
- ...

## Assertions

- Page path: `await expect(miniProgram).toHavePath('<page>')`
- Page data: `await expect(miniProgram).toHavePageData({ ... })` — compiled frameworks rename data keys, so read `pageData()` first and assert only stable keys
- Request: `await miniProgram.waitForRequest('<METHOD pattern>')`
- Runtime errors: checked automatically at the end of each test.

## Limitations

Browser runs use base library 3.7.0 and an older compiler; passing here is not proof of real-device behavior.
