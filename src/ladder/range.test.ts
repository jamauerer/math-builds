import { describe, expect, it } from "vitest";
import { generateStep, inStepRange } from "./generate";
import { LADDER_STEPS } from "./steps";

describe("ladder ranges", () => {
  it.each(LADDER_STEPS)("$id stays inside its range for 1000 questions", (step) => {
    for (let seed = 1; seed <= 1000; seed += 1) {
      const item = generateStep(step, seed);
      expect(item.stepId, `${step.id} seed ${seed}`).toBe(step.id);
      expect(inStepRange(step, item), `${step.id} ${item.prompt} = ${item.answer} seed ${seed}`).toBe(true);
    }
  });
});
