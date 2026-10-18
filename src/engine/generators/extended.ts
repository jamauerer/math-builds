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

export const generateDecimalTenth: Generator = (rng, _level, params) => {
  const whole = intBetween(rng, 1, num(params, "max")) * 10;
  return {
    prompt: `What is 1/10 of ${whole}?`,
    answer: String(whole / 10),
    visual: { kind: "fraction", whole, numerator: 1, denominator: 10 },
  };
};

export const generateHalfOf: Generator = (rng, _level, params) => {
  const whole = intBetween(rng, 1, num(params, "max")) * 2;
  return {
    prompt: `What is 1/2 of ${whole}?`,
    answer: String(whole / 2),
    visual: { kind: "fraction", whole, numerator: 1, denominator: 2 },
  };
};

export const generateCentimeters: Generator = (rng, _level, params) => {
  const meters = intBetween(rng, 1, num(params, "max"));
  return {
    prompt: `How many centimeters are in ${meters} meters?`,
    answer: String(meters * 100),
    visual: { kind: "expression", left: meters, operator: "x", right: 100 },
  };
};

export const generateHalfLength: Generator = (rng, _level, params) => {
  const length = intBetween(rng, 2, num(params, "max")) * 2;
  return {
    prompt: `A length is ${length} units. What is half of it?`,
    answer: String(length / 2),
    visual: { kind: "expression", left: length, operator: "/", right: 2 },
  };
};

export const generateTriangleAngle: Generator = (rng, _level, params) => {
  const max = Math.max(1, num(params, "max"));
  const first = intBetween(rng, 1, max);
  const second = intBetween(rng, 1, max);
  return {
    prompt: `A triangle has angles of ${first} and ${second} degrees. What is the third angle?`,
    answer: String(180 - first - second),
    visual: { kind: "expression", left: 180, operator: "-", right: first + second },
  };
};

export const generateTrussTriangles: Generator = (rng, _level, params) => {
  const diagonals = intBetween(rng, 1, num(params, "max"));
  return {
    prompt: `Each diagonal splits one panel into 2 triangles. How many triangles do ${diagonals} diagonals make?`,
    answer: String(diagonals * 2),
    visual: { kind: "expression", left: diagonals, operator: "x", right: 2 },
  };
};

export const generateAlternatingSign: Generator = (rng, _level, params) => {
  const meshes = intBetween(rng, 1, num(params, "max"));
  const same = meshes % 2 === 0 ? 1 : 0;
  return {
    prompt: `Direction flips at each mesh. After ${meshes} meshes, type 1 if the output matches the start and 0 if it does not.`,
    answer: String(same),
    visual: { kind: "expression", left: same, operator: "-", right: 0 },
  };
};

export const generateTimesAsMany: Generator = (rng, _level, params) => {
  const group = intBetween(rng, 2, num(params, "max"));
  const times = intBetween(rng, 2, 5);
  return {
    prompt: `One share is ${group}. How many is ${times} shares?`,
    answer: String(group * times),
    visual: { kind: "expression", left: group, operator: "x", right: times },
  };
};

export const generateOneStepEquation: Generator = (rng, _level, params) => {
  const factor = intBetween(rng, 2, 9);
  const value = intBetween(rng, 2, num(params, "max"));
  return {
    prompt: `${factor} times a number is ${factor * value}. What is the number?`,
    answer: String(value),
    visual: { kind: "expression", left: factor * value, operator: "/", right: factor },
  };
};

export const generateOneStepDifference: Generator = (rng, _level, params) => {
  const span = Math.max(2, num(params, "max"));
  const start = span + intBetween(rng, 1, span);
  const taken = intBetween(rng, 1, start - 1);
  return {
    prompt: `A quantity starts at ${start} and ${taken} is removed. What is left?`,
    answer: String(start - taken),
    visual: { kind: "expression", left: start, operator: "-", right: taken },
  };
};

export const generateQuadraticValue: Generator = (rng, _level, params) => {
  const x = intBetween(rng, 1, num(params, "max"));
  return {
    prompt: `A curve follows y = x times x. What is y when x is ${x}?`,
    answer: String(x * x),
    visual: { kind: "expression", left: x, operator: "x", right: x },
  };
};

export const generateDoubleRun: Generator = (rng, _level, params) => {
  const x = intBetween(rng, 1, num(params, "max"));
  return {
    prompt: `A line doubles its run. The run is ${x}. What is twice that run?`,
    answer: String(x * 2),
    visual: { kind: "expression", left: x, operator: "x", right: 2 },
  };
};

export const generateRangeOfThree: Generator = (rng, _level, params) => {
  const max = num(params, "max");
  const values = [intBetween(rng, 1, max), intBetween(rng, 1, max), intBetween(rng, 1, max)];
  const high = Math.max(...values);
  const low = Math.min(...values);
  return {
    prompt: `The numbers are ${values.join(", ")}. What is the range, highest minus lowest?`,
    answer: String(high - low),
    visual: { kind: "expression", left: high, operator: "-", right: low },
  };
};

export const generateLargerNumber: Generator = (rng, _level, params) => {
  const max = num(params, "max");
  const left = intBetween(rng, 1, max);
  let right = intBetween(rng, 1, max);
  if (right === left) {
    right = left + 1;
  }
  return {
    prompt: `Which is larger, ${left} or ${right}?`,
    answer: String(Math.max(left, right)),
    visual: { kind: "compare", left, right },
    choices: [String(left), String(right)],
  };
};

export const generateScaledHypotenuse: Generator = (rng, _level, params) => {
  const scale = intBetween(rng, 2, num(params, "max"));
  return {
    prompt: `A 3-4-5 triangle is scaled by ${scale}. How long is the hypotenuse?`,
    answer: String(5 * scale),
    visual: { kind: "expression", left: 5, operator: "x", right: scale },
  };
};

export const generateLegDifference: Generator = (rng, _level, params) => {
  const long = intBetween(rng, 5, num(params, "max"));
  const short = intBetween(rng, 1, long - 1);
  return {
    prompt: `One leg is ${long} and the other is ${short}. How much longer is the first?`,
    answer: String(long - short),
    visual: { kind: "expression", left: long, operator: "-", right: short },
  };
};

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
