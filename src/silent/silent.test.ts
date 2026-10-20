import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function walk(dir: string): string[] {
  const found: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      found.push(...walk(path));
    } else {
      found.push(path);
    }
  }
  return found;
}

describe("silent app", () => {
  it("fails if speech or audio is used anywhere in src", () => {
    const tokens = [["speech", "Synthesis"].join(""), ["Speech", "Synthesis"].join(""), ["new ", "Audio"].join(""), ["<", "audio"].join("")];
    const self = join("silent", "silent.test.ts");
    const hits: string[] = [];
    for (const file of walk(join(process.cwd(), "src"))) {
      if (file.replaceAll("\\", "/").endsWith(self.replaceAll("\\", "/"))) {
        continue;
      }
      const text = readFileSync(file, "utf8");
      for (const token of tokens) {
        if (text.includes(token)) {
          hits.push(`${file}: ${token}`);
        }
      }
    }
    expect(hits).toEqual([]);
  });
});
