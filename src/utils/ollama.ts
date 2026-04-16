/**
 * Ollama API utilities for vision model integration.
 *
 * Configuration: reads from `.env` in `tests/playwright/` (highest priority),
 * then falls back to environment variables. If no URL or model is found,
 * vision check is disabled.
 */

import { config as loadEnv } from "dotenv";
import { createRequire } from "module";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

const _require = createRequire(import.meta.url);

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OllamaConfig {
  url: string;
  model: string;
  enabled: boolean;
}

export interface VisionAnomaly {
  route: string;
  screenshot: string;
  element: string;
  type: "obscured" | "crowded" | "overflowed" | "missing" | "incorrect";
  position: string;
  severity: "blocking" | "warning" | "minor";
  description: string;
  viewport?: string;
  changed?: boolean;
}

export interface VisionCheckResult {
  processed: number;
  anomalies: VisionAnomaly[];
  skipped: string[];
  skipReason?: string;
  ollamaUrl: string;
  model: string;
  baselineDir?: string;
  currentDir?: string;
}

export interface OllamaGenerateResponse {
  response: string;
  done: boolean;
}

export interface PixelDiffRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  changedPixels: number;
}

// ── Config loading ────────────────────────────────────────────────────────────

/**
 * Load Ollama config from `.env` in `tests/playwright/` and environment variables.
 * If no URL or model is configured, vision check is disabled.
 */
export function loadOllamaConfig(projectRoot: string = process.cwd()): OllamaConfig {
  // Lazy load .env from tests/playwright/ (falls back gracefully if missing)
  // Avoid path duplication if projectRoot is already inside tests/playwright/
  const normRoot = projectRoot.replace(/[\/\\]+$/, "");
  const envPath = normRoot.match(/[\/\\]tests[\/\\]playwright$/)
    ? join(normRoot, ".env") // already inside tests/playwright/
    : join(normRoot, "tests", "playwright", ".env");
  if (existsSync(envPath)) {
    loadEnv({ path: envPath });
  }

  const url = process.env.OLLAMA_URL;
  const model = process.env.OLLAMA_VISION_MODEL;

  // If no url or model configured, disable vision check
  if (!url || !model) {
    return { url: "", model: "", enabled: false };
  }

  // Enabled: default true unless explicitly disabled
  const enabled =
    process.env.OLLAMA_VISION_ENABLED === undefined ||
    process.env.OLLAMA_VISION_ENABLED === "true";

  return { url, model, enabled };
}

// ── Health check ──────────────────────────────────────────────────────────────

/**
 * Check if Ollama is running and the vision model is available.
 * Returns { ok, message } for doctor output.
 */
