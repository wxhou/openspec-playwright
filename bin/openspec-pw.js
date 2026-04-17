#!/usr/bin/env node
import { fileURLToPath } from "url";
import { dirname, join } from "path";
const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(__dirname, "..");
const origCwd = process.cwd();
process.env.OPENSPE_PW_CWD = origCwd;
process.chdir(pkgRoot);
const cleanup = () => process.chdir(origCwd);
process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
process.on("exit", cleanup);
await import("../dist/index.js");