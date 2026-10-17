import { optionalNumber, requireNumber, requireString, type Generator } from "../types";
import { intBetween } from "../rng";

function fromDigits(digits: number[]): number {
  return Number(digits.join(""));
}

export const generateAddition: Generator = (rng, level, params) => {
  if (level < 1 || level > 5) {
    throw new Error(`Level ${level} is outside 1 to 5`);
  }
  const digits = requireNumber(params, "digits");
  const regroup = requireString(params, "regroup");
  if (regroup !== "none") {
    throw new Error(`Unsupported regroup mode ${regroup}`);
  }
  if (digits < 2 || digits > 3) {
    throw new Error(`Unsupported addition width ${digits}`);
  }
  const maxAddend = optionalNumber(params, "maxAddend") ?? 10 ** digits - 1;
  const floor = 10 ** (digits - 1);
  const cap = Math.min(10 ** digits - 1, maxAddend);
  let left = 0;
  let right = 0;
  let built = false;
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const candidate = intBetween(rng, floor, cap);
    const leftDigits = String(candidate).padStart(digits, "0").split("").map(Number);
    const rightDigits: number[] = [];
    let ok = true;
    for (let column = 0; column < digits; column += 1) {
      const minDigit = column === 0 ? 1 : 0;
      const maxDigit = 9 - leftDigits[column];
      if (maxDigit < minDigit) {
        ok = false;
        break;
      }
      rightDigits.push(intBetween(rng, minDigit, maxDigit));
    }
    if (!ok) {
      continue;
    }
    const other = fromDigits(rightDigits);
    if (other >= floor && other <= cap) {
      left = candidate;
      right = other;
      built = true;
      break;
    }
  }
  if (!built) {
    throw new Error("Could not build an addition within the level cap");
  }
  return {
    prompt: "Add.",
    answer: String(left + right),
    visual: { kind: "stacked", layout: "vertical", operator: "+", top: left, bottom: right },
  };
};
