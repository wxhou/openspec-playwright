# Test Plan: <change-name>

Generated from: `openspec/changes/<change-name>/specs/`

## Auth Requirements

<!-- Mark auth requirements based on specs analysis: -->
- Auth required: **yes / no**
- Roles needed: none / user / admin / user+admin

## Test Cases

### <test-name>

- **Route**: `/<page>`
- **Role**: `@role(<role>)`
- **Auth**: `@auth(required|none)`

**Happy path:**
- Step 1: ...
- Step 2: ...

**Error paths:**
- ...

## Special Element Test Cases

### Canvas — 2D Rendering

- **Route**: `/<page>`
- **Role**: `@role(<role>)`
- **Auth**: `@auth(required|none)`
- **Type**: `canvas-2d`
- **Element**: `<canvas id="...">` or `canvas`

**Test approach:**
1. Navigate to page
2. Assert canvas visible + dimensions > 0
3. (Optional) Screenshot for baseline archive

**Assertions:**
- `canvas.boundingBox().width > 0`
- Screenshot archived for manual review

### Canvas — WebGL Rendering

- **Route**: `/<page>`
- **Type**: `canvas-webgl`
- **Element**: `<canvas>` with WebGL context

**Test approach:**
1. Navigate to page
2. Assert canvas visible + correct dimensions
3. Screenshot (no pixel comparison — rendering may vary)

### Iframe — Content Accessible

- **Route**: `/<page>`
- **Type**: `iframe`
- **Element**: `<iframe name="..." src="...">`

**Test approach:**
1. Navigate to page
2. Use `frameLocator` to switch context
3. Assert element inside iframe is visible

### Rich Text Editor — Content Persists

- **Route**: `/<page>`
- **Type**: `contenteditable`
- **Element**: `[contenteditable]`, CodeMirror, Monaco

**Test approach:**
1. Navigate to page
2. Click editor → type content
3. Evaluate `textContent` or `innerHTML`
4. Assert content matches input

### Video — Playback Control

- **Route**: `/<page>`
- **Type**: `video`
- **Element**: `<video>`

**Test approach:**
1. Navigate to page
2. Call `video.play()` via `page.evaluate()`
3. Assert `!video.paused`

### Audio — Playback Control

- **Route**: `/<page>`
- **Type**: `audio`
- **Element**: `<audio>`

**Test approach:**
1. Navigate to page
2. Call `audio.play()` via `page.evaluate()`
3. Assert `!audio.paused`

## AI-Opaque Elements: Out of Scope for Automation

<!-- Elements that AI cannot reliably interact with. Mark in `app-exploration.md` → Special Elements table. -->

### CAPTCHA — Human Verification Required

- **Route**: `/<page>`
- **Type**: `captcha-image | captcha-slider | captcha-3d | recaptcha | hcaptcha | turnstile`
- **Element**: `<canvas id="...">`, `.g-recaptcha`, `.h-captcha`, `[data-sitekey]`, slider track

**Automation strategy — choose one:**

#### Strategy A: Auth-Setup Bypass (Recommended)
Use pre-authenticated sessions from `auth.setup.ts` so CAPTCHA is bypassed before the test runs.

```
1. Store authenticated storageState in auth.setup.ts
2. In test: use storageState to skip login
3. Verify post-CAPTCHA state via API instead
4. Assert: API response after CAPTCHA = expected state
```

**Example assertions:**
- `API POST /submit-form` returns 200 + `success: true`
- UI redirects to `/dashboard` after CAPTCHA pass
- Database record created with correct values

#### Strategy B: Skip with /handoff
If CAPTCHA is the primary interaction under test, mark as non-automatable:

```
test.skip('<feature> requires CAPTCHA', async ({ page }) => {
  // Human reviewer must manually pass CAPTCHA
  // Then run: npx playwright test --grep "<feature>"
});
```

#### Strategy C: API Verification Only
Test the result of CAPTCHA-protected actions without automating the CAPTCHA:

```
1. Manually pass CAPTCHA once → capture resulting session/token
2. Use that session in subsequent API calls
3. Assert: API behavior matches CAPTCHA-passed state
```

**Detected CAPTCHA type** (fill in based on `app-exploration.md`):
- Type: `<!-- image | slider | 3d-object | recaptcha | hcaptcha | turnstile -->`
- Bypass method: `<!-- auth.setup | skip | api-only -->`
- Verified by: `<!-- human-manual | api-response | db-state -->`

---

### OTP / SMS Verification — Test Account Bypass

- **Route**: `/<page>`
- **Type**: `otp-sms | otp-email | totp`
- **Element**: 6-digit input, countdown timer, resend button

**Automation strategy:**

#### Strategy A: Test Credentials (Recommended)
Use pre-verified test accounts with known OTP codes.

```
1. Set E2E_OTP_CODE=<valid-test-code> in credentials.yaml
2. In test:
   await page.getByRole('textbox').fill(process.env.E2E_OTP_CODE);
   await page.getByRole('button', { name: 'Verify' }).click();
```

#### Strategy B: Development Bypass Flag
If dev mode disables OTP, use that flag.

```
1. Set BASE_URL to dev environment with OTP disabled
2. Proceed as normal authenticated user
```

#### Strategy C: API-Only Verification
Bypass OTP UI entirely and test the protected endpoint directly.

```
1. Obtain valid token via API (skip OTP step)
2. Use token in subsequent API calls
3. Assert: protected endpoint returns expected data
```

---

### File Upload — Complex Input

- **Route**: `/<page>`
- **Type**: `file-upload`
- **Element**: `<input type="file">`, drag-and-drop zone

**Test approach:**
```
1. Create test fixture file: `test fixtures/login-hero.png`
2. Set `accept: '<mime-type>'` if specified
3. Use `page.setInputFiles()` for reliable upload
4. Assert: upload progress completes → success message or preview
```

**Assertions:**
- Upload progress bar completes (if shown)
- File preview renders correctly
- API response contains uploaded file reference

---

### Drag-and-Drop — Custom Implementation

- **Route**: `/<page>`
- **Type**: `drag-drop`
- **Element**: `[draggable]`, `.drop-zone`, sortable list items

**Test approach:**
```
1. Identify drag handle and drop target via /browse snapshot
2. Use `page.dragAndDrop()` or `locator.dragTo()`
3. If custom implementation uses JS events, use `page.evaluate()` to dispatch events
4. Assert: target state reflects the drag result
```

**Note**: If the drag-drop uses complex physics (e.g., Kanban board, calendar), prefer `page.evaluate()` with custom event dispatching over `dragAndDrop()`.

---

### WebSocket / Real-Time — Timing Sensitive

- **Route**: `/<page>`
- **Type**: `websocket | sse | polling`
- **Element**: live data display, notification badge, live chart

**Test approach:**
```
1. Establish WebSocket/SSE connection via page
2. Wait for specific message/event: `await page.waitForResponse(/<ws-endpoint>/)`
3. Assert: DOM updates after message received
4. Use `page.waitForFunction()` to poll for expected state
```

**Assertions:**
- Live data counter increments after server push
- Notification badge shows correct count
- Chart redraws with new data points

**Note**: Increase test timeout for real-time tests. See `playwright.config.ts` → `timeout`.

---

> **Reference**: See `app-exploration.md` → **Special Elements Detected** table for per-route specifics.
