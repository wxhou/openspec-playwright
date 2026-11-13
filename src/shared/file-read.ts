/**
 * Bounded whole-file reads for ownership checks and removal primitives.
 * Tool-managed config artifacts are small by nature; a multi-megabyte file
 * cannot be tool-generated, so refusing to read it keeps machine-wide scans
 * (`remove --all`) and batch removals from pulling arbitrary input into
 * memory (§7 resource bounds).
 */
import { readFileSync, statSync } from "fs";

/** Upper bound for a file whose content decides tool ownership (1 MB). */
export const MAX_OWNERSHIP_READ_BYTES = 1024 * 1024;

export type CappedRead =
  | { kind: "ok"; content: string }
  | { kind: "missing" }
  | { kind: "too-large" }
  | { kind: "unreadable"; error: unknown };

function isNotFound(err: unknown): boolean {
  return (err as NodeJS.ErrnoException | undefined)?.code === "ENOENT";
}

/**
 * Read a text file only when it is a regular file within `maxBytes`.
 * Missing and unreadable inputs are reported separately so callers can skip
 * silently only where that is safe and surface real failures elsewhere.
 */
export function readTextFileCapped(
  path: string,
  maxBytes: number = MAX_OWNERSHIP_READ_BYTES,
): CappedRead {
  let size: number;
  try {
    const stat = statSync(path);
    if (!stat.isFile()) {
      return { kind: "unreadable", error: new Error(`${path} is not a regular file`) };
    }
    size = stat.size;
  } catch (err) {
    return isNotFound(err) ? { kind: "missing" } : { kind: "unreadable", error: err };
  }
  if (size > maxBytes) return { kind: "too-large" };
  try {
    return { kind: "ok", content: readFileSync(path, "utf-8") };
  } catch (err) {
    return isNotFound(err) ? { kind: "missing" } : { kind: "unreadable", error: err };
  }
}
