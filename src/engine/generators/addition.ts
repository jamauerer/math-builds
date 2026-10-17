import { requireNumber, requireString, type Generator } from "../types";
import { difficultyCeiling, intBetween } from "../rng";

function fromDigits(digits: number[]): number {
  return Number(digits.join(""));
}

export const generateAddition: Generator = (rng, difficulty, params) => {
  const digits = requireNumber(params, "digits");
  const regroup = requireString(params, "regroup");
  if (regroup !== "none") {
    throw new Error(`Unsupported regroup mode ${regroup}`);
  }
  if (digits < 2 || digits > 3) {
    throw new Error(`Unsupported addition width ${digits}`);
  }
  const leftDigits: number[] = [];
  const rightDigits: number[] = [];
  for (let column = 0; column < digits; column += 1) {
    const leftMax = column === 0 ? difficultyCeiling(difficulty, 1, 8) : 9;
    const leftMin = column === 0 ? 1 : 0;
    const left = intBetween(rng, leftMin, leftMax);
    const rightMin = column === 0 ? 1 : 0;
    const rightMax = Math.max(rightMin, 9 - left);
    const right = intBetween(rng, rightMin, Math.min(9 - left, rightMax));
    leftDigits.push(left);
    rightDigits.push(right);
  }
  const left = fromDigits(leftDigits);
  const right = fromDigits(rightDigits);
  return {
    prompt: `What is ${left} + ${right}?`,
    answer: String(left + right),
    visual: { kind: "expression", left, operator: "+", right },
  };
};
