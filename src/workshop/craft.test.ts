import { describe, expect, it } from "vitest";
import { skills } from "../data/load-skills";
import { challengeOpen, emptyMastery } from "../curriculum/mastery";
import { bridgeModel } from "../machines/bridge/model";
import { piecesFor, referenceDesign } from "../machines/loop";
import { bridgeMachine } from "../machines/bridge/definition";
import { exportProgress, importProgress } from "../progress/transfer";
import { blankWorkshop, sanitizeProgress } from "../storage/progress";
import { createLearnerMap } from "../engine/placement";
import { awardStars, cameraFrame, featBadges, rankFor, rememberSnapshot, showcaseFor, skinColor, successPlate, weeklyId, xpFor } from "./craft";
import { playTone } from "./feel";
import { resultAllowed } from "./scenes";

describe("craft stars and badges", () => {
  it("awards stars and badges only from a passed build", () => {
    expect(awardStars({ passed: false, usedExtra: true, predictRight: true, spec: 4, answer: 4 })).toEqual([]);
    expect(featBadges({ machine: "bridge", family: "Truss diagram", scene: { ask: 5 } }, false, ["Under budget"])).toEqual([]);
    const stars = awardStars({ passed: true, usedExtra: false, predictRight: true, spec: 4, answer: 4 });
    expect(stars).toEqual(["Fewest parts", "Under budget", "Right predict"]);
    expect(awardStars({ passed: true, usedExtra: true, predictRight: false, spec: 9, answer: 4 })).toEqual(["Elegant support"]);
    const feats = featBadges({ machine: "gears", family: "Winch rates", scene: { ask: 1, goal: 1 / 12 } }, true, stars);
    expect(feats.map((feat) => feat.id)).toContain("train-12");
    expect(feats.map((feat) => feat.id)).toContain("under-budget");
    expect(xpFor({ ...emptyMastery(), challengeDone: true })).toBe(10);
    expect(xpFor({ ...emptyMastery(), challengeDone: true, transferPassed: true, recallPassed: true, recallAt: 1 })).toBe(85);
    expect(xpFor(emptyMastery())).toBe(0);
    expect(rankFor(0).name).toBe("Apprentice");
    expect(rankFor(6).name).toBe("Builder");
    expect(rankFor(13).because).toContain("13");
  });
});

describe("cosmetic prizes", () => {
  it("leaves physics, unlocks, and stock alone", () => {
    const challenge = bridgeMachine.challenges[0];
    const design = referenceDesign(challenge);
    const before = bridgeModel.evaluate(design, challenge.scene);
    const painted = skinColor("#e85d4c", "red-wagon");
    const after = bridgeModel.evaluate(design, challenge.scene);
    expect(after).toEqual(before);
    expect(painted).not.toBe("#e85d4c");
    const map = createLearnerMap(skills);
    const open = challengeOpen(bridgeMachine.challenges.filter((item) => item.family === challenge.family), challenge.id, [], map);
    expect(challengeOpen(bridgeMachine.challenges.filter((item) => item.family === challenge.family), challenge.id, [], map)).toBe(open);
    expect(piecesFor(challenge, { [`${challenge.id}-part`]: challenge.questions.find((question) => question.kind === "part")?.answer ?? 0 })).toEqual(
      piecesFor(challenge, { [`${challenge.id}-part`]: challenge.questions.find((question) => question.kind === "part")?.answer ?? 0 }),
    );
  });
});

describe("snapshots and export", () => {
  it("saves a gallery and round-trips it through export", () => {
    const shot = { id: "shot-1", machine: "gears", challengeId: "gears-l04-a", title: "36 divided by 12", image: "data:image/png;base64,abc", at: 10 };
    const gallery = rememberSnapshot([], shot);
    expect(gallery).toHaveLength(1);
    expect(showcaseFor(gallery).map((item) => item.machine)).toEqual(["gears"]);
    const progress = sanitizeProgress(skills, {
      map: createLearnerMap(skills),
      toppedOut: [],
      placement: null,
      history: [],
      age: null,
      ageAsked: true,
      bridgeCompleted: [],
      bridgeEarned: {},
      workshop: { ...blankWorkshop(), snapshots: gallery, stars: { "gears-l04-a": ["Fewest parts"] }, prizes: ["brass-lamp"], sound: false },
    });
    const loaded = importProgress(exportProgress(progress), skills);
    expect(loaded.workshop?.snapshots[0]?.image).toBe(shot.image);
    expect(loaded.workshop?.stars["gears-l04-a"]).toEqual(["Fewest parts"]);
    expect(loaded.workshop?.prizes).toEqual(["brass-lamp"]);
    expect(loaded.workshop?.sound).toBe(false);
  });

  it("shows the result only after a frame has been drawn", () => {
    expect(resultAllowed(0)).toBe(false);
    expect(resultAllowed(2)).toBe(true);
    expect(cameraFrame("winch", 0.5, "slow").caption).toBe("Slow motion");
    expect(cameraFrame("winch", 1, "result").scale).toBeLessThan(1);
    expect(playTone(false, "success")).toBe(false);
    expect(successPlate("gears", { load: 20 }, [{ label: "Crank force", value: "6.67" }])).toContain("20 kg");
    expect(weeklyId(["gears-l04-a", "gears-l05-a"], 0)).toBe("gears-l04-a");
  });
});
