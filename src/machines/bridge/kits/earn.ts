import type { LearnerMap } from "../../../engine/placement";
import { formatLength, formatWeight, lengthName } from "../../../units";
import { plainQuestion } from "./plain";
import { queenPost, type KitGroup } from "./kit";
import {
  beginSession,
  clearWarmFlag,
  closeTallies,
  currentSkill,
  flagWarmUp,
  isSmallPiece,
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
  | { kind: "count-planks"; count: number }
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
  | { kind: "plain"; prompt: string; steps: string[]; why: string };

export type EarnBit = {
  sprite: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotate?: number;
};

export type EarnLabel = {
  text: string;
  x: number;
  y: number;
};

export type EarnPicture = {
  banks: boolean;
  ruler: boolean;
  bits: EarnBit[];
  labels: EarnLabel[];
  measure?: { x: number; y: number; w: number; text: string };
};

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
};

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
      return "How many bolts?";
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
      return `The gap is labeled in ${lengthName(2)}. It is shared by the beams drawn. How long is each beam?`;
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
    case "posts-timber":
    case "add-parts":
    case "beam-weight":
    case "bolts-combine":
    case "triangles":
      return "Hint: combine the labels.";
    case "rail-both":
      return "Hint: both sides.";
    case "split-gap":
      return "Hint: share the gap across the beams.";
    case "brace-hyp":
      return "Hint: square both sides, add, then take the square root.";
    case "plain":
      return "";
    default:
      return "Hint: count what is drawn.";
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
  if (fact.kind === "split-gap") {
    const left = 48;
    const width = 200;
    const y = 108;
    return {
      banks: true,
      ruler: false,
      labels: [
        { text: "?", x: left + 86, y: 70 },
        { text: "?", x: left + width + 86, y: 70 },
      ],
      bits: [
        { sprite: "beam-side.png", x: left, y, w: width, h: 22 },
        { sprite: "beam-side.png", x: left + width, y, w: width, h: 22 },
      ],
      measure: { x: left, y: 58, w: width * 2, text: formatLength(fact.gap) },
    };
  }
  if (fact.kind === "between-posts") {
    return {
      banks: true,
      ruler: false,
      labels: [
        { text: formatLength(fact.left), x: rulerX(fact.left) - 16, y: 8 },
        { text: formatLength(fact.right), x: rulerX(fact.right) - 16, y: 8 },
      ],
      bits: [fact.left, fact.right].map((mark) => ({
        sprite: "post.png",
        x: rulerX(mark) - 16,
        y: 40,
        w: 32,
        h: 78,
      })),
    };
  }
  if (fact.kind === "bolts-combine") {
    return {
      banks: false,
      ruler: false,
      labels: [
        ...repeat(fact.plates, (index) => ({ text: String(fact.each), x: 48 + index * 84, y: 28 })),
        { text: formatLength(1), x: 210, y: 130 },
      ],
      bits: repeat(fact.plates, (index) => ({
        sprite: "gusset-small.png",
        x: 32 + index * 84,
        y: 58,
        w: 52,
        h: 44,
      })),
    };
  }
  if (fact.kind === "count-posts") {
    return {
      banks: true,
      ruler: false,
      labels: [{ text: formatLength(4), x: 210, y: 36 }],
      bits: [
        { sprite: "beam-side.png", x: 70, y: 58, w: 360, h: 22 },
        ...repeat(fact.count, (index) => ({
          sprite: "post.png",
          x: 120 + index * 200,
          y: 80,
          w: 32,
          h: 78,
        })),
      ],
    };
  }
  if (fact.kind === "count-gussets") {
    return {
      banks: false,
      ruler: false,
      labels: [{ text: formatLength(4), x: 200, y: 24 }],
      bits: [
        { sprite: "beam-side.png", x: 40, y: 48, w: 420, h: 22 },
        ...repeat(fact.count, (index) => ({
          sprite: "gusset-small.png",
          x: 36 + index * 90,
          y: 78,
          w: 48,
          h: 42,
        })),
      ],
    };
  }
  if (fact.kind === "count-braces") {
    return {
      banks: false,
      ruler: false,
      labels: [{ text: formatLength(3), x: 200, y: 16 }],
      bits: repeat(fact.count, (index) => ({
        sprite: "beam-half.png",
        x: 90 + index * 180,
        y: 46,
        w: 150,
        h: 20,
        rotate: -36,
      })),
    };
  }
  return {
    banks: true,
    ruler: false,
    labels: [],
    bits: [
      { sprite: "railing.png", x: 60, y: 58, w: 380, h: 28 },
      { sprite: "railing.png", x: 60, y: 108, w: 380, h: 28 },
    ],
    measure: { x: 60, y: 48, w: 380, text: formatLength(8) },
  };
}

