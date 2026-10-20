import { describe, expect, it } from "vitest";
import { pictureAgrees } from "../../../pictures/check";
import { dividingPicture } from "../../../pictures/dividing";
import { earnAtWord, earnPicture, earnPrompt, attachPlainPicture, openRun, type EarnQuestion } from "./earn";
import { queenPost } from "./kit";
import { KIT_STRANDS } from "../../../engine/strand-placement";
import { plainQuestion } from "./plain";
import { setUnitSystem } from "../../../units";

const levels = Object.fromEntries(KIT_STRANDS.map((id) => [id, 4]));

function servedPicture(strandId: string, level: number, seed: number) {
  const item = plainQuestion(strandId, level, seed);
  const question: EarnQuestion = {
    groupId: "bottom",
    strandId,
    level,
    answer: item.answer,
    fact: { kind: "plain", prompt: item.prompt, steps: item.steps, why: item.why, draw: item.draw },
  };
  return attachPlainPicture(question).picture ?? null;
}

describe("question pictures", () => {
  it("checks 200 generated questions on every strand", () => {
    setUnitSystem("us");
    for (const strandId of KIT_STRANDS) {
      for (let index = 0; index < 200; index += 1) {
        const level = (index % 13) + 1;
        const item = plainQuestion(strandId, level, index + 1);
        expect(item.prompt).toMatch(/= \?$/);
        expect(item.prompt.toLowerCase()).not.toContain("groups of");
        expect(item.prompt.toLowerCase()).not.toContain("how many");
        const picture = servedPicture(strandId, level, index + 1);
        const arithmetic = !["counting", "fractions", "geometry"].includes(strandId);
        if (arithmetic || (strandId === "counting" && level > 2)) {
          expect(picture, `${strandId} ${level}`).toBeNull();
        }
        if (picture) {
          expect(pictureAgrees(item.prompt, item.answer, picture), `${item.prompt}`).toBe(true);
        }
      }
    }
  });

  it("draws 7 planks for 56 ÷ 8, not 8", () => {
    const drawn = dividingPicture({ op: "div", a: 56, b: 8 });
    const planks = drawn.picture.bits.filter((bit) => bit.slot.startsWith("plank"));
    expect(planks).toHaveLength(7);
    const labels = drawn.picture.labels.map((label) => label.text).join(" ");
    expect(labels).toContain("56");
    expect(labels).toContain("8");
    expect(pictureAgrees("56 ÷ 8 = ?", "7", drawn.picture)).toBe(true);
  });

  it("labels the plank word problem with the lengths in the words", () => {
    setUnitSystem("us");
    for (const level of [4, 9, 12]) {
      const word = earnAtWord({ ...levels, counting: level }, "planks");
      const picture = earnPicture(word.current);
      const prompt = earnPrompt(word.current);
      if (picture) {
        expect(pictureAgrees(prompt, word.current.answer, picture)).toBe(true);
      }
    }
    const high = Object.fromEntries(KIT_STRANDS.map((id) => [id, 12]));
    const long = earnAtWord(high, "planks");
    const highPrompt = earnPrompt(long.current);
    if (long.current.stepId) {
      expect(highPrompt.length).toBeGreaterThan(0);
    } else {
      expect(highPrompt).toContain("15");
    }
  });

  it("puts only kit lengths on picture labels", () => {
    setUnitSystem("us");
    for (const group of queenPost.groups) {
      const word = earnAtWord({ ...levels, [group.strand]: 4 }, group.id);
      const picture = earnPicture(word.current);
      const kitLens = new Set(
        queenPost.slots.filter((slot) => slot.length != null).map((slot) => String(slot.length)),
      );
      for (const label of picture?.labels ?? []) {
        const token = label.text.replace(/[^\d.]/g, "");
        expect(kitLens.has(token) || kitLens.has(token.replace(/\.0$/, "")), label.text).toBe(true);
      }
    }
  });

  it("checks every piece word problem", () => {
    setUnitSystem("us");
    for (const group of queenPost.groups) {
      for (const level of [1, 2, 4, 6, 9, 12]) {
        const word = earnAtWord({ ...levels, [group.strand]: level }, group.id);
        const picture = earnPicture(word.current);
        if (picture) {
          expect(picture.bits.length).toBeGreaterThan(0);
          expect(pictureAgrees(earnPrompt(word.current), word.current.answer, picture)).toBe(true);
        }
      }
    }
  });

  it("keeps arithmetic runs free of pictures", () => {
    const run = openRun(levels, "bottom", 3);
    expect([run.current, ...run.upcoming].every((question) => question.picture == null || Boolean(question.stepId && /^(A1|A2|S1|S2|M1|D1)$/.test(question.stepId)))).toBe(true);
  });
});
