import { requireNumber, requireString, type Generator } from "../types";
import { intBetween } from "../rng";

export const generateMultiplication: Generator = (rng, level, params) => {
  if (level < 1 || level > 5) {
    throw new Error(`Level ${level} is outside 1 to 5`);
  }
  const mode = requireString(params, "mode");
  let left = 0;
  let right = 0;
  if (mode === "facts" || mode === "times-ten" || mode === "multi") {
    const leftMin = requireNumber(params, "leftMin");
    const leftMax = requireNumber(params, "leftMax");
    const rightMin = requireNumber(params, "rightMin");
    const rightMax = requireNumber(params, "rightMax");
    left = intBetween(rng, leftMin, leftMax);
    right = intBetween(rng, rightMin, rightMax);
  } else {
    throw new Error(`Unsupported multiplication mode ${mode}`);
  }

  return {
    prompt: `What is ${left} times ${right}?`,
    answer: String(left * right),
    visual: { kind: "expression", left, operator: "x", right },
  };
};
