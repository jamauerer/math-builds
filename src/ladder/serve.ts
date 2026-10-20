import type { SkillItem } from "../skills/generate";
import { generateStep, validateStep, type LadderItem } from "./generate";
import { pickCeilingStep, stepWithinCeiling, type ServeCeiling } from "./current";
import {
  gradeCap,
  gradeNumber,
  ladderStep,
  legalSteps,
  opStrand,
  stepAllowed,
  stepsForOp,
  strandAllowed,
  type LadderOp,
  type LadderStep,
} from "./steps";

export type ServedKind = "place" | "warmup" | "run" | "practice" | "word" | "learn";

export type ServedQuestion = {
  stepId?: string;
  skillId: string;
  strandId: string;
  level: number;
  prompt: string;
  answer: string;
  kind: ServedKind;
  item?: LadderItem;
};

function opOf(skillId: string): LadderOp | null {
  const step = ladderStep(skillId);
  return step?.op ?? null;
}

function generateValid(step: LadderStep, seed: number): LadderItem {
  for (let extra = 0; extra < 40; extra += 1) {
    const item = generateStep(step, seed + extra * 17);
    if (validateStep(step, item)) {
      return item;
    }
  }
  return generateStep(step, seed);
}

function replacement(grade: number | "unsure" | null | undefined, seed: number, ceiling?: ServeCeiling): LadderItem {
  const ops = (["A", "S", "M", "D"] as const).filter((op) => gradeCap(op, grade) > 0);
  const op = ops[Math.abs(seed) % ops.length] ?? "A";
  const current = pickCeilingStep(op, ceiling, grade);
  const below = stepsForOp(op).filter((step) => step.n < current.n && stepAllowed(step, grade));
  const review = below.length > 0 && Math.abs(seed) % 10 < 3;
  const step = review ? below[Math.abs(seed) % below.length] : current;
  return generateValid(step, seed + 17);
}

function toServed(item: LadderItem, kind: ServedKind): ServedQuestion {
  const step = ladderStep(item.stepId);
  return {
    stepId: item.stepId,
    skillId: item.skillId,
    strandId: step ? opStrand(step.op) : "adding",
    level: step?.level ?? 1,
    prompt: item.prompt,
    answer: item.answer,
    kind,
    item,
  };
}

export function questionAboveCap(skillId: string, grade: number | "unsure" | null | undefined): boolean {
  const step = ladderStep(skillId);
  if (step) {
    return !stepAllowed(step, grade);
  }
  const strand = skillId.split(".")[0] ?? "";
  const level = Number(skillId.split(".")[1]);
  if (!strandAllowed(strand, grade)) {
    return true;
  }
  if (Number.isFinite(level) && level > gradeNumber(grade) + 2) {
    return true;
  }
  return false;
}

function serveStep(step: LadderStep, grade: number | "unsure" | null | undefined, seed: number, kind: ServedKind, ceiling?: ServeCeiling): ServedQuestion {
  if (!stepAllowed(step, grade) || !stepWithinCeiling(step, ceiling)) {
    const next = replacement(grade, seed, ceiling);
    console.error("Served question above the grade cap", {
      wanted: step.id,
      grade: gradeNumber(grade),
      cap: { A: gradeCap("A", grade), S: gradeCap("S", grade), M: gradeCap("M", grade), D: gradeCap("D", grade) },
      ceiling,
      replacement: next.stepId,
    });
    return toServed(next, kind);
  }
  const item = generateValid(step, seed);
  if (!validateStep(step, item)) {
    const next = generateValid(step, seed + 41);
    if (validateStep(step, next)) {
      return toServed(next, kind);
    }
    console.error("Served question outside its step range", { wanted: step.id, prompt: item.prompt });
    return toServed(replacement(grade, seed + 3, ceiling), kind);
  }
  return toServed(item, kind);
}

/** Every served question goes through here. A miss logs and a legal question goes out. */
export function serveQuestion(input: {
  grade: number | "unsure" | null | undefined;
  skillId?: string;
  step?: LadderStep;
  seed: number;
  kind: ServedKind;
  prompt?: string;
  answer?: string;
  strandId?: string;
  ceiling?: ServeCeiling;
}): ServedQuestion {
  const grade = input.grade;
  if (input.step) {
    return serveStep(input.step, grade, input.seed, input.kind, input.ceiling);
  }
  if (input.skillId) {
    const step = ladderStep(input.skillId);
    if (step) {
      return serveStep(step, grade, input.seed, input.kind, input.ceiling);
    }
    if (!strandAllowed(input.skillId.split(".")[0] ?? "", grade) || questionAboveCap(input.skillId, grade)) {
      const next = replacement(grade, input.seed, input.ceiling);
      console.error("Served question above the grade cap", {
        wanted: input.skillId,
        grade: gradeNumber(grade),
        replacement: next.stepId,
      });
      return toServed(next, input.kind);
    }
  }
  if (input.prompt && input.answer && input.skillId) {
    const strand = input.strandId ?? input.skillId.split(".")[0] ?? "adding";
    if (!strandAllowed(strand, grade)) {
      const next = replacement(grade, input.seed, input.ceiling);
      console.error("Served question above the grade cap", { wanted: input.skillId, strand, grade: gradeNumber(grade), replacement: next.stepId });
      return toServed(next, input.kind);
    }
    return {
      skillId: input.skillId,
      strandId: strand,
      level: Number(input.skillId.split(".")[1]) || 1,
      prompt: input.prompt,
      answer: input.answer,
      kind: input.kind,
    };
  }
  const generated = input.skillId ? generateStep(ladderStep(input.skillId) ?? legalSteps(grade)[0], input.seed) : null;
  if (generated && input.skillId && ladderStep(input.skillId)) {
    return toServed(generated, input.kind);
  }
  return toServed(replacement(grade, input.seed, input.ceiling), input.kind);
}

export function servedToSkillItem(served: ServedQuestion): SkillItem {
  const item = served.item;
  const prompt = served.prompt;
  return {
    prompt,
    answer: served.answer,
    steps: item?.steps ?? ["Use the numbers."],
    why: item?.why ?? "Ladder step.",
    draw: item?.draw ?? { op: "add", a: 1, b: 1 },
    needsPicture: false,
  };
}

export function servedOp(served: ServedQuestion): LadderOp | null {
  return served.stepId ? (ladderStep(served.stepId)?.op ?? null) : opOf(served.skillId);
}
