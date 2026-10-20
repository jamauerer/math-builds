import { describe, expect, it } from "vitest";
import { allLearnTemplates, learnCard } from "./learn";
import { DOT_STEPS, LADDER_STEPS } from "./steps";

describe("learn cards", () => {
  it("every step has its own Learn card and explanation template", () => {
    const cards = allLearnTemplates();
    expect(cards).toHaveLength(LADDER_STEPS.length);
    const templates = new Set(cards.map((card) => card.template));
    expect(templates.size).toBe(LADDER_STEPS.length);
    for (const card of cards) {
      expect(card.template).not.toBe("generic");
      const step = LADDER_STEPS.find((item) => item.id === card.stepId);
      expect(card.dots).toBe(DOT_STEPS.has(card.stepId));
      expect(step).toBeTruthy();
    }
  });

  it("does not use a shared dots template unless the ladder says dots", () => {
    for (const step of LADDER_STEPS) {
      const card = learnCard(step, 4);
      if (!step.dots) {
        expect(card.template.startsWith("dots"), step.id).toBe(false);
        expect(card.dots, step.id).toBe(false);
      } else {
        expect(card.dots, step.id).toBe(true);
      }
    }
  });
});
