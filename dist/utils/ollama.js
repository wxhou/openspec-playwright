/**
 * Ollama API utilities for vision model integration.
 *
 * Configuration priority (highest to lowest):
 * 1. Function parameters
 * 2. Environment variables (OLLAMA_URL, OLLAMA_VISION_MODEL)
 * 3. app-knowledge.md Vision Check Config section
 *
 * If no configuration is found, vision check is disabled.
 */
import { existsSync, readFileSync } from "fs";
import { join } from "path";
// ── Config loading ────────────────────────────────────────────────────────────
/**
 * Load Ollama config from app-knowledge.md.
 * Parses the "## Vision Check Config" section.
 */
function loadFromAppKnowledge(projectRoot) {
    const appKnowledgePath = join(projectRoot, "tests", "playwright", "app-knowledge.md");
    if (!existsSync(appKnowledgePath))
        return {};
    try {
        const content = readFileSync(appKnowledgePath, "utf-8");
        const match = content.match(/## Vision Check Config\s*\n([\s\S]*?)(?=\n##|\n---|\z)/);
        if (!match)
            return {};
        const section = match[1];
        const config = {};
        const urlMatch = section.match(/ollama_url:\s*(.+)/);
        if (urlMatch)
            config.url = urlMatch[1].trim();
        const modelMatch = section.match(/vision_model:\s*(.+)/);
        if (modelMatch)
            config.model = modelMatch[1].trim();
        const enabledMatch = section.match(/vision_enabled:\s*(.+)/);
        if (enabledMatch)
            config.enabled = enabledMatch[1].trim() === "true";
        return config;
    }
    catch {
        return {};
    }
}
/**
 * Load Ollama config with priority:
 * 1. Environment variables (OLLAMA_URL, OLLAMA_VISION_MODEL)
 * 2. app-knowledge.md Vision Check Config section
 *
 * If no configuration is found, returns enabled=false.
 */
export function loadOllamaConfig(projectRoot = process.cwd()) {
    const appKnowledge = loadFromAppKnowledge(projectRoot);
    // Environment variables override app-knowledge.md
    const url = process.env.OLLAMA_URL || appKnowledge.url;
    const model = process.env.OLLAMA_VISION_MODEL || appKnowledge.model;
    // If no url or model configured, disable vision check
    if (!url || !model) {
        return { url: "", model: "", enabled: false };
    }
    // Enabled: default true unless explicitly disabled
    let enabled = true;
    if (process.env.OLLAMA_VISION_ENABLED !== undefined) {
        enabled = process.env.OLLAMA_VISION_ENABLED === "true";
    }
    else if (appKnowledge.enabled !== undefined) {
        enabled = appKnowledge.enabled;
    }
    return { url, model, enabled };
}
// ── Health check ──────────────────────────────────────────────────────────────
/**
 * Check if Ollama is running and the vision model is available.
 * Returns { ok, message } for doctor output.
 */
export async function checkOllamaHealth(config) {
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
        const data = (await response.json());
        const models = data.models || [];
        const modelNames = models.map((m) => m.name);
        // Check if vision model exists (exact match or prefix match)
        const hasModel = modelNames.some((name) => name === config.model ||
            name.startsWith(`${config.model}:`) ||
            name === `${config.model}:latest`);
        if (!hasModel) {
            return {
                ok: false,
                message: `model "${config.model}" not found (available: ${modelNames.slice(0, 3).join(", ")}...)`,
            };
        }
        return { ok: true, message: `${config.url} (${config.model})` };
    }
    catch (err) {
        const error = err;
        if (error.name === "AbortError") {
            return { ok: false, message: "connection timeout" };
        }
        return { ok: false, message: `not reachable: ${error.message}` };
    }
}
// ── Vision analysis ───────────────────────────────────────────────────────────
const VISION_PROMPT = `你是一个专业的网页UI测试员。请分析这张截图，检测以下问题：

1. 遮挡：可交互元素（按钮、表单、链接）是否被其他元素遮挡、覆盖或压住，导致无法正常点击？
2. 拥挤：多个元素是否间距过窄、文字重叠、边界模糊，导致难以区分或误操作？
3. 溢出：内容是否被容器裁剪，导致关键信息不可见？

对于每个问题，请返回：
- element: 元素名称/描述
- type: 问题类型（obscured / crowded / overflowed）
- position: 位置（用屏幕区域描述：左上/右上/中/左下/右下）
- severity: 严重程度（blocking / warning / minor）
- description: 问题描述

如果一切正常，返回空的 anomalies 数组。

请严格以JSON格式回答，不要包含任何其他文字：
{
  "anomalies": []
}`;
/**
 * Analyze a single screenshot with the vision model.
 */
export async function analyzeScreenshot(config, screenshotPath, route) {
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
    const data = (await response.json());
    const responseText = data.response || "";
    // Parse JSON from response (may have markdown code block)
    let jsonStr = responseText;
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
        jsonStr = jsonMatch[1];
    }
    try {
        const parsed = JSON.parse(jsonStr.trim());
        const anomalies = parsed.anomalies || [];
        // Enrich with route and screenshot path
        return anomalies.map((a) => ({
            ...a,
            route,
            screenshot: screenshotPath,
        }));
    }
    catch {
        // If JSON parse fails, return empty (graceful degradation)
        console.error(`Warning: Could not parse vision response for ${route}`);
        return [];
    }
}
/**
 * Batch analyze multiple screenshots with concurrency control.
 */
export async function batchAnalyzeScreenshots(config, screenshots, concurrency = 4) {
    const result = {
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
            }
            catch (err) {
                const error = err;
                console.error(`Warning: Skipped ${route}: ${error.message}`);
                result.skipped.push(path);
            }
        });
        await Promise.allSettled(promises);
    }
    return result;
}
//# sourceMappingURL=ollama.js.map