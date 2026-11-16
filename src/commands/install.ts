import { existsSync } from "fs";
import { homedir } from "os";
import { posix, win32 } from "path";
import chalk from "chalk";
import { execFileSync } from "../shared/exec.js";

export type InstallChannel = "stable" | "latest";

export interface InstallOptions {
  claude?: boolean;
  run?: boolean;
  verify?: boolean;
  channel?: string;
  version?: string;
}

export interface PlannedCommand {
  label: string;
  command: string;
}

export interface InstallPlan {
  platform: NodeJS.Platform;
  platformLabel: string;
  channel?: InstallChannel;
  version?: string;
  displayCommands: PlannedCommand[];
  execCommand: string;
  execKind: "bash" | "powershell";
}

export interface InstallDeps {
  platform: NodeJS.Platform;
  arch: string;
  env: NodeJS.ProcessEnv;
  homedir: string;
  exists: (path: string) => boolean;
  execFileSync: typeof execFileSync;
  log: (message: string) => void;
  error: (message: string) => void;
}

export interface ClaudeBinary {
  path: string;
  source: "path" | "fallback";
}

interface PathLookupOptions {
  platform?: NodeJS.Platform;
  pathValue?: string;
  pathext?: string;
  exists?: (path: string) => boolean;
}

const INSTALL_TIMEOUT_MS = 10 * 60 * 1000;
const VERSION_TIMEOUT_MS = 10 * 1000;
const DEFAULT_PATHEXT = ".EXE;.CMD;.BAT;.COM";

export const INSTALL_URLS = {
  sh: "https://claude.ai/install.sh",
  ps1: "https://claude.ai/install.ps1",
  cmd: "https://claude.ai/install.cmd",
  setup: "https://code.claude.com/docs/en/setup",
  troubleshoot: "https://code.claude.com/docs/en/troubleshoot-install",
  supportedCountries: "https://www.anthropic.com/supported-countries",
} as const;

export function createInstallDeps(): InstallDeps {
  return {
    platform: process.platform,
    arch: process.arch,
    env: process.env,
    homedir: homedir(),
    exists: existsSync,
    execFileSync,
    log: (message) => console.log(message),
    error: (message) => console.error(message),
  };
}

function pathFor(platform: NodeJS.Platform) {
  return platform === "win32" ? win32 : posix;
}

function executableNames(
  tool: string,
  platform: NodeJS.Platform,
  pathext: string,
): string[] {
  if (platform !== "win32") return [tool];
  const extensions = pathext
    .split(";")
    .map((extension) => extension.trim())
    .filter(Boolean);
  const names = extensions.map(
    (extension) => `${tool}${extension.toLowerCase()}`,
  );
  names.push(tool);
  return [...new Set(names)];
}

export function findOnPath(
  tool: string,
  options: PathLookupOptions = {},
): string | null {
  const platform = options.platform ?? process.platform;
  const pathValue = options.pathValue ?? process.env.PATH ?? "";
  const pathext = options.pathext ?? process.env.PATHEXT ?? DEFAULT_PATHEXT;
  const exists = options.exists ?? existsSync;
  const pathApi = pathFor(platform);

  for (const rawEntry of pathValue.split(pathApi.delimiter)) {
    const entry = rawEntry.replace(/^"(.*)"$/, "$1").trim();
    if (!entry) continue;
    for (const name of executableNames(tool, platform, pathext)) {
      const candidate = pathApi.join(entry, name);
      if (exists(candidate)) return candidate;
    }
  }
  return null;
}

export function resolveClaudeBinary(
  options: PathLookupOptions & { homedir?: string } = {},
): ClaudeBinary | null {
  const platform = options.platform ?? process.platform;
  const onPath = findOnPath("claude", options);
  if (onPath) return { path: onPath, source: "path" };

  const pathApi = pathFor(platform);
  const home = options.homedir ?? homedir();
  const fallback = pathApi.join(
    home,
    ".local",
    "bin",
    platform === "win32" ? "claude.exe" : "claude",
  );
  const exists = options.exists ?? existsSync;
  if (exists(fallback)) return { path: fallback, source: "fallback" };
  return null;
}

