/** Upper bound for a file whose content decides tool ownership (1 MB). */
export declare const MAX_OWNERSHIP_READ_BYTES: number;
export type CappedRead = {
    kind: "ok";
    content: string;
} | {
    kind: "missing";
} | {
    kind: "too-large";
} | {
    kind: "unreadable";
    error: unknown;
};
/**
 * Read a text file only when it is a regular file within `maxBytes`.
 * Missing and unreadable inputs are reported separately so callers can skip
 * silently only where that is safe and surface real failures elsewhere.
 */
export declare function readTextFileCapped(path: string, maxBytes?: number): CappedRead;
