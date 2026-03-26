# OpenSpec + Playwright Test Agents Integration Design

**Date:** 2026-03-26
**Status:** Draft

## Overview

Integrate OpenSpec's spec-driven development workflow with Playwright Test Agents' three-agent harness (Planner / Generator / Healer) for automated E2E verification.

**Goal:** When `/opsx:verify` runs, automatically trigger Playwright E2E validation using OpenSpec's `specs/` as input.

## Architecture

```
/opsx:verify
  │
  ├── OpenSpec Native Verify (static)
  │     Check: implementation matches artifacts?
  │
  └── Playwright E2E Verify (dynamic)
        │
        ├── Agent 1: Planner → test-plan.md (from specs/)
        ├── Agent 2: Generator → *.spec.ts
        └── Agent 3: Healer → run tests + auto-heal
```

### Data Flow

1. OpenSpec `specs/*.md` (from `/opsx:propose`) → Playwright Planner → `specs/playwright/test-plan.md`
2. `specs/playwright/test-plan.md` → Playwright Generator → `tests/*.spec.ts`
3. `tests/*.spec.ts` → Playwright Healer → verification results

## Key Design Decisions

- **No re-exploration**: Planner uses OpenSpec specs directly as PRD, no app exploration needed
- **Two-layer verification**: OpenSpec native (static) + Playwright E2E (dynamic) run independently
- **Max result on artifact status**: Final artifact state = worse of two layers
- **Playwright as-is**: Use `npx playwright init-agents --loop=claude` instead of wrapping agents

## CLI Commands

```bash
# Install
npm install -g openspec-playwright

# Init project (install Playwright + inject config context)
openspec-pw init

# Full verify (both layers)
openspec-pw verify --change <name>

# Individual steps
openspec-pw plan --change <name>   # Planner only
openspec-pw heal --change <name>    # Healer only (tests exist)
```

## OpenSpec Integration

Inject Playwright instructions via `openspec/config.yaml` context:

```yaml
context: |
  Tech stack: ...

  # Playwright Verify Integration
  When /opsx:verify runs, automatically trigger Playwright E2E validation:
  1. Read openspec/changes/<name>/specs/*.md as PRD
  2. Planner → specs/playwright/test-plan.md
  3. Generator → tests/playwright/*.spec.ts
  4. Healer → run tests + auto-heal
  5. Report to reports/playwright-verify.md
```

## Directory Structure

```
.
├── openspec/
│   ├── changes/<name>/
│   │   ├── specs/
│   │   │   └── *.md                  # OpenSpec propose output
│   │   └── specs/playwright/         # Planner output
│   │       └── test-plan.md
│   └── reports/
│       └── playwright-verify.md      # Healer verification report
└── tests/playwright/
    └── *.spec.ts                     # Generator output
```

## Implementation Phases

### Phase 1: MVP
- `openspec-pw init` command
- Manual Playwright trigger via CLI
- Report generation

### Phase 2: Automation
- `/opsx:verify` auto-triggers Playwright via config context
- Healer incremental verification
- Artifact state sync

### Phase 3: Enhancement
- Auto dev server startup
- Guardrail configuration
- CI/CD integration (JUnit XML output)

## Error Handling

| Scenario | Action |
|----------|--------|
| No specs found | Stop, prompt to run `/opsx:propose` first |
| Planner fails | Log error, mark FAILED |
| Generator fails | Log error, mark FAILED |
| Healer guardrails trigger | Report failures, mark PARTIAL |
| Playwright unavailable | Fallback to `npx playwright` |
| App not running | Prompt to start dev server |

## Project Structure

```
openspec-playwright/
├── src/
│   ├── commands/
│   │   ├── init.ts
│   │   ├── verify.ts
│   │   ├── plan.ts
│   │   └── heal.ts
│   ├── lib/
│   │   ├── playwright-agent.ts
│   │   ├── openspec.ts
│   │   ├── verify.ts
│   │   └── report.ts
│   └── index.ts
├── schema/
│   └── playwright-verify/
│       ├── schema.yaml
│       └── templates/
│           └── verify-context.md
├── README.md
└── package.json
```
