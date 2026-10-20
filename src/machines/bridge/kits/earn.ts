import type { LearnerMap } from "../../../engine/placement";
import { formatLength, formatWeight, lengthAbbrev } from "../../../units";
import { plainQuestion } from "./plain";
import { pictureTemplate, promptNeedsPicture, skillHint, skillQuestion, type ActionKind, type ChoiceOption } from "../../../skills/generate";
import { skillExplain } from "../../../skills/explain";
import { CURRICULUM_SKILLS, curriculumSkill } from "../../../skills";
import { drawPlain } from "../../../pictures";
import { labelAt, pictureSlot, slice } from "../../../pictures/layout";
import { choicesMatchPicture, pictureAgrees } from "../../../pictures/check";
import { pictureHasInk } from "../../../pictures/need";
import { pictureMask } from "../../../pictures/pick";
import type { Picture, PlainDraw } from "../../../pictures/parts";
import { fitLevels, KIT_STRANDS, strandName, type GradeChoice } from "../../../engine/strand-placement";
import { workedExample, type ExplainStep } from "./explain";
import { plankWidth, queenPost, slotAlong, type KitGroup } from "./kit";
import { pieceQuestion, strandWord } from "./pieces";
import { tapeOnPosts } from "../../../pictures/tape";
import type { LadderLayout } from "../../../ladder/generate";
import { parseStackSpec } from "../../../ladder/stack";
import { questionAboveCap, serveQuestion, type ServedKind } from "../../../ladder/serve";
import type { ServeCeiling } from "../../../ladder/current";
import { DOT_STEPS, gradeCap, gradeNumber, ladderStep, strandAllowed } from "../../../ladder/steps";
import { wordAllowed, wordPrompt } from "../../../ladder/word";
import {
  beginSession,
  bookCeiling,
  bookCurrentStep,
  clearWarmFlag,
  closeTallies,
  currentSkill,
  flagWarmUp,
  KIT_SKILLS,
  markLearning,
  markStruggling,
  maybeBoostStrand,
  newSkill,
  rememberAnswer,
  runPlan,
  skillById,
  skillsFromLevels,
  strandLevelsFrom,
  timeTargetFor,
  warmUpPlan,
  withState,
  workingLevel,
  type SkillBook,
} from "./skills";

export type EarnFact =
  | { kind: "count-planks"; count: number; plank?: number; beam?: number }
  | { kind: "count-posts"; count: number }
  | { kind: "count-pieces"; count: number }
  | { kind: "count-gussets"; count: number }
  | { kind: "count-braces"; count: number }
  | { kind: "count-bolts"; count: number }
  | { kind: "count-rails"; count: number }
  | { kind: "between-posts"; left: number; right: number }
  | { kind: "posts-timber"; each: number; count: number }
  | { kind: "triangles"; diagonals: number; each: number }
  | { kind: "beam-weight"; pieces: number; each: number }
  | { kind: "bolts-combine"; plates: number; each: number }
  | { kind: "rail-both"; side: number }
  | { kind: "split-gap"; gap: number; beams: number }
  | { kind: "add-parts"; left: number; right: number }
  | { kind: "brace-hyp"; across: number; up: number }
  | { kind: "piece"; prompt: string; answer: string; used: number[]; slots: string[] }
  | { kind: "plain"; prompt: string; steps: string[]; why: string; draw?: PlainDraw };

export type EarnBit = Picture["bits"][number];
export type EarnLabel = Picture["labels"][number];
export type EarnPicture = Picture;

export type EarnMeasure = "count" | "length" | "weight";

export type EarnQuestion = {
  groupId: string;
  strandId: string;
  level: number;
  answer: string;
  fact: EarnFact;
  word?: string;
  skillId?: string;
  mixed?: boolean;
  hint?: string;
  picture?: EarnPicture;
  pictureCaption?: string;
  truth?: number;
  choices?: ChoiceOption[];
  action?: ActionKind;
  sizes?: number[];
  stepId?: string;
  layout?: LadderLayout;
  needsPicture?: boolean;
  template?: string;
};

export type EarnState = {
  groupIndex: number;
  earned: string[];
  runGot: number;
  phase: "warmup" | "learn" | "guided" | "plain" | "word" | "explain" | "practice" | "done";
  returnPhase: "warmup" | "guided" | "plain" | "word";
  current: EarnQuestion;
  upcoming: EarnQuestion[];
  practice: EarnQuestion[];
  practiceIndex: number;
  streak: number;
  roundsFailed: number;
  seed: number;
  seen: string[];
  timesMs: number[];
  speedLine: string | null;
  book: SkillBook;
  day: string;
  steps: number;
  round: number;
  short: boolean;
  runMisses: number;
  runFast: boolean;
  grade: GradeChoice | null;
};

export const WARMUP_COUNT = 3;

const BRIDGE_SKILLS = [
  "gap-between-marks",
  "multiply-facts-2-to-5",
  "truss-triangles",
  "times-as-many",
  "right-triangle-hypotenuse",
  "double-the-run",
];

/** Skill progress is 0 to 5. Spread that across the 13 bridge rungs. Pythagoras starts at rung 9. */
export function placedKitLevel(map: LearnerMap): number {
  const best = Math.max(0, ...BRIDGE_SKILLS.map((id) => map[id]?.level ?? 0));
  return Math.min(13, Math.max(1, best * 2 + 1));
}

export function earnMeasure(question: EarnQuestion): EarnMeasure {
  const fact = question.fact;
  if (fact.kind === "beam-weight") {
    return "weight";
  }
  if (
    fact.kind === "between-posts" ||
    fact.kind === "posts-timber" ||
    fact.kind === "rail-both" ||
    fact.kind === "split-gap" ||
    fact.kind === "add-parts" ||
    fact.kind === "brace-hyp"
  ) {
    return "length";
  }
  return "count";
}

export function earnPrompt(question: EarnQuestion): string {
  if (question.word) {
    return question.word;
  }
  const fact = question.fact;
  if (fact.kind === "plain") {
    return fact.prompt;
  }
  if (question.pictureCaption) {
    return question.pictureCaption;
  }
  switch (fact.kind) {
    case "count-planks":
      return "How many planks cover the gap?";
    case "count-posts":
      return "How many posts?";
    case "count-pieces":
      return "The beam is cut into pieces, count them.";
    case "count-gussets":
      return "How many gusset plates?";
    case "count-braces":
      return "How many braces?";
    case "count-bolts":
      return "How many plates?";
    case "count-rails":
      return "How many railings?";
    case "between-posts":
      return "Two posts stand on the ruler. How long is the beam between them?";
    case "posts-timber":
      return "How much timber do the posts use together?";
    case "triangles":
      return "Each diagonal makes 2 triangles. How many triangles is that?";
    case "beam-weight":
      return "The beam is split into pieces. How heavy is the whole beam?";
    case "bolts-combine":
      return "Each gusset plate has its own bolts. How many bolts is that?";
    case "rail-both":
      return "The railing runs both sides. How long is the railing?";
    case "split-gap":
      return `The gap is shared by the beams. How long is each beam? Lengths are in ${lengthAbbrev()}.`;
    case "add-parts":
      return "How long are the two pieces together?";
    case "brace-hyp":
      return "The brace is the long side of this right triangle. How long is it?";
    case "piece":
      return fact.prompt;
    default:
      return "";
  }
}

function rawHint(question: EarnQuestion): string {
  const fact = question.fact;
  switch (fact.kind) {
    case "between-posts":
      return "Hint: the right mark minus the left mark.";
    case "add-parts":
    case "bolts-combine":
      return "Hint: combine the labels.";
    case "triangles":
      return "Hint: 2 triangles for each diagonal.";
    case "posts-timber":
    case "beam-weight":
      return "Hint: each amount times how many there are.";
    case "rail-both":
      return "Hint: both sides.";
    case "split-gap":
      return "Hint: share the gap across the beams.";
    case "brace-hyp":
      return "Hint: square both sides, add, then take the square root.";
    case "plain":
      return "";
    case "piece":
      return question.groupId === "planks"
        ? "Hint: a plank's width is how much of the path it covers."
        : "Hint: use the numbers you were given.";
    case "count-posts":
      return "Hint: count the posts.";
    case "count-planks":
      return question.groupId === "planks" ? "Hint: the path is as long as the two beams together." : "Hint: count the planks.";
    case "count-gussets":
      return "Hint: count the plates.";
    case "count-braces":
      return "Hint: count the braces.";
    case "count-bolts":
      return "Hint: count the plates.";
    case "count-rails":
      return "Hint: count the railings.";
    case "count-pieces":
      return "Hint: count the beams.";
    default:
      return "Hint: count the pieces.";
  }
}

