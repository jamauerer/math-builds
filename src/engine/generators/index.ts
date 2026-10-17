import type { Generator } from "../types";
import { generateAddition } from "./addition";
import { generateCompareNumbers } from "./compare-numbers";
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
};

export { generateStackedSubtraction };
