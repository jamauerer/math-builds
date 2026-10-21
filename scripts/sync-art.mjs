import { copyFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FROM = join(ROOT, "docs", "art");
const TO = join(ROOT, "public", "art");
const SKIP = new Set([".md", ".txt"]);

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === "reference") {
        continue;
      }
      walk(full, files);
      continue;
    }
    const lower = name.toLowerCase();
    if (SKIP.has(lower.slice(lower.lastIndexOf(".")))) {
      continue;
    }
    if (/\.[a-z0-9]+\.[a-z0-9]+$/i.test(name)) {
      continue;
    }
    files.push(full);
  }
  return files;
}

export function syncArt() {
  const files = walk(FROM);
  for (const file of files) {
    const dest = join(TO, relative(FROM, file));
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(file, dest);
  }
  return files.length;
}

const invoked = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (import.meta.url === invoked) {
  console.log(`copied ${syncArt()} art files to public/art`);
}