export async function checkOllamaHealth(
  config: OllamaConfig,
): Promise<{ ok: boolean; message: string }> {
  if (!config.enabled) {
    return { ok: false, message: "disabled in config" };
  }

  try {
    // Check Ollama server
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${config.url}/api/tags`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return { ok: false, message: `server error: ${response.status}` };
    }

    const data = (await response.json()) as { models?: Array<{ name: string }> };
    const models = data.models || [];
    const modelNames = models.map((m) => m.name);

    // Check if vision model exists (exact match or prefix match)
    const hasModel = modelNames.some(
      (name) =>
        name === config.model ||
        name.startsWith(`${config.model}:`) ||
        name === `${config.model}:latest`,
    );

    if (!hasModel) {
      return {
        ok: false,
        message: `model "${config.model}" not found (available: ${modelNames.slice(0, 3).join(", ")}...)`,
      };
    }

    return { ok: true, message: `${config.url} (${config.model})` };
  } catch (err) {
    const error = err as Error;
    if (error.name === "AbortError") {
      return { ok: false, message: "connection timeout" };
    }
    return { ok: false, message: `not reachable: ${error.message}` };
  }
}

// ── Vision analysis ───────────────────────────────────────────────────────────

const VISION_PROMPT = [
  "你是专业的UI测试工程师，以普通用户视角审视这张截图。",
  "",
  "【检测目标】用户可感知的功能性UI问题，不包括：",
  "- 装饰性图标、logo的细微偏差",
  "- CSS hover/transition动画状态",
  "- 浏览器默认样式（滚动条、右键菜单）",
  "- 动态广告/推荐内容（如能正常交互则不报错）",
  "",
  "【问题类型】",
  "1. obscured — 可交互元素被遮挡/覆盖，无法点击",
  "2. crowded — 元素间距过窄、文字重叠、难以区分",
  "3. overflowed — 内容被裁剪，关键信息不可见",
  "4. missing — 明显应该存在的元素完全消失",
  "5. incorrect — 文本内容明显错误、样式完全错误",
  "",
  "【严重程度】",
  "- blocking：核心功能不可用（如提交按钮被遮挡）",
  "- warning：影响使用体验（如重要文字被截断）",
  "- minor：细微视觉问题（图标轻微偏移）",
  "",
  "【定位】用屏幕区域：左上/上/右上/左/中/右/左下/下/右下",
  "",
  '返回JSON格式，不要包含任何其他文字：',
  '{"anomalies":[]}',
  "",
  '如果一切正常，返回：{"anomalies":[]}',
].join("\n");

/**
 * Analyze a single screenshot with the vision model.
 */
export async function analyzeScreenshot(
  config: OllamaConfig,
  screenshotPath: string,
  route: string,
): Promise<VisionAnomaly[]> {
  if (!existsSync(screenshotPath)) {
    throw new Error(`Screenshot not found: ${screenshotPath}`);
  }

  const imageBase64 = readFileSync(screenshotPath).toString("base64");

  const response = await fetch(`${config.url}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.model,
      prompt: VISION_PROMPT,
      images: [imageBase64],
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.status}`);
  }

  const data = (await response.json()) as OllamaGenerateResponse;
  const responseText = data.response || "";

  // Parse JSON from response (may have markdown code block)
  let jsonStr = responseText;
  const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1];
  }

  try {
    const parsed = JSON.parse(jsonStr.trim()) as { anomalies?: VisionAnomaly[] };
    const anomalies = parsed.anomalies || [];

    // Enrich with route and screenshot path
    return anomalies.map((a) => ({
      ...a,
      route,
      screenshot: screenshotPath,
    }));
  } catch {
    // If JSON parse fails, return empty (graceful degradation)
    console.error(`Warning: Could not parse vision response for ${route}`);
    return [];
  }
}

/**
 * Batch analyze multiple screenshots with concurrency control.
 */
export async function batchAnalyzeScreenshots(
  config: OllamaConfig,
  screenshots: Array<{ path: string; route: string }>,
  concurrency: number = 4,
): Promise<VisionCheckResult> {
  const result: VisionCheckResult = {
    processed: 0,
    anomalies: [],
    skipped: [],
    ollamaUrl: config.url,
    model: config.model,
  };

  // Process in batches
  for (let i = 0; i < screenshots.length; i += concurrency) {
    const batch = screenshots.slice(i, i + concurrency);
    const promises = batch.map(async ({ path, route }) => {
      try {
        const anomalies = await analyzeScreenshot(config, path, route);
        result.processed++;
        result.anomalies.push(...anomalies);
      } catch (err) {
        const error = err as Error;
        console.error(`Warning: Skipped ${route}: ${error.message}`);
        result.skipped.push(path);
      }
    });

    await Promise.allSettled(promises);
  }

  return result;
}

// ── Pixel diff ───────────────────────────────────────────────────────────────

const DIFF_PROMPT = `你是专业的UI回归测试工程师。这张图是像素差异图，红色高亮区域表示与基准版不同。

请分析红色高亮区域，检测：
1. 哪些变化是真实的UI bug（如元素被遮挡、布局错乱、内容丢失）
2. 哪些变化是正常的（如动态内容更新、动画状态变化）

【忽略】动态广告/推荐内容、时间戳、数值变化、hover/focus状态、第三方嵌入内容的变化。

【问题类型】
- obscured：可交互元素被遮挡，无法点击
- crowded：元素间距错乱、文字重叠
- overflowed：内容被裁剪，关键信息不可见
- missing：原有元素消失
- incorrect：样式/内容明显错误

【严重程度】
- blocking：核心功能不可用
- warning：影响使用体验
- minor：细微视觉回归

返回JSON（不要包含任何其他文字）：
{"anomalies":[]}`;

/**
 * Compare two screenshots with pixel diff.
 * Returns changed regions and optionally saves a diff image.
 */
export async function compareScreenshotDiff(
  config: OllamaConfig,
  baselinePath: string,
  currentPath: string,
  diffPath: string,
  route: string,
): Promise<{ changed: boolean; anomalies: VisionAnomaly[] }> {
  const pixelmatch = _require("pixelmatch");
  const { PNG } = _require("pngjs");

  if (!existsSync(baselinePath)) {
    throw new Error("Baseline screenshot not found: " + baselinePath);
  }
  if (!existsSync(currentPath)) {
    throw new Error("Current screenshot not found: " + currentPath);
  }

  const img1 = PNG.sync.read(readFileSync(baselinePath));
  const img2 = PNG.sync.read(readFileSync(currentPath));

  if (img1.width !== img2.width || img1.height !== img2.height) {
    throw new Error(
      `Screenshot dimensions mismatch: ${img1.width}x${img1.height} vs ${img2.width}x${img2.height}`,
    );
  }

  const diff = new PNG(img1.width, img1.height);
  const changedPixels = pixelmatch(
    img1.data,
    img2.data,
    diff.data,
    img1.width,
    img1.height,
    { threshold: 0.1 },
  );

  const changedRatio = changedPixels / (img1.width * img1.height);

  // Save diff image
  writeFileSync(diffPath, PNG.sync.write(diff));

  // If no meaningful changes, skip VLM analysis
  if (changedRatio < 0.001) {
    return { changed: false, anomalies: [] };
  }

  // Analyze diff image with VLM (only diff image to avoid context overflow)
  const diffB64 = readFileSync(diffPath).toString("base64");

  const response = await fetch(`${config.url}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.model,
      prompt: DIFF_PROMPT,
      images: [diffB64],
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.status}`);
  }

  const data = (await response.json()) as OllamaGenerateResponse;
  const responseText = data.response || "";

  let jsonStr = responseText;
  const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1];
  }

  try {
    const parsed = JSON.parse(jsonStr.trim()) as { anomalies?: VisionAnomaly[] };
    const anomalies = (parsed.anomalies || []).map((a) => ({
      ...a,
      route,
      screenshot: currentPath,
      changed: true,
    }));
    return { changed: true, anomalies };
  } catch {
    console.error(`Warning: Could not parse diff response for ${route}`);
    return { changed: true, anomalies: [] };
  }
}

// ── HTML Report ─────────────────────────────────────────────────────────────

/**
 * Generate a self-contained HTML report with embedded screenshots and results.
 * If diffDir is provided, diff images are shown alongside current screenshots.
 */
export function generateHtmlReport(
  result: VisionCheckResult,
  screenshots: Array<{ path: string; route: string }>,
  outputPath: string,
  diffDir?: string,
): void {
  const timestamp = new Date().toISOString();

  // Group anomalies by severity
  const bySeverity: Record<string, VisionAnomaly[]> = {
    blocking: [],
    warning: [],
    minor: [],
  };
  for (const a of result.anomalies) {
    const key = a.severity || "minor";
    if (bySeverity[key]) bySeverity[key].push(a);
  }

  // Build screenshot cards with base64 images
  const screenshotCards = screenshots
    .map((s) => {
      const base64 = readFileSync(s.path).toString("base64");

      // Check for diff image
      let diffBase64 = "";
      let hasDiff = false;
      if (diffDir) {
        const baseName = s.path.split("/").pop()!.replace(".png", "");
        const diffPath = join(diffDir, `${baseName}-diff.png`);
        if (existsSync(diffPath)) {
          diffBase64 = readFileSync(diffPath).toString("base64");
          hasDiff = true;
        }
      }

      const anomalies = result.anomalies.filter((a) => a.screenshot === s.path);
      const badge =
        anomalies.length > 0
          ? `<span class="badge badge-${anomalies[0].severity}">${anomalies.length} issue${anomalies.length > 1 ? "s" : ""}</span>`
          : `<span class="badge badge-ok">OK</span>`;
      const anomalyList =
        anomalies.length > 0
          ? `<div class="anomaly-list">
