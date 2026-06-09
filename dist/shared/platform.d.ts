/**
 * Cross-platform command resolution.
 *
 * On Windows, `npm`, `npx`, and similar tools are `.cmd` batch files —
 * not bare executables.  Node's `execFile` (without `shell: true`) won't
 * find them without the `.cmd` extension, resulting in `ENOENT` errors.
 *
 * Usage:
 *   execFile(cmd("npm"), ["install", ...], opts)
 *   execFile(cmd("npx"), ["playwright", ...], opts)
 */
export declare function cmd(name: string): string;
