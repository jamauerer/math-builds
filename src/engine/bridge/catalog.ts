import levelFile from "../../data/bridge/candy-levels.json";
import type { Problem, Skill } from "../types";
import { answersMatch } from "../answers";
import { generateProblem } from "../generate";
import { recordLevelPass, type LearnerMap } from "../placement";
import { createRng } from "../rng";
import type { BlockBridge, BlockPiece } from "./simulate";

export type WorldId = "candy" | "wood" | "steel";
export type MeasureKind = "count" | "ruler";
export type PartRole = "deck" | "pillar" | "ramp";

export type Unlock = { skillId: string; level: number };

export type BridgePart = {
  id: string;
  name: string;
  role: PartRole;
  strength: number;
  unlock: Unlock;
};

export type LevelQuestion = {
  prompt: string;
  answer: string;
  hint: string;
  partId: string;
  count: number;
  visual?: Problem["visual"];
};

export type Requirement = { skillId: string; level: number };

export type BuildMode = "count" | "calculate" | "free";

export type BuildModeInfo = {
  id: BuildMode;
  label: string;
  requires: Requirement[];
};

export type WorldInfo = {
  id: WorldId;
  name: string;
  ability: string;
  blurb: string;
  requires: Requirement[];
};

export type CandyLevel = {
  id: string;
  world: WorldId;
  number: number;
  title: string;
  playable: boolean;
  measure: MeasureKind;
  gapBlocks: number;
  blockMeters: number;
  carWeight: number;
  rulerLeft: number;
  rulerRight: number;
  questions: LevelQuestion[];
  requires: Requirement[];
};

