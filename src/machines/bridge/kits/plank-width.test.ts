import { describe, expect, it } from "vitest";
import { KIT_STRANDS } from "../../../engine/strand-placement";
import { sampleLearnerQuestions } from "../../../ladder/sample";
import { setUnitSystem } from "../../../units";
import { earnAtWord, earnHint, earnPrompt, explainQuestion } from "./earn";
import { plankSlots, plankWidthLabel, queenPost, slotFact } from "./kit";
import { pieceQuestion } from "./pieces";

/** Gap-coverage sizes used for deck planks. Those numbers are widths, not lengths. */
const COVER = [1, 2, 3];

function deckPlankCalledLong(text: string): boolean {
  const lower = text.toLowerCase();
  if (!/\bplanks?\b/.test(lower)) {
    return false;
  }
  for (const n of COVER) {
    if (new RegExp(`${n}\\s*(ft|m|feet|metres|meters)\\s+long`).test(lower)) {
      return true;
    }
    if (new RegExp(`each plank is\\s+${n}(?:\\s*(ft|m))?\\s+long`).test(lower)) {
      return true;
    }
  }
  return false;
}

describe("plank width", () => {
  it("fails if a deck plank is called long for its gap coverage", () => {
    for (const system of ["us", "metric"] as const) {
      setUnitSystem(system);
      for (const grade of [1, 3]) {
        for (const line of sampleLearnerQuestions(grade, 3)) {
          expect(deckPlankCalledLong(line.prompt), `${system} grade ${grade} #${line.n}: ${line.prompt}`).toBe(false);
        }
      }
    }
    setUnitSystem("us");
    const levels = Object.fromEntries(KIT_STRANDS.map((id) => [id, 4]));
    for (const level of [1, 4, 8, 12]) {
      const piece = pieceQuestion("planks", level);
      expect(deckPlankCalledLong(piece.prompt), piece.prompt).toBe(false);
      const word = earnAtWord({ ...levels, fractions: level, dividing: level }, "planks");
      const prompt = earnPrompt(word.current);
      expect(deckPlankCalledLong(prompt), prompt).toBe(false);
      const hint = earnHint(word.current);
      expect(deckPlankCalledLong(hint), hint).toBe(false);
      const explained = explainQuestion(word.current);
      expect(deckPlankCalledLong(explained.why), explained.why).toBe(false);
      for (const step of explained.steps) {
        expect(deckPlankCalledLong(step.text), step.text).toBe(false);
      }
    }
    expect(plankWidthLabel()).toMatch(/wide/);
    expect(deckPlankCalledLong(plankWidthLabel())).toBe(false);
    for (const slot of plankSlots()) {
      expect(deckPlankCalledLong(slotFact(slot))).toBe(false);
    }
    for (const step of queenPost.guide) {
      expect(deckPlankCalledLong(step.say), step.say).toBe(false);
    }
  });
});
