import { skillsMet, type SkillNeed } from "../curriculum/mastery";
import type { LearnerMap } from "../engine/placement";
import { bridgeModel } from "../machines/bridge/model";

export const STEPS = ["Learn", "Prove", "Invest", "Build", "Test", "Reflect"] as const;
export type StepName = (typeof STEPS)[number];

export const DISCLAIMER = "These are educational models, not proof a real structure is safe.";

export const LEARN_MARKS = 12;
export const PROVE_MARKS = 12;

export type Representation = "blocks" | "meters" | "mechanism";
export type AnswerQuality = "independent" | "assisted" | "corrected";

export type Material = {
  id: string;
  name: string;
  capacityKg: number;
  marks: number;
};

export type BridgeTier = {
  id: string;
  project: number;
  title: string;
  gap: number;
  bearing: number;
  unit: "m" | "blocks";
  loadKg: number;
  beams: number;
  budget: number;
  reserve: number;
  ramp: boolean;
  skills: SkillNeed[];
  materials: Material[];
  passId: string;
};

export type SceneFrame = {
  beamStart: number;
  gapStart: number;
  gapEnd: number;
  beamEnd: number;
  beamY: number;
};

/** One coordinate frame for every representation. The picture changes. The numbers do not. */
export function sceneFrame(gap: number, bearing: number): SceneFrame {
  const unitPx = 22;
  const span = (gap + 2 * bearing) * unitPx;
  const origin = Math.max(48, (900 - span) / 2);
  const beamStart = origin;
  const gapStart = origin + bearing * unitPx;
  const gapEnd = gapStart + gap * unitPx;
  const beamEnd = gapEnd + bearing * unitPx;
  return { beamStart, gapStart, gapEnd, beamEnd, beamY: 196 };
}

export const blocksFrame = sceneFrame;
export const metersFrame = sceneFrame;
export const mechanismFrame = sceneFrame;

export function beamLength(gap: number, bearing: number): number {
  return Math.round((gap + 2 * bearing) * 1000) / 1000;
}

export function neededKg(tier: BridgeTier): number {
  return (tier.loadKg / tier.beams) * (1 + tier.reserve);
}

export function materialOf(tier: BridgeTier, id: string): Material {
  const found = tier.materials.find((item) => item.id === id);
  if (!found) {
    throw new Error(`Unknown material ${id}`);
  }
  return found;
}

export function designCost(tier: BridgeTier, materialId: string): number {
  return materialOf(tier, materialId).marks * tier.beams;
}

/** The passing material fits the brief. Marks are not part of the check. */
export function designFitsBrief(tier: BridgeTier, materialId: string = tier.passId): boolean {
  const material = materialOf(tier, materialId);
  const affordable = tier.budget === 0 || designCost(tier, materialId) <= tier.budget;
  return affordable && material.capacityKg + 0.001 >= neededKg(tier);
}

export function tierOpen(tier: BridgeTier, map: LearnerMap, completed: readonly string[]): boolean {
  if (tier.project === 1) {
    return skillsMet(tier.skills, map);
  }
  const previous = TIERS.find((item) => item.project === tier.project - 1);
  if (previous && completed.includes(previous.id)) {
    return true;
  }
  return skillsMet(tier.skills, map);
}

export function representationFor(map: LearnerMap): Representation {
  const measure = map["centimeters-in-meters"]?.level ?? 0;
  const algebra = map["one-step-equation"]?.level ?? 0;
  if (algebra >= 1 || measure >= 3) {
    return "mechanism";
  }
  if (measure >= 1 || (map["gap-between-marks"]?.level ?? 0) >= 2) {
    return "meters";
  }
  return "blocks";
}

function tier(
  project: number,
  title: string,
  gap: number,
  bearing: number,
  unit: "m" | "blocks",
  loadKg: number,
  beams: number,
  budget: number,
  pass: Material,
  weaker: Material,
  heavier: Material,
  skills: SkillNeed[],
  ramp = false,
): BridgeTier {
  return {
    id: `bridge-${String(project).padStart(2, "0")}`,
    project,
    title,
    gap,
    bearing,
    unit,
    loadKg,
    beams,
    budget,
    reserve: 0.25,
    ramp,
    skills,
    materials: [weaker, pass, heavier],
    passId: pass.id,
  };
}

