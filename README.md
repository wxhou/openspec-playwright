# OpenSpec + Playwright E2E Verification

[中文说明](./README.zh-CN.md)

A setup tool that integrates OpenSpec's spec-driven development with Playwright's three-agent test pipeline for automated E2E verification.

## Install

```bash
npm install -g https://github.com/wxhou/openspec-playwright/archive/refs/heads/main.tar.gz
```

## Setup

```bash
# In your project directory
openspec init              # Initialize OpenSpec
openspec-pw init          # Install Playwright E2E integration
```

## Usage

### In Claude Code

```bash
/opsx:e2e my-feature    # Primary command (OpenSpec convention)
/openspec-e2e           # Alternative from skill
```

### CLI Commands

```bash
openspec-pw init          # Initialize integration (one-time setup)
openspec-pw doctor        # Check prerequisites
```

## How It Works

```
/openspec-e2e <change-name>
  │
  ├── 1. Read OpenSpec specs from openspec/changes/<name>/specs/
  │
  ├── 2. Planner Agent → generates test-plan.md
  │
  ├── 3. Generator Agent → creates tests/playwright/<name>.spec.ts
  │
  └── 4. Healer Agent → runs tests + auto-heals failures
          │
          └── Report: openspec/reports/playwright-e2e-<name>.md
```

### Two Verification Layers

| Layer | Command | What it checks |
|-------|---------|----------------|
| Static | `/opsx:verify` | Implementation matches artifacts |
| E2E | `/opsx:e2e` | App works when running |

## Prerequisites

1. **Node.js >= 20**
2. **OpenSpec** initialized: `npm install -g @fission-ai/openspec && openspec init`
3. **Claude Code** with Playwright MCP configured

## What `openspec-pw init` Does

1. Runs `npx playwright install --with-deps`
2. Runs `npx playwright init-agents --loop=claude`
3. Configures Playwright MCP in `.claude/settings.local.json`
4. Installs `/opsx:e2e` command and `/openspec-e2e` skill
5. Generates `tests/playwright/seed.spec.ts`, `auth.setup.ts`, `credentials.yaml`

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

### MCP server

The Playwright MCP is configured in `.claude/settings.local.json`. Restart Claude Code after setup to activate.

## Architecture

```
openspec-pw (CLI - setup only)
  ├── Installs Playwright agents (.github/)
  ├── Configures Playwright MCP
  ├── Installs Claude Code skill (/openspec-e2e)
  └── Installs command (/opsx:e2e)

/openspec-e2e (Claude Code skill - runs in Claude)
  ├── Reads OpenSpec specs
  ├── Triggers Playwright agents via MCP
  └── Generates E2E verification report
```

## License

MIT
