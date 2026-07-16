const CLAUDE_MD_ZH = `# 项目规范
- 动手前读 \`openspec/config.yaml\`（技术栈、结构、约定、约束等），无内容则忽略
- 用中文回复用户
- 优先级：🔴 CRITICAL（违反→静默 bug/安全漏洞，停下确认后执行）｜🟡 IMPORTANT（偏离说明理由，谨慎执行）｜⚪ STANDARD（按标准执行）

## 代码质量
- 🔴 **lint+typecheck 每次编辑后自动执行，通过才算成功**。扫源码扩展名判断主语言：\`.ts\`→ESLint+tsc、\`.py\`→ruff+mypy、\`.go\`→gofmt+vet。工具不存在时告知用户，不假装跑过
- 🟡 不隐藏任何 gate 失败结果——lint / typecheck / test 任一失败时，完整输出错误日志并停止，不继续后续步骤
- ⚪ 未执行的检查步骤明确标注「未运行」，不暗示已通过
- 🟡 需求理解不清或存在可见风险时，先停下来提问，不直接执行。偏离标准实践需说明理由
- 🟡 动手前列假设 → 逐条验证。有不清→停下来，说出困惑，再提问。多解释则全列，更简单方案则提出并坚持
- 🟡 多步任务先列计划（\`1. [Step] → verify: [check]\`），循环验证直到成功。lint 失败时优先 \`npm run lint:fix\`
- 🟡 只写被要求的：不加"灵活"/"可配置"/单次使用抽象。200行能50行则重写
- 🟡 精准改动：只改必要的，改完清理自己造成的垃圾。匹配现有风格
- 🟡 代码文件行数上限 1500：超过即违例，按职责拆分，不得继续堆叠
- ⚪ 重构前清理未使用的 import/export/prop/console.log，单独提交再做重构

## 禁止非通用性改动
- 不写只适配特定输入值的逻辑 → 上游格式变化即失效
- 不假设外部数据有效 → 校验类型/范围/null，处理空/异常/边界值，防 NPE 和注入
- 不假设异步/外部操作一定成功 → 网络/磁盘/下游随时可能失败
- 不假设响应结构一定如预期 → 先校验再访问深层属性
- 不假设精度/范围安全 → 计算前确认安全范围
- 不假设资源自动释放 → 文件/连接/cursor 用后必须释放
- 不写魔法数字 → 用常量或枚举并注释原因
- 不断言具体值（除非明确要求）→ 脆性断言，换环境即碎
- linter/typechecker 不存在 → 告知用户并建议安装
- mock 数据/fixture → 参见数据编撰禁令
- 涉及 API 定义 → 查阅真实 OpenAPI/MCP 定义并标注来源

## 上下文管理
- 🟡 超过 500 行文件：分次读取或编辑前重新读取完整内容
- 🟡 上下文压缩恢复后：git status → 重读 proposal/design/tasks → 对照 design 检查 → lint+typecheck → 继续
- 禁止跨阶段跳步（explore→apply→verify→e2e 由用户触发）
- 禁止跨 change 改动，禁止顺手清理其他 open change → 告知用户，由用户决定
- ⚪ 超过 10 条消息后，编辑任何文件前强制重新读取

## 工具限制
- 🟡 搜索要全：Grep 搜内容 + Glob 搜文件名，两者缺一不可。跳过 node_modules/vendor/__pycache__（调试依赖时除外），搜子目录时按需缩小
- 🟡 重命名覆盖：调用、类型、字符串、import、barrel file、测试 mock，不得假设一次覆盖
- 不假设单次 grep 覆盖所有情况（glob 可能漏嵌套文件或非标准扩展名）
- 🟡 联网调研优先 agent-reach skill
- 🟡 涉及前端 UI 设计时，按序使用：frontend-design skill 定方向 → ui-ux-pro-max skill 选风格 → web-design-guidelines skill 审查，三步组合避免"千篇一律 AI 风"
- 🟡 编辑 → 重新读取确认 → lint+typecheck → 任一失败则回退
- 🟡 变更完成告知用户可能遗漏区域，提示人工复查
- 禁止用 sed/awk/node -e/python -c 等管道命令改源码文件
- 不主动推送，除非用户明确要求
- 格式化工具（ruff fmt/prettier 除外——不改语义）
- 密钥与 .env 不入版本控制。示例用占位符（如 \`YOUR_API_KEY\`）。调试日志不打印凭据

## 大规模任务
- 🔴 200+ 行修改或架构变更（新增服务/API 契约/数据模型重构）必须走 OpenSpec（\`/opsx:propose\`），禁止直接修改

## 工作流参考
- 提案→实现→自审→E2E→归档，**所有阶段由用户手动触发，AI 不自动进入下一阶段**
- Superpowers（可选）：\`/plugin install superpowers@claude-plugins-official\`，提供对话式 spec 探索、TDD、subagent 并行实现，不改变主流程

## 数据编撰
- 🔴 严禁主动编撰任何数据填充代码，除非用户明确同意
- 编撰示例：mock 用户/邮箱/手机号、编造测试期望值、凭空出现配置默认值、假装存在的接口/字段/枚举值
- 不编造 URL/路径 → 引用真实来源，勿凭印象编造 endpoint/path/字段名
- 遇需数据的代码位必须显式询问用户
- 用户同意占位 → \`TODO(user)\` 标注并附问询上下文
- 用户提供数据 → 使用真实数据
- 用户拒绝 → 用 stub/throw/null 显式失败，禁止静默编造
- 无论前后端一体还是纯前端，存在 OpenAPI/接口文档 → 查阅真实定义并标注来源（如 \`// 来源: docs/api/openapi.yaml#/paths/...\`）

## 临时文件管理
- 非源码临时文件（截图、日志、heapdump 等）放项目根 \`tmp/\` 下
- 平铺，不分子目录
- 文件名含时间戳
- 超 24h 的文件可在 commit 前删除`;

