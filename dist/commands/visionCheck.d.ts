/**
 * Vision check command: Analyze screenshots for layout anomalies using Ollama VLM.
 *
 * Modes:
 *   --screenshots "..."        Analyze existing files (single mode)
 *   --url ... --viewport ...  Capture from URL at multiple viewports
 *   --baseline                Save as baseline (with --screenshots or --url+viewport)
 *   --diff                    Compare against baseline
 *   --report <path>           Generate HTML report
 *
 * Exit codes:
 *   0 = Check completed (with or without anomalies)
 *   1 = Ollama not available (skipped)
 *   2 = Configuration missing or invalid (skipped)
 */
export interface VisionCheckOptions {
    screenshots: string;
    config?: string;
    parallel?: number;
    output?: string;
    dryRun?: boolean;
    severity?: string;
    json?: boolean;
    viewport?: string;
    url?: string;
    baseline?: boolean;
    diff?: boolean;
    report?: string;
    threshold?: number;
    noCache?: boolean;
}
/**
 * Main vision check command.
 */
export declare function visionCheck(options: VisionCheckOptions): Promise<void>;
