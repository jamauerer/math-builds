import { formatLength } from "../../../units";
import { postFeet, queenPost } from "./kit";

export type PieceQuestion = {
  prompt: string;
  answer: string;
  used: number[];
  slots: string[];
  skillId: string;
};

function PLANKS(): string[] {
  const ids = queenPost.slots.filter((slot) => slot.kind === "plank").map((slot) => slot.id);
  return ids.length > 0 ? ids : ["plank-1", "plank-2", "plank-3", "plank-4", "plank-5", "plank-6", "plank-7", "plank-8"];
}

function GUSSETS(): string[] {
  const ids = queenPost.slots.filter((slot) => slot.kind === "gusset").map((slot) => slot.id);
  return ids.length > 0 ? ids : ["gusset-n4", "gusset-n2", "gusset-n6", "gusset-p2", "gusset-p6"];
}

function postMarks(): number[] {
  return postFeet();
}

/** One question for this piece at this level. Every piece has all 13 levels. */
export function pieceQuestion(groupId: string, level: number): PieceQuestion {
  const rung = Math.min(13, Math.max(1, level));
  const made = make(groupId, rung);
  if (!made.prompt || !made.answer) {
    throw new Error(`No question for ${groupId} at level ${rung}`);
  }
  return made;
}

function make(groupId: string, level: number): PieceQuestion {
  if (groupId === "braces") {
    return brace(level);
  }
  if (groupId === "bottom") {
    return bottom(level);
  }
  if (groupId === "posts") {
    return posts(level);
  }
  if (groupId === "gussets") {
    return gussets(level);
  }
  if (groupId === "top") {
    return top(level);
  }
  if (groupId === "bolts") {
    return bolts(level);
  }
  if (groupId === "railing") {
    return railing(level);
  }
  return planks(level);
}

function brace(level: number): PieceQuestion {
  const slots = ["brace-a", "brace-b"];
  if (level <= 2) {
    return { prompt: "How many braces stop the posts from folding?", answer: "2", used: [], slots, skillId: "geometry.2.sides" };
  }
  if (level === 3) {
    return {
      prompt: `The post is ${formatLength(2)}. The beam beside it is twice as long. Which side is longest?`,
      answer: "4",
      used: [2],
      slots,
      skillId: "geometry.5.longest-side",
    };
  }
  if (level <= 5) {
    return {
      prompt: "Count the triangles. Each brace makes 2 triangles, and there are 2 braces. How many triangles is that?",
      answer: "4",
      used: [2],
      slots,
      skillId: "geometry.3.triangles-count",
    };
  }
  if (level <= 8) {
    return {
      prompt: `The brace runs ${formatLength(2)} across and ${formatLength(2)} up, which is longer, the brace or the post? The post is the up side. How long are the across and the up together?`,
      answer: "4",
      used: [2],
      slots,
      skillId: "geometry.5.longest-side",
    };
  }
  if (level <= 11) {
    return {
      prompt: `The brace is the long side of a right triangle with legs ${formatLength(3)} and ${formatLength(4)}. How long is the brace?`,
      answer: "5",
      used: [3, 4],
      slots,
      skillId: "geometry.9.pythagoras",
    };
  }
  return {
    prompt: "A right triangle has an acute angle of 35 degrees. The right angle is 90 degrees. What is the other acute angle?",
    answer: "55",
    used: [35, 90],
    slots,
    skillId: "geometry.6.angle-sum",
  };
}

function bottom(level: number): PieceQuestion {
  const slots = ["bottom-a", "bottom-b"];
  if (level <= 4) {
    const gap = queenPost.span;
    const each = gap / 2;
    return { prompt: `The gap is ${formatLength(gap)}. Two beams of the same length lie end to end to cross it. How long is each beam?`, answer: String(each), used: [gap], slots, skillId: "dividing.4.d1" };
  }
  if (level <= 8) {
    return { prompt: `The gap is ${formatLength(12)}. It is shared by 3 beams of the same length. How long is each beam?`, answer: "4", used: [12, 3], slots, skillId: "dividing.4.d2" };
  }
  return { prompt: `${formatLength(18)} is shared by 3 beams of the same length. How long is each beam?`, answer: "6", used: [18, 3], slots, skillId: "dividing.5.d7" };
}

function posts(level: number): PieceQuestion {
  const slots = ["post-a", "post-b"];
  if (level <= 3) {
    return { prompt: `One post is ${formatLength(2)}. The other is ${formatLength(3)} taller. How tall is the taller post?`, answer: "5", used: [2, 3], slots, skillId: "measuring.2.units" };
  }
  if (level <= 8) {
    const [left, right] = postMarks();
    const a = left ?? 2;
    const b = right ?? 6;
    return { prompt: `One post stands at ${formatLength(a)} and the other stands at ${formatLength(b)}. How long is the gap between them?`, answer: String(b - a), used: [a, b], slots, skillId: "measuring.2.gap" };
  }
  return { prompt: `Marks at ${formatLength(10)} and ${formatLength(25)}. How long is the gap?`, answer: "15", used: [10, 25], slots, skillId: "measuring.2.gap" };
}

