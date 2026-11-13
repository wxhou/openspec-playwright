import { lstatSync, realpathSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";

/**
 * True when `target` resolves inside `root` after symlinks. Missing tails are
 * resolved through their nearest existing ancestor, so a write to a file that
 * does not exist yet is allowed only when its directory is inside the root.
 * A dangling symlink on the path fails the check: writing through it would
 * create or rewrite the link's target outside the project. Guards removals
 * against symlinked parents (e.g. a shared `.claude/` checkout) deleting or
 * rewriting files outside the project.
 */
export function isPathInsideProjectRoot(root: string, target: string): boolean {
  try {
    const realRoot = realpathSync(root);
    const prefix = realRoot.endsWith(sep) ? realRoot : realRoot + sep;
    let probe = resolve(target);
    while (true) {
      try {
        // lstat (not existsSync) so a dangling symlink counts as present and
        // reaches realpath below instead of being skipped as "missing".
        lstatSync(probe);
      } catch {
        const parent = dirname(probe);
        if (parent === probe) return false;
        probe = parent;
        continue;
      }
      try {
        const real = realpathSync(probe);
        return real === realRoot || real.startsWith(prefix);
      } catch {
        // Dangling symlink — resolving it would write outside the project.
        return false;
      }
    }
  } catch {
    return false;
  }
}
