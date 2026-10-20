import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const DOCS = "docs/art";
const PUBLIC = "public/art";

function walk(dir: string, files: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      walk(full, files);
      continue;
    }
    files.push(full);
  }
  return files;
}

describe("art folders", () => {
  it("keeps every public/art file identical to its docs/art source", () => {
    const published = walk(PUBLIC);
    expect(published.length).toBeGreaterThan(10);
    for (const file of published) {
      const rel = relative(PUBLIC, file).replace(/\\/g, "/");
      const source = join(DOCS, rel);
      const got = readFileSync(file);
      const want = readFileSync(source);
      expect(got.equals(want), rel).toBe(true);
    }
  });
});
