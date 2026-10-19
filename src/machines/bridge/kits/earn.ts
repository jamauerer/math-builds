import type { LearnerMap } from "../../../engine/placement";
import { formatLength, formatWeight, lengthAbbrev, lengthName } from "../../../units";
import { plainQuestion } from "./plain";
import { drawPlain } from "../../../pictures";
import { labelAt, slice } from "../../../pictures/layout";
import { pictureMask } from "../../../pictures/pick";
import type { Picture, PlainDraw } from "../../../pictures/parts";
import { queenPost, type KitGroup } from "./kit";
import {
  beginSession,
  clearWarmFlag,
  closeTallies,
  currentSkill,
  flagWarmUp,
  KIT_SKILLS,
  markLearning,
  newSkill,
  rememberAnswer,
  runPlan,
  skillsFromLevels,
  strandLevelsFrom,
  warmUpPlan,
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
  if (question.pictureCaption) {
    return question.pictureCaption;
  }
  if (question.word) {
    return question.word;
  }
  const fact = question.fact;
  if (fact.kind === "plain") {
    return fact.prompt;
  }
  switch (fact.kind) {
    case "count-planks":
      return "How many planks reach across?";
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
      return "Each post is labeled. How much timber do the posts use together?";
    case "triangles":
      return "Each diagonal makes 2 triangles. How many triangles is that?";
    case "beam-weight":
      return "The beam is split into pieces. Each piece is labeled. How heavy is the whole beam?";
    case "bolts-combine":
      return "Each gusset plate is labeled with its bolts. How many bolts is that?";
    case "rail-both":
      return "The railing runs both sides. One side is labeled. How long is the railing?";
    case "split-gap":
      return `The gap is labeled in ${lengthName(2)}. It is shared by the beams. How long is each beam?`;
    case "add-parts":
      return "The two pieces are labeled. How long are they together?";
    case "brace-hyp":
      return "The brace is the long side of this right triangle. How long is it?";
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

function wordPicture(question: EarnQuestion): EarnPicture {
  const fact = question.fact;
  if (question.groupId === "planks") {
    return slice(["bottom-a", "bottom-b", "plank-1"], [labelAt("bottom-a", formatLength(4)), labelAt("bottom-b", formatLength(4)), labelAt("plank-1", formatLength(1), -22)]);
  }
  return factPicture(fact);
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
    default:
      return slice(beams);
  }
}

export function earnPicture(question: EarnQuestion): EarnPicture | null {
  if (question.picture) {
    return question.picture;
  }
  if (question.word) {
    return wordPicture(question);
  }
  const fact = question.fact;
  if (fact.kind === "plain") {
    return null;
  }
  return factPicture(fact);
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
    default:
      return "";
  }
}

function factFor(group: KitGroup, level: number, salt = 0): EarnFact {
  const bump = salt % 3;
  if (group.id === "braces") {
    if (level >= 9) {
      return { kind: "brace-hyp", across: 2, up: 2 };
    }
    if (level <= 3) {
      return { kind: "count-braces", count: Math.min(2, group.count) };
    }
    return { kind: "triangles", diagonals: 2, each: 2 };
  }
  if (level <= 3) {
    if (group.id === "bottom") {
      return { kind: "count-planks", count: salt === 0 ? queenPost.span : 5 + bump };
    }
    if (group.id === "posts") {
      return { kind: "count-posts", count: Math.min(2, group.count) };
    }
    if (group.id === "gussets") {
      return { kind: "count-gussets", count: Math.min(5, group.count) };
    }
    if (group.id === "top") {
      return { kind: "count-pieces", count: 3 };
    }
    if (group.id === "bolts") {
      return { kind: "count-bolts", count: Math.min(5, 4 + bump) };
    }
    if (group.id === "planks") {
      return { kind: "count-planks", count: Math.min(8, group.count) };
    }
    return { kind: "count-rails", count: Math.min(2, group.count) };
  }
  if (group.id === "bottom") {
    const gap = queenPost.span + bump * 2;
    return { kind: "split-gap", gap, beams: group.count };
  }
  if (group.id === "posts") {
    return { kind: "between-posts", left: 2, right: 6 + bump };
  }
  if (group.id === "gussets") {
    return { kind: "count-gussets", count: Math.min(5, 4 + bump) };
  }
  if (group.id === "top") {
    return { kind: "add-parts", left: 2 + bump, right: 3 };
  }
  if (group.id === "bolts") {
    return { kind: "bolts-combine", plates: 3 + bump, each: 2 };
  }
  if (group.id === "planks") {
    return { kind: "count-planks", count: group.count };
  }
  return { kind: "rail-both", side: queenPost.span - bump };
}