export function earnPicture(question: EarnQuestion): EarnPicture | null {
  if (question.word) {
    return wordPicture(question);
  }
  const fact = question.fact;
  if (fact.kind === "plain") {
    return null;
  }
  switch (fact.kind) {
    case "count-planks":
      return {
        banks: true,
        ruler: false,
        labels: [],
        bits: repeat(fact.count, (index) => ({
          sprite: "plank-side.png",
          x: 36 + index * 58,
          y: 96,
          w: 54,
          h: 18,
        })),
      };
    case "count-posts":
      return {
        banks: true,
        ruler: false,
        labels: [],
        bits: repeat(fact.count, (index) => ({
          sprite: "post.png",
          x: 150 + index * 140,
          y: 28,
          w: 36,
          h: 100,
        })),
      };
    case "count-pieces":
      return {
        banks: false,
        ruler: false,
        labels: [],
        bits: repeat(fact.count, (index) => ({
          sprite: "beam-side.png",
          x: 24 + index * 120,
          y: 70,
          w: 108,
          h: 28,
        })),
      };
    case "count-gussets":
      return {
        banks: false,
        ruler: false,
        labels: [],
        bits: repeat(fact.count, (index) => ({
          sprite: "gusset-small.png",
          x: 36 + (index % 5) * 90,
          y: 60,
          w: 48,
          h: 42,
        })),
      };
    case "count-braces":
      return {
        banks: false,
        ruler: false,
        labels: [],
        bits: repeat(fact.count, (index) => ({
          sprite: "beam-half.png",
          x: 80 + index * 180,
          y: 50,
          w: 140,
          h: 22,
          rotate: -40,
        })),
      };
    case "count-bolts":
      return {
        banks: false,
        ruler: false,
        labels: [],
        bits: repeat(fact.count, (index) => ({
          sprite: "bolt.png",
          x: 28 + (index % 5) * 96,
          y: 36 + Math.floor(index / 5) * 64,
          w: 44,
          h: 28,
        })),
      };
    case "count-rails":
      return {
        banks: true,
        ruler: false,
        labels: [],
        bits: repeat(fact.count, (index) => ({
          sprite: "railing.png",
          x: 70,
          y: 48 + index * 36,
          w: 360,
          h: 28,
        })),
      };
    case "between-posts":
      return {
        banks: true,
        ruler: false,
        labels: [
          { text: String(fact.left), x: rulerX(fact.left) - 8, y: 8 },
          { text: String(fact.right), x: rulerX(fact.right) - 8, y: 8 },
        ],
        bits: [fact.left, fact.right].map((mark) => ({
          sprite: "post.png",
          x: rulerX(mark) - 16,
          y: 40,
          w: 32,
          h: 78,
        })),
      };
    case "posts-timber":
      return {
        banks: true,
        ruler: false,
        labels: repeat(fact.count, (index) => ({
          text: formatLength(fact.each),
          x: 120 + index * 160,
          y: 16,
        })),
        bits: repeat(fact.count, (index) => ({
          sprite: "post.png",
          x: 130 + index * 160,
          y: 40,
          w: 36,
          h: 100,
        })),
      };
    case "triangles":
      return {
        banks: false,
        ruler: false,
        labels: repeat(fact.diagonals, (index) => ({ text: String(fact.each), x: 150 + index * 180, y: 24 })),
        bits: repeat(fact.diagonals, (index) => ({
          sprite: "beam-half.png",
          x: 70 + index * 180,
          y: 70,
          w: 150,
          h: 20,
          rotate: index % 2 === 0 ? -32 : 32,
        })),
      };
    case "beam-weight":
      return {
        banks: false,
        ruler: false,
        labels: repeat(fact.pieces, (index) => ({
          text: formatWeight(fact.each),
          x: 28 + index * 124,
          y: 36,
        })),
        bits: repeat(fact.pieces, (index) => ({
          sprite: "beam-side.png",
          x: 20 + index * 124,
          y: 78,
          w: 112,
          h: 28,
        })),
      };
    case "bolts-combine":
      return {
        banks: false,
        ruler: false,
        labels: repeat(fact.plates, (index) => ({ text: String(fact.each), x: 40 + index * 96, y: 28 })),
        bits: repeat(fact.plates, (index) => ({
          sprite: "gusset-small.png",
          x: 28 + index * 96,
          y: 64,
          w: 56,
          h: 48,
        })),
      };
    case "rail-both":
      return {
        banks: true,
        ruler: false,
        labels: [{ text: formatLength(fact.side), x: 200, y: 28 }],
        bits: [
          { sprite: "railing.png", x: 60, y: 58, w: 380, h: 30 },
          { sprite: "railing.png", x: 60, y: 100, w: 380, h: 30 },
        ],
      };
    case "split-gap":
      return {
        banks: true,
        ruler: false,
        labels: [{ text: formatLength(fact.gap), x: 210, y: 24 }],
        bits: repeat(fact.beams, (index) => ({
          sprite: "beam-side.png",
          x: 40 + index * 230,
          y: 88,
          w: 210,
          h: 28,
        })),
      };
    case "add-parts":
      return {
        banks: false,
        ruler: false,
        labels: [
          { text: formatLength(fact.left), x: 70, y: 40 },
          { text: formatLength(fact.right), x: 300, y: 40 },
        ],
        bits: [
          { sprite: "beam-side.png", x: 30, y: 80, w: 200, h: 28 },
          { sprite: "beam-side.png", x: 250, y: 80, w: 200, h: 28 },
        ],
      };
    case "brace-hyp":
      return bracePicture(fact.across, fact.up, "");
    default:
      return { banks: false, ruler: false, bits: [], labels: [] };
  }
}

