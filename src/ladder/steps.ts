export type LadderOp = "A" | "S" | "M" | "D";

export type LadderForm = "across" | "stacked" | "long-division";

export type LadderStep = {
  id: string;
  op: LadderOp;
  n: number;
  skillId: string;
  name: string;
  range: string;
  form: LadderForm;
  dots: boolean;
  timeTarget: number;
  level: number;
};

const STACKED_TIME = 20;
const LONG_TIME = 45;

function add(n: number, skillId: string, name: string, range: string, form: LadderForm, dots: boolean, timeTarget: number, level: number): LadderStep {
  return { id: `A${n}`, op: "A", n, skillId, name, range, form, dots, timeTarget, level };
}

function sub(n: number, skillId: string, name: string, range: string, form: LadderForm, dots: boolean, timeTarget: number, level: number): LadderStep {
  return { id: `S${n}`, op: "S", n, skillId, name, range, form, dots, timeTarget, level };
}

function mul(n: number, skillId: string, name: string, range: string, form: LadderForm, dots: boolean, timeTarget: number, level: number): LadderStep {
  return { id: `M${n}`, op: "M", n, skillId, name, range, form, dots, timeTarget, level };
}

function div(n: number, skillId: string, name: string, range: string, form: LadderForm, dots: boolean, timeTarget: number, level: number): LadderStep {
  return { id: `D${n}`, op: "D", n, skillId, name, range, form, dots, timeTarget, level };
}