export function planInstall(input: {
  platform: NodeJS.Platform;
  channel?: InstallChannel;
  version?: string;
}): InstallPlan | null {
  const { platform, version } = input;
  const channel = version ? undefined : (input.channel ?? "latest");
  const selector = version ?? channel ?? "latest";

  if (platform === "darwin" || platform === "linux") {
    const command = `curl -fsSL ${INSTALL_URLS.sh} | bash -s ${selector}`;
    return {
      platform,
      platformLabel: platform === "darwin" ? "macOS" : "Linux/WSL",
      channel,
      version,
      displayCommands: [{ label: "Command", command }],
      execCommand: command,
      execKind: "bash",
    };
  }

  if (platform === "win32") {
    const powershell =
      selector === "latest"
        ? `irm ${INSTALL_URLS.ps1} | iex`
        : `& ([scriptblock]::Create((irm ${INSTALL_URLS.ps1}))) ${selector}`;
    const cmd =
      selector === "latest"
        ? `curl -fsSL ${INSTALL_URLS.cmd} -o install.cmd && install.cmd && del install.cmd`
        : `curl -fsSL ${INSTALL_URLS.cmd} -o install.cmd && install.cmd ${selector} && del install.cmd`;
    return {
      platform,
      platformLabel: "Windows",
      channel,
      version,
      displayCommands: [
        { label: "PowerShell", command: powershell },
        { label: "CMD", command: cmd },
      ],
      execCommand: powershell,
      execKind: "powershell",
    };
  }

  return null;
}

export function parseClaudeVersion(output: string): string | null {
  const match = output.trim().match(/^(\d+\.\d+\.\d+)/);
  return match ? match[1] : null;
}

function nativeLauncherPath(deps: InstallDeps): string {
  return pathFor(deps.platform).join(
    deps.homedir,
    ".local",
    "bin",
    deps.platform === "win32" ? "claude.exe" : "claude",
  );
}

function firstLine(text: string): string {
  return text.split(/\r?\n/)[0].trim();
}

