/**
 * Cross-platform command execution helpers.
 *
 * On Windows, `npm`, `npx`, and `claude` are `.cmd` batch files.
 * Node's `execFile` needs `shell: true` to find and execute them.
 *
 * `shell: true` is safe here because arguments are passed as arrays
 * (Node properly quotes them), not as interpolated shell strings.
 */
/** Whether to set `shell: true` for `execFile` calls (required on Windows). */
export const needsShell = process.platform === "win32";
//# sourceMappingURL=platform.js.map