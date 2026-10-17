import {
  formatNumber,
  PLACE_FACTOR,
  requireNumber,
  requireStringList,
  type Generator,
  type PlaceName,
} from "../types";
import { intBetween, pick } from "../rng";

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

export const generatePlaceValue: Generator = (rng, level, params) => {
  if (level < 1 || level > 5) {
    throw new Error(`Level ${level} is outside 1 to 5`);
  }
  const min = requireNumber(params, "min");
  const max = requireNumber(params, "max");
  const places = requireStringList(params, "places").map(asPlace);
  let number = intBetween(rng, min, max);
  const place = pick(rng, places);
  for (let attempt = 0; attempt < 12 && digitInPlace(number, place) === 0; attempt += 1) {
    number = intBetween(rng, min, max);
  }
  const value = digitInPlace(number, place) * PLACE_FACTOR[place];
  return {
    prompt: `In ${formatNumber(number)}, what is the value of the ${place} digit?`,
    answer: String(value),
    visual: { kind: "place-value", number, place },
  };
};
