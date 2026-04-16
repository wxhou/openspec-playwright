#!/usr/bin/env node
import { fileURLToPath } from "url";
import { dirname } from "path";
const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(__dirname);
import("../dist/index.js");