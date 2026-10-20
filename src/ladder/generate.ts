import { createRng, intBetween, pick, type Rng } from "../engine/rng";
import { formatCount } from "../units";
import type { PlainDraw } from "../pictures/parts";
import { LADDER_STEPS, ladderStep, type LadderForm, type LadderStep } from "./steps";

export type LadderLayout = {
  kind: LadderForm;
  top: string;
  bottom: string;
  op: "+" | "−" | "×" | "÷";
  extra?: string;
};

export type LadderItem = {
  stepId: string;
  skillId: string;
  prompt: string;
  answer: string;
  operands: number[];
  form: LadderForm;
  picture: "dots" | "none";
  steps: string[];
  why: string;
  draw?: PlainDraw;
  layout?: LadderLayout;
};

function salt(id: string): number {
  return id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function plus(a: number, b: number, answer: number, stacked = false): Pick<LadderItem, "prompt" | "answer" | "operands" | "layout"> {
  return {
    prompt: `${formatCount(a)} + ${formatCount(b)} = ?`,
    answer: String(answer),
    operands: [a, b],
    layout: stacked ? { kind: "stacked", top: String(a), bottom: String(b), op: "+" } : undefined,
  };
}

function minus(a: number, b: number, answer: number, stacked = false): Pick<LadderItem, "prompt" | "answer" | "operands" | "layout"> {
  return {
    prompt: `${formatCount(a)} − ${formatCount(b)} = ?`,
    answer: String(answer),
    operands: [a, b],
    layout: stacked ? { kind: "stacked", top: String(a), bottom: String(b), op: "−" } : undefined,
  };
}

function times(a: number, b: number, answer: number, stacked = false): Pick<LadderItem, "prompt" | "answer" | "operands" | "layout"> {
  return {
    prompt: `${formatCount(a)} × ${formatCount(b)} = ?`,
    answer: String(answer),
    operands: [a, b],
    layout: stacked ? { kind: "stacked", top: String(a), bottom: String(b), op: "×" } : undefined,
  };
}

function divide(a: number, b: number, answer: string, operands: number[], long = false): Pick<LadderItem, "prompt" | "answer" | "operands" | "layout"> {
  return {
    prompt: `${formatCount(a)} ÷ ${formatCount(b)} = ?`,
    answer,
    operands,
    layout: long ? { kind: "long-division", top: String(a), bottom: String(b), op: "÷" } : undefined,
  };
}

function stackOp(step: LadderStep): LadderLayout["op"] {
  return step.op === "A" ? "+" : step.op === "S" ? "−" : step.op === "M" ? "×" : "÷";
}

function wrap(step: LadderStep, parts: Pick<LadderItem, "prompt" | "answer" | "operands" | "layout">, steps: string[], why: string, draw?: PlainDraw): LadderItem {
  let layout = parts.layout;
  if (step.form === "stacked" && !layout && parts.operands.length >= 2) {
    layout = {
      kind: "stacked",
      top: String(parts.operands[0]),
      bottom: String(parts.operands[1]),
      op: stackOp(step),
    };
  }
  return {
    stepId: step.id,
    skillId: step.skillId,
    form: step.form,
    picture: step.dots ? "dots" : "none",
    steps,
    why,
    draw,
    ...parts,
    layout,
  };
}

function tens(rng: Rng, min = 1, max = 8): number {
  return intBetween(rng, min, max) * 10;
}

function twoDigit(rng: Rng, min = 10, max = 99): number {
  return intBetween(rng, min, max);
}

function makeAdd(step: LadderStep, rng: Rng): LadderItem {
  if (step.n === 1) {
    const a = intBetween(rng, 0, 5);
    const b = intBetween(rng, 0, 5 - a);
    return wrap(step, plus(a, b, a + b), [`Count ${a} and ${b}.`], "Join the dots.", { op: "add", a, b });
  }
  if (step.n === 2) {
    const a = intBetween(rng, 0, 9);
    const b = intBetween(rng, 0, Math.min(9, 10 - a));
    return wrap(step, plus(a, b, a + b), [`Count on from ${a}.`], "Dots fade out.", { op: "add", a, b });
  }
  if (step.n === 3) {
    const a = intBetween(rng, 0, 18);
    const b = pick(rng, [1, 2]);
    return wrap(step, plus(a, b, a + b), [`Add ${b}.`], "Count on 1 or 2.", { op: "add", a, b });
  }
  if (step.n === 4) {
    const a = intBetween(rng, 0, 10);
    const b = 10 - a;
    return wrap(step, { prompt: `${a} + ? = 10`, answer: String(b), operands: [a, 10] }, [`What makes 10 with ${a}?`], "Pairs that make 10.", { op: "add", a, b });
  }
  if (step.n === 5) {
    if (rng() < 0.5) {
      const a = intBetween(rng, 0, 9);
      const b = intBetween(rng, 0, Math.min(9, 10 - a));
      return wrap(step, plus(a, b, a + b), [`${a} + ${b} stays within 10.`], "No crossing 10.");
    }
    const ones = intBetween(rng, 0, 9);
    const a = 10 + ones;
    const b = intBetween(rng, 0, 9 - ones);
    return wrap(step, plus(a, b, a + b), [`Ones ${ones} + ${b} do not make a ten.`], "Teen plus ones, no carry.");
  }
  if (step.n === 6) {
    const a = intBetween(rng, 2, 9);
    const b = intBetween(rng, Math.max(2, 11 - a), 9);
    return wrap(step, plus(a, b, a + b), [`${a} + ${b} crosses 10.`], "Make a ten.");
  }
  if (step.n === 7) {
    const n = intBetween(rng, 1, 9);
    if (rng() < 0.5 || n === 9) {
      return wrap(step, plus(n, n, n + n), [`Double ${n}.`], "Doubles.");
    }
    return wrap(step, plus(n, n + 1, n + n + 1), [`Near double of ${n}.`], "Near doubles.");
  }
  if (step.n === 8) {
    const a = tens(rng, 1, 8);
    const b = tens(rng, 1, 9 - a / 10);
    return wrap(step, plus(a, b, a + b), [`${a / 10} tens + ${b / 10} tens.`], "Add tens.");
  }
  if (step.n === 9) {
    const ones = intBetween(rng, 0, 8);
    const a = intBetween(rng, 1, 9) * 10 + ones;
    const b = intBetween(rng, 0, 9 - ones);
    return wrap(step, plus(a, b, a + b), [`Ones ${ones} + ${b} do not carry.`], "No carry.");
  }
  if (step.n === 10) {
    const ones = intBetween(rng, 1, 9);
    const a = intBetween(rng, 1, 8) * 10 + ones;
    const need = 10 - ones;
    const b = intBetween(rng, need, 9);
    const sum = a + b;
    if (sum > 99) {
      return makeAdd(step, rng);
    }
    return wrap(step, plus(a, b, sum), [`Ones ${ones} + ${b} make a ten.`], "Carry the 1.");
  }
  if (step.n === 11) {
    const aOnes = intBetween(rng, 0, 9);
    const bOnes = intBetween(rng, 0, 9 - aOnes);
    const aTens = intBetween(rng, 1, 8);
    const bTens = intBetween(rng, 1, 9 - aTens);
    const a = aTens * 10 + aOnes;
    const b = bTens * 10 + bOnes;
    return wrap(step, plus(a, b, a + b, true), [`Add ones, then tens.`], "Stacked, no carry.");
  }
  if (step.n === 12) {
    const aOnes = intBetween(rng, 1, 9);
    const bOnes = intBetween(rng, 10 - aOnes, 9);
    const aTens = intBetween(rng, 1, 7);
    const bTens = intBetween(rng, 1, 8 - aTens);
    const a = aTens * 10 + aOnes;
    const b = bTens * 10 + bOnes;
    const sum = a + b;
    if (sum > 99) {
      return makeAdd(step, rng);
    }
    return wrap(step, plus(a, b, sum, true), [`Ones make ${aOnes + bOnes}. Write 1 above the tens.`], "Stacked, carry.");
  }
  if (step.n === 13) {
    let a = twoDigit(rng, 50, 99);
    let b = twoDigit(rng, 50, 99);
    if (a + b < 100) {
      a = 78;
      b = 65;
    }
    if (a + b > 198) {
      a = 99;
      b = 99;
    }
    return wrap(step, plus(a, b, a + b, true), [`${a} + ${b} goes past 100.`], "Stacked, over 100.");
  }
  if (step.n === 14) {
    const a = intBetween(rng, 0, 9);
    const b = intBetween(rng, 0, 9);
    const c = intBetween(rng, 0, 9);
    return wrap(
      step,
      { prompt: `${formatCount(a)} + ${formatCount(b)} + ${formatCount(c)} = ?`, answer: String(a + b + c), operands: [a, b, c] },
      [`Find a pair that makes 10, then add ${[a, b, c].sort((x, y) => x - y)[0]}.`],
      "Three one-digit numbers.",
    );
  }
  if (step.n === 15) {
    const a = intBetween(rng, 1, 8) * 100 + intBetween(rng, 0, 8) * 10 + intBetween(rng, 0, 8);
    const maxH = 9 - Math.floor(a / 100);
    const maxT = 9 - Math.floor(a / 10) % 10;
    const maxO = 9 - (a % 10);
    const b = intBetween(rng, 1, Math.max(1, maxH)) * 100 + intBetween(rng, 0, maxT) * 10 + intBetween(rng, 0, maxO);
    return wrap(step, plus(a, b, a + b, true), [`Each column stays under 10.`], "Stacked, no carry.");
  }
  if (step.n === 16) {
    const a = intBetween(rng, 100, 499);
    const b = intBetween(rng, 100, 499);
    const onesCarry = (a % 10) + (b % 10) >= 10;
    const tensCarry = Math.floor(a / 10) % 10 + Math.floor(b / 10) % 10 + (onesCarry ? 1 : 0) >= 10;
    if (a + b > 999 || (!onesCarry && !tensCarry)) {
      return wrap(step, plus(358, 467, 825, true), [`Ones carry, tens may carry.`], "One or two carries.");
    }
    const carries = (onesCarry ? 1 : 0) + (tensCarry ? 1 : 0);
    if (carries < 1 || carries > 2) {
      return makeAdd(step, rng);
    }
    return wrap(step, plus(a, b, a + b, true), [`Write each carry above the next column.`], "One or two carries.");
  }
  if (step.n === 17) {
    const digits = intBetween(rng, 4, 6);
    const min = 10 ** (digits - 1);
    const max = 10 ** digits - 1;
    const a = intBetween(rng, min, max);
    const b = intBetween(rng, min, Math.min(max, 10 ** digits - 1 - min));
    return wrap(step, plus(a, b, a + b, true), [`Line up the ones.`], "Four-digit and up.");
  }
  const tenths = rng() < 0.5;
  const a = tenths ? intBetween(rng, 1, 80) / 10 : intBetween(rng, 1, 800) / 100;
  const b = tenths ? intBetween(rng, 1, 80) / 10 : intBetween(rng, 1, 800) / 100;
  const sum = Math.round((a + b) * 100) / 100;
  const shownA = tenths ? a.toFixed(1) : a.toFixed(2);
  const shownB = tenths ? b.toFixed(1) : b.toFixed(2);
  const shown = tenths && Number.isInteger(sum * 10) ? sum.toFixed(1) : sum.toFixed(tenths ? 1 : 2);
  return wrap(
    step,
    {
      prompt: `${shownA} + ${shownB} = ?`,
      answer: shown,
      operands: [a, b],
      layout: { kind: "stacked", top: shownA, bottom: shownB, op: "+" },
    },
    [`Line up the points.`],
    "Decimals, points lined up.",
  );
}

function makeSub(step: LadderStep, rng: Rng): LadderItem {
  if (step.n === 1) {
    const a = intBetween(rng, 0, 5);
    const b = intBetween(rng, 0, a);
    return wrap(step, minus(a, b, a - b), [`Start with ${a} dots. Cross out ${b}.`], "Dots.", { op: "sub", a, b });
  }
  if (step.n === 2) {
    const a = intBetween(rng, 0, 10);
    const b = intBetween(rng, 0, a);
    return wrap(step, minus(a, b, a - b), [`Take ${b} from ${a}.`], "Dots fade out.", { op: "sub", a, b });
  }
  if (step.n === 3) {
    const b = pick(rng, [1, 2]);
    const a = intBetween(rng, Math.max(2, b), 20);
    return wrap(step, minus(a, b, a - b), [`Count back ${b}.`], "Take 1 or 2.", { op: "sub", a, b });
  }
  if (step.n === 4) {
    const b = intBetween(rng, 0, 10);
    return wrap(step, minus(10, b, 10 - b), [`10 minus ${b}.`], "Subtract from 10.", { op: "sub", a: 10, b });
  }
  if (step.n === 5) {
    const ones = intBetween(rng, 1, 9);
    const a = 10 + ones;
    const b = intBetween(rng, 0, ones);
    return wrap(step, minus(a, b, a - b), [`Ones ${ones} can give ${b}.`], "No crossing 10.");
  }
  if (step.n === 6) {
    const ones = intBetween(rng, 1, 8);
    const a = 10 + ones;
    const b = intBetween(rng, ones + 1, 9);
    return wrap(step, minus(a, b, a - b), [`Count back through 10.`], "Crossing 10.");
  }
  if (step.n === 7) {
    const a = tens(rng, 2, 9);
    const b = tens(rng, 1, a / 10);
    return wrap(step, minus(a, b, a - b), [`${a / 10} tens minus ${b / 10} tens.`], "Subtract tens.");
  }
  if (step.n === 8) {
    const ones = intBetween(rng, 1, 9);
    const a = intBetween(rng, 2, 9) * 10 + ones;
    const b = intBetween(rng, 0, ones);
    return wrap(step, minus(a, b, a - b), [`Ones can give ${b}.`], "No borrow.");
  }
  if (step.n === 9) {
    const ones = intBetween(rng, 0, 8);
    const a = intBetween(rng, 2, 9) * 10 + ones;
    const b = intBetween(rng, ones + 1, 9);
    return wrap(step, minus(a, b, a - b), [`Cross out a ten and add 10 to the ones.`], "Borrow.");
  }
  if (step.n === 10) {
    const aOnes = intBetween(rng, 0, 9);
    const bOnes = intBetween(rng, 0, aOnes);
    const aTens = intBetween(rng, 2, 9);
    const bTens = intBetween(rng, 1, aTens);
    const a = aTens * 10 + aOnes;
    const b = bTens * 10 + bOnes;
    return wrap(step, minus(a, b, a - b, true), [`Each column has enough.`], "Stacked, no borrow.");
  }
  if (step.n === 11) {
    const aOnes = intBetween(rng, 0, 8);
    const bOnes = intBetween(rng, aOnes + 1, 9);
    const aTens = intBetween(rng, 2, 9);
    const bTens = intBetween(rng, 1, aTens - 1);
    const a = aTens * 10 + aOnes;
    const b = bTens * 10 + bOnes;
    return wrap(step, minus(a, b, a - b, true), [`Ones borrow. Cross out the tens digit and add 10 to the ones.`], "Stacked, borrow.");
  }
  if (step.n === 12) {
    const a = intBetween(rng, 200, 899);
    const b = intBetween(rng, 100, 499);
    const onesBorrow = a % 10 < b % 10;
    const tensBorrow = Math.floor(a / 10) % 10 < Math.floor(b / 10) % 10;
    if (a <= b || (onesBorrow && tensBorrow) || (!onesBorrow && !tensBorrow) || Math.floor(a / 10) % 10 === 0) {
      return wrap(step, minus(524, 178, 346, true), [`One column borrows.`], "One borrow.");
    }
    return wrap(step, minus(a, b, a - b, true), [`Borrow once.`], "One borrow.");
  }
  if (step.n === 13) {
    const hundreds = intBetween(rng, 2, 9);
    const ones = intBetween(rng, 0, 9);
    const a = hundreds * 100 + ones;
    const b = intBetween(rng, 100, Math.min(a - 1, hundreds * 100 - 1));
    return wrap(step, minus(a, b, a - b, true), [`The tens digit is 0, so borrow across zero.`], "Borrow across zero.");
  }
  if (step.n === 14) {
    const digits = intBetween(rng, 4, 6);
    const min = 10 ** (digits - 1);
    const max = 10 ** digits - 1;
    const a = intBetween(rng, min + 1, max);
    const b = intBetween(rng, min, a - 1);
    return wrap(step, minus(a, b, a - b, true), [`Line up the ones.`], "Four-digit and up.");
  }
  const tenths = rng() < 0.5;
  let a = tenths ? intBetween(rng, 20, 90) / 10 : intBetween(rng, 200, 900) / 100;
  let b = tenths ? intBetween(rng, 1, 80) / 10 : intBetween(rng, 1, 800) / 100;
  if (b >= a) {
    const swap = a;
    a = b + (tenths ? 1 : 0.1);
    b = swap;
  }
  const diff = Math.round((a - b) * 100) / 100;
  const shownA = tenths ? a.toFixed(1) : a.toFixed(2);
  const shownB = tenths ? b.toFixed(1) : b.toFixed(2);
  const shown = tenths ? diff.toFixed(1) : diff.toFixed(2);
  return wrap(
    step,
    {
      prompt: `${shownA} − ${shownB} = ?`,
      answer: shown,
      operands: [a, b],
      layout: { kind: "stacked", top: shownA, bottom: shownB, op: "−" },
    },
    [`Line up the points.`],
    "Decimals.",
  );
}

function makeMul(step: LadderStep, rng: Rng): LadderItem {
  if (step.n === 1) {
    const a = intBetween(rng, 2, 5);
    const b = intBetween(rng, 2, 5);
    return wrap(step, times(a, b, a * b), [`${a} rows of ${b}.`], "Equal groups.", { op: "mul", a, b });
  }
  if (step.n === 2) {
    const n = intBetween(rng, 0, 10);
    const f = pick(rng, [2, 10]);
    return wrap(step, times(n, f, n * f), [`${n} groups of ${f}.`], "× 2 or × 10.");
  }
  if (step.n === 3) {
    const n = intBetween(rng, 0, 10);
    return wrap(step, times(n, 5, n * 5), [`${n} × 5.`], "× 5.");
  }
  if (step.n === 4) {
    const n = intBetween(rng, 0, 10);
    const f = pick(rng, [3, 4]);
    return wrap(step, times(n, f, n * f), [`${n} × ${f}.`], "× 3 or × 4.");
  }
  if (step.n === 5) {
    const n = intBetween(rng, 0, 10);
    const f = pick(rng, [6, 7]);
    return wrap(step, times(n, f, n * f), [`${n} × ${f}.`], "× 6 or × 7.");
  }
  if (step.n === 6) {
    const n = intBetween(rng, 0, 10);
    const f = pick(rng, [8, 9]);
    return wrap(step, times(n, f, n * f), [`${n} × ${f}.`], "× 8 or × 9.");
  }
  if (step.n === 7) {
    const a = intBetween(rng, 0, 10);
    const b = intBetween(rng, 0, 10);
    return wrap(step, times(a, b, a * b), [`${a} × ${b}.`], "All tables.");
  }
  if (step.n === 8) {
    const digits = intBetween(rng, 1, 3);
    const n = intBetween(rng, 10 ** (digits - 1), 10 ** digits - 1);
    const f = pick(rng, [10, 100]);
    return wrap(step, times(n, f, n * f), [`Slide the digits left.`], "× 10 or × 100.");
  }
  if (step.n === 9) {
    const a = twoDigit(rng);
    const b = intBetween(rng, 2, 9);
    return wrap(step, times(a, b, a * b, true), [`${Math.floor(a / 10) * 10} × ${b} and ${a % 10} × ${b}, then add.`], "Partial products.");
  }
  if (step.n === 10) {
    const a = intBetween(rng, 100, 999);
    const b = intBetween(rng, 2, 9);
    return wrap(step, times(a, b, a * b, true), [`Multiply each place by ${b}.`], "Three-digit × one-digit.");
  }
  if (step.n === 11) {
    const a = twoDigit(rng, 11, 99);
    const b = twoDigit(rng, 11, 99);
    return wrap(step, times(a, b, a * b, true), [`Multiply by the ones, then the tens.`], "Two-digit × two-digit.");
  }
  if (step.n === 12) {
    const a = intBetween(rng, 10, 999);
    const b = intBetween(rng, 10, 99);
    return wrap(step, times(a, b, a * b, true), [`Keep the places lined up.`], "Larger products.");
  }
  if (rng() < 0.5) {
    const a = intBetween(rng, 1, 90) / 10;
    const b = intBetween(rng, 2, 9);
    const product = Math.round(a * b * 10) / 10;
    return wrap(
      step,
      { prompt: `${a.toFixed(1)} × ${b} = ?`, answer: String(product), operands: [a, b] },
      [`${a.toFixed(1)} tenths times ${b}.`],
      "Tenths × whole.",
    );
  }
  const a = intBetween(rng, 1, 90) / 10;
  const b = intBetween(rng, 1, 90) / 10;
  const product = Math.round(a * b * 100) / 100;
  return wrap(
    step,
    { prompt: `${a.toFixed(1)} × ${b.toFixed(1)} = ?`, answer: String(product), operands: [a, b] },
    [`Tenths times tenths.`],
    "Tenths × tenths.",
  );
}

function factPairs(factors: number[]): { a: number; b: number }[] {
  const pairs: { a: number; b: number }[] = [];
  for (const b of factors) {
    for (let a = 0; a <= 10; a += 1) {
      pairs.push({ a: a * b, b });
    }
  }
  return pairs;
}

function makeDiv(step: LadderStep, rng: Rng): LadderItem {
  if (step.n === 1) {
    const groups = intBetween(rng, 2, 5);
    const each = intBetween(rng, 1, 5);
    const total = groups * each;
    if (total < 4 || total > 20) {
      return wrap(step, divide(12, 3, "4", [12, 3]), [`Deal 12 into 3 groups.`], "Share equally.", { op: "div", a: 12, b: 3 });
    }
    return wrap(step, divide(total, groups, String(each), [total, groups]), [`Deal ${total} into ${groups} groups.`], "Share equally.", { op: "div", a: total, b: groups });
  }
  if (step.n === 2) {
    const pair = pick(rng, factPairs([2, 5, 10]).filter((item) => item.b !== 0 && item.a % item.b === 0));
    return wrap(step, divide(pair.a, pair.b, String(pair.a / pair.b), [pair.a, pair.b]), [`${pair.a} ÷ ${pair.b}.`], "Facts from ×2, ×5, ×10.");
  }
  if (step.n === 3) {
    const pair = pick(rng, factPairs([3, 4]).filter((item) => item.b !== 0));
    return wrap(step, divide(pair.a, pair.b, String(pair.a / pair.b), [pair.a, pair.b]), [`${pair.a} ÷ ${pair.b}.`], "Facts from ×3, ×4.");
  }
  if (step.n === 4) {
    const pair = pick(rng, factPairs([6, 7, 8, 9]).filter((item) => item.b !== 0));
    return wrap(step, divide(pair.a, pair.b, String(pair.a / pair.b), [pair.a, pair.b]), [`${pair.a} ÷ ${pair.b}.`], "Facts from ×6 to ×9.");
  }
  if (step.n === 5) {
    const b = intBetween(rng, 1, 10);
    const q = intBetween(rng, 0, 10);
    return wrap(step, divide(b * q, b, String(q), [b * q, b]), [`${b * q} ÷ ${b}.`], "All facts mixed.");
  }
  if (step.n === 6) {
    const b = intBetween(rng, 2, 9);
    const q = intBetween(rng, 2, 9);
    const r = intBetween(rng, 1, b - 1);
    const a = b * q + r;
    return wrap(
      step,
      { prompt: `${formatCount(a)} ÷ ${formatCount(b)} = ? r ?`, answer: `${q} r ${r}`, operands: [a, b, q, r] },
      [`${b} goes into ${a} ${q} times, leftover ${r}.`],
      "Remainders.",
    );
  }
  if (step.n === 7) {
    const b = intBetween(rng, 2, 9);
    const q = intBetween(rng, 10, 99);
    const a = b * q;
    if (a < 10 || a > 99) {
      return wrap(step, divide(84, 4, "21", [84, 4], true), [`4 into 8 is 2, 4 into 4 is 1.`], "Long division, no remainder.");
    }
    return wrap(step, divide(a, b, String(q), [a, b], true), [`Divide one place at a time.`], "Long division, no remainder.");
  }
  if (step.n === 8) {
    const b = intBetween(rng, 2, 9);
    const a = intBetween(rng, 100, 999);
    const q = Math.floor(a / b);
    const r = a % b;
    const answer = r === 0 ? String(q) : `${q} r ${r}`;
    return wrap(step, { ...divide(a, b, answer, r === 0 ? [a, b] : [a, b, q, r], true) }, [`Divide, multiply, subtract, bring down.`], "Three-digit ÷ one-digit.");
  }
  if (step.n === 9) {
    const b = intBetween(rng, 11, 19);
    const q = intBetween(rng, 11, 40);
    const a = b * q;
    return wrap(step, divide(a, b, String(q), [a, b], true), [`How many ${b}s in ${a}?`], "÷ two-digit.");
  }
  const b = pick(rng, [2, 4, 5, 8]);
  const a = intBetween(rng, 1, 9);
  const answer = a / b;
  const shown = Number.isInteger(answer) ? String(answer) : (Math.round(answer * 100) / 100).toFixed(answer * 100 % 10 === 0 ? 1 : 2);
  return wrap(step, { ...divide(a, b, shown.replace(/\.0$/, ""), [a, b], true) }, [`Keep dividing past the ones.`], "To a decimal.");
}

function makeStep(step: LadderStep, seed: number): LadderItem {
  const rng = createRng((seed + 1) * 997 + step.n * 131 + salt(step.id));
  if (step.op === "A") {
    return makeAdd(step, rng);
  }
  if (step.op === "S") {
    return makeSub(step, rng);
  }
  if (step.op === "M") {
    return makeMul(step, rng);
  }
  return makeDiv(step, rng);
}

export function generateStep(step: LadderStep, seed: number): LadderItem {
  for (let extra = 0; extra < 40; extra += 1) {
    const item = makeStep(step, seed + extra * 19);
    if (validateStep(step, item)) {
      return item;
    }
  }
  return makeStep(step, seed);
}

export function generateSkill(skillId: string, seed: number): LadderItem | null {
  const step = ladderStep(skillId);
  if (!step) {
    return null;
  }
  return generateStep(step, seed);
}

export function validateStep(step: LadderStep, item: LadderItem): boolean {
  const [a, b, c] = item.operands;
  const value = Number(item.answer);
  if (step.op === "A") {
    if (step.n === 1) {
      return a >= 0 && a <= 5 && b >= 0 && b <= 5 && a + b <= 5 && value === a + b;
    }
    if (step.n === 2) {
      return a >= 0 && a <= 9 && b >= 0 && b <= 9 && a + b <= 10 && value === a + b;
    }
    if (step.n === 3) {
      return a >= 0 && a <= 18 && (b === 1 || b === 2) && value === a + b;
    }
    if (step.n === 4) {
      return a >= 0 && a <= 10 && item.operands[1] === 10 && value === 10 - a;
    }
    if (step.n === 5) {
      if (a <= 9 && b <= 9) {
        return a + b <= 10 && value === a + b;
      }
      return a >= 10 && a <= 19 && b >= 0 && b <= 9 && a % 10 + b <= 9 && value === a + b;
    }
    if (step.n === 6) {
      return a >= 1 && a <= 9 && b >= 1 && b <= 9 && a + b >= 11 && a + b <= 18 && value === a + b;
    }
    if (step.n === 7) {
      return a >= 1 && a <= 9 && (b === a || b === a + 1) && value === a + b;
    }
    if (step.n === 8) {
      return a % 10 === 0 && b % 10 === 0 && a >= 10 && b >= 10 && a + b <= 90 && value === a + b;
    }
    if (step.n === 9) {
      return a >= 10 && a <= 99 && b >= 0 && b <= 9 && a % 10 + b <= 9 && value === a + b;
    }
    if (step.n === 10) {
      return a >= 10 && a <= 99 && b >= 0 && b <= 9 && a % 10 + b >= 10 && a + b <= 99 && value === a + b;
    }
    if (step.n === 11) {
      return a >= 10 && b >= 10 && a <= 99 && b <= 99 && a % 10 + (b % 10) <= 9 && a + b <= 99 && value === a + b;
    }
    if (step.n === 12) {
      return a >= 10 && b >= 10 && a <= 99 && b <= 99 && a % 10 + (b % 10) >= 10 && a + b <= 99 && value === a + b;
    }
    if (step.n === 13) {
      return a >= 10 && b >= 10 && a <= 99 && b <= 99 && a + b >= 100 && a + b <= 198 && value === a + b;
    }
    if (step.n === 14) {
      return [a, b, c].every((n) => n >= 0 && n <= 9) && value === a + b + c;
    }
    if (step.n === 15) {
      const cols = [a % 10 + (b % 10), Math.floor(a / 10) % 10 + (Math.floor(b / 10) % 10), Math.floor(a / 100) + Math.floor(b / 100)];
      return a >= 100 && b >= 100 && cols.every((col) => col <= 9) && value === a + b;
    }
    if (step.n === 16) {
      return a >= 100 && b >= 100 && a + b <= 999 && value === a + b;
    }
    if (step.n === 17) {
      return a >= 1000 && b >= 1000 && a <= 999999 && b <= 999999 && value === a + b;
    }
    return a > 0 && b > 0 && Math.abs(value - (a + b)) < 0.001;
  }
  if (step.op === "S") {
    if (step.n === 1) {
      return a >= 0 && a <= 5 && b >= 0 && b <= a && value === a - b;
    }
    if (step.n === 2) {
      return a >= 0 && a <= 10 && b >= 0 && b <= a && value === a - b;
    }
    if (step.n === 3) {
      return a >= 2 && a <= 20 && (b === 1 || b === 2) && a >= b && value === a - b;
    }
    if (step.n === 4) {
      return a === 10 && b >= 0 && b <= 10 && value === 10 - b;
    }
    if (step.n === 5) {
      return a >= 11 && a <= 19 && b >= 0 && b <= 9 && a % 10 >= b && value === a - b;
    }
    if (step.n === 6) {
      return a >= 11 && a <= 19 && b >= 1 && b <= 9 && a % 10 < b && value === a - b;
    }
    if (step.n === 7) {
      return a % 10 === 0 && b % 10 === 0 && a >= 10 && b >= 0 && a >= b && value === a - b;
    }
    if (step.n === 8) {
      return a >= 20 && a <= 99 && b >= 0 && b <= 9 && a % 10 >= b && value === a - b;
    }
    if (step.n === 9) {
      return a >= 20 && a <= 99 && b >= 1 && b <= 9 && a % 10 < b && value === a - b;
    }
    if (step.n === 10) {
      return a >= 10 && b >= 10 && a % 10 >= b % 10 && Math.floor(a / 10) >= Math.floor(b / 10) && value === a - b;
    }
    if (step.n === 11) {
      return a >= 10 && b >= 10 && a % 10 < b % 10 && value === a - b;
    }
    if (step.n === 12) {
      return a >= 100 && b >= 100 && a > b && value === a - b;
    }
    if (step.n === 13) {
      return a >= 100 && Math.floor(a / 10) % 10 === 0 && a > b && value === a - b;
    }
    if (step.n === 14) {
      return a >= 1000 && b >= 1000 && a > b && value === a - b;
    }
    return a > b && Math.abs(value - (a - b)) < 0.001;
  }
  if (step.op === "M") {
    if (step.n === 1) {
      return a >= 2 && a <= 5 && b >= 2 && b <= 5 && value === a * b;
    }
    if (step.n === 2) {
      return a >= 0 && a <= 10 && (b === 2 || b === 10) && value === a * b;
    }
    if (step.n === 3) {
      return a >= 0 && a <= 10 && b === 5 && value === a * b;
    }
    if (step.n === 4) {
      return a >= 0 && a <= 10 && (b === 3 || b === 4) && value === a * b;
    }
    if (step.n === 5) {
      return a >= 0 && a <= 10 && (b === 6 || b === 7) && value === a * b;
    }
    if (step.n === 6) {
      return a >= 0 && a <= 10 && (b === 8 || b === 9) && value === a * b;
    }
    if (step.n === 7) {
      return a >= 0 && a <= 10 && b >= 0 && b <= 10 && value === a * b;
    }
    if (step.n === 8) {
      return a >= 1 && a <= 999 && (b === 10 || b === 100) && value === a * b;
    }
    if (step.n === 9) {
      return a >= 10 && a <= 99 && b >= 1 && b <= 9 && value === a * b;
    }
    if (step.n === 10) {
      return a >= 100 && a <= 999 && b >= 1 && b <= 9 && value === a * b;
    }
    if (step.n === 11) {
      return a >= 10 && a <= 99 && b >= 10 && b <= 99 && value === a * b;
    }
    if (step.n === 12) {
      return a >= 10 && a <= 999 && b >= 10 && b <= 999 && value === a * b;
    }
    return a > 0 && b > 0 && Math.abs(value - a * b) < 0.001;
  }
  if (step.n === 1) {
    return a >= 4 && a <= 20 && b >= 2 && b <= 5 && a % b === 0 && value === a / b;
  }
  if (step.n === 2) {
    return (b === 2 || b === 5 || b === 10) && a % b === 0 && value === a / b;
  }
  if (step.n === 3) {
    return (b === 3 || b === 4) && a % b === 0 && value === a / b;
  }
  if (step.n === 4) {
    return b >= 6 && b <= 9 && a % b === 0 && value === a / b;
  }
  if (step.n === 5) {
    return b >= 1 && b <= 10 && a % b === 0 && a / b <= 10 && value === a / b;
  }
  if (step.n === 6) {
    const q = item.operands[2];
    const r = item.operands[3];
    return r > 0 && r < b && q * b + r === a && item.answer === `${q} r ${r}`;
  }
  if (step.n === 7) {
    return a >= 10 && a <= 99 && b >= 2 && b <= 9 && a % b === 0 && value === a / b;
  }
  if (step.n === 8) {
    return a >= 100 && a <= 999 && b >= 2 && b <= 9;
  }
  if (step.n === 9) {
    return b >= 10 && a % b === 0 && value === a / b;
  }
  return a >= 1 && b >= 2 && Math.abs(value - a / b) < 0.011;
}

export const inStepRange = validateStep;

export function allLadderSkills(): string[] {
  return LADDER_STEPS.map((step) => step.skillId);
}