export function earnHint(question: EarnQuestion): string {
  const hint = rawHint(question);
  const token = question.answer.replace(/^-/, "");
  if (token.length > 0 && hint.split(/[^0-9.]+/).filter((part) => part.length > 0).includes(token)) {
    return "";
  }
  return hint;
}

function wordPicture(question: EarnQuestion): EarnPicture | null {
  const fact = question.fact;
  if (fact.kind !== "piece") {
    return factPicture(fact);
  }
  const prompt = question.word ?? fact.prompt;
  const count = Number(question.answer);
  if (question.groupId === "planks" && Number.isFinite(count) && count >= 1 && count <= 8) {
    const named = plankCoverWidth(prompt);
    if (named != null && Math.abs(named - plankWidth()) > 0.02) {
      return null;
    }
    const ids = ["plank-1", "plank-2", "plank-3", "plank-4", "plank-5", "plank-6", "plank-7", "plank-8"].slice(0, count);
    const picture = slice(ids, kitLengthLabels(ids, prompt));
    return { ...picture, measure: plankWidthBar(ids[0]) };
  }
  if (question.strandId === "counting") {
    return slice(fact.slots);
  }
  return slice(fact.slots, kitLengthLabels(fact.slots, prompt));
}

function plankCoverWidth(prompt: string): number | null {
  const match = prompt.match(/each plank is\s+(\d+(?:\.\d+)?)/i);
  return match ? Number(match[1]) : null;
}

function plankWidthBar(slotId: string): NonNullable<EarnPicture["measure"]> {
  const bit = pictureSlot(slotId);
  return { x: bit.x, y: Math.max(2, bit.y - 22), w: bit.w, text: "width" };
}

function kitLengthLabels(slots: string[], prompt: string) {
  return slots.flatMap((id) => {
    const slot = queenPost.slots.find((item) => item.id === id);
    const size = slot ? slotAlong(slot) : null;
    if (size == null) {
      return [];
    }
    const text = formatLength(size);
    if (!prompt.includes(text) && !prompt.includes(String(size))) {
      return [];
    }
    return [labelAt(id, text)];
  });
}

function factPicture(fact: EarnFact): EarnPicture {
  const posts = ["post-a", "post-b"];
  const beams = ["bottom-a", "bottom-b"];
  const gussets = ["gusset-n4", "gusset-n2", "gusset-n6", "gusset-p2", "gusset-p6"];
  const planks = ["plank-1", "plank-2", "plank-3", "plank-4", "plank-5", "plank-6", "plank-7", "plank-8"];
  switch (fact.kind) {
    case "count-planks":
      return slice(planks.slice(0, Math.min(fact.count, planks.length)));
    case "count-posts":
      return slice(posts.slice(0, Math.min(fact.count, posts.length)));
    case "count-pieces":
      return slice(["bottom-a", "bottom-b", "top"].slice(0, Math.min(fact.count, 3)));
    case "count-gussets":
    case "count-bolts":
      return slice(gussets.slice(0, Math.min(fact.count, gussets.length)));
    case "count-braces":
      return slice(["brace-a", "brace-b"].slice(0, Math.min(fact.count, 2)));
    case "count-rails":
      return slice(["rail-a", "rail-b"].slice(0, Math.min(fact.count, 2)));
    case "between-posts":
      return slice(posts, [labelAt("post-a", formatLength(fact.left), -22), labelAt("post-b", formatLength(fact.right), -22)]);
    case "posts-timber":
      return slice(posts.slice(0, Math.min(fact.count, 2)), repeat(Math.min(fact.count, 2), (index) => labelAt(posts[index], formatLength(fact.each), -22)));
    case "triangles":
      return slice(["brace-a", "brace-b"].slice(0, Math.min(fact.diagonals, 2)), [labelAt("brace-a", String(fact.each), -24)]);
    case "beam-weight":
      return slice(beams, [labelAt("bottom-a", formatWeight(fact.each)), labelAt("bottom-b", String(fact.pieces))]);
    case "bolts-combine":
      return slice(
        gussets.slice(0, Math.min(fact.plates, gussets.length)),
        gussets.slice(0, Math.min(fact.plates, gussets.length)).map((id) => labelAt(id, String(fact.each), -24)),
      );
    case "rail-both":
      return slice(["rail-a", "rail-b"], [labelAt("rail-a", formatLength(fact.side), -24)]);
    case "split-gap":
      return slice(beams.slice(0, Math.min(fact.beams, 2)), [labelAt("bottom-a", formatLength(fact.gap), -36)]);
    case "add-parts":
      return slice(beams, [labelAt("bottom-a", formatLength(fact.left)), labelAt("bottom-b", formatLength(fact.right))]);
    case "brace-hyp":
      return slice(["brace-a"], [labelAt("bottom-a", formatLength(fact.across)), labelAt("post-a", formatLength(fact.up), -22)]);
    case "piece":
      return slice(fact.slots);
    default:
      return slice(beams);
  }
}

export function earnPicture(question: EarnQuestion): EarnPicture | null {
  let picture: EarnPicture | null = null;
  if (question.picture) {
    picture = question.picture;
  } else if (question.word) {
    const step = question.skillId ? ladderStep(question.skillId) : undefined;
    if (step && !step.dots) {
      picture = null;
    } else {
      picture = wordPicture(question);
    }
  } else if (question.fact.kind !== "plain") {
    picture = factPicture(question.fact);
  }
  if (picture && question.word && !pictureAgrees(earnPrompt(question), question.answer, picture)) {
    console.warn("Picture failed the picture check", {
      prompt: earnPrompt(question),
      answer: question.answer,
      skillId: question.skillId,
    });
    picture = null;
  }
  if (!picture || picture.figure || picture.tape) {
    return picture;
  }
  if (!wantsTape(question)) {
    return picture;
  }
  return { ...picture, ruler: true, tape: tapeOnPosts(picture.bits, tapeMarks(question)) };
}

function wantsTape(question: EarnQuestion): boolean {
  if (question.strandId === "measuring") {
    return true;
  }
  return /\bruler\b|\bmarks?\b|\bmeasurement\b/i.test(earnPrompt(question));
}

function tapeMarks(question: EarnQuestion): number[] {
  const fact = question.fact;
  if (fact.kind === "plain" && fact.draw) {
    return [fact.draw.a, fact.draw.b];
  }
  const found = earnPrompt(question)
    .split(/[^0-9.]+/)
    .filter((part) => /^\d+(\.\d+)?$/.test(part))
    .map(Number);
  return found.length > 0 ? found : [0, 8];
}

function repeat<T>(count: number, make: (index: number) => T): T[] {
  return Array.from({ length: count }, (_, index) => make(index));
}

function answerFor(fact: EarnFact): string {
  switch (fact.kind) {
    case "count-planks":
    case "count-posts":
    case "count-pieces":
    case "count-gussets":
    case "count-braces":
    case "count-bolts":
    case "count-rails":
      return String(fact.count);
    case "between-posts":
      return String(fact.right - fact.left);
    case "posts-timber":
      return String(fact.each * fact.count);
    case "triangles":
      return String(fact.diagonals * fact.each);
    case "beam-weight":
      return String(fact.pieces * fact.each);
    case "bolts-combine":
      return String(fact.plates * fact.each);
    case "rail-both":
      return String(fact.side * 2);
    case "split-gap":
      return String(fact.gap / fact.beams);
    case "add-parts":
      return String(fact.left + fact.right);
    case "brace-hyp":
      return (Math.round(Math.hypot(fact.across, fact.up) * 100) / 100).toFixed(2);
    case "piece":
      return fact.answer;
    default:
      return "";
  }
}

function factFor(group: KitGroup, level: number): EarnFact {
  const piece = pieceQuestion(group.id, level);
  return { kind: "piece", prompt: piece.prompt, answer: piece.answer, used: piece.used, slots: piece.slots };
}

export function questionForStrand(strandId: string, level: number, salt = 0): EarnQuestion {
  const group = queenPost.groups.find((item) => item.strand === strandId);
  if (!group) {
    const word = strandWord(strandId);
    const rung = Math.min(13, Math.max(1, level));
    return {
      groupId: "deck",
      level: rung,
      answer: word.answer,
      fact: { kind: "piece", prompt: word.prompt, answer: word.answer, used: word.used, slots: word.slots },
      strandId,
    };
  }
  return questionFor(group, level, salt);
}

