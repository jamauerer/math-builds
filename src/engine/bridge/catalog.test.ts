import { describe, expect, it } from "vitest";
import { skills } from "../../data/load-skills";
import { createLearnerMap, recordLevelPass } from "../placement";
import {
  bridgeParts,
  candyLevels,
  defaultWorld,
  gradeQuestion,
  measureAnswer,
  partUnlocked,
  referenceBridges,
  unlockSkillName,
} from "./catalog";

describe("candy levels", () => {
  it("picks the default world from age and never from a placement score", () => {
    expect(defaultWorld(5)).toBe("candy");
    expect(defaultWorld(9)).toBe("candy");
    expect(defaultWorld(10)).toBe("wood");
    expect(defaultWorld(13)).toBe("wood");
    expect(defaultWorld(14)).toBe("steel");
    expect(candyLevels.filter((level) => level.playable).map((level) => level.id)).toEqual(["candy-1", "candy-2"]);
  });

  it("locks parts until the skill level is high enough", () => {
    const locked = bridgeParts.find((part) => part.id === "pretzel");
    const open = bridgeParts.find((part) => part.id === "chocolate");
    const ramp = bridgeParts.find((part) => part.id === "ramp");
    if (!locked || !open || !ramp) {
      throw new Error("parts are missing");
    }
    let map = createLearnerMap(skills);
    expect(partUnlocked(open, map)).toBe(true);
    expect(partUnlocked(locked, map)).toBe(false);
    expect(partUnlocked(ramp, map)).toBe(false);
    map = recordLevelPass(map, locked.unlock.skillId, 2);
    expect(partUnlocked(locked, map)).toBe(false);
    map = recordLevelPass(map, locked.unlock.skillId, 3);
    expect(partUnlocked(locked, map)).toBe(true);
    expect(unlockSkillName(locked, skills)).toBe("Multiplication facts 2 to 5");
  });

  it("does not earn parts for a wrong answer", () => {
    const level = candyLevels.find((item) => item.id === "candy-2");
    if (!level) {
      throw new Error("candy-2 is missing");
    }
    expect(measureAnswer(level)).toBe(12);
    expect(level.gapBlocks).toBe(4);
    const blocks = level.questions[0];
    const pillars = level.questions[1];
    if (!blocks || !pillars) {
      throw new Error("questions are missing");
    }
    expect(gradeQuestion(blocks, "3").count).toBe(0);
    expect(gradeQuestion(blocks, "3").correct).toBe(false);
    expect(gradeQuestion(blocks, "3").hint.length).toBeGreaterThan(0);
    expect(gradeQuestion(blocks, "4")).toMatchObject({ correct: true, count: 4, partId: "chocolate" });
    expect(gradeQuestion(pillars, "2")).toMatchObject({ correct: true, count: 2, partId: "cane" });
    const designs = referenceBridges(level);
    expect(designs.correct.pieces.filter((piece) => piece.role === "deck")).toHaveLength(4);
    expect(designs.correct.pieces.filter((piece) => piece.role === "pillar")).toHaveLength(2);
    expect(designs.weak.pieces.filter((piece) => piece.role === "deck").length).toBeLessThan(4);
  });
});
