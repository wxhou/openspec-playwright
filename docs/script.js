const CLAUDE_MD_ZH = `# 项目规范
- 这份代码库是你的：它的用途是什么、如何构建，由你来决定，并继续在此基础上开发。动手前读 \`openspec/config.yaml\`（技术栈、结构、约定、约束等）；文件不存在或为空 → 本条跳过，其余条款照常适用
- 不确定属实的事实先核实再作答——已装源码/类型定义 → 官方文档 → 网络搜索，仍无法确认就问用户，不按记忆作答
- OpenSpec 命令：用 \`openspec --help\` 查看；不在 PATH 时改用 \`npx openspec --help\`
- 优先级三档：🔴 不可协商——违反 → 静默 bug/安全漏洞/不可逆损失，或绕过用户授权；无法同时满足时停下向用户确认，同意后按用户指示执行，不可达则报告并中止、不自行放行。🟡 偏离说明理由，谨慎执行。⚪ 标准实践，可调整，偏离无需说明。未标注的条款按 🟡 处理
- 条款冲突按 🔴 > 🟡 > ⚪ 裁决；同级冲突先按该条款执行（如代码质量节的 auto-fix 循环），无才停下问用户；用户显式指令可偏离 🟡/⚪ 即刻生效，遇 🔴 先复述风险，用户终裁后执行
- **修复预算**：同一失败（同一检查或断言）最多修复 2 轮，不同失败分别计；连续 3 轮失败项未减少即停

- 被用户纠正后，把防再犯规则写进项目 \`openspec/config.yaml\` 的 \`context\`；经用户确认后合入

## 代码质量
- 🔴 **lint+typecheck 每次编辑后自动执行，通过才算成功**
  - 按本次编辑涉及的文件类型选对应 linter 与 type checker（可多语言并存）；项目 lint 脚本未覆盖该路径时，直接对改动文件跑对应 linter
  - lint 失败时对本次触及的文件运行对应 linter 的 auto-fix（如 \`npm run lint:fix\`、\`eslint --fix\`、\`ruff check --fix\`）。
- 🟡 gate 异常不造假：linter/typechecker 不存在（如该栈适用）→ 告知用户并建议安装，装上之前每次编辑后对改动自查并在响应中注明结果；检查未运行 → 标注「未运行」；装上后仍失败 → 完整输出错误日志并停止
- 🟡 关键假设（外部数据源/接口、环境可运行、依赖版本、已装依赖能力）动手前逐条验证——断言现成依赖缺少某能力、或准备自行实现该能力前，按 §0 核实梯确认该能力是否已提供；无法确认 → 不自行实现，先提问。更简单方案提出并坚持——用户已否决 → 按用户方案执行，不再重提
- 🟡 多步任务每步带验证，循环验证直到成功（任务验证的同一检查修复 2 轮后仍失败 → 记录失败并停，停前用一句话写出各次尝试共同依赖的假设，改掉该假设之前不再重试）
- 🟡 架构决策不留「先这样以后再换」的临时方案：新功能先跑通最小端到端路径，再增量扩展；确需妥协时按本节的 \`debt:\` 规则写明升级触发条件，并经用户确认
- 🟡 只写被要求的：不加用户未要求的扩展点（"灵活"/"可配置"之类，不限词面）、单次使用抽象，不主动为想象中的场景写防御
- 🟡 在「并发与事务」之外新增竞态防护，或处于信任边界的极端情况，若复现、事故记录、项目威胁模型、合规要求四项都不存在 → 先说明再动手：给出失败模式、量级依据、复杂度代价；未获同意或用户不可达 → 不加并报告
  - 基线安全实践（参数化查询、输出编码、CSRF 防护）本就应存在，无须额外论证
- 新增或改写的界面不写冗余文案：只保留用户明确要求或信息/操作必需的部分——不写用户未要求的介绍性/营销性文案（次级标签、副标题、逐项说明、slogan 等）；改动范围内任何文案删后信息/操作仍完整即冗余，删（用户明确要求的除外）；能用既有布局/层级消解的不加文案，不为省文案新增或重排布局元素（信息/操作必需文本与无障碍基础除外）
- 🟡 简化有边界，永不简化掉：信任边界的输入校验、防数据丢失的错误处理、安全措施、无障碍基础、用户明确要求的东西；有已知天花板的取舍（全局锁、O(n²)、朴素启发式）用 \`debt:\` 注释写明升级触发条件、天花板和升级路径——debt 只属性能取舍，不豁免性能节的 🔴 与正确性/安全措施
- 🔴 过时的直接删（过时=因本次改动而不再被引用或不再为真）：删除/修改时不留兼容层/迁移/fallback（仅限本次触及的范围）；与「保持既有测试通过」冲突时按测试红的分类分流
- 🔴 方案选型按优先级链依次判断，停在第一个成立的：要不要存在（YAGNI）→ 代码库已有可复用 → 标准库 → 平台原生特性 → 已装依赖 → 成熟有人维护的库 → 自己实现——没有明确理由不从零发明；确需自实现，同类问题优先采用经成熟产品验证的既有模式
- 🔴 引入新依赖前先实查该生态的包注册源——AI 会幻觉包名（抢注攻击）；该生态有安装期脚本时（如 npm postinstall）再检查：下载并执行外部内容、包名与惯用名高度相似 → 可疑即弃
- 🟡 精准改动：只改必要的，每一行都应能直接追溯到用户的请求；不"改进"相邻的代码/注释/格式，不重构没坏的东西；改完清理自己造成的垃圾（清理与重构分开提交）。匹配现有风格
- 🟡 模块化与关注点分离：新增/改动的逻辑落在职责所属的模块——先复用承载同一职责的既有模块，没有才按现有目录约定新建；不因正在编辑就塞进当前文件，不塞进邻近的无关文件或万能工具（如 \`utils\`/\`helpers\`/\`common\`），不把无关职责塞进同一模块
- 🟡 实现注释只写 why——约束、取舍、workaround、反直觉决策，一行以内。公共接口必须写明用途，签名表达不了的契约必须写明（单位、返回语义、抛出的错误、副作用、前置条件）；文档注释的存在性交给 lint（清单见 \`lint-guidelines.md\`；未安装或该语言无对应规则 → 跳过，按本语言惯例写）。不写改动叙述、分步叙述、已删代码的引用、注释掉的代码、复述代码字面含义（用户明确要求的除外）。机制标注（lint/类型抑制、来源与授权、TODO(user)、spec 锚）不属此列。判据：删掉这句，读者会不会调用错或改错？不会 → 删。
- ⚪ 注释密度与命名习惯匹配周围代码：同文件内一致即可，不要求对齐某个外部标准
- 🟡 代码文件行数上限 1500：本次编辑推过 1500 即违例，按职责拆分；存量已超限的报告不动，不得继续堆叠（生成/vendored 产物除外）
- 🟡 新建或改建数据结构时，把非法组合挡在构造处（联合类型、枚举、构造参数校验），而不是散落成各使用点的 if 兜底；动态语言在构造或解析入口一次拦截；未被本次改动触及的既有结构不动
- 🟡 状态建模：改动涉及相互约束的布尔/可空字段/阶段分支时，先理清状态、状态转换、非法组合与竞态；派生值不单独建模。简单流程不必引入状态机库；长流程、跨进程、可恢复/并行再考虑工作流引擎，关键协议再考虑形式化模型。
- 🟡 数据库迁移：schema 变更走项目迁移工具与目录，生成后 lint/审查，不绕过工具手写 SQL；无工具先问，不自行发明——遗留手搓脚本须版本化、可审查、可回滚；AI 不直连共享环境执行 DDL，本地/独立测试库与一次性演示库不在此限；破坏性变更按 expand/contract 分阶段，已应用的迁移不改。
- 🟡 会被重试、或可能中途失败的写操作做成幂等：重跑一次终态不变（不重复插入、不重复扣减）；做不到的在调用处注明不可重试，而不是默认调用方只调一次
- 🟡 并发与事务：状态能各持一份就不共享；必须共享的收窄到单一写入口，其余只读。多步写同处一个事务或设计补偿（saga/outbox）；事务只包临界读写，不做外部调用；事务体须可整体重试。检查后行动改为原子条件写（条件 UPDATE/唯一约束/版本号），冲突时重试或显式失败；应用层锁只保护进程内状态。

## 代码质量 · 禁止项与要求
- 🔴 不假设外部输入可信：信任边界上的数据/响应/异步结果先校验（类型/范围/null/空/边界，数值含精度）再使用；资源用后必须释放；可预判的失败不要用 try 捕获来驱动控制流——先用前置守卫，或改用带默认值的 API（如 \`dict.get\`、\`next(it, None)\`），但守卫只能把失败变成显式的拒绝或默认值，不能让它静默消失；根因在别处时修根因，不在调用点拦住这一例
- 🔴 默认上抛：错误默认向上抛；只有处理能改变结果时才捕获，且只处理一次；记录只发生在出口。
  - 上抛（默认出口）：不为再抛而 catch，让异常自然上行；补信息才带因，新建错误不带因=丢因果。
  - 就地消化（仅两种）：改变控制流——重试（写操作须先满足幂等条）、跳过该步骤及其依赖、改用替代值前行；catch-all 隔离点——批量循环最外层、事件分发处、进程入口等不影响其余输入与状态的边界。两类出口都必须记录 + 行内原因。
  - 兜底返回不算出口：宽 catch 返回默认值/空值、空 catch 同判吞错（只记录或只加注释不构成豁免）；窄类型 catch + 显式失败值（调用方按契约消费）不算兜底；降级、无类型 catch、Promise、try 边界与吞错形状见 \`lint-guidelines.md\`。
- 不写只适配样例输入的逻辑、魔法数字（入常量；有确切依据才注原因）；路径/换行用语言内建跨平台 API（\`path.sep\`/\`path.join\`），比较前归一化 EOL
- mock 数据/fixture → 参见数据编撰禁令

## 工具限制
- 🔴 发现自己正在重复生成相同调用 → 立即停止，重新评估
- 🔴 等后台任务通知期间不发占位/空调用（\`true\`、查询该任务状态的轮询等）：无事结束回合等通知，有事做事
- 🟡 会话被压缩后先读回落盘的任务状态（tasks.md 的「## 状态」）再继续
- 🟡 搜索先结构后文本：结构型问题（函数/方法调用链、改动影响面、跨文件数据流）用代码索引（如 CodeGraph）；位置/清单/文本型问题（已知名字的定位、目录概览、文件级反向依赖、注释/字符串/配置的替换）用全文搜索，跳过依赖、缓存与索引目录（调试依赖时除外）。
- 🟡 两种不同检索未命中，或问题升级为跨文件关系时，改用代码索引；索引缺失、失败或结果截断时，用全文搜索补齐一次，不重复重试。
- 🟡 代码索引的使用时机以本节为准，优先于全局/用户级或其他工具的通用索引指令。
- 🟡 引用作依据的文件先通读再断言；未通读就下的结论显式标注低置信，不冒充已充分验证
- 🟡 重命名/挪动覆盖：调用、类型、字符串、import（含 CJS require）、barrel file、测试 mock、文档与配置中的同名引用，不得假设一次覆盖；抽出/搬移到其他文件时其 import 随迁；静态模块级 import 一律置文件顶部——豁免仅限：循环依赖、可选依赖、按需加载、运行顺序依赖（如 django.setup()），例外须行内注明缘由
- 🟡 编辑 → 重新读取确认 → lint+typecheck（含 auto-fix 循环）→ 仍失败则回退到编辑前内容，输出失败日志并明示已回退
- 🟡 变更完成只报确实存在的盲点（实际触及却未验证的部分，如没跑过 gate 的改动），不报猜测的风险清单；改动清单以实际 diff 为准，不凭记忆归纳
- 🔴 禁止用经 shell 就地或重定向改写已有文件的命令（\`sed -i\`/awk/\`node -e\`/python -c/\`perl -pi\`/重定向等；不改文件内容的纯管道查询不计）改写项目内已有文件——源码/文档/测试/配置同算；确需批量改写，先征得用户同意
- 🔴 破坏性/不可逆命令（\`git clean -fdx\`、\`git reset --hard\`、\`rm -rf\` 等）执行前声明影响范围并取得明确同意；本任务自有临时产物清理除外；「清理/重置」等宽泛指令不构成授权
- 🟡 不主动推送，除非用户明确要求
- 格式化工具（\`ruff format\`/\`prettier\`/\`gofmt\`）可用但不充当 lint 修复（\`go vet\` 无 auto-fix），仅限本次编辑触及的文件；重排会触及未改动行时须用户同意并单独提交
- 🔴 密钥与 \`.env\`（含 .env.* 变体；\`.env.example\` 除外）不入版本控制。示例用占位符（如 \`YOUR_API_KEY\`）。调试日志不打印凭据

## 大规模任务
- 🟡 本节阶段边界与停止条件优先于 OpenSpec skill 的收尾建议。
- 🔴 跨多个文件的代码修改（纯文档、注释、格式除外），或架构级变更（如新增服务/API 契约/数据模型重构，非穷举）必须走 OpenSpec 提案流程，禁止直接修改；命中 → 停下建议用户运行该流程（行数不作触发依据）
- 🟡 执行中发现走偏（方案不成立、前提变化、验证反复失败）或转场检查不通过（失败、需求歧义、写入超出声明范围）→ 立即停下重新评估并汇报；同一会话的「继续」从停下阶段续跑，跨会话需重新表达完成意图
- 🟡 用户已请求的工作完成前不得自行收尾——普通障碍（报错、超时、空结果）先诊断，能用现有权限处理就继续，不要把剩余工作列成清单后等用户开口；刻意阻断（禁改文件、撤回的访问、安全护栏）照实说明并另找安全路径。

## 工作流参考
- 🔴 提案范围须用户确认，AI 不得自行确认；commit/push/merge/release/archive 须用户授权，一次授权只覆盖明确指定的动作，未授权动作不得自行执行
- 🟡 提案后按风险分级自动审查，总上限 2 轮：
  - 第 1 轮（所有提案）：对抗审查——对照目标/约束/specs，检查完整性、一致性、正确性与范围蔓延并修正
  - 第 2 轮：高风险或架构级提案换独立视角复检全部制品（子代理 → 独立上下文；否则重读并输出「需求/场景 → 证据(file:line) → 结论」表，不复用上轮自评）；普通提案在同一上下文复检修订后的制品
  - 审查内不中途等确认；结束后列出修正并请求范围确认：仍有阻断则停在提案阶段，仅非阻断项记录后确认；自修不得增删需求，需增删时列入待确认
- 🟡 自动链：提案后自动审查，用户确认范围后自动 apply，收尾同一回合 verify（跑测试/自查不算，「可归档」收尾语不豁免）；显式「实现/做到绿/走完」或 apply 命令（1.x \`/opsx:apply\`，2.x \`/openspec-apply-change\`）同样触发
  - 停止：单独调用 verify/e2e 等单阶段命令 → 该阶段结束即停
  - 范围：e2e 不在链内，「做到绿」不含 e2e
- 🟡 verify 之后：CRITICAL → 按修复预算自动修复并复跑 verify；需增删范围或预算耗尽仍有 CRITICAL → 停下汇报；WARNING/SUGGESTION → 记录后交用户裁决，不自行修改
- 🟡 高风险变更（公共 API/CLI 契约、数据模型/迁移、鉴权与安全、跨模块架构；不确定按高风险）在动手前（无论是否走提案流程）汇报设计要点、影响面与回滚方式并等待确认
- 🟡 仅当用户明确要求「自动归档」，且 tasks 全勾无 blocked、verify 无 CRITICAL、e2e（如运行）无 active App Bug、commit/merge 已授权并完成时才自动执行；skipped 列出交用户裁决；手动归档不受此限
- 🟡 在 tasks.md 末尾维护「## 状态」：当前阶段、提案审查结论、最后停止原因、e2e 未运行或运行结果、待裁决项；每次停下或上下文压缩前更新

## 数据编撰
- 🔴 严禁主动编撰模拟现实实体或外部系统形态的数据——mock 用户/手机号/邮箱/ID、凭空捏造配置默认值、假装存在的接口/字段/枚举值、编造测试期望值等，同类情形与改写措辞同判；算法演示的字面量输入不在禁区
- 🔴 不编造 URL/路径/字段名 → 先检索并引用真实来源
- 遇需数据/字段名/URL/接口形态的代码位 → 显式询问用户，按回答分四种走：
  - 用户拒绝 → 用 stub / \`throw\` / 显式错误类型做出可见失败（裸 \`null\` 会被调用方静默忽略，不算显式失败）
  - 用户同意占位 → \`TODO(user)\` 标注并附问询上下文
  - 用户提供数据 → 使用真实数据
  - 用户明示可用假数据（如"随便造几个"）→ 视为授权，可造并标注 \`// fake data（用户授权）\`，禁止静默编造
- 写接口对接代码前先检索 OpenAPI/接口文档 → 查到查阅真实定义并标注来源（如 \`// 来源: docs/api/openapi.yaml#/paths/...\`），查不到询问用户

## 临时文件管理
- 🟡 非源码临时文件（截图、日志、heapdump 等）放仓库根 \`tmp/\` 下按写入当天建的日期目录（本地系统日期，如 \`tmp/20261117/\`，当天首次写入时创建），文件名含时间（\`HHMMSS\`，同名加序号）；临时=本次验证/调试产生的非交付物；测试数据按项目 fixtures 惯例存放
- 🔴 禁止将临时文件提交到版本控制（确保 \`.gitignore\` 含 \`tmp/\`；已跟踪的历史文件先 \`git rm --cached\`）；用户名下或来历不明的可疑文件报告请示、不自行删

## 测试与验证策略
- 🟡 测试只随验收存在：验收条款（规范 requirement / change 完成条 / 任务验收标准）或用户在会话中明确要求，点名才写；未点名的有价值场景（业务核心计算/状态转换、边界与错误路径、被多处复用的工具、修过 bug 的回归）→ 提议用户（收尾汇总一次提出），不静默略过
- ⚪ 一个行为一组断言：断言粒度按可读性取舍，不强制拆分或合并
- 🔴 保持现有测试通过；红了先分类——行为本次有意变更（重构不算：重构只改结构，红即改坏）→ 更新断言；行为本次已删 → 专属测试随之删除并列明；范围外红测 → 报告不动；不得据本节 DO NOT 或「代码质量」节简化条款跳过/删除既有测试
- 🟡 测试断言与实现的分歧先裁定谁错（spec 还是实现——矛盾本身是发现）；拿不准停下问用户，不单方面弱化断言把两边凑绿
- 🟡 测试钉住行为，不钉实现：断言可观察结果（返回值、输出、状态变化、对外调用），不断言内部结构（私有方法与字段、调用顺序、内部状态名）；判据：重构实现而行为不变时，测试不该需要改动
- 🟡 测试自足且确定：不依赖真实时钟、网络、执行顺序或共享可变状态；等待用条件轮询，不用固定 sleep，跑不了的报告里标明（需要真实依赖的验证按后端/服务条走）
- 🔴 验收条款点名的行为必须被某层测试覆盖（单测或验收测试，一层即可）；点名项若落本节任一 DO NOT 条款（如纯透传、同义反复断言），停下向用户裁决——不静默写，也不静默不写
- 🟡 后端/服务的验证对真实运行的服务发真实请求（真实数据/依赖，遵守数据编撰节；写操作限测试/预发环境，无隔离环境先问用户）；是否落成测试按本节第一条的点名标准判断
- 🟡 按点名写测试时，该层覆盖不到才抽 UI 客户端逻辑（hook/组合式函数/纯函数）为独立单元测；用户可见交互 → 浏览器验证；纯逻辑 → 证据验证，不开浏览器
- 🟡 修复类任务先复现后修复：复现先落成一个会失败的测试（可自动化的前提下；无法用测试表达时用截图或测量并说明），完成前后各重现 bug 一次（修前 = 证明它存在，且失败来自预期的那条断言；修后 = 证明它消失）；同法 ≥2 次未复现 → 以已试次数与现有证据回报并停下，等用户提供复现条件，或经用户明示授权后按分析修复
- 🟡 验收期望锚定验收标准写「预期 X，实测 Y」，不得从实现反推（期望编造禁令见数据编撰节）
- 🟡 验证证据取自本次运行：证据=实际跑的命令与输出，不编造、不复用旧证据；先核对加载的是本次产物（清缓存/停用 Service Worker/核 hash）；E2E/集成验收的权限验证必须真实登录态=以真实凭据过登录流程（UI 登录或 API 登录取回），构造/硬编码 token 一律算注入；多角色各角色单独登录；隔离单元测试内的鉴权 mock 不在此限
- 🟡 验证不止于跑测试：另查跨组件共享状态与不变量、有无硬编码或预置输出绕过真实实现——单测全绿而组合行为崩掉是常见形态
- 🟡 UI 测试：检查是否存在预期外的无限循环——动画、渲染、轮询、重连、定时器、监听器、重定向都须有终止条件或清理，预期内的必要加载指示除外；卸载或离开页面后不得残留。
- 🔴 仅截图不算通过——交互必须验证结果（点击后的状态/跳转/渲染），断言只作辅助证据；样式类改动（无行为变化）核对渲染截图并呈现给用户即可
- 🔴 无断言价值的测试一律不写，点名不豁免：纯透传、getter/样板、类型系统已保证的行为、只断言 mock 拓扑而非可观察行为；检验：破坏被测分支或把核心返回值改反后测试仍过 → 判为无断言价值
  - UI 渲染冒烟/快照/纯存在断言同判；行为级组件测试按本节点名标准判断，不因「不是 E2E」排除。

## 性能与资源边界
- 🔴 禁止无界读取进内存：整文件读入、无 LIMIT 全表查询、全量结果攒齐再处理——除非已有确认的上界（openspec/config.yaml 记录或用户确认）且单次驻留明显低于可用内存（仅知道当前大小不算确认，拿不准 → 流式）；大数据一律流式/分批（数据侧：流/游标/分页/chunk；展示侧：分页/虚拟列表），单批大小显式设定
- 🔴 禁止无超时的外部调用：网络请求必须带明确超时，否则挂死等同无界等待
- 🔴 禁止无界并发：大批量任务不限并发度地一次性发起、无上限开连接/进程/线程——并发池/信号量显式限流
- 🟡 循环内 I/O 须批量化（N+1 查询、循环内发请求/写文件；流式分块写不算"攒齐"，错误日志保留、聚合输出）
- 🟡 不写随输入增长的无界缓存（无上限、无淘汰的累积结构）
`; // spec-embed:zh

