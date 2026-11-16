import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "fs";
import { join, win32 } from "path";
import {
  INSTALL_URLS,
  findOnPath,
  install,
  parseClaudeVersion,
  planInstall,
  resolveClaudeBinary,
} from "../../src/commands/install.js";
import type { InstallDeps } from "../../src/commands/install.js";
import { execFileSync } from "../../src/shared/exec.js";

function makeDeps(overrides: Partial<InstallDeps> = {}) {
  const logs: string[] = [];
  const errors: string[] = [];
  const deps: InstallDeps = {
    platform: "darwin",
    arch: "arm64",
    env: { PATH: "/usr/local/bin:/usr/bin", PATHEXT: ".EXE;.CMD" },
    homedir: "/home/tester",
    exists: () => false,
    execFileSync: vi.fn() as unknown as typeof execFileSync,
    log: (message: string) => logs.push(message),
    error: (message: string) => errors.push(message),
    ...overrides,
  };
  return { deps, logs, errors };
}

function unixDepsWithClaude() {
  const exists = (path: string) =>
    path === "/usr/bin/bash" ||
    path === "/usr/bin/curl" ||
    path === "/usr/bin/claude";
  const execFileSyncMock = vi.fn((file: string) =>
    file === "/usr/bin/claude" ? "2.1.325 (Claude Code)\n" : null,
  ) as unknown as typeof execFileSync;
  return makeDeps({
    env: { PATH: "/usr/bin", PATHEXT: "" },
    exists,
    execFileSync: execFileSyncMock,
  });
}

function windowsDepsWithClaude() {
  const powershell = win32.join("C:\\Windows\\System32", "powershell.exe");
  const claude = win32.join("C:\\Tools", "claude.exe");
  const exists = (path: string) => path === powershell || path === claude;
  const execFileSyncMock = vi.fn((file: string) =>
    file === claude ? "2.1.325 (Claude Code)\n" : null,
  ) as unknown as typeof execFileSync;
  return makeDeps({
    platform: "win32",
    arch: "x64",
    env: {
      PATH: "C:\\Windows\\System32;C:\\Tools",
      PATHEXT: ".EXE;.CMD",
    },
    homedir: "C:\\Users\\tester",
    exists,
    execFileSync: execFileSyncMock,
  });
}

describe("planInstall", () => {
  it("defaults to latest on macOS", () => {
    const plan = planInstall({ platform: "darwin" });
    expect(plan?.channel).toBe("latest");
    expect(plan?.platformLabel).toBe("macOS");
    expect(plan?.displayCommands).toEqual([
      {
        label: "Command",
        command: `curl -fsSL ${INSTALL_URLS.sh} | bash -s latest`,
      },
    ]);
    expect(plan?.execKind).toBe("bash");
  });

  it("plans stable on Linux", () => {
    const plan = planInstall({ platform: "linux", channel: "stable" });
    expect(plan?.platformLabel).toBe("Linux/WSL");
    expect(plan?.displayCommands[0].command).toBe(
      `curl -fsSL ${INSTALL_URLS.sh} | bash -s stable`,
    );
  });

  it("plans an exact version without a channel", () => {
    const plan = planInstall({ platform: "linux", version: "2.1.89" });
    expect(plan?.channel).toBeUndefined();
    expect(plan?.version).toBe("2.1.89");
    expect(plan?.displayCommands[0].command).toBe(
      `curl -fsSL ${INSTALL_URLS.sh} | bash -s 2.1.89`,
    );
  });

  it("prints both official Windows commands and executes PowerShell", () => {
    const plan = planInstall({ platform: "win32" });
    expect(plan?.displayCommands).toEqual([
      {
        label: "PowerShell",
        command: `irm ${INSTALL_URLS.ps1} | iex`,
      },
      {
        label: "CMD",
        command: `curl -fsSL ${INSTALL_URLS.cmd} -o install.cmd && install.cmd && del install.cmd`,
      },
    ]);
    expect(plan?.execCommand).toContain(INSTALL_URLS.ps1);
    expect(plan?.execKind).toBe("powershell");
  });

  it("plans the Windows stable and version variants", () => {
    const stable = planInstall({ platform: "win32", channel: "stable" });
    expect(stable?.displayCommands).toEqual([
      {
        label: "PowerShell",
        command: `& ([scriptblock]::Create((irm ${INSTALL_URLS.ps1}))) stable`,
      },
      {
        label: "CMD",
        command: `curl -fsSL ${INSTALL_URLS.cmd} -o install.cmd && install.cmd stable && del install.cmd`,
      },
    ]);

    const pinned = planInstall({ platform: "win32", version: "2.1.89" });
    expect(pinned?.displayCommands[0].command).toBe(
      `& ([scriptblock]::Create((irm ${INSTALL_URLS.ps1}))) 2.1.89`,
    );
    expect(pinned?.displayCommands[1].command).toBe(
      `curl -fsSL ${INSTALL_URLS.cmd} -o install.cmd && install.cmd 2.1.89 && del install.cmd`,
    );
  });

  it("rejects unsupported platforms", () => {
    expect(planInstall({ platform: "freebsd" })).toBeNull();
  });
});

