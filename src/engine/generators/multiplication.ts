import { requireNumber, requireString, type Generator } from "../types";
import { difficultyCeiling, intBetween } from "../rng";

function factorRange(min: number, max: number, difficulty: number): [number, number] {
  const hi = difficultyCeiling(difficulty, min, max);
  return [min, hi];
}

export const generateMultiplication: Generator = (rng, difficulty, params) => {
  const mode = requireString(params, "mode");
  let left = 0;
  let right = 0;
  if (mode === "facts") {
    const [leftMin, leftMax] = factorRange(
      requireNumber(params, "leftMin"),
      requireNumber(params, "leftMax"),
      difficulty,
    );
    const [rightMin, rightMax] = factorRange(
      requireNumber(params, "rightMin"),
      requireNumber(params, "rightMax"),
      difficulty,
    );
    left = intBetween(rng, leftMin, leftMax);
    right = intBetween(rng, rightMin, rightMax);
  } else if (mode === "times-ten") {
    const [leftMin, leftMax] = factorRange(
      requireNumber(params, "leftMin"),
      requireNumber(params, "leftMax"),
      difficulty,
    );
    left = intBetween(rng, leftMin, leftMax);
    right = rng() < 0.5 ? 10 : 100;
  } else if (mode === "multi") {
    const leftDigits = requireNumber(params, "leftDigits");
    const rightDigits = requireNumber(params, "rightDigits");
    const leftMin = 10 ** (leftDigits - 1);
    const leftMax = difficultyCeiling(difficulty, leftMin, 10 ** leftDigits - 1);
    const rightFloor = rightDigits === 1 ? 2 : 10 ** (rightDigits - 1);
    const rightCeil = 10 ** rightDigits - 1;
    const rightMax = difficultyCeiling(difficulty, rightFloor, rightCeil);
    left = intBetween(rng, leftMin, leftMax);
    right = intBetween(rng, rightFloor, rightMax);
  } else {
    throw new Error(`Unsupported multiplication mode ${mode}`);
  }

  return {
    prompt: `What is ${left} times ${right}?`,
    answer: String(left * right),
    visual: { kind: "expression", left, operator: "x", right },
  };
};