export const LADDER_STEPS: LadderStep[] = [
  add(1, "adding.1.a1", "Add within 5", "both 0 to 5, sum ≤ 5", "across", true, 3, 1),
  add(2, "adding.1.a2", "Add within 10", "both 0 to 9, sum ≤ 10", "across", true, 3, 1),
  add(3, "adding.1.a3", "Add 1, add 2", "0 to 18 plus 1 or 2", "across", false, 3, 1),
  add(4, "adding.1.a4", "Make 10", "pairs that sum to 10", "across", false, 3, 1),
  add(5, "adding.2.a5", "Add within 20, no crossing 10", "one-digit + one-digit, sum ≤ 10, or teen + one-digit, ones sum ≤ 9", "across", false, 3, 2),
  add(6, "adding.2.a6", "Add within 20, crossing 10", "one-digit + one-digit, sum 11 to 18", "across", false, 3, 2),
  add(7, "adding.2.a7", "Doubles and near doubles", "n + n and n + (n+1), n 1 to 9", "across", false, 3, 2),
  add(8, "adding.2.a8", "Add tens", "tens + tens, sum ≤ 90", "across", false, 5, 2),
  add(9, "adding.2.a9", "Two-digit + one-digit, no carry", "ones sum ≤ 9", "across", false, 5, 2),
  add(10, "adding.2.a10", "Two-digit + one-digit, carry", "ones sum ≥ 10, total ≤ 99", "across", false, 5, 2),
  add(11, "adding.2.a11", "Two-digit + two-digit, no carry", "ones sum ≤ 9, total ≤ 99", "stacked", false, STACKED_TIME, 2),
  add(12, "adding.2.a12", "Two-digit + two-digit, carry", "ones sum ≥ 10, total ≤ 99", "stacked", false, STACKED_TIME, 2),
  add(13, "adding.2.a13", "Two-digit + two-digit, over 100", "total 100 to 198", "stacked", false, STACKED_TIME, 2),
  add(14, "adding.3.a14", "Three numbers", "three one-digit numbers", "across", false, 5, 3),
  add(15, "adding.3.a15", "Three-digit + three-digit, no carry", "each column ≤ 9", "stacked", false, STACKED_TIME, 3),
  add(16, "adding.3.a16", "Three-digit + three-digit, carry", "one or two carries, total ≤ 999", "stacked", false, STACKED_TIME, 3),
  add(17, "adding.4.a17", "Four-digit and up", "up to 6 digits", "stacked", false, STACKED_TIME, 4),
  add(18, "adding.5.a18", "Decimals", "tenths, then hundredths", "stacked", false, STACKED_TIME, 5),
  sub(1, "adding.1.s1", "Take away within 5", "from ≤ 5", "across", true, 3, 1),
  sub(2, "adding.1.s2", "Take away within 10", "from ≤ 10", "across", true, 3, 1),
  sub(3, "adding.1.s3", "Take 1, take 2", "from 2 to 20", "across", false, 3, 1),
  sub(4, "adding.1.s4", "Subtract from 10", "10 − n", "across", false, 3, 1),
  sub(5, "adding.2.s5", "Within 20, no crossing 10", "teen − one-digit, ones ≥ subtrahend", "across", false, 3, 2),
  sub(6, "adding.2.s6", "Within 20, crossing 10", "teen − one-digit, ones < subtrahend", "across", false, 3, 2),
  sub(7, "adding.2.s7", "Subtract tens", "tens − tens", "across", false, 5, 2),
  sub(8, "adding.2.s8", "Two-digit − one-digit, no borrow", "ones ≥ subtrahend", "across", false, 5, 2),
  sub(9, "adding.2.s9", "Two-digit − one-digit, borrow", "ones < subtrahend", "across", false, 5, 2),
  sub(10, "adding.2.s10", "Two-digit − two-digit, no borrow", "each column ≥ 0", "stacked", false, STACKED_TIME, 2),
  sub(11, "adding.2.s11", "Two-digit − two-digit, borrow", "ones column borrows", "stacked", false, STACKED_TIME, 2),
  sub(12, "adding.3.s12", "Three-digit, borrow once", "one borrow", "stacked", false, STACKED_TIME, 3),
  sub(13, "adding.3.s13", "Three-digit, borrow across zero", "middle digit 0", "stacked", false, STACKED_TIME, 3),
  sub(14, "adding.4.s14", "Four-digit and up", "up to 6 digits", "stacked", false, STACKED_TIME, 4),
  sub(15, "adding.5.s15", "Decimals", "tenths, then hundredths", "stacked", false, STACKED_TIME, 5),
  mul(1, "multiplying.3.m1", "Equal groups", "2 to 5 groups of 2 to 5", "across", true, 3, 3),
  mul(2, "multiplying.4.m2", "× 2, × 10", "0 to 10", "across", false, 3, 4),
  mul(3, "multiplying.4.m3", "× 5", "0 to 10", "across", false, 3, 4),
  mul(4, "multiplying.4.m4", "× 3, × 4", "0 to 10", "across", false, 3, 4),
  mul(5, "multiplying.4.m5", "× 6, × 7", "0 to 10", "across", false, 3, 4),
  mul(6, "multiplying.4.m6", "× 8, × 9", "0 to 10", "across", false, 3, 4),
  mul(7, "multiplying.4.m7", "All tables mixed", "0 to 10 × 0 to 10", "across", false, 3, 4),
  mul(8, "multiplying.4.m8", "× 10, × 100", "up to 3-digit", "across", false, 5, 4),
  mul(9, "multiplying.4.m9", "Two-digit × one-digit", "no carry, then carry", "stacked", false, STACKED_TIME, 4),
  mul(10, "multiplying.5.m10", "Three-digit × one-digit", "three-digit × one-digit", "stacked", false, STACKED_TIME, 5),
  mul(11, "multiplying.5.m11", "Two-digit × two-digit", "two-digit × two-digit", "stacked", false, STACKED_TIME, 5),
  mul(12, "multiplying.5.m12", "Larger", "up to 3-digit × 3-digit", "stacked", false, STACKED_TIME, 5),
  mul(13, "multiplying.5.m13", "Decimals", "tenths × whole, then tenths × tenths", "across", false, STACKED_TIME, 5),
  div(1, "dividing.4.d1", "Share equally", "4 to 20 split into 2 to 5", "across", true, 3, 4),
  div(2, "dividing.4.d2", "÷ 2, ÷ 5, ÷ 10", "facts from M2, M3", "across", false, 3, 4),
  div(3, "dividing.4.d3", "÷ 3, ÷ 4", "facts from M4", "across", false, 3, 4),
  div(4, "dividing.4.d4", "÷ 6 to ÷ 9", "facts from M5, M6", "across", false, 3, 4),
  div(5, "dividing.4.d5", "All facts mixed", "facts from M7", "across", false, 3, 4),
  div(6, "dividing.4.d6", "Remainders", "facts ± leftover", "across", false, 5, 4),
  div(7, "dividing.5.d7", "Two-digit ÷ one-digit, no remainder", "two-digit ÷ one-digit", "long-division", false, LONG_TIME, 5),
  div(8, "dividing.5.d8", "Three-digit ÷ one-digit", "with and without remainder", "long-division", false, LONG_TIME, 5),
  div(9, "dividing.5.d9", "÷ two-digit", "÷ two-digit", "long-division", false, LONG_TIME, 5),
  div(10, "dividing.5.d10", "To a decimal", "to a decimal", "long-division", false, LONG_TIME, 5),
];

