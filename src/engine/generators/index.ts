import type { Generator } from "../types";
import { generateAddition } from "./addition";
import { generateCompareNumbers } from "./compare-numbers";
import {
  generateAlternatingSign,
  generateCentimeters,
  generateDecimalTenth,
  generateDoubleRun,
  generateFractionOf,
  generateHalfLength,
  generateHalfOf,
  generateHypotenuse,
  generateLargerNumber,
  generateLegDifference,
  generateLineRise,
  generateMeanOfThree,
  generateMeasureGap,
  generateMissingAddend,
  generateOneStepDifference,
  generateOneStepEquation,
  generateQuadraticValue,
  generateRangeOfThree,
  generateRatioShare,
  generateRectangleArea,
  generateScaledHypotenuse,
  generateTimesAsMany,
  generateTriangleAngle,
  generateTrussTriangles,
} from "./extended";
import { generateMultiplication } from "./multiplication";
import { generatePlaceValue } from "./place-value";
import { generateRoundNumber } from "./round-number";
import { generateStackedSubtraction } from "./stacked-subtraction";

export const generators: Record<string, Generator> = {
  addition: generateAddition,
  "compare-numbers": generateCompareNumbers,
  multiplication: generateMultiplication,
  "place-value": generatePlaceValue,
  "round-number": generateRoundNumber,
  "stacked-subtraction": generateStackedSubtraction,
  "measure-gap": generateMeasureGap,
  "fraction-of": generateFractionOf,
  "rectangle-area": generateRectangleArea,
  "ratio-share": generateRatioShare,
  "missing-addend": generateMissingAddend,
  "line-rise": generateLineRise,
  "mean-of-three": generateMeanOfThree,
  hypotenuse: generateHypotenuse,
  "decimal-tenth": generateDecimalTenth,
  "half-of": generateHalfOf,
  centimeters: generateCentimeters,
  "half-length": generateHalfLength,
  "triangle-angle": generateTriangleAngle,
  "truss-triangles": generateTrussTriangles,
  "alternating-sign": generateAlternatingSign,
  "times-as-many": generateTimesAsMany,
  "one-step-equation": generateOneStepEquation,
  "one-step-difference": generateOneStepDifference,
  "quadratic-value": generateQuadraticValue,
  "double-run": generateDoubleRun,
  "range-of-three": generateRangeOfThree,
  "larger-number": generateLargerNumber,
  "scaled-hypotenuse": generateScaledHypotenuse,
  "leg-difference": generateLegDifference,
};

export { generateStackedSubtraction };
