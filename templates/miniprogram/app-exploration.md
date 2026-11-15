# App Exploration — <change-name>

Generated: <timestamp>
Target: miniprogram
Project: <wxaProject path>

## Exploration Summary

| Page | Entry | Auth | Status | Ready Signal |
|------|-------|------|--------|--------------|
| pages/index/index | entryPagePath | none | ✅ explored | `waitForPage('pages/index/index')` |
| pages/detail/detail | navigateTo from index | required | ✅ explored | `pageData()` has `id` |

## Page: <pages/...>

- **Auth**: none / preset in `wxa.setup.ts`
- **Open**: `miniProgram.open('<page>?<query>')`
- **Ready signal**: `waitForPage('<page>')` or a `pageData()` field
- **Screenshot**: `tests/playwright/screenshots/<page-slug>.png`

### Interactive Elements (from real rendered DOM)

Read the page DOM from the runner's active iframe (`iframe[data-current]` →
`/__wxa__/webview/<page>.html`); verified against wxa-runner 0.13.1.

| Element | Selector | Notes |
|---------|----------|-------|
| submit | `getByText('提交')` or `#submit` | |
| list item | `.item` | |

### Page Data

| Field | Meaning | Used by |
|-------|---------|---------|
| | | |

### Navigation Context

- How to reach this page: <home / navigateTo from ... / switchTab>
- Page stack after open: <paths>

### Dynamic Content Notes

- <observed dynamic values; prefer `toHavePageData` with the stable subset>

## Exploration Failures

| Page | Error | Notes |
|------|-------|-------|
| | | |

## Visual Anomalies

| Page | Element | Type | Position | Severity | Description |
| --- | --- | --- | --- | --- | --- |
| | | | | | |

## Limitations

Browser runs use the built-in base library 3.7.0 and an older compiler; a page that passes here is not proof of real-device behavior.

## Next Steps

Pass this file to Step 5 (Planner) and Step 6 (Generator). Extract project-level patterns into `tests/playwright/app-knowledge.md`.
