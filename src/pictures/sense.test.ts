import { describe, expect, it } from "vitest";
import { earnAtWord, earnHint, earnPicture, earnPrompt, questionForStrand, type EarnQuestion } from "../machines/bridge/kits/earn";
import { queenPost } from "../machines/bridge/kits/kit";
import { plainQuestion } from "../machines/bridge/kits/plain";
import { drawPlain } from "./index";
import { pictureSlot } from "./layout";
import type { Picture } from "./parts";
import { setUnitSystem } from "../units";

const STRANDS = ["counting", "adding", "multiplying", "dividing", "fractions", "ratios", "measuring", "geometry", "algebra"];

describe("picture sense", () => {
  it("draws every picture from kit slots, and mentions only numbers the answer uses", () => {
    setUnitSystem("us");
    const pictures: Picture[] = [];
    const questions: EarnQuestion[] = [];

    for (const strand of STRANDS) {
      for (const level of [1, 3, 4, 6, 8, 9, 12]) {
        for (const seed of [1, 2, 5]) {
          const item = plainQuestion(strand, level, seed);
          const drawn = drawPlain(strand, item.draw, item.answer);
          const question: EarnQuestion = {
            groupId: "bottom",
            strandId: strand,
            level,
            answer: item.answer,
            hint: item.steps[0],
            fact: { kind: "plain", prompt: item.prompt, steps: item.steps, why: item.why, draw: item.draw },
            picture: drawn?.picture,
            pictureCaption: drawn?.caption,
          };
          questions.push(question);
          if (drawn) {
            pictures.push(drawn.picture);
          }
        }
      }
      for (const level of [2, 5, 10]) {
        const asked = questionForStrand(strand, level, 2);
        questions.push(asked);
        const picture = earnPicture(asked);
        if (picture) {
          pictures.push(picture);
        }
      }
    }

    for (const group of queenPost.groups) {
      const word = earnAtWord({ measuring: 4 }, group.id);
      questions.push(word.current);
      const picture = earnPicture(word.current);
      expect(picture?.bits.length).toBeGreaterThan(0);
      if (picture) {
        pictures.push(picture);
      }
    }

    expect(pictures.length).toBeGreaterThan(0);
    for (const picture of pictures) {
      expect(picture.bits.length).toBeGreaterThan(0);
      const ids = picture.bits.map((bit) => bit.slot);
      expect(new Set(ids).size).toBe(ids.length);
      for (const bit of picture.bits) {
        const placed = pictureSlot(bit.slot);
        expect(bit.sprite).toBe(placed.sprite);
        expect(bit.x).toBeCloseTo(placed.x);
        expect(bit.y).toBeCloseTo(placed.y);
        expect(bit.w).toBeCloseTo(placed.w);
        expect(bit.h).toBeCloseTo(placed.h);
        expect(bit.rotate ?? 0).toBeCloseTo(placed.rotate ?? 0);
      }
    }

    for (const question of questions) {
      const allowed = operandNumbers(question);
      for (const text of [earnPrompt(question), earnHint(question)]) {
        expect(text.toLowerCase()).not.toMatch(/drawn|the picture|what you see/);
        for (const token of numbersIn(text)) {
          expect(allowed.has(token), `${text} mentions ${token}`).toBe(true);
        }
      }
    }
  });
});

function numbersIn(text: string): string[] {
  return text.split(/[^0-9.]+/).filter((part) => /^\d+(\.\d+)?$/.test(part));
}

function operandNumbers(question: EarnQuestion): Set<string> {
  const allowed = new Set<string>();
  const fact = question.fact;
  if (fact.kind === "piece") {
    for (const used of fact.used) {
      allowed.add(String(used));
    }
    return allowed;
  }
  if (fact.kind === "plain" && fact.draw) {
    allowed.add(String(fact.draw.a));
    allowed.add(String(fact.draw.b));
    if (fact.draw.c != null && fact.draw.c !== -1) {
      allowed.add(String(fact.draw.c));
    }
    return allowed;
  }
  for (const value of Object.values(fact)) {
    if (typeof value === "number") {
      allowed.add(String(value));
    }
  }
  return allowed;
}
