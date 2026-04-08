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

### Two Verification Layers

| Layer | Command | What it checks |
|-------|---------|----------------|
| Static | `/opsx:verify` | Implementation matches artifacts |
| E2E | `/opsx:e2e` | App works when running |

## Prerequisites

1. **Node.js >= 20**
2. **OpenSpec** initialized: `npm install -g @fission-ai/openspec && openspec init`
3. **One of 5 editors**: Claude Code, Cursor, Cline, Gemini CLI, GitHub Copilot (auto-detected)
4. **Claude Code only**: Playwright MCP — `claude mcp add playwright npx @playwright/mcp@latest`

## What `openspec-pw init` Does

1. Detects installed AI coding assistants (all 5 supported editors)
2. Installs E2E command/workflow files for each detected editor
3. Installs `/openspec-e2e` skill for Claude Code
4. Installs Playwright MCP globally for Claude Code (via `claude mcp add`)
5. Generates `tests/playwright/seed.spec.ts`, `auth.setup.ts`, `credentials.yaml`, `app-knowledge.md`

> **Note**: After running `openspec-pw init`, manually install Playwright browsers: `npx playwright install --with-deps`

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

### MCP server (Claude Code only)

Playwright MCP is installed globally via `claude mcp add` and enables the Healer Agent (auto-heals test failures via UI inspection). Restart Claude Code after setup to activate.

## Architecture

```
Templates (in npm package, installed to .claude/skills/openspec-e2e/templates/)
  └── test-plan.md, report.md, playwright.config.ts, e2e-test.ts, app-exploration.md

CLI (openspec-pw)
  ├── init       → Installs commands, skill & templates to .claude/
  ├── update     → Syncs commands, skill & templates from npm
  ├── run        → Executes E2E tests with server lifecycle
  ├── verify     → Checks implementation against artifacts
  └── doctor     → Checks prerequisites

Skill/Commands (per editor)
  ├── Claude Code → /opsx:e2e (skill) + /opsx:e2e (command) + MCP
  ├── Cursor      → /opsx-e2e (command)
  ├── Cline      → /opsx-e2e (workflow)
  ├── Gemini CLI → /opsx-e2e (command)
  └── GitHub Copilot → /opsx-e2e (command)

Test Assets (tests/playwright/)
  ├── seed.spec.ts       → Env validation
  ├── auth.setup.ts      → Session recording
  ├── credentials.yaml   → Test users
  └── app-knowledge.md   → Project-level selector patterns (cross-change)

Exploration (openspec/changes/<name>/specs/playwright/)
  ├── app-exploration.md → This change's routes + verified selectors
  └── test-plan.md       → This change's test cases

Healer Agent (Claude Code + MCP only)
  └── browser_snapshot, browser_navigate, browser_run_code, etc.
```

## License

MIT
