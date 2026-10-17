import { intBetween, type Rng } from "../rng";
import type { Generator, SkillParams } from "../types";

function num(params: SkillParams, key: string): number {
  const value = params[key];
  if (typeof value !== "number") {
    throw new Error(`Missing number param ${key}`);
  }
  return value;
}

export const generateMeasureGap: Generator = (rng: Rng, _level, params) => {
  const max = num(params, "max");
  const left = intBetween(rng, 0, Math.max(0, max - 5));
  const right = intBetween(rng, left + 1, max);
  return {
    prompt: `The right mark is ${right}. The left mark is ${left}. How many units is the gap?`,
    answer: String(right - left),
    visual: { kind: "expression", left: right, operator: "-", right: left },
  };
};

export const generateFractionOf: Generator = (rng, _level, params) => {
  const numerator = num(params, "numerator");
  const denominator = num(params, "denominator");
  const groups = intBetween(rng, 1, num(params, "groups"));
  const whole = groups * denominator;
  return {
    prompt: `What is ${numerator}/${denominator} of ${whole}?`,
    answer: String(groups * numerator),
    visual: { kind: "fraction", whole, numerator, denominator },
  };
};

export const generateRectangleArea: Generator = (rng, _level, params) => {
  const max = num(params, "max");
  const width = intBetween(rng, 2, max);
  const height = intBetween(rng, 2, max);
  return {
    prompt: `A rectangle is ${width} by ${height}. What is its area?`,
    answer: String(width * height),
    visual: { kind: "expression", left: width, operator: "x", right: height },
  };
};

export const generateRatioShare: Generator = (rng, _level, params) => {
  const a = num(params, "a");
  const b = num(params, "b");
  const times = intBetween(rng, 1, num(params, "times"));
  return {
    prompt: `The ratio is ${a} to ${b}. How many of the first share go with ${times * b} of the second?`,
    answer: String(times * a),
    visual: { kind: "ratio", a, b, times },
  };
};

export const generateMissingAddend: Generator = (rng, _level, params) => {
  const max = num(params, "max");
  const addend = intBetween(rng, 1, max - 1);
  const total = intBetween(rng, addend + 1, max);
  return {
    prompt: `n + ${addend} = ${total}. What is n?`,
    answer: String(total - addend),
    visual: { kind: "expression", left: total, operator: "-", right: addend },
  };
};

export const generateLineRise: Generator = (rng, _level, params) => {
  const rise = num(params, "rise");
  const x = intBetween(rng, 1, num(params, "xMax"));
  return {
    prompt: `A line rises ${rise} for each 1 across. How high is it at x = ${x}, starting from 0?`,
    answer: String(rise * x),
    visual: { kind: "expression", left: rise, operator: "x", right: x },
  };
};

export const generateMeanOfThree: Generator = (rng, _level, params) => {
  const max = num(params, "max");
  const first = intBetween(rng, 1, max);
  const second = intBetween(rng, 1, max);
  const third = intBetween(rng, 1, max);
  const sum = first + second + third;
  const bump = (3 - (sum % 3)) % 3;
  const values = [first, second, third + bump];
  const mean = (values[0] + values[1] + values[2]) / 3;
  return {
    prompt: `The numbers are ${values[0]}, ${values[1]}, and ${values[2]}. What is the mean?`,
    answer: String(mean),
    visual: { kind: "statistics", values },
  };
};

const TRIPLES: readonly [number, number, number][] = [
  [3, 4, 5],
  [5, 12, 13],
  [8, 15, 17],
  [7, 24, 25],
  [20, 21, 29],
];

export const generateHypotenuse: Generator = (rng, level) => {
  const triple = TRIPLES[Math.min(TRIPLES.length - 1, Math.max(0, level - 1))];
  const scale = intBetween(rng, 1, 1 + Math.min(3, level));
  const opposite = triple[0] * scale;
  const adjacent = triple[1] * scale;
  return {
    prompt: `A right triangle has opposite side ${opposite} and adjacent side ${adjacent}. How long is the hypotenuse?`,
    answer: String(triple[2] * scale),
    visual: { kind: "trig", opposite, adjacent },
  };
};
