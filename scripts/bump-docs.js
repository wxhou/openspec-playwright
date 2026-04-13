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
