# App Knowledge — <project-name>

Generated: <timestamp>
Last updated: <timestamp>

Cross-change E2E knowledge. Updated by Step 4 exploration, read by Step 5/6.

## Credential Format

| Field | Format | Source |
|-------|--------|--------|
| username | `<pattern>` | e.g. `email@example.com` or `test_user_001` |
| password | `<pattern>` | |
| login endpoint | `<path>` | e.g. `/api/auth/login` |

## Common Selector Patterns

Priority: `[data-testid]` > `getByRole` > `getByLabel` > `getByText` > CSS

### Forms

| Element | Selector | Notes |
|---------|----------|-------|
| submit btn | `[data-testid="..."]` or `getByRole('button', { name: '...' })` | |
| text input | `getByLabel('...')` or `[data-testid="..."]` | |
| password input | `getByLabel('...')` or `[name="..."]` | |

### Navigation

| Element | Selector | Notes |
|---------|----------|-------|
| nav link | `a:text("...")` or `nav >> text=...` | |
| logout btn | `[data-testid="logout-btn"]` | |

### Feedback

| Element | Selector | Notes |
|---------|----------|-------|
| error msg | `[data-testid="error-msg"]` or `.error` | |
| success msg | `[data-testid="success-msg"]` | |
| loading spinner | `[data-testid="loading"]` | |

## Architecture

| Aspect | Value | Notes |
|--------|-------|-------|
| Architecture | monolith / separated | Frontend + backend in one repo or separate? |
| Backend server | `<port>` or `embedded` | e.g. `3001` or `embedded in frontend` |
| How to restart backend | `<command>` | e.g. `cd backend && npm run dev` |

## SPA Routing

- Framework: <e.g. React Router / Vue Router / Next.js>
- URL changes without page reload: <yes/no>
- History API: <yes/no>
- Hash routing: <yes/no>

## Dynamic Content Conventions

- User-specific data: use `toContainText`, never `toHaveText`
- Timestamps: normalize or use regex
- Random IDs: avoid asserting on auto-generated values
- Pagination: test first/last page, boundary conditions

## Project Conventions

| Convention | Value | Notes |
|------------|-------|-------|
| BASE_URL | `<default>` | Override with env |
| auth method | API / UI | See auth.setup.ts |
| multi-user roles | `<roles>` | e.g. admin, user, guest |

## Changelog

| Date | Change | By |
|------|--------|-----|
| | | |

---

> **Updating this file**: After each E2E exploration (Step 4), extract new shared patterns and update this file. Generator (Step 6) reads this before writing tests.
