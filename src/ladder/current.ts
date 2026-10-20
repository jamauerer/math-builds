import { gradeCap, ladderStep, stepsForOp, type LadderOp, type LadderStep } from "./steps";

export type StepStateName = "new" | "learning" | "practicing" | "fluent" | "mastered";

export type LadderStarts = {
  adding: string;
  subtracting: string;
  multiplying?: string;
  dividing?: string;
};

export type ServeCeiling = Partial<Record<LadderOp, number>>;

const OPS: LadderOp[] = ["A", "S", "M", "D"];

function openState(state: StepStateName | undefined): boolean {
  return state === "new" || state === "learning";
}

function passedState(state: StepStateName | undefined): boolean {
  return state === "practicing" || state === "fluent" || state === "mastered";
}

export function startIdForOp(starts: LadderStarts | null | undefined, op: LadderOp): string | undefined {
  if (!starts) {
    return undefined;
  }
  if (op === "A") {
    return starts.adding;
  }
  if (op === "S") {
    return starts.subtracting;
  }
  if (op === "M") {
    return starts.multiplying;
  }
  return starts.dividing;
}

export function currentLadderStep(
  op: LadderOp,
  stateOf: (skillId: string) => StepStateName | undefined,
  grade?: number | "unsure" | null,
): LadderStep {
  const cap = gradeCap(op, grade);
  const steps = stepsForOp(op).filter((step) => cap <= 0 || step.n <= cap);
  const list = steps.length > 0 ? steps : stepsForOp(op);
  const firstOpen = list.find((step) => openState(stateOf(step.skillId)));
  if (firstOpen) {
    return firstOpen;
  }
  const practicing = list.find((step) => stateOf(step.skillId) === "practicing");
  if (practicing) {
    return practicing;
  }
  return list[list.length - 1] ?? stepsForOp("A")[0];
}

export function passedLadderSteps(
  op: LadderOp,
  stateOf: (skillId: string) => StepStateName | undefined,
  current: LadderStep,
): LadderStep[] {
  return stepsForOp(op)
    .filter((step) => step.n < current.n && passedState(stateOf(step.skillId)))
    .sort((left, right) => right.n - left.n);
}

export function maxOpenStep(
  op: LadderOp,
  stateOf: (skillId: string) => StepStateName | undefined,
  grade?: number | "unsure" | null,
  roundCeil?: number,
): number {
  const current = currentLadderStep(op, stateOf, grade);
  const opened = passedState(stateOf(current.skillId)) ? current.n + 1 : current.n;
  const cap = gradeCap(op, grade);
  const hard = cap > 0 ? cap : current.n;
  const ceil = roundCeil ?? current.n + 1;
  return Math.min(hard, ceil, opened, current.n + 1);
}

export function stepWithinCeiling(step: LadderStep, ceiling?: ServeCeiling): boolean {
  const max = ceiling?.[step.op];
  return max == null || step.n <= max;
}

export function pickCeilingStep(op: LadderOp, ceiling: ServeCeiling | undefined, grade: number | "unsure" | null | undefined): LadderStep {
  const cap = Math.max(1, gradeCap(op, grade));
  const maxN = Math.min(cap, ceiling?.[op] ?? cap);
  return stepsForOp(op).find((step) => step.n === maxN) ?? stepsForOp(op).find((step) => step.n <= maxN) ?? stepsForOp(op)[0];
}

export function startsFromIds(starts: LadderStarts): Partial<Record<LadderOp, LadderStep>> {
  const found: Partial<Record<LadderOp, LadderStep>> = {};
  for (const op of OPS) {
    const id = startIdForOp(starts, op);
    const step = id ? ladderStep(id) : undefined;
    if (step && step.op === op) {
      found[op] = step;
    }
  }
  return found;
}
