# App Exploration — <change-name>

Generated: <timestamp>
BASE_URL: <from env or seed.spec.ts>

## Exploration Summary

| Route | Auth | Status | Ready Signal |
|-------|------|--------|-------------|
| / | none | ✅ explored | page has heading |
| /login | none | ✅ explored | [data-testid="login-form"] visible |
| /dashboard | required (user) | ✅ explored | [data-testid="page-title"] visible |
| /admin | required (admin) | ✅ explored | [data-testid="admin-panel"] visible |

## Route: <path>

- **Auth**: none / required (storageState: <path>)
- **URL**: ${BASE_URL}<path>
- **Ready signal**: <how to know page is loaded>
- **Screenshot**: `__screenshots__/<path-slug>.png`

### Interactive Elements (from real DOM)

| Element | Selector | Notes |
|---------|----------|-------|
| heading | `[data-testid="..."]` or `h1` | |
| submit btn | `getByRole('button', { name: '...' })` | |
| logout btn | `[data-testid="logout-btn"]` | |
| form | `form >> input[name="..."]` | |
| nav link | `a:text("...")` or `nav >> text=...` | |

### Navigation Context

- How to reach this page: <from homepage / from dashboard / etc.>
- Redirects: <any redirects observed>

### Dynamic Content Notes

- <any dynamic content that was observed>
- <test assertions should use toContainText, not toHaveText for user-specific data>

## Exploration Failures

| Route | Error | Notes |
|-------|-------|-------|
| | | |

## Next Steps

After exploration, pass this file to Step 5 (Planner) and Step 6 (Generator).
