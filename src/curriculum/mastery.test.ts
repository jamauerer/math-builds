import { describe, expect, it } from "vitest";
import { createLearnerMap, recordLevelPass } from "../engine/placement";
import { skills } from "../data/load-skills";
import { hintFor } from "./hints";
import { challengeOpen, emptyMastery, masteryMet, queueRecall, recallReady, skillsMet } from "./mastery";

describe("curriculum gates", () => {
  it("opens a challenge from skills only, at any age", () => {
    const map = createLearnerMap(skills);
    const need = [{ skillId: "multiply-facts-2-to-5", level: 2 }];
    expect(skillsMet(need, map, 6)).toBe(false);
    expect(skillsMet(need, map, 17)).toBe(false);
    const passed = recordLevelPass(map, "multiply-facts-2-to-5", 2);
    expect(skillsMet(need, passed, 6)).toBe(true);
    expect(skillsMet(need, passed, 17)).toBe(true);
  });

  it("unlocks the next challenge when the previous one is practiced", () => {
    const map = createLearnerMap(skills);
    const family = [
      { id: "one", skills: [{ skillId: "tens-and-ones", level: 0 }] },
      { id: "two", skills: [{ skillId: "tens-and-ones", level: 1 }] },
    ];
    expect(challengeOpen(family, "one", [], map)).toBe(true);
    expect(challengeOpen(family, "two", [], map)).toBe(false);
    expect(challengeOpen(family, "two", ["one"], map)).toBe(true);
  });

  it("does not grant mastery without the transfer problem", () => {
    const started = { ...emptyMastery(), challengeDone: true, recallPassed: true };
    expect(masteryMet(started)).toBe(false);
    expect(masteryMet({ ...started, transferPassed: true })).toBe(true);
  });

  it("queues recall for the next day", () => {
    const now = 1_700_000_000_000;
    const record = { ...emptyMastery(), challengeDone: true, transferPassed: true, recallAt: queueRecall(now) };
    expect(recallReady(record, now + 60_000)).toBe(false);
    expect(recallReady(record, now + 24 * 60 * 60 * 1000)).toBe(true);
  });

  it("makes hints more specific without giving the original answer", () => {
    const hints = ["Count the gap.", "Add the two bearings to the gap.", "A gap of 3 with 1 on each side needs a beam of 5."] as const;
    expect(hintFor([...hints], 0)).toBeNull();
    expect(hintFor([...hints], 1)).toBe(hints[0]);
    expect(hintFor([...hints], 2)).toBe(hints[1]);
    expect(hintFor([...hints], 4)).toBe(hints[2]);
    expect(hints[2].includes("4")).toBe(false);
  });
});
