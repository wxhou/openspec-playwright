const CLAUDE_MD_ZH = `# 项目规范
- 动手前读 \`openspec/config.yaml\`（技术栈、结构、约定、约束等）；文件不存在或为空 → 本条跳过，其余条款照常适用
- OpenSpec 命令：需要时跑 \`npx openspec --help\` 查看可用命令
- 优先级：🔴 CRITICAL（违反→静默 bug/安全漏洞，停下向用户确认，同意后按用户指示执行，不可达则报告并中止、不自行放行）｜🟡 IMPORTANT（偏离说明理由，谨慎执行）｜⚪ STANDARD（按标准执行）｜未标注的条款按 🟡 处理；条款冲突 🔴 > 🟡 裁决，同级停下问用户
- 用户指令优先：用户显式指令可偏离 🟡/⚪ 即刻生效；与 🔴 冲突 → 先复述风险，用户终裁后执行
- 🟡 被用户纠正后，将防再犯规则以修订形式沉淀回随 CLI 安装的 employee-standards.md（写入前先定位并通读）；改动 🔴/🟡 定级或增删整条属重大修订，用户确认后合入

## 代码质量
- 🔴 **lint+typecheck 每次编辑后自动执行，通过才算成功**。按本次编辑涉及的扩展名逐一选 gate（可多语言并存）：\`.ts\`→ESLint+tsc、\`.py\`→ruff+mypy、\`.go\`→gofmt+vet。工具不存在时告知用户，不假装跑过
- 🟡 gate 结果不造假：仍失败 → 完整输出错误日志并停止；未运行的检查标注「未运行」
- 🟡 关键假设（外部数据源/接口、环境可运行、依赖版本）动手前逐条验证；理解不清或有可见风险 → 先提问再执行。多解释则全列，更简单方案提出并坚持——用户已否决 → 按用户方案执行，不再重提
- 🟡 多步任务每步带验证（\`1. [Step] → verify: [check]\`），循环验证直到成功（同一验证连续 2 次未过 → 记录失败并停）。lint 失败时对本次触及的文件运行对应 auto-fix（如 \`npm run lint:fix\`；\`ruff format\`/\`go fmt\` 同样限本次触及文件）；修复循环最多 2 轮，仍失败即停
- 🟡 只写被要求的：不加用户未要求的扩展点（"灵活"/"可配置"之类，不限词面）、单次使用抽象，不为想象中的场景写防御；自己新写的 200 行能 50 行则重写
- 🟡 简化有边界，永不简化掉：信任边界的输入校验、防数据丢失的错误处理、安全措施、无障碍基础、用户明确要求的东西；刻意砍角且有已知天花板的简化（全局锁、O(n²) 扫描、朴素启发式）用 \`debt:\` 注释标明天花板和升级路径——debt 只属性能取舍，不豁免性能节已标 🔴 的无界类禁令与正确性/安全措施
- 🔴 过时的直接删（过时=因本次改动而不再被引用或不再为真）：删除/修改时不留兼容层/迁移/fallback（仅限本次触及的范围）；与「保持既有测试通过」冲突时按测试红的分类分流
- 🔴 方案选型按优先级链依次判断，停在第一个成立的：要不要存在（YAGNI）→ 代码库已有可复用 → 标准库 → 平台原生特性 → 已装依赖 → 成熟有人维护的库 → 自己实现——没有明确理由不从零发明；确需自实现，同类问题优先采用经成熟产品验证的既有模式
- 🔴 引入新依赖前先实查 registry——AI 会幻觉包名（抢注攻击）；装前看 install scripts：下载并执行外部内容、包名与惯用名高度相似 → 可疑即弃
- 🟡 精准改动：只改必要的，每一行都应能直接追溯到用户的请求；不"改进"相邻的代码/注释/格式，不重构没坏的东西；改完清理自己造成的垃圾（未使用的 import/export/prop/console.log 等；清理与重构分开提交）。匹配现有风格
- 🟡 注释纪律：默认不写；仅写代码无法表达的 why（约束、workaround 原因、反直觉决策），且为确知原因，不确定则不写；一行以内（\`// 上游 429 无 Retry-After，故固定重试 3 次\`，非 \`// 重试次数\`——入库即噪音）；改动叙述、分步叙述、对已删代码的引用、注释掉的代码、复述代码字面含义、复述签名/参数的 docstring 一律不留（用户点名要求的除外）——历史归 git log；混合句删叙述留 why，无 why 则整条删；多轮修改同一段代码时同样不留轮次间叙述；交付前自检本次新增与所改的每条注释：非 why 内容或命中黑名单 → 删；机制标注不受本条约束——spec 锚、lint/类型抑制标记、来源标注（见 §4）与 TODO(user)
- 🟡 代码文件行数上限 1500：本次编辑推过 1500 即违例，按职责拆分；存量已超限的报告不动，不得继续堆叠（生成/vendored 产物除外）

## 禁止非通用性改动
- 不假设外部输入可信：信任边界上的数据/响应/异步结果先校验（类型/范围/null/空/边界，数值含精度）再使用；资源用后必须释放
- 🔴 禁止静默吞错：捕获的异常/错误必须处理、记录或上抛，记录后不得带病继续使用失败结果；确可安全忽略的（如 cleanup 二次异常）注释原因——不留空 catch / \`except: pass\` / \`_ = err\` / \`.ok()\` 类黑洞
- 不写只适配样例输入的逻辑、魔法数字（入常量；有确切依据才注原因，否则取达义常量名）、具体值断言（无验收锚定的数值，点名即豁免）；路径/换行用语言内建跨平台 API（\`path.sep\`/\`path.join\`），比较前归一化 EOL
- linter/typechecker 不存在（如该栈适用）→ 告知用户并建议安装；装上之前每次编辑后对改动自查并在响应中注明结果，重点：import 顶置纪律见工具节、未用变量/import
- mock 数据/fixture → 参见数据编撰禁令

## 工具限制
- 🔴 发现自己正在重复生成相同或仅参数微变的调用 → 立即停止，重新评估（有界重试/轮询等有新信息的重复除外）
- 🟡 长会话接近上下文上限时，复杂任务前先压缩上下文
- 🟡 搜索分层：结构性问题（定义/调用/影响/流）优先用 CodeGraph（无索引或不可用 → 直接降级全文搜索）；字面文本用全文搜索；文件名模式用文件名匹配。跳过依赖目录和缓存目录（调试依赖时除外），搜子目录时按需缩小
- 🟡 引用作依据的文件先通读再断言；未通读就下的结论显式标注低置信，不冒充已充分验证
- 🟡 重命名/挪动覆盖：调用、类型、字符串、import（含 CJS require）、barrel file、测试 mock、文档与配置中的同名引用，不得假设一次覆盖；抽出/搬移到其他文件时其 import 随迁；静态模块级 import 一律置文件顶部，不在代码中部补挂——豁免仅限：循环依赖、可选依赖、按需加载、运行顺序依赖（如 django.setup()），例外须行内注明缘由
- 🟡 编辑 → 重新读取确认 → lint+typecheck（含 auto-fix 循环）→ 两轮后仍失败则回退到编辑前内容，输出失败日志并明示已回退
- 🟡 变更完成告知用户可能遗漏并需人工复查的区域（仅基于实际触及的公共签名/类型/配置；不编造风险清单）
- 🔴 禁止用经 shell 就地或重定向改写已有文件的命令（\`sed -i\`/awk/\`node -e\`/python -c/\`perl -pi\`/重定向等；不改文件内容的纯管道查询不计）改写项目内已有文件——源码/文档/测试/配置同算（跳过编辑工具验证层）；确需批量改写，先征得用户同意
- 不主动推送，除非用户明确要求
- 可用不改语义的格式化工具（ruff fmt/prettier），仅限本次编辑触及的文件；重排会触及未改动行时须用户同意并单独提交
- 🔴 密钥与 \`.env\`（含 .env.* 变体；\`.env.example\` 除外）不入版本控制。示例用占位符（如 \`YOUR_API_KEY\`）。调试日志不打印凭据

## 大规模任务
- 🔴 200+ 行修改（git 视角增/删/改并计，含新建文件）或架构级变更（如新增服务/API 契约/数据模型重构，非穷举）必须走 OpenSpec（\`/opsx:propose\`），禁止直接修改；命中 → 停下建议用户运行，不代跑
- 🟡 执行中一旦发现走偏（方案不成立、前提变化、验证反复失败——同一问题 2 轮不通过），立刻停下重新评估并回报，不硬推到结尾

## 工作流参考
- 提案→实现→自审→E2E→归档，**各阶段由用户手动触发，AI 不自动进入下一阶段**

## 数据编撰
- 🔴 严禁主动编撰模拟现实实体或外部系统形态的数据——mock 用户/手机号/邮箱/ID、凭空捏造配置默认值、假装存在的接口/字段/枚举值、编造测试期望值等，同类情形与改写措辞同判；算法演示的字面量输入不在禁区
- 不编造 URL/路径/字段名 → 引用真实来源，真实来源先检索
- 遇需数据/字段名/URL/接口形态的代码位 → 显式询问用户；用户拒绝 → 用 stub/throw/null 显式失败；用户明示可用假数据（如"随便造几个"）→ 视为授权，可造并标注 \`// fake data（用户授权）\`，禁止静默编造
- 用户同意占位 → \`TODO(user)\` 标注并附问询上下文
- 用户提供数据 → 使用真实数据
- 写接口对接代码前先检索 OpenAPI/接口文档 → 查到查阅真实定义并标注来源（如 \`// 来源: docs/api/openapi.yaml#/paths/...\`），查不到按上条询问

## 临时文件管理
- 🟡 非源码临时文件（截图、日志、heapdump 等）放仓库根 \`tmp/\` 下（临时=本次验证/调试产生、任务结束即无用；测试数据按项目 fixtures 惯例存放），文件名含时间戳（如 \`screenshot-20260721T143000.png\`）
- 🔴 禁止将临时文件提交到版本控制（确保 \`.gitignore\` 含 \`tmp/\`；已跟踪的历史文件先 \`git rm --cached\`）；超 24h 的临时文件在 commit 前删除——仅限 \`tmp/\` 下本次任务产生的临时产物，用户名下或来历不明的可疑文件报告请示、不自行删

## 测试与验证策略
- 🟡 测试只随验收存在：验收条款（规范 requirement / change 完成条 / 任务验收标准）或用户在会话中明确要求，点名才写；未点名的有价值场景（业务核心计算/状态转换、边界与错误路径、被多处复用的工具、修过 bug 的回归）→ 提议用户（收尾汇总一次提出），不静默略过；一个行为一组断言
- 🔴 保持现有测试通过；测试红时先分类——被测行为仍在 → 更新断言至新行为；行为本次已删 → 其专属测试随行为删除、删前列明并报告；范围外既有红测试 → 报告不动；不以本节 DO NOT 或 §1 简化类条款为由跳过/删除既有测试
- 🔴 验收条款点名的行为必须被某层测试覆盖（单测或验收测试，一层即可）；点名项若落本节任一 DO NOT 条款（如纯透传、同义反复断言），停下向用户裁决——不静默写，也不静默不写
- 🟡 后端/服务的验证对真实运行的服务发真实请求（真实数据/依赖，遵守数据编撰节；写操作限测试/预发环境，无隔离环境先问用户）；是否落成测试按本节第一条的点名标准判断
- 🟡 按点名写测试时，点名行为在该层覆盖不到才抽 UI 可测客户端逻辑（自定义 hook / 组合式函数 / 纯函数）为独立单元测；改了用户可见可交互的东西 → 浏览器验证；纯逻辑 → 证据验证，不开浏览器
- 🟡 修复类任务先复现后修复：完成前后各重现 bug 一次（修前 = 证明它存在，修后 = 证明它消失），辅以截图或测量；同法 ≥2 次未复现 → 以已试次数与现有证据回报并停下，等用户提供复现条件，或经用户明示授权后按分析修复；不宣称已验证
- 🟡 验收期望锚定验收标准写「预期 X，实测 Y」（期望编造禁令见数据编撰节）
- 🟡 验证前核对加载的是本次产物（清缓存/停用 Service Worker/核 hash）；权限类必须真实登录态=以真实凭据过登录流程（UI 登录或 API 登录取回），构造/硬编码 token 一律算注入；多角色各角色单独登录
- 🟡 验证证据（截图/日志/输出）取自本次实际运行，不编造、不复用旧证据
- 🔴 禁止生成 UI 组件测试：渲染冒烟、快照、纯存在断言
- 🔴 仅截图不算通过——交互必须验证结果（点击后的状态/跳转/渲染），断言只作辅助证据；样式类改动（无行为变化）核对渲染截图并呈现给用户即可
- 🟡 无断言价值的测试一律不写，点名不豁免：纯透传、getter/样板、类型系统已保证的行为、期望从实现反推的同义反复断言、只断言 mock 拓扑而非可观察行为

## 性能与资源边界
- 🟡 写处理运行时数据的代码（查询、文件、网络、并发、大批量集合遍历——含测试造数与测试并发；造数能否写先过数据编撰节，本条只管规模）前先确认量级（预期行数/文件大小/并发度）：openspec/config.yaml 有记录则以它为准；未知 → 问用户
- 🟡 集合内查找用哈希结构（Map/Set/dict）；CPU 密集任务分片或移入后台（worker/子进程），不阻塞主线程/事件循环
- 🔴 禁止无界读取进内存：整文件读入、无 LIMIT 全表查询、全量结果攒齐再处理——除非量级已确认有界且单次驻留明显低于可用内存（仅"知道大小"不算确认，拿不准 → 流式）；大数据一律流式/分批（数据侧：流/游标/分页/chunk；展示侧：分页/虚拟列表），单批大小显式设定
- 🔴 禁止无界并发：大批量任务不限并发度地一次性发起、无上限开连接/进程/线程——并发池/信号量显式限流
- 🟡 禁止循环内逐条 I/O（N+1 查询、循环内发请求/写文件）→ 批量化（流式分块写不算"攒齐"；错误日志保留、聚合输出）
- 🟡 不写随输入增长的无界缓存（无上限、无淘汰的累积结构）`;