/** The word-problem sentence for a strand, with the numbers taken out. */
export function wordTemplate(strandId: string): string {
  const group = queenPost.groups.find((item) => item.strand === strandId);
  const prompt = group ? pieceQuestion(group.id, 4).prompt : strandWord(strandId).prompt;
  return prompt.replace(/\d+(\.\d+)?/g, "#");
}

function questionFor(group: KitGroup, level: number, salt = 0): EarnQuestion {
  void salt;
  const rung = Math.min(13, Math.max(1, level));
  const fact = factFor(group, rung);
  return { groupId: group.id, level: rung, answer: answerFor(fact), fact, strandId: group.strand };
}

export function runLength(groupId: string, short = false): number {
  for (const round of queenPost.rounds) {
    const planned = round.runs[groupId];
    if (planned != null) {
      return short ? Math.min(3, planned) : planned;
    }
  }
  return short ? 3 : 5;
}

/** True when every strand the kit uses is mastered at the learner's placed level. */
export function roundsAreShort(book: SkillBook, levels: Record<string, number> | null): boolean {
  if (!levels) {
    return false;
  }
  const strands = [...new Set(queenPost.groups.map((group) => group.strand))];
  return strands.every((strand) => {
    const level = levels[strand] ?? 1;
    const at = KIT_SKILLS.filter((skill) => skill.strandId === strand && skill.level === level);
    return at.length > 0 && at.every((skill) => book.skills[skill.id]?.state === "mastered");
  });
}

export function speedLine(totalMs: number, previousMs: number | null): string | null {
  if (previousMs == null) {
    return "fastest run yet";
  }
  const delta = Math.round(previousMs / 1000) - Math.round(totalMs / 1000);
  if (delta > 0) {
    return `${delta} s faster than last time`;
  }
  return null;
}

function wordFor(group: KitGroup, level: number, skillId: string | undefined, grade: GradeChoice | null, seed: number, book?: SkillBook): EarnQuestion {
  const id = skillId ?? currentSkill(book ?? skillsFromLevels(null), group.strand, level).id;
  const ceiling = book ? bookCeiling(book, grade) : undefined;
  const finish = (question: EarnQuestion) => {
    const ready = readyServedQuestion(question);
    if (ready) {
      return ready;
    }
    if (questionNeedsPicture(question)) {
      return fromServed(group.id, serveQuestion({ grade, seed, kind: "run", ceiling }), false);
    }
    return question;
  };
  if (book && !wordAllowed(book.skills[id]?.state)) {
    return finish(fromServed(group.id, serveQuestion({ grade, skillId: id, seed, kind: "run", ceiling }), false));
  }
  if (ladderStep(id)) {
    const served = serveQuestion({ grade, skillId: id, seed, kind: "word", ceiling });
    if (served.item) {
      const sentence = wordPrompt(served.item);
      return finish({
        ...fromServed(group.id, served, false),
        word: sentence,
        fact: { kind: "plain", prompt: sentence, steps: served.item.steps, why: served.item.why, draw: served.item.draw },
      });
    }
  }
  const piece = pieceQuestion(group.id, level);
  const guarded = serveQuestion({
    grade,
    skillId: piece.skillId ?? id,
    seed,
    kind: "word",
    prompt: piece.prompt,
    answer: piece.answer,
    strandId: group.strand,
    ceiling,
  });
  if (group.id !== "planks" && guarded.item) {
    const sentence = wordPrompt(guarded.item);
    return finish({
      ...fromServed(group.id, guarded, false),
      word: sentence,
      fact: { kind: "plain", prompt: sentence, steps: guarded.item.steps, why: guarded.item.why, draw: guarded.item.draw },
    });
  }
  if (group.id !== "planks" && guarded.skillId !== (piece.skillId ?? id)) {
    return finish(fromServed(group.id, guarded, false));
  }
  return finish({
    groupId: group.id,
    strandId: (piece.skillId ?? id).split(".")[0] ?? group.strand,
    level,
    skillId: piece.skillId ?? id,
    answer: piece.answer,
    word: piece.prompt,
    fact: { kind: "piece", prompt: piece.prompt, answer: piece.answer, used: piece.used, slots: piece.slots },
  });
}

export function roundQuestionTotal(round = 0, short = false): number {
  const sitting = queenPost.rounds[round] ?? queenPost.rounds[0];
  const pieces = sitting.groups.reduce((sum, groupId) => sum + runLength(groupId, short) + 1, 0);
  return WARMUP_COUNT + pieces;
}

export function kitQuestionTotal(round = 0, short = false): number {
  return roundQuestionTotal(round, short);
}

function fromServed(groupId: string, served: ReturnType<typeof serveQuestion>, hint: boolean, mixed = false): EarnQuestion {
  const item = served.item;
  const skill = skillQuestion(served.skillId, 1);
  const draw = item?.draw ??
    (item
      ? {
          op: (served.stepId?.startsWith("S") ? "sub" : "add") as "add" | "sub",
          a: item.operands[0] ?? 1,
          b: served.stepId === "A4" ? Number(served.answer) : (item.operands[1] ?? 0),
        }
      : skill.draw);
  return {
    groupId,
    strandId: served.strandId,
    level: served.level,
    answer: served.answer,
    skillId: served.skillId,
    stepId: served.stepId,
    mixed,
    hint: hint ? skillHint(skill) : undefined,
    layout: item?.layout ?? skill.layout,
    action: skill.action,
    sizes: skill.sizes,
    needsPicture: skill.needsPicture || promptNeedsPicture(served.prompt),
    template: skill.template,
    fact: { kind: "plain", prompt: served.prompt, steps: item?.steps ?? skill.steps, why: item?.why ?? skill.why, draw },
  };
}

function rawSlotQuestion(
  groupId: string,
  slot: { skillId: string; strandId: string; level: number; mixed?: boolean },
  seed: number,
  hint: boolean,
  grade: GradeChoice | null = 13,
  kind: ServedKind = "run",
  ceiling?: ServeCeiling,
): EarnQuestion {
  if (ladderStep(slot.skillId)) {
    return fromServed(groupId, serveQuestion({ grade, skillId: slot.skillId, seed, kind, ceiling }), hint, slot.mixed === true);
  }
  if (curriculumSkill(slot.skillId)) {
    const fromSkill = skillQuestion(slot.skillId, seed);
    const served = serveQuestion({
      grade,
      skillId: slot.skillId,
      seed,
      kind,
      prompt: fromSkill.prompt,
      answer: fromSkill.answer,
      strandId: slot.strandId,
      ceiling,
    });
    if (served.skillId !== slot.skillId || served.item) {
      return fromServed(groupId, served, hint, slot.mixed === true);
    }
    return {
      groupId,
      strandId: slot.strandId,
      level: slot.level,
      answer: fromSkill.answer,
      truth: fromSkill.truth,
      skillId: slot.skillId,
      mixed: slot.mixed === true,
      hint: hint ? skillHint(fromSkill) : undefined,
      choices: fromSkill.choices,
      action: fromSkill.action,
      sizes: fromSkill.sizes,
      needsPicture: fromSkill.needsPicture,
      template: fromSkill.template,
      fact: { kind: "plain", prompt: fromSkill.prompt, steps: fromSkill.steps, why: fromSkill.why, draw: fromSkill.draw },
    };
  }
  const fromSkill = plainQuestion(slot.strandId, slot.level, seed);
  const served = serveQuestion({
    grade,
    skillId: slot.skillId,
    seed,
    kind,
    prompt: fromSkill.prompt,
    answer: fromSkill.answer,
    strandId: slot.strandId,
    ceiling,
  });
  if (served.skillId !== slot.skillId || served.item) {
    return fromServed(groupId, served, hint, slot.mixed === true);
  }
  return {
    groupId,
    strandId: slot.strandId,
    level: slot.level,
    answer: fromSkill.answer,
    truth: fromSkill.truth,
    skillId: slot.skillId,
    mixed: slot.mixed === true,
    hint: hint ? skillHint({ ...fromSkill, needsPicture: false }) : undefined,
    needsPicture: promptNeedsPicture(fromSkill.prompt),
    fact: { kind: "plain", prompt: fromSkill.prompt, steps: fromSkill.steps, why: fromSkill.why, draw: fromSkill.draw },
  };
}

function slotQuestion(
  groupId: string,
  slot: { skillId: string; strandId: string; level: number; mixed?: boolean },
  seed: number,
  hint: boolean,
  grade: GradeChoice | null = 13,
  kind: ServedKind = "run",
  ceiling?: ServeCeiling,
): EarnQuestion {
  return readyOrReplace(rawSlotQuestion(groupId, slot, seed, hint, grade, kind, ceiling), groupId, slot, seed, hint, grade, kind, ceiling);
}

