import { formatNumber, requireNumber, requireString, type Generator } from "../types";
import { intBetween } from "../rng";

export const generateRoundNumber: Generator = (rng, level, params) => {
  if (level < 1 || level > 5) {
    throw new Error(`Level ${level} is outside 1 to 5`);
  }
  const place = requireString(params, "place");
  if (place !== "ten" && place !== "hundred") {
    throw new Error(`Unsupported round place ${place}`);
  }
  const unit = place === "ten" ? 10 : 100;
  const min = requireNumber(params, "min");
  const max = requireNumber(params, "max");
  let number = intBetween(rng, min, max);
  if (number % unit === 0) {
    if (number + 1 <= max) {
      number += 1;
    } else if (number - 1 >= min) {
      number -= 1;
    }
  }
  const rounded = Math.round(number / unit) * unit;
  const placeWord = place === "ten" ? "ten" : "hundred";
  return {
    prompt: `Round ${formatNumber(number)} to the nearest ${placeWord}.`,
    answer: String(rounded),
    visual: { kind: "round", number, place },
  };
};