const pine = (capacity: number, marks: number): Material => ({ id: "pine", name: "Pine", capacityKg: capacity, marks });
const oak = (capacity: number, marks: number): Material => ({ id: "oak", name: "Oak", capacityKg: capacity, marks });
const iron = (capacity: number, marks: number): Material => ({ id: "iron", name: "Iron", capacityKg: capacity, marks });

export const TIERS: BridgeTier[] = [
  tier(1, "A small cart", 4, 1, "blocks", 40, 1, 8, oak(80, 4), pine(20, 2), iron(200, 10), [
    { skillId: "gap-between-marks", level: 0 },
  ]),
  tier(2, "Two blocks of bearing", 6, 1, "blocks", 80, 1, 10, oak(120, 5), pine(40, 3), iron(240, 12), [
    { skillId: "gap-between-marks", level: 1 },
  ]),
  tier(3, "A meter on each bank", 8, 1, "m", 200, 2, 16, oak(150, 6), pine(60, 4), iron(400, 14), [
    { skillId: "gap-between-marks", level: 1 },
  ]),
  tier(4, "Get the truck across", 12, 1, "m", 600, 2, 24, oak(400, 10), pine(200, 6), iron(900, 18), [
    { skillId: "gap-between-marks", level: 0 },
  ]),
  tier(5, "A deeper crossing", 10, 1, "m", 800, 2, 24, oak(500, 10), pine(250, 6), iron(1000, 18), [
    { skillId: "centimeters-in-meters", level: 1 },
  ]),
  tier(6, "Half-meter bearings", 9, 0.5, "m", 500, 2, 20, oak(400, 8), pine(180, 5), iron(900, 16), [
    { skillId: "half-a-length", level: 1 },
  ]),
  tier(7, "Share a heavier truck", 14, 1, "m", 1000, 2, 28, oak(700, 12), pine(300, 7), iron(1400, 20), [
    { skillId: "ratio-shares", level: 1 },
  ]),
  tier(8, "A high bank", 8, 1, "m", 400, 2, 20, oak(300, 8), pine(120, 5), iron(800, 16), [
    { skillId: "gap-between-marks", level: 1 },
  ], true),
  tier(9, "Three beams", 12, 1, "m", 900, 3, 24, oak(400, 6), pine(200, 4), iron(900, 12), [
    { skillId: "ratio-shares", level: 1 },
  ]),
  tier(10, "A long gap", 16, 1, "m", 700, 2, 24, oak(500, 10), pine(200, 6), iron(1100, 18), [
    { skillId: "centimeters-in-meters", level: 2 },
  ]),
  tier(11, "Centimeter bearings", 6, 0.2, "m", 300, 2, 16, oak(250, 6), pine(80, 4), iron(600, 14), [
    { skillId: "centimeters-in-meters", level: 2 },
  ]),
  tier(12, "A reserve check", 11, 1, "m", 880, 2, 24, oak(600, 10), pine(300, 6), iron(1200, 18), [
    { skillId: "one-step-equation", level: 1 },
  ]),
  tier(13, "Your own span", 15, 1, "m", 1200, 2, 28, oak(800, 12), pine(400, 8), iron(1600, 20), [
    { skillId: "one-step-equation", level: 1 },
  ]),
];

export function tierById(id: string): BridgeTier {
  const found = TIERS.find((item) => item.id === id);
  if (!found) {
    throw new Error(`Unknown tier ${id}`);
  }
  return found;
}

export function modelNumbers(tier: BridgeTier): Record<string, number> {
  return {
    ask: 1,
    gap: tier.gap,
    bearing: tier.bearing,
    load: tier.loadKg,
    unit: tier.unit === "m" ? 1 : 0,
    stiffness: 0,
    depth: 0,
    stick: 0,
    sagCap: 0,
    stressLimit: 0,
  };
}

export function lengthReport(tier: BridgeTier, spec: number) {
  return bridgeModel.evaluate([{ id: "beam", kind: "beam", spec, slot: "main" }], modelNumbers(tier));
}

