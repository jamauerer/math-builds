import { describe, expect, it } from "vitest";
import { fitLevels, gradeStartLevel, KIT_STRANDS, learnStartLevels, PLACEMENT_STRANDS, runAdaptive } from "./strand-placement";

describe("strand placement", () => {
  it("settles at level 4 when 1 to 4 are right and 5 and up are wrong", () => {
    const result = runAdaptive({
      startLevel: gradeStartLevel(0),
      correct: (level) => level <= 4,
    });
    expect(result.questions.length).toBeGreaterThanOrEqual(9);
    expect(result.questions.length).toBeLessThanOrEqual(12);
    for (const strand of PLACEMENT_STRANDS) {
      expect(result.levels[strand]).toBe(4);
    }
    expect(result.levels.counting).toBe(4);
  });

  it("maps a grade onto a start level and caps the sitting at 12", () => {
    expect(gradeStartLevel(0)).toBe(1);
    expect(gradeStartLevel(4)).toBe(5);
    expect(gradeStartLevel(12)).toBe(13);
    expect(gradeStartLevel("unsure")).toBe(5);
    const climbing = runAdaptive({ startLevel: 1, correct: () => true });
    expect(climbing.questions).toHaveLength(12);
    expect(climbing.levels.geometry).toBe(12);
  });

  it("keeps every strand within one level of a placement that settles at 4", () => {
    const result = runAdaptive({
      startLevel: gradeStartLevel(0),
      correct: (level) => level <= 4,
    });
    for (const strand of KIT_STRANDS) {
      expect(result.levels[strand]).toBeGreaterThanOrEqual(3);
      expect(result.levels[strand]).toBeLessThanOrEqual(5);
    }
    const skipped = runAdaptive({
      startLevel: 4,
      strands: ["adding", "multiplying", "dividing"],
      correct: (level) => level <= 4,
    });
    expect(skipped.levels.geometry).toBe(skipped.levels.adding);
    expect(skipped.levels.counting).toBe(skipped.levels.adding);
    const fitted = fitLevels({
      counting: 9,
      measuring: 9,
      adding: 4,
      multiplying: 4,
      dividing: 4,
      fractions: 9,
      ratios: 9,
      geometry: 9,
      algebra: 9,
    });
    expect(fitted.geometry).toBeLessThanOrEqual(5);
    expect(fitted.multiplying).toBe(4);
  });

  it("starts each strand one level below where the staircase settled", () => {
    const settled = runAdaptive({
      startLevel: gradeStartLevel(0),
      correct: (level) => level <= 4,
    }).levels;
    const started = learnStartLevels(settled);
    for (const strand of KIT_STRANDS) {
      expect(started[strand]).toBe(Math.max(1, settled[strand] - 1));
    }
  });
});
