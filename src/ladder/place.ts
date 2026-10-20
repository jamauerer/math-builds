import { serveQuestion, type ServedQuestion } from "./serve";
import { gradeCap, startStep, stepBelow, stepsForOp, type LadderOp, type LadderStep } from "./steps";

export type LadderPlace = {
  ops: LadderOp[];
  index: number;
  current: Record<LadderOp, number>;
  direction: Record<LadderOp, number>;
  reversals: Record<LadderOp, number>;
  asked: number;
  done: boolean;
};

export type LadderSettle = {
  adding: string;
  subtracting: string;
  multiplying?: string;
  dividing?: string;
  levels: Record<string, number>;
};

function opsFor(grade: number | "unsure" | null | undefined): LadderOp[] {
  const ops: LadderOp[] = ["A", "S"];
  if (gradeCap("M", grade) > 0) {
    ops.push("M");
  }
  if (gradeCap("D", grade) > 0) {
    ops.push("D");
  }
  return ops;
}

export function beginLadderPlace(grade: number | "unsure" | null | undefined): LadderPlace {
  const ops = opsFor(grade);
  const current = { A: startStep("A", grade).n, S: startStep("S", grade).n, M: startStep("M", grade).n, D: startStep("D", grade).n };
  return {
    ops,
    index: 0,
    current,
    direction: { A: 0, S: 0, M: 0, D: 0 },
    reversals: { A: 0, S: 0, M: 0, D: 0 },
    asked: 0,
    done: false,
  };
}

export function ladderPlaceAsk(run: LadderPlace, grade: number | "unsure" | null | undefined, seed = 0): ServedQuestion {
  const op = run.ops[run.index % run.ops.length] ?? "A";
  const n = Math.min(gradeCap(op, grade) || 1, Math.max(1, run.current[op]));
  const step = stepsForOp(op).find((item) => item.n === n) ?? startStep(op, grade);
  return serveQuestion({ grade, step, seed: seed + run.asked * 13, kind: "place" });
}

export function ladderPlaceAnswer(run: LadderPlace, grade: number | "unsure" | null | undefined, correct: boolean): LadderPlace {
  if (run.done) {
    return run;
  }
  const op = run.ops[run.index % run.ops.length] ?? "A";
  const cap = Math.max(1, gradeCap(op, grade));
  const asked = run.current[op];
  const next = correct ? Math.min(cap, asked + 1) : Math.max(1, asked - 1);
  const dir = next > asked ? 1 : next < asked ? -1 : 0;
  const prev = run.direction[op];
  const reversals = { ...run.reversals };
  if (prev !== 0 && dir !== 0 && dir !== prev) {
    reversals[op] += 1;
  }
  const current = { ...run.current, [op]: next };
  const askedCount = run.asked + 1;
  const settled = askedCount >= 9 && Object.values(reversals).reduce((sum, n) => sum + n, 0) >= 2;
  return {
    ...run,
    current,
    direction: { ...run.direction, [op]: dir || prev },
    reversals,
    index: run.index + 1,
    asked: askedCount,
    done: settled || askedCount >= 12,
  };
}

function settledStep(op: LadderOp, n: number, grade: number | "unsure" | null | undefined): LadderStep {
  const cap = Math.max(1, gradeCap(op, grade));
  return stepsForOp(op).find((item) => item.n === Math.min(cap, Math.max(1, n))) ?? startStep(op, grade);
}

export function settleLadder(run: LadderPlace, grade: number | "unsure" | null | undefined): LadderSettle {
  const adding = stepBelow(settledStep("A", run.current.A, grade));
  const subtracting = stepBelow(settledStep("S", run.current.S, grade));
  const multiplying = gradeCap("M", grade) > 0 ? stepBelow(settledStep("M", run.current.M, grade)) : undefined;
  const dividing = gradeCap("D", grade) > 0 ? stepBelow(settledStep("D", run.current.D, grade)) : undefined;
  const levels: Record<string, number> = {
    adding: Math.max(adding.level, subtracting.level),
    multiplying: multiplying?.level ?? 1,
    dividing: dividing?.level ?? 1,
    counting: 1,
    measuring: 1,
    fractions: 1,
    ratios: 1,
    geometry: 1,
    algebra: 1,
  };
  return {
    adding: adding.id,
    subtracting: subtracting.id,
    multiplying: multiplying?.id,
    dividing: dividing?.id,
    levels,
  };
}