describe("parseClaudeVersion", () => {
  it("parses a leading semantic version", () => {
    expect(parseClaudeVersion("2.1.89 (Claude Code)")).toBe("2.1.89");
    expect(parseClaudeVersion("2.1.325\n")).toBe("2.1.325");
  });

  it("returns null when the version is not leading or absent", () => {
    expect(parseClaudeVersion("Claude Code 2.1.89")).toBeNull();
    expect(parseClaudeVersion("development build")).toBeNull();
    expect(parseClaudeVersion("")).toBeNull();
  });
});

describe("PATH resolution", () => {
  it("finds claude on a POSIX PATH", () => {
    const exists = (path: string) => path === "/usr/bin/claude";
    expect(
      findOnPath("claude", {
        platform: "darwin",
        pathValue: "/usr/local/bin:/usr/bin",
        exists,
      }),
    ).toBe("/usr/bin/claude");
    expect(
      resolveClaudeBinary({
        platform: "darwin",
        pathValue: "/usr/local/bin:/usr/bin",
        homedir: "/home/tester",
        exists,
      }),
    ).toEqual({ path: "/usr/bin/claude", source: "path" });
  });

  it("falls back to the native launcher when PATH has no claude", () => {
    const fallback = "/home/tester/.local/bin/claude";
    const exists = (path: string) => path === fallback;
    expect(
      resolveClaudeBinary({
        platform: "linux",
        pathValue: "/usr/bin",
        homedir: "/home/tester",
        exists,
      }),
    ).toEqual({ path: fallback, source: "fallback" });
  });

  it("uses PATHEXT when resolving on Windows", () => {
    const claude = win32.join("C:\\Tools", "claude.exe");
    const exists = (path: string) => path === claude;
    expect(
      findOnPath("claude", {
        platform: "win32",
        pathValue: "C:\\Windows;C:\\Tools",
        pathext: ".EXE;.CMD",
        exists,
      }),
    ).toBe(claude);
  });

  it("prefers PATH over the native fallback", () => {
    const onPath = "/usr/bin/claude";
    const fallback = "/home/tester/.local/bin/claude";
    const exists = (path: string) => path === onPath || path === fallback;
    expect(
      resolveClaudeBinary({
        platform: "darwin",
        pathValue: "/usr/bin",
        homedir: "/home/tester",
        exists,
      }),
    ).toEqual({ path: onPath, source: "path" });
  });

  it("returns null when neither PATH nor the fallback exists", () => {
    expect(
      resolveClaudeBinary({
        platform: "darwin",
        pathValue: "/usr/bin",
        homedir: "/home/tester",
        exists: () => false,
      }),
    ).toBeNull();
  });
});

