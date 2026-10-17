import {
  formatNumber,
  PLACE_FACTOR,
  requireNumber,
  requireStringList,
  type Generator,
  type PlaceName,
} from "../types";
import { difficultyCeiling, intBetween, pick } from "../rng";

const PLACES = new Set<PlaceName>(["ones", "tens", "hundreds", "thousands"]);

function asPlace(value: string): PlaceName {
  if (!PLACES.has(value as PlaceName)) {
    throw new Error(`Unknown place ${value}`);
  }
  return value as PlaceName;
}

function digitInPlace(number: number, place: PlaceName): number {
  return Math.floor(number / PLACE_FACTOR[place]) % 10;
}

export const generatePlaceValue: Generator = (rng, difficulty, params) => {
  const min = requireNumber(params, "min");
  const max = requireNumber(params, "max");
  const places = requireStringList(params, "places").map(asPlace);
  const hi = difficultyCeiling(difficulty, min, max);
  let number = intBetween(rng, min, hi);
  const place = pick(rng, places);
  for (let attempt = 0; attempt < 12 && digitInPlace(number, place) === 0; attempt += 1) {
    number = intBetween(rng, min, hi);
  }
  const value = digitInPlace(number, place) * PLACE_FACTOR[place];
  return {
    prompt: `In ${formatNumber(number)}, what is the value of the ${place} digit?`,
    answer: String(value),
    visual: { kind: "place-value", number, place },
  };
};
