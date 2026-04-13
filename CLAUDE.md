# openspec-playwright

Setup tool for OpenSpec + Playwright E2E integration.

## Project Structure

- `src/commands/init.ts` — `openspec-pw init` setup logic
- `src/commands/doctor.ts` — `openspec-pw doctor` prerequisites checker
- `.claude/skills/openspec-e2e/SKILL.md` — Claude Code skill for `/opsx:e2e`
- `.claude/commands/opsx/e2e.md` — Claude Code command
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
- Always merge to `main` via PR so CI gates the code before it reaches `main`

## Code × Docs Sync Rule

改这些文件时，**必须同步更新**文档：

| 修改了 | 必须更新 |
|--------|---------|
| `src/commands/*.ts` 或 `src/index.ts` | `README.md`（CLI树）、`CHANGELOG.md` |
| `.claude/skills/openspec-e2e/SKILL.md` | `README.md`（架构图）、`CHANGELOG.md` |
| `templates/*` | `README.md`（如涉及路径）、`CHANGELOG.md` |
| 任何 CLI 逻辑变更 | `README.md`（CLI说明）、`CHANGELOG.md` |

> 规则：文档更新和代码变更在**同一个 commit** 里，不要单独拆出来。

## Release Checklist

Before each `npm run release` (bumps version, builds, pushes, publishes):

- [ ] `npm run lint` passes
- [ ] `npm run typecheck` passes
- [ ] `npm run build && npm run test:run` passes
- [ ] `npm run build && npm pack && tar tf openspec-playwright-*.tgz | grep scripts` succeeds (verifies `scripts/bump-docs.js` is included)
- [ ] `git status` is clean (no uncommitted changes)
- [ ] `git log --oneline` shows expected changes

**`npm run release` does:**
1. `npm version patch` — bumps version in `package.json` + creates git commit
2. `node scripts/bump-docs.js` — auto-updates `docs/index.html` version badge
3. `npm run build` — compiles TypeScript
4. `git add docs/index.html && git push` — pushes docs update
5. `git push --tags && npm publish` — pushes tags + publishes to npm

**Key rules:**
- CI workflow must NEVER modify git history (no amend, no force-push)
- Tests must not use hardcoded absolute paths — use `process.cwd()` or env vars
- Periodically regenerate lockfile: `rm -rf node_modules package-lock.json && npm install`
- **不主动发布**：未经用户明确要求，不执行 `npm run release`
