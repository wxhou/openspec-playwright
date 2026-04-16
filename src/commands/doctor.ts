import { existsSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";
import chalk from "chalk";
import { loadOllamaConfig, checkOllamaHealth } from "../utils/ollama.js";

export interface DoctorOptions {
  json?: boolean;
}

export async function doctor(options: DoctorOptions = {}) {
  const checks: Array<{
    category: string;
    name: string;
    ok: boolean;
    message?: string;
  }> = [];

  const projectRoot = process.cwd();

  // Node.js
  try {
    const node = execSync("node --version", { encoding: "utf-8" }).trim();
    checks.push({
      category: "Node.js",
      name: "node",
      ok: true,
      message: node,
    });
  } catch {
    checks.push({
      category: "Node.js",
      name: "node",
      ok: false,
      message: "not found",
    });
  }

  // npm
  try {
    const npm = execSync("npm --version", { encoding: "utf-8" }).trim();
    checks.push({
      category: "npm",
      name: "npm",
      ok: true,
      message: npm,
    });
  } catch {
    checks.push({
      category: "npm",
      name: "npm",
      ok: false,
      message: "not found",
    });
  }

  // OpenSpec
  const hasOpenSpec = existsSync(join(projectRoot, "openspec"));
  checks.push({
    category: "OpenSpec",
    name: "openspec",
    ok: hasOpenSpec,
    message: hasOpenSpec ? "initialized" : "not initialized",
  });

  // Playwright browsers
  try {
    const pw = execSync("npx playwright --version", {
      encoding: "utf-8",
    }).trim();
    checks.push({
      category: "Playwright Browsers",
      name: "playwright",
      ok: true,
      message: pw,
    });
  } catch {
    checks.push({
      category: "Playwright Browsers",
      name: "playwright",
      ok: false,
      message: "not installed",
    });
  }

  // Playwright MCP — use `claude mcp list` as source of truth (platform-independent)
  let mcpInstalled = false;
  try {
    const output = execSync("claude mcp list", {
      encoding: "utf-8",
      timeout: 10000,
    });
    if (output.includes("playwright")) {
      mcpInstalled = true;
    }
  } catch {
    // claude CLI not available or failed — MCP not configured
  }
  checks.push({
    category: "Playwright MCP",
    name: "playwright-mcp",
    ok: mcpInstalled,
    message: mcpInstalled ? "installed" : "not configured",
  });

  // Skill
  const hasSkill = existsSync(
    join(projectRoot, ".claude", "skills", "openspec-e2e", "SKILL.md"),
  );
  checks.push({
    category: "Claude Code Skill",
    name: "skill",
    ok: hasSkill,
    message: hasSkill ? "installed" : "not installed",
  });

  // Seed test
  const hasSeed = existsSync(
    join(projectRoot, "tests", "playwright", "seed.spec.ts"),
  );
  checks.push({
    category: "Seed Test",
    name: "seed",
    ok: hasSeed,
    message: hasSeed ? "found" : "not found (optional)",
  });

  // Vision Check (Ollama)
  const ollamaConfig = loadOllamaConfig(projectRoot);
  let visionOk = false;
  let visionMessage = "disabled";

  if (ollamaConfig.enabled) {
    const health = await checkOllamaHealth(ollamaConfig);
    visionOk = health.ok;
    visionMessage = health.message;
  }
  checks.push({
    category: "Vision Check",
    name: "ollama",
    ok: visionOk,
    message: visionMessage,
  });

  const allOk = checks.filter((c) => !c.ok && c.category !== "Seed Test" && c.category !== "Vision Check").length === 0;

  if (options.json) {
    console.log(
      JSON.stringify({ ok: allOk, checks }, null, 2),
    );
    if (!allOk) process.exit(1);
    return;
  }

  // Text output
  console.log(
    chalk.blue("\n🔍 OpenSpec + Playwright E2E Prerequisites Check\n"),
  );

  let lastCategory = "";
  for (const check of checks) {
    if (check.category !== lastCategory) {
      console.log(chalk.blue(`─── ${check.category} ───`));
      lastCategory = check.category;
    }
    if (check.ok) {
      console.log(chalk.green(`  ✓ ${check.name}: ${check.message}`));
    } else if (check.category === "Seed Test" || check.category === "Vision Check") {
      console.log(chalk.yellow(`  ⚠ ${check.name}: ${check.message}`));
    } else {
      console.log(chalk.red(`  ✗ ${check.name}: ${check.message}`));
    }
  }

  console.log(chalk.blue("\n─── Summary ───"));
  if (allOk) {
    console.log(chalk.green("  ✅ All prerequisites met!\n"));
    console.log(chalk.gray("  Run: /opsx:e2e <change-name> in Claude Code\n"));
  } else {
    console.log(chalk.red("  ❌ Some prerequisites are missing\n"));
    console.log(chalk.gray("  Run: openspec-pw init to fix\n"));
    process.exit(1);
  }
}
