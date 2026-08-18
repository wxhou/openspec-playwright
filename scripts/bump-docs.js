import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const version = pkg.version;

let html = readFileSync(resolve(root, "docs/index.html"), "utf8");
html = html.replace(
  /<div class="hero-card-badge">[\s\S]*?<\/div>/,
  `<div class="hero-card-badge">v${version}</div>`,
);
writeFileSync(resolve(root, "docs/index.html"), html);

console.log(`docs/index.html updated to v${version}`);

// Archive the CHANGELOG [Unreleased] section under this version, so the
// release flow can never ship with un-archived entries again (0.3.64 did).
// Runs after `npm version patch` in the release script, so pkg.version is
// already the new version. No-op when there is no [Unreleased] heading.
const changelogPath = resolve(root, "CHANGELOG.md");
let changelog = readFileSync(changelogPath, "utf8");
const today = new Date().toISOString().slice(0, 10);
const archived = changelog.replace(
  /^## \[Unreleased\]\s*$/m,
  `## [${version}] - ${today}`,
);
if (archived !== changelog) {
  writeFileSync(changelogPath, archived);
  console.log(`CHANGELOG.md archived under ${version}`);
}
