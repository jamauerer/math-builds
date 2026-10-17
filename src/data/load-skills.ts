import type { Skill, SkillParams, Strand } from "../engine/types";
import strandFile from "./strands.json";

const modules = import.meta.glob("./skills/*.json", { eager: true });

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseParams(value: unknown, source: string): SkillParams {
  if (!isRecord(value)) {
    throw new Error(`${source} params must be an object`);
  }
  const params: SkillParams = {};
  for (const [key, entry] of Object.entries(value)) {
    if (
      typeof entry === "string" ||
      typeof entry === "number" ||
      typeof entry === "boolean"
    ) {
      params[key] = entry;
      continue;
    }
    if (Array.isArray(entry) && entry.every((item) => typeof item === "string")) {
      params[key] = entry;
      continue;
    }
    if (Array.isArray(entry) && entry.every((item) => typeof item === "number")) {
      params[key] = entry;
      continue;
    }
    throw new Error(`${source} param ${key} has an unsupported type`);
  }
  return params;
}

function unwrap(moduleValue: unknown): unknown {
  if (isRecord(moduleValue) && "default" in moduleValue) {
    return moduleValue.default;
  }
  return moduleValue;
}

export function parseSkill(raw: unknown, source: string): Skill {
  if (!isRecord(raw)) {
    throw new Error(`${source} is not a skill object`);
  }
  const required = [
    "id",
    "strand",
    "name",
    "gradeBand",
    "prerequisites",
    "generator",
    "description",
  ] as const;
  for (const key of required) {
    if (raw[key] == null) {
      throw new Error(`${source} is missing ${key}`);
    }
  }
  if (!Array.isArray(raw.prerequisites) || raw.prerequisites.some((item) => typeof item !== "string")) {
    throw new Error(`${source} prerequisites must be a list of skill ids`);
  }
  const description = String(raw.description);
  if (description.includes("\u2014")) {
    throw new Error(`${source} description uses an em dash`);
  }
  if (!Array.isArray(raw.levels) || raw.levels.length !== 5) {
    throw new Error(`${source} levels must be five param objects`);
  }
  return {
    id: String(raw.id),
    strand: String(raw.strand),
    name: String(raw.name),
    gradeBand: String(raw.gradeBand),
    prerequisites: raw.prerequisites,
    generator: String(raw.generator),
    description,
    levels: raw.levels.map((entry, index) => parseParams(entry, `${source} level ${index + 1}`)),
  };
}

export const skills: Skill[] = Object.entries(modules)
  .map(([path, moduleValue]) => parseSkill(unwrap(moduleValue), path))
  .sort((a, b) => a.id.localeCompare(b.id));

export const strands = strandFile as Strand[];

export function skillsInStrand(strandId: string): Skill[] {
  const strand = strands.find((item) => item.id === strandId);
  if (!strand) {
    throw new Error(`Unknown strand ${strandId}`);
  }
  return strand.skills.map((id) => {
    const skill = skills.find((item) => item.id === id);
    if (!skill) {
      throw new Error(`Strand ${strandId} lists missing skill ${id}`);
    }
    return skill;
  });
}