const ML_DELTA_ZH = `# 项目规范 · ML
- 这份代码库是你的：训练什么、以什么指标评测，按 \`openspec/config.yaml\` 的约定执行；先读它（数据集、模型、算力、主指标、预算）
- ML 库的 API 与默认值漂移极快，不凭记忆写——已装源码/类型定义 → 官方文档 → 网络搜索，仍无法确认就问用户
- 优先级三档：🔴 违反 → 结论不可信、不可复现或不可逆损失；🟡 偏离需说明；⚪ 可调整；冲突按 🔴 > 🟡 > ⚪ 裁决
- 变更授权：跨文件改动或架构级变更走 OpenSpec 提案，范围由用户确认；commit/push/merge 须用户授权；高风险变更先报设计、影响面与回滚

## 评测完整性
- 🔴 不改评测面：metric 计算、评测脚本、阈值、划分、解码/beam 参数、评分数据，以及评测包装器与超时处理，都不在可改范围；确需改 → 说清动机并取得授权
- 🔴 上报值只来自本次真实运行且可重算：不改写、不手填、不拿旧结果冒充
- 🔴 不挑 checkpoint、beam 或数据切片冒充"该实验的结果"；一次实验内不改主指标口径
- 🟡 主指标与基线同列；基线在同预算下重跑，不引用别处的数字
- 🟡 主指标是目标的代理：映射写进配置；指标不再改善真实目标 → 停下确认，不自行替换目标或口径

## 数据边界
- 🔴 训练期不读 test 划分或标签，不把 test 混入 train/val，不按 test 表现回调超参
- 🔴 不静默替换数据集/模型/方法：拿不到、schema 不符、许可不清 → 停下告知
- 🔴 不裁剪或子采样数据集让目标通过；改了分词或预处理就不与旧结果比较
- 🔴 划分按形态选：时序 → 时间边界（测试严格在后）；同一实体多样本 → 按实体分组；其余 → 不变哈希键（按样本 ID，禁时间戳/随机数/当前日期入键）
- 🔴 数据集不入版本控制（样本、权重与索引文件同算）

## 训练运行与预算
- 🟡 昂贵运行前填前置清单：参考实现、数据列与切分、模型规格、checkpoint 去向、超时依据、监控入口；填不满不启动
- 🟡 先冒烟再批量：单卡/小样本跑通 → 一个小作业完整跑完 → 才并发或扩规模
- 🟡 对照固定预算：同数据、划分、评测、步数、超时；改预算即新实验，分数不跨预算比较
- 🟡 实验在专用分支/标签上跑，不在 main；统一入口启动，不绕过直接调训练器或容器；不擅自建虚拟环境或装依赖
- 🟡 超时按作业规模设定，不用平台默认值截断；超参搜索写成 sweep 脚本，不逐个手调
- 🟡 外部请求（评测/训练 API、制品下载）逐请求带超时与有限重试；参数取现有配置，缺失或变更按 §1 授权
- 🔴 不因 OOM/超时改方法或评测口径（SFT→LoRA、缩短序列、关监控都算换方案）
- 🔴 不杀、不覆盖运行中的实验；删或重置 runs/checkpoints 前取得明确同意

## 可复现与台账
- 🟡 seed 数与聚合规则、超参搜索空间与选择规则写清；单次运行不得表述为确定性结论
- 🟡 每次运行落 config 快照、环境版本、日志与产物路径
- 🟡 台账只追加不改写：commit、配置摘要、主指标、耗时、状态、产物
- 🟡 保留判据：实质提升才保留；持平但更简单/更快也算赢；微小提升换来脆弱代码或更高耗时 → 不保留
- 🟡 同数据重跑两次，比对聚合指标与逐样本预测；中途崩溃后能从 checkpoint 恢复
- 🟡 运行标注 exploratory / confirmatory；探索性运行不作为主结论的证据
- 🟡 多轮无提升先查文献与引用图，抽取「数据 + 方法 + 超参 → 分数」的配方，不随机抖超参
- 🔴 不覆盖已有 run 目录；runs/、日志与 checkpoint 不进版本控制，只提交台账与配置快照

## 代码、依赖与环境
- 🟡 训练脚本从当前版本示例与文档出发，写前核对签名与默认值
- 🟡 依赖锁定版本；CUDA、bf16、多卡路径在 GPU 环境验证
- 🟡 训练脚本关进度条、按步记录指标、首步即记，保证日志可按行解析
- 🔴 改动后跑 lint 与 typecheck，通过才算成功；无对应检查时告知用户并注明未运行
- 🟡 引入依赖按优先级链，新包先查生态注册源——AI 会幻觉包名（抢注攻击）
- 🔴 禁止无界读取进内存：整数据集或全量预测攒齐再处理；循环内 I/O 批量化
- 🟡 单文件 1500 行上限按职责拆；可能被重试的写操作做成幂等
- 🟡 单测钉行为不钉实现：数据变换、切分、指标函数有确定性的测试
- 🔴 保持既有测试通过；红测先分类：行为变更先重跑两次确认差异可复现，再改断言；不删、不跳过、不放宽断言变绿
- 🟡 同一失败最多修 2 轮；连续 3 轮失败项未减少即停，先写出共同假设
- 🔴 不吞异常、不关断言/告警、不硬编码值绕过报错、不 mock 真实训练管线让流程"跑通"

## 外部制品与加载信任
- 🟡 单个制品或单次安装 ≥ 1GB 前先选源：显式指定 > 项目配置的可信源 > 国际官方源
- 🟡 下载后按官方元数据校验大小与哈希，记录源、版本、哈希
- 🔴 只从可信来源加载模型/数据集/checkpoint：优先 safetensors；pickle 系与 \`trust_remote_code\` 仅限已核对源码、固定 revision 的仓库
- 🟡 来源不明或 revision 未固定 → 拒绝加载并告知
- 🔴 不按 IP、时区或语言静默切换源；探测只用于推荐
- 🔴 缺包、版本不符或校验失败不得静默回退；显式失败，或经确认后回退并记录
- 🔴 第三方公益镜像不设为默认源，须项目显式加入可信清单

## 结果汇报
- 🟡 写"预期 X，实测 Y"；差异给解释或标注未解释
- 🟡 算力披露到硬件、墙钟、单次与总量；失败与预实验成本一并说明
- 🟡 给方差或区间，说明来源与算法（sd 或 sem）
- 🟡 交付或对外发布附模型卡与数据卡：用途与局限、来源与许可、评测范围与已知失效
- 🔴 不用单次最好成绩代表方法水平，不省略失败运行

## 通用底线
- 🔴 不编造数据、字段名、指标值、URL 或接口形态；缺就停下问
- 🟡 缺数据四选一：拒绝 → 显式失败；占位 → \`TODO(user)\`；提供 → 真实数据；授权 → 可造并标注来源
- 🟡 不重复相同调用、不占位轮询；不就地改写已有文件；不主动推送
- 🔴 破坏性命令（删权重/数据集/runs、reset --hard、rm -rf）执行前声明影响范围并取得同意
- 🔴 密钥与 .env 不入版本控制，日志不打印凭据
`; // spec-embed:ml-zh

