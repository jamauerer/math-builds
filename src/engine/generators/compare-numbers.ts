import { requireNumber, type Generator } from "../types";
import { difficultyCeiling, intBetween } from "../rng";

export const generateCompareNumbers: Generator = (rng, difficulty, params) => {
  const digits = requireNumber(params, "digits");
  const min = 10 ** (digits - 1);
  const max = difficultyCeiling(difficulty, min, 10 ** digits - 1);
  let left = intBetween(rng, min, max);
  let right = intBetween(rng, min, max);
  for (let attempt = 0; attempt < 20 && left === right; attempt += 1) {
    right = intBetween(rng, min, max);
  }
  if (left === right) {
    right = left === min ? left + 1 : left - 1;
  }
  const choices = [String(left), String(right)];
  if (rng() < 0.5) {
    choices.reverse();
  }
  return {
    prompt: "Which number is greater?",
    answer: String(Math.max(left, right)),
    choices,
    visual: { kind: "compare", left, right },
  };
};