export function questionNeedsPicture(question: EarnQuestion): boolean {
  return question.needsPicture === true || promptNeedsPicture(earnPrompt(question));
}

function attachQuestionPicture(question: EarnQuestion): EarnQuestion {
  if (question.word) {
    return question;
  }
  if (question.picture && pictureHasInk(question.picture)) {
    return question;
  }
  if (question.fact.kind !== "plain" || !question.fact.draw) {
    return question;
  }
  const drawn = drawPlain(question.strandId, question.fact.draw, question.answer);
  if (!drawn || !pictureHasInk(drawn.picture)) {
    return question;
  }
  return { ...question, picture: drawn.picture, pictureCaption: drawn.caption };
}

export function readyServedQuestion(question: EarnQuestion): EarnQuestion | null {
  const attached = attachQuestionPicture(question);
  const picture = earnPicture(attached);
  const needs = questionNeedsPicture(question);
  if (needs) {
    if (!picture || !pictureHasInk(picture) || !pictureAgrees(earnPrompt(attached), attached.answer, picture)) {
      return null;
    }
    if (!choicesMatchPicture(attached.choices, picture)) {
      return null;
    }
    return { ...attached, picture, needsPicture: true };
  }
  if (picture && pictureHasInk(picture) && pictureAgrees(earnPrompt(attached), attached.answer, picture)) {
    return { ...attached, picture, needsPicture: false };
  }
  return { ...attached, picture: undefined, needsPicture: false };
}

function readyOrReplace(
  question: EarnQuestion,
  groupId: string,
  slot: { skillId: string; strandId: string; level: number; mixed?: boolean },
  seed: number,
  hint: boolean,
  grade: GradeChoice | null,
  kind: ServedKind,
  ceiling?: ServeCeiling,
): EarnQuestion {
  const ready = readyServedQuestion(question);
  if (ready) {
    return ready;
  }
  if (question.skillId && curriculumSkill(question.skillId) && !ladderStep(question.skillId)) {
    for (let extra = 1; extra <= 20; extra += 1) {
      const next = readyServedQuestion(rawSlotQuestion(groupId, slot, seed + extra * 31, hint, grade, kind, ceiling));
      if (next && (next.skillId === question.skillId || !questionNeedsPicture(next))) {
        return next;
      }
    }
  }
  return fromServed(
    groupId,
    serveQuestion({ grade, skillId: slot.skillId, seed: seed + 101, kind, ceiling }),
    hint,
    slot.mixed === true,
  );
}

type GuardContext = {
  pieceStrand: string;
  allowed: string[];
  levels: Record<string, number>;
  book: SkillBook;
  groupId: string;
  grade?: GradeChoice | null;
  kind?: ServedKind;
  ceiling?: ServeCeiling;
};

function contextFor(
  book: SkillBook,
  pieceStrand: string,
  allowed: string[],
  groupId: string,
  levels?: Record<string, number> | null,
  grade: GradeChoice | null = 13,
  kind: ServedKind = "run",
): GuardContext {
  const known = levels && Object.keys(levels).length > 0 ? levels : strandLevelsFrom(book);
  const ladderGrade = (typeof grade === "number" && grade <= 3) || Boolean(book.ladderStarts);
  return { book, pieceStrand, allowed, groupId, levels: known, grade, kind, ceiling: ladderGrade ? bookCeiling(book, grade) : undefined };
}

function familyAllowed(strandId: string, allowed: string[]): boolean {
  if (allowed.includes(strandId)) {
    return true;
  }
  return (strandId === "adding" || strandId === "subtracting") && (allowed.includes("adding") || allowed.includes("subtracting"));
}

function placedLevel(levels: Record<string, number>, strandId: string): number {
  if (strandId === "subtracting") {
    return levels.subtracting ?? levels.adding ?? 1;
  }
  return levels[strandId] ?? 1;
}

/** One door for every served question. A miss logs the whole context and a legal question goes out instead. */
export function guardQuestion(question: EarnQuestion, context: GuardContext, seed: number, hint: boolean): EarnQuestion {
  const learner = placedLevel(context.levels, question.strandId);
  const remapped =
    Boolean(question.skillId) &&
    !questionAboveCap(question.skillId ?? "", context.grade) &&
    !strandAllowed(context.pieceStrand, context.grade);
  const strandOk = Boolean(question.word) || familyAllowed(question.strandId, context.allowed) || remapped;
  const levelOk = question.level <= learner + 1 && question.level >= learner - 2;
  const step = question.stepId || question.skillId ? ladderStep(question.stepId ?? question.skillId ?? "") : undefined;
  const stepOk = !step || context.ceiling == null || (context.ceiling[step.op] ?? step.n) >= step.n;
  if (strandOk && levelOk && stepOk) {
    return question;
  }
  const strand = strandOk ? question.strandId : context.pieceStrand;
  const level = Math.max(1, Math.min(13, context.levels[strand] ?? 1));
  const ladderOp = strand === "subtracting" ? "S" : strand === "multiplying" ? "M" : strand === "dividing" ? "D" : strand === "adding" ? "A" : null;
  const currentStep = ladderOp && context.ceiling ? bookCurrentStep(context.book, ladderOp, context.grade) : null;
  const skill = (currentStep ? skillById(currentStep.skillId) : null) ?? currentSkill(context.book, strand, level);
  console.error("Served question outside the learner's level", {
    prompt: earnPrompt(question),
    strandId: question.strandId,
    level: question.level,
    skillId: question.skillId,
    groupId: question.groupId,
    pieceStrand: context.pieceStrand,
    allowed: context.allowed,
    levels: context.levels,
    learner,
    replacement: { strand, level, skillId: skill.id },
  });
  return slotQuestion(
    context.groupId,
    { skillId: skill.id, strandId: strand, level, mixed: false },
    seed,
    hint,
    context.grade,
    context.kind,
    context.ceiling,
  );
}

function takePlan(
  groupId: string,
  slots: { skillId: string; strandId: string; level: number; mixed?: boolean }[],
  seed: number,
  seen: string[],
  hint: boolean,
  context: GuardContext,
  banned: Set<string> = new Set(),
): { current: EarnQuestion; upcoming: EarnQuestion[]; seed: number; seen: string[] } {
  const questions: EarnQuestion[] = [];
  let cursor = seed;
  const prompts = new Set(seen);
  for (const slot of slots) {
    let question = slotQuestion(groupId, slot, cursor, hint, context.grade, context.kind, context.ceiling);
    let tries = 0;
    while ((prompts.has(earnPrompt(question)) || banned.has(numberSignature(question)) || outOfRange(question)) && tries < 40) {
      tries += 1;
      cursor += 11;
      const alt =
        tries > 6 && context.ceiling
          ? {
              ...slot,
              skillId: bookCurrentStep(context.book, slot.strandId === "subtracting" ? "S" : slot.strandId === "multiplying" ? "M" : slot.strandId === "dividing" ? "D" : "A", context.grade)
                .skillId,
            }
          : slot;
      question = slotQuestion(groupId, alt, cursor, hint, context.grade, context.kind, context.ceiling);
    }
    question = guardQuestion(question, context, cursor, hint);
    prompts.add(earnPrompt(question));
    banned.add(numberSignature(question));
    questions.push(question);
    cursor += 1;
  }
  return { current: questions[0], upcoming: questions.slice(1), seed: cursor, seen: [...prompts] };
}

function picturedStrand(question: EarnQuestion): boolean {
  if (questionNeedsPicture(question)) {
    return true;
  }
  if (question.word) {
    return false;
  }
  const step = question.skillId ? ladderStep(question.skillId) : undefined;
  if (step) {
    return DOT_STEPS.has(step.id);
  }
  if (question.fact.kind !== "plain") {
    return false;
  }
  if (question.choices && question.choices.length > 0) {
    return question.fact.draw?.op === "angle" || question.fact.draw?.op === "hyp" || question.fact.draw?.op === "frac";
  }
  if (question.strandId === "fractions") {
    return question.fact.draw?.op === "frac";
  }
  if (question.strandId === "geometry") {
    return true;
  }
  return false;
}