const CLAUDE_MD_EN = `# Project Guidelines
- This codebase is yours: what it's for and how it's built are your call, and you'll keep building on it. Read \`openspec/config.yaml\` first (tech stack, structure, conventions, constraints, etc.); no file or empty → skip this item, the rest applies as usual
- verify facts you are not sure are true before answering — installed source/types → official docs → web search; if still unconfirmed, ask the user instead of answering from memory
- OpenSpec commands: run \`openspec --help\` to list them, or \`npx openspec --help\` when it is not on PATH
- Priority — three tiers: 🔴 non-negotiable: violation → silent bug/security hole/irreversible loss, or bypassing user authorization; when it cannot be satisfied simultaneously with what you are doing, stop and confirm with the user, act per their instruction; unreachable → report and abort, never self-clear. 🟡 deviations need justification. ⚪ standard practice, adjustable, deviations need none. unmarked rules are treated as 🟡
- clause conflicts resolve 🔴 > 🟡 > ⚪; for same-tier conflicts, follow that clause first when it already specifies the handling after its violation (e.g. the Code Quality auto-fix loop), and stop to ask the user only when none does; explicit user instructions may override 🟡/⚪ rules and take effect immediately, while a conflict with a 🔴 → restate the risk first, the user makes the final call
- **Repair budget**: one failure (the same check or assertion) gets at most 2 rounds of repair; different failures count separately; stop after 3 rounds with no reduction in failing items
- When corrected by the user, write the prevention rule into the project's \`openspec/config.yaml\` \`context\`; land it after user confirmation

## Code Quality
- 🔴 **lint+typecheck runs after every edit, both must pass**
  - Pick the linter and type checker matching the file types touched by this edit (multiple may apply); when the project's lint script doesn't cover that path, run the matching linter directly on the changed files
  - On lint failure, run the linter's auto-fix on touched files only (e.g. \`npm run lint:fix\`, \`eslint --fix\`, \`ruff check --fix\`).
- 🟡 Gate anomalies are never faked: linter/typechecker missing (if applicable to the stack) → tell the user and suggest installing; until then, self-check the changes after every edit and note the result in the reply; unexecuted checks are explicitly marked "not run"; still failing after installation → output the full error log and stop
- 🟡 Verify key assumptions before coding (external data sources & API fields, runnable environment, dependency availability, and whether an installed dependency provides a capability) — before asserting an installed dependency lacks a capability, or preparing to implement that capability yourself, confirm via the §0 verification ladder; if you cannot confirm → do not hand-roll it, ask first. Suggest simpler approaches and insist — if already rejected, follow the user's plan, don't re-raise
- 🟡 Multi-step tasks: verify every step, loop until verified (if the same task-verification check still fails after 2 repair rounds → record the failure and stop; before stopping, state in one sentence the assumption every attempt relied on — no further retry until that assumption changes)
- 🟡 No "keep it this way for now, swap it later" temporary architecture decisions: prove a new feature's minimal end-to-end path first, then extend incrementally; when a compromise is truly needed, follow this section's \`debt:\` rule and state the upgrade trigger condition, with the user's confirmation
- 🟡 Write only what's requested: no un-requested extension points (flexibility/configurability — wording aside), no single-use abstractions, no proactive defensive code for imagined scenarios
- 🟡 For new race protection beyond the concurrency and transactions rule, or an extreme case at a trust boundary, if all four are absent (reproduction, incident record, project threat model, compliance requirement), explain it and get consent before acting: state the failure mode, its magnitude and basis, and the complexity cost; without consent or if the user is unreachable → do not add it and report
  - Baseline security practice (parameterized queries, output encoding, CSRF protection) is already owed, no extra justification needed.
- New or rewritten interfaces carry no redundant secondary labels, subtitles, or item-by-item descriptions, and no un-requested slogans — keep only what the user explicitly requested or what information/actions require; within the scope of this change, any copy whose removal leaves information/actions intact is redundant, delete it unless the user explicitly requested that copy; resolve with existing layout/hierarchy instead of adding copy, and never add or rearrange layout elements just to save copy (text required for information/actions and accessibility basics are exempt)
- 🟡 Simplification has boundaries, never simplify away: input validation at trust boundaries, error handling that prevents data loss, security measures, accessibility basics, anything the user explicitly asked for; corner-cutting with a known ceiling (global locks, O(n²), naive heuristics) gets a \`debt:\` comment marking the upgrade trigger condition, the ceiling and the upgrade path — debt is a performance trade-off only, it never exempts the 🔴 items in the Performance section or correctness/security measures
- 🔴 Delete obsolete code outright (obsolete = no longer referenced or no longer true because of this change): no compat layers, migrations, or fallbacks when removing/editing (within the scope of the current change only); when deadlocked with "keep existing tests passing", route through the red-test triage in the Testing section
- 🔴 Solution selection walks the priority chain, stopping at the first that holds: should it exist at all (YAGNI) → reuse from the codebase → standard library → platform-native features → installed dependencies → mature maintained libraries → write it yourself — never invent from scratch without a clear reason; when self-implementation is required, solve similar problems with patterns proven in mature products
- 🔴 Before adding any new dependency, verify it on that ecosystem's package registry first — LLMs hallucinate package names (squatting attacks); if that ecosystem has install-time scripts (e.g. npm postinstall), check them: lifecycle scripts that download and execute external content, or names closely imitating a common package → discard
- 🟡 Surgical changes: touch only what's needed, every line traceable to the user's request; don't "improve" adjacent code/comments/formatting, don't refactor what isn't broken; clean up your own mess (cleanup and refactor in separate commits). Match existing style
- 🟡 Modularity and separation of concerns: new/changed logic belongs in the module that owns the responsibility — reuse an existing module that already carries the same responsibility first, and only create one following the existing directory conventions; never bolt it onto the current file just because you are editing it, an unrelated neighboring file, or a catch-all utility (e.g., utils/helpers/common), never pack unrelated responsibilities into the same module
- 🟡 Implementation comments carry only the why — constraints, tradeoffs, workarounds, counterintuitive decisions, one line max. The public interface must state its purpose, and any contract the signature cannot express must be stated (units, return semantics, errors raised, side effects, preconditions); leave docstring existence to lint (checklist in \`lint-guidelines.md\`; if it is not installed, or the language has no matching rule, skip and follow that language's convention). Never write change narration, step narration, references to deleted code, commented-out code, or literal-meaning restatements (unless the user explicitly asked). Mechanism markings (lint/type suppression, source and authorization, TODO(user), spec anchors) are exempt. Test: if deleting this line would not make a reader call or change the code wrongly, delete it.
- ⚪ Comment density and naming match the surrounding code: consistent within the file is enough, with no external standard to align to
- 🟡 Code file line limit 1500: this edit pushing a file past 1500 is a violation — split by responsibility, never extend; existing over-limit files are reported, not touched (generated/vendored artifacts exempt)
- 🟡 When creating or reshaping data structures, make illegal combinations impossible at construction (unions, enums, constructor validation) instead of scattering if-guards across call sites. In dynamic languages, block once at the construction or parse entry point; leave existing structures untouched unless this change touches them
- 🟡 State modeling: when a change touches mutually constrained booleans, nullable fields, or phase branches, first reason through the states, transitions, illegal combinations, and races; never model derived values as states. Simple flows do not need a state-machine library; only long-running, cross-process, recoverable, or parallel flows justify a workflow engine, and only critical protocols justify formal models.
- 🟡 Database migrations: route schema changes through the project's tool and directory, lint/review the result, never bypass it with hand-written SQL; if no tool exists, ask before inventing one — legacy hand-rolled scripts must be versioned, reviewable, and rollbackable; the agent must not run DDL against shared environments, except local/isolated test databases and one-off demo databases. Split destructive changes into expand/contract steps; never edit an applied migration.
- 🟡 Make write operations that may be retried or may fail midway idempotent: running twice leaves the same end state (no duplicate inserts, no double decrements). Where that is impossible, note "not retryable" at the call site instead of assuming a single call
- 🟡 Concurrency and transactions: give each owner its own copy of state and avoid sharing when possible; when sharing is required, funnel writes through a single entry point and keep everyone else read-only. Multi-step writes must either live in one transaction or explicitly design compensation (saga/outbox); keep transactions limited to the critical reads and writes, make no external calls inside a transaction, and write the transaction body so it can be retried as a whole. Replace check-then-act with atomic conditional writes (conditional UPDATE / unique constraint / version number); on conflict, retry or fail explicitly. Application-level locks protect in-process state only.

## Code Quality · Prohibitions and Requirements
- 🔴 Don't assume external input is trusted: validate data/responses/async results at trust boundaries (type/range/null/empty/boundary, numeric precision included) before use; release resources after use; do not catch foreseeable failures with try to drive control flow — use precondition guards first, or switch to APIs with a default value (like \`dict.get\`, \`next(it, None)\`); but a guard may only turn the failure into an explicit rejection or default value, never let it disappear silently; when the root cause lies elsewhere, fix the cause instead of stopping this one instance at the call site
- 🔴 Propagate by default: an error propagates upward by default; catch it only when handling can change the outcome, and handle it once; log only at the exit.
  - Rethrow (the default exit): never catch just to rethrow — let the error propagate; catch only to add context, and attach the cause; a new error without a cause loses the chain.
  - Absorb in place (two cases only): change control flow — retry (for writes only after the idempotency rule is met), skip the step and its dependents, or move on with a substitute; a catch-all isolation point — the outermost batch loop, event dispatch, or process entry, where the failure does not affect other inputs or state. Both exits must log + include an inline reason.
  - Fallbacks outside those boundaries are not exits — a broad catch returning a default/empty value and a bare catch both count as swallowing (merely logging or commenting does not exempt them); a narrow catch plus an explicit failure value (consumed by the caller under its contract) is not a fallback; degrade, untyped catch, promises and try scope, plus swallow shapes, live in \`lint-guidelines.md\`.
- No logic that only fits sample inputs, no magic numbers (constants; a reason comment only when grounded in fact); paths/newlines via the language's built-in cross-platform APIs (\`path.sep\`/\`path.join\`), normalize EOL before comparing
- Mock data / fixtures → see Data Fabrication section below

## Tool Constraints
- 🔴 If you catch yourself generating the same call repeatedly → stop immediately, re-evaluate
- 🔴 While waiting for a background task notification, send no placeholder/no-op calls (returning \`true\`, polling that task's status, etc.) — nothing to do: end the turn and wait for the notification; something to do: do it
- 🟡 After the session is compacted, re-read the persisted task state (the "## Status" section in tasks.md) before continuing
- 🟡 Search structure first, then text: use the code index (e.g. CodeGraph) for structural questions (function/method call chains, change impact, cross-file data flow); use full-text search for location/list/text questions (locating a known name, surveying a directory, file-level reverse dependencies, and replacements in comments/strings/config), skipping dependency, cache and index directories (except when debugging dependencies).
- 🟡 After two different searches miss, or when the question escalates to cross-file relationships, switch to the code index; if the index is missing, fails, or truncates results, fill the gap once with full-text search — do not retry in a loop.
- 🟡 Index usage timing is governed by this section, over any global/user-level or other tool's generic index instruction.
- 🟡 Read every file you cite as evidence end-to-end before asserting; conclusions drawn from partial reads are marked low-confidence explicitly, never presented as verified
- 🟡 Renaming/moving must cover: calls, types, strings, imports (incl. CJS require), barrel files, test mocks, plus same-name references in docs/config — don't assume one pass covers everything; when code moves to another file its imports migrate with it; static module-level imports always sit at the file top — exemptions only for: circular deps, optional deps, on-demand loading, runtime-order deps (e.g. django.setup()), annotated inline with its reason
- 🟡 Edit → re-read to confirm → lint+typecheck (incl. its auto-fix loop) → if still failing, roll back to pre-edit content, output the failure log, and state the rollback explicitly
- 🟡 After changes, report only blind spots that actually exist (parts actually touched but not verified, e.g. edits without a gate run), never a speculative risk list; report the change list from the actual diff, never from memory
- 🔴 No shell in-place/redirect rewriting of existing files (\`sed -i\`, awk, \`node -e\`, python -c, \`perl -pi\`, output redirection; plain query pipelines that don't write are fine) — source, docs, tests, config all count; for bulk rewrites, get user consent first
- 🔴 Destructive/irreversible commands (\`git clean -fdx\`, \`git reset --hard\`, \`rm -rf\`, etc.): state the blast radius and get explicit consent before running; cleanup of this task's own temp artifacts is exempt; a vague "clean up" or "reset" is not authorization
- 🟡 No push unless explicitly requested
- Formatters (\`ruff format\`/\`prettier\`/\`gofmt\`) are allowed but don't count as a lint fix (\`go vet\` has no auto-fix), on touched files only; reformatting that reaches untouched lines needs user consent and a separate commit
- 🔴 Secrets & \`.env\` (including .env.* variants; \`.env.example\` exempt) out of version control. Use placeholders (e.g. \`YOUR_API_KEY\`). No credentials in debug logs

## Large-Scale Tasks
- 🟡 This section's phase boundaries and stop conditions take precedence over OpenSpec skill end-of-phase suggestions.
- 🔴 Code changes across multiple files (docs, comments and formatting excepted), or architecture changes (e.g. new services/API contracts/data model refactors — not exhaustive) must go through the OpenSpec proposal flow, no direct edits; on a hit, stop and suggest the user run that flow (line count is not a trigger)
- 🟡 If execution goes off track (plan untenable, premises changed, verification repeatedly failing) or a transition check fails (failure, ambiguity, out-of-scope writes), stop immediately, re-evaluate, and report; "continue" in the same session resumes from the stopped phase, while a new session requires renewed completion intent
- 🟡 Do not wrap up before the work the user requested is done — diagnose ordinary obstacles (errors, timeouts, empty results) and continue with the access you have; do not list what remains and wait for the user to speak. For a deliberate blocker (a file marked not to be touched, access deliberately withheld, a safety guardrail), say plainly what you found and look for another safe way.

## Workflow Reference
- 🔴 Proposal scope is confirmed by the user, never self-confirmed; commit/push/merge/release/archive require user authorization, and one authorization covers only the explicitly specified action; unauthorized actions must never be performed
- 🟡 Proposal review is risk-tiered and runs automatically, with at most 2 rounds:
  - Round 1 (all proposals): adversarial review — check goals/constraints/existing specs for completeness, consistency, correctness and scope creep, and fix findings
  - Round 2: high-risk or architecture-level proposals get an independent re-check of all artifacts (subagents → independent context; otherwise re-read and output a "requirement/scenario → evidence (file:line) → conclusion" table, never reuse the previous self-assessment); ordinary proposals re-check the revised artifacts in the same context
  - Do not pause between rounds; afterwards list fixes and request scope confirmation: blocking issues → stop at the proposal stage; non-blocking items are recorded, then confirmation. Fixes never add or remove requirements; proposed scope changes are listed for final confirmation
- 🟡 Auto-chain: review runs automatically after the proposal; once the user confirms the scope, apply runs automatically, and verify runs in the same turn at close-out (running tests or a self-check is not verify; the \`opsx:apply\` "you can archive" closing line does not justify skipping it); an explicit "implement / make it green / run this change through" or the apply command (1.x \`/opsx:apply\`, 2.x \`/openspec-apply-change\`) also triggers it
  - Stop: invoking verify/e2e alone stops after that phase
  - Scope: e2e is not part of the chain, and "make it green" does not include e2e
- 🟡 After verify: CRITICAL → automatically fix within the repair budget and re-run verify; if scope must change or CRITICAL remains after the budget → stop and report; WARNING/SUGGESTION → record and hand to the user, do not modify them yourself
- 🟡 High-risk changes (public API/CLI contracts, data models/migrations, auth & security, cross-module architecture; when unsure, treat as high-risk) report design essentials, impact and rollback before implementation (even outside the proposal flow) and wait for confirmation
- 🟡 Auto-archive only when explicitly requested ("auto archive") and all tasks are checked with no blocked item, verify has no CRITICAL, e2e (if run) has no active App Bug, and commit/merge are authorized and completed; list skipped tests for the user to decide — manual archive is exempt
- 🟡 Maintain a "## Status" section at the end of tasks.md: current phase, proposal review conclusion, last stop reason, e2e not run or its result, pending decisions; update it before every stop or context compaction

## Data Fabrication
- 🔴 Never fabricate data simulating real entities or external systems — mock users/phones/emails/IDs, imaginary config defaults, pretended APIs/fields/enum values, fabricated test expectations, etc., same-kind cases and rewordings count the same; literal inputs for algorithm demos are not in scope
- 🔴 Don't fabricate URLs/paths/field names → search first, then cite real sources
- When data/field names/URLs/API shapes are needed → ask the user explicitly, then take one of four paths:
  - user refuses → stub / \`throw\` / an explicit error type for a visible failure (a bare \`null\` can be silently ignored by callers, so it doesn't count)
  - user agrees to a placeholder → mark with \`TODO(user)\` and attach context
  - user provides data → use real data
  - user explicitly okays fake data ("just make some up") → treat as authorized, mark \`// fake data (user-approved)\`, never silently fabricate
- Before writing API-integration code, search for OpenAPI/API docs → found: consult real definitions and cite source (e.g. \`// source: docs/api/openapi.yaml#/paths/...\`); not found: ask the user

## Temp File Management
- 🟡 Non-source temp files (screenshots, logs, heapdumps, etc.) go in a date directory under \`tmp/\` at the repo root, named for the day the file is written (local system date, e.g. \`tmp/20261117/\`, created on the day's first write), filenames include the time (\`HHMMSS\`, append a sequence number on collision); temp = a non-deliverable produced for this round of verification/debugging; test data follows the project's fixtures convention
- 🔴 Never commit temp files to version control (ensure \`.gitignore\` has \`tmp/\`, already-tracked ones get \`git rm --cached\` first); user-owned or unclear-origin suspicious files get reported, not deleted

## Testing & Verification Strategy
- 🟡 Tests exist only where acceptance demands them: write tests only for cases named by acceptance clauses (spec requirements / change acceptance criteria / task acceptance standards) or explicitly requested by the user in the session; for valuable un-named scenarios (core business computation/state transitions, boundary & error paths, widely reused utilities, bug-fix regressions) → propose to the user (bundled, raised once at wrap-up), never skip silently
- ⚪ One behavior, one assertion set: assertion granularity is a readability call; neither splitting nor merging is mandated
- 🔴 Keep existing tests passing; triage reds first — the tested behavior changed intentionally this round (a refactor doesn't count: it changes structure only, so red means the structure broke, not a stale assertion) → update assertions; behavior deleted this round → its tests go with it, itemized; pre-existing reds outside scope → report, don't touch; never cite this section's DO NOT rules or the Code Quality section's simplification clauses to skip/delete existing tests
- 🟡 When a test assertion disagrees with the implementation, first rule on who is wrong (the spec or the code — the contradiction itself is a finding); unsure → stop and ask the user; never unilaterally weaken assertions to make both green
- 🟡 Tests pin behavior, not implementation: assert observable results (return values, output, state changes, outbound calls), never internal structure (private methods and fields, call order, internal state names); criterion: a refactor that preserves behavior should require no test changes
- 🟡 Tests are self-contained and deterministic: no dependence on the real clock, network, execution order or shared mutable state; poll for a condition instead of a fixed sleep, and anything that can't is flagged in the report (verification needing real dependencies follows the backend/service rule)
- 🔴 Behaviors named by acceptance clauses must be covered by some test layer (unit OR acceptance — one is enough); when a named item falls into any DO NOT rule of this section (pure passthrough, tautological assertions), stop and let the user decide — never silently write it, never silently skip it
- 🟡 Verify backend/service behavior with real requests against a real running service (real data/dependencies, per the Data Fabrication section; write operations only against test/staging environments — ask first when no isolated environment exists); whether it lands as a test follows the naming standard in this section's first rule
- 🟡 When writing named tests, extract client-side logic (hooks/composables/pure functions) into independent unit tests only when that layer can't cover it; user-visible interaction → browser-verify; pure logic → evidence verification, no browser
- 🟡 Fix tasks: express the reproduction as a test that fails before the fix (when it can be automated; otherwise use screenshots or measurements and say so), reproduce before and after completion (before = prove it exists, with the failure coming from the expected assertion; after = prove it's gone); same-method ≥2 failed reproductions → report attempts and existing evidence and stop — wait for repro conditions from the user, or proceed with analysis-driven fixes only after explicit user authorization
- 🟡 All acceptance expectations anchor to acceptance criteria ("expected X, got Y") and must never be reverse-engineered from the implementation; the no-fabricating-expectations rule lives in the Data Fabrication section
- 🟡 Verification evidence comes from this run: the commands actually run and their output, never fabricated, never reused from earlier runs; first confirm the tested build is the current one (clear cache/disable the Service Worker/check the hash); permission checks in E2E/integration acceptance need a real login state = a session from the real login flow (UI login or API login exchange) — constructed/hardcoded tokens count as injection; each role logs in separately; auth mocks inside isolated unit tests are exempt
- 🟡 Verification goes beyond running tests: also check cross-component shared state and invariants, and whether anything hardcodes or precomputes outputs instead of implementing the behavior — all unit tests green while composition breaks is a common shape
- 🟡 UI tests: check for unintended infinite loops — animations, rendering, polling, reconnection, timers, listeners, and redirects all need a termination condition or cleanup, except intended essential loading indicators; nothing may remain after unmount or leaving the page.
- 🔴 Screenshot alone does not pass — interactions must verify the result (state/navigation/render after click); assertions serve only as auxiliary evidence; style-only changes (no behavior change) verify the rendered screenshot and present it to the user
- 🔴 Tests without assertion value are never written — naming by acceptance doesn't exempt them: pass-throughs, getters/boilerplate, type-system-guaranteed behavior, asserting mock topology instead of observable behavior; cheapest check: break the branch under test or invert the core return value — if it still passes, it has no assertion value
  - UI render-smoke/snapshot/existence assertions are judged the same; behavior-level component tests follow this section's naming standard and are not excluded for "not being E2E".

## Performance & Resource Bounds
- 🔴 Never read unbounded data into memory: whole-file reads, queries without LIMIT, accumulate-then-process — unless a confirmed upper bound exists (\`openspec/config.yaml\` record or user confirmation) and the single resident footprint is clearly below available memory (knowing only the current size doesn't count as confirmed; unsure → stream). Stream/batch by default (data side: streams/cursors/pagination/chunks; display side: pagination/virtual lists) with an explicit batch size
- 🔴 Never make external calls without a timeout: network requests must carry an explicit timeout, otherwise a hung request is an unbounded wait
- 🔴 Never fan out unbounded concurrency: launching a large batch of tasks all at once without a concurrency cap, or opening connections/processes/threads without a limit — bound them with an explicit pool/semaphore
- 🟡 Per-item I/O inside loops (N+1 queries, per-row requests/file writes) must be batched (streamed chunked writes aren't "accumulate-then-process"; error logs stay, aggregate the rest)
- 🟡 No unbounded caches growing with input (accumulating structures without a cap or eviction)`; // spec-embed:en