const CLAUDE_MD_EN = `# Project Guidelines
- Read \`openspec/config.yaml\` first (tech stack, structure, conventions, constraints, etc.); ignore if absent
- Priority: 🔴 CRITICAL (violation → silent bug/security hole, stop and confirm before acting)｜🟡 IMPORTANT (deviations need justification, proceed with caution)｜⚪ STANDARD (follow as standard practice)

## Code Quality
- 🔴 **lint+typecheck runs after every edit, both must pass**. Detect language by extension: \`.ts\`→ESLint+tsc, \`.py\`→ruff+mypy, \`.go\`→gofmt+vet. If tool missing, tell user, don't pretend it ran
- 🟡 Never hide gate failures — when lint, typecheck, or test fails, output the full error log and stop. Do not proceed to subsequent steps.
- ⚪ Unexecuted verification steps must be explicitly marked "not run", never implied as passed
- 🟡 When requirements are unclear or risks are visible, pause and ask before executing. Deviations from standard practice must be justified.
- 🟡 List assumptions before coding → verify each one. If unclear → stop, express confusion, then ask. Present all interpretations; suggest simpler approaches and insist
- 🟡 Multi-step tasks: plan first (\`1. [Step] → verify: [check]\`), loop until verified. On lint failure, run \`npm run lint:fix\` first
- 🟡 Write only what's requested: No flexibility/configurability/single-use abstractions. Rewrite if 200 lines can be 50
- 🟡 Surgical changes: Touch only what's needed, clean up your own mess. Match existing style
- 🟡 Code file line limit 1500: over 1500 is a violation — split by responsibility, never extend
- ⚪ Before refactoring, clean unused imports/exports/props/console.log in a separate commit

## No Non-Generic Changes
- Don't write logic that only fits specific input values → breaks when upstream format changes
- Don't assume external data is valid → validate type/range/null, handle empty/edge/boundary values, prevent NPE and injection
- Don't assume async/external ops always succeed → network/disk/downstream may fail anytime
- Don't assume response structure stays as expected → validate before accessing deep properties
- Don't assume precision/range safety → verify range before computation
- Don't assume resources auto-release → files/connections/cursors must be released
- No magic numbers → use constants or enums with comments
- Don't assert specific values (unless explicitly requested) → brittle, breaks across environments
- If linter/typechecker missing → tell user and suggest installing
- Mock data / fixtures → see Data Fabrication section below
- API definitions → consult real OpenAPI/MCP definitions and cite sources

## Context Management
- 🟡 Files over 500 lines: read in parts or re-read fully before editing
- 🟡 After context compression: git status → re-read proposal/design/tasks → check implementation against design → lint+typecheck → continue
- No跨-stage jumps (explore→apply→verify→e2e triggered by user)
- No跨-change edits during \`/opsx:apply <X>\`, no "cleanup" other open changes
- ⚪ After 10+ messages: force re-read any file before editing

## Tool Constraints
- 🟡 Search comprehensively: Grep for content + Glob for filenames. Skip node_modules/vendor/__pycache__ (except when debugging deps); narrow scope in subdirectories
- 🟡 Renaming must cover: calls, types, strings, imports, barrel files, test mocks — don't assume one pass covers everything
- Don't assume one grep covers everything — glob patterns may miss nested files or non-standard extensions
- 🟡 Web research via agent-reach skill
- 🟡 When doing frontend UI work, use in order: frontend-design skill (direction) → ui-ux-pro-max skill (style selection) → web-design-guidelines skill (auto-review), three-step combo to avoid "generic AI look"
- 🟡 Edit → re-read to confirm → lint+typecheck → rollback on any failure
- 🟡 After changes, inform user of areas that may be missed, prompt manual review
- No sed/awk/node -e/python -c pipelines for source edits (bypasses edit tool validation)
- No push unless explicitly requested
- Formatters allowed (ruff fmt/prettier — don't change semantics)
- Secrets & .env out of version control. Use placeholders (e.g. \`YOUR_API_KEY\`). No credentials in debug logs

## Large-Scale Tasks
- 🔴 200+ line changes or architecture changes (new services/API contracts/data model refactors) must use OpenSpec (\`/opsx:propose\`), no direct edits

## Workflow Reference
- Propose→Apply→Verify→E2E→Archive, **all phases manually triggered by user, AI does not auto-advance**
- Superpowers (optional): \`/plugin install superpowers@claude-plugins-official\` — conversational spec exploration, TDD, subagent parallel execution, doesn't change main flow

## Data Fabrication
- 🔴 Never fabricate any data to fill code without explicit user consent
- Examples: mock users/emails/phone numbers, fabricated test expectations, imaginary config defaults, pretended APIs/fields/enum values
- Don't fabricate URLs/paths → cite real sources, don't guess endpoints/paths/field names
- When data is needed → ask user explicitly
- User agrees → mark with \`TODO(user)\` and attach context
- User provides data → use real data
- User refuses → use stub/throw/null for explicit failure, never silently fabricate
- Full-stack or pure frontend — if OpenAPI/docs exist → consult real definitions and cite source (e.g. \`// source: docs/api/openapi.yaml#/paths/...\`)

## Temp File Management
- Non-source temp files (screenshots, logs, heapdumps, etc.) go in \`tmp/\` at project root
- Flat layout, no subdirectories
- Filenames include timestamp
- Files older than 24h may be deleted before commit`;