export function questionForStrand(strandId: string, level: number, salt = 0): EarnQuestion {
  const group = queenPost.groups.find((item) => item.strand === strandId) ?? queenPost.groups[0];
  return questionFor(group, level, salt);
}

function questionFor(group: KitGroup, level: number, salt = 0): EarnQuestion {
  const rung = Math.min(13, Math.max(1, level));
  const fact = factFor(group, rung, salt);
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

function wordFor(group: KitGroup, level: number, skillId?: string): EarnQuestion {
  const strandId = group.strand;
  const gap = formatLength(8);
  const two = formatLength(2);
  const six = formatLength(6);
  const four = formatLength(4);
  const one = formatLength(1);
  const unit = lengthAbbrev();
  const base =
    group.id === "top"
      ? {
          answer: "4",
          word: `One post stands at ${two} and the other stands at ${six}. How long is the top beam between them?`,
          fact: { kind: "between-posts" as const, left: 2, right: 6 },
        }
      : group.id === "bolts"
        ? {
            answer: "10",
            word: `Each plate takes 2 bolts, and there are 5 plates. How many bolts is that? Lengths are in ${unit}.`,
            fact: { kind: "bolts-combine" as const, plates: 5, each: 2 },
          }
        : group.id === "bottom"
          ? {
              answer: "4",
              word: `The gap is ${gap} across. Two beams of the same length lie end to end to cross it. How long is each beam?`,
              fact: { kind: "split-gap" as const, gap: 8, beams: 2 },
            }
          : group.id === "posts"
            ? {
                answer: "2",
                word: `How many posts hold the beam up? Lengths are in ${unit}.`,
                fact: { kind: "count-posts" as const, count: 2 },
              }
            : group.id === "gussets"
              ? {
                  answer: "5",
                  word: `How many gusset plates join the corners? Lengths are in ${unit}.`,
                  fact: { kind: "count-gussets" as const, count: 5 },
                }
              : group.id === "braces"
                ? {
                    answer: "2",
                    word: `How many braces stop the posts from folding? Lengths are in ${unit}.`,
                    fact: { kind: "count-braces" as const, count: 2 },
                  }
                : group.id === "planks"
                  ? {
                      answer: "8",
                      word: `Each plank is ${one} long. The path is two beams of ${four} laid end to end. How many planks cover the path?`,
                      fact: { kind: "count-planks" as const, count: 8, plank: 1, beam: 4 },
                    }
                : {
                    answer: "16",
                    word: `The deck is ${gap} long. The railing runs along both sides. How long is the railing altogether?`,
                    fact: { kind: "rail-both" as const, side: 8 },
                  };
  return { groupId: group.id, strandId, level, skillId, ...base };
}

export function roundQuestionTotal(round = 0, short = false): number {
  const sitting = queenPost.rounds[round] ?? queenPost.rounds[0];
  const pieces = sitting.groups.reduce((sum, groupId) => sum + runLength(groupId, short) + 1, 0);
  return WARMUP_COUNT + pieces;
}

export function kitQuestionTotal(round = 0, short = false): number {
  return roundQuestionTotal(round, short);
}

function slotQuestion(groupId: string, slot: { skillId: string; strandId: string; level: number; mixed?: boolean }, seed: number, hint: boolean): EarnQuestion {
  const item = plainQuestion(slot.strandId, slot.level, seed);
  return {
    groupId,
    strandId: slot.strandId,
    level: slot.level,
    answer: item.answer,
    skillId: slot.skillId,
    mixed: slot.mixed === true,
    hint: hint ? item.steps[0] : undefined,
    fact: { kind: "plain", prompt: item.prompt, steps: item.steps, why: item.why, draw: item.draw },
  };
}

function takePlan(groupId: string, slots: { skillId: string; strandId: string; level: number; mixed?: boolean }[], seed: number, seen: string[], hint: boolean): { current: EarnQuestion; upcoming: EarnQuestion[]; seed: number; seen: string[] } {
  const questions: EarnQuestion[] = [];
  let cursor = seed;
  const prompts = new Set(seen);
  for (const slot of slots) {
    let question = slotQuestion(groupId, slot, cursor, hint);
    while (prompts.has(earnPrompt(question)) && cursor < seed + 40) {
      cursor += 1;
      question = slotQuestion(groupId, slot, cursor, hint);
    }
    prompts.add(earnPrompt(question));
    questions.push(question);
    cursor += 1;
  }
  return { current: questions[0], upcoming: questions.slice(1), seed: cursor, seen: [...prompts] };
}

function withPicture(question: EarnQuestion): EarnQuestion {
  if (question.fact.kind !== "plain" || !question.fact.draw) {
    return question;
  }
  const drawn = drawPlain(question.strandId, question.fact.draw, question.answer);
  if (!drawn || drawn.picture.bits.length === 0) {
    return question;
  }
  return { ...question, picture: drawn.picture, pictureCaption: drawn.caption };
}

const PICTURE_STRANDS = ["counting", "measuring", "adding", "multiplying", "dividing", "fractions", "ratios", "geometry", "algebra"];

function pictureFits(strandId: string, draw: PlainDraw): boolean {
  if (pictureOp[strandId] && draw.op !== pictureOp[strandId]) {
    return false;
  }
  if (strandId === "counting" || strandId === "adding") {
    return draw.op === "add" && draw.a <= 8 && draw.b <= 8;
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

function learnState(state: EarnState, groupIndex: number, levels: Record<string, number>): EarnState | null {
  const group = groupAt(groupIndex);
  const level = workingLevel(state.book, group.strand, levels[group.strand] ?? 1);
  const skill = newSkill(state.book, group.strand, level);
  if (!skill || state.book.introduced) {
    return null;
  }
  const example = slotQuestion(group.id, { skillId: skill.id, strandId: skill.strandId, level: skill.level }, state.seed, false);
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

function runState(state: EarnState, groupIndex: number, levels: Record<string, number>): EarnState {
  const group = groupAt(groupIndex);
  const level = workingLevel(state.book, group.strand, levels[group.strand] ?? 1);
  const slots = runPlan(state.book, group.strand, level, runLength(group.id, state.short), state.seed);
  const plan = takePlan(group.id, slots, state.seed, state.seen, false);
  const questions = [plan.current, ...plan.upcoming].map((question, index) => {
    const mask = pictureMask(plan.upcoming.length + 1, state.seed + groupIndex);
    return mask[index] ? withPicture(question) : question;
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
  };
}

export function blankEarn(levels: Record<string, number> | null, seed = 1, saved: SkillBook | null = null, day = "2026-10-19", round = 0): EarnState {
  const book = beginSession(saved ?? skillsFromLevels(levels));
  const earned = book.earned.slice();
  const short = roundsAreShort(book, levels);
  const index = focusIndex(earned, round);
  const group = groupAt(index < 0 ? 0 : index);
  const slots = warmUpPlan(book, WARMUP_COUNT);
  const plan = takePlan(group.id, slots, seed, [], false);
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
  };
}

/** A practice run for one piece, used when the lesson is already past the warm-up. */
export function openRun(levels: Record<string, number> | null, groupId: string, seed = 1): EarnState {
  const base = blankEarn(levels, seed);
  const index = Math.max(0, queenPost.groups.findIndex((group) => group.id === groupId));
  return runState(base, index, levels ?? {});
}

export function earnAtWord(levels: Record<string, number> | null, groupId: string): EarnState {
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
    current: wordFor(group, level, skill.id),
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

export function startGuided(state: EarnState): EarnState {
  if (state.phase !== "learn" || !state.current.skillId) {
    return state;
  }
  const book = markLearning(state.book, state.current.skillId);
  const group = groupAt(state.groupIndex);
  const slots = [0, 1, 2].map(() => ({
    skillId: state.current.skillId ?? "",
    strandId: state.current.strandId,
    level: state.current.level,
  }));
  const plan = takePlan(group.id, slots, state.seed, state.seen, true);
  return {
    ...state,
    book,
    phase: "guided",
    returnPhase: "guided",
    current: plan.current,
    upcoming: plan.upcoming,
    runGot: 0,
    seed: plan.seed,
    seen: plan.seen,
  };
}

export function explainQuestion(question: EarnQuestion): { steps: string[]; why: string } {
  const fact = question.fact;
  if (fact.kind === "plain") {
    return { steps: fact.steps, why: fact.why };
  }
  const answer = question.answer;
  if (fact.kind === "brace-hyp") {
    return {
      steps: ["Square the across side.", "Square the up side and add those squares.", `The square root is ${answer}.`],
      why: "The long side of a right triangle is that square root.",
    };
  }
  if (fact.kind === "split-gap") {
    return {
      steps: ["Read the gap.", "Share it into equal beams.", `Each beam is ${answer}.`],
      why: "Sharing a length into equal parts is dividing.",
    };
  }
  if (fact.kind === "between-posts") {
    return {
      steps: ["Read the two marks.", "Subtract the left mark from the right mark.", `The beam between them is ${answer}.`],
      why: "The distance between two marks is the difference.",
    };
  }
  if (fact.kind.startsWith("count")) {
    return {
      steps: ["Count each piece once.", `You land on ${answer}.`],
      why: "Count the pieces.",
    };
  }
  return {
    steps: ["Read each label.", "Combine the labels.", `That comes to ${answer}.`],
    why: "The labels are the parts. The question asks for them together.",
  };
}

export function startPractice(state: EarnState): EarnState {
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
  const plan = takePlan(group.id, slots, state.seed + 1, state.seen, false);
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

export type EarnResult = {
  state: EarnState;
  correct: boolean;
  levels: Record<string, number>;
  note: string | null;
  marksDelta: number;
};

function resume(state: EarnState, levels: Record<string, number>): EarnState {
  const group = groupAt(state.groupIndex);
  const level = state.current.level;
  if (state.returnPhase === "word") {
    const skill = currentSkill(state.book, group.strand, workingLevel(state.book, group.strand, levels[group.strand] ?? level));
    return { ...state, phase: "word", returnPhase: "word", current: wordFor(group, level, skill.id), roundsFailed: 0, streak: 0 };
  }
  const phase = state.returnPhase === "warmup" ? "warmup" : state.returnPhase === "guided" ? "guided" : "plain";
  const fresh = slotQuestion(
    group.id,
    { skillId: state.current.skillId ?? currentSkill(state.book, group.strand, level).id, strandId: state.current.strandId, level, mixed: state.current.mixed },
    state.seed,
    phase === "guided",
  );
  return { ...state, phase, current: fresh, seed: state.seed + 1, roundsFailed: 0, streak: 0 };
}

function advanceStep(state: EarnState, book: SkillBook = state.book): EarnState {
  const steps = state.steps + 1;
  return { ...state, steps, book: { ...book, steps } };
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
): EarnResult {
  const current = currentQuestion(state);
  if (!current || state.phase === "explain" || state.phase === "done" || state.phase === "learn") {
    return { state, correct: false, levels, note: null, marksDelta: 0 };
  }
  const correct = given.trim() === current.answer.trim();
  if (state.phase === "practice") {
    if (!correct) {
      const roundsFailed = state.roundsFailed + 1;
      if (roundsFailed >= 2) {
        const nextLevel = Math.max(1, (levels[current.strandId] ?? current.level) - 1);
        const nextLevels = { ...levels, [current.strandId]: nextLevel };
        return {
          correct: false,
          levels: nextLevels,
          note: `${current.strandId} dropped to level ${nextLevel} after two practice rounds.`,
          marksDelta: 0,
          state: resume({ ...state, roundsFailed, current: { ...state.current, level: nextLevel } }, nextLevels),
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
  if (!correct) {
    const returnPhase = state.phase === "word" ? "word" : state.phase === "warmup" ? "warmup" : state.phase === "guided" ? "guided" : "plain";
    const book =
      state.phase === "word" && current.skillId
        ? flagWarmUp(state.book, current.skillId)
        : current.skillId
          ? rememberAnswer(state.book, current.skillId, earnPrompt(current), false)
          : state.book;
    return {
      correct: false,
      levels,
      note: null,
      marksDelta: 0,
      state: { ...state, book, phase: "explain", returnPhase },
    };
  }
  if (state.phase === "word") {
    const finished = afterPiece(advanceStep(state), levels, current.groupId);
    const total = state.timesMs.reduce((sum, time) => sum + time, 0);
    const nextState = finished.phase === "done" ? { ...finished, speedLine: speedLine(total, previousMs) } : finished;
    return {
      correct: true,
      levels: { ...levels, ...strandLevelsFrom(nextState.book) },
      note: null,
      marksDelta: 3,
      state: nextState,
    };
  }
  const book = current.skillId ? rememberAnswer(state.book, current.skillId, earnPrompt(current), true) : state.book;
  const timesMs = [...state.timesMs, elapsedMs];
  const runGot = state.runGot + 1;
  const counted = advanceStep({ ...state, book, timesMs, runGot });
  if (state.upcoming.length > 0) {
    return {
      correct: true,
      levels,
      note: null,
      marksDelta: 1,
      state: { ...counted, current: state.upcoming[0], upcoming: state.upcoming.slice(1) },
    };
  }
  if (state.phase === "warmup") {
    return { correct: true, levels, note: null, marksDelta: 1, state: afterWarmup(counted, levels) };
  }
  if (state.phase === "guided") {
    return { correct: true, levels, note: null, marksDelta: 1, state: runState(counted, state.groupIndex, levels) };
  }
  const group = groupAt(state.groupIndex);
  const skill = currentSkill(book, group.strand, current.level);
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
      current: wordFor(group, current.level, skill.id),
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