function withPicture(question: EarnQuestion): EarnQuestion {
  if (questionNeedsPicture(question)) {
    return readyServedQuestion(question) ?? question;
  }
  if (!picturedStrand(question) || question.fact.kind !== "plain" || !question.fact.draw) {
    return question;
  }
  const drawn = drawPlain(question.strandId, question.fact.draw, question.answer);
  if (!drawn || !pictureHasInk(drawn.picture)) {
    return question;
  }
  if (!pictureAgrees(question.fact.prompt, question.answer, drawn.picture)) {
    console.warn("Picture failed the picture check", {
      prompt: question.fact.prompt,
      answer: question.answer,
      skillId: question.skillId,
    });
    return question;
  }
  return { ...question, picture: drawn.picture };
}

export function attachPlainPicture(question: EarnQuestion): EarnQuestion {
  return withPicture(question);
}

const PICTURE_STRANDS = ["counting", "measuring", "adding", "multiplying", "dividing", "fractions", "ratios", "geometry", "algebra"];

function pictureFits(strandId: string, draw: PlainDraw): boolean {
  if (pictureOp[strandId] && draw.op !== pictureOp[strandId]) {
    return false;
  }
  if (strandId === "counting") {
    return (draw.op === "compare" || draw.op === "add") && draw.a <= 12 && draw.b <= 12;
  }
  if (strandId === "multiplying") {
    return draw.op === "mul" && draw.a <= 5 && draw.b <= 6;
  }
  if (strandId === "dividing") {
    return draw.op === "div" && draw.b > 1 && draw.a / draw.b <= 8 && draw.a % draw.b === 0;
  }
  if (strandId === "fractions") {
    return draw.op === "frac" && (draw.c ?? 0) <= 12;
  }
  return true;
}

const pictureOp: Record<string, string> = {
  fractions: "frac",
  geometry: "hyp",
  ratios: "percent",
  dividing: "div",
};

/** One pictured plain question, for a held screen. */
export function picturedHold(strandId: string, level: number): EarnState {
  const levels = Object.fromEntries(PICTURE_STRANDS.map((id) => [id, level]));
  const base = blankEarn(levels, 2);
  const groupIndex = Math.max(0, queenPost.groups.findIndex((group) => group.strand === strandId));
  const group = queenPost.groups[groupIndex];
  let fallback = base.current;
  for (let seed = 1; seed < 60; seed += 1) {
    const item = plainQuestion(strandId, level, seed);
    const drawn = drawPlain(strandId, item.draw, item.answer);
    if (!drawn) {
      continue;
    }
    const question: EarnQuestion = {
      groupId: group.id,
      strandId,
      level,
      answer: item.answer,
      fact: { kind: "plain", prompt: item.prompt, steps: item.steps, why: item.why, draw: item.draw },
      picture: drawn.picture,
      pictureCaption: drawn.caption,
    };
    fallback = question;
    if (pictureFits(strandId, item.draw)) {
      return { ...base, groupIndex, phase: "plain", returnPhase: "plain", current: question, upcoming: [], runGot: 1 };
    }
  }
  return { ...base, groupIndex, phase: "plain", returnPhase: "plain", current: fallback, upcoming: [], runGot: 1 };
}

function groupAt(index: number): KitGroup {
  return queenPost.groups[index] ?? queenPost.groups[0];
}

function focusIndex(earned: string[], round: number): number {
  const groups = queenPost.rounds[round]?.groups ?? [];
  const next = groups.find((groupId) => !earned.includes(groupId));
  return next ? queenPost.groups.findIndex((group) => group.id === next) : -1;
}

function outOfRange(question: EarnQuestion): boolean {
  if (question.level > 4) {
    return false;
  }
  const prompt = earnPrompt(question).toLowerCase();
  return question.answer.includes(".") || prompt.includes("square root") || prompt.includes("hypotenuse") || prompt.includes("√") || prompt.includes("²");
}

function needsLearn(book: SkillBook, question: EarnQuestion): boolean {
  const skillId = question.skillId;
  return Boolean(skillId && book.skills[skillId]?.state === "new");
}

function currentNewLadderSkill(book: SkillBook, grade: GradeChoice | null) {
  if (book.introduced) {
    return undefined;
  }
  for (const op of ["A", "S", "M", "D"] as const) {
    if (gradeCap(op, grade) <= 0) {
      continue;
    }
    const step = bookCurrentStep(book, op, grade);
    if (book.skills[step.skillId]?.state === "new") {
      return skillById(step.skillId);
    }
  }
  return undefined;
}

export function learnState(state: EarnState, groupIndex: number, levels: Record<string, number>): EarnState | null {
  const group = groupAt(groupIndex);
  const level = workingLevel(state.book, group.strand, levels[group.strand] ?? 1);
  let skill = newSkill(state.book, group.strand, level);
  if (skill && (questionAboveCap(skill.id, state.grade) || !strandAllowed(skill.strandId, state.grade))) {
    skill = null;
  }
  if (!skill && (group.strand === "adding" || !strandAllowed(group.strand, state.grade))) {
    skill = currentNewLadderSkill(state.book, state.grade) ?? null;
  }
  if (!skill) {
    return null;
  }
  const example = guardQuestion(
    slotQuestion(group.id, { skillId: skill.id, strandId: skill.strandId, level: skill.level }, state.seed, false, state.grade, "learn"),
    contextFor(state.book, group.strand, [group.strand], group.id, levels, state.grade, "learn"),
    state.seed,
    false,
  );
  return {
    ...state,
    groupIndex,
    phase: "learn",
    returnPhase: "plain",
    current: example,
    upcoming: [],
    runGot: 0,
    seed: state.seed + 1,
  };
}

function runState(state: EarnState, groupIndex: number, levels: Record<string, number>, shorter = 0): EarnState {
  const group = groupAt(groupIndex);
  const level = workingLevel(state.book, group.strand, levels[group.strand] ?? 1);
  const focus = currentSkill(state.book, group.strand, level);
  const wordReady = !state.short && wordAllowed(state.book.skills[focus.id]?.state);
  const padWord = (typeof state.grade === "number" && state.grade <= 3) || Boolean(state.book.ladderStarts);
  const length = Math.max(1, runLength(group.id, state.short) - shorter + (padWord && !wordReady ? 1 : 0));
  const slots = runPlan(state.book, group.strand, level, length, state.seed, state.grade);
  const plan = takePlan(group.id, slots, state.seed, state.seen, false, contextFor(state.book, group.strand, [group.strand], group.id, levels, state.grade, "run"));
  const seenPrompt = new Set<string>();
  const questions = [plan.current, ...plan.upcoming].map((question, index) => {
    const mask = pictureMask(plan.upcoming.length + 1, state.seed + groupIndex);
    const drawn = questionNeedsPicture(question) ? question : mask[index] ? withPicture(question) : question;
    const line = earnPrompt(drawn);
    if (drawn.picture && seenPrompt.has(line)) {
      seenPrompt.add(earnPrompt(question));
      return question;
    }
    seenPrompt.add(line);
    return drawn;
  });
  return {
    ...state,
    groupIndex,
    phase: "plain",
    returnPhase: "plain",
    current: questions[0],
    upcoming: questions.slice(1),
    runGot: 0,
    seed: plan.seed,
    seen: plan.seen,
    roundsFailed: 0,
    runMisses: 0,
    runFast: true,
  };
}

export function blankEarn(
  levels: Record<string, number> | null,
  seed = 1,
  saved: SkillBook | null = null,
  day = "2026-10-19",
  round = 0,
  grade: GradeChoice | null = 13,
): EarnState {
  const book = beginSession(saved ?? skillsFromLevels(levels));
  const earned = book.earned.slice();
  const short = roundsAreShort(book, levels);
  const index = focusIndex(earned, round);
  const group = groupAt(index < 0 ? 0 : index);
  const slots = warmUpPlan(book, WARMUP_COUNT, group.strand, levels, day, grade);
  const allowed = [...new Set(slots.map((slot) => slot.strandId))];
  const plan = takePlan(
    group.id,
    slots,
    seed,
    [],
    false,
    contextFor(book, group.strand, allowed.length > 0 ? allowed : [group.strand], group.id, levels, grade, "warmup"),
  );
  let cleared = book;
  for (const slot of slots) {
    cleared = clearWarmFlag(cleared, slot.skillId);
  }
  return {
    groupIndex: index < 0 ? 0 : index,
    earned,
    runGot: 0,
    phase: index < 0 ? "done" : "warmup",
    returnPhase: "warmup",
    current: plan.current,
    upcoming: plan.upcoming,
    practice: [],
    practiceIndex: 0,
    streak: 0,
    roundsFailed: 0,
    seed: plan.seed,
    seen: plan.seen,
    timesMs: [],
    speedLine: null,
    book: { ...cleared, earned },
    day,
    steps: 0,
    round,
    short,
    runMisses: 0,
    runFast: true,
    grade,
  };
}