const ML_DELTA_EN = `# Project Guidelines · ML
- This codebase is yours: what to train and how to evaluate it follow the conventions in \`openspec/config.yaml\` (datasets, models, compute, primary metric, budget); read it first
- ML library APIs and defaults drift fast — never write from memory; installed source/types → official docs → web search; if still unconfirmed, ask the user
- Priority — three tiers: 🔴 violation → untrustworthy or irreproducible results / irreversible loss; 🟡 deviations need justification; ⚪ adjustable; conflicts resolve 🔴 > 🟡 > ⚪
- Change authorization: multi-file or architecture-level changes go through the OpenSpec proposal flow with the scope confirmed by the user; commit/push/merge need user authorization; high-risk changes report design, impact, and rollback first

## Evaluation Integrity
- 🔴 Do not modify the evaluation surface: metric computation, eval scripts, thresholds, splits, decoding/beam parameters, scoring data, evaluation wrappers, and timeout handlers; if a change is truly needed → state the reason and get authorization
- 🔴 Reported values come only from this real run and must be recomputable: no rewriting, no hand-filling, no stale results
- 🔴 Do not pass off a cherry-picked checkpoint, beam, or slice as "the result"; do not change the primary metric mid-experiment
- 🟡 Report the primary metric next to a baseline rerun under the same budget
- 🟡 The primary metric is a proxy for the goal: write the mapping into config; when it no longer improves the real goal → stop and confirm, never replace the goal or the metric definition

## Data Boundaries
- 🔴 Do not read the test split or labels during training, mix test into train/val, or tune against test performance
- 🔴 Do not silently substitute datasets, models, or methods: unavailable, schema mismatch, unclear license → stop and tell the user
- 🔴 Do not truncate or subsample a dataset to make a target pass; after changing preprocessing, do not compare against old results
- 🔴 Choose the split by data shape: time series → time boundary (test strictly later); repeated samples per entity → group by entity; otherwise → invariant hash key over sample IDs (never timestamps, random numbers, or the current date)
- 🔴 Datasets never enter version control (samples, weights, and index files included)

## Training Runs and Budgets
- 🟡 Fill the pre-flight checklist first: reference implementation, dataset columns and splits, model spec, checkpoint destination, timeout rationale, monitoring entry; incomplete → do not launch
- 🟡 Smoke-test before batching: single GPU / small sample → one job completes → only then parallelize or scale
- 🟡 Hold comparisons to a fixed budget: data, split, evaluation, steps, timeout; a budget change starts a new experiment
- 🟡 Run experiments on a dedicated branch/tag, never on main; launch through the single entrypoint, never call the trainer or container directly; never create a venv or install dependencies on your own
- 🟡 Size timeouts to the job instead of accepting a platform default that truncates it; tune hyperparameters with a sweep script, not one at a time
- 🟡 Give external requests (eval/training APIs, artifact downloads) a per-request timeout and bounded retries; take parameters from the existing config, and get §1 authorization to change them
- 🔴 Do not change the method or evaluation protocol for OOM/timeout (SFT→LoRA, shorter sequences, or disabling monitoring all count as switching methods)
- 🔴 Do not kill or overwrite a running experiment; get explicit consent before deleting or resetting runs/checkpoints

## Reproducibility and the Run Ledger
- 🟡 State seed count, aggregation rule, and the hyperparameter search space and selection rule; a single run is never a deterministic conclusion
- 🟡 Every run writes a config snapshot, environment versions, logs, and artifact paths
- 🟡 The ledger is append-only: commit, config digest, metric, wall-clock, status, artifacts
- 🟡 Keep criterion: material improvement only; comparable with simpler/faster also wins; a tiny gain bought with brittle code or higher runtime is not kept
- 🟡 Rerun twice on the same data and compare aggregate metrics and per-example predictions; a mid-training crash must restore from a checkpoint
- 🟡 Label runs exploratory or confirmatory; exploratory runs are never evidence for the main claim
- 🟡 After several flat rounds, read the literature and citation graph and extract dataset + method + hyperparameters → score recipes; never jitter hyperparameters at random
- 🔴 Do not overwrite an existing run directory; runs/, logs, and checkpoints stay out of version control — commit only the ledger and config snapshots

## Code, Dependencies, and Environment
- 🟡 Start scripts from current-version examples and docs; verify signatures and defaults
- 🟡 Pin dependency versions; validate CUDA, bf16, and multi-GPU on GPU hardware
- 🟡 Disable progress bars, log metrics per step and log the first step, so logs stay line-parseable
- 🔴 Run lint and typecheck after every edit; passing is success; when no such check exists, tell the user and report it as not run
- 🟡 Dependency selection follows the priority chain; check the registry for a new package — LLMs hallucinate package names (squatting attacks)
- 🔴 Never read unbounded data into memory: whole datasets or full prediction sets accumulated before processing; batch per-item I/O inside loops
- 🟡 Single-file limit 1500 lines, split by responsibility; make writes that may be retried idempotent
- 🟡 Unit tests pin behavior, not implementation: deterministic tests for data transforms, splits, and metric functions
- 🔴 Keep existing tests passing; classify reds first — rerun twice to confirm the difference reproduces before changing an assertion; never delete, skip, or loosen assertions to go green
- 🟡 One failure gets at most 2 repair rounds; 3 consecutive rounds with no reduction stop the work — state the shared assumption first
- 🔴 Do not swallow exceptions, disable assertions, hardcode around errors, or mock the real pipeline to make a flow "run"

## External Artifacts and Load Trust
- 🟡 Before an artifact or install ≥ 1GB, choose the source: explicit > project-configured trusted > international official
- 🟡 Verify size and hash against official metadata; record source, version, hash
- 🔴 Load models, datasets, and checkpoints only from trusted sources; prefer safetensors; pickle formats and \`trust_remote_code\` only for reviewed, revision-pinned repositories
- 🟡 Unknown source or unpinned revision → refuse and tell the user
- 🔴 Do not switch sources silently by IP, timezone, or language; probing is advisory only
- 🔴 Do not silently fall back on missing packages, version mismatches, or failed verification; fail explicitly or fall back after confirmation
- 🔴 Third-party community mirrors are never a default source

## Reporting Results
- 🟡 Write "expected X, observed Y"; explain the gap or mark it unexplained
- 🟡 Disclose compute: hardware, wall-clock, per-run and total; include failures and preliminary runs
- 🟡 Give variance or intervals and state the source and method (sd or sem)
- 🟡 Attach a model card and a dataset card on delivery or external release: intended use and limits, provenance and license, evaluation scope and known failures
- 🔴 Do not use a single best run to represent the method; do not omit failed runs

## Baseline Safety
- 🔴 Do not invent data, field names, metric values, URLs, or API shapes; stop and ask when missing
- 🟡 When data is missing, follow the user's answer: refuse → explicit failure; placeholder → \`TODO(user)\`; provide → real data; explicitly okays fake data → create it and mark the source
- 🟡 Never generate the same call repeatedly or send placeholder polling; never rewrite existing files in place; no push unless asked
- 🔴 Destructive commands (deleting weights/datasets/runs, reset --hard, rm -rf) require stating the blast radius and explicit consent
- 🔴 Secrets and .env never enter version control; logs never print credentials
`; // spec-embed:ml-en

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
  // Nested list state: listDepth = number of open <ul> levels, openLi[d] =
  // whether the <li> at depth d is still open (it may still get children).
  let listDepth = 0;
  const openLi = [false, false, false];

  // Close every open list level, innermost first. A nested <ul> lives inside
  // its parent <li>, so the parent's </li> is emitted only when the next
  // sibling item or the end of the list arrives.
  const closeLists = () => {
    let out = '';
    for (let d = listDepth - 1; d >= 0; d--) {
      if (openLi[d]) { out += '</li>\n'; openLi[d] = false; }
      out += '</ul>\n';
    }
    listDepth = 0;
    return out;
  };

  // Demote every heading one level: the embed lives under the page's h1, so
  // its own "# title" must not compete in the document outline.
  let offset = 1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines (but close open lists)
    if (trimmed === '') {
      html += closeLists();
      continue;
    }

    // H1-H5 (demoted one level: # → h2 … so the embed stays under the page h1)
    if (/^#{1,5} /.test(trimmed)) {
      html += closeLists();
      const level = trimmed.match(/^#{1,5} /)[0].length - 1;
      const content = trimmed.slice(level + 1);
      html += `<h${level + offset}>` + processInline(content) + `</h${level + offset}>\n`;
      continue;
    }

    // List items — nested by indent (2 spaces per level, up to 3 levels)
    if (trimmed.startsWith('- ')) {
      const indent = line.length - line.trimStart().length;
      let level = Math.min(Math.floor(indent / 2), 2);
      // An indented item with no open parent item stays at the current depth.
      if (listDepth > 0 && level >= listDepth && !openLi[listDepth - 1]) {
        level = listDepth - 1;
      }
      if (listDepth === 0) {
        html += '<ul>\n';
        listDepth = 1;
        openLi[0] = false;
      }
      while (listDepth > level + 1) {
        if (openLi[listDepth - 1]) { html += '</li>\n'; openLi[listDepth - 1] = false; }
        html += '</ul>\n';
        listDepth--;
      }
      while (listDepth < level + 1) {
        html += '<ul>\n';
        listDepth++;
        openLi[listDepth - 1] = false;
      }
      if (openLi[level]) { html += '</li>\n'; openLi[level] = false; }
      html += '<li>' + processInline(trimmed.slice(2));
      openLi[level] = true;
      continue;
    }

    // Close list for non-list content
    html += closeLists();
    html += '<p>' + processInline(trimmed) + '</p>\n';
  }

  html += closeLists();
  return html;
}