function bracePicture(across: number, up: number, hypotenuse: string): EarnPicture {
  const width = 160;
  const height = 110;
  const x = 160;
  const y = 130;
  return {
    banks: false,
    ruler: false,
    labels: [
      { text: formatLength(across), x: x + 40, y: y + 8 },
      { text: formatLength(up), x: x - 70, y: y - 60 },
      ...(hypotenuse ? [{ text: hypotenuse, x: x + 70, y: y - 70 }] : []),
    ],
    bits: [
      { sprite: "beam-side.png", x, y, w: width, h: 22 },
      { sprite: "post.png", x: x - 8, y: y - height, w: 28, h: height },
      {
        sprite: "beam-half.png",
        x,
        y: y - height,
        w: Math.hypot(width, height),
        h: 18,
        rotate: (Math.atan2(height, width) * 180) / Math.PI,
      },
    ],
  };
}

function rulerX(mark: number): number {
  return 40 + mark * 55;
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
      return { kind: "count-braces", count: group.count + bump };
    }
    return { kind: "triangles", diagonals: 2 + bump, each: 2 };
  }
  if (level <= 3) {
    if (group.id === "bottom") {
      return { kind: "count-planks", count: salt === 0 ? queenPost.span : 5 + bump };
    }
    if (group.id === "posts") {
      return { kind: "count-posts", count: group.count + bump };
    }
    if (group.id === "gussets") {
      return { kind: "count-gussets", count: group.count + bump };
    }
    if (group.id === "top") {
      return { kind: "count-pieces", count: 4 + bump };
    }
    if (group.id === "bolts") {
      return { kind: "count-bolts", count: Math.min(10, 4 + bump * 2) };
    }
    return { kind: "count-rails", count: group.count + (bump === 0 ? 0 : 1) };
  }
  if (group.id === "bottom") {
    const gap = queenPost.span + bump * 2;
    return { kind: "split-gap", gap, beams: group.count };
  }
  if (group.id === "posts") {
    return { kind: "between-posts", left: 2, right: 6 + bump };
  }
  if (group.id === "gussets") {
    return { kind: "count-gussets", count: 4 + bump };
  }
  if (group.id === "top") {
    return { kind: "add-parts", left: 2 + bump, right: 3 };
  }
  if (group.id === "bolts") {
    return { kind: "bolts-combine", plates: 3 + bump, each: 2 };
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

export function runLength(groupId: string): number {
  return groupId === "braces" || groupId === "railing" ? 8 : 5;
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
  const three = formatLength(3);
  const one = formatLength(1);
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
            word: `Each plate takes 2 bolts, and there are 5 plates. Each plate is ${one} across. How many bolts is that?`,
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
                word: `A beam ${four} long rests on the posts. How many posts hold it up?`,
                fact: { kind: "count-posts" as const, count: 2 },
              }
            : group.id === "gussets"
              ? {
                  answer: "5",
                  word: `The plates join the corners of a beam ${four} long. How many gusset plates is that?`,
                  fact: { kind: "count-gussets" as const, count: 5 },
                }
              : group.id === "braces"
                ? {
                    answer: "2",
                    word: `Each brace reaches ${three} across and stops the posts from folding. How many braces is that?`,
                    fact: { kind: "count-braces" as const, count: 2 },
                  }
                : {
                    answer: "16",
                    word: `The deck is ${gap} long. The railing runs along both sides. How long is the railing altogether?`,
                    fact: { kind: "rail-both" as const, side: 8 },
                  };
  return { groupId: group.id, strandId, level, skillId, ...base };
}