const CLAUDE_MD_EN = `# Project Guidelines
- Read \`openspec/config.yaml\` first (tech stack, structure, conventions, constraints, etc.); no file or empty → skip this item, the rest applies as usual
- OpenSpec commands: when needed, run \`npx openspec --help\` to list them
- Priority: 🔴 CRITICAL (violation → silent bug/security hole — stop, confirm with the user, act per their instruction; unreachable → report and abort, never self-clear)｜🟡 IMPORTANT (deviations need justification, proceed with caution)｜⚪ STANDARD (follow as standard practice)｜unmarked rules are treated as 🟡; clause conflicts resolve 🔴 > 🟡, same-tier conflicts stop and ask the user
- User instruction primacy: explicit user instructions may override 🟡/⚪ rules and take effect immediately; if one conflicts with a 🔴 → restate the risk first, the user makes the final call
- 🟡 When corrected by the user, distill the prevention rule back into the standards file installed with the CLI (employee-standards.md; locate and read it before writing); changing a 🔴/🟡 rating or adding/removing whole rules is a major revision, landing after user confirmation

## Code Quality
- 🔴 **lint+typecheck runs after every edit, both must pass**. Pick gates per extension touched by this edit (multiple may apply): \`.ts\`→ESLint+tsc, \`.py\`→ruff+mypy, \`.go\`→gofmt+vet. If tool missing, tell user, don't pretend it ran
- 🟡 Never fake gate results: still failing → output the full error log and stop; unexecuted checks are explicitly marked "not run"
- 🟡 Verify key assumptions before coding (external data sources & API fields, runnable environment, dependency availability); if unclear or risks are visible → ask first. Present all interpretations; suggest simpler approaches and insist — if already rejected, follow the user's plan, don't re-raise
- 🟡 Multi-step tasks: verify every step (\`1. [Step] → verify: [check]\`), loop until verified (same check failing twice in a row → record the failure and stop). On lint failure, run the language's auto-fix on touched files only (e.g. \`npm run lint:fix\`); the fix loop runs at most 2 rounds — still failing, stop
- 🟡 Write only what's requested: no un-requested extension points (flexibility/configurability — wording aside), no single-use abstractions, no defensive code for imagined scenarios; rewrite your own new code if 200 lines can be 50
- 🟡 Simplification has boundaries, never simplify away: input validation at trust boundaries, error handling that prevents data loss, security measures, accessibility basics, anything the user explicitly asked for; deliberate corner-cutting with a known ceiling (global locks, O(n²) scans, naive heuristics) gets a \`debt:\` comment marking the ceiling and upgrade path — debt is a performance trade-off only, it never exempts the 🔴 unbounded-resource bans in the Performance section or correctness/security measures
- 🔴 Delete obsolete code outright (obsolete = no longer referenced or no longer true because of this change): no compat layers, migrations, or fallbacks when removing/editing (within the scope of the current change only); when deadlocked with "keep existing tests passing", route through the red-test triage in the Testing section
- 🔴 Solution selection walks the priority chain, stopping at the first that holds: should it exist at all (YAGNI) → reuse from the codebase → standard library → platform-native features → installed dependencies → mature maintained libraries → write it yourself — never invent from scratch without a clear reason; when self-implementation is required, solve similar problems with patterns proven in mature products
- 🔴 Before adding any new dependency, verify it on its registry first — LLMs hallucinate package names (squatting attacks); check install scripts: lifecycle scripts that download and execute external content, or names closely imitating a common package → discard
- 🟡 Surgical changes: touch only what's needed, every line traceable to the user's request; don't "improve" adjacent code/comments/formatting, don't refactor what isn't broken; clean up your own mess (unused imports/exports/props/console.log etc.; cleanup and refactor in separate commits). Match existing style
- 🟡 Comment discipline: default to no comments; write only the why the code cannot express (constraints, workaround reasons, counterintuitive decisions) and only a known cause — if unsure, don't write; one line max (\`// upstream 429s with no Retry-After header, so retry 3 times\`, not \`// retry count\` — noise once in the codebase); change narration, step narration, references to deleted code, commented-out code, literal-meaning restatements, and docstrings restating signature or parameters are never kept (unless the user explicitly asked for one) — history belongs in git log; for mixed sentences strip the narration and keep the why, no why left → delete the whole; never leave narration from an earlier round when re-modifying the same code; before delivery self-check every new or edited comment: no why content or a blacklist hit → delete; mechanism markings are exempt from this rule — spec anchors, lint/type suppression markers, source annotations (see §4), and TODO(user)
- 🟡 Code file line limit 1500: this edit pushing a file past 1500 is a violation — split by responsibility, never extend; existing over-limit files are reported, not touched (generated/vendored artifacts exempt)

## No Non-Generic Changes
- Don't assume external input is trusted: validate data/responses/async results at trust boundaries (type/range/null/empty/boundary, numeric precision included) before use; release resources after use
- 🔴 No silent error swallowing: caught exceptions/errors must be handled, logged, or rethrown — never keep running on a failed result after logging it; safe-to-ignore cases (e.g. cleanup secondary errors) get a reason comment — never bare catch / \`except: pass\` / \`_ = err\` / \`.ok()\` black holes
- No logic that only fits sample inputs, no magic numbers (constants; a reason comment only when grounded in fact, otherwise a meaningful name), no specific-value assertions (ones unanchored to acceptance — acceptance-named ones exempt); paths/newlines via the language's built-in cross-platform APIs (\`path.sep\`/\`path.join\`), normalize EOL before comparing
- If linter/typechecker missing (if applicable to the stack) → tell user and suggest installing; until then, self-check the changes after every edit and note the result in the reply, focus: import discipline (see Tool Constraints), unused variables/imports
- Mock data / fixtures → see Data Fabrication section below

## Tool Constraints
- 🔴 If you catch yourself generating the same call — or one differing only in parameters — repeatedly → stop immediately, re-evaluate (bounded retries/polling with new information exempt)
- 🟡 In long sessions near the context limit, compact context before complex tasks
- 🟡 Search in layers: structural queries (definitions/calls/impact/flow) prefer CodeGraph (no index or unavailable → fall back to full-text search); literal text → full-text search; filename patterns → filename matching. Skip dependency and cache directories (except when debugging deps); narrow scope in subdirectories
- 🟡 Read every file you cite as evidence end-to-end before asserting; conclusions drawn from partial reads are marked low-confidence explicitly, never presented as verified
- 🟡 Renaming/moving must cover: calls, types, strings, imports (incl. CJS require), barrel files, test mocks, plus same-name references in docs/config — don't assume one pass covers everything; when code moves to another file its imports migrate with it; static module-level imports always sit at the file top, never added mid-file — exemptions only for: circular deps, optional deps, on-demand loading, runtime-order deps (e.g. django.setup()), annotated inline with its reason
- 🟡 Edit → re-read to confirm → lint+typecheck (incl. its auto-fix loop) → after two failed rounds roll back to pre-edit content, output the failure log, and state the rollback explicitly
- 🟡 After changes, name areas that may be missed and need manual review — only ones actually touched (public signatures/types/config); never invent a risk list
- 🔴 No shell in-place/redirect rewriting of existing files (\`sed -i\`, awk, \`node -e\`, python -c, \`perl -pi\`, output redirection; plain query pipelines that don't write are fine) — source, docs, tests, config all count (bypasses edit tool validation); for bulk rewrites, get user consent first
- No push unless explicitly requested
- Non-semantic formatters allowed (ruff fmt/prettier) on touched files only; reformatting that reaches untouched lines needs user consent and a separate commit
- 🔴 Secrets & \`.env\` (including .env.* variants; \`.env.example\` exempt) out of version control. Use placeholders (e.g. \`YOUR_API_KEY\`). No credentials in debug logs

## Large-Scale Tasks
- 🔴 200+ line changes (counted as added+deleted+changed, incl. new files) or architecture changes (e.g. new services/API contracts/data model refactors — not exhaustive) must use OpenSpec (\`/opsx:propose\`), no direct edits; on a hit, stop and suggest the user run it — don't run it for them
- 🟡 The moment execution goes off track (plan untenable, premises changed, verification repeatedly failing — the same problem failing two rounds in a row), stop immediately, re-evaluate, and report — never push through to the end

## Workflow Reference
- Propose→Apply→Verify→E2E→Archive, **each phase manually triggered by user, AI does not auto-advance**

## Data Fabrication
- 🔴 Never fabricate data simulating real entities or external systems — mock users/phones/emails/IDs, imaginary config defaults, pretended APIs/fields/enum values, fabricated test expectations, etc., same-kind cases and rewordings count the same; literal inputs for algorithm demos are not in scope
- Don't fabricate URLs/paths/field names → cite real sources; search first
- When data/field names/URLs/API shapes are needed → ask the user explicitly; user refuses → stub/throw/null for explicit failure; user explicitly okays fake data ("just make some up") → treat as authorized, mark \`// fake data (user-approved)\`, never silently fabricate
- User agrees to a placeholder → mark with \`TODO(user)\` and attach context
- User provides data → use real data
- Before writing API-integration code, search for OpenAPI/API docs → found: consult real definitions and cite source (e.g. \`// source: docs/api/openapi.yaml#/paths/...\`); not found: ask per the rule above

## Temp File Management
- 🟡 Non-source temp files (screenshots, logs, heapdumps, etc.) go in \`tmp/\` at the repo root (temp = produced for this round of verification/debugging; test data follows the project's fixtures convention), filenames include timestamp (e.g. \`screenshot-20260721T143000.png\`)
- 🔴 Never commit temp files to version control (ensure \`.gitignore\` has \`tmp/\`, already-tracked ones get \`git rm --cached\` first); delete temp files older than 24h before commit — only those under \`tmp/\` produced by this task; user-owned or unclear-origin suspicious files get reported, not deleted

## Testing & Verification Strategy
- 🟡 Tests exist only where acceptance demands them: write tests only for cases named by acceptance clauses (spec requirements / change acceptance criteria / task acceptance standards) or explicitly requested by the user in the session; for valuable un-named scenarios (core business computation/state transitions, boundary & error paths, widely reused utilities, bug-fix regressions) → propose to the user (bundled, raised once at wrap-up), never skip silently; one behavior one assertion set
- 🔴 Keep existing tests passing; triage red tests first — behavior still exists → update assertions to the new behavior; behavior deleted this round → its dedicated tests go with it, itemized in the report; pre-existing red tests outside scope → report, don't touch; never use this section's DO NOT rules or the §1 simplification clauses to skip/delete existing tests
- 🔴 Behaviors named by acceptance clauses must be covered by some test layer (unit OR acceptance — one is enough); when a named item falls into any DO NOT rule of this section (pure passthrough, tautological assertions), stop and let the user decide — never silently write it, never silently skip it
- 🟡 Verify backend/service behavior with real requests against a real running service (real data/dependencies, per the Data Fabrication section; write operations only against test/staging environments — ask first when no isolated environment exists); whether it lands as a test follows the naming standard in this section's first rule
- 🟡 When writing named tests, extract testable client-side logic (custom hooks / composables / pure functions) into independent unit tests only when the named behavior isn't coverable at that layer; user-visible/interactive changes → browser-verify; pure logic → evidence verification, no browser
- 🟡 Fix tasks: reproduce before and after completion (before = prove it exists, after = prove it's gone), with screenshots or measurements as support; same-method ≥2 failed reproductions → report attempts and existing evidence and stop — wait for repro conditions from the user, or proceed with analysis-driven fixes only after explicit user authorization; never claim verified
- 🟡 All acceptance expectations anchor to acceptance criteria ("expected X, got Y"); the no-fabricating-expectations rule lives in the Data Fabrication section
- 🟡 Verify the tested build is the current one (clear cache/disable the Service Worker/check the hash); permission checks need a real login state = a session from the real login flow (UI login or API login exchange) — constructed/hardcoded tokens count as injection; each role logs in separately
- 🟡 Verification evidence (screenshots/logs/output) comes from this run only — never fabricated, never reused from earlier runs
- 🔴 Never generate UI component tests: render-smoke, snapshot, or mere-existence
- 🔴 Screenshot alone does not pass — interactions must verify the result (state/navigation/render after click); assertions serve only as auxiliary evidence; style-only changes (no behavior change) verify the rendered screenshot and present it to the user
- 🟡 Tests without assertion value are never written — naming by acceptance doesn't exempt them: pass-throughs, getters/boilerplate, type-system-guaranteed behavior, tautological assertions with expectations reverse-engineered from the implementation, asserting mock topology instead of observable behavior

## Performance & Resource Bounds
- 🟡 Confirm data scale (expected rows / file size / concurrency) before writing code that processes runtime data (queries, files, network, concurrency, bulk collection iteration — incl. test fixtures & test parallelism; whether fixtures may be written goes through the Data Fabrication section first, this rule only covers scale): openspec/config.yaml records take precedence; unknown → ask the user
- 🟡 Use hash structures for in-collection lookups (Map/Set/dict); shard CPU-heavy work or move it to a worker/subprocess — never block the main thread/event loop
- 🔴 Never read unbounded data into memory: whole-file reads, queries without LIMIT, accumulate-then-process — unless the scale is confirmed bounded and the single resident footprint is clearly below available memory (knowing the size alone doesn't count as confirmed; unsure → stream). Stream/batch by default (data side: streams/cursors/pagination/chunks; display side: pagination/virtual lists) with an explicit batch size
- 🔴 Never fan out unbounded concurrency: launching a large batch of tasks all at once without a concurrency cap, or opening connections/processes/threads without a limit — bound them with an explicit pool/semaphore
- 🟡 No per-item I/O inside loops (N+1 queries, per-row requests/file writes) → batch it (streamed chunked writes aren't "accumulate-then-process"; error logs stay, aggregate the rest)
- 🟡 No unbounded caches growing with input (accumulating structures without a cap or eviction)`;