function readClaudeVersion(
  binary: string,
  deps: InstallDeps,
): { version: string | null; output: string; error: string | null } {
  try {
    const output = deps.execFileSync(binary, ["--version"], {
      encoding: "utf8",
      timeout: VERSION_TIMEOUT_MS,
      stdio: "pipe",
    });
    const text = String(output ?? "").trim();
    return { version: parseClaudeVersion(text), output: text, error: null };
  } catch (err) {
    return {
      version: null,
      output: "",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function printPathHint(deps: InstallDeps, binaryPath?: string): void {
  const dir = binaryPath
    ? pathFor(deps.platform).dirname(binaryPath)
    : pathFor(deps.platform).dirname(nativeLauncherPath(deps));
  deps.error(chalk.gray(`  Open a new terminal, or add ${dir} to PATH.`));
}

function verifyClaude(options: {
  version?: string;
  deps: InstallDeps;
}): number {
  const { deps, version: expected } = options;
  const binary = resolveClaudeBinary({
    platform: deps.platform,
    pathValue: deps.env.PATH,
    pathext: deps.env.PATHEXT,
    homedir: deps.homedir,
    exists: deps.exists,
  });

  if (!binary) {
    deps.error(chalk.red("  Claude Code is not installed or not on PATH."));
    deps.error(
      chalk.gray(`  Expected native launcher: ${nativeLauncherPath(deps)}`),
    );
    deps.error(chalk.gray("  Install: openspec-pw install --claude --run"));
    printPathHint(deps);
    deps.error(chalk.gray(`  Troubleshooting: ${INSTALL_URLS.troubleshoot}`));
    return 1;
  }

  const reading = readClaudeVersion(binary.path, deps);
  if (reading.error) {
    deps.error(chalk.red(`  Could not run ${binary.path} --version.`));
    deps.error(chalk.gray(`  ${firstLine(reading.error)}`));
    printPathHint(deps, binary.path);
    deps.error(chalk.gray(`  Troubleshooting: ${INSTALL_URLS.troubleshoot}`));
    return 1;
  }

  if (!reading.version) {
    deps.error(chalk.red("  Could not parse a Claude Code version."));
    deps.error(chalk.gray(`  Output: ${reading.output || "(empty)"}`));
    deps.error(chalk.gray('  Expected output like "2.1.89 (Claude Code)".'));
    printPathHint(deps, binary.path);
    deps.error(chalk.gray(`  Troubleshooting: ${INSTALL_URLS.troubleshoot}`));
    return 1;
  }

  if (expected && reading.version !== expected) {
    deps.error(
      chalk.red(
        `  Version mismatch: expected ${expected}, found ${reading.version}.`,
      ),
    );
    return 1;
  }

  deps.log(`  Path: ${binary.path}`);
  deps.log(`  Version: ${reading.version}`);

  if (binary.source === "fallback") {
    const dir = pathFor(deps.platform).dirname(binary.path);
    deps.log(chalk.gray(`\n  Note: ${dir} is not on PATH in this shell.`));
    deps.log(chalk.gray("  Open a new terminal, or add it to PATH."));
  }

  deps.log(chalk.gray("\n  For deeper diagnostics, run: claude doctor"));
  return 0;
}

function printRegionNotice(deps: InstallDeps): void {
  deps.log(
    chalk.gray(
      "\n  Claude Code is available only in Anthropic-supported countries/regions:",
    ),
  );
  deps.log(chalk.gray(`  ${INSTALL_URLS.supportedCountries}`));
  deps.log(
    chalk.gray(
      "  This command uses official Anthropic channels only; it does not provide mirrors, proxies, or region workarounds.",
    ),
  );
}

function printPlan(
  plan: InstallPlan,
  options: InstallOptions,
  deps: InstallDeps,
): void {
  deps.log(
    chalk.blue("\n  Claude Code installation (official native installer)\n"),
  );
  deps.log(`  Platform: ${plan.platformLabel} ${deps.arch}`);
  if (plan.version) {
    deps.log(`  Version: ${plan.version}`);
  } else {
    deps.log(`  Channel: ${plan.channel}`);
  }

  deps.log("");
  for (const entry of plan.displayCommands) {
    deps.log(`  ${entry.label}:`);
    deps.log(chalk.cyan(`    ${entry.command}`));
  }

  deps.log(chalk.gray(`\n  Official setup docs: ${INSTALL_URLS.setup}`));
  printRegionNotice(deps);

  if (!options.run) {
    const selector = plan.version
      ? ` --version ${plan.version}`
      : plan.channel && plan.channel !== "latest"
        ? ` --channel ${plan.channel}`
        : "";
    deps.log(
      chalk.gray(
        `\n  Run it with: openspec-pw install --claude --run${selector}`,
      ),
    );
  }
}

function printExisting(deps: InstallDeps): void {
  const binary = resolveClaudeBinary({
    platform: deps.platform,
    pathValue: deps.env.PATH,
    pathext: deps.env.PATHEXT,
    homedir: deps.homedir,
    exists: deps.exists,
  });
  if (!binary) return;

  const reading = readClaudeVersion(binary.path, deps);
  if (reading.version) {
    deps.log(
      chalk.gray(
        `\n  Existing Claude Code: ${reading.version} (${binary.path})`,
      ),
    );
  } else {
    deps.log(
      chalk.gray(
        `\n  Existing Claude Code: ${binary.path} (version check failed)`,
      ),
    );
  }
}

function missingTool(plan: InstallPlan, deps: InstallDeps): string | null {
  const tools =
    plan.execKind === "powershell" ? ["powershell"] : ["bash", "curl"];
  for (const tool of tools) {
    const found = findOnPath(tool, {
      platform: deps.platform,
      pathValue: deps.env.PATH,
      pathext: deps.env.PATHEXT,
      exists: deps.exists,
    });
    if (!found) {
      const hint =
        plan.execKind === "bash" && deps.platform === "linux"
          ? " On Alpine: apk add bash curl."
          : "";
      return `Missing required tool: ${tool}. Install it and retry.${hint}\n  Docs: ${INSTALL_URLS.setup}`;
    }
  }
  return null;
}

function executePlan(plan: InstallPlan, deps: InstallDeps): string | null {
  try {
    if (plan.execKind === "bash") {
      deps.execFileSync(
        "bash",
        ["-c", `set -o pipefail; ${plan.execCommand}`],
        { stdio: "inherit", timeout: INSTALL_TIMEOUT_MS },
      );
    } else {
      deps.execFileSync(
        "powershell.exe",
        [
          "-NoProfile",
          "-Command",
          `$ErrorActionPreference = 'Stop'; ${plan.execCommand}`,
        ],
        { stdio: "inherit", timeout: INSTALL_TIMEOUT_MS },
      );
    }
    return null;
  } catch (err) {
    const code =
      err instanceof Error ? (err as { code?: unknown }).code : undefined;
    if (code === "ETIMEDOUT") {
      return `Installation timed out after 10 minutes.\n  Troubleshooting: ${INSTALL_URLS.troubleshoot}`;
    }
    const detail = err instanceof Error ? err.message : String(err);
    return `Installation failed.\n  ${firstLine(detail)}\n  Troubleshooting: ${INSTALL_URLS.troubleshoot}`;
  }
}

function validateOptions(options: InstallOptions): string | null {
  const usage =
    "Usage: openspec-pw install --claude [--run] [--verify] [--channel stable|latest] [--version x.y.z]";

  if (!options.claude) {
    return `${usage}\n  Choose a target: --claude.`;
  }

  if (
    options.channel !== undefined &&
    options.channel !== "stable" &&
    options.channel !== "latest"
  ) {
    return `Invalid --channel "${options.channel}". Use "stable" or "latest".`;
  }

  if (
    options.version !== undefined &&
    !/^\d+\.\d+\.\d+$/.test(options.version)
  ) {
    return `Invalid --version "${options.version}". Expected x.y.z, for example 2.1.89.`;
  }

  if (options.channel !== undefined && options.version !== undefined) {
    return "Use either --channel or --version, not both.";
  }

  if (options.verify && !options.run && options.channel !== undefined) {
    return "--channel requires --run. Use --verify alone, --verify --version x.y.z, or --run --channel stable|latest.";
  }

  return null;
}

export function install(
  options: InstallOptions = {},
  deps: InstallDeps = createInstallDeps(),
): number {
  const validationError = validateOptions(options);
  if (validationError) {
    deps.error(chalk.red(`  ${validationError}`));
    return 2;
  }

  const channel = options.version
    ? undefined
    : ((options.channel as InstallChannel | undefined) ?? "latest");
  const plan = planInstall({
    platform: deps.platform,
    channel,
    version: options.version,
  });

  if (!plan) {
    deps.error(chalk.red(`  Unsupported platform: ${deps.platform}.`));
    deps.error(chalk.gray(`  Official setup docs: ${INSTALL_URLS.setup}`));
    return 2;
  }

  if (options.run) {
    printPlan(plan, options, deps);
    printExisting(deps);

    const missing = missingTool(plan, deps);
    if (missing) {
      deps.error(chalk.red(`\n  ${missing}`));
      return 1;
    }

    deps.log(`\n  Running: ${plan.execCommand}\n`);
    const executionError = executePlan(plan, deps);
    if (executionError) {
      deps.error(chalk.red(`\n  ${executionError}`));
      return 1;
    }

    deps.log(chalk.gray("\n  Installation command completed. Verifying...\n"));
    return verifyClaude({ version: options.version, deps });
  }

  if (options.verify) {
    deps.log(chalk.blue("\n  Claude Code verification\n"));
    const code = verifyClaude({ version: options.version, deps });
    printRegionNotice(deps);
    return code;
  }

  printPlan(plan, options, deps);
  return 0;
}
