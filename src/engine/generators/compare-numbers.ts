import { optionalNumber, requireNumber, type Generator } from "../types";
import { intBetween } from "../rng";

export const generateCompareNumbers: Generator = (rng, level, params) => {
  if (level < 1 || level > 5) {
    throw new Error(`Level ${level} is outside 1 to 5`);
  }
  const digits = requireNumber(params, "digits");
  const min = 10 ** (digits - 1);
  const cap = optionalNumber(params, "max");
  const max = Math.min(10 ** digits - 1, cap ?? 10 ** digits - 1);
  let left = intBetween(rng, min, max);
  let right = intBetween(rng, min, max);
  for (let attempt = 0; attempt < 20 && left === right; attempt += 1) {
    right = intBetween(rng, min, max);
  }
  if (left === right) {
    right = left < max ? left + 1 : left - 1;
  }
  if (String(right).length !== digits) {
    right = left < max ? left + 1 : min;
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