function processInline(text) {
  // **bold** → <strong>
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // `code` → <code>
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
  // [text](url) → <a>
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  // Priority dots → classed spans (mono glyphs keep the dark preview single-voice;
  // raw emoji introduce stray red/yellow hues)
  text = text.replace(/🔴/g, '<span class="prio prio-critical"></span>');
  text = text.replace(/🟡/g, '<span class="prio prio-important"></span>');
  text = text.replace(/⚪/g, '<span class="prio prio-standard"></span>');
  return text;
}

function renderMarkdown(md) {
  const lines = md.split('\n');
  let html = '';
  let inList = false;

  // Demote every heading one level: the embed lives under the page's h1, so
  // its own "# title" must not compete in the document outline.
  let offset = 1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines (but close open lists)
    if (trimmed === '') {
      if (inList) {
        html += '</ul>\n';
        inList = false;
      }
      continue;
    }

    // H1-H5 (demoted one level: # → h2 … so the embed stays under the page h1)
    if (/^#{1,5} /.test(trimmed)) {
      if (inList) { html += '</ul>\n'; inList = false; }
      const level = trimmed.match(/^#{1,5} /)[0].length - 1;
      const content = trimmed.slice(level + 1);
      html += `<h${level + offset}>` + processInline(content) + `</h${level + offset}>\n`;
      continue;
    }

    // List items (support nested by indent)
    if (trimmed.startsWith('- ')) {
      if (!inList) {
        html += '<ul>\n';
        inList = true;
      }
      html += '  <li>' + processInline(trimmed.slice(2)) + '</li>\n';
      continue;
    }

    // Close list for non-list content
    if (inList) { html += '</ul>\n'; inList = false; }
    html += '<p>' + processInline(trimmed) + '</p>\n';
  }

  if (inList) {
    html += '</ul>\n';
  }

  return html;
}

