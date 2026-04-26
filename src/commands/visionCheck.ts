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

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, basename } from "path";
import { glob } from "glob";
import chalk from "chalk";
import { chromium, Browser } from "playwright";
import {
  loadOllamaConfig,
  checkOllamaHealth,
  batchAnalyzeScreenshots,
  compareScreenshotDiff,
  generateHtmlReport,
  VisionCheckResult,
  VisionAnomaly,
} from "../utils/ollama.js";

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
 * Extract route name from screenshot path.
 * e.g., "__screenshots__/dashboard.png" → "/dashboard"
 *       "__screenshots__/settings-profile.png" → "/settings/profile"
 */
function extractRouteFromPath(screenshotPath: string): string {
  const name = basename(screenshotPath, ".png");
  // Convert dashes back to slashes, handle root
  if (name === "index" || name === "home" || name === "root") {
    return "/";
  }
  return "/" + name.replace(/-/g, "/");
}

/**
 * Resolve screenshot paths from glob or comma-separated list.
 */
async function resolveScreenshots(
  pattern: string,
): Promise<Array<{ path: string; route: string }>> {
  // Check if comma-separated list
  if (pattern.includes(",") && !pattern.includes("*")) {
    return pattern.split(",").map((p) => ({
      path: p.trim(),
      route: extractRouteFromPath(p.trim()),
    }));
  }

  // Glob pattern
  const paths = await glob(pattern, { absolute: true });
  return paths.map((p) => ({
    path: p,
    route: extractRouteFromPath(p),
  }));
}

/**
 * Filter anomalies by severity level.
 */
function filterBySeverity(
  anomalies: VisionAnomaly[],
  severityFilter: string,
): VisionAnomaly[] {
  const levels = severityFilter.toLowerCase().split(",").map((s) => s.trim());
  return anomalies.filter((a) => levels.includes(a.severity));
}

// ── Viewport presets ───────────────────────────────────────────────────────────

const VIEWPORT_PRESETS: Record<string, { width: number; height: number }> = {
  mobile: { width: 375, height: 667 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 720 },
  wide: { width: 1920, height: 1080 },
};

/**
 * Parse viewport string: "mobile,desktop" or "375x667,1280x720"
 */
function parseViewports(input: string): Array<{ name: string; width: number; height: number }> {
  return input.split(",").map((v) => {
    const name = v.trim().toLowerCase();
    if (VIEWPORT_PRESETS[name]) {
      return { name, ...VIEWPORT_PRESETS[name] };
    }
    const parts = name.split("x");
    if (parts.length === 2) {
      const w = parseInt(parts[0], 10);
      const h = parseInt(parts[1], 10);
      if (w > 0 && h > 0) {
        return { name: `${w}x${h}`, width: w, height: h };
      }
    }
    throw new Error(`Invalid viewport: "${v}". Use presets (mobile/tablet/desktop/wide) or WxH (e.g. 375x667)`);
  });
}

// ── Baseline paths ───────────────────────────────────────────────────────────

const BASELINE_DIR = ".openspec-pw/vision-baseline";
const DIFF_DIR = ".openspec-pw/vision-diff";

/**
 * Capture screenshots from a URL at multiple viewports using Playwright.
 */
async function captureFromUrl(
  url: string,
  viewports: Array<{ name: string; width: number; height: number }>,
  outputDir: string,
  concurrency: number = 2,
): Promise<Array<{ path: string; route: string; viewport: string }>> {
  const results: Array<{ path: string; route: string; viewport: string }> = [];
  mkdirSync(outputDir, { recursive: true });

  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({ headless: true });

    for (let i = 0; i < viewports.length; i += concurrency) {
      const batch = viewports.slice(i, i + concurrency);
      const batchPromises = batch.map(async (vp) => {
        // Each viewport gets its own context so viewport size doesn't affect other captures
        const context = await browser!.newContext({
          viewport: { width: vp.width, height: vp.height },
        });
        const page = await context.newPage();
        try {
          await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
          const filename = `${vp.name}.png`;
          const filepath = join(outputDir, filename);
          await page.screenshot({ path: filepath, fullPage: true });
          return { path: filepath, route: `${vp.name}:${url}`, viewport: vp.name };
        } finally {
          await context.close();
        }
      });
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }
  } finally {
    if (browser) await browser.close();
  }

  return results;
}