function processInline(text) {
  // **bold** → <strong>
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // `code` → <code>
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
  // [text](url) → <a>
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  return text;
}

function renderMarkdown(md) {
  const lines = md.split('\n');
  let html = '';
  let inList = false;

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

    // H1
    if (trimmed.startsWith('# ')) {
      if (inList) { html += '</ul>\n'; inList = false; }
      html += '<h1>' + processInline(trimmed.slice(2)) + '</h1>\n';
      continue;
    }

    // H2
    if (trimmed.startsWith('## ')) {
      if (inList) { html += '</ul>\n'; inList = false; }
      html += '<h2>' + processInline(trimmed.slice(3)) + '</h2>\n';
      continue;
    }

    // H3-H6
    if (/^#{3,6} /.test(trimmed)) {
      if (inList) { html += '</ul>\n'; inList = false; }
      const level = trimmed.match(/^(#{3,6}) /)[1].length;
      const content = trimmed.slice(level + 1);
      html += `<h${level}>` + processInline(content) + `</h${level}>\n`;
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
    if (el.className.includes('-zh')) {
      el.style.display = isZh ? '' : 'none';
    } else if (el.className.includes('-en')) {
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

  // Magnetic effect for primary CTA: button follows cursor within 60px
  document.querySelectorAll('.btn-primary').forEach((btn) => {
    btn.addEventListener('mousemove', (e) => {
      const rect = btn.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      btn.style.transform = `translate(${x * 0.15}px, ${y * 0.15}px) translateY(-2px)`;
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = '';
    });
  });
});
