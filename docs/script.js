const CLAUDE_MD_ZH = `# 项目规范
- 动手前读 \`openspec/config.yaml\`（技术栈、结构、约定、约束等），无内容则忽略
- OpenSpec 命令：跑 \`npx openspec --help\` 查看
- 优先级：🔴 CRITICAL（违反→静默 bug/安全漏洞，停下确认后执行）｜🟡 IMPORTANT（偏离说明理由，谨慎执行）｜⚪ STANDARD（按标准执行）

## 代码质量
- 🔴 **lint+typecheck 每次编辑后自动执行，通过才算成功**。扫源码扩展名判断主语言：\`.ts\`→ESLint+tsc、\`.py\`→ruff+mypy、\`.go\`→gofmt+vet 等。工具不存在时告知用户，不假装跑过
- 🟡 不隐藏任何 gate 失败结果——lint / typecheck / test 任一失败时，完整输出错误日志并停止，不继续后续步骤
- ⚪ 未执行的检查步骤明确标注「未运行」，不暗示已通过
- 🟡 需求理解不清或存在可见风险时，先停下来提问，不直接执行。偏离标准实践需说明理由
- 🟡 动手前列假设 → 逐条验证。需求不清或有风险 → 停下来提问。多解释则全列，更简单方案则提出并坚持
- 🟡 多步任务先列计划（\`1. [Step] → verify: [check]\`），循环验证直到成功。lint 失败时优先运行对应语言的 auto-fix（如 \`npm run lint:fix\` / \`ruff format .\` / \`go fmt ./...\`）
- 🟡 只写被要求的：不加"灵活"/"可配置"/单次使用抽象，不为想象中的场景写防御。200行能50行则重写
- 🔴 过时的直接删：删除/修改时不留兼容层、不写迁移、不留 fallback
- 🔴 方案选型按优先级链：项目已有依赖 → 成熟有人维护的库 → 自己实现；同类问题先用成熟产品验证过的模式解决
- 🟡 精准改动：只改必要的，改完清理自己造成的垃圾。匹配现有风格
- 🟡 注释纪律：只写代码无法表达的 why（约束、workaround 原因、反直觉决策）；改动叙述（原来/现在/不再/已删除等）、对已删代码的引用、注释掉的代码一律不留——历史归 git log；改动时顺手删掉已失效的相邻注释；spec 锚与 TODO(user) 属机制标注，不在其列
- 🟡 代码文件行数上限 1500：超过即违例，按职责拆分，不得继续堆叠
- ⚪ 重构前清理未使用的 import/export/prop/console.log 等，单独提交再做重构

## 禁止非通用性改动
- 不写只适配特定输入值的逻辑
- 不假设外部数据有效 → 校验类型/范围/null，处理空/异常/边界值，防 NPE 和注入
- 不假设异步/外部操作一定成功
- 不假设响应结构一定如预期 → 先校验再访问深层属性
- 不假设精度/范围安全 → 计算前确认安全范围
- 不假设资源自动释放 → 文件/连接/cursor 用后必须释放
- 不写魔法数字 → 用常量或枚举并注释原因
- 不断言具体值（除非明确要求）→ 脆性断言
- 不假设平台路径分隔符与换行格式 → 用语言内建跨平台 API（\`path.sep\`/\`path.join\`），比较前归一化 EOL
- linter/typechecker 不存在 → 告知用户并建议安装
- mock 数据/fixture → 参见数据编撰禁令

## 工具限制
- 🔴 发现自己正在重复生成相同调用 → 立即停止，重新评估
- 🟡 长会话接近上下文上限时，复杂任务前先压缩上下文
- 🟡 搜索分层：结构性问题（定义/调用/影响/流）优先用 CodeGraph；字面文本用全文搜索；文件名模式用文件名匹配。跳过依赖目录和缓存目录（调试依赖时除外），搜子目录时按需缩小
- 🟡 重命名覆盖：调用、类型、字符串、import、barrel file、测试 mock，不得假设一次覆盖
- 🟡 编辑 → 重新读取确认 → lint+typecheck → 任一失败则回退
- 🟡 变更完成告知用户可能遗漏区域，提示人工复查
- 🔴 禁止用 sed/awk/node -e/python -c 等管道命令改写项目内已有文件——源码/文档/测试/配置同算（跳过编辑工具验证层）；确需批量改写，先征得用户同意
- 不主动推送，除非用户明确要求
- 可用不改语义的格式化工具（ruff fmt/prettier）
- 密钥与 .env 不入版本控制。示例用占位符（如 \`YOUR_API_KEY\`）。调试日志不打印凭据

## 大规模任务
- 🔴 200+ 行修改或架构变更（新增服务/API 契约/数据模型重构）必须走 OpenSpec（\`/opsx:propose\`），禁止直接修改

## 工作流参考
- 提案→实现→自审→E2E→归档，**所有阶段由用户手动触发，AI 不自动进入下一阶段**

## 数据编撰
- 🔴 严禁主动编撰任何数据填充代码，除非用户明确同意
- 编撰示例：mock 用户/邮箱/手机号、编造测试期望值、凭空出现配置默认值、假装存在的接口/字段/枚举值
- 不编造 URL/路径/字段名 → 引用真实来源
- 遇需数据的代码位必须显式询问用户
- 用户同意占位 → \`TODO(user)\` 标注并附问询上下文
- 用户提供数据 → 使用真实数据
- 用户拒绝 → 用 stub/throw/null 显式失败，禁止静默编造
- 存在 OpenAPI/接口文档 → 查阅真实定义并标注来源（如 \`// 来源: docs/api/openapi.yaml#/paths/...\`）

## 临时文件管理
- 🟡 非源码临时文件（截图、日志、heapdump 等）放项目根 \`tmp/\` 下，文件名含时间戳（如 \`screenshot-20260721T143000.png\`）
- 🔴 禁止将临时文件提交到版本控制；超 24h 的文件应在 commit 前删除

## 测试与验证策略
- 🟡 改了用户可见可交互的东西（DOM/交互/跳转/异步渲染/样式/响应式、守卫/权限/多角色可见性）→ 浏览器验证；纯逻辑 → 按单测取舍，不开浏览器
- 🟡 值得单测：业务核心计算/状态转换、含分支的纯函数、边界与错误处理路径、被多处复用的工具、修过 bug 的回归；模糊地带默认测（UI 组件除外），一个行为一组断言
- 🔴 验收标准点名的行为与业务核心逻辑必须被某层测试覆盖（单测或验收测试，一层即可）；不以本条为由跳过/删除既有测试
- 🔴 后端/服务 → 对真实运行的服务发真实请求验证契约与端到端行为，落成集成测试（真实数据/依赖，遵守数据编撰节）
- 🟡 验收期望锚定 spec/验收标准写「预期 X，实测 Y」（期望编造禁令见数据编撰节）
- 🔴 UI 组件：值得测的客户端逻辑（自定义 hook / 组合式函数 / 纯函数）抽为可独立测试的单元按单测清单测
- 🟡 验证前核对加载的是本次产物（清缓存/停用 SW/核 hash）；权限类必须真实登录态（禁止注入 token），多角色各角色单独登录
- 🔴 禁止生成 UI 组件测试：渲染冒烟、快照、纯存在断言——UI 行为只归浏览器验证
- 🔴 仅截图不算通过——交互必须验证结果（点击后的状态/跳转/渲染），断言只作辅助证据
- 🟡 禁止生成单测：纯透传、getter/装饰器/样板、类型系统已保证的行为、框架自带行为、期望从实现反推的同义反复断言、只断言 mock 调用拓扑而非可观察行为、无有效断言的纯执行`;