describe("install validation", () => {
  it("requires the --claude target", () => {
    const { deps, logs, errors } = makeDeps();
    expect(install({}, deps)).toBe(2);
    expect(logs).toHaveLength(0);
    expect(errors.join("\n")).toContain("Choose a target: --claude");
    expect(deps.execFileSync).not.toHaveBeenCalled();
  });

  it("requires --claude even when run or verify is set", () => {
    for (const options of [{ run: true }, { verify: true }]) {
      const { deps, errors } = makeDeps();
      expect(install(options, deps)).toBe(2);
      expect(errors.join("\n")).toContain("Choose a target: --claude");
      expect(deps.execFileSync).not.toHaveBeenCalled();
    }
  });

  it("rejects an invalid channel", () => {
    const { deps, errors } = makeDeps();
    expect(install({ claude: true, channel: "beta" }, deps)).toBe(2);
    expect(errors.join("\n")).toContain('Invalid --channel "beta"');
    expect(deps.execFileSync).not.toHaveBeenCalled();
  });

  it("rejects an invalid version", () => {
    const { deps, errors } = makeDeps();
    expect(install({ claude: true, version: "latest" }, deps)).toBe(2);
    expect(errors.join("\n")).toContain('Invalid --version "latest"');
    expect(deps.execFileSync).not.toHaveBeenCalled();
  });

  it("rejects channel and version together", () => {
    const { deps, errors } = makeDeps();
    expect(
      install({ claude: true, channel: "stable", version: "2.1.89" }, deps),
    ).toBe(2);
    expect(errors.join("\n")).toContain("Use either --channel or --version");
    expect(deps.execFileSync).not.toHaveBeenCalled();
  });

  it("rejects channel with verify-only", () => {
    const { deps, errors } = makeDeps();
    expect(
      install({ claude: true, verify: true, channel: "stable" }, deps),
    ).toBe(2);
    expect(errors.join("\n")).toContain("--channel requires --run");
    expect(deps.execFileSync).not.toHaveBeenCalled();
  });

  it("rejects unsupported platforms", () => {
    const { deps, errors } = makeDeps({ platform: "freebsd" });
    expect(install({ claude: true }, deps)).toBe(2);
    expect(errors.join("\n")).toContain("Unsupported platform: freebsd");
    expect(deps.execFileSync).not.toHaveBeenCalled();
  });

  it("does not execute anything when only printing", () => {
    const { deps, logs } = makeDeps();
    expect(install({ claude: true }, deps)).toBe(0);
    expect(logs.join("\n")).toContain(
      `curl -fsSL ${INSTALL_URLS.sh} | bash -s latest`,
    );
    expect(logs.join("\n")).toContain(INSTALL_URLS.supportedCountries);
    expect(logs.join("\n")).toContain(
      "does not provide mirrors, proxies, or region workarounds",
    );
    expect(logs.join("\n")).toContain("Run it with:");
    expect(deps.execFileSync).not.toHaveBeenCalled();
  });

  it("prints stable when selected without --run", () => {
    const { deps, logs } = makeDeps();
    expect(install({ claude: true, channel: "stable" }, deps)).toBe(0);
    expect(logs.join("\n")).toContain("bash -s stable");
    expect(deps.execFileSync).not.toHaveBeenCalled();
  });

  it("prints Windows commands without executing them", () => {
    const { deps, logs } = windowsDepsWithClaude();
    const result = install({ claude: true }, deps);
    expect(result).toBe(0);
    expect(logs.join("\n")).toContain("PowerShell:");
    expect(logs.join("\n")).toContain("CMD:");
    expect(deps.execFileSync).not.toHaveBeenCalled();
  });
});