export const DOT_STEPS = new Set(LADDER_STEPS.filter((step) => step.dots).map((step) => step.id));

export function ladderStep(id: string): LadderStep | undefined {
  return LADDER_STEPS.find((step) => step.id === id || step.skillId === id);
}

export function stepsForOp(op: LadderOp): LadderStep[] {
  return LADDER_STEPS.filter((step) => step.op === op);
}

export function gradeNumber(grade: number | "unsure" | null | undefined): number {
  if (grade === "unsure" || grade == null) {
    return 3;
  }
  return grade;
}

/** Highest step number allowed for this operation at this grade, or 0 if the operation is off. */
export function gradeCap(op: LadderOp, grade: number | "unsure" | null | undefined): number {
  const g = gradeNumber(grade);
  if (g <= 0) {
    return op === "A" ? 4 : op === "S" ? 4 : 0;
  }
  if (g === 1) {
    return op === "A" ? 13 : op === "S" ? 11 : 0;
  }
  if (g === 2) {
    return op === "A" ? 16 : op === "S" ? 13 : op === "M" ? 1 : 0;
  }
  if (g === 3) {
    return op === "A" ? 17 : op === "S" ? 14 : op === "M" ? 9 : 6;
  }
  return op === "A" ? 18 : op === "S" ? 15 : op === "M" ? 13 : 10;
}

export function opStrand(op: LadderOp): string {
  if (op === "S") {
    return "subtracting";
  }
  if (op === "M") {
    return "multiplying";
  }
  if (op === "D") {
    return "dividing";
  }
  return "adding";
}

export function strandAllowed(strandId: string, grade: number | "unsure" | null | undefined): boolean {
  const g = gradeNumber(grade);
  if (strandId === "adding" || strandId === "subtracting") {
    return true;
  }
  if (strandId === "multiplying") {
    return gradeCap("M", g) > 0;
  }
  if (strandId === "dividing") {
    return gradeCap("D", g) > 0;
  }
  if (strandId === "fractions" || strandId === "geometry" || strandId === "algebra") {
    return g >= 3;
  }
  return g !== 1;
}

export function stepAllowed(step: LadderStep, grade: number | "unsure" | null | undefined): boolean {
  return step.n <= gradeCap(step.op, grade);
}

export function legalSteps(grade: number | "unsure" | null | undefined): LadderStep[] {
  const allowed = LADDER_STEPS.filter((step) => stepAllowed(step, grade));
  const byOp: Record<LadderOp, LadderStep[]> = { A: [], S: [], M: [], D: [] };
  for (const step of allowed) {
    byOp[step.op].push(step);
  }
  const mixed: LadderStep[] = [];
  const longest = Math.max(byOp.A.length, byOp.S.length, byOp.M.length, byOp.D.length);
  for (let index = 0; index < longest; index += 1) {
    for (const op of ["A", "S", "M", "D"] as const) {
      if (byOp[op][index]) {
        mixed.push(byOp[op][index]);
      }
    }
  }
  return mixed;
}

/** Steps this grade may serve that the profile has already opened. */
export function reachedSteps(grade: number | "unsure" | null | undefined, levels?: Record<string, number> | null): LadderStep[] {
  return legalSteps(grade).filter((step) => {
    if (!levels) {
      return true;
    }
    const placed =
      step.op === "S"
        ? (levels.subtracting ?? levels.adding ?? step.level)
        : step.op === "A"
          ? (levels.adding ?? step.level)
          : step.op === "M"
            ? (levels.multiplying ?? 0)
            : (levels.dividing ?? 0);
    return step.level <= placed;
  });
}

export function startStep(op: LadderOp, grade: number | "unsure" | null | undefined): LadderStep {
  const allowed = stepsForOp(op).filter((step) => stepAllowed(step, grade));
  if (allowed.length === 0) {
    return stepsForOp("A")[0];
  }
  const cap = allowed[allowed.length - 1];
  const mid = allowed[Math.max(0, Math.floor(allowed.length / 2) - 1)];
  return mid ?? cap;
}

export function stepBelow(step: LadderStep): LadderStep {
  const list = stepsForOp(step.op);
  return list[Math.max(0, list.findIndex((item) => item.id === step.id) - 1)] ?? step;
}

export const LADDER_VERSION = 1;