/** A practice run for one piece, used when the lesson is already past the warm-up. */
export function openRun(levels: Record<string, number> | null, groupId: string, seed = 1, saved: SkillBook | null = null): EarnState {
  const base = blankEarn(levels, seed, saved);
  const index = Math.max(0, queenPost.groups.findIndex((group) => group.id === groupId));
  const group = groupAt(index);
  const level = workingLevel(base.book, group.strand, levels?.[group.strand] ?? 1);
  const focus = currentSkill(base.book, group.strand, level);
  const book = base.book.skills[focus.id]?.state === "new" ? withState(base.book, focus.id, "learning") : base.book;
  return runState({ ...base, book }, index, levels ?? {});
}

export function earnAtWord(levels: Record<string, number> | null, groupId: string): EarnState {
  if (groupId === "fractions" || groupId === "ratios" || groupId === "algebra") {
    const word = strandWord(groupId);
    const base = blankEarn(levels, 1);
    const rung = levels?.[groupId] ?? 4;
    const skill = currentSkill(base.book, groupId, rung);
    return {
      ...base,
      phase: "word",
      returnPhase: "word",
      current: {
        groupId: "deck",
        strandId: groupId,
        level: rung,
        answer: word.answer,
        skillId: skill.id,
        fact: { kind: "piece", prompt: word.prompt, answer: word.answer, used: word.used, slots: word.slots },
        word: word.prompt,
      },
      upcoming: [],
    };
  }
  const index = Math.max(0, queenPost.groups.findIndex((group) => group.id === groupId));
  const group = groupAt(index);
  const base = blankEarn(levels, 1);
  const level = workingLevel(base.book, group.strand, levels?.[group.strand] ?? 1);
  const skill = currentSkill(base.book, group.strand, level);
  return {
    ...base,
    groupIndex: index,
    runGot: runLength(group.id, base.short),
    phase: "word",
    returnPhase: "word",
    current: wordFor(group, level, skill.id, base.grade, 1),
    upcoming: [],
  };
}

export function finishedEarn(line: string): EarnState {
  const base = blankEarn(null, 1);
  return {
    ...base,
    phase: "done",
    earned: queenPost.groups.map((group) => group.id),
    speedLine: line,
  };
}

export function earnDone(state: EarnState): boolean {
  return state.phase === "done";
}

export function currentQuestion(state: EarnState): EarnQuestion | null {
  if (state.phase === "done" || state.phase === "learn") {
    return state.phase === "learn" ? state.current : null;
  }
  if (state.phase === "practice") {
    return state.practice[state.practiceIndex] ?? null;
  }
  return state.current;
}

export function startGuided(state: EarnState, levels?: Record<string, number>): EarnState {
  if (state.phase !== "learn" || !state.current.skillId) {
    return state;
  }
  const group = groupAt(state.groupIndex);
  const slots = [0, 1].map(() => ({
    skillId: state.current.skillId ?? "",
    strandId: state.current.strandId,
    level: state.current.level,
  }));
  const plan = takePlan(
    group.id,
    slots,
    state.seed,
    state.seen,
    true,
    contextFor(state.book, group.strand, [state.current.strandId], group.id, levels, state.grade, "learn"),
  );
  return {
    ...state,
    phase: "guided",
    returnPhase: "guided",
    current: plan.current,
    upcoming: plan.upcoming,
    runGot: 0,
    streak: 0,
    seed: plan.seed,
    seen: plan.seen,
  };
}

export function explainQuestion(question: EarnQuestion): { steps: ExplainStep[]; why: string } {
  if (!question.skillId || !curriculumSkill(question.skillId)) {
    return workedExample(question);
  }
  const draw = question.fact.kind === "plain" ? question.fact.draw : undefined;
  return skillExplain(question.skillId, earnPrompt(question), question.answer, draw);
}

/** The numbers in a question, so a practice loop can refuse a repeat. */
export function numberSignature(question: EarnQuestion): string {
  const fact = question.fact;
  if (fact.kind === "plain" && fact.draw) {
    const bits = [fact.draw.a, fact.draw.b];
    if (fact.draw.c != null && fact.draw.c !== -1) {
      bits.push(fact.draw.c);
    }
    return bits
      .map((value) => String(value))
      .sort()
      .join(",");
  }
  return (earnPrompt(question).match(/\d+(\.\d+)?/g) ?? []).sort().join(",");
}

/** 2.8 and 2.83 are both right for 2.828. Whole-number answers stay exact. */
export function acceptsAnswer(given: string, expected: string, truth?: number): boolean {
  const typed = given.trim();
  const wanted = expected.trim();
  if (typed === wanted) {
    return true;
  }
  if (truth == null && !wanted.includes(".")) {
    return false;
  }
  const value = Number(typed);
  const target = truth ?? Number(wanted);
  if (!Number.isFinite(value) || !Number.isFinite(target)) {
    return false;
  }
  const tenths = Math.round(target * 10) / 10;
  const hundredths = Math.round(target * 100) / 100;
  return Math.abs(value - tenths) < 1e-9 || Math.abs(value - hundredths) < 1e-9;
}

export function startPractice(state: EarnState, levels?: Record<string, number>): EarnState {
  if (state.phase !== "explain") {
    return state;
  }
  const group = groupAt(state.groupIndex);
  const skillId = state.current.skillId ?? currentSkill(state.book, group.strand, state.current.level).id;
  const slots = [0, 1, 2].map(() => ({
    skillId,
    strandId: state.current.strandId,
    level: state.current.level,
    mixed: false,
  }));
  const banned = new Set<string>([numberSignature(state.current), ...state.practice.map((question) => numberSignature(question))]);
  const plan = takePlan(
    group.id,
    slots,
    state.seed + 1,
    state.seen,
    false,
    contextFor(state.book, group.strand, [state.current.strandId], group.id, levels, state.grade, "practice"),
    banned,
  );
  return {
    ...state,
    phase: "practice",
    practice: [plan.current, ...plan.upcoming],
    practiceIndex: 0,
    streak: 0,
    seed: plan.seed,
    seen: plan.seen,
  };
}

/** Leave the practice loop for this piece at one level down, and log the skill as struggling. */
export function easierPiece(state: EarnState, levels: Record<string, number>): EarnResult {
  if (state.phase !== "explain") {
    return { state, correct: false, levels, note: null, marksDelta: 0 };
  }
  const strand = state.current.strandId;
  const from = Math.min(levels[strand] ?? state.current.level, state.current.level);
  const nextLevel = Math.max(1, from - 1);
  const nextLevels = fitLevels({ ...levels, [strand]: nextLevel });
  const applied = nextLevels[strand] ?? nextLevel;
  const book = state.current.skillId ? markStruggling(state.book, state.current.skillId) : state.book;
  return {
    correct: false,
    levels: nextLevels,
    note: `${strandName(strand)} is struggling and dropped to level ${applied}.`,
    marksDelta: 0,
    state: continuePiece({ ...state, book, current: { ...state.current, level: applied } }, applied),
  };
}

/** A held Pythagoras explanation, after one failed practice round. */
export function explainHold(strandId: string, level: number, roundsFailed = 1): EarnState {
  const levels = fitLevels(Object.fromEntries(KIT_STRANDS.map((id) => [id, level])));
  const base = blankEarn(levels, 1);
  let chosen = plainQuestion(strandId, level, 1);
  for (let seed = 1; seed < 40; seed += 1) {
    const item = plainQuestion(strandId, level, seed);
    if (item.draw.op === "hyp" && item.draw.a === 3 && item.draw.b === 4) {
      chosen = item;
      break;
    }
    chosen = item;
  }
  const group = queenPost.groups.find((item) => item.strand === strandId) ?? queenPost.groups[0];
  const skill = currentSkill(base.book, strandId, level);
  const question: EarnQuestion = {
    groupId: group.id,
    strandId,
    level,
    answer: chosen.answer,
    truth: chosen.truth,
    skillId: skill.id,
    fact: { kind: "plain", prompt: chosen.prompt, steps: chosen.steps, why: chosen.why, draw: chosen.draw },
  };
  return {
    ...base,
    groupIndex: Math.max(0, queenPost.groups.findIndex((item) => item.id === group.id)),
    phase: "explain",
    returnPhase: "plain",
    current: question,
    upcoming: [],
    roundsFailed,
  };
}