describe("install --run", () => {
  it("runs the official installer and verifies the result", () => {
    const { deps, logs, errors } = unixDepsWithClaude();
    expect(install({ claude: true, run: true }, deps)).toBe(0);
    const output = logs.join("\n");
    expect(output).toContain("Existing Claude Code: 2.1.325");
    expect(output).toContain("Running:");
    expect(output).toContain("Installation command completed. Verifying...");
    expect(output).toContain("Path: /usr/bin/claude");
    expect(output).toContain("Version: 2.1.325");
    expect(output).toContain(INSTALL_URLS.supportedCountries);
    expect(errors).toHaveLength(0);
    expect(deps.execFileSync).toHaveBeenCalledWith(
      "bash",
      ["-c", `set -o pipefail; curl -fsSL ${INSTALL_URLS.sh} | bash -s latest`],
      expect.objectContaining({ stdio: "inherit" }),
    );
  });

  it("reports installer failure without verifying", () => {
    const { deps, errors } = makeDeps({
      env: { PATH: "/usr/bin", PATHEXT: "" },
      exists: (path: string) =>
        path === "/usr/bin/bash" || path === "/usr/bin/curl",
      execFileSync: vi.fn(() => {
        throw Object.assign(new Error("Command failed"), { code: 1 });
      }) as unknown as typeof execFileSync,
    });
    expect(install({ claude: true, run: true }, deps)).toBe(1);
    expect(errors.join("\n")).toContain("Installation failed");
    expect(errors.join("\n")).toContain(INSTALL_URLS.troubleshoot);
    expect(deps.execFileSync).toHaveBeenCalledTimes(1);
  });

  it("reports installer timeout", () => {
    const { deps, errors } = makeDeps({
      env: { PATH: "/usr/bin", PATHEXT: "" },
      exists: (path: string) =>
        path === "/usr/bin/bash" || path === "/usr/bin/curl",
      execFileSync: vi.fn(() => {
        throw Object.assign(new Error("timeout"), { code: "ETIMEDOUT" });
      }) as unknown as typeof execFileSync,
    });
    expect(install({ claude: true, run: true }, deps)).toBe(1);
    expect(errors.join("\n")).toContain("timed out after 10 minutes");
    expect(errors.join("\n")).toContain(INSTALL_URLS.troubleshoot);
  });

  it("preflights bash and curl before executing", () => {
    const { deps, errors } = makeDeps({
      env: { PATH: "/usr/bin", PATHEXT: "" },
      exists: (path: string) => path === "/usr/bin/bash",
    });
    expect(install({ claude: true, run: true }, deps)).toBe(1);
    expect(errors.join("\n")).toContain("Missing required tool: curl");
    expect(deps.execFileSync).not.toHaveBeenCalled();
  });

  it("runs PowerShell on Windows with fail-fast error handling", () => {
    const { deps, logs } = windowsDepsWithClaude();
    expect(install({ claude: true, run: true }, deps)).toBe(0);
    expect(logs.join("\n")).toContain("PowerShell:");
    expect(deps.execFileSync).toHaveBeenCalledWith(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        `$ErrorActionPreference = 'Stop'; irm ${INSTALL_URLS.ps1} | iex`,
      ],
      expect.objectContaining({ stdio: "inherit" }),
    );
  });

  it("reports PowerShell download failure", () => {
    const powershell = win32.join("C:\\Windows\\System32", "powershell.exe");
    const { deps, errors } = makeDeps({
      platform: "win32",
      env: { PATH: "C:\\Windows\\System32", PATHEXT: ".EXE" },
      homedir: "C:\\Users\\tester",
      exists: (path: string) => path === powershell,
      execFileSync: vi.fn(() => {
        throw Object.assign(new Error("irm failed"), { code: 1 });
      }) as unknown as typeof execFileSync,
    });
    expect(install({ claude: true, run: true }, deps)).toBe(1);
    expect(errors.join("\n")).toContain("Installation failed");
    expect(errors.join("\n")).toContain(INSTALL_URLS.troubleshoot);
  });
});

