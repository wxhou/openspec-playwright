const CLAUDE_MD_ZH = `# 项目规范
- 动手前读 \`openspec/config.yaml\`（技术栈、结构、约定、约束等），无内容则忽略

## 代码质量
- 动手前先思考：列出假设，逐条验证。复杂任务多种解释则都列出，更简单方案则提出
- 每步有可验证的退出条件：多步骤任务先列计划（\`1. [Step] → verify: [check]\`），循环验证直到成功。lint 失败时优先运行 \`npm run lint:fix\`
- lint + typecheck 通过才算成功。动手前扫描项目根目录源码文件扩展名检测主语言：\`.py\` → ruff+mypy、\`.ts\`/\`.tsx\` → ESLint+tsc、\`.go\` → gofmt+vet
- 只写被要求的东西：不加"灵活"、"可配置"、单次使用的抽象。200行能50行完成则重写
- 精准改动：只改必要的，改完清理自己造成的垃圾。匹配现有风格，不改进无关代码
- 代码文件行数上限 1500：超过即视为过长，需要扩展时按职责拆分

## 禁止非通用性改动
- 禁止假设外部数据有效 → 必须校验类型/范围/null
- 断言用通用规则，不用具体值（除非明确要求）
- 禁止魔法数字 → 用常量或枚举，注释说明原因
- 禁止隐式成功假设 → 异步/外部操作必须处理失败情况
- 禁止响应结构假设 → 先校验返回结构再访问深层属性
- 禁止资源泄漏假设 → 文件/连接/cursor 等使用后必须释放

## 上下文管理
- 超过 500 行文件分次读取或编辑前重新读取完整内容
- 超过 10 条消息后，编辑任何文件前强制重新读取
- 上下文压缩恢复后：git status → 确认改动范围与设计一致 → 验证 lint+typecheck → 继续

## 工具限制
- 搜索要全：Grep 搜内容 + Glob 搜文件名，两者缺一不可。跳过 node_modules/vendor/__pycache__
- 联网调研优先 agent-reach：查询/搜索/调研等联网操作优先用 agent-reach skill，避免 WebFetch/WebSearch 直连反爬失败
- 禁止脚本改文件：用 Read/Edit/Write，格式化工具（prettier/ruff fmt）除外
- 重命名时覆盖调用、类型、字符串、import、barrel file、测试 mock
- 禁止推送：除非用户明确要求，否则不执行 git push

## 大规模任务
- 200+ 行修改或架构变更（新增服务/API 契约/数据模型重构）必须走 OpenSpec 工作流（/opsx:propose），禁止直接修改

## 其他
- 始终用中文回复用户
- \`npx openspec --help\` 查看 OpenSpec 可用命令
- Superpowers（可选）安装：\`/plugin install superpowers@claude-plugins-official\`，在 propose → apply → verify 阶段增强 AI 方法论

## 安全规范
- 密钥与 \`.env\` 文件不入版本控制
- 示例代码用占位符（如 \`YOUR_API_KEY\`）不用真实凭据
- 调试日志不打印凭据/密钥/token`;

const CLAUDE_MD_EN = `# Project Guidelines
- Read \`openspec/config.yaml\` first (tech stack, structure, conventions, constraints, etc.); ignore if absent

## Code Quality
- Think before coding: List assumptions, verify each one. If multiple interpretations exist, present them all; suggest simpler approaches if available
- Every step needs verifiable exit criteria: Plan multi-step tasks (\`1. [Step] → verify: [check]\`), loop until verified
- lint + typecheck must pass. Detect project language by file extensions: \`.py\` → ruff+mypy, \`.ts\`/\`.tsx\` → ESLint+tsc, \`.go\` → gofmt+vet
- Write only what's requested: No "flexibility", "configurability", or single-use abstractions. Rewrite if 200 lines can be 50
- Surgical changes: Touch only what's necessary, clean up only your own mess. Match existing style, don't improve unrelated code
- Code file line limit 1500: split by responsibility when exceeding

## No Non-Generic Changes
- Assume external data is valid → Must validate type/range/null
- Use generic assertions, not specific values (unless explicitly requested)
- No magic numbers → Use constants or enums with comments explaining why
- No implicit success assumptions → Async/external operations must handle failures
- No response structure assumptions → Validate structure before accessing deep properties
- No resource leak assumptions → Files/connections/cursors must be released after use

## Context Management
- Files over 500 lines: Re-read fully before editing
- After 10+ messages: Force re-read any file before editing
- After context compression: git status → confirm scope aligns with design → verify lint+typecheck → continue

## Tool Constraints
- Search comprehensively: Grep for content + Glob for filenames. Both required. Skip node_modules/vendor/__pycache__
- Research via agent-reach: prefer agent-reach skill for web research to avoid WebFetch/WebSearch anti-bot blocks
- No script-based file edits: Use Read/Edit/Write tools only. Formatters (prettier/ruff fmt) excluded
- Renaming must cover: calls, types, strings, imports, barrel files, test mocks
- No push: Don't execute git push unless explicitly requested

## Large-Scale Tasks
- 200+ line changes or architecture changes (new services/API contracts/data model refactors): prefer using OpenSpec workflow

## Temp File Management
- All non-source temp files (Chrome DevTools MCP, screenshots, logs, heapdumps, etc.) must go in \`tmp/\` at the project root
- Flat structure, no subdirectories; filenames include timestamps to avoid overwrites
- Files in \`tmp/\` older than 24h may be deleted before commit

## Miscellaneous
- \`npx openspec --help\` to see available OpenSpec commands
- Superpowers (optional): \`/plugin install superpowers@claude-plugins-official\` — enhances AI methodology during propose → apply → verify phases`;

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

  // Update content
  document.getElementById('claude-md-content').textContent = isZh ? CLAUDE_MD_ZH : CLAUDE_MD_EN;
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
