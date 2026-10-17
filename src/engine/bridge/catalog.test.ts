import { describe, expect, it } from "vitest";
import { skills } from "../../data/load-skills";
import { createLearnerMap, recordLevelPass } from "../placement";
import {
  modeForAge,
  partUnlocked,
  referenceDesigns,
  scenarioForMode,
  scenarios,
  unlockSkillName,
  workProblems,
} from "./catalog";

describe("bridge scenarios", () => {
  it("switches mode when the age changes", () => {
    expect(modeForAge(5)).toBe("pick");
    expect(modeForAge(8)).toBe("pick");
    expect(modeForAge(9)).toBe("calculate");
    expect(modeForAge(12)).toBe("calculate");
    expect(modeForAge(13)).toBe("free");
    expect(modeForAge(18)).toBe("free");
    expect(scenarios.map((item) => item.mode)).toEqual(["pick", "calculate", "free"]);
  });

  it("locks parts until the skill level is high enough", () => {
    const scenario = scenarioForMode("pick");
    const locked = scenario.parts.find((part) => part.unlock.level === 3);
    const open = scenario.parts.find((part) => part.unlock.level === 0);
    if (!locked || !open) {
      throw new Error("scenario is missing lock examples");
    }
    let map = createLearnerMap(skills);
    expect(partUnlocked(open, map)).toBe(true);
    expect(partUnlocked(locked, map)).toBe(false);
    map = recordLevelPass(map, locked.unlock.skillId, 2);
    expect(partUnlocked(locked, map)).toBe(false);
    map = recordLevelPass(map, locked.unlock.skillId, 3);
    expect(partUnlocked(locked, map)).toBe(true);
    expect(unlockSkillName(locked, skills)).toBe("Multiplication facts 2 to 5");
  });

  it("builds the calculate questions from the scenario numbers", () => {
    const scenario = scenarioForMode("calculate");
    const problems = workProblems(scenario);
    expect(problems.map((problem) => problem.answer)).toEqual(["4", "2", "1600"]);
    const designs = referenceDesigns(scenario);
    expect(designs.correct.beams).toHaveLength(4);
    expect(designs.correct.supports).toHaveLength(2);
    expect(designs.weak.supports).toHaveLength(1);
    expect(designs.margin.beams[0]?.strengthKg).toBeGreaterThan(designs.correct.beams[0]?.strengthKg ?? 0);
  });
});