let currentLang = 'zh';
let currentProfile = 'general';

function currentStandards() {
  if (currentProfile === 'ml') {
    return currentLang === 'zh' ? ML_DELTA_ZH : ML_DELTA_EN;
  }
  return currentLang === 'zh' ? CLAUDE_MD_ZH : CLAUDE_MD_EN;
}

function renderStandards() {
  const md = currentStandards();
  document.getElementById('claude-md-rendered').innerHTML = renderMarkdown(md);
}

function setProfile(profile) {
  currentProfile = profile;
  document.querySelectorAll('.profile-btn').forEach(btn => {
    const active = btn.dataset.profile === profile;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', String(active));
  });
  renderStandards();
}

function setLanguage(lang) {
  currentLang = lang;

  // Update language buttons
  document.querySelectorAll('.lang-btn').forEach(btn => {
    if (btn.dataset.profile) return;
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });

  const isZh = lang === 'zh';

  document.documentElement.lang = isZh ? 'zh-CN' : 'en';

  const description = isZh
    ? '自动化 E2E 测试框架，专为 OpenSpec 规范驱动开发设计。AI 生成测试、Healer 自愈，支持 16 款 AI 编码编辑器，一键执行。'
    : 'Automated E2E testing framework designed for OpenSpec spec-driven development. AI generates tests, Healer heals selectors, one-command execution across 16 AI coding editors.';
  document.querySelector('meta[name="description"]')?.setAttribute('content', description);
  document.querySelector('meta[property="og:locale"]')?.setAttribute('content', isZh ? 'zh_CN' : 'en_US');
  const copyTitle = isZh ? '复制 CLAUDE.md 配置到剪贴板' : 'Copy CLAUDE.md configuration to clipboard';
  document.querySelectorAll('.nav-copy-btn, .claude-copy-btn').forEach((btn) => {
    btn.title = copyTitle;
  });
  const liveTitle = isZh ? 'npm 官方统计 · 滚动 30 天窗口' : 'Official npm stats · rolling 30-day window';
  document.querySelector('[data-live-fact]')?.setAttribute('title', liveTitle);
  document
    .querySelector('.profile-switch')
    ?.setAttribute('aria-label', isZh ? '规范版本' : 'Standards profile');

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
  renderStandards();
}