const WORLD_IDS: WorldId[] = ["candy", "wood", "steel"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseRequirementList(raw: unknown, source: string): Requirement[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.map((item, index) => {
    if (!isRecord(item) || typeof item.skillId !== "string" || typeof item.level !== "number") {
      throw new Error(`${source} requirement ${index + 1} is incomplete`);
    }
    return { skillId: item.skillId, level: item.level };
  });
}

function parseUnlock(raw: unknown, source: string): Unlock {
  if (!isRecord(raw) || typeof raw.skillId !== "string" || typeof raw.level !== "number") {
    throw new Error(`${source} is missing an unlock`);
  }
  return { skillId: raw.skillId, level: raw.level };
}

function parsePart(raw: unknown, index: number): BridgePart {
  const source = `part ${index + 1}`;
  if (!isRecord(raw) || typeof raw.id !== "string" || typeof raw.name !== "string") {
    throw new Error(`${source} is missing a name`);
  }
  if (raw.role !== "deck" && raw.role !== "pillar" && raw.role !== "ramp") {
    throw new Error(`${source} has a bad role`);
  }
  if (typeof raw.strength !== "number") {
    throw new Error(`${source} is missing strength`);
  }
  return {
    id: raw.id,
    name: raw.name,
    role: raw.role,
    strength: raw.strength,
    unlock: parseUnlock(raw.unlock, source),
  };
}

function parseQuestion(raw: unknown, source: string): LevelQuestion {
  if (!isRecord(raw) || typeof raw.prompt !== "string" || typeof raw.answer !== "string" || typeof raw.hint !== "string") {
    throw new Error(`${source} is missing a prompt`);
  }
  if (typeof raw.partId !== "string" || typeof raw.count !== "number") {
    throw new Error(`${source} is missing a part reward`);
  }
  const visual = isRecord(raw.visual) ? (raw.visual as Problem["visual"]) : undefined;
  return {
    prompt: raw.prompt,
    answer: raw.answer,
    hint: raw.hint,
    partId: raw.partId,
    count: raw.count,
    visual,
  };
}

function parseLevel(raw: unknown, index: number): CandyLevel {
  const source = `level ${index + 1}`;
  if (!isRecord(raw) || typeof raw.id !== "string" || typeof raw.title !== "string") {
    throw new Error(`${source} is missing an id`);
  }
  if (!WORLD_IDS.includes(raw.world as WorldId) || typeof raw.number !== "number") {
    throw new Error(`${source} has a bad world`);
  }
  return {
    id: raw.id,
    world: raw.world as WorldId,
    number: raw.number,
    title: raw.title,
    playable: raw.playable === true,
    measure: raw.measure === "ruler" ? "ruler" : "count",
    gapBlocks: typeof raw.gapBlocks === "number" ? raw.gapBlocks : 0,
    blockMeters: typeof raw.blockMeters === "number" ? raw.blockMeters : 1,
    carWeight: typeof raw.carWeight === "number" ? raw.carWeight : 0,
    rulerLeft: typeof raw.rulerLeft === "number" ? raw.rulerLeft : 0,
    rulerRight: typeof raw.rulerRight === "number" ? raw.rulerRight : 0,
    questions: Array.isArray(raw.questions)
      ? raw.questions.map((item, questionIndex) => parseQuestion(item, `${source} question ${questionIndex + 1}`))
      : [],
    requires: parseRequirementList(raw.requires, source),
  };
}

function loadFile() {
  const root = levelFile as { worlds?: unknown; parts?: unknown; levels?: unknown; modes?: unknown };
  if (!Array.isArray(root.worlds) || !Array.isArray(root.parts) || !Array.isArray(root.levels)) {
    throw new Error("Candy level file is missing worlds, parts, or levels");
  }
  return {
    worlds: root.worlds.map((item, index) => {
      if (!isRecord(item) || typeof item.id !== "string" || typeof item.name !== "string") {
        throw new Error(`world ${index + 1} is incomplete`);
      }
      return {
        id: item.id as WorldId,
        name: item.name,
        ability: typeof item.ability === "string" ? item.ability : "",
        blurb: typeof item.blurb === "string" ? item.blurb : "",
        requires: parseRequirementList(item.requires, `world ${index + 1}`),
      };
    }),
    modes: (Array.isArray(root.modes) ? root.modes : []).map((item, index) => {
      if (!isRecord(item) || (item.id !== "count" && item.id !== "calculate" && item.id !== "free")) {
        throw new Error(`mode ${index + 1} is incomplete`);
      }
      return {
        id: item.id,
        label: typeof item.label === "string" ? item.label : item.id,
        requires: parseRequirementList(item.requires, `mode ${index + 1}`),
      } satisfies BuildModeInfo;
    }),
    parts: root.parts.map((item, index) => parsePart(item, index)),
    levels: root.levels.map((item, index) => parseLevel(item, index)),
  };
}

const data = loadFile();

export const worlds: WorldInfo[] = data.worlds;
export const bridgeParts: BridgePart[] = data.parts;
export const candyLevels: CandyLevel[] = data.levels;
export const buildModes: BuildModeInfo[] = data.modes;

export function requirementMet(requirement: Requirement, map: LearnerMap): boolean {
  if (requirement.level <= 0) {
    return true;
  }
  const entry = map[requirement.skillId];
  if (!entry || entry.state === "unchecked") {
    return false;
  }
  return entry.level >= requirement.level;
}

export function firstUnmet(requires: readonly Requirement[], map: LearnerMap): Requirement | null {
  return requires.find((requirement) => !requirementMet(requirement, map)) ?? null;
}

export function worldById(id: WorldId): WorldInfo {
  const world = worlds.find((item) => item.id === id);
  if (!world) {
    throw new Error(`Missing world ${id}`);
  }
  return world;
}

export function worldUnlocked(world: WorldInfo, map: LearnerMap): boolean {
  return firstUnmet(world.requires, map) == null;
}

export function levelUnlocked(level: CandyLevel, map: LearnerMap): boolean {
  return worldUnlocked(worldById(level.world), map) && firstUnmet(level.requires, map) == null;
}

export function hasSkillEvidence(map: LearnerMap): boolean {
  return Object.values(map).some((entry) => entry.state !== "unchecked");
}

function worldFromAge(age: number): WorldId {
  if (age <= 9) {
    return "candy";
  }
  if (age <= 13) {
    return "wood";
  }
  return "steel";
}

function worldFromSkills(map: LearnerMap): WorldId {
  if (worldUnlocked(worldById("steel"), map)) {
    return "steel";
  }
  if (worldUnlocked(worldById("wood"), map)) {
    return "wood";
  }
  return "candy";
}

export function suggestWorld(age: number | null, map: LearnerMap): WorldId {
  if (age == null || hasSkillEvidence(map)) {
    return worldFromSkills(map);
  }
  return worldFromAge(age);
}

export function modeUnlocked(mode: BuildMode, map: LearnerMap): boolean {
  const info = buildModes.find((item) => item.id === mode);
  if (!info) {
    return false;
  }
  return firstUnmet(info.requires, map) == null;
}

export function makeSkillCheck(skill: Skill, level: number, seed: number): Problem[] {
  const rng = createRng(seed);
  const target = Math.min(5, Math.max(1, level));
  return [0, 1, 2].map(() => generateProblem(skill, rng, target));
}

export function skillCheckPassed(problems: readonly Problem[], answers: readonly string[]): boolean {
  return problems.length > 0 && problems.length <= 3 && problems.every((problem, index) => answersMatch(answers[index] ?? "", problem.answer));
}

export function applySkillCheck(
  map: LearnerMap,
  skillId: string,
  level: number,
  problems: readonly Problem[],
  answers: readonly string[],
): LearnerMap {
  if (!skillCheckPassed(problems, answers)) {
    return map;
  }
  return recordLevelPass(map, skillId, level);
}

export function spanReadout(level: CandyLevel, deckCount: number): { length: string; load: string } {
  return {
    length: `${deckCount * level.blockMeters} m`,
    load: `${level.carWeight} kg`,
  };
}

export function levelById(id: string): CandyLevel | null {
  return candyLevels.find((level) => level.id === id) ?? null;
}

export function levelsForWorld(world: WorldId): CandyLevel[] {
  return candyLevels.filter((level) => level.world === world);
}

export function partById(id: string): BridgePart | null {
  return bridgeParts.find((part) => part.id === id) ?? null;
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

export function measureAnswer(level: CandyLevel): number {
  if (level.measure === "ruler") {
    return level.rulerRight - level.rulerLeft;
  }
  return level.gapBlocks;
}

export function questionProblem(question: LevelQuestion): Problem {
  return { prompt: question.prompt, answer: question.answer, visual: question.visual };
}

export type EarnResult = {
  correct: boolean;
  hint: string;
  partId: string;
  count: number;
};

export function gradeQuestion(question: LevelQuestion, given: string): EarnResult {
  const correct = answersMatch(given, question.answer);
  return {
    correct,
    hint: correct ? "" : question.hint,
    partId: question.partId,
    count: correct ? question.count : 0,
  };
}

export function deckPiece(part: BridgePart, col: number): BlockPiece {
  return {
    id: `${part.id}-${col}`,
    name: part.name,
    col,
    role: "deck",
    strengthKg: part.strength,
  };
}

export function pillarPiece(part: BridgePart, col: number): BlockPiece {
  return {
    id: `${part.id}-p-${col}`,
    name: part.name,
    col,
    role: "pillar",
    strengthKg: part.strength,
  };
}

export function bridgeFromPieces(level: CandyLevel, pieces: BlockPiece[]): BlockBridge {
  return { gap: level.gapBlocks, carKg: level.carWeight, pieces };
}

export function referenceBridges(level: CandyLevel): { correct: BlockBridge; weak: BlockBridge; limit: BlockBridge } {
  const chocolate = partById("chocolate");
  const wafer = partById("wafer");
  const gummy = partById("gummy");
  const cane = partById("cane");
  if (!chocolate || !wafer || !gummy || !cane) {
    throw new Error("Candy parts are missing");
  }
  const span = (part: BridgePart, strength = part.strength) =>
    Array.from({ length: level.gapBlocks }, (_, col) => ({
      ...deckPiece(part, col),
      strengthKg: strength,
    }));
  const caneCount = level.questions.find((question) => question.partId === "cane")?.count ?? 0;
  const pillars =
    caneCount >= 2
      ? [1, level.gapBlocks - 2].filter((col, index, list) => col >= 0 && col < level.gapBlocks && list.indexOf(col) === index)
      : caneCount === 1
        ? [Math.floor(level.gapBlocks / 2)]
        : [];
  const withPillars = (deck: BlockPiece[]) => [
    ...deck,
    ...pillars.map((col) => pillarPiece(cane, col)),
  ];
  return {
    correct: bridgeFromPieces(level, withPillars(span(chocolate))),
    weak: bridgeFromPieces(
      level,
      span(chocolate).filter((_, col) => col !== 1 && col !== 2),
    ),
    limit: bridgeFromPieces(level, span(gummy, gummy.strength)),
  };
}
