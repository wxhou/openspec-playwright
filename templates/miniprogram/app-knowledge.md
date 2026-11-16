# App Knowledge — <project-name>

Generated: <timestamp>
Last updated: <timestamp>

Cross-change E2E knowledge for the mini-program target. Updated by Step 4 exploration, read by Step 5/6.

## Pages

Discovered from the page manifest (`app.json` / `pages.json` / Taro `app.config`).

| Page | Entry | Auth | Page Object | Notes |
|------|-------|------|-------------|-------|
| pages/index/index | entryPagePath | guest | `HomePage.ts` | |
| pages/detail/detail | navigateTo | required | `DetailPage.ts` | |

## Exploration State

Written by Step 4 (idempotency): skip full re-exploration when the page manifest is unchanged.

| Field | Value |
|-------|-------|
| Last manifest hash | `<sha>` |
| Last exploration | `<timestamp>` |
| Pages known | `<N>` |

## Setup

Login state and native API stubs live in `tests/playwright/wxa.setup.ts`. Do not write `storageState` or `auth.setup.ts` for this target.

## Common Selector Patterns

Priority: verified selector from app-exploration.md > getByRole > getByLabel > getByText > `[data-testid]` > CSS id/class > positional. Selectors are resolved inside `miniProgram.current`.

## Limitations

Browser runs use base library 3.7.0 and an older compiler; passing here is not proof of real-device behavior.