export type EarnResult = {
  state: EarnState;
  correct: boolean;
  levels: Record<string, number>;
  note: string | null;
  marksDelta: number;
  help?: boolean;
};

function continuePiece(state: EarnState, level: number): EarnState {
  const group = groupAt(state.groupIndex);
  const strand = state.current.strandId;
  const skill = currentSkill(state.book, strand, level);
  if (state.returnPhase === "word") {
    return {
      ...state,
      phase: "word",
      returnPhase: "word",
      current: { ...wordFor(group, level, skill.id, state.grade, state.seed, state.book), strandId: strand, level },
      upcoming: [],
      roundsFailed: 0,
      streak: 0,
    };
  }
  const phase = state.returnPhase === "warmup" ? "warmup" : state.returnPhase === "guided" ? "guided" : "plain";
  const count = phase === "warmup" ? WARMUP_COUNT : phase === "guided" ? 3 : Math.max(1, runLength(group.id, state.short));
  const slots = Array.from({ length: count }, () => ({
    skillId: skill.id,
    strandId: strand,
    level,
    mixed: false,
  }));
  const plan = takePlan(
    group.id,
    slots,
    state.seed + 3,
    state.seen,
    phase === "guided",
    contextFor(state.book, group.strand, [strand], group.id, undefined, state.grade, phase === "guided" ? "learn" : phase === "warmup" ? "warmup" : "run"),
  );
  return {
    ...state,
    phase,
    current: plan.current,
    upcoming: plan.upcoming,
    seed: plan.seed,
    seen: plan.seen,
    roundsFailed: 0,
    streak: 0,
  };
}

function resume(state: EarnState, levels: Record<string, number>): EarnState {
  const group = groupAt(state.groupIndex);
  const level = state.current.level;
  if (state.returnPhase === "word") {
    const skill = currentSkill(state.book, group.strand, workingLevel(state.book, group.strand, levels[group.strand] ?? level));
    return {
      ...state,
      phase: "word",
      returnPhase: "word",
      current: wordFor(group, level, skill.id, state.grade, state.seed, state.book),
      roundsFailed: 0,
      streak: 0,
    };
  }
  const phase = state.returnPhase === "warmup" ? "warmup" : state.returnPhase === "guided" ? "guided" : "plain";
  const fresh = slotQuestion(
    group.id,
    { skillId: state.current.skillId ?? currentSkill(state.book, group.strand, level).id, strandId: state.current.strandId, level, mixed: state.current.mixed },
    state.seed,
    phase === "guided",
    state.grade,
    phase === "guided" ? "learn" : phase === "warmup" ? "warmup" : "run",
  );
  return { ...state, phase, current: fresh, seed: state.seed + 1, roundsFailed: 0, streak: 0 };
}

function advanceStep(state: EarnState, book: SkillBook = state.book): EarnState {
  const steps = Math.min(kitQuestionTotal(state.round, state.short), state.steps + 1);
  return { ...state, steps, book: { ...book, steps } };
}

/** A new kit: round 1, no pieces earned, bar at zero. */
export function freshKit(levels: Record<string, number> | null, saved: SkillBook | null = null): EarnState {
  const book = saved ? { ...saved, earned: [], steps: 0 } : null;
  return blankEarn(levels, 1, book, "2026-10-19", 0);
}

/** The last question of a round, with the bar one step from full. */
export function roundEndHold(levels: Record<string, number> | null, round = 0): EarnState {
  const state = blankEarn(levels, 1, null, "2026-10-19", round);
  const groups = queenPost.rounds[round]?.groups ?? [];
  const lastId = groups[groups.length - 1] ?? queenPost.groups[0].id;
  const index = Math.max(0, queenPost.groups.findIndex((group) => group.id === lastId));
  const group = groupAt(index);
  const level = levels?.[group.strand] ?? 4;
  const skill = currentSkill(state.book, group.strand, level);
  const total = kitQuestionTotal(round, state.short);
  return {
    ...state,
    groupIndex: index,
    earned: groups.slice(0, -1),
    phase: "word",
    returnPhase: "word",
    current: wordFor(group, level, skill.id, state.grade, 1, state.book),
    upcoming: [],
    runGot: runLength(group.id, state.short),
    steps: Math.max(0, total - 1),
  };
}

function afterWarmup(state: EarnState, levels: Record<string, number>): EarnState {
  const index = focusIndex(state.earned, state.round);
  if (index < 0) {
    return { ...state, phase: "done", speedLine: speedLine(state.timesMs.reduce((sum, time) => sum + time, 0), null) };
  }
  return learnState(state, index, levels) ?? runState(state, index, levels);
}

function afterPiece(state: EarnState, levels: Record<string, number>, groupId: string): EarnState {
  const earned = [...new Set([...state.earned, groupId])];
  const book = closeTallies({ ...state.book, earned }, state.day);
  const nextLevels = { ...levels, ...strandLevelsFrom(book) };
  const index = focusIndex(earned, state.round);
  if (index < 0) {
    const total = state.timesMs.reduce((sum, time) => sum + time, 0);
    return { ...state, earned, book, phase: "done", speedLine: speedLine(total, null) };
  }
  const withBook = { ...state, earned, book };
  return learnState(withBook, index, nextLevels) ?? runState(withBook, index, nextLevels);
}

/**
 * Five or eight plain questions, then one word problem, earn the piece.
 * A miss explains the skill and runs three practice questions, then the run continues at the same count.
 */