${anomalies
  .map(
    (a) => `      <div class="anomaly-item severity-${a.severity}">
        <div class="anomaly-header">
          <span class="type-badge">${a.type}</span>
          <span class="severity-badge ${a.severity}">${a.severity}</span>
          ${a.viewport ? `<span class="viewport-badge">${a.viewport}</span>` : ""}
          ${a.changed ? `<span class="diff-badge">changed</span>` : ""}
        </div>
        <div class="anomaly-body">
          <strong>${a.element}</strong>
          <p>${a.description}</p>
          <div class="anomaly-meta">${a.position}</div>
        </div>
      </div>`,
  )
  .join("\n")}
    </div>`
          : "";

      const diffSection = hasDiff
        ? `<div class="card-diff"><div class="diff-label">Diff</div><img src="data:image/png;base64,${diffBase64}" alt="diff" /></div>`
        : "";
      const currentSection = `<div class="card-img"><div class="img-label">Current</div><img src="data:image/png;base64,${base64}" alt="${s.route}" /></div>`;
      const comparisonSection = hasDiff
        ? `<div class="card-comparison">${currentSection}${diffSection}</div>`
        : currentSection;

      return `    <div class="screenshot-card ${anomalies.length > 0 ? "has-issues" : ""}">
      <div class="card-header">
        <span class="route">${s.route}</span>
        ${badge}
      </div>
      <div class="card-body">${comparisonSection}</div>
      ${anomalyList}
    </div>`;
    })
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Vision Check Report</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; padding: 24px; }
  .header { margin-bottom: 24px; }
  .header h1 { font-size: 24px; font-weight: 600; color: #f8fafc; }
  .meta { font-size: 13px; color: #94a3b8; margin-top: 4px; }
  .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 32px; }
  .stat-card { background: #1e293b; border-radius: 12px; padding: 16px; }
  .stat-value { font-size: 32px; font-weight: 700; }
  .stat-label { font-size: 12px; color: #94a3b8; margin-top: 4px; }
  .stat-blocking .stat-value { color: #ef4444; }
  .stat-warning .stat-value { color: #f59e0b; }
  .stat-minor .stat-value { color: #94a3b8; }
  .stat-processed .stat-value { color: #22c55e; }
  .section { margin-bottom: 32px; }
  .section h2 { font-size: 18px; font-weight: 600; margin-bottom: 16px; color: #f8fafc; border-bottom: 1px solid #334155; padding-bottom: 8px; }
  .screenshots-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(400px, 1fr)); gap: 16px; }
  .screenshot-card { background: #1e293b; border-radius: 12px; overflow: hidden; border: 1px solid #334155; }
  .screenshot-card.has-issues { border-color: #475569; }
  .card-header { padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #334155; }
  .route { font-family: monospace; font-size: 14px; font-weight: 600; color: #f8fafc; }
  .badge { font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 9999px; }
  .badge-ok { background: #14532d; color: #4ade80; }
  .badge-blocking { background: #7f1d1d; color: #fca5a5; }
  .badge-warning { background: #78350f; color: #fcd34d; }
  .badge-minor { background: #1e293b; color: #94a3b8; border: 1px solid #475569; }
  .card-body { padding: 8px; }
  .card-comparison { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
  .card-img { position: relative; }
  .img-label { position: absolute; top: 4px; left: 4px; font-size: 10px; background: rgba(0,0,0,0.6); color: #fff; padding: 2px 6px; border-radius: 4px; z-index: 1; }
  .card-diff { position: relative; }
  .diff-label { position: absolute; top: 4px; left: 4px; font-size: 10px; background: rgba(220,38,38,0.8); color: #fff; padding: 2px 6px; border-radius: 4px; z-index: 1; }
  .card-body img { width: 100%; border-radius: 6px; display: block; }
  .anomaly-list { padding: 12px 16px; border-top: 1px solid #334155; }
  .anomaly-item { padding: 10px 12px; border-radius: 8px; margin-bottom: 8px; background: #0f172a; }
  .anomaly-item:last-child { margin-bottom: 0; }
  .anomaly-header { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
  .type-badge { font-size: 11px; font-weight: 600; padding: 2px 6px; border-radius: 4px; background: #334155; color: #e2e8f0; font-family: monospace; }
  .severity-badge { font-size: 11px; font-weight: 600; padding: 2px 6px; border-radius: 4px; }
  .severity-badge.blocking { background: #7f1d1d; color: #fca5a5; }
  .severity-badge.warning { background: #78350f; color: #fcd34d; }
  .severity-badge.minor { background: #1e293b; color: #94a3b8; border: 1px solid #475569; }
  .viewport-badge { font-size: 11px; padding: 2px 6px; border-radius: 4px; background: #312e81; color: #a5b4fc; }
  .diff-badge { font-size: 11px; padding: 2px 6px; border-radius: 4px; background: #dc2626; color: #fff; font-family: monospace; }
  .anomaly-body { }
  .anomaly-body strong { font-size: 13px; color: #f8fafc; }
  .anomaly-body p { font-size: 12px; color: #cbd5e1; margin-top: 4px; line-height: 1.5; }
  .anomaly-meta { font-size: 11px; color: #64748b; margin-top: 4px; }
  .empty-state { text-align: center; padding: 48px; color: #64748b; }
  .empty-state h3 { font-size: 18px; color: #94a3b8; margin-bottom: 8px; }
  .diff-indicator { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #f59e0b; margin-right: 4px; }
  .diff-mode { font-size: 14px; background: #dc2626; color: #fff; padding: 2px 8px; border-radius: 6px; font-weight: normal; vertical-align: middle; }
</style>
</head>
<body>
<div class="header">
  <h1>Vision Check Report${diffDir ? " <span class='diff-mode'>DIFF MODE</span>" : ""}</h1>
  <div class="meta">Generated: ${timestamp} | Ollama: ${result.ollamaUrl} | Model: ${result.model}${diffDir ? " | Baseline: " + result.baselineDir : ""}</div>
</div>

<div class="summary">
  <div class="stat-card stat-processed">
    <div class="stat-value">${result.processed}</div>
    <div class="stat-label">Processed</div>
  </div>
  <div class="stat-card stat-blocking">
    <div class="stat-value">${bySeverity.blocking.length}</div>
    <div class="stat-label">Blocking</div>
  </div>
  <div class="stat-card stat-warning">
    <div class="stat-value">${bySeverity.warning.length}</div>
    <div class="stat-label">Warning</div>
  </div>
  <div class="stat-card stat-minor">
    <div class="stat-value">${bySeverity.minor.length}</div>
    <div class="stat-label">Minor</div>
  </div>
</div>

<div class="section">
  <h2>Screenshots (${screenshots.length})</h2>
  ${
    screenshotCards
      ? `<div class="screenshots-grid">${screenshotCards}</div>`
      : `<div class="empty-state"><h3>No screenshots analyzed</h3></div>`
  }
</div>

${
  result.anomalies.length > 0
    ? `<div class="section">
  <h2>All Anomalies</h2>
  <div class="anomaly-list" style="padding:0;border:none;background:transparent">
    ${result.anomalies
      .map(
        (a) => `  <div class="anomaly-item severity-${a.severity}">
        <div class="anomaly-header">
          <span class="type-badge">${a.type}</span>
          <span class="severity-badge ${a.severity}">${a.severity}</span>
          ${a.viewport ? `<span class="viewport-badge">${a.viewport}</span>` : ""}
          ${a.changed ? `<span class="diff-indicator" title="Pixel diff detected"></span>` : ""}
        </div>
        <div class="anomaly-body">
          <strong>${a.element}</strong>
          <p>${a.description}</p>
          <div class="anomaly-meta">${a.route} · ${a.position}</div>
        </div>
      </div>`,
      )
      .join("\n")}
  </div>
</div>`
    : ""
}
</body>
</html>`;

  writeFileSync(outputPath, html, "utf-8");
}
