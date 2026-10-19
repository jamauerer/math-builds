import type { LearnerMap } from "../../../engine/placement";
import { formatLength, formatWeight, lengthName } from "../../../units";
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
  | { kind: "add-parts"; left: number; right: number }
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
  strandId: string;
  level: number;
  answer: string;
  fact: EarnFact;
};

export type EarnState = {
  queue: EarnQuestion[];
  index: number;
  earned: string[];
  phase: "ask" | "explain" | "practice";
  practice: EarnQuestion[];
  practiceIndex: number;
  streak: number;
  roundsFailed: number;
  salt: number;
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
    case "add-parts":
      return "The two pieces are labeled. How long are they together?";
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

export function buildEarnQueue(levels: Record<string, number> | null, _seed = 1): EarnQuestion[] {
  return queenPost.groups.map((group) => questionFor(group, levels?.[group.strand] ?? 1, 0));
}

function freshLoop(): Pick<EarnState, "phase" | "practice" | "practiceIndex" | "streak" | "roundsFailed" | "salt"> {
  return { phase: "ask", practice: [], practiceIndex: 0, streak: 0, roundsFailed: 0, salt: 1 };
}

export function blankEarn(levels: Record<string, number> | null, seed = 1): EarnState {
  return { queue: buildEarnQueue(levels, seed), index: 0, earned: [], ...freshLoop() };
}

export function earnDone(state: EarnState): boolean {
  return state.index >= state.queue.length;
}

export function currentQuestion(state: EarnState): EarnQuestion | null {
  if (state.phase === "practice") {
    return state.practice[state.practiceIndex] ?? null;
  }
  return state.queue[state.index] ?? null;
}

export function explainQuestion(question: EarnQuestion): { steps: string[]; why: string } {
  const answer = question.answer;
  const fact = question.fact;
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
  const current = state.queue[state.index];
  if (!current || state.phase !== "explain") {
    return state;
  }
  const salt = state.salt;
  const practice = [1, 2, 3].map((offset) => questionForStrand(current.strandId, current.level, salt + offset));
  return {
    ...state,
    phase: "practice",
    practice,
    practiceIndex: 0,
    streak: 0,
    salt: salt + 3,
  };
}

export type EarnResult = {
  state: EarnState;
  correct: boolean;
  levels: Record<string, number>;
  note: string | null;
};

function advance(state: EarnState, earned: string[]): EarnState {
  return {
    ...state,
    index: state.index + 1,
    earned,
    ...freshLoop(),
  };
}

/**
 * A right answer on the kit question earns the piece.
 * A wrong answer stays put, explains the skill, then runs 3 practice questions.
 * Three right in a row earns the piece. A miss restarts those 3.
 * Two failed practice rounds drop the strand one level and move on.
 */
export function answerEarn(state: EarnState, given: string, levels: Record<string, number> = {}): EarnResult {
  const current = currentQuestion(state);
  if (!current || state.phase === "explain") {
    return { state, correct: false, levels, note: null };
  }
  const correct = given.trim() === current.answer.trim();
  if (state.phase === "ask") {
    if (correct) {
      return {
        correct: true,
        levels,
        note: null,
        state: advance(state, [...state.earned, current.groupId]),
      };
    }
    return {
      correct: false,
      levels,
      note: null,
      state: { ...state, phase: "explain" },
    };
  }
  if (!correct) {
    const roundsFailed = state.roundsFailed + 1;
    if (roundsFailed >= 2) {
      const nextLevel = Math.max(1, (levels[current.strandId] ?? current.level) - 1);
      const nextLevels = { ...levels, [current.strandId]: nextLevel };
      return {
        correct: false,
        levels: nextLevels,
        note: `${current.strandId} dropped to level ${nextLevel} after two practice rounds.`,
        state: advance(state, state.earned.slice()),
      };
    }
    return {
      correct: false,
      levels,
      note: null,
      state: { ...state, phase: "explain", roundsFailed, streak: 0, practiceIndex: 0 },
    };
  }
  const streak = state.streak + 1;
  if (streak >= 3) {
    return {
      correct: true,
      levels,
      note: null,
      state: advance(state, [...state.earned, state.queue[state.index]?.groupId ?? current.groupId]),
    };
  }
  return {
    correct: true,
    levels,
    note: null,
    state: { ...state, streak, practiceIndex: state.practiceIndex + 1 },
  };
}