let currentLang = 'zh';

function setLanguage(lang) {
  currentLang = lang;

  // Update language buttons
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });

  const isZh = lang === 'zh';

  // Hide all zh/en elements first
  document.querySelectorAll('[class*="-zh"], [class*="-en"]').forEach(el => {
    if (el.classList.contains('lang-btn')) return;
    const hasZh = Array.from(el.classList).some(c => c.endsWith('-zh'));
    const hasEn = Array.from(el.classList).some(c => c.endsWith('-en'));
    if (hasZh) {
      el.style.display = isZh ? '' : 'none';
    } else if (hasEn) {
      el.style.display = isZh ? 'none' : '';
    }
  });

  // Update rendered content
  const md = isZh ? CLAUDE_MD_ZH : CLAUDE_MD_EN;
  document.getElementById('claude-md-rendered').innerHTML = renderMarkdown(md);
}

function copyClaudeMd() {
  const content = currentLang === 'zh' ? CLAUDE_MD_ZH : CLAUDE_MD_EN;

  function showCopied() {
    document.querySelectorAll('.nav-copy-btn, .claude-copy-btn').forEach(btn => {
      const originalHTML = btn.innerHTML;
      btn.classList.add('copied');
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg><span>' + (currentLang === 'zh' ? '已复制!' : 'Copied!') + '</span>';
      setTimeout(() => {
        btn.classList.remove('copied');
        btn.innerHTML = originalHTML;
      }, 2000);
    });
  }

  function fallbackCopy() {
    const textarea = document.createElement('textarea');
    textarea.value = content;
    textarea.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      showCopied();
    } catch (e) {
      alert(currentLang === 'zh' ? '复制失败，请手动选择复制' : 'Copy failed, please select and copy manually');
    }
    document.body.removeChild(textarea);
  }

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(content).then(showCopied).catch(fallbackCopy);
  } else {
    fallbackCopy();
  }
}

