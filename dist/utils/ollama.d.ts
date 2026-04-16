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
export interface OllamaConfig {
    url: string;
    model: string;
    enabled: boolean;
}
export interface VisionAnomaly {
    route: string;
    screenshot: string;
    element: string;
    type: "obscured" | "crowded" | "overflowed";
    position: string;
    severity: "blocking" | "warning" | "minor";
    description: string;
}
export interface VisionCheckResult {
    processed: number;
    anomalies: VisionAnomaly[];
    skipped: string[];
    skipReason?: string;
    ollamaUrl: string;
    model: string;
}
export interface OllamaGenerateResponse {
    response: string;
    done: boolean;
}
/**
 * Load Ollama config with priority:
 * 1. Environment variables (OLLAMA_URL, OLLAMA_VISION_MODEL)
 * 2. app-knowledge.md Vision Check Config section
 *
 * If no configuration is found, returns enabled=false.
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
