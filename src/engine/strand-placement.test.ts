import { describe, expect, it } from "vitest";
import { gradeStartLevel, PLACEMENT_STRANDS, runAdaptive } from "./strand-placement";

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
});
