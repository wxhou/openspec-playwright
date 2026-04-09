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

Before each `git tag vX.Y.Z && git push --tags`:

- [ ] `npm run lint` passes — **run before every commit**, not just before release
- [ ] `npm run typecheck` passes
- [ ] `npm run build && npm run test:run` passes
- [ ] `npm run build && npm pack && tar tf openspec-playwright-*.tgz | grep .claude` succeeds (verifies package contents)
- [ ] `package.json` version already updated to `X.Y.Z`
- [ ] `git log --oneline` shows expected changes
- [ ] If re-tagging: delete old tag first — `git tag -d vX.Y.Z && git push origin :refs/tags/vX.Y.Z`

**Key rules:**
- CI workflow must NEVER modify git history (no amend, no force-push)
- Tests must not use hardcoded absolute paths — use `process.cwd()` or env vars
- Periodically regenerate lockfile: `rm -rf node_modules package-lock.json && npm install`
- **不主动发布**：未经用户明确要求，不执行 `git tag` 和 `git push --tags`