export function kitQuestionTotal(): number {
  return queenPost.groups.reduce((sum, group) => sum + runLength(group.id) + 1, 0);
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
    fact: { kind: "plain", prompt: item.prompt, steps: item.steps, why: item.why },
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

function groupAt(index: number): KitGroup {
  return queenPost.groups[index] ?? queenPost.groups[0];
}

function focusIndex(earned: string[]): number {
  return queenPost.groups.findIndex((group) => !isSmallPiece(group.id) && !earned.includes(group.id));
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
  const slots = runPlan(state.book, group.strand, level, runLength(group.id), state.seed);
  const plan = takePlan(group.id, slots, state.seed, state.seen, false);
  return {
    ...state,
    groupIndex,
    phase: "plain",
    returnPhase: "plain",
    current: plan.current,
    upcoming: plan.upcoming,
    runGot: 0,
    seed: plan.seed,
    seen: plan.seen,
    roundsFailed: 0,
  };
}

export function blankEarn(levels: Record<string, number> | null, seed = 1, saved: SkillBook | null = null, day = "2026-10-19"): EarnState {
  const book = beginSession(saved ?? skillsFromLevels(levels));
  const earned = book.earned.slice();
  const index = focusIndex(earned);
  const group = groupAt(index < 0 ? 0 : index);
  const slots = warmUpPlan(book);
  const plan = takePlan(isSmallPiece(group.id) ? "gussets" : group.id, slots, seed, [], false);
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
    steps: cleared.steps,
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
    runGot: runLength(group.id),
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
      steps: ["Read the gap on the picture.", "Share it into equal beams.", `Each beam is ${answer}.`],
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
      steps: ["Start at one side of the picture.", "Count each piece once.", `You land on ${answer}.`],
      why: "The picture is the question. What you can count is the answer.",
    };
  }
  return {
    steps: ["Read each label on the picture.", "Combine the labels.", `That comes to ${answer}.`],
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
  const earned = [...new Set([...state.earned, "gussets", "bolts"])];
  const book = { ...state.book, earned };
  const index = focusIndex(earned);
  if (index < 0) {
    return { ...state, earned, book, phase: "done", speedLine: speedLine(state.timesMs.reduce((sum, time) => sum + time, 0), null) };
  }
  const withBook = { ...state, earned, book };
  return learnState(withBook, index, levels) ?? runState(withBook, index, levels);
}

function afterPiece(state: EarnState, levels: Record<string, number>, groupId: string): EarnState {
  const earned = [...new Set([...state.earned, groupId])];
  const book = closeTallies({ ...state.book, earned }, state.day);
  const nextLevels = { ...levels, ...strandLevelsFrom(book) };
  const index = focusIndex(earned);
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

