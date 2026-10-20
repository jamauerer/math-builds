import graph from "./graph.json";

export type AnswerKind = "whole" | "decimal" | "fraction" | "expression" | "choice";

export type LearnPictureKind =
  | "bolts"
  | "dots"
  | "planks"
  | "beams"
  | "tape"
  | "number-line"
  | "rows"
  | "area"
  | "triangle"
  | "balance"
  | "sign"
  | "grid"
  | "none";

export type CurriculumSkill = {
  id: string;
  strandId: string;
  level: number;
  name: string;
  notation: string;
  answer: AnswerKind;
  learnPicture: string;
  learnPictureKind: LearnPictureKind;
  kitUse: string;
  timeTarget: number;
  prereqs: string[];
};

export type KitPieceStrand = {
  piece: string;
  strand: string;
  questions: string;
};

function answerKind(raw: string): AnswerKind {
  const text = raw.toLowerCase();
  if (text.includes("choice")) {
    return "choice";
  }
  if (text.includes("drag") || text.includes("order")) {
    return "whole";
  }
  if (text.includes("expression")) {
    return "expression";
  }
  if (text.includes("fraction")) {
    return "fraction";
  }
  if (text.includes("decimal")) {
    return "decimal";
  }
  return "whole";
}

function pictureKind(raw: string): LearnPictureKind {
  const text = raw.toLowerCase();
  if (text.includes("bolt")) {
    return "bolts";
  }
  if (text.includes("dot") || text.includes("square of")) {
    return "dots";
  }
  if (text.includes("plank")) {
    return "planks";
  }
  if (text.includes("tape") || text.includes("ruler") || text.includes("protractor") || text.includes("clock")) {
    return "tape";
  }
  if (text.includes("beam") || text.includes("post") || text.includes("brace") || text.includes("truss")) {
    return "beams";
  }
  if (text.includes("number line") || text.includes("thermometer")) {
    return "number-line";
  }
  if (text.includes("row") || text.includes("pair") || text.includes("grid") || text.includes("array")) {
    return "rows";
  }
  if (text.includes("area") || text.includes("box") || text.includes("brick")) {
    return "area";
  }
  if (text.includes("triangle") || text.includes("angle") || text.includes("pythagoras") || text.includes("ramp")) {
    return "triangle";
  }
  if (text.includes("balance") || text.includes("scale")) {
    return "balance";
  }
  if (text.includes("sign")) {
    return "sign";
  }
  if (text.includes("coordinate") || text.includes("graph") || text.includes("parabola")) {
    return "grid";
  }
  return "none";
}

export const CURRICULUM_SKILLS: CurriculumSkill[] = graph.skills.map((skill) => ({
  id: skill.id,
  strandId: skill.strand,
  level: skill.level,
  name: skill.name,
  notation: skill.notation,
  answer: answerKind(skill.answer),
  learnPicture: skill.learnPicture,
  learnPictureKind: pictureKind(skill.learnPicture),
  kitUse: skill.kitUse,
  timeTarget: typeof skill.timeTarget === "number" && skill.timeTarget > 0 ? skill.timeTarget : skill.level <= 2 ? 5 : 8,
  prereqs: skill.prereqs,
}));

export const KIT_PIECE_STRANDS: KitPieceStrand[] = graph.pieces;

export function curriculumSkill(id: string): CurriculumSkill | undefined {
  return CURRICULUM_SKILLS.find((skill) => skill.id === id);
}

export function skillsAt(strandId: string, level: number): CurriculumSkill[] {
  return CURRICULUM_SKILLS.filter((skill) => skill.strandId === strandId && skill.level === level);
}

export function curriculumSkillIds(): string[] {
  return CURRICULUM_SKILLS.map((skill) => skill.id);
}
