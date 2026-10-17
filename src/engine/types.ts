import type { Rng } from "./rng";

export type PlaceName = "ones" | "tens" | "hundreds" | "thousands";

export type SkillParamValue = string | number | boolean | string[] | number[];

export type SkillParams = Record<string, SkillParamValue>;

export const MAX_LEVEL = 5;

export type Skill = {
  id: string;
  strand: string;
  name: string;
  gradeBand: string;
  prerequisites: string[];
  generator: string;
  description: string;
  /** Five entries, level 1 through level 5. The generator reads these params. */
  levels: SkillParams[];
};

export type Strand = {
  id: string;
  name: string;
  skills: string[];
};

export type StackedVisual = {
  kind: "stacked";
  layout: "vertical";
  operator: "+" | "-";
  top: number;
  bottom: number;
};

export type ExpressionVisual = {
  kind: "expression";
  left: number;
  operator: "+" | "-" | "x";
  right: number;
};

export type PlaceValueVisual = {
  kind: "place-value";
  number: number;
  place: PlaceName;
};

export type CompareVisual = {
  kind: "compare";
  left: number;
  right: number;
};

export type RoundVisual = {
  kind: "round";
  number: number;
  place: "ten" | "hundred";
};

export type ProblemVisual =
  | StackedVisual
  | ExpressionVisual
  | PlaceValueVisual
  | CompareVisual
  | RoundVisual;

export type Problem = {
  prompt: string;
  answer: string;
  choices?: string[];
  visual?: ProblemVisual;
};

export type Generator = (
  rng: Rng,
  difficulty: number,
  params: SkillParams,
) => Problem;

export const PLACE_FACTOR: Record<PlaceName, number> = {
  ones: 1,
  tens: 10,
  hundreds: 100,
  thousands: 1000,
};

export function formatNumber(value: number): string {
  return value.toLocaleString("en-US");
}

export function requireNumber(params: SkillParams, key: string): number {
  const value = params[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Expected numeric param ${key}`);
  }
  return value;
}

export function requireString(params: SkillParams, key: string): string {
  const value = params[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Expected string param ${key}`);
  }
  return value;
}

export function optionalNumber(params: SkillParams, key: string): number | undefined {
  const value = params[key];
  if (value == null) {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Expected numeric param ${key}`);
  }
  return value;
}

export function levelParams(skill: Skill, level: number): SkillParams {
  if (level < 1 || level > MAX_LEVEL || skill.levels.length !== MAX_LEVEL) {
    throw new Error(`Skill ${skill.id} has no level ${level}`);
  }
  return skill.levels[level - 1];
}

export function requireStringList(params: SkillParams, key: string): string[] {
  const value = params[key];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`Expected string list param ${key}`);
  }
  return value.filter((item): item is string => typeof item === "string");
}
