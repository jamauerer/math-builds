import { generators } from "./generators";
import { levelParams, type Problem, type Skill } from "./types";
import type { Rng } from "./rng";

export function generateProblem(skill: Skill, rng: Rng, level: number): Problem {
  const generator = generators[skill.generator];
  if (!generator) {
    throw new Error(`Unknown generator ${skill.generator}`);
  }
  const problem = generator(rng, level, levelParams(skill, level));
  if (!problem.prompt || problem.answer.length === 0) {
    throw new Error(`Generator ${skill.generator} returned an empty problem`);
  }
  if (problem.prompt.includes("\u2014") || problem.answer.includes("\u2014")) {
    throw new Error(`Generator ${skill.generator} used an em dash`);
  }
  return problem;
}
