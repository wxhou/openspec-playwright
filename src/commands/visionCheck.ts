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

import { existsSync, readFileSync, writeFileSync } from "fs";
import { join, basename } from "path";
import { glob } from "glob";
import chalk from "chalk";
import {
  loadOllamaConfig,
  checkOllamaHealth,
  batchAnalyzeScreenshots,
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

/**
 * Append anomalies to app-exploration.md Visual Anomalies section.
 */
function appendToExploration(
  projectRoot: string,
  anomalies: VisionAnomaly[],
): void {
  const explorationPath = join(
    projectRoot,
    "tests",
    "playwright",
    "app-exploration.md",
  );

  if (!existsSync(explorationPath)) {
    console.error(
      chalk.yellow(
        `Warning: ${explorationPath} not found, skipping write`,
      ),
    );
    return;
  }

  let content = readFileSync(explorationPath, "utf-8");

  // Find or create Visual Anomalies section
  const sectionHeader = "## Visual Anomalies";
  const tableHeader = `| Route | Element | Type | Position | Severity | Description |
| --- | --- | --- | --- | --- | --- |`;

  if (!content.includes(sectionHeader)) {
    // Add section before "## Next Steps" or at the end
    const nextStepsIndex = content.indexOf("## Next Steps");
    if (nextStepsIndex !== -1) {
      content =
        content.slice(0, nextStepsIndex) +
        `${sectionHeader}\n\n${tableHeader}\n\n` +
        content.slice(nextStepsIndex);
    } else {
      content += `\n\n${sectionHeader}\n\n${tableHeader}\n`;
    }
  }

  // Append new anomalies (de-duplicate by route + element + type)
  const existingRows = content.match(
    /\| [^|]+ \| [^|]+ \| [^|]+ \| [^|]+ \| [^|]+ \| [^|]+ \|/g,
  ) || [];
  const existingKeys = new Set(
    existingRows.map((row) => {
      const cells = row.split("|").map((c) => c.trim()).filter(Boolean);
      return `${cells[0]}:${cells[1]}:${cells[2]}`;
    }),
  );

  const newRows: string[] = [];
  for (const a of anomalies) {
    const key = `${a.route}:${a.element}:${a.type}`;
    if (!existingKeys.has(key)) {
      newRows.push(
        `| ${a.route} | ${a.element} | ${a.type} | ${a.position} | ${a.severity} | ${a.description} |`,
      );
      existingKeys.add(key);
    }
  }

  if (newRows.length > 0) {
    // Insert after table header
    const headerIndex = content.indexOf(tableHeader);
    if (headerIndex !== -1) {
      const insertPoint = headerIndex + tableHeader.length;
      content =
        content.slice(0, insertPoint) +
        "\n" +
        newRows.join("\n") +
        content.slice(insertPoint);
    }

    writeFileSync(explorationPath, content, "utf-8");
    console.log(
      chalk.green(
        `  ✓ Appended ${newRows.length} anomalies to app-exploration.md`,
      ),
    );
  }
}

/**
 * Main vision check command.
 */
export async function visionCheck(options: VisionCheckOptions): Promise<void> {
  const projectRoot = process.cwd();

  // 1. Load configuration
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

  // 2. Dry run: list files only
  if (options.dryRun) {
    const screenshots = await resolveScreenshots(options.screenshots);
    console.log(chalk.blue("\n📷 Screenshots to analyze (dry run):\n"));
    for (const s of screenshots) {
      console.log(`  ${s.route} → ${s.path}`);
    }
    console.log(chalk.gray(`\nTotal: ${screenshots.length} files`));
    console.log(chalk.gray(`Ollama: ${config.url} (${config.model})`));
    return;
  }

  // 3. Health check
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

  // 4. Resolve screenshots
  const screenshots = await resolveScreenshots(options.screenshots);
  if (screenshots.length === 0) {
    console.log(chalk.yellow("No screenshots found matching pattern"));
    process.exit(0);
  }

  if (!options.json) {
    console.log(chalk.blue(`\n🔍 Analyzing ${screenshots.length} screenshots...\n`));
  }

  // 5. Batch analyze
  const concurrency = options.parallel || 4;
  const result = await batchAnalyzeScreenshots(config, screenshots, concurrency);

  // 6. Filter by severity if specified
  if (options.severity) {
    result.anomalies = filterBySeverity(result.anomalies, options.severity);
  }

  // 7. Output results
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    // Text output
    console.log(chalk.blue("─── Vision Check Results ───\n"));
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
        console.log(`  ${severityColor(`[${a.severity}]`)} ${a.route}`);
        console.log(`    Element: ${a.element}`);
        console.log(`    Type: ${a.type} (${a.position})`);
        console.log(`    ${a.description}\n`);
      }
    } else {
      console.log(chalk.green("\n  ✓ No layout anomalies detected\n"));
    }
  }

  // 8. Append to app-exploration.md if anomalies found
  if (result.anomalies.length > 0 && !options.json) {
    appendToExploration(projectRoot, result.anomalies);
  }

  // 9. Write to output file if specified
  if (options.output) {
    writeFileSync(options.output, JSON.stringify(result, null, 2), "utf-8");
    if (!options.json) {
      console.log(chalk.green(`  ✓ Results written to ${options.output}`));
    }
  }
}
