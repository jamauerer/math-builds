import type { LearnerMap } from "../../../engine/placement";
import { formatLength, formatWeight, lengthName, WEIGHT_PER_LENGTH } from "../../../units";
import { queenPost, type KitGroup } from "./kit";

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
  | { kind: "brace-given"; across: number; up: number; length: number }
  | { kind: "brace-hyp"; across: number; up: number };

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
};

export type EarnMeasure = "count" | "length" | "weight";

export type EarnQuestion = {
  groupId: string;
  level: number;
  answer: string;
  fact: EarnFact;
};

export type EarnState = {
  queue: EarnQuestion[];
  index: number;
  earned: string[];
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
    fact.kind === "brace-given" ||
    fact.kind === "brace-hyp"
  ) {
    return "length";
  }
  return "count";
}

export function earnPrompt(question: EarnQuestion): string {
  const fact = question.fact;
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
    case "brace-given":
      return "The brace is drawn with its length labeled. How long is it?";
    case "brace-hyp":
      return "The brace is the long side of this right triangle. How long is it?";
    default:
      return "";
  }
}

export function earnHint(question: EarnQuestion): string {
  const fact = question.fact;
  switch (fact.kind) {
    case "between-posts":
      return "Hint: the right post's mark minus the left post's mark.";
    case "posts-timber":
      return "Hint: count the posts, then add a length for each.";
    case "triangles":
      return "Hint: two triangles for every diagonal.";
    case "beam-weight":
      return "Hint: add the label on every piece.";
    case "bolts-combine":
      return "Hint: add the bolts on every plate.";
    case "rail-both":
      return "Hint: both sides means twice one side.";
    case "split-gap":
      return "Hint: share the gap evenly between the beams.";
    case "brace-given":
      return "Hint: read the length written on the brace.";
    case "brace-hyp":
      return "Hint: square both sides, add, then take the square root.";
    default:
      return "Hint: count what is drawn.";
  }
}

export function earnPicture(question: EarnQuestion): EarnPicture {
  const fact = question.fact;
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
        ruler: true,
        labels: [],
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
    case "brace-given":
      return bracePicture(fact.across, fact.up, formatLength(fact.length));
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
    case "brace-given":
      return String(fact.length);
    case "brace-hyp":
      return (Math.round(Math.hypot(fact.across, fact.up) * 100) / 100).toFixed(2);
    default:
      return "";
  }
}

function factFor(group: KitGroup, level: number): EarnFact {
  if (level <= 3) {
    if (group.id === "bottom") {
      return { kind: "count-planks", count: queenPost.span };
    }
    if (group.id === "posts") {
      return { kind: "count-posts", count: group.count };
    }
    if (group.id === "gussets") {
      return { kind: "count-gussets", count: group.count };
    }
    if (group.id === "top") {
      return { kind: "count-pieces", count: 4 };
    }
    if (group.id === "braces") {
      return { kind: "count-braces", count: group.count };
    }
    if (group.id === "bolts") {
      return { kind: "count-bolts", count: group.count };
    }
    return { kind: "count-rails", count: group.count };
  }
  if (group.id === "braces") {
    if (level >= 9) {
      return { kind: "brace-hyp", across: 2, up: 2 };
    }
    return { kind: "brace-given", across: 2, up: 2, length: 2.83 };
  }
  if (level >= 7 && group.id === "bottom") {
    return { kind: "split-gap", gap: queenPost.span, beams: group.count };
  }
  if (group.id === "bottom") {
    return { kind: "between-posts", left: 2, right: 6 };
  }
  if (group.id === "posts") {
    return { kind: "posts-timber", each: 2, count: group.count };
  }
  if (group.id === "gussets") {
    return { kind: "triangles", diagonals: 2, each: 2 };
  }
  if (group.id === "top") {
    return { kind: "beam-weight", pieces: 4, each: WEIGHT_PER_LENGTH };
  }
  if (group.id === "bolts") {
    return { kind: "bolts-combine", plates: 5, each: 2 };
  }
  return { kind: "rail-both", side: queenPost.span };
}

function questionFor(group: KitGroup, level: number): EarnQuestion {
  const fact = factFor(group, level);
  return { groupId: group.id, level, answer: answerFor(fact), fact };
}

export function buildEarnQueue(map: LearnerMap, _seed = 1, level = placedKitLevel(map)): EarnQuestion[] {
  const rung = Math.min(13, Math.max(1, level));
  return queenPost.groups.map((group) => questionFor(group, rung));
}

export function blankEarn(map: LearnerMap, seed = 1, level?: number): EarnState {
  return { queue: buildEarnQueue(map, seed, level), index: 0, earned: [] };
}

export function earnDone(state: EarnState): boolean {
  return state.index >= state.queue.length;
}

/**
 * A correct answer earns the piece and moves on.
 * A wrong answer keeps every piece already earned and sends this question to the end.
 */
export function answerEarn(state: EarnState, given: string): { state: EarnState; correct: boolean } {
  const current = state.queue[state.index];
  if (!current) {
    return { state, correct: false };
  }
  const correct = given.trim() === current.answer.trim();
  if (correct) {
    return {
      correct: true,
      state: {
        queue: state.queue,
        index: state.index + 1,
        earned: [...state.earned, current.groupId],
      },
    };
  }
  const queue = state.queue.slice(0, state.index).concat(state.queue.slice(state.index + 1), [current]);
  return {
    correct: false,
    state: {
      queue,
      index: state.index,
      earned: state.earned.slice(),
    },
  };
}