/* ── Whimsy: Reading Progress Bar ─────────── */
function initProgressBar() {
  const bar = document.querySelector('.reading-progress');
  if (!bar) return;
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        const scrollTop = window.scrollY;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        bar.style.width = (docHeight > 0 ? (scrollTop / docHeight) * 100 : 0) + '%';
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });
}

/* ── Whimsy: Terminal Cursor ─────────────── */
function initTerminalCursor() {
  const terminalBody = document.querySelector('.terminal-body');
  if (!terminalBody) return;
  const cursor = document.createElement('span');
  cursor.className = 'terminal-cursor';
  cursor.setAttribute('aria-hidden', 'true');
  const lastDiv = terminalBody.querySelector('div:last-of-type, .terminal-cmd:last-of-type');
  if (lastDiv) {
    lastDiv.appendChild(cursor);
  } else {
    terminalBody.appendChild(cursor);
  }
}

/* ── Whimsy: Footer Easter Egg ────────────── */
function initEasterEgg() {
  const logo = document.querySelector('.footer-brand-mark');
  if (!logo) return;
  let clicks = 0;
  let timer = null;
  logo.addEventListener('click', () => {
    clicks++;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { clicks = 0; }, 2000);
    if (clicks >= 3) {
      clicks = 0;
      showEasterEgg();
    }
  });
}

