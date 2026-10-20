import type { SkillItem } from "../skills/generate";
import { generateSkill, generateStep, type LadderItem } from "./generate";
import {
  gradeCap,
  gradeNumber,
  ladderStep,
  legalSteps,
  opStrand,
  stepAllowed,
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

function replacement(grade: number | "unsure" | null | undefined, seed: number): LadderItem {
  const allowed = legalSteps(grade);
  const step = allowed[Math.abs(seed) % allowed.length] ?? legalSteps(1)[0];
  return generateStep(step, seed + 17);
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
}): ServedQuestion {
  const grade = input.grade;
  if (input.step) {
    if (!stepAllowed(input.step, grade)) {
      const next = replacement(grade, input.seed);
      console.error("Served question above the grade cap", {
        wanted: input.step.id,
        grade: gradeNumber(grade),
        cap: { A: gradeCap("A", grade), S: gradeCap("S", grade), M: gradeCap("M", grade), D: gradeCap("D", grade) },
        replacement: next.stepId,
      });
      return toServed(next, input.kind);
    }
    return toServed(generateStep(input.step, input.seed), input.kind);
  }
  if (input.skillId) {
    const step = ladderStep(input.skillId);
    if (step) {
      return serveQuestion({ ...input, step, skillId: undefined });
    }
    if (!strandAllowed(input.skillId.split(".")[0] ?? "", grade) || questionAboveCap(input.skillId, grade)) {
      const next = replacement(grade, input.seed);
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
      const next = replacement(grade, input.seed);
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
  const generated = input.skillId ? generateSkill(input.skillId, input.seed) : null;
  if (generated) {
    return toServed(generated, input.kind);
  }
  return toServed(replacement(grade, input.seed), input.kind);
}

export function servedToSkillItem(served: ServedQuestion): SkillItem {
  const item = served.item;
  return {
    prompt: served.prompt,
    answer: served.answer,
    steps: item?.steps ?? ["Use the numbers."],
    why: item?.why ?? "Ladder step.",
    draw: item?.draw ?? { op: "add", a: 1, b: 1 },
  };
}

export function servedOp(served: ServedQuestion): LadderOp | null {
  return served.stepId ? (ladderStep(served.stepId)?.op ?? null) : opOf(served.skillId);
}
