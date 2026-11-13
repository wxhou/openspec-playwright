/**
 * True when `target` resolves inside `root` after symlinks. Missing tails are
 * resolved through their nearest existing ancestor, so a write to a file that
 * does not exist yet is allowed only when its directory is inside the root.
 * A dangling symlink on the path fails the check: writing through it would
 * create or rewrite the link's target outside the project. Guards removals
 * against symlinked parents (e.g. a shared `.claude/` checkout) deleting or
 * rewriting files outside the project.
 */
export declare function isPathInsideProjectRoot(root: string, target: string): boolean;
