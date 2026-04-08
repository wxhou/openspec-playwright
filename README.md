# OpenSpec + Playwright E2E Verification

[中文说明](./README.zh-CN.md)

A setup tool that integrates OpenSpec's spec-driven development with Playwright's three-agent test pipeline for automated E2E verification.

## Install

```bash
npm install -g openspec-playwright
```

## Setup

```bash
# In your project directory
openspec init              # Initialize OpenSpec
openspec-pw init          # Install Playwright E2E integration
```

## Supported AI Coding Assistants

Claude Code — E2E workflow is driven by SKILL.md using Playwright MCP tools (`/opsx:e2e <change-name>`).

## Usage

### In Claude Code

```bash
/opsx:e2e <change-name>
```

### CLI Commands

```bash
openspec-pw init          # Initialize integration (one-time setup)
openspec-pw update        # Update CLI and commands to latest version
openspec-pw doctor        # Check prerequisites
openspec-pw uninstall     # Remove integration from the project
```

## How It Works

```
/opsx:e2e <change-name>
  │
  ├── 1. Select change → read openspec/changes/<name>/specs/
  │
  ├── 2. Detect auth → check specs for login/auth markers
  │
  ├── 3. Validate env → run seed.spec.ts
  │
  ├── 4. Explore app → Playwright MCP explores real DOM
  │       ├─ Read app-knowledge.md (project-level knowledge)
  │       ├─ Extract routes from specs
  │       ├─ Navigate each route → snapshot → screenshot
  │       └─ Write app-exploration.md (change-level findings)
  │           └─ Extract patterns → update app-knowledge.md
  │
  ├── 5. Planner → generates test-plan.md
  │
  ├── 6. Generator → creates tests/playwright/<name>.spec.ts
  │       └─ Verifies selectors in real browser before writing
  │
  ├── 7. Configure auth → auth.setup.ts (if required)
  │
  ├── 8. Configure playwright → playwright.config.ts
  │
  ├── 9. Execute tests → openspec-pw run <name>
  │
  ├── 10. Healer (if needed) → auto-heals failures via MCP
  │
  └── 11. Report → openspec/reports/playwright-e2e-<name>.md

## Prerequisites

1. **Node.js >= 20**
2. **OpenSpec** initialized: `npm install -g @fission-ai/openspec && openspec init`
3. **Claude Code** with `.claude/` directory

After prerequisites, install Playwright MCP:
```bash
claude mcp add playwright npx @playwright/mcp@latest
```

## What `openspec-pw init` Does

1. Detects Claude Code in the project
2. Installs E2E command (`/opsx:e2e`) and SKILL.md
3. Syncs Healer tools from latest `@playwright/mcp`
4. Generates `tests/playwright/seed.spec.ts`, `auth.setup.ts`, `credentials.yaml`, `app-knowledge.md`

> **Note**: After running `openspec-pw init`, manually install Playwright browsers: `npx playwright install --with-deps`

## First-Time Setup Checklist

Run through these steps in order when using the E2E workflow for the first time:

| Step | Command | If it fails |
|------|---------|-------------|
| 1. Install CLI | `npm install -g openspec-playwright` | Check Node.js version `node -v` (needs >= 20) |
| 2. Install OpenSpec | `npm install -g @fission-ai/openspec && openspec init` | `npm cache clean -f && npm install -g @fission-ai/openspec` |
| 3. Initialize E2E | `openspec-pw init` | Run `openspec-pw doctor` to see what's missing |
| 4. Install Playwright MCP | `claude mcp add playwright npx @playwright/mcp@latest` | `claude mcp list` to confirm installation |
| 5. Install browsers | `npx playwright install --with-deps` | macOS may need `xcode-select --install` first |
| 6. Start dev server | `npm run dev` (in a separate terminal) | Confirm port, set `BASE_URL` if non-standard |
| 7. Validate env | `npx playwright test tests/playwright/seed.spec.ts` | Check `webServer` in `playwright.config.ts` |
| 8. Configure auth (if needed) | See "Authentication" below | Debug with `npx playwright test --project=setup` |
| 9. Run first E2E | `/opsx:e2e <change-name>` | Check `openspec/reports/` for the report |

## Authentication

If your app requires login, set up credentials once, then all tests run authenticated automatically.

```bash
# 1. Edit credentials
vim tests/playwright/credentials.yaml

# 2. Set environment variables
export E2E_USERNAME=your-email@example.com
export E2E_PASSWORD=your-password

# 3. Record login (one-time — opens browser, log in manually)
npx playwright test --project=setup

# 4. All subsequent tests use the saved session
/opsx:e2e my-feature
```

Supports **API login** (preferred) and **UI login** (fallback). For multi-user tests (admin vs user), add multiple users in `credentials.yaml` and run `/opsx:e2e` — it auto-detects roles from specs.

## Customization

### Customize seed test

Edit `tests/playwright/seed.spec.ts` to match your app's:
- Base URL
- Common selectors
- Page object methods

### Authentication credentials

Edit `tests/playwright/credentials.yaml`:
- Set login API endpoint (or leave empty for UI login)
- Configure test user credentials
- Add multiple users for role-based tests

## Architecture

```
Templates (in npm package, installed to .claude/skills/openspec-e2e/templates/)
  └── test-plan.md, report.md, playwright.config.ts, e2e-test.ts, app-exploration.md

CLI (openspec-pw)
  ├── init       → Installs commands, skill & templates to .claude/
  ├── update     → Syncs commands, skill & templates from npm
  ├── run        → Executes E2E tests with server lifecycle
  └── doctor     → Checks prerequisites

Claude Code (/opsx:e2e)
  ├── .claude/commands/opsx/e2e.md    → Command file
  ├── .claude/skills/openspec-e2e/   → SKILL.md + templates
  └── @playwright/mcp                 → Healer Agent tools

Test Assets (tests/playwright/)
  ├── seed.spec.ts       → Env validation
  ├── auth.setup.ts      → Session recording
  ├── credentials.yaml   → Test users
  └── app-knowledge.md   → Project-level selector patterns (cross-change)

Exploration (openspec/changes/<name>/specs/playwright/)
  ├── app-exploration.md → This change's routes + verified selectors
  └── test-plan.md       → This change's test cases

Healer Agent (@playwright/mcp)
  └── browser_snapshot, browser_navigate, browser_run_code, etc.
```

## License

MIT