export function shortfallText(tier: BridgeTier, spec: number): string {
  const report = lengthReport(tier, spec);
  const reached = report.numbers.find((item) => item.label === "Length that reaches");
  const needed = beamLength(tier.gap, tier.bearing);
  const short = Math.round((needed - spec) * 1000) / 1000;
  const unit = tier.unit === "m" ? "m" : "blocks";
  if (report.ok) {
    return `The beam reaches. ${reached?.value ?? needed} is enough.`;
  }
  return `${short} ${unit} short across both banks.`;
}

export type PracticeItem = {
  id: string;
  prompt: string;
  answer: number;
  accept?: string;
  sceneGap: number | null;
  sceneBearing: number | null;
  kind: "compute" | "transfer" | "explain";
};

export const METERS_SET: PracticeItem[] = [
  { id: "m1", prompt: "The gap is 8 m. The beam rests 0.5 m on each bank. How long is the beam?", answer: 9, sceneGap: 8, sceneBearing: 0.5, kind: "compute" },
  { id: "m2", prompt: "The gap is 15 m. The beam rests 1 m on each bank. How long is the beam?", answer: 17, sceneGap: 15, sceneBearing: 1, kind: "compute" },
  { id: "m3", prompt: "The gap is 7.5 m. The beam rests 0.5 m on each bank. How long is the beam?", answer: 8.5, sceneGap: 7.5, sceneBearing: 0.5, kind: "compute" },
  { id: "m4", prompt: "The gap is 9 m. The beam rests 75 cm on each bank. How long is the beam, in meters?", answer: 10.5, sceneGap: 9, sceneBearing: 0.75, kind: "compute" },
  { id: "m5", prompt: "A shelf spans 2.4 m and rests 0.15 m on each support. How long is the shelf?", answer: 2.7, sceneGap: null, sceneBearing: null, kind: "transfer" },
  { id: "m6", prompt: "A 12 m beam is centered over a 10 m gap. How much bearing is on each side, in meters?", answer: 1, sceneGap: 10, sceneBearing: 1, kind: "explain" },
];

export const BLOCKS_SET: PracticeItem[] = [
  { id: "b1", prompt: "The gap is 8 blocks. The beam rests 1 block on each bank. How many blocks long is the beam?", answer: 10, sceneGap: 8, sceneBearing: 1, kind: "compute" },
  { id: "b2", prompt: "The gap is 15 blocks. The beam rests 1 block on each bank. How many blocks long is the beam?", answer: 17, sceneGap: 15, sceneBearing: 1, kind: "compute" },
  { id: "b3", prompt: "The gap is 6 blocks. The beam rests 1 block on each bank. How many blocks long is the beam?", answer: 8, sceneGap: 6, sceneBearing: 1, kind: "compute" },
  { id: "b4", prompt: "The gap is 9 blocks. The beam rests 1 block on each bank. How many blocks long is the beam?", answer: 11, sceneGap: 9, sceneBearing: 1, kind: "compute" },
  { id: "b5", prompt: "A shelf spans 8 blocks and rests 1 block on each support. How many blocks long is the shelf?", answer: 10, sceneGap: null, sceneBearing: null, kind: "transfer" },
  { id: "b6", prompt: "A 12 block beam is centered over a 10 block gap. How many blocks of bearing are on each side?", answer: 1, sceneGap: 10, sceneBearing: 1, kind: "explain" },
];

export const MECHANISM_SET: PracticeItem[] = [
  { id: "g1", prompt: "The unsupported span is 8 m. Each bearing is 0.5 m. What is the minimum length?", answer: 9, sceneGap: 8, sceneBearing: 0.5, kind: "compute" },
  { id: "g2", prompt: "The unsupported span is 15 m. Each bearing is 1 m. What is the minimum length?", answer: 17, sceneGap: 15, sceneBearing: 1, kind: "compute" },
  { id: "g3", prompt: "The unsupported span is 7.5 m. Each bearing is 0.5 m. What is the minimum length?", answer: 8.5, sceneGap: 7.5, sceneBearing: 0.5, kind: "compute" },
  { id: "g4", prompt: "A 13 m beam is centered on a 12 m span. How much bearing remains on each side, in meters?", answer: 0.5, sceneGap: 12, sceneBearing: 0.5, kind: "compute" },
  { id: "g5", prompt: "A shelf spans 2.4 m and needs 0.15 m of support at each end. What length do you cut?", answer: 2.7, sceneGap: null, sceneBearing: null, kind: "transfer" },
  { id: "g6", prompt: "You shortened the beam to 13 m on a 12 m span. The bearing is 0.5 m each side. Stability still depends on the load. Enter 0.5 if the bearing is half a meter.", answer: 0.5, sceneGap: 12, sceneBearing: 0.5, kind: "explain" },
];

