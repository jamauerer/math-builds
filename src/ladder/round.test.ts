import { describe, expect, it } from "vitest";
import { validateStep } from "./generate";
import { playLearner } from "./sample";
import { ladderStep } from "./steps";

function stepN(id: string): number {
  return ladderStep(id)?.n ?? 0;
}

function opOf(id: string): string | undefined {
  return ladderStep(id)?.op;
}

function play(correctAt: (asked: number) => boolean) {
  return playLearner(1, 3, 5, correctAt);
}

describe("ladder rounds", () => {
  it("a grade 1 learner who is always right stays in 12-15 question rounds and climbs at most one step per operation", () => {
    const run = play(() => true);
    expect(run.rounds).toHaveLength(5);
    for (const round of run.rounds) {
      expect(round.lines.length, `round ${round.index}`).toBeGreaterThanOrEqual(12);
      expect(round.lines.length, `round ${round.index}`).toBeLessThanOrEqual(15);
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
          operands: (line.prompt.match(/\d+(\.\d+)?/g) ?? []).map(Number),
          form: step.form,
          picture: "none" as const,
          steps: [],
          why: "",
        };
        if (step.id === "A4") {
          item.operands = [item.operands[0] ?? 0, 10];
        }
        expect(validateStep(step, item), `${step.id} ${line.prompt}`).toBe(true);
      }
      for (const op of ["A", "S"] as const) {
        const start = round.currentAtStart[op];
        const end = round.currentAtEnd[op];
        if (!start || !end) {
          continue;
        }
        expect(stepN(end) - stepN(start), `${op} climbed more than one in round ${round.index}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it("a grade 1 learner at 60% stays in range and does not sweep the grade cap", () => {
    const run = play((asked) => asked % 5 < 3);
    expect(run.rounds).toHaveLength(5);
    for (const round of run.rounds) {
      expect(round.lines.length, `round ${round.index}`).toBeGreaterThanOrEqual(12);
      expect(round.lines.length, `round ${round.index}`).toBeLessThanOrEqual(15);
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
          operands: (line.prompt.match(/\d+(\.\d+)?/g) ?? []).map(Number),
          form: step.form,
          picture: "none" as const,
          steps: [],
          why: "",
        };
        if (step.id === "A4") {
          item.operands = [item.operands[0] ?? 0, 10];
        }
        expect(validateStep(step, item), `${step.id} ${line.prompt}`).toBe(true);
        expect(opOf(line.stepId) === "A" || opOf(line.stepId) === "S").toBe(true);
      }
    }
  });
});