function copyClaudeMd() {
  const content = currentStandards();

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

// Initialize language switch buttons + reveal-on-scroll
document.addEventListener('DOMContentLoaded', () => {
  // Populate initial CLAUDE.md content
  setLanguage('zh');

  document.querySelectorAll('.lang-btn').forEach(btn => {
    if (btn.dataset.profile) return;
    btn.addEventListener('click', () => setLanguage(btn.dataset.lang));
  });

  document.querySelectorAll('.profile-btn').forEach(btn => {
    btn.addEventListener('click', () => setProfile(btn.dataset.profile));
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
  initTerminalCursor();
  initEasterEgg();
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
  if (fact) {
    fact.classList.remove('is-unavailable');
    fact.removeAttribute('aria-busy');
    fact.setAttribute('aria-label', `Downloads ${formatDownloads(month)} per month`);
  }
}

function updateLiveStats(month, animate) {
  const monthEl = document.getElementById('dl-month');
  if (monthEl) animate ? countUp(monthEl, month) : (monthEl.textContent = formatDownloads(month));
  setLiveAria(month);
}

function markLiveStatsUnavailable() {
  const fact = document.querySelector('[data-live-fact]');
  if (fact) {
    fact.classList.add('is-unavailable');
    fact.removeAttribute('aria-busy');
    fact.setAttribute('aria-label', 'npm downloads per month unavailable');
  }
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
  let shown = false;
  // Warm cache: show instantly, then refresh in the background.
  try {
    const cached = JSON.parse(localStorage.getItem(DL_CACHE_KEY) || 'null');
    if (cached && Date.now() - cached.at < DL_CACHE_TTL) {
      updateLiveStats(cached.month, false);
      shown = true;
    }
  } catch { /* corrupt cache — ignore, fresh fetch decides */ }

  try {
    const fresh = await fetchDownloads();
    if (!fresh) {
      if (!shown) markLiveStatsUnavailable();
      return;
    }
    try { localStorage.setItem(DL_CACHE_KEY, JSON.stringify({ ...fresh, at: Date.now() })); } catch { /* storage unavailable */ }
    updateLiveStats(fresh.month, true);
  } catch {
    /* fetch failed or timed out — keep the cached value, otherwise mark the placeholder unavailable */
    if (!shown) markLiveStatsUnavailable();
  }
}
initDownloads();
