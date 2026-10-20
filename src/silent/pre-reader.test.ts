import { describe, expect, it } from "vitest";
import { CURRICULUM_SKILLS } from "../skills";
import { skillQuestion } from "../skills/generate";
import { skillHold } from "../machines/bridge/kits/earn";
import { isPreReader, pictureHelpFor, silentAction } from "./pre-reader";

const EARLY = ["adding.1.a1", "adding.1.a2", "adding.1.a3", "adding.1.a4", "adding.1.s1", "adding.1.s2", "adding.1.s3", "adding.1.s4"];

describe("pre-reader questions", () => {
  it("marks A1-A4, S1-S4, and every level 1 skill", () => {
    for (const id of EARLY) {
      expect(isPreReader({ skillId: id }), id).toBe(true);
    }
    const levelOne = CURRICULUM_SKILLS.filter((skill) => skill.level === 1);
    expect(levelOne.length).toBeGreaterThan(8);
    for (const skill of levelOne) {
      expect(isPreReader({ skillId: skill.id, level: skill.level }), skill.id).toBe(true);
    }
    expect(isPreReader({ skillId: "adding.2.a6", level: 2 })).toBe(false);
  });

  it("gives each early step a picture action that needs no keypad", () => {
    for (const id of EARLY) {
      const item = skillQuestion(id, 3);
      expect(item.action, id).toBe("drag-count");
      expect(item.draw, id).toBeTruthy();
    }
  });

  it("maps each question type to one picture instruction", () => {
    expect(pictureHelpFor({ skillId: "adding.1.a1" })).toBe("fill-box");
    expect(pictureHelpFor({ skillId: "counting.1.to-10" })).toBe("count-tray");
    expect(pictureHelpFor({ skillId: "adding.1.s1" })).toBe("count-tray");
    expect(pictureHelpFor({ skillId: "counting.1.compare" })).toBe("compare-piles");
    expect(pictureHelpFor({ skillId: "counting.1.pattern" })).toBe("pattern-gap");
    expect(silentAction("fill-box")).toBe("drag-count");
    expect(silentAction("compare-piles")).toBe("tap-choice");
  });

  it("holds a silent A1 question with a fill-box action", () => {
    const state = skillHold("adding.1.a1", 3);
    expect(isPreReader(state.current)).toBe(true);
    expect(state.current.action).toBe("drag-count");
    expect(pictureHelpFor(state.current)).toBe("fill-box");
  });
});