function gussets(level: number): PieceQuestion {
  if (level <= 4) {
    return { prompt: "There are 3 gusset plates along the bottom and 2 up high. How many gusset plates is that?", answer: "5", used: [3, 2], slots: GUSSETS(), skillId: "counting.1.to-10" };
  }
  if (level <= 8) {
    return { prompt: "There are 4 gusset plates along the bottom and 3 up high. How many gusset plates is that?", answer: "7", used: [4, 3], slots: GUSSETS(), skillId: "counting.2.to-100" };
  }
  return { prompt: "There are 6 gusset plates along the bottom and 5 up high. How many gusset plates is that?", answer: "11", used: [6, 5], slots: GUSSETS(), skillId: "counting.2.to-100" };
}

function top(level: number): PieceQuestion {
  const slots = ["top"];
  if (level <= 6) {
    const [left, right] = postMarks();
    const a = left ?? 2;
    const b = right ?? 6;
    const mid = b - a;
    const wings = (queenPost.span - mid) / 2;
    return {
      prompt: `The gap is ${formatLength(queenPost.span)}. The posts stand ${formatLength(wings)} in from each bank. ${queenPost.span} − ${wings} − ${wings} = ? How long is the top beam?`,
      answer: String(mid),
      used: [queenPost.span, wings, wings],
      slots,
      skillId: "measuring.2.gap",
    };
  }
  if (level <= 8) {
    return { prompt: `One piece is ${formatLength(12)} and the other is ${formatLength(9)}. How long are they together?`, answer: "21", used: [12, 9], slots, skillId: "adding.2.a12" };
  }
  return { prompt: `One piece is ${formatLength(24)} and the other is ${formatLength(18)}. How long are they together?`, answer: "42", used: [24, 18], slots, skillId: "adding.3.a16" };
}

function bolts(level: number): PieceQuestion {
  if (level <= 4) {
    return { prompt: "Each plate takes 2 bolts, and there are 5 plates. How many bolts is that?", answer: "10", used: [2, 5], slots: GUSSETS(), skillId: "multiplying.3.m1" };
  }
  if (level <= 8) {
    return { prompt: "4 lots of 6 bolts. How many bolts is that?", answer: "24", used: [4, 6], slots: GUSSETS(), skillId: "multiplying.4.m4" };
  }
  return { prompt: "8 lots of 7 bolts. How many bolts is that?", answer: "56", used: [8, 7], slots: GUSSETS(), skillId: "multiplying.4.m7" };
}

function railing(level: number): PieceQuestion {
  const slots = ["rail-a", "rail-b"];
  if (level <= 4) {
    return { prompt: `The deck is ${formatLength(queenPost.span)} long. The railing runs along both sides. How long is the railing altogether?`, answer: String(queenPost.span * 2), used: [queenPost.span], slots, skillId: "measuring.3.perimeter" };
  }
  if (level <= 8) {
    return { prompt: `One side of the railing is ${formatLength(6)}. Both sides together are how long?`, answer: "12", used: [6], slots, skillId: "measuring.3.perimeter" };
  }
  return { prompt: `One side of the railing is ${formatLength(9)}. Both sides together are how long?`, answer: "18", used: [9], slots, skillId: "measuring.3.perimeter" };
}

function planks(level: number): PieceQuestion {
  if (level <= 4) {
    return {
      prompt: `Each plank is ${formatLength(1)} wide. The path is two beams of ${formatLength(queenPost.span / 2)} laid end to end. How many planks cover the path?`,
      answer: String(queenPost.span),
      used: [1, queenPost.span / 2],
      slots: PLANKS(),
      skillId: "dividing.4.d1",
    };
  }
  if (level <= 8) {
    return { prompt: `Each plank is ${formatLength(2)} wide. The path is ${formatLength(10)}. How many planks cover the path?`, answer: "5", used: [2, 10], slots: PLANKS(), skillId: "dividing.4.d2" };
  }
  return { prompt: `Each plank is ${formatLength(3)} wide. The path is ${formatLength(15)}. How many planks cover the path?`, answer: "5", used: [3, 15], slots: PLANKS(), skillId: "dividing.5.d7" };
}

/** Word problems for strands that are not a kit piece. */
export function strandWord(strandId: string): PieceQuestion {
  if (strandId === "fractions") {
    return {
      prompt: `The deck is ${formatLength(queenPost.span)}. How long is 3/4 of the deck?`,
      answer: String((queenPost.span * 3) / 4),
      used: [queenPost.span, 3, 4],
      slots: PLANKS(),
      skillId: "fractions.5.of-a-number",
    };
  }
  if (strandId === "ratios") {
    return {
      prompt: `There are 10 bolts and 5 gussets. How many bolts per gusset?`,
      answer: "2",
      used: [10, 5],
      slots: ["bolts", "gusset-n4"],
      skillId: "ratios.6.unit-rate",
    };
  }
  return {
    prompt: `The unknown length is x. x + 3 = 8. How long is x?`,
    answer: "5",
    used: [3, 8],
    slots: ["top"],
    skillId: "algebra.6.unknown",
  };
}
