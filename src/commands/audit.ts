import { execSync } from "child_process";
import {
  existsSync,
  readdirSync,
  readFileSync,
} from "fs";
import { join } from "path";
import chalk from "chalk";

interface AuditResult {
  fileName: string;
  issue: string;
  detail?: string;
}

export async function audit() {
  const projectRoot = process.cwd();
  const testsDir = join(projectRoot, "tests", "playwright");

  if (!existsSync(testsDir)) {
    console.log(
      chalk.yellow("  tests/playwright/ not found. Run `openspec-pw init` first.\n"),
    );
    return;
  }

  console.log(chalk.blue("\n🔍 OpenSpec Playwright: Audit\n"));

  const results: AuditResult[] = [];

  // 1. Get sitemap routes
  const sitemapRoutes = await getSitemapRoutes(projectRoot);
  const allRoutes = sitemapRoutes ?? [];

  // 2. Get OpenSpec change names
  const changeNames = await getChangeNames(projectRoot);

  // 3. Scan all spec files recursively
  const specFiles = collectSpecFiles(testsDir);

  // 4. Audit each spec file
  const SHARED_FILES = new Set([
    "seed.spec.ts",
    "app-all.spec.ts",
    "auth.setup.ts",
    "credentials.yaml",
    "app-knowledge.md",
    "playwright.config.ts",
    "mcp-tools.md",
  ]);

  for (const file of specFiles) {
    const relPath = file.replace(testsDir + "/", "");
    const content = readFileSync(file, "utf-8");

    // Skip shared files
    const fileName = relPath.split("/").pop() ?? "";
    if (SHARED_FILES.has(fileName)) continue;

    // 4a. Orphaned spec file: no matching OpenSpec change
    const changeName = fileName.replace(".spec.ts", "");
    // Check if this is a root-level old-style file
    if (!relPath.includes("/")) {
      if (changeNames.length > 0 && !changeNames.includes(changeName)) {
        results.push({
          fileName: relPath,
          issue: "Orphaned spec file",
          detail: `No matching OpenSpec change found. Consider migrating to tests/playwright/changes/${changeName}/`,
        });
      }
    }

    // 4b. Check for hardcoded URLs not in sitemap
    const urlMatches = content.match(/https?:\/\/[^\s'"]+/g);
    if (urlMatches) {
      for (const url of urlMatches) {
        const pathname = new URL(url).pathname;
        if (
          pathname !== "/" &&
          allRoutes.length > 0 &&
          !allRoutes.includes(pathname) &&
          !allRoutes.some((r) => pathname.startsWith(r))
        ) {
          results.push({
            fileName: relPath,
            issue: "Route not in sitemap",
            detail: `Found URL: ${url}`,
          });
        }
      }
    }
  }

  // 5. Check for missing auth.setup when tests reference protected routes
  const needsAuth = specFiles.some((file) => {
    const content = readFileSync(file, "utf-8");
    const fileName = file.split("/").pop() ?? "";
    return (
      !SHARED_FILES.has(fileName) &&
      (content.includes("storageState") ||
        content.includes("auth.setup") ||
        content.includes("authenticated") ||
        content.includes("dashboard") ||
        content.includes("profile"))
    );
  });

  if (needsAuth && !existsSync(join(testsDir, "auth.setup.ts"))) {
    results.push({
      fileName: "auth.setup.ts",
      issue: "Missing auth setup",
      detail:
        "Tests reference protected routes but auth.setup.ts is not found",
    });
  }

  // 6. Check for deprecated old-style file locations
  const rootSpecFiles = readdirSync(testsDir).filter(
    (f) => f.endsWith(".spec.ts") && !SHARED_FILES.has(f),
  );
  for (const f of rootSpecFiles) {
    results.push({
      fileName: f,
      issue: "Old-style file location",
      detail: `Run \`openspec-pw migrate\` to move to tests/playwright/changes/${f.replace(".spec.ts", "")}/`,
    });
  }

  // 7. Output results
  if (results.length === 0) {
    console.log(
      chalk.green("  ✅ No issues found. All tests look healthy.\n"),
    );
    return;
  }

  console.log(
    chalk.yellow(`─── Found ${results.length} issue(s) ───`),
  );

  // Group by issue type
  const grouped: Record<string, AuditResult[]> = {};
  for (const r of results) {
    if (!grouped[r.issue]) grouped[r.issue] = [];
    grouped[r.issue].push(r);
  }

  for (const [issue, items] of Object.entries(grouped)) {
    console.log(chalk.yellow(`\n  ⚠ ${issue}`));
    for (const item of items) {
      console.log(chalk.gray(`    - ${item.fileName}`));
      if (item.detail) {
        console.log(chalk.gray(`      → ${item.detail}`));
      }
    }
  }

  console.log(
    chalk.blue("\n─── Suggested fixes ───"),
  );
  if (Object.keys(grouped).some((k) => k.includes("Old-style"))) {
    console.log(
      chalk.green("  Run `openspec-pw migrate` to reorganize file structure."),
    );
  }
  if (Object.keys(grouped).some((k) => k.includes("Missing auth"))) {
    console.log(
      chalk.green("  Run `openspec-pw init` with auth credentials configured."),
    );
  }
  if (Object.keys(grouped).some((k) => k.includes("Route not in sitemap"))) {
    console.log(
      chalk.green("  Update sitemap or verify route is intentional."),
    );
  }
  console.log();
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getSitemapRoutes(projectRoot: string): Promise<string[] | null> {
  try {
    const baseUrl = process.env.BASE_URL || "http://localhost:3000";
    const result = execSync(`curl -s "${baseUrl}/sitemap.xml" | grep -oP '(?<=<loc>)[^<]+' | head -50`, {
      cwd: projectRoot,
      encoding: "utf-8",
      timeout: 10000,
    });
    const urls = result
      .split("\n")
      .filter(Boolean)
      .map((u) => {
        try {
          return new URL(u).pathname;
        } catch {
          return null;
        }
      })
      .filter(Boolean) as string[];
    return [...new Set(urls)];
  } catch {
    return null;
  }
}

async function getChangeNames(projectRoot: string): Promise<string[]> {
  try {
    const result = execSync("npx openspec list --json", {
      cwd: projectRoot,
      encoding: "utf-8",
      timeout: 30000,
    });
    const data = JSON.parse(result);
    return Array.isArray(data)
      ? data.map((c: { name: string }) => c.name)
      : Object.keys(data);
  } catch {
    return [];
  }
}

function collectSpecFiles(dir: string, collected: string[] = []): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip node_modules, .auth, __snapshots__ etc.
      if (
        !entry.name.startsWith(".") &&
        entry.name !== "node_modules" &&
        entry.name !== "__snapshots__"
      ) {
        collectSpecFiles(fullPath, collected);
      }
    } else if (entry.name.endsWith(".spec.ts")) {
      collected.push(fullPath);
    }
  }
  return collected;
}
