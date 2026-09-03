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
- Always merge to `main` via PR so CI gates the code before it reaches `main`
- **Version lock**: Only publish the exact version explicitly requested by the user. Never bump `package.json`, create a new tag, or run `npm version patch/minor/major` unless the user has named that target version.
- If the requested version already exists in npm or the release job fails on publish, do not invent a new version number on your own. Stop and report the blocker unless the user explicitly approves a new version.

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

Before each release action, confirm the target version has already been explicitly chosen by the user and the local `package.json`/tag match it:

- [ ] `npm run lint` passes
- [ ] `npm run typecheck` passes
- [ ] `npm run build && npm run test:run` passes
- [ ] `npm run build && npm pack && tar tf openspec-playwright-*.tgz | grep scripts` succeeds (verifies `scripts/bump-docs.js` is included) and `tar tf openspec-playwright-*.tgz | grep templates/agents` lists the three vendored agent files + SOURCE.md
- [ ] `git status` is clean (no uncommitted changes)
- [ ] `git log --oneline` shows expected changes
- [ ] Check `npm view openspec-playwright version` to verify the target version is not already published. **Do not change the version number to work around a conflict.** If the requested version already exists or publish fails, wait for explicit user instruction before taking any versioning action.

**`npm run release` does:**
1. `npm version patch` — bumps version in `package.json` + creates git commit
2. `node scripts/bump-docs.js` — auto-updates `docs/index.html` version badge
3. `npm run build` — compiles TypeScript
4. `git add docs/index.html && git push` — pushes docs update
5. `git push --tags` — pushes tags → **CI pipeline handles npm publish**

> ⚠️ **只走 CI 发布，不要手动执行 `npm publish`。** 本地 npm publish 会和 CI publish 冲突（"cannot publish over the previously published versions"）。发布流程：本地 `git push --tags` → CI verify 通过 → CI 自动发布 npm + GitHub Release。

**Important**: Do not use `npm run release` when the version must remain fixed. This project may only publish the version the user explicitly asked for; automatic patch bumps are forbidden unless the user requests a new version.

**Key rules:**
- CI workflow must NEVER modify git history (no amend, no force-push)
- Tests must not use hardcoded absolute paths — use `process.cwd()` or env vars
- Periodically regenerate lockfile: `rm -rf node_modules package-lock.json && npm install`
- **不主动发布**：未经用户明确要求，不执行 `npm run release`

## Commit Message Style

本项目 commit message 走**严谨精炼**风格：

```
<scope>(<area>): <action> <object>

≤ 4 行：关键变更（不复述 diff）+ 一行影响
Tests: X/X pass. <gate> clean. No version bump.
```

硬性要求：
- Subject 必填 `<scope>(<area>):` 前缀；scope: `feat` `fix` `docs` `chore` `refactor`
- 动作现在时祈使语气（`extend` `add` `bump`，非 `extended` / `added`）
- Body 不超 4 行，不复述 diff 内容
- 禁放 "Same X" 复述 / "per Version Lock rule" 之类项目惯例
- 禁放 preemptive CTA ("如果要发 vX.Y.Z 你说一声" 这类)
- Footer 必列已跑过的 CI gate + 版本号变更（`Bump to vX.Y.Z` / `No version bump`）

例：

```
docs(standards): extend anti-fabrication rule to pure front-end + API docs

§6 covers full-stack and pure front-end. OpenAPI / 接口文档 / MCP endpoints
must be cited, not invented.

templates/e2e-command.md test-data reminder references §6.

Tests: 197/197 pass. No version bump.
```
<!-- OPENSPEC-PW:START -->

## CodeGraph 优先 🔴

结构性任务（定义/调用链/影响面/流程）第一步用 `codegraph_explore`，直接用结果回答；grep/read 仅作补充（字面文本、已打开文件、结果不足）。不派子 agent 重建索引。无 `.codegraph/` 跳过。

**工作流**：优先使用 OpenSpec 工作流（/opsx 命令），而非 plan mode。

@AGENTS.md

<!-- OPENSPEC-PW:END -->

## Standards 精简判据 🔧

修订 `employee-standards.md` 时的冗余判定尺（standards-section6-slim 审视产出）：

- 同一规则 **≤2 次**且表述一致 = 有效强化，保留；**≥3 次** = 削到 1-2 处
- **WHY + 操作化规则** = 意图/操作配对，非冗余，WHY 不删（立法意图支撑边界外推）
- **路由性重复**（两处各自服务不同任务阶段）= 保留，引用处极简
- 🔴 标记只挂禁令/义务型条目；路由条/定义条不得占 🔴（>50% 密度即标记体系失效）
- 其他章节同构问题（重复计数、正反表述、标记-类型错配）复用此尺；语义修改与措辞压缩分开立 change
