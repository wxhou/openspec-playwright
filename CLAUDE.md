# openspec-playwright

Setup tool for OpenSpec + Playwright E2E integration.

## Project Structure

- `src/commands/init.ts` — `openspec-pw init` setup logic
- `src/commands/doctor.ts` — `openspec-pw doctor` prerequisites checker
- `templates/e2e-command.md` — E2E workflow template, installed as every editor's `/opsx:e2e` / `/opsx-e2e` command
- `.claude/commands/opsx/e2e.md` — Claude Code command (installed copy)
- `templates/seed.spec.ts` — Playwright seed test template
- `templates/auth.setup.ts` — Authentication setup (API + UI login)
- `templates/credentials.yaml` — Test credentials configuration

## Key Files

- `package.json` — ESM module, Node >= 20
- `src/index.ts` — CLI entry with commander

## Build & Test

```bash
npm run build
npm run test:run          # all tests (requires build first)
npm run test:smoke        # build + smoke tests only
npm run lint              # ESLint
npm run typecheck         # TypeScript type-check
```

## CI / Release

- **CI runs on every push to `main` and every PR** — lint, typecheck, build, tests
- **Release runs on tag push (`v*`)** — verify job must pass before publish job runs
- **PR vs direct-push tiering**: `src/` code changes, multi-file work, or release-related commits → go through a PR (CI gates before merge); `docs/` static-site changes and single-file touch-ups (copy/styles/CHANGELOG/README) → push straight to `main` (push triggers CI either way — a red main gets an immediate fix)
- **PR authorization gate 🔴** (only for changes that go through PR): creating a PR (including pushing the branch) and merging both require explicit user authorization — when the change is done and gates are green, report and stop; once CI is green, report again and stop, waiting for merge authorization. No pushing or merging without authorization. For direct pushes to `main`: user authorization is still required before commit + push; report the CI result after pushing.
- **Version lock**: Only publish the exact version explicitly requested by the user. Never bump `package.json`, create a new tag, or run `npm version patch/minor/major` unless the user has named that target version.
- If the requested version already exists in npm or the release job fails on publish, do not invent a new version number on your own. Stop and report the blocker unless the user explicitly approves a new version.

## Code × Docs Sync Rule

When touching these files, the docs **must be updated in the same commit**:

| Modified | Must update |
|----------|-------------|
| `src/commands/*.ts` or `src/index.ts` | `README.md` (CLI tree), `CHANGELOG.md` |
| `.claude/skills/openspec-e2e/SKILL.md` | `README.md` (architecture diagram), `CHANGELOG.md` |
| `templates/*` | `README.md` (if paths are involved), `CHANGELOG.md` |
| Any CLI logic change | `README.md` (CLI docs), `CHANGELOG.md` |

> Rule: doc updates land in the **same commit** as the code change — never split them out.

## Release Checklist

Before each release action, confirm the target version has already been explicitly chosen by the user and the local `package.json`/tag match it:

- [ ] `npm run lint` passes
- [ ] `npm run typecheck` passes
- [ ] `npm run build && npm run test:run` passes
- [ ] `npm run build && npm pack && tar tf openspec-playwright-*.tgz | grep scripts` succeeds (verifies `scripts/bump-docs.js` is included) and `tar tf openspec-playwright-*.tgz | grep templates/agents` lists the vendored planner agent + SOURCE.md
- [ ] `git status` is clean (no uncommitted changes)
- [ ] `git log --oneline` shows expected changes
- [ ] Check `npm view openspec-playwright version` to verify the target version is not already published. **Do not change the version number to work around a conflict.** If the requested version already exists or publish fails, wait for explicit user instruction before taking any versioning action.

**`npm run release` does:**
1. `npm version patch` — bumps version in `package.json` + creates git commit
2. `node scripts/bump-docs.js` — auto-updates `docs/index.html` version badge
3. `npm run build` — compiles TypeScript
4. `git add docs/index.html && git push` — pushes docs update
5. `git push --tags` — pushes tags → **CI pipeline handles npm publish**

> ⚠️ **Publish via CI only — never run `npm publish` manually.** A local npm publish conflicts with the CI publish ("cannot publish over the previously published versions"). Release flow: `git push --tags` locally → CI verify passes → CI publishes to npm + creates the GitHub Release.

**Important**: Do not use `npm run release` when the version must remain fixed. This project may only publish the version the user explicitly asked for; automatic patch bumps are forbidden unless the user requests a new version.

**Key rules:**
- CI workflow must NEVER modify git history (no amend, no force-push)
- Tests must not use hardcoded absolute paths — use `process.cwd()` or env vars
- Periodically regenerate lockfile: `rm -rf node_modules package-lock.json && npm install`
- **No proactive releases**: never run `npm run release` without an explicit user request

## Commit Message Style

Commit messages follow a strict, concise style:

```
<scope>(<area>): <action> <object>

≤ 4 lines: key changes (no diff narration) + one line of impact
Tests: X/X pass. <gate> clean. No version bump.
```

Hard requirements:
- Subject must carry the `<scope>(<area>):` prefix; scopes: `feat` `fix` `docs` `chore` `refactor`
- Actions in present-tense imperative (`extend` `add` `bump`, not `extended` / `added`)
- Body ≤ 4 lines; never narrate the diff
- No "Same X" restatements or project-convention quotes like "per Version Lock rule"
- No preemptive CTAs ("say the word and I'll cut vX.Y.Z" and the like)
- Footer must list the CI gates already run + the version outcome (`Bump to vX.Y.Z` / `No version bump`)

Example:

```
docs(standards): extend anti-fabrication rule to pure front-end + API docs

§6 covers full-stack and pure front-end. OpenAPI / API docs / MCP endpoints
must be cited, not invented.

templates/e2e-command.md test-data reminder references §6.

Tests: 197/197 pass. No version bump.
```
<!-- OPENSPEC-PW:START -->

## CodeGraph 优先 🔴

结构性任务（定义/调用链/影响面/流程）第一步用 `codegraph_explore`，直接用结果回答。无 `.codegraph/` 跳过。

**工作流**：优先使用 OpenSpec 工作流（/opsx 命令），而非 plan mode。

@AGENTS.md

<!-- OPENSPEC-PW:END -->

## Standards slimming criteria 🔧

Redundancy yardstick for revising `employee-standards.md` (produced by the standards-section6-slim review):

- The same rule appearing **≤2 times** with consistent wording = effective reinforcement, keep it; **≥3 times** = cut down to 1–2 places
- **WHY + operationalized rule** = intent/action pairing, not redundancy — keep the WHY (legislative intent supports boundary extrapolation)
- **Routing duplication** (each copy serves a different task phase) = keep, with minimal wording at the reference site
- 🔴 markers attach only to prohibition/obligation items; routing items and definitions must not hold 🔴 (above 50% density the marker system fails)
- Apply the same yardstick to isomorphic issues in other sections (duplicate counts, positive/negative phrasing, marker-type mismatches); semantic changes and wording compression go through separate changes
