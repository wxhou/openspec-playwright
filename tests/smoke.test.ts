import { describe, it, expect } from "vitest";
import { execSync } from "child_process";
import { existsSync, readdirSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "..");
const distDir = join(ROOT, "dist");

// Skip all tests in this file if dist/ hasn't been built yet
const distExists = existsSync(distDir);

// ─── Dist smoke tests ─────────────────────────────────────────────────────────
// These tests verify the compiled output exists and is valid.
// If `npm run build` produces broken output, these tests will fail.
//
// Prerequisites: run `npm run build` first (or use `npm run test:smoke` which does both)
// Run with: npm run test:smoke

// ─── Build output exists ─────────────────────────────────────────────────────

(distExists ? describe : describe.skip)("dist output exists", () => {
  const srcDir = join(ROOT, "src");

  it("dist directory is generated", () => {
    expect(existsSync(distDir)).toBe(true);
  });

  it("compiles all source files to dist", () => {
    const srcFiles = countFiles(join(srcDir, "commands"), ".ts");
    const distFiles = countFiles(distDir, ".js");
    expect(distFiles).toBeGreaterThanOrEqual(srcFiles);
  });

  it("produces .js files alongside .d.ts declaration files", () => {
    const jsFiles = readdirSync(distDir, { recursive: true }).filter((f) =>
      String(f).endsWith(".js"),
    );
    const dtsFiles = readdirSync(distDir, { recursive: true }).filter((f) =>
      String(f).endsWith(".d.ts"),
    );
    // At minimum, commands/ should produce both
    expect(jsFiles.length).toBeGreaterThan(0);
    expect(dtsFiles.length).toBeGreaterThan(0);
  });

  it("bin/openspec-pw wrapper exists", () => {
    expect(existsSync(join(ROOT, "bin", "openspec-pw"))).toBe(true);
  });
});

// ─── Dist modules are importable ─────────────────────────────────────────────

(distExists ? describe : describe.skip)("dist modules are valid", () => {
  it("compiled commands export expected functions", async () => {
    const { init } = await import("../dist/commands/init.js");
    const { doctor } = await import("../dist/commands/doctor.js");
    const { run } = await import("../dist/commands/run.js");
    const { uninstall } = await import("../dist/commands/uninstall.js");
    const { update } = await import("../dist/commands/update.js");
    const { syncMcpTools } = await import("../dist/commands/mcpSync.js");
    const {
      detectEditors,
      detectCodex,
      buildCommandMeta,
      escapeYamlValue,
      ALL_ADAPTERS,
    } = await import("../dist/commands/editors.js");

    expect(typeof init).toBe("function");
    expect(typeof doctor).toBe("function");
    expect(typeof run).toBe("function");
    expect(typeof uninstall).toBe("function");
    expect(typeof update).toBe("function");
    expect(typeof syncMcpTools).toBe("function");
    expect(typeof detectEditors).toBe("function");
    expect(typeof detectCodex).toBe("function");
    expect(typeof buildCommandMeta).toBe("function");
    expect(typeof escapeYamlValue).toBe("function");
    expect(ALL_ADAPTERS.length).toBeGreaterThan(0);
  });

  it("ALL_ADAPTERS has 23 adapters", async () => {
    const { ALL_ADAPTERS } = await import("../dist/commands/editors.js");
    expect(ALL_ADAPTERS.length).toBe(23);
  });
});

// ─── CLI runs correctly ──────────────────────────────────────────────────────

(distExists ? describe : describe.skip)("CLI runs correctly", () => {
  const cli = "node dist/index.js";

  function runCli(args: string): {
    stdout: string;
    stderr: string;
    status: number;
  } {
    try {
      const stdout = execSync(`${cli} ${args}`, {
        cwd: ROOT,
        encoding: "utf-8",
      });
      return { stdout, stderr: "", status: 0 };
    } catch (err) {
      const e = err as { stdout?: string; stderr?: string; status?: number };
      return {
        stdout: e.stdout ?? "",
        stderr: e.stderr ?? "",
        status: e.status ?? 1,
      };
    }
  }

  it("--version prints version from package.json", async () => {
     
    const { version } = await import("../package.json", {
      assert: { type: "json" },
    });
    const { stdout } = runCli("--version");
    expect(stdout.trim()).toBe(version);
  });

  it("--help exits with 0 and lists all commands", () => {
    const { stdout } = runCli("--help");
    expect(stdout).toContain("init");
    expect(stdout).toContain("doctor");
    expect(stdout).toContain("update");
    expect(stdout).toContain("run");
    expect(stdout).toContain("uninstall");
  });

  it("init --help works", () => {
    const { stdout } = runCli("init --help");
    expect(stdout).toContain("--no-mcp");
    expect(stdout).toContain("--no-seed");
  });

  it("run --help shows project and timeout options", () => {
    const { stdout } = runCli("run --help");
    expect(stdout).toContain("--project");
    expect(stdout).toContain("--timeout");
  });

  it("unknown command exits non-zero", () => {
    const { status } = runCli("nonexistent-cmd-xyz");
    expect(status).not.toBe(0);
  });
});

// ─── Helper ───────────────────────────────────────────────────────────────────

function countFiles(dir: string, ext: string): number {
  let count = 0;
  for (const entry of readdirSync(dir, { recursive: true })) {
    if (String(entry).endsWith(ext)) count++;
  }
  return count;
}