const CLAUDE_MD_EN = `# Project Guidelines
- Read \`openspec/config.yaml\` first (tech stack, structure, conventions, constraints, etc.); ignore if absent
- OpenSpec commands: run \`npx openspec --help\` to list them
- Priority: 🔴 CRITICAL (violation → silent bug/security hole, stop and confirm before acting)｜🟡 IMPORTANT (deviations need justification, proceed with caution)｜⚪ STANDARD (follow as standard practice)

## Code Quality
- 🔴 **lint+typecheck runs after every edit, both must pass**. Detect language by extension: \`.ts\`→ESLint+tsc, \`.py\`→ruff+mypy, \`.go\`→gofmt+vet, etc. If tool missing, tell user, don't pretend it ran
- 🟡 Never hide gate failures — when lint, typecheck, or test fails, output the full error log and stop. Do not proceed to subsequent steps.
- ⚪ Unexecuted verification steps must be explicitly marked "not run", never implied as passed
- 🟡 When requirements are unclear or risks are visible, pause and ask before executing. Deviations from standard practice must be justified.
- 🟡 List assumptions before coding → verify each one. If unclear → stop and ask. Present all interpretations; suggest simpler approaches and insist
- 🟡 Multi-step tasks: plan first (\`1. [Step] → verify: [check]\`), loop until verified. On lint failure, run the language's auto-fix first (e.g. \`npm run lint:fix\` / \`ruff format .\` / \`go fmt ./...\`)
- 🟡 Write only what's requested: No flexibility/configurability/single-use abstractions, no defensive code for imagined scenarios. Rewrite if 200 lines can be 50
- 🔴 Delete obsolete code outright: no compat layers, migrations, or fallbacks when removing/editing
- 🔴 Solution selection follows the priority chain: existing project deps → mature maintained libraries → write it yourself; solve similar problems with proven patterns first
- 🟡 Surgical changes: Touch only what's needed, clean up your own mess. Match existing style
- 🟡 Comment discipline: write only the why the code cannot express (constraints, workaround reasons, counterintuitive decisions); change narration ("originally/now/no longer/removed" etc.), references to deleted code, and commented-out code are never kept — history belongs in git log; prune adjacent stale comments while editing; machine-readable anchors (spec anchors) and TODO(user) markers are exempt
- 🟡 Code file line limit 1500: over 1500 is a violation — split by responsibility, never extend
- ⚪ Before refactoring, clean unused imports/exports/props/console.log etc. in a separate commit

## No Non-Generic Changes
- Don't write logic that only fits specific input values
- Don't assume external data is valid → validate type/range/null, handle empty/edge/boundary values, prevent NPE and injection
- Don't assume async/external ops always succeed
- Don't assume response structure stays as expected → validate before accessing deep properties
- Don't assume precision/range safety → verify range before computation
- Don't assume resources auto-release → files/connections/cursors must be released
- No magic numbers → use constants or enums with comments
- Don't assert specific values (unless explicitly requested) → brittle
- Don't assume platform path separators or newline formats → use the language's built-in cross-platform APIs (\`path.sep\`/\`path.join\`), normalize EOL before comparing
- If linter/typechecker missing → tell user and suggest installing
- Mock data / fixtures → see Data Fabrication section below

## Tool Constraints
- 🔴 If you catch yourself generating the same call repeatedly → stop immediately, re-evaluate
- 🟡 In long sessions near the context limit, compact context before complex tasks
- 🟡 Search in layers: structural queries (definitions/calls/impact/flow) prefer CodeGraph; literal text → full-text search; filename patterns → filename matching. Skip dependency and cache directories (except when debugging deps); narrow scope in subdirectories
- 🟡 Renaming must cover: calls, types, strings, imports, barrel files, test mocks — don't assume one pass covers everything
- 🟡 Edit → re-read to confirm → lint+typecheck → rollback on any failure
- 🟡 After changes, inform user of areas that may be missed, prompt manual review
- 🔴 No sed/awk/node -e/python -c pipelines for rewriting existing project files — source, docs, tests, config all count (bypasses edit tool validation); for bulk rewrites, get user consent first
- No push unless explicitly requested
- Non-semantic formatters allowed (ruff fmt/prettier)
- Secrets & .env out of version control. Use placeholders (e.g. \`YOUR_API_KEY\`). No credentials in debug logs

## Large-Scale Tasks
- 🔴 200+ line changes or architecture changes (new services/API contracts/data model refactors) must use OpenSpec (\`/opsx:propose\`), no direct edits

## Workflow Reference
- Propose→Apply→Verify→E2E→Archive, **all phases manually triggered by user, AI does not auto-advance**

## Data Fabrication
- 🔴 Never fabricate any data to fill code without explicit user consent
- Examples: mock users/emails/phone numbers, fabricated test expectations, imaginary config defaults, pretended APIs/fields/enum values
- Don't fabricate URLs/paths/field names → cite real sources
- When data is needed → ask user explicitly
- User agrees → mark with \`TODO(user)\` and attach context
- User provides data → use real data
- User refuses → use stub/throw/null for explicit failure, never silently fabricate
- If OpenAPI/API docs exist → consult real definitions and cite source (e.g. \`// source: docs/api/openapi.yaml#/paths/...\`)

## Temp File Management
- 🟡 Non-source temp files (screenshots, logs, heapdumps, etc.) go in \`tmp/\` at project root, filenames include timestamp (e.g. \`screenshot-20260721T143000.png\`)
- 🔴 Never commit temp files to version control; delete files older than 24h before commit

## Testing & Verification Strategy
- 🟡 Anything user-visible/interactive changed (DOM/interaction/navigation/async-render/style/responsive, guards/permissions/multi-role visibility) → browser-verify; pure logic → per unit-test criteria, no browser
- 🟡 Worth unit-testing: core business computation/state transitions, pure functions with branches, boundary & error paths, widely reused utilities, bug-fix regressions; when ambiguous default to testing (UI components excluded), one behavior one assertion set
- 🔴 Behaviors named by acceptance criteria and core business logic must be covered by some test layer (unit OR acceptance — one is enough); never use this rule to skip/delete existing tests
- 🔴 Backend/service → real requests against a real running service to verify contract and end-to-end behavior — lands as integration tests (real data/dependencies, per the Data Fabrication section)
- 🟡 All acceptance expectations anchor to spec acceptance criteria ("expected X, got Y"); the no-fabricating-expectations rule lives in the Data Fabrication section
- 🔴 UI components: extract client-side logic worth testing (custom hooks / composables / pure functions) into independently testable units per the unit-test list
- 🟡 Verify the tested build is the current one; permission checks need a real login state (no token injection); each role logs in separately
- 🔴 Never generate UI component tests: render-smoke, snapshot, or mere-existence — UI behavior belongs to browser verification only
- 🔴 Screenshot alone does not pass — interactions must verify the result (state/navigation/render after click); assertions serve only as auxiliary evidence
- 🟡 Never generate unit tests: pass-through, getters/decorators/boilerplate, type-system-guaranteed behavior, framework built-ins, tautological assertions with expectations reverse-engineered from the implementation, asserting mock call topology instead of observable behavior, execution without effective assertions`;

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