export function practiceSet(representation: Representation): PracticeItem[] {
  if (representation === "blocks") {
    return BLOCKS_SET;
  }
  if (representation === "mechanism") {
    return MECHANISM_SET;
  }
  return METERS_SET;
}

export const SIMPLER_ITEM: PracticeItem = {
  id: "simpler",
  prompt: "A smaller gap is 6 m. The beam rests 0.5 m on each bank. How long is the beam?",
  answer: 7,
  sceneGap: 6,
  sceneBearing: 0.5,
  kind: "compute",
};

export type HintCard = { step: "nudge" | "method" | "example"; text: string };

export function hintCard(misses: number): HintCard | null {
  if (misses <= 0) {
    return null;
  }
  if (misses === 1) {
    return { step: "nudge", text: "Look at both ends of the beam. Where does it need to rest?" };
  }
  if (misses === 2) {
    return { step: "method", text: "Three segments sit under the beam: bearing, gap, bearing." };
  }
  return { step: "example", text: "A different gap: 6 + 0.5 + 0.5 = 7. Your gap is still the one on the page." };
}

export function numbersMatch(given: number, answer: number): boolean {
  return Number.isFinite(given) && Math.abs(given - answer) < 0.001;
}

/** A hinted answer is assisted or corrected, never independent. */
export function qualityFor(correct: boolean, hintsUsed: number): AnswerQuality | null {
  if (!correct) {
    return null;
  }
  if (hintsUsed <= 0) {
    return "independent";
  }
  if (hintsUsed >= 3) {
    return "corrected";
  }
  return "assisted";
}

export function shouldPause(misses: number): boolean {
  return misses >= 4;
}

export type Attempt = { itemId: string; quality: AnswerQuality };

export function mathUse(attempts: readonly Attempt[]): AnswerQuality {
  if (attempts.some((item) => item.quality === "corrected")) {
    return "corrected";
  }
  if (attempts.some((item) => item.quality === "assisted")) {
    return "assisted";
  }
  return "independent";
}

export function allowance(attempts: readonly Attempt[]): number {
  const bonus = Math.min(4, attempts.filter((item) => item.quality === "independent").length);
  return LEARN_MARKS + PROVE_MARKS + bonus;
}

export type ThreeResults = {
  designWorked: boolean;
  mathUse: AnswerQuality;
  explained: boolean;
};

export function makeResults(designWorked: boolean, attempts: readonly Attempt[], explained: boolean): ThreeResults {
  return { designWorked, mathUse: mathUse(attempts), explained };
}

export function resultPlate(tier: BridgeTier, materialId: string): string {
  const material = materialOf(tier, materialId);
  const needed = Math.round(neededKg(tier));
  return `held ${tier.loadKg} kg, ${needed} kg needed per beam, ${material.capacityKg} kg capacity`;
}

export function failureLine(tier: BridgeTier, materialId: string): string {
  const material = materialOf(tier, materialId);
  const needed = Math.round(neededKg(tier));
  return `${material.name} carries ${material.capacityKg} kg on a beam. This beam needs ${needed} kg.`;
}

export type NotebookEntry = { id: string; title: string; body: string };