/**
 * Copy screenshots to baseline directory.
 */
function saveBaseline(
  screenshots: Array<{ path: string; route: string; viewport?: string }>,
  projectRoot: string,
): string {
  const baselineDir = join(projectRoot, BASELINE_DIR);
  mkdirSync(baselineDir, { recursive: true });
  for (const s of screenshots) {
    const base = basename(s.path, ".png");
    const name = s.viewport
      ? `${base}-${s.viewport}-baseline.png`
      : `${base}-baseline.png`;
    const dest = join(baselineDir, name);
    writeFileSync(dest, readFileSync(s.path));
    console.log(chalk.green(`  ✓ Baseline saved: ${dest}`));
  }
  return baselineDir;
}

// ── Main command ─────────────────────────────────────────────────────────────

/**
 * Main vision check command.
 */
export async function visionCheck(options: VisionCheckOptions): Promise<void> {
  const projectRoot = process.cwd();

  // 0. Validate required arguments
  if (!options.screenshots && !(options.viewport && options.url)) {
    console.log(chalk.yellow("Error: Provide --screenshots <pattern> or --url <url> --viewport <views>"));
    process.exit(2);
  }

  // 1. Validate threshold
  if (options.threshold !== undefined && (options.threshold < 0 || options.threshold > 1)) {
    console.log(chalk.yellow("Error: --threshold must be between 0 and 1"));
    process.exit(2);
  }

  // 2. Load configuration
  const config = loadOllamaConfig(projectRoot);

  if (!config.enabled) {
    const result: VisionCheckResult = {
      processed: 0,
      anomalies: [],
      skipped: [],
      skipReason: "disabled",
      ollamaUrl: config.url,
      model: config.model,
    };

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(chalk.yellow("Vision check disabled in config"));
    }
    process.exit(2);
  }

  // 3. Parse viewports
  let viewports: Array<{ name: string; width: number; height: number }> | null = null;
  if (options.viewport) {
    viewports = parseViewports(options.viewport);
  }

  // 4. Gather screenshots
  let screenshots: Array<{ path: string; route: string; viewport?: string }> = [];

  if (options.viewport && options.url) {
    // Multi-viewport capture mode
    if (!options.json) {
      console.log(chalk.blue(`\n📷 Capturing at ${viewports!.length} viewport(s) from ${options.url}...\n`));
    }
    screenshots = await captureFromUrl(
      options.url,
      viewports!,
      join(projectRoot, ".openspec-pw/vision-current"),
    );
  } else {
    // File-based mode
    screenshots = await resolveScreenshots(options.screenshots);
  }

  if (screenshots.length === 0) {
    console.log(chalk.yellow("No screenshots found matching the provided pattern"));
    process.exit(1);
  }

  // 5. Baseline mode: save and exit
  if (options.baseline) {
    const baselineDir = saveBaseline(screenshots, projectRoot);
    if (!options.json) {
      console.log(chalk.green(`\n✓ Baseline saved (${screenshots.length} screenshots) in ${baselineDir}`));
    }
    return;
  }

  // 6. Dry run
  if (options.dryRun) {
    console.log(chalk.blue("\n📷 Screenshots (dry run):\n"));
    for (const s of screenshots) {
      const vp = s.viewport ? ` [${s.viewport}]` : "";
      console.log(`  ${s.route}${vp} → ${s.path}`);
    }
    console.log(chalk.gray(`\nTotal: ${screenshots.length} files`));
    console.log(chalk.gray(`Ollama: ${config.url} (${config.model})`));
    return;
  }

  // 7. Health check
  const health = await checkOllamaHealth(config);
  if (!health.ok) {
    const result: VisionCheckResult = {
      processed: 0,
      anomalies: [],
      skipped: [],
      skipReason: health.message,
      ollamaUrl: config.url,
      model: config.model,
    };

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(chalk.yellow(`Vision check skipped: ${health.message}`));
    }
    process.exit(1);
  }

  if (!options.json) {
    const mode = options.diff ? "diff" : "analyze";
    console.log(chalk.blue(`\n🔍 ${mode === "diff" ? "Pixel diff" : "Analyzing"} ${screenshots.length} screenshot(s)...\n`));
  }

  // 8. Diff mode: compare with baseline
  const result: VisionCheckResult = {
    processed: 0,
    anomalies: [],
    skipped: [],
    ollamaUrl: config.url,
    model: config.model,
    baselineDir: join(projectRoot, BASELINE_DIR),
  };

  if (options.diff) {
    const baselineDir = join(projectRoot, BASELINE_DIR);
    const diffDir = join(projectRoot, DIFF_DIR);
    mkdirSync(diffDir, { recursive: true });

    for (const s of screenshots) {
      const baseName = basename(s.path, ".png");
      const baselineSuffix = s.viewport ? `-${s.viewport}-baseline` : "-baseline";
      const baselinePath = join(baselineDir, `${baseName}${baselineSuffix}.png`);
      const diffPath = join(diffDir, `${baseName}-diff.png`);

      if (!existsSync(baselinePath)) {
        result.skipped.push(s.path);
        if (!options.json) {
          console.log(chalk.yellow(`  ⚠ No baseline for ${s.route}, skipping diff`));
        }
        continue;
      }

      try {
        const { changed, anomalies } = await compareScreenshotDiff(
          config,
          baselinePath,
          s.path,
          diffPath,
          s.route,
          options.threshold ?? 0.1,
        );
        result.processed++;
        result.anomalies.push(
          ...anomalies.map((a) => ({ ...a, viewport: s.viewport })),
        );
        if (!options.json) {
          if (changed) {
            console.log(
              chalk.yellow(`  ~ ${s.route}${s.viewport ? ` [${s.viewport}]` : ""}: ${anomalies.length} anomaly(ies)`),
            );
          } else {
            console.log(chalk.gray(`  ✓ ${s.route}${s.viewport ? ` [${s.viewport}]` : ""}: no changes`));
          }
        }
      } catch (err) {
        const error = err as Error;
        result.skipped.push(s.path);
        if (!options.json) {
          console.error(chalk.red(`  ✗ ${s.route}: ${error.message}`));
        }
      }
    }
  } else {
    // Analyze mode: batch analyze screenshots
    const concurrency = options.parallel || 4;
    const batchResult = await batchAnalyzeScreenshots(
      config,
      screenshots.map((s) => ({ path: s.path, route: s.route })),
      concurrency,
      options.noCache,
    );
    result.processed = batchResult.processed;
    result.anomalies = batchResult.anomalies.map((a) => ({
      ...a,
      viewport: screenshots.find((s) => s.path === a.screenshot)?.viewport,
    }));
    result.skipped = batchResult.skipped;
  }

  // 9. Filter by severity
  if (options.severity) {
    result.anomalies = filterBySeverity(result.anomalies, options.severity);
  }

  // 10. Output
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(chalk.blue("─── Results ───\n"));
    console.log(`  Processed: ${result.processed}/${screenshots.length}`);
    console.log(`  Anomalies: ${result.anomalies.length}`);
    if (result.skipped.length > 0) {
      console.log(chalk.yellow(`  Skipped: ${result.skipped.length}`));
    }

    if (result.anomalies.length > 0) {
      console.log(chalk.blue("\n─── Anomalies ───\n"));
      for (const a of result.anomalies) {
        const severityColor =
          a.severity === "blocking"
            ? chalk.red
            : a.severity === "warning"
              ? chalk.yellow
              : chalk.gray;
        const vp = a.viewport ? ` [${a.viewport}]` : "";
        console.log(`  ${severityColor(`[${a.severity}]`)} ${a.route}${vp}`);
        console.log(`    Element: ${a.element}`);
        console.log(`    Type: ${a.type} (${a.position})`);
        console.log(`    ${a.description}\n`);
      }
    } else {
      console.log(chalk.green("\n  ✓ No layout anomalies detected\n"));
    }
  }

  // 11. HTML report
  if (options.report) {
    generateHtmlReport(
      result,
      screenshots.map((s) => ({ path: s.path, route: s.route })),
      options.report,
      options.diff ? join(projectRoot, DIFF_DIR) : undefined,
    );
    if (!options.json) {
      console.log(chalk.green(`  ✓ HTML report: ${options.report}`));
    }
  }

  // 12. JSON output file
  if (options.output) {
    writeFileSync(options.output, JSON.stringify(result, null, 2), "utf-8");
    if (!options.json) {
      console.log(chalk.green(`  ✓ Results written to ${options.output}`));
    }
  }
}
