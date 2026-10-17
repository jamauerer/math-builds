export type Rng = () => number;

/** Deterministic generator in [0, 1). Same seed always yields the same stream. */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  if (state === 0) {
    state = 1;
  }
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function intBetween(rng: Rng, min: number, max: number): number {
  if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
    throw new Error(`Invalid integer range ${min}..${max}`);
  }
  return min + Math.floor(rng() * (max - min + 1));
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  if (items.length === 0) {
    throw new Error("Cannot pick from an empty list");
  }
  return items[intBetween(rng, 0, items.length - 1)];
}

export function clampDifficulty(difficulty: number): number {
  if (!Number.isFinite(difficulty)) {
    return 3;
  }
  return Math.min(5, Math.max(1, Math.round(difficulty)));
}

/** Highest allowed value in [floor, ceil], growing as difficulty goes from 1 to 5. */
export function difficultyCeiling(
  difficulty: number,
  floor: number,
  ceil: number,
): number {
  if (ceil <= floor) {
    return floor;
  }
  const scaled =
    floor + Math.round(((ceil - floor) * clampDifficulty(difficulty)) / 5);
  return Math.min(ceil, Math.max(floor, scaled));
}
