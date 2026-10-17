import { describe, expect, it } from "vitest";
import { skills } from "../../data/load-skills";
import { createLearnerMap, recordLevelPass } from "../placement";
import {
  applySkillCheck,
  bridgeParts,
  buildModes,
  candyLevels,
  gradeQuestion,
  levelById,
  levelUnlocked,
  makeSkillCheck,
  measureAnswer,
  modeUnlocked,
  partUnlocked,
  referenceBridges,
  suggestWorld,
  unlockSkillName,
  worldById,
  worldUnlocked,
} from "./catalog";

function skill(id: string) {
  const found = skills.find((item) => item.id === id);
  if (!found) {
    throw new Error(`missing skill ${id}`);
  }
  return found;
}

describe("candy levels", () => {
  it("suggests a world from age only before any skill result exists", () => {
    const fresh = createLearnerMap(skills);
    expect(suggestWorld(7, fresh)).toBe("candy");
    expect(suggestWorld(14, fresh)).toBe("steel");
    expect(suggestWorld(null, fresh)).toBe("candy");
    expect(candyLevels.filter((level) => level.playable).map((level) => level.id)).toEqual(["candy-1", "candy-2"]);
  });

  it("lets a young learner with high skills open Wood Valley", () => {
    let map = createLearnerMap(skills);
    map = recordLevelPass(map, "multiply-facts-2-to-5", 3);
    expect(suggestWorld(7, map)).toBe("wood");
    expect(worldUnlocked(worldById("wood"), map)).toBe(true);
    expect(levelUnlocked(levelById("wood-1")!, map)).toBe(true);
  });

  it("keeps a low skill map on Candy Land even when the age is high", () => {
    let map = createLearnerMap(skills);
    map = recordLevelPass(map, "tens-and-ones", 1);
    expect(suggestWorld(14, map)).toBe("candy");
    expect(suggestWorld(null, map)).toBe("candy");
    expect(levelUnlocked(levelById("wood-1")!, map)).toBe(false);
    expect(levelUnlocked(levelById("candy-3")!, map)).toBe(false);
    expect(levelUnlocked(levelById("candy-1")!, map)).toBe(true);
    const clearedAge = suggestWorld(null, map);
    const changedAge = suggestWorld(18, map);
    expect(levelUnlocked(levelById("candy-3")!, map)).toBe(false);
    expect(clearedAge).toBe(changedAge);
    expect(worldUnlocked(worldById("wood"), map)).toBe(false);
  });

  it("opens a level only when the skill check is passed", () => {
    const map = createLearnerMap(skills);
    const gate = levelById("candy-3")!;
    const need = gate.requires[0];
    if (!need) {
      throw new Error("candy-3 has no requirement");
    }
    const problems = makeSkillCheck(skill(need.skillId), need.level, 11);
    expect(problems.length).toBeLessThanOrEqual(3);
    const failed = applySkillCheck(map, need.skillId, need.level, problems, ["0", "0", "0"]);
    expect(failed).toBe(map);
    expect(levelUnlocked(gate, failed)).toBe(false);
    const passed = applySkillCheck(
      map,
      need.skillId,
      need.level,
      problems,
      problems.map((problem) => problem.answer),
    );
    expect(passed[need.skillId]?.level).toBeGreaterThanOrEqual(need.level);
    expect(levelUnlocked(gate, passed)).toBe(true);
  });

  it("locks parts and build modes until the skill level is high enough", () => {
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
    expect(modeUnlocked("count", map)).toBe(true);
    expect(modeUnlocked("calculate", map)).toBe(false);
    expect(modeUnlocked("free", map)).toBe(false);
    map = recordLevelPass(map, locked.unlock.skillId, 2);
    expect(partUnlocked(locked, map)).toBe(false);
    map = recordLevelPass(map, locked.unlock.skillId, 3);
    expect(partUnlocked(locked, map)).toBe(true);
    expect(unlockSkillName(locked, skills)).toBe("Multiplication facts 2 to 5");
    const calculate = buildModes.find((mode) => mode.id === "calculate");
    if (!calculate?.requires[0]) {
      throw new Error("calculate mode is missing a gate");
    }
    map = recordLevelPass(map, calculate.requires[0].skillId, calculate.requires[0].level);
    expect(modeUnlocked("calculate", map)).toBe(true);
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
