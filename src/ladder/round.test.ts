import { describe, expect, it } from "vitest";
import { hasBareZero, questionKey, validateStep, zeroStepAllowed } from "./generate";
import { playLearner } from "./sample";
import { ladderStep } from "./steps";

function stepN(id: string): number {
  return ladderStep(id)?.n ?? 0;
}

function opOf(id: string): string | undefined {
  return ladderStep(id)?.op;
}

function operandsOf(prompt: string, stepId: string): number[] {
  const nums = (prompt.match(/\d+(\.\d+)?/g) ?? []).map(Number);
  if (stepId === "A4") {
    return [nums[0] ?? 0, 10];
  }
  return nums;
}

function lineKey(line: { stepId: string; prompt: string }): string {
  return questionKey({ stepId: line.stepId, prompt: line.prompt, operands: operandsOf(line.prompt, line.stepId) });
}

function expectRoundShape(round: ReturnType<typeof playLearner>["rounds"][number]) {
  expect(round.lines.length, `round ${round.index}`).toBeGreaterThanOrEqual(12);
  expect(round.lines.length, `round ${round.index}`).toBeLessThanOrEqual(15);
  const keys = new Set<string>();
  let zeros = 0;
  for (const line of round.lines) {
    const step = ladderStep(line.stepId);
    expect(step, line.prompt).toBeTruthy();
    if (!step) {
      continue;
    }
    const current = stepN(line.current);
    expect(step.n, `${line.stepId} above ${line.current} + 1`).toBeLessThanOrEqual(current + 1);
    const item = {
      stepId: step.id,
      skillId: step.skillId,
      prompt: line.prompt,
      answer: line.answer,
      operands: operandsOf(line.prompt, step.id),
      form: step.form,
      picture: "none" as const,
      steps: [],
      why: "",
    };
    expect(validateStep(step, item), `${step.id} ${line.prompt}`).toBe(true);
    const key = lineKey(line);
    expect(keys.has(key), `repeat ${key} in round ${round.index}: ${line.prompt}`).toBe(false);
    keys.add(key);
    if (hasBareZero(item)) {
      zeros += 1;
      expect(zeroStepAllowed(step.id), `zero at ${step.id} ${line.prompt}`).toBe(true);
    }
  }
  expect(zeros, `too many zeros in round ${round.index}`).toBeLessThanOrEqual(1);
  return keys;
}

function play(correctAt: (asked: number, phase: "placement" | "round") => boolean) {
  return playLearner(1, 3, 5, correctAt);
}

describe("ladder rounds", () => {
  it("a grade 1 learner who is always right climbs adding and subtracting one step per round", () => {
    const run = play((_asked, phase) => phase === "round" || _asked % 3 !== 2);
    expect(run.rounds).toHaveLength(5);
    let prevKeys: Set<string> | null = null;
    for (const round of run.rounds) {
      const keys = expectRoundShape(round);
      if (prevKeys) {
        for (const line of round.lines) {
          const key = lineKey(line);
          expect(prevKeys.has(key), `repeat ${key} from last round: ${line.prompt}`).toBe(false);
        }
      }
      prevKeys = keys;
      for (const op of ["A", "S"] as const) {
        const start = round.currentAtStart[op];
        const end = round.currentAtEnd[op];
        expect(start, `${op} start round ${round.index}`).toBeTruthy();
        expect(end, `${op} end round ${round.index}`).toBeTruthy();
        expect(stepN(end ?? "") - stepN(start ?? ""), `${op} climb in round ${round.index} ${start}→${end}`).toBe(1);
      }
    }
  });

  it("a grade 1 learner at 60% stays in range and does not sweep the grade cap", () => {
    const run = play((asked) => asked % 5 < 3);
    expect(run.rounds).toHaveLength(5);
    let prevKeys: Set<string> | null = null;
    for (const round of run.rounds) {
      const keys = expectRoundShape(round);
      if (prevKeys) {
        for (const line of round.lines) {
          const key = lineKey(line);
          expect(prevKeys.has(key), `repeat ${key} from last round: ${line.prompt}`).toBe(false);
        }
      }
      prevKeys = keys;
      for (const line of round.lines) {
        expect(opOf(line.stepId) === "A" || opOf(line.stepId) === "S").toBe(true);
      }
    }
  });
});
