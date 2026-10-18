import { describe, expect, it } from "vitest";
import { createLearnerMap } from "../engine/placement";
import { skills } from "../data/load-skills";
import { exportProgress, importProgress } from "../progress/transfer";
import type { SavedProgress } from "../storage/progress";
import { blankWorkshop } from "../storage/progress";
import {
  BLOCKS_SET,
  DISCLAIMER,
  MECHANISM_SET,
  METERS_SET,
  STEPS,
  TIERS,
  afterBridge,
  allowance,
  beamLength,
  blocksFrame,
  designFitsBrief,
  discoveryScript,
  emptyNotes,
  failureLine,
  hintCard,
  lengthReport,
  makeResults,
  mathUse,
  mechanismFrame,
  metersFrame,
  noteAttempt,
  placementConclusion,
  qualityFor,
  representationFor,
  resultPlate,
  sameBuild,
  sceneFrame,
  shareReady,
  shouldPause,
  tierById,
  tierOpen,
  trackState,
  type CodexPage,
  type SkillTrack,
} from "./logic";

describe("bridge sequence rules", () => {
  it("uses the same scene frame for blocks, meters, and mechanism", () => {
    const frame = sceneFrame(12, 1);
    expect(blocksFrame(12, 1)).toEqual(frame);
    expect(metersFrame(12, 1)).toEqual(frame);
    expect(mechanismFrame(12, 1)).toEqual(frame);
    expect(frame.gapEnd - frame.gapStart).toBeCloseTo(12 * 22);
  });

  it("matches the model length on every tier", () => {
    for (const tier of TIERS) {
      const needed = beamLength(tier.gap, tier.bearing);
      const held = lengthReport(tier, needed);
      expect(held.ok).toBe(true);
      const short = lengthReport(tier, needed - 0.5);
      expect(short.ok).toBe(false);
      const reached = short.numbers.find((item) => item.label === "Length that reaches")?.value ?? "";
      expect(reached.startsWith(String(needed))).toBe(true);
    }
  });

  it("keeps every tier's correct design inside the brief", () => {
    for (const tier of TIERS) {
      expect(designFitsBrief(tier)).toBe(true);
      const weak = tier.materials.find((item) => item.id !== tier.passId && item.capacityKg < tier.materials.find((m) => m.id === tier.passId)!.capacityKg);
      if (weak) {
        expect(designFitsBrief(tier, weak.id)).toBe(false);
      }
    }
    const truck = tierById("bridge-04");
    expect(resultPlate(truck, "oak")).toBe("held 600 kg, 375 kg needed per beam, 400 kg capacity");
    expect(failureLine(truck, "pine")).toContain("375");
    expect(designFitsBrief(truck, "iron")).toBe(false);
  });

  it("never records a hinted answer as independent", () => {
    expect(qualityFor(true, 0)).toBe("independent");
    expect(qualityFor(true, 1)).toBe("assisted");
    expect(qualityFor(true, 3)).toBe("corrected");
    expect(qualityFor(false, 0)).toBeNull();
    expect(hintCard(1)?.text).toContain("both ends");
    expect(hintCard(2)?.text).toContain("bearing, gap, bearing");
    expect(hintCard(3)?.text).toContain("6 + 0.5 + 0.5 = 7");
    expect(shouldPause(3)).toBe(false);
    expect(shouldPause(4)).toBe(true);
    const results = makeResults(true, [{ itemId: "m1", quality: "assisted" }], true);
    expect(results.designWorked).toBe(true);
    expect(results.mathUse).toBe("assisted");
    expect(results.explained).toBe(true);
    expect(mathUse([{ itemId: "m1", quality: "assisted" }])).not.toBe("independent");
  });

  it("stores the three results apart from mastery", () => {
    const track: SkillTrack = { conceptual: true, procedural: true, fluent: null, transfer: false, retention: false, };
    expect(trackState(track, "mechanism")).toBe("practiced");
    expect(afterBridge(track)).toEqual(track);
    expect(STEPS).toEqual(["Learn", "Prove", "Invest", "Build", "Test", "Reflect"]);
    expect(METERS_SET.map((item) => item.answer)).toEqual([9, 17, 8.5, 10.5, 2.7, 1]);
    expect(BLOCKS_SET).toHaveLength(6);
    expect(MECHANISM_SET).toHaveLength(6);
    expect(allowance([])).toBe(24);
  });

  it("round-trips a codex page and its handwriting", () => {
    const page: CodexPage = {
      id: "page-1",
      title: "Get the truck across",
      image: "data:image/png;base64,build",
      handwriting: "data:image/png;base64,hand",
      gap: 12,
      bearing: 1,
      loadKg: 600,
      budget: 24,
      beamLength: 14,
      materials: ["oak", "oak"],
      alternatives: ["pine", "iron"],
      changes: ["Pine was 200 kg. Oak is 400 kg."],
      results: { designWorked: true, mathUse: "assisted", explained: true },
      reflection: "Both banks count.",
      next: "Project 05",
      disclaimer: DISCLAIMER,
    };
    const progress: SavedProgress = {
      map: createLearnerMap(skills),
      toppedOut: [],
      placement: null,
      history: [],
      age: null,
      ageAsked: false,
      bridgeCompleted: [],
      bridgeEarned: {},
      workshop: blankWorkshop(),
      sequence: { narration: true, completedTiers: ["bridge-04"], marks: 24, codex: [page] },
    };
    const loaded = importProgress(exportProgress(progress), skills);
    expect(loaded.sequence?.codex[0]?.handwriting).toBe(page.handwriting);
    expect(loaded.sequence?.codex[0]?.image).toBe(page.image);
    expect(loaded.sequence?.codex[0]?.results.mathUse).toBe("assisted");
    expect(loaded.sequence?.codex[0]?.results.designWorked).toBe(true);
    expect(loaded.sequence?.codex[0]?.results.explained).toBe(true);
  });

  it("chooses a representation from skills and leaves a single miss unresolved", () => {
    const map = createLearnerMap(skills);
    expect(representationFor(map)).toBe("blocks");
    map["centimeters-in-meters"] = { level: 1, state: "learning" };
    expect(representationFor(map)).toBe("meters");
    map["one-step-equation"] = { level: 1, state: "learning" };
    expect(representationFor(map)).toBe("mechanism");
    expect(placementConclusion(noteAttempt(emptyNotes(), false, false, false))).toBeNull();
    expect(shareReady(createLearnerMap(skills))).toBe(false);
    expect(tierOpen(tierById("bridge-05"), createLearnerMap(skills), [])).toBe(false);
    expect(tierOpen(tierById("bridge-04"), createLearnerMap(skills), [])).toBe(true);
    expect(discoveryScript("meters", tierById("bridge-04"))[1]?.body).toContain("12 + 1 + 1 = 14");
    const build = { beamSpec: 14, deck: true, braces: 0, materials: ["oak"] };
    expect(sameBuild(build, { ...build })).toBe(true);
  });
});