export function discoveryScript(representation: Representation, tier: BridgeTier): NotebookEntry[] {
  const length = beamLength(tier.gap, tier.bearing);
  const unit = tier.unit === "m" ? "m" : "blocks";
  if (representation === "blocks") {
    return [
      { id: "see", title: "The gap", body: `The river is ${tier.gap} blocks wide. The beam needs to rest on this bank and that bank too.` },
      { id: "count", title: "Count the blocks", body: `Twelve, thirteen, fourteen. We need ${length}.` },
      { id: "try", title: "Now you try", body: "The next gap is a different width. Count the banks as well as the water." },
    ];
  }
  if (representation === "mechanism") {
    return [
      { id: "span", title: "Span and bearing", body: "The unsupported span is the water. The two bearings are the parts that sit on the banks." },
      { id: "shift", title: "Too little overlap", body: "A beam with too little overlap shifts toward an edge. A correct one sits, and the banks push back." },
      {
        id: "min",
        title: "Minimum length",
        body: `L_min = span + b_left + b_right. The minimum length is ${length} ${unit}. Whether it stays stable under load is a separate question.`,
      },
    ];
  }
  return [
    { id: "lines", title: "Both banks", body: `The gap is ${tier.gap} ${unit}. Each bearing is ${tier.bearing} ${unit}. We add the bearing on both sides, not just one.` },
    { id: "join", title: "One measurement", body: `L = ${tier.gap} + ${tier.bearing} + ${tier.bearing} = ${length} ${unit}.` },
    { id: "try", title: "Now you try", body: "A new gap uses the same addition. The worked example stays in the notebook." },
  ];
}

export type TrackState = "familiar" | "practiced" | "transferred" | "mastered";

export type SkillTrack = {
  conceptual: boolean;
  procedural: boolean;
  fluent: boolean | null;
  transfer: boolean;
  retention: boolean;
};

export function fluencyRequired(representation: Representation): boolean {
  return representation !== "mechanism";
}

export function trackState(track: SkillTrack, representation: Representation): TrackState {
  if (!track.conceptual) {
    return "familiar";
  }
  const fluentEnough = !fluencyRequired(representation) || track.fluent === true;
  if (track.transfer && track.retention && track.procedural && fluentEnough) {
    return "mastered";
  }
  if (track.transfer && track.procedural) {
    return "transferred";
  }
  if (track.procedural) {
    return "practiced";
  }
  return "familiar";
}

/** Finishing a bridge records the design. It does not move a skill track. */
export function afterBridge(track: SkillTrack): SkillTrack {
  return { ...track };
}

export type PlacementNotes = {
  successes: number;
  bearingIncluded: number;
  hints: number;
  wrongAnswers: number;
};

export function emptyNotes(): PlacementNotes {
  return { successes: 0, bearingIncluded: 0, hints: 0, wrongAnswers: 0 };
}

export function noteAttempt(notes: PlacementNotes, correct: boolean, usedBearing: boolean, hinted: boolean): PlacementNotes {
  return {
    successes: notes.successes + (correct ? 1 : 0),
    bearingIncluded: notes.bearingIncluded + (correct && usedBearing ? 1 : 0),
    hints: notes.hints + (hinted ? 1 : 0),
    wrongAnswers: notes.wrongAnswers + (correct ? 0 : 1),
  };
}

/** One wrong answer never produces a placement result. */
export function placementConclusion(notes: PlacementNotes): { skillId: string; level: number } | null {
  if (notes.successes < 1 || notes.bearingIncluded < 1) {
    return null;
  }
  if (notes.wrongAnswers > 0 && notes.successes < 2) {
    return null;
  }
  return { skillId: "gap-between-marks", level: 1 };
}

export type CodexPage = {
  id: string;
  title: string;
  image: string;
  handwriting: string;
  gap: number;
  bearing: number;
  loadKg: number;
  budget: number;
  beamLength: number;
  materials: string[];
  alternatives: string[];
  changes: string[];
  results: ThreeResults;
  reflection: string;
  next: string;
  disclaimer: string;
};

export type SequenceSave = {
  narration: boolean;
  completedTiers: string[];
  marks: number;
  codex: CodexPage[];
};

export function blankSequence(): SequenceSave {
  return { narration: true, completedTiers: [], marks: 0, codex: [] };
}

export function shareReady(map: LearnerMap): boolean {
  return (map["ratio-shares"]?.level ?? 0) >= 1;
}

export type BuildSnapshot = {
  beamSpec: number | null;
  deck: boolean;
  braces: number;
  materials: string[];
};

export function sameBuild(left: BuildSnapshot, right: BuildSnapshot): boolean {
  return (
    left.beamSpec === right.beamSpec &&
    left.deck === right.deck &&
    left.braces === right.braces &&
    left.materials.join() === right.materials.join()
  );
}