describe("install --verify", () => {
  it("verifies a Claude Code on PATH", () => {
    const { deps, logs, errors } = unixDepsWithClaude();
    expect(install({ claude: true, verify: true }, deps)).toBe(0);
    expect(logs.join("\n")).toContain("Path: /usr/bin/claude");
    expect(logs.join("\n")).toContain("Version: 2.1.325");
    expect(logs.join("\n")).toContain(INSTALL_URLS.supportedCountries);
    expect(errors).toHaveLength(0);
    expect(deps.execFileSync).toHaveBeenCalledWith(
      "/usr/bin/claude",
      ["--version"],
      expect.objectContaining({ timeout: 10_000 }),
    );
  });

  it("falls back to the native launcher and prints a PATH hint", () => {
    const fallback = "/home/tester/.local/bin/claude";
    const { deps, logs } = makeDeps({
      env: { PATH: "/usr/bin", PATHEXT: "" },
      exists: (path: string) => path === fallback,
      execFileSync: vi.fn(
        () => "2.1.325 (Claude Code)\n",
      ) as unknown as typeof execFileSync,
    });
    expect(install({ claude: true, verify: true }, deps)).toBe(0);
    expect(logs.join("\n")).toContain(`Path: ${fallback}`);
    expect(logs.join("\n")).toContain("is not on PATH in this shell");
  });

  it("rejects a version mismatch", () => {
    const { deps, errors } = unixDepsWithClaude();
    expect(
      install({ claude: true, verify: true, version: "2.1.89" }, deps),
    ).toBe(1);
    expect(errors.join("\n")).toContain(
      "Version mismatch: expected 2.1.89, found 2.1.325",
    );
  });

  it("reports a missing installation", () => {
    const { deps, errors } = makeDeps({
      env: { PATH: "/usr/bin", PATHEXT: "" },
      exists: () => false,
    });
    expect(install({ claude: true, verify: true }, deps)).toBe(1);
    expect(errors.join("\n")).toContain(
      "Claude Code is not installed or not on PATH",
    );
    expect(errors.join("\n")).toContain("Open a new terminal");
    expect(deps.execFileSync).not.toHaveBeenCalled();
  });

  it("reports unparseable version output", () => {
    const { deps, errors } = makeDeps({
      env: { PATH: "/usr/bin", PATHEXT: "" },
      exists: (path: string) => path === "/usr/bin/claude",
      execFileSync: vi.fn(
        () => "development build\n",
      ) as unknown as typeof execFileSync,
    });
    expect(install({ claude: true, verify: true }, deps)).toBe(1);
    expect(errors.join("\n")).toContain(
      "Could not parse a Claude Code version",
    );
    expect(errors.join("\n")).toContain("development build");
  });

  it("reports a failed version command", () => {
    const { deps, errors } = makeDeps({
      env: { PATH: "/usr/bin", PATHEXT: "" },
      exists: (path: string) => path === "/usr/bin/claude",
      execFileSync: vi.fn(() => {
        throw new Error("spawn failed");
      }) as unknown as typeof execFileSync,
    });
    expect(install({ claude: true, verify: true }, deps)).toBe(1);
    expect(errors.join("\n")).toContain(
      "Could not run /usr/bin/claude --version",
    );
    expect(errors.join("\n")).toContain("Open a new terminal");
    expect(errors.join("\n")).toContain(INSTALL_URLS.troubleshoot);
  });
});

describe("install source guard", () => {
  const source = readFileSync(
    join(process.cwd(), "src/commands/install.ts"),
    "utf8",
  );

  it("does not write credentials, settings, or project files", () => {
    expect(source).not.toMatch(
      /writeFileSync|appendFileSync|mkdirSync|rmSync|unlinkSync|createWriteStream/,
    );
    expect(source).not.toMatch(
      /ANTHROPIC_API_KEY|ANTHROPIC_AUTH_TOKEN|password|credential/i,
    );
    expect(source).not.toMatch(
      /settings\.json|autoUpdatesChannel|DISABLE_UPDATES/,
    );
  });

  it("does not provide mirror, registry, or proxy overrides", () => {
    expect(source).not.toMatch(
      /--mirror|--registry|--proxy|npmmirror|npm\s+config|registry/i,
    );
  });

  it("does not use sudo", () => {
    expect(source).not.toMatch(/\bsudo\b/);
  });
});
