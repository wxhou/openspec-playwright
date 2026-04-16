/**
 * Ollama API utilities for vision model integration.
 *
 * Configuration: reads from `.env` in `tests/playwright/` (highest priority),
 * then falls back to environment variables. If no URL or model is found,
 * vision check is disabled.
 */
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
/**
 * Load Ollama config from `.env` in `tests/playwright/` and environment variables.
 * If no URL or model is configured, vision check is disabled.
 */
export declare function loadOllamaConfig(projectRoot?: string): OllamaConfig;
/**
 * Check if Ollama is running and the vision model is available.
 * Returns { ok, message } for doctor output.
 */
export declare function checkOllamaHealth(config: OllamaConfig): Promise<{
    ok: boolean;
    message: string;
}>;
/**
 * Analyze a single screenshot with the vision model.
 */
export declare function analyzeScreenshot(config: OllamaConfig, screenshotPath: string, route: string): Promise<VisionAnomaly[]>;
/**
 * Batch analyze multiple screenshots with concurrency control.
 */
export declare function batchAnalyzeScreenshots(config: OllamaConfig, screenshots: Array<{
    path: string;
    route: string;
}>, concurrency?: number): Promise<VisionCheckResult>;
/**
 * Compare two screenshots with pixel diff.
 * Returns changed regions and optionally saves a diff image.
 */
export declare function compareScreenshotDiff(config: OllamaConfig, baselinePath: string, currentPath: string, diffPath: string, route: string): Promise<{
    changed: boolean;
    anomalies: VisionAnomaly[];
}>;
/**
 * Generate a self-contained HTML report with embedded screenshots and results.
 * If diffDir is provided, diff images are shown alongside current screenshots.
 */
export declare function generateHtmlReport(result: VisionCheckResult, screenshots: Array<{
    path: string;
    route: string;
}>, outputPath: string, diffDir?: string): void;
