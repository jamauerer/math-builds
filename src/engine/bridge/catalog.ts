import scenarioFile from "../../data/bridge/scenarios.json";
import type { Problem, Skill } from "../types";
import type { LearnerMap } from "../placement";

export type BuildMode = "pick" | "calculate" | "free";

export type PartRole = "beam" | "support";

export type Unlock = {
  skillId: string;
  level: number;
};

export type BridgePart = {
  id: string;
  name: string;
  role: PartRole;
  length: number;
  strength: number;
  unlock: Unlock;
};

export type Scenario = {
  id: string;
  mode: BuildMode;
  title: string;
  gap: number;
  gapUnit: string;
  truck: number;
  truckUnit: string;
  margin: number;
  cell: number;
  parts: BridgePart[];
};

export type DesignBeam = {
  id: string;
  name: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  strengthKg: number;
};

export type DesignSupport = {
  id: string;
  x: number;
  strengthKg: number;
};

export type BridgeDesign = {
  gap: number;
  truckKg: number;
  beams: DesignBeam[];
  supports: DesignSupport[];
};

export type ReferenceDesigns = {
  correct: BridgeDesign;
  weak: BridgeDesign;
  margin: BridgeDesign;
};

const MODES: BuildMode[] = ["pick", "calculate", "free"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parsePart(raw: unknown, source: string): BridgePart {
  if (!isRecord(raw)) {
    throw new Error(`${source} is not a part`);
  }
  const unlock = raw.unlock;
  if (!isRecord(unlock) || typeof unlock.skillId !== "string" || typeof unlock.level !== "number") {
    throw new Error(`${source} is missing an unlock`);
  }
  if (raw.role !== "beam" && raw.role !== "support") {
    throw new Error(`${source} has a bad role`);
  }
  if (typeof raw.id !== "string" || typeof raw.name !== "string") {
    throw new Error(`${source} is missing a name`);
  }
  if (typeof raw.length !== "number" || typeof raw.strength !== "number") {
    throw new Error(`${source} is missing length or strength`);
  }
  return {
    id: raw.id,
    name: raw.name,
    role: raw.role,
    length: raw.length,
    strength: raw.strength,
    unlock: { skillId: unlock.skillId, level: unlock.level },
  };
}

function parseScenario(raw: unknown, index: number): Scenario {
  const source = `scenario ${index + 1}`;
  if (!isRecord(raw)) {
    throw new Error(`${source} is not an object`);
  }
  if (typeof raw.id !== "string" || typeof raw.title !== "string") {
    throw new Error(`${source} is missing an id`);
  }
  if (!MODES.includes(raw.mode as BuildMode)) {
    throw new Error(`${source} has a bad mode`);
  }
  if (typeof raw.gap !== "number" || typeof raw.truck !== "number" || typeof raw.margin !== "number") {
    throw new Error(`${source} is missing gap, truck, or margin`);
  }
  if (!Array.isArray(raw.parts) || raw.parts.length === 0) {
    throw new Error(`${source} needs parts`);
  }
  return {
    id: raw.id,
    mode: raw.mode as BuildMode,
    title: raw.title,
    gap: raw.gap,
    gapUnit: typeof raw.gapUnit === "string" ? raw.gapUnit : "",
    truck: raw.truck,
    truckUnit: typeof raw.truckUnit === "string" ? raw.truckUnit : "",
    margin: raw.margin,
    cell: typeof raw.cell === "number" ? raw.cell : 1,
    parts: raw.parts.map((part, partIndex) => parsePart(part, `${source} part ${partIndex + 1}`)),
  };
}

function loadScenarios(): Scenario[] {
  const root = scenarioFile as { scenarios?: unknown };
  if (!Array.isArray(root.scenarios)) {
    throw new Error("Bridge scenarios file is missing a list");
  }
  return root.scenarios.map((entry, index) => parseScenario(entry, index));
}

export const scenarios: Scenario[] = loadScenarios();

export function modeForAge(age: number): BuildMode {
  if (age <= 8) {
    return "pick";
  }
  if (age <= 12) {
    return "calculate";
  }
  return "free";
}

export function scenarioForMode(mode: BuildMode): Scenario {
  const scenario = scenarios.find((item) => item.mode === mode);
  if (!scenario) {
    throw new Error(`No scenario for ${mode}`);
  }
  return scenario;
}

export function scenarioById(id: string): Scenario | null {
  return scenarios.find((item) => item.id === id) ?? null;
}

export function partUnlocked(part: BridgePart, map: LearnerMap): boolean {
  if (part.unlock.level <= 0) {
    return true;
  }
  const entry = map[part.unlock.skillId];
  if (!entry || entry.state === "unchecked") {
    return false;
  }
  return entry.level >= part.unlock.level;
}

export function unlockSkillName(part: BridgePart, skills: readonly Skill[]): string {
  return skills.find((skill) => skill.id === part.unlock.skillId)?.name ?? part.unlock.skillId;
}

export function gapLabel(scenario: Scenario): string {
  return scenario.gapUnit ? `${scenario.gap} ${scenario.gapUnit}` : String(scenario.gap);
}

export function truckLabel(scenario: Scenario): string {
  return scenario.truckUnit ? `${scenario.truck} ${scenario.truckUnit}` : String(scenario.truck);
}

export function strengthLabel(strength: number, scenario: Scenario): string {
  return scenario.truckUnit ? `${strength} ${scenario.truckUnit}` : String(strength);
}

function partById(scenario: Scenario, id: string): BridgePart {
  const part = scenario.parts.find((item) => item.id === id);
  if (!part) {
    throw new Error(`Missing part ${id}`);
  }
  return part;
}

function deckFromParts(scenario: Scenario, ids: string[]): BridgeDesign {
  const beams: DesignBeam[] = [];
  let cursor = 0;
  ids.forEach((id, index) => {
    const part = partById(scenario, id);
    beams.push({
      id: `${id}-${index}`,
      name: part.name,
      x0: cursor,
      y0: 0,
      x1: cursor + part.length,
      y1: 0,
      strengthKg: part.strength,
    });
    cursor += part.length;
  });
  return { gap: scenario.gap, truckKg: scenario.truck, beams, supports: [] };
}

function spannedBeams(scenario: Scenario, part: BridgePart, count: number, strengthKg: number): DesignBeam[] {
  const length = scenario.gap / count;
  const beams: DesignBeam[] = [];
  for (let index = 0; index < count; index += 1) {
    const x0 = index * length;
    beams.push({
      id: `${part.id}-${index}`,
      name: part.name,
      x0,
      y0: 0,
      x1: x0 + length,
      y1: 0,
      strengthKg,
    });
  }
  return beams;
}

function supportsAt(scenario: Scenario, part: BridgePart, count: number): DesignSupport[] {
  const supports: DesignSupport[] = [];
  for (let index = 0; index < count; index += 1) {
    supports.push({
      id: `${part.id}-${index}`,
      x: (scenario.gap * (index + 1)) / (count + 1),
      strengthKg: part.strength,
    });
  }
  return supports;
}

function point(scenario: Scenario, col: number, row: number) {
  return { x: col * scenario.cell, y: row * scenario.cell };
}

function member(
  part: BridgePart,
  index: number,
  from: { x: number; y: number },
  to: { x: number; y: number },
  strengthKg: number,
): DesignBeam {
  return {
    id: `${part.id}-${index}`,
    name: part.name,
    x0: from.x,
    y0: from.y,
    x1: to.x,
    y1: to.y,
    strengthKg,
  };
}

function truss(scenario: Scenario, part: BridgePart, strengthKg: number, diagonals: boolean): BridgeDesign {
  const left = point(scenario, 0, 0);
  const midLeft = point(scenario, 1, 0);
  const midRight = point(scenario, 2, 0);
  const right = point(scenario, 3, 0);
  const upLeft = point(scenario, 1, 1);
  const upRight = point(scenario, 2, 1);
  const pairs = [
    [left, midLeft],
    [midLeft, midRight],
    [midRight, right],
    [midLeft, upLeft],
    [upLeft, upRight],
    [upRight, midRight],
  ];
  if (diagonals) {
    pairs.push([left, upLeft], [upLeft, midRight], [midLeft, upRight], [upRight, right]);
  }
  return {
    gap: scenario.gap,
    truckKg: scenario.truck,
    beams: pairs.map((pair, index) => member(part, index, pair[0], pair[1], strengthKg)),
    supports: [],
  };
}

export function designFromPieceIds(scenario: Scenario, ids: string[]): BridgeDesign {
  return deckFromParts(scenario, ids);
}

export function designFromCounts(scenario: Scenario, beamCount: number, supportCount: number): BridgeDesign {
  const beam = scenario.parts.find((part) => part.role === "beam" && part.length > 0);
  const support = scenario.parts.find((part) => part.role === "support");
  if (!beam || !support || beamCount < 1) {
    return {
      gap: scenario.gap,
      truckKg: scenario.truck,
      beams: [],
      supports: support && supportCount > 0 ? supportsAt(scenario, support, supportCount) : [],
    };
  }
  return {
    gap: scenario.gap,
    truckKg: scenario.truck,
    beams: spannedBeams(scenario, beam, beamCount, beam.strength),
    supports: supportCount > 0 ? supportsAt(scenario, support, supportCount) : [],
  };
}

export function designFromSegments(
  scenario: Scenario,
  part: BridgePart,
  segments: { col0: number; row0: number; col1: number; row1: number }[],
): BridgeDesign {
  return {
    gap: scenario.gap,
    truckKg: scenario.truck,
    supports: [],
    beams: segments.map((segment, index) =>
      member(
        part,
        index,
        point(scenario, segment.col0, segment.row0),
        point(scenario, segment.col1, segment.row1),
        part.strength,
      ),
    ),
  };
}

export function referenceDesigns(scenario: Scenario): ReferenceDesigns {
  if (scenario.mode === "pick") {
    return {
      correct: deckFromParts(scenario, ["plank-3", "plank-3"]),
      weak: deckFromParts(scenario, ["plank-2", "plank-2", "plank-2"]),
      margin: {
        gap: scenario.gap,
        truckKg: scenario.truck,
        supports: [],
        beams: [0, 1].map((index) => ({
          id: `margin-${index}`,
          name: "3-block plank",
          x0: index * 3,
          y0: 0,
          x1: index * 3 + 3,
          y1: 0,
          strengthKg: (scenario.truck + scenario.margin) / 2,
        })),
      },
    };
  }
  if (scenario.mode === "calculate") {
    const beam = partById(scenario, "beam-3");
    const support = partById(scenario, "support-400");
    const beamCount = scenario.gap / beam.length;
    const supportCount = Math.ceil(scenario.truck / support.strength);
    return {
      correct: {
        gap: scenario.gap,
        truckKg: scenario.truck,
        beams: spannedBeams(scenario, beam, beamCount, beam.strength),
        supports: supportsAt(scenario, support, supportCount),
      },
      weak: {
        gap: scenario.gap,
        truckKg: scenario.truck,
        beams: spannedBeams(scenario, beam, beamCount, beam.strength),
        supports: supportsAt(scenario, support, supportCount - 1),
      },
      margin: {
        gap: scenario.gap,
        truckKg: scenario.truck,
        beams: spannedBeams(scenario, beam, beamCount, beam.strength + scenario.margin / beamCount),
        supports: supportsAt(scenario, support, supportCount),
      },
    };
  }
  const beam = partById(scenario, "truss-beam");
  return {
    correct: truss(scenario, beam, beam.strength, true),
    weak: truss(scenario, beam, beam.strength, false),
    margin: truss(scenario, beam, beam.strength + scenario.margin, true),
  };
}

export function workProblems(scenario: Scenario): Problem[] {
  const beam = scenario.parts.find((part) => part.role === "beam" && part.length > 0);
  const support = scenario.parts.find((part) => part.role === "support");
  if (!beam || !support) {
    return [];
  }
  const beams = scenario.gap / beam.length;
  const supports = Math.ceil(scenario.truck / support.strength);
  const capacity = beams * beam.strength;
  return [
    {
      prompt: `The gap is ${scenario.gap} meters. Each beam is ${beam.length} meters. How many beams?`,
      answer: String(beams),
    },
    {
      prompt: `The truck is ${scenario.truck} kilograms. Each support holds ${support.strength} kilograms. How many supports?`,
      answer: String(supports),
    },
    {
      prompt: `${beams} beams hold ${beam.strength} kilograms each. How many kilograms can they hold?`,
      answer: String(capacity),
      visual: { kind: "stacked", layout: "vertical", operator: "x", top: beams, bottom: beam.strength },
    },
  ];
}

export function beamLengthMeters(beam: DesignBeam): number {
  return Math.hypot(beam.x1 - beam.x0, beam.y1 - beam.y0);
}

export function beamAngleDegrees(beam: DesignBeam): number {
  const degrees = (Math.atan2(beam.y1 - beam.y0, beam.x1 - beam.x0) * 180) / Math.PI;
  return Math.round(degrees * 10) / 10;
}

export function loadEstimateKg(design: BridgeDesign): number {
  const deck = design.beams.filter((beam) => beam.y0 === 0 && beam.y1 === 0).length;
  return Math.round(design.truckKg / Math.max(1, deck));
}

export const BRIDGE_INSTRUCTION = "Get the truck across the gap.";
