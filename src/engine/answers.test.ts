import { describe, expect, it } from "vitest";
import { skills } from "../data/load-skills";
import { answersMatch, responseConflicts } from "./answers";
import { generateProblem } from "./generate";
import { createRng } from "./rng";

const FORMATS = [
  (answer: string) => answer,
  (answer: string) => ` ${answer} `,
  (answer: string) => `0${answer}`,
  (answer: string) => answer.replace(/\B(?=(\d{3})+(?!\d))/g, ","),
  (answer: string) => answer.replace(/\B(?=(\d{3})+(?!\d))/g, " "),
];

describe("answer forms", () => {
  const seen = new Set<string>();
  for (const skill of skills) {
    if (seen.has(skill.generator)) {
      continue;
    }
    seen.add(skill.generator);
    it(`accepts equivalent forms for ${skill.generator}`, () => {
      for (let level = 1; level <= 5; level += 1) {
        const problem = generateProblem(skill, createRng(level * 50 + 7), level);
        for (const format of FORMATS) {
          expect(answersMatch(format(problem.answer), problem.answer)).toBe(true);
        }
        expect(answersMatch("99999999", problem.answer)).toBe(false);
      }
    });
  }

  it("flags a wrong verdict that still matches the answer", () => {
    expect(responseConflicts("wrong", "1,000", "1000")).toBe(true);
    expect(responseConflicts("right", "1,000", "1000")).toBe(false);
    expect(responseConflicts("skip", "1000", "1000")).toBe(false);
    expect(responseConflicts("wrong", "4", "5")).toBe(false);
  });
});
