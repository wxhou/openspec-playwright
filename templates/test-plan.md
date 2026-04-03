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

> **Reference**: See `app-exploration.md` → **Special Elements Detected** table for per-route specifics.