function showEasterEgg() {
  const messages = [
    'Spec-driven development FTW!',
    'Tests write themselves.',
    'Healer says hi!',
    'E2E all the things!',
  ];
  const msg = document.createElement('div');
  msg.className = 'easter-egg-message';
  msg.textContent = messages[Math.floor(Math.random() * messages.length)];
  msg.setAttribute('role', 'status');
  document.body.appendChild(msg);
  setTimeout(() => {
    msg.style.opacity = '0';
    msg.style.transition = 'opacity 300ms';
    setTimeout(() => msg.remove(), 300);
  }, 2500);
}

/* ── Whimsy: Copy Celebration Sparkles ────── */
function initCopyCelebration() {
  document.querySelectorAll('.nav-copy-btn, .claude-copy-btn').forEach(btn => {
    btn.addEventListener('click', createSparkles);
  });
}

function createSparkles(e) {
  const sparkles = ['✦', '✧'];
  const rect = e.currentTarget.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  sparkles.forEach((s, i) => {
    setTimeout(() => {
      const el = document.createElement('span');
      el.className = 'copy-sparkle';
      el.textContent = s;
      el.setAttribute('aria-hidden', 'true');
      el.style.left = (cx + (Math.random() - 0.5) * 60) + 'px';
      el.style.top = (cy + (Math.random() - 0.5) * 30) + 'px';
      el.style.fontSize = (0.7 + Math.random() * 0.8) + 'rem';
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 1000);
    }, i * 60);
  });
}

