export const PLACEMENT_STRANDS = [
  "measuring",
  "adding",
  "multiplying",
  "dividing",
  "fractions",
  "ratios",
  "geometry",
  "algebra",
] as const;

export type PlacementStrand = (typeof PLACEMENT_STRANDS)[number];

export const KIT_STRANDS = [...PLACEMENT_STRANDS, "counting"] as const;

export type KitStrand = (typeof KIT_STRANDS)[number];

export type GradeChoice = number | "unsure";

export type AdaptiveQuestion = {
  strandId: string;
  level: number;
  correct: boolean;
};

const MIN_QUESTIONS = 9;
const MAX_QUESTIONS = 12;
const MIN_LEVEL = 1;
const MAX_LEVEL = 13;

/** Kindergarten is 0. Grade 12 starts at the top rung. "Not sure" starts in the middle. */
export function gradeStartLevel(grade: GradeChoice): number {
  if (grade === "unsure") {
    return 5;
  }
  return Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, grade + 1));
}

/**
 * One shared staircase, 9 to 12 questions, rotating through the strands.
 * A right answer steps up, a wrong answer steps down.
 * Two reversals after the ninth question settle the test. Twelve is the cap.
 * The settled level is the highest level answered correctly, stored on every strand.
 */
export type AdaptiveRun = {
  level: number;
  direction: number;
  reversals: number;
  strandIndex: number;
  correctAt: number[];
  asked: number;
  done: boolean;
  strands: readonly string[];
};

export function beginAdaptive(startLevel: number, strands: readonly string[] = PLACEMENT_STRANDS): AdaptiveRun {
  return {
    level: Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, startLevel)),
    direction: 0,
    reversals: 0,
    strandIndex: 0,
    correctAt: [],
    asked: 0,
    done: false,
    strands,
  };
}

export function adaptiveAsk(run: AdaptiveRun): { strandId: string; level: number; number: number } {
  const strandId = run.strands[run.strandIndex % run.strands.length] ?? "measuring";
  return { strandId, level: run.level, number: run.asked + 1 };
}

const ARITHMETIC = ["adding", "multiplying", "dividing"] as const;

/**
 * No strand sits more than one level above the lowest arithmetic strand.
 * A strand the placement never asked is the overall placed level, not a default of 1.
 */
export function fitLevels(levels: Record<string, number>): Record<string, number> {
  const known = Object.values(levels).filter((level) => Number.isFinite(level));
  const placed = known.length > 0 ? Math.max(...known) : MIN_LEVEL;
  const next: Record<string, number> = {};
  for (const id of KIT_STRANDS) {
    const level = levels[id];
    next[id] = typeof level === "number" && level >= MIN_LEVEL ? Math.min(MAX_LEVEL, Math.round(level)) : placed;
  }
  const floor = Math.min(...ARITHMETIC.map((id) => next[id]));
  const ceiling = floor + 1;
  for (const id of KIT_STRANDS) {
    next[id] = Math.min(next[id], ceiling);
  }
  return next;
}

export function settledLevels(correctAt: readonly number[]): Record<string, number> {
  const assessed = correctAt.length > 0 ? Math.max(...correctAt) : MIN_LEVEL;
  const levels: Record<string, number> = {};
  for (const id of KIT_STRANDS) {
    levels[id] = assessed;
  }
  return fitLevels(levels);
}

export function adaptiveAnswer(run: AdaptiveRun, correct: boolean): { run: AdaptiveRun; levels: Record<string, number> | null } {
  if (run.done) {
    return { run, levels: settledLevels(run.correctAt) };
  }
  const asked = run.level;
  const correctAt = correct ? [...run.correctAt, asked] : run.correctAt.slice();
  const next = correct ? Math.min(MAX_LEVEL, asked + 1) : Math.max(MIN_LEVEL, asked - 1);
  const dir = next > asked ? 1 : next < asked ? -1 : 0;
  const reversals = run.direction !== 0 && dir !== 0 && dir !== run.direction ? run.reversals + 1 : run.reversals;
  const askedCount = run.asked + 1;
  const done = (askedCount >= MIN_QUESTIONS && reversals >= 2) || askedCount >= MAX_QUESTIONS;
  const nextRun: AdaptiveRun = {
    ...run,
    level: next,
    direction: dir !== 0 ? dir : run.direction,
    reversals,
    strandIndex: run.strandIndex + 1,
    correctAt,
    asked: askedCount,
    done,
  };
  return { run: nextRun, levels: done ? settledLevels(correctAt) : null };
}

export function runAdaptive(options: {
  startLevel: number;
  correct: (level: number, strandId: string) => boolean;
  strands?: readonly string[];
}): { levels: Record<string, number>; questions: AdaptiveQuestion[] } {
  let run = beginAdaptive(options.startLevel, options.strands ?? PLACEMENT_STRANDS);
  const questions: AdaptiveQuestion[] = [];
  let levels = settledLevels([]);
  while (!run.done && questions.length < MAX_QUESTIONS) {
    const ask = adaptiveAsk(run);
    const ok = options.correct(ask.level, ask.strandId);
    questions.push({ strandId: ask.strandId, level: ask.level, correct: ok });
    const stepped = adaptiveAnswer(run, ok);
    run = stepped.run;
    if (stepped.levels) {
      levels = stepped.levels;
    }
  }
  return { levels, questions };
}

export function strandName(id: string): string {
  const names: Record<string, string> = {
    measuring: "Measuring",
    adding: "Adding",
    multiplying: "Multiplying",
    dividing: "Dividing",
    fractions: "Fractions",
    ratios: "Ratios",
    geometry: "Geometry",
    algebra: "Algebra",
    counting: "Counting",
  };
  return names[id] ?? id;
}
