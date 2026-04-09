# OpenSpec + Playwright E2E Integration Design

**Date:** 2026-03-26
**Updated:** 2026-03-27
**Status:** Implemented (MVP)

## Overview

Integrate OpenSpec's spec-driven development workflow with Playwright Test Agents' three-agent harness (Planner / Generator / Healer) for automated E2E verification.

**Design decision:** Add a new independent command `/openspec-e2e` rather than hooking into `/opsx:verify`. This keeps concerns separated and allows each verification to be run independently.

## Architecture

```
openspec-pw (CLI - setup only)
  openspec-pw init    → installs Playwright + configures MCP + installs skill
  openspec-pw doctor  → checks prerequisites

/openspec-e2e (Claude Code skill - runs in Claude)
  │
  ├── 1. Read OpenSpec specs from openspec/changes/<name>/specs/
  ├── 2. Planner Agent → specs/playwright/test-plan.md
  ├── 3. Generator Agent → tests/playwright/changes/<name>/<name>.spec.ts
  └── 4. Healer Agent → run tests + auto-heal
          │
          └── Report: openspec/reports/playwright-e2e-<name>-<ts>.md
```

### Two Verification Layers

| Layer | Command | Runs in | What it checks |
|-------|---------|---------|----------------|
| Static | `/opsx:verify` | Claude Code (OpenSpec skill) | Implementation matches artifacts |
| E2E | `/openspec-e2e` | Claude Code (this skill) | App works when running |

## Key Design Decisions

- **Separate command, not hook**: `/openspec-e2e` is independent from `/opsx:verify`. Users run them separately or together.
- **CLI as setup only**: The CLI does not run agents. It only installs/configures. Agents run in Claude Code.
- **Playwright MCP**: Playwright agents use the MCP protocol, configured in `.claude/settings.local.json`.
- **Seed test**: A `tests/playwright/seed.spec.ts` template guides the Generator agent.
- **No re-exploration**: Planner uses OpenSpec specs directly as the source of truth, no app exploration needed.

## CLI Commands

```bash
npm install -g wxhou/openspec-playwright

openspec-pw init          # Setup: Playwright + MCP + skill + seed
openspec-pw doctor        # Check prerequisites
```

## What `openspec-pw init` Does

1. `npx playwright init-agents --loop=claude` — installs Playwright agents
2. Configure Playwright MCP in `.claude/settings.local.json`
3. Install skill: `.claude/skills/openspec-e2e/SKILL.md`
4. Install command: `.claude/commands/opsx-e2e.md`
5. Generate `tests/playwright/seed.spec.ts` template

## SKILL.md Format

Follows the OpenSpec standard format:
- YAML frontmatter: `name`, `description`, `license`, `compatibility`, `metadata`
- Bold step names: `**Step 1: Name**`
- Output fenced code blocks: `**Output During Implementation**`, `**Output On Completion**`
- Guardrails section
- Fluid Workflow Integration section

## Directory Structure

```
project/
├── .claude/
│   ├── skills/
│   │   └── openspec-e2e/
│   │       └── SKILL.md           # The /openspec-e2e skill
│   ├── commands/
│   │   └── opsx-e2e.md           # The /openspec-e2e command
│   └── settings.local.json        # Playwright MCP config
├── .github/                       # Playwright agent definitions
│   └── ...
├── openspec/
│   ├── changes/<name>/
│   │   ├── specs/
│   │   │   ├── *.md              # OpenSpec propose output
│   │   │   └── playwright/
│   │   │       └── test-plan.md  # Planner output
│   │   ├── design.md
│   │   └── tasks.md
│   └── reports/
│       └── playwright-e2e-<name>-<ts>.md  # Healer report
└── tests/playwright/
    ├── seed.spec.ts               # Seed test template
    └── <name>.spec.ts             # Generated tests
```

## SKILL.md Sections (OpenSpec Standard)

```yaml
---
name: openspec-e2e
description: Run Playwright E2E verification for an OpenSpec change...
license: MIT
compatibility: Requires openspec CLI and Playwright Test Agents...
metadata:
  author: openspec-playwright
  version: "0.1.0"
  generatedBy: "openspec-playwright"
---

Run Playwright E2E verification for an OpenSpec change...

## Step 1: Identify the Change
...

## Step 2: Verify Prerequisites
...

**Output During Implementation**
```markdown
## E2E Verification: <name>
Status: 🔄 In Progress
```
```

**Output On Completion**
```markdown
## E2E Verify Report: <name>
| Check | Status |
|-------|--------|
...
```
```

**Guardrails**
- Always read specs from `openspec/changes/<name>/specs/` as source of truth
- Do not generate tests that contradict the specs
- Cap auto-heal attempts at 3
...

**Fluid Workflow Integration**
- Before: /opsx:propose → /opsx:apply
- This skill: /openspec-e2e
- After: /opsx:archive
```

## Error Handling

| Scenario | Action |
|----------|--------|
| No specs found | Prompt to run `/opsx:propose` first |
| Prerequisites missing | Prompt to run `openspec-pw init` |
| Dev server not running | Prompt to start before proceeding |
| Planner fails | Log error, mark FAILED |
| Generator fails | Log error, mark FAILED |
| Healer guardrails trigger | Report failures, mark PARTIAL |

## Project Structure

```
openspec-playwright/
├── src/
│   ├── index.ts           # CLI entry
│   └── commands/
│       ├── init.ts        # openspec-pw init
│       └── doctor.ts      # openspec-pw doctor
├── .claude/
│   ├── skills/
│   │   └── openspec-e2e/
│   │       └── SKILL.md  # The Claude Code skill
│   └── commands/
│       └── opsx-e2e.md    # The command file
├── templates/
│   └── seed.spec.ts       # Playwright seed test template
├── README.md
├── package.json
└── tsconfig.json
```