export function answerEarn(
  state: EarnState,
  given: string,
  levels: Record<string, number> = {},
  elapsedMs = 0,
  previousMs: number | null = null,
  help = false,
): EarnResult {
  const current = currentQuestion(state);
  if (!current || state.phase === "explain" || state.phase === "done" || state.phase === "learn") {
    return { state, correct: false, levels, note: null, marksDelta: 0 };
  }
  const note = { ms: elapsedMs, day: state.day, mixed: current.mixed === true };
  if (help === true) {
    const returnPhase = state.phase === "word" ? "word" : state.phase === "warmup" ? "warmup" : state.phase === "guided" ? "guided" : "plain";
    const book = current.skillId ? rememberAnswer(state.book, current.skillId, earnPrompt(current), false, true, note) : state.book;
    return {
      correct: false,
      help: true,
      levels,
      note: null,
      marksDelta: 0,
      state: { ...state, book, phase: "explain", returnPhase, streak: 0, practiceIndex: 0 },
    };
  }
  const correct = acceptsAnswer(given, current.answer, current.truth);
  if (state.phase === "practice") {
    if (!correct) {
      const roundsFailed = state.roundsFailed + 1;
      if (roundsFailed >= 2) {
        const from = levels[current.strandId] ?? current.level;
        const nextLevel = Math.max(1, from - 1);
        const nextLevels = fitLevels({ ...levels, [current.strandId]: nextLevel });
        const applied = nextLevels[current.strandId] ?? nextLevel;
        const book = current.skillId ? markStruggling(state.book, current.skillId) : state.book;
        return {
          correct: false,
          levels: nextLevels,
          note: `${current.strandId} dropped to level ${applied} after two practice rounds.`,
          marksDelta: 0,
          state: continuePiece({ ...state, book, roundsFailed, current: { ...state.current, level: applied } }, applied),
        };
      }
      return {
        correct: false,
        levels,
        note: null,
        marksDelta: 0,
        state: { ...state, phase: "explain", roundsFailed, streak: 0, practiceIndex: 0 },
      };
    }
    const streak = state.streak + 1;
    if (streak >= 3) {
      return { correct: true, levels, note: null, marksDelta: 0, state: resume(state, levels) };
    }
    return { correct: true, levels, note: null, marksDelta: 0, state: { ...state, streak, practiceIndex: state.practiceIndex + 1 } };
  }
  const runMisses = state.phase === "plain" && !correct ? state.runMisses + 1 : state.runMisses;
  const runFast =
    state.phase === "plain" && (!correct || (current.skillId ? elapsedMs > timeTargetFor(current.skillId) * 1000 : false))
      ? false
      : state.runFast;
  if (!correct) {
    const returnPhase = state.phase === "word" ? "word" : state.phase === "warmup" ? "warmup" : state.phase === "guided" ? "guided" : "plain";
    const book =
      state.phase === "word" && current.skillId
        ? flagWarmUp(state.book, current.skillId)
        : current.skillId
          ? rememberAnswer(state.book, current.skillId, earnPrompt(current), false, false, note)
          : state.book;
    return {
      correct: false,
      levels,
      note: null,
      marksDelta: 0,
      state: { ...state, book, phase: "explain", returnPhase, streak: 0, runMisses, runFast },
    };
  }
  if (state.phase === "word") {
    const group = queenPost.groups.find((item) => item.id === current.groupId);
    const finished = afterPiece(advanceStep({ ...state, runMisses, runFast }), levels, current.groupId);
    const boosted = maybeBoostStrand(finished.book, levels, group?.strand ?? current.strandId, state.day, state.runMisses === 0 && state.runFast);
    const nextState = {
      ...finished,
      book: boosted.book,
      speedLine: finished.phase === "done" ? speedLine(state.timesMs.reduce((sum, time) => sum + time, 0), previousMs) : finished.speedLine,
    };
    return {
      correct: true,
      levels: fitLevels({ ...boosted.levels, ...strandLevelsFrom(nextState.book) }),
      note: null,
      marksDelta: 3,
      state: nextState,
    };
  }
  const book = current.skillId ? rememberAnswer(state.book, current.skillId, earnPrompt(current), true, false, note) : state.book;
  const timesMs = [...state.timesMs, elapsedMs];
  const runGot = state.runGot + 1;
  const counted = advanceStep({ ...state, book, timesMs, runGot, runMisses, runFast });
  if (state.phase === "guided") {
    const streak = state.streak + 1;
    if (streak >= 2) {
      const learned = current.skillId ? markLearning(counted.book, current.skillId) : counted.book;
      return { correct: true, levels, note: null, marksDelta: 1, state: runState({ ...counted, book: learned, streak: 0 }, state.groupIndex, levels, 3) };
    }
    if (state.upcoming.length > 0) {
      return {
        correct: true,
        levels,
        note: null,
        marksDelta: 1,
        state: { ...counted, streak, current: state.upcoming[0], upcoming: state.upcoming.slice(1) },
      };
    }
    const extra = slotQuestion(
      groupAt(state.groupIndex).id,
      { skillId: current.skillId ?? "", strandId: current.strandId, level: current.level },
      counted.seed,
      true,
      state.grade,
      "learn",
    );
    return { correct: true, levels, note: null, marksDelta: 1, state: { ...counted, streak, current: extra, upcoming: [] } };
  }
  if (state.upcoming.length > 0) {
    const next = state.upcoming[0];
    const rest = state.upcoming.slice(1);
    const piece = groupAt(state.groupIndex).strand;
    const showing =
      state.phase === "plain" && needsLearn(counted.book, next) && next.strandId === piece
        ? { ...counted, phase: "learn" as const, current: next, upcoming: rest }
        : { ...counted, current: next, upcoming: rest };
    return {
      correct: true,
      levels,
      note: null,
      marksDelta: 1,
      state: showing,
    };
  }
  if (state.phase === "warmup") {
    return { correct: true, levels, note: null, marksDelta: 1, state: afterWarmup(counted, levels) };
  }
  const group = groupAt(state.groupIndex);
  const level = workingLevel(book, group.strand, levels[group.strand] ?? current.level);
  const skill = currentSkill(book, group.strand, level);
  const allowWord = !state.short && wordAllowed(book.skills[skill.id]?.state);
  if (!allowWord) {
    return { correct: true, levels, note: null, marksDelta: 1, state: afterPiece(counted, levels, group.id) };
  }
  const word = guardQuestion(
    wordFor(group, level, skill.id, state.grade, state.seed, book),
    contextFor(book, group.strand, [group.strand], group.id, levels, state.grade, "word"),
    state.seed,
    false,
  );
  return {
    correct: true,
    levels,
    note: null,
    marksDelta: 1,
    state: {
      ...counted,
      phase: "word",
      returnPhase: "word",
      upcoming: [],
      current: word,
      roundsFailed: 0,
    },
  };
}

export function lessonFrame(kind: "warmup" | "learn" | "guided" | "mixed", levels: Record<string, number> | null): EarnState {
  const state = blankEarn(levels, 4);
  if (kind === "warmup") {
    return state;
  }
  const learned = afterWarmup(state, levels ?? {});
  if (kind === "learn") {
    return learned;
  }
  const guided = learned.phase === "learn" ? startGuided(learned) : learned;
  if (kind === "guided") {
    return guided;
  }
  const running = guided.phase === "guided" ? runState(guided, guided.groupIndex, levels ?? {}) : guided;
  const mixed = [running.current, ...running.upcoming].find((question) => question.mixed) ?? running.current;
  return { ...running, phase: "plain", returnPhase: "plain", current: mixed };
}

/** Hold one curriculum skill question on the earn card (for screenshots and choice UI tests). */
export function skillHold(skillId: string, seed = 3): EarnState {
  const skill = curriculumSkill(skillId);
  if (!skill) {
    throw new Error(`Unknown skill ${skillId}`);
  }
  const levels = fitLevels(Object.fromEntries(KIT_STRANDS.map((id) => [id, Math.max(skill.level, 4)])));
  const base = blankEarn(levels, seed);
  const item = skillQuestion(skillId, seed);
  const groupIndex = Math.max(0, queenPost.groups.findIndex((group) => group.strand === skill.strandId));
  const group = queenPost.groups[groupIndex] ?? queenPost.groups[0];
  let question: EarnQuestion = {
    groupId: group.id,
    strandId: skill.strandId,
    level: skill.level,
    answer: item.answer,
    truth: item.truth,
    skillId,
    stepId: item.stepId,
    layout: item.layout,
    choices: item.choices,
    action: item.action,
    sizes: item.sizes,
    fact: { kind: "plain", prompt: item.prompt, steps: item.steps, why: item.why, draw: item.draw },
  };
  question = {
    ...question,
    needsPicture: item.needsPicture,
    template: item.template,
  };
  question = readyServedQuestion(question) ?? withPicture(question);
  return {
    ...base,
    groupIndex,
    phase: "plain",
    returnPhase: "plain",
    current: question,
    upcoming: [],
    runGot: 1,
  };
}

/** One question a learner at this grade might be served. */
export function serveGradeQuestion(grade: number, seed: number): EarnQuestion {
  const cap = gradeNumber(grade) + 2;
  const skills = CURRICULUM_SKILLS.filter((skill) => skill.level <= cap && strandAllowed(skill.strandId, grade));
  const skill = skills[Math.abs(seed) % Math.max(skills.length, 1)];
  if (!skill) {
    return fromServed("bottom", serveQuestion({ grade, seed, kind: "run" }), false);
  }
  const groupId = queenPost.groups.find((group) => group.strand === skill.strandId)?.id ?? "bottom";
  return slotQuestion(groupId, { skillId: skill.id, strandId: skill.strandId, level: skill.level }, seed, false, grade, "run");
}

export type PictureTemplateHold = {
  id: string;
  skillId: string;
  prompt: string;
  question: EarnQuestion;
};

/** One served example of every needsPicture template. */
export function listPictureTemplates(): PictureTemplateHold[] {
  const seen = new Set<string>();
  const found: PictureTemplateHold[] = [];
  for (const skill of CURRICULUM_SKILLS) {
    for (const seed of [1, 2, 3, 4, 5, 8, 11, 17]) {
      const item = skillQuestion(skill.id, seed);
      if (!item.needsPicture) {
        continue;
      }
      const id = item.template ?? pictureTemplate(item.prompt, item.draw);
      if (seen.has(id)) {
        continue;
      }
      const held = skillHold(skill.id, seed);
      if (!held.current.picture || !pictureHasInk(held.current.picture)) {
        continue;
      }
      seen.add(id);
      found.push({ id, skillId: skill.id, prompt: earnPrompt(held.current), question: held.current });
    }
  }
  return found;
}

export function stackHold(spec: string): EarnState {
  const parsed = parseStackSpec(spec);
  if (!parsed) {
    throw new Error(`Unknown stack ${spec}`);
  }
  const strand = parsed.layout.op === "×" ? "multiplying" : parsed.layout.op === "÷" ? "dividing" : parsed.layout.op === "−" ? "adding" : "adding";
  const levels = fitLevels(Object.fromEntries(KIT_STRANDS.map((id) => [id, 4])));
  const base = blankEarn(levels, 1);
  return {
    ...base,
    groupIndex: 0,
    phase: "plain",
    returnPhase: "plain",
    current: {
      groupId: "bottom",
      strandId: strand,
      level: 4,
      answer: parsed.answer,
      layout: parsed.layout,
      fact: { kind: "plain", prompt: parsed.prompt, steps: ["Write the numbers in columns."], why: "The stack is in the sketch." },
    },
    upcoming: [],
    runGot: 1,
  };
}

