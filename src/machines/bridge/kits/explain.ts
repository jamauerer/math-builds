import type { EarnFact, EarnQuestion } from "./earn";
import type { PlainDraw } from "../../../pictures/parts";

export type ExplainPicture = "triangle" | "squares" | "sum" | "root" | "pile" | "rows" | "count";

export type ExplainStep = {
  text: string;
  picture: ExplainPicture;
  a?: number;
  b?: number;
  count?: number;
  rows?: number;
  each?: number;
};

const PICTURES: ExplainPicture[] = ["pile", "rows", "count", "sum", "triangle", "squares", "root"];

/** A worked example: the missed question's numbers, at least three steps, a new picture each step. */
export function workedExample(question: EarnQuestion): { steps: ExplainStep[]; why: string } {
  const fact = question.fact;
  if (fact.kind === "plain") {
    return { steps: fromDraw(fact.draw, fact.prompt, question.answer), why: fact.why };
  }
  if (fact.kind === "brace-hyp") {
    return { steps: hypSteps(fact.across, fact.up), why: "The long side is the square root of the two short sides, squared and added." };
  }
  return { steps: fromNumbers(numbersOf(fact, question), question.answer), why: "The question uses these numbers. The last step is the result." };
}

function fromDraw(draw: PlainDraw, prompt: string, answer: string): ExplainStep[] {
  if (draw.op === "hyp") {
    return cover(hypSteps(draw.a, draw.b), prompt);
  }
  if (draw.op === "div" || draw.op === "rem") {
    return cover(divSteps(draw, answer), prompt);
  }
  const extra = draw.c != null && draw.c !== -1 ? draw.c : null;
  const steps: ExplainStep[] = [
    { text: `Start with ${draw.a}.`, picture: "pile", a: draw.a, count: Math.min(24, Math.max(1, Math.abs(draw.a))) },
    {
      text: extra == null ? `Use ${draw.b} next.` : `Use ${draw.b} and ${extra}.`,
      picture: "rows",
      a: draw.a,
      b: draw.b,
      rows: Math.max(1, Math.min(8, Math.abs(draw.b))),
      each: Math.max(1, Math.min(8, Math.abs(extra ?? draw.a))),
    },
    { text: `That comes to ${answer}.`, picture: "count", each: Math.max(1, Math.min(12, Math.abs(Number(answer)) || 1)) },
  ];
  return cover(steps, prompt);
}

function divSteps(draw: PlainDraw, answer: string): ExplainStep[] {
  const dividend = draw.a;
  const divisor = Math.max(1, draw.b);
  const row = draw.op === "rem" ? (draw.c ?? Number(answer)) : Math.max(1, Math.abs(Number(answer)) || 1);
  const sign = draw.c === -1 ? "-" : "";
  return [
    { text: `${sign}${dividend} bolts.`, picture: "pile", count: Math.min(24, dividend), a: dividend },
    { text: `Sorted into ${divisor} rows.`, picture: "rows", rows: Math.min(8, divisor), each: Math.min(8, row), a: dividend, b: divisor },
    { text: `Count a row: ${answer}.`, picture: "count", each: Math.min(12, row), b: divisor },
  ];
}

function hypSteps(across: number, up: number): ExplainStep[] {
  const left = across * across;
  const right = up * up;
  const sum = left + right;
  const root = Math.hypot(across, up);
  const whole = Math.abs(root - Math.round(root)) < 1e-6;
  const shown = whole ? String(Math.round(root)) : (Math.round(root * 10) / 10).toFixed(1);
  const last = whole
    ? `${sum} is ${shown} x ${shown}, so the brace is ${shown}.`
    : `${sum} is not a whole square. Round to one decimal, so the brace is ${shown}.`;
  return [
    { text: `A right triangle with legs ${across} and ${up}.`, picture: "triangle", a: across, b: up },
    {
      text: `A square on the leg of ${across} has ${left} small squares. A square on the leg of ${up} has ${right} small squares.`,
      picture: "squares",
      a: left,
      b: right,
    },
    { text: `${left} + ${right} = ${sum}.`, picture: "sum", a: left, b: right },
    { text: last, picture: "root", a: across, b: up, count: Number(shown) },
  ];
}

function fromNumbers(numbers: number[], answer: string): ExplainStep[] {
  const [first, second, third] = numbers.length > 0 ? numbers : [0];
  const steps: ExplainStep[] = [
    { text: `Start with ${first}.`, picture: "pile", a: first, count: Math.min(24, Math.max(1, Math.abs(first))) },
    { text: second == null ? `Keep ${first} in mind.` : third == null ? `Use ${second} next.` : `Use ${second} and ${third}.`, picture: "rows", a: first, b: second, rows: 2, each: 2 },
    { text: `That comes to ${answer}.`, picture: "count", each: Math.max(1, Math.min(12, Math.abs(Number(answer)) || 1)) },
  ];
  return cover(steps, numbers.join(" "));
}

function cover(steps: ExplainStep[], prompt: string): ExplainStep[] {
  const needed = prompt.match(/\d+(\.\d+)?/g) ?? [];
  let joined = steps.map((step) => step.text).join(" ");
  for (const number of needed) {
    if (!joined.includes(number)) {
      steps[0] = { ...steps[0], text: `${number}. ${steps[0].text}` };
      joined = steps.map((step) => step.text).join(" ");
    }
  }
  while (steps.length < 3) {
    const picture = PICTURES[steps.length % PICTURES.length];
    steps.push({ text: steps[steps.length - 1]?.text ?? "Look again.", picture });
  }
  return steps.map((step, index) => {
    const previous = index > 0 ? steps[index - 1].picture : null;
    if (previous !== step.picture) {
      return step;
    }
    return { ...step, picture: PICTURES[(PICTURES.indexOf(step.picture) + 1) % PICTURES.length] };
  });
}

function numbersOf(fact: EarnFact, question: EarnQuestion): number[] {
  switch (fact.kind) {
    case "count-planks":
    case "count-posts":
    case "count-pieces":
    case "count-gussets":
    case "count-braces":
    case "count-bolts":
    case "count-rails":
      return [fact.count];
    case "between-posts":
      return [fact.left, fact.right];
    case "posts-timber":
      return [fact.each, fact.count];
    case "triangles":
      return [fact.diagonals, fact.each];
    case "beam-weight":
      return [fact.pieces, fact.each];
    case "bolts-combine":
      return [fact.plates, fact.each];
    case "rail-both":
      return [fact.side];
    case "split-gap":
      return [fact.gap, fact.beams];
    case "add-parts":
      return [fact.left, fact.right];
    case "brace-hyp":
      return [fact.across, fact.up];
    case "piece":
      return fact.used.length > 0 ? fact.used : (question.answer.match(/\d+(\.\d+)?/g) ?? []).map(Number);
    default:
      return [];
  }
}
