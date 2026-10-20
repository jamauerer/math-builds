import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { sampleLearnerQuestions, sampleMarkdown } from "./sample";

const folder = resolve(fileURLToPath(new URL("../../docs/screens/2026-10-20-ladder", import.meta.url)));

describe("sampler", () => {
  it("prints 60 questions for grade 1 and grade 3", () => {
    mkdirSync(folder, { recursive: true });
    const grade1 = sampleLearnerQuestions(1, 3);
    const grade3 = sampleLearnerQuestions(3, 3);
    expect(grade1).toHaveLength(60);
    expect(grade3).toHaveLength(60);
    expect(grade1.every((line) => line.stepId && line.prompt)).toBe(true);
    expect(grade3.some((line) => line.stepId.startsWith("M") || line.stepId.startsWith("D") || line.stepId.startsWith("A") || line.stepId.startsWith("S"))).toBe(true);
    writeFileSync(resolve(folder, "sample-grade-1.md"), sampleMarkdown(1, grade1));
    writeFileSync(resolve(folder, "sample-grade-3.md"), sampleMarkdown(3, grade3));
  });
});
