import { createRng, intBetween } from "../engine/rng";

/** About one picture in every three or four plain questions. Never the first, never two in a row. */
export function pictureMask(length: number, seed: number): boolean[] {
  const flags = Array.from({ length }, () => false);
  if (length < 2) {
    return flags;
  }
  const rng = createRng(seed * 17 + 3);
  const every = rng() < 0.5 ? 3 : 4;
  const target = Math.min(length - 1, Math.max(1, Math.round(length / every)));
  const open: number[] = [];
  for (let index = 1; index < length; index += 1) {
    open.push(index);
  }
  for (let index = open.length - 1; index > 0; index -= 1) {
    const swap = intBetween(rng, 0, index);
    const held = open[index];
    open[index] = open[swap];
    open[swap] = held;
  }
  let placed = 0;
  for (const index of open) {
    if (placed >= target) {
      break;
    }
    if (flags[index - 1] || flags[index + 1]) {
      continue;
    }
    flags[index] = true;
    placed += 1;
  }
  if (placed === 0) {
    flags[1] = true;
  }
  flags[0] = false;
  return flags;
}