// Initialize language switch buttons + reveal-on-scroll
document.addEventListener('DOMContentLoaded', () => {
  // Populate initial CLAUDE.md content
  setLanguage('zh');

  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => setLanguage(btn.dataset.lang));
  });

  // IntersectionObserver: reveal elements as they enter viewport
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.05 }
    );
    document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
  } else {
    document.querySelectorAll('.reveal').forEach((el) => el.classList.add('in-view'));
  }

  // Whimsy: init playful features
  initProgressBar();
  initTerminalCursor();
  initEasterEgg();
  initCopyCelebration();
  initNavScrolled();
  initTypewriter();
});

/* ── Motion preference ────────────────────── */
function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/* ── Nav border materializes once the page has scrolled ── */
function initNavScrolled() {
  const nav = document.querySelector('nav');
  if (!nav) return;
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 8);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
}

/* ── Terminal typewriter: first command types in, the rest rise in sequence ── */
function initTypewriter() {
  const body = document.querySelector('.terminal-body');
  if (!body) return;
  const first = body.querySelector('.terminal-cmd[data-type]');
  const hidden = body.querySelectorAll('.t-hidden');
  if (!first) {
    hidden.forEach(el => el.classList.add('t-shown'));
    return;
  }

  const finish = () => {
    first.textContent = first.getAttribute('data-type');
    hidden.forEach((el, i) => setTimeout(() => el.classList.add('t-shown'), 120 + i * 140));
  };

  if (prefersReducedMotion()) {
    finish();
    return;
  }

  const type = () => {
    const text = first.getAttribute('data-type');
    let i = 0;
    const timer = setInterval(() => {
      first.textContent = text.slice(0, ++i);
      if (i >= text.length) {
        clearInterval(timer);
        finish();
      }
    }, 34);
  };

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          io.unobserve(entry.target);
          type();
        }
      });
    }, { threshold: 0.4 });
    io.observe(body);
  } else {
    type();
  }
}


