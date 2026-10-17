import type { Generator } from "../types";
import { generateAddition } from "./addition";
import { generateCompareNumbers } from "./compare-numbers";
import {
  generateFractionOf,
  generateHypotenuse,
  generateLineRise,
  generateMeanOfThree,
  generateMeasureGap,
  generateMissingAddend,
  generateRatioShare,
  generateRectangleArea,
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
};

export { generateStackedSubtraction };
