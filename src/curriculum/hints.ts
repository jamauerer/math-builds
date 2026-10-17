export type HintRung = [string, string, string];

/** 1 nudge, 2 the method, 3 a worked example with different numbers. */
export function hintFor(hints: HintRung, misses: number): string | null {
  if (misses <= 0) {
    return null;
  }
  return hints[Math.min(2, misses - 1)];
}
