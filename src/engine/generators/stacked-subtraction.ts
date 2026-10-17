import { optionalNumber, requireNumber, requireString, type Generator } from "../types";
import { intBetween, type Rng } from "../rng";

export type BorrowPattern = "none" | "once" | "twice" | "across-zeros";

function fromDigits(digits: number[]): number {
  return Number(digits.join(""));
}

type BorrowInfo = { count: number; acrossZero: boolean };

/** Pencil-and-paper borrow count. Across-zero means a borrow landed on a 0. */
export function classifyBorrow(top: number, bottom: number, digits: number): BorrowInfo {
  const topDigits = String(top).padStart(digits, "0").split("").map(Number);
  const bottomDigits = String(bottom).padStart(digits, "0").split("").map(Number);
  let incoming = 0;
  let count = 0;
  let acrossZero = false;
  for (let index = topDigits.length - 1; index >= 0; index -= 1) {
    const available = topDigits[index] - incoming;
    if (available < bottomDigits[index]) {
      count += 1;
      if (available < 0) {
        acrossZero = true;
      }
      incoming = 1;
    } else {
      incoming = 0;
    }
  }
  return { count, acrossZero };
}

function matchesPattern(pattern: BorrowPattern, info: BorrowInfo): boolean {
  if (pattern === "none") {
    return info.count === 0 && !info.acrossZero;
  }
  if (pattern === "once") {
    return info.count === 1 && !info.acrossZero;
  }
  if (pattern === "twice") {
    return info.count === 2 && !info.acrossZero;
  }
  return info.acrossZero;
}

function leadingMax(topMax: number | undefined, digits: number): number {
  if (topMax == null) {
    return 9;
  }
  return Math.min(9, Math.floor(topMax / 10 ** (digits - 1)));
}

function pairNone(rng: Rng, digits: number, topMax?: number): { top: number; bottom: number } | null {
  const topDigits: number[] = [];
  const bottomDigits: number[] = [];
  const lead = leadingMax(topMax, digits);
  for (let column = 0; column < digits; column += 1) {
    const topDigit = column === 0 ? intBetween(rng, 1, Math.max(1, lead)) : intBetween(rng, 0, 9);
    const bottomMin = column === 0 ? 1 : 0;
    if (topDigit < bottomMin) {
      return null;
    }
    topDigits.push(topDigit);
    bottomDigits.push(intBetween(rng, bottomMin, topDigit));
  }
  const top = fromDigits(topDigits);
  const bottom = fromDigits(bottomDigits);
  if (top <= bottom || (topMax != null && top > topMax)) {
    return null;
  }
  return { top, bottom };
}

function pairOnce(rng: Rng, digits: number, topMax?: number): { top: number; bottom: number } | null {
  if (digits === 2) {
    const topTensMax = Math.max(2, leadingMax(topMax, 2));
    const topTens = intBetween(rng, 2, topTensMax);
    const bottomTens = intBetween(rng, 1, topTens - 1);
    const topOnes = intBetween(rng, 0, 8);
    const bottomOnes = intBetween(rng, topOnes + 1, 9);
    const top = topTens * 10 + topOnes;
    const bottom = bottomTens * 10 + bottomOnes;
    if (topMax != null && top > topMax) {
      return null;
    }
    return { top, bottom };
  }
  const lead = Math.max(2, leadingMax(topMax, digits));
  const topHundreds = intBetween(rng, 2, lead);
  const bottomHundreds = intBetween(rng, 1, topHundreds - 1);
  const topTens = intBetween(rng, 1, 9);
  const bottomTens = intBetween(rng, 0, topTens);
  const topOnes = intBetween(rng, 0, 8);
  const bottomOnes = intBetween(rng, topOnes + 1, 9);
  const top = topHundreds * 100 + topTens * 10 + topOnes;
  const bottom = bottomHundreds * 100 + bottomTens * 10 + bottomOnes;
  if (top <= bottom || (topMax != null && top > topMax)) {
    return null;
  }
  return { top, bottom };
}

function pairTwice(rng: Rng, topMax?: number): { top: number; bottom: number } {
  const topHundredsMax = Math.max(2, leadingMax(topMax, 3));
  const topHundreds = intBetween(rng, 2, topHundredsMax);
  const bottomHundreds = intBetween(rng, 1, topHundreds - 1);
  const topTens = intBetween(rng, 1, 9);
  const bottomTens = intBetween(rng, topTens, 9);
  const topOnes = intBetween(rng, 0, 8);
  const bottomOnes = intBetween(rng, topOnes + 1, 9);
  return {
    top: topHundreds * 100 + topTens * 10 + topOnes,
    bottom: bottomHundreds * 100 + bottomTens * 10 + bottomOnes,
  };
}

function pairAcrossZeros(rng: Rng, topMax?: number): { top: number; bottom: number } {
  const topHundredsMax = Math.max(2, leadingMax(topMax, 3));
  const topHundreds = intBetween(rng, 2, topHundredsMax);
  const bottomHundreds = intBetween(rng, 1, topHundreds - 1);
  const topOnes = intBetween(rng, 0, 8);
  const bottomOnes = intBetween(rng, topOnes + 1, 9);
  const bottomTens = intBetween(rng, 0, 9);
  return {
    top: topHundreds * 100 + topOnes,
    bottom: bottomHundreds * 100 + bottomTens * 10 + bottomOnes,
  };
}

function asPattern(value: string): BorrowPattern {
  if (
    value === "none" ||
    value === "once" ||
    value === "twice" ||
    value === "across-zeros"
  ) {
    return value;
  }
  throw new Error(`Unsupported borrow pattern ${value}`);
}

/**
 * Stacked subtraction. `params.borrow` forces the borrowing pattern:
 * "none", "once", "twice", or "across-zeros".
 */
export const generateStackedSubtraction: Generator = (rng, level, params) => {
  if (level < 1 || level > 5) {
    throw new Error(`Level ${level} is outside 1 to 5`);
  }
  const digits = requireNumber(params, "digits");
  const borrow = asPattern(requireString(params, "borrow"));
  const topMax = optionalNumber(params, "topMax");
  if (digits !== 2 && digits !== 3) {
    throw new Error(`Unsupported subtraction width ${digits}`);
  }
  if (borrow === "once" && digits !== 2 && digits !== 3) {
    throw new Error("Borrow once is generated for two-digit and three-digit numbers");
  }
  if ((borrow === "twice" || borrow === "across-zeros") && digits !== 3) {
    throw new Error(`${borrow} is only generated for three-digit numbers`);
  }

  let pair: { top: number; bottom: number } | null = null;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (borrow === "none") {
      pair = pairNone(rng, digits, topMax);
    } else if (borrow === "once") {
      pair = pairOnce(rng, digits, topMax);
    } else if (borrow === "twice") {
      pair = pairTwice(rng, topMax);
    } else {
      pair = pairAcrossZeros(rng, topMax);
    }
    if (
      pair &&
      (topMax == null || pair.top <= topMax) &&
      matchesPattern(borrow, classifyBorrow(pair.top, pair.bottom, digits))
    ) {
      break;
    }
    pair = null;
  }
  if (!pair) {
    throw new Error(`Could not build a ${borrow} subtraction`);
  }

  return {
    prompt: "Subtract.",
    answer: String(pair.top - pair.bottom),
    visual: {
      kind: "stacked",
      layout: "vertical",
      operator: "-",
      top: pair.top,
      bottom: pair.bottom,
    },
  };
};
