import { describe, expect, it } from "vitest";
import { generateStep, inStepRange, validateStep } from "./generate";
import { LADDER_STEPS, ladderStep } from "./steps";

describe("ladder ranges", () => {
  it.each(LADDER_STEPS)("$id stays inside its range for 1000 questions", (step) => {
    for (let seed = 1; seed <= 1000; seed += 1) {
      const item = generateStep(step, seed);
      expect(item.stepId, `${step.id} seed ${seed}`).toBe(step.id);
      expect(inStepRange(step, item), `${step.id} ${item.prompt} = ${item.answer} seed ${seed}`).toBe(true);
      if (step.form === "stacked") {
        expect(item.layout?.kind, `${step.id} stacked`).toBe("stacked");
      }
      if (step.op === "S") {
        expect(item.prompt, `${step.id} minus sign`).toMatch(/−/);
        expect(item.prompt.includes(" - ")).toBe(false);
      }
    }
  });

  it("rejects the known misses 10 − 2 as S6 and 17 − 3 as S8", () => {
    const s6 = ladderStep("S6");
    const s8 = ladderStep("S8");
    expect(s6 && s8).toBeTruthy();
    if (!s6 || !s8) {
      return;
    }
    expect(validateStep(s6, { stepId: "S6", skillId: s6.skillId, prompt: "10 − 2 = ?", answer: "8", operands: [10, 2], form: "across", picture: "none", steps: [], why: "" })).toBe(false);
    expect(validateStep(s8, { stepId: "S8", skillId: s8.skillId, prompt: "17 − 3 = ?", answer: "14", operands: [17, 3], form: "across", picture: "none", steps: [], why: "" })).toBe(false);
  });
});