/* ── Live npm downloads ───────────────────── */
/* Monthly window point from the public npm API (CORS-open, npm-side
   cached 5 min). Facts stay hidden until fetch succeeds — failed live
   data disappears, it doesn't render a dash. Values cache in localStorage
   for 1h so repeat visitors see numbers instantly; a background refresh
   replaces them.
   Screen readers read the settled aria-label only — the count-up is
   aria-hidden so intermediate frames never reach the accessibility tree. */
const DL_CACHE_KEY = 'ospw-downloads-v1';
const DL_CACHE_TTL = 60 * 60 * 1000; // 1h

function formatDownloads(n) {
  return n.toLocaleString('en-US');
}

function setLiveAria(month) {
  const fact = document.querySelector('[data-live-fact]');
  if (fact) fact.setAttribute('aria-label', `Downloads ${formatDownloads(month)} per month`);
}

function revealLiveStats(month, animate) {
  document.querySelectorAll('[data-live-fact]').forEach(el => el.classList.add('is-live'));
  document.querySelectorAll('[data-live-sep]').forEach(el => { el.style.display = ''; });
  const monthEl = document.getElementById('dl-month');
  if (monthEl) animate ? countUp(monthEl, month) : (monthEl.textContent = formatDownloads(month));
  setLiveAria(month);
}

function countUp(el, target) {
  if (prefersReducedMotion()) {
    el.textContent = formatDownloads(target);
    return;
  }
  const start = performance.now();
  const duration = 600;
  function tick(now) {
    const p = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
    el.textContent = formatDownloads(Math.round(target * eased));
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

async function fetchDownloads() {
  const pkg = 'openspec-playwright';
  const res = await fetch(`https://api.npmjs.org/downloads/point/last-month/${pkg}`, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) return null;
  const month = (await res.json()).downloads;
  if (typeof month !== 'number') return null;
  return { month };
}

async function initDownloads() {
  // Warm cache: show instantly, then refresh in the background.
  try {
    const cached = JSON.parse(localStorage.getItem(DL_CACHE_KEY) || 'null');
    if (cached && Date.now() - cached.at < DL_CACHE_TTL) {
      revealLiveStats(cached.month, false);
    }
  } catch { /* corrupt cache — ignore, fresh fetch decides */ }

  try {
    const fresh = await fetchDownloads();
    if (!fresh) return;
    try { localStorage.setItem(DL_CACHE_KEY, JSON.stringify({ ...fresh, at: Date.now() })); } catch { /* storage unavailable */ }
    revealLiveStats(fresh.month, true);
  } catch {
    /* fetch failed or timed out — live facts stay hidden (or show cached) */
  }
}
initDownloads();
