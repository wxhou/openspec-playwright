/**
 * Vision check command: Analyze screenshots for layout anomalies using Ollama VLM.
 *
 * Usage:
 *   openspec-pw vision-check --screenshots "__screenshots__/*.png"
 *   openspec-pw vision-check --screenshots "shot1.png,shot2.png" --parallel 2
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
}
/**
 * Main vision check command.
 */
export declare function visionCheck(options: VisionCheckOptions): Promise<void>;
