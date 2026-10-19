import { createRng, intBetween, type Rng } from "../../../engine/rng";

export type PlainItem = {
  prompt: string;
  answer: string;
  steps: string[];
  why: string;
};

/** Same strand, level, and seed always return the same question. */
export function plainQuestion(strandId: string, level: number, seed: number): PlainItem {
  const rung = Math.min(13, Math.max(1, level));
  const rng = createRng((seed + 1) * 997 + rung * 131 + strandSalt(strandId));
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const item = compose(strandId, rung, rng);
    if (!answerLeaks(item.prompt, item.answer)) {
      return item;
    }
  }
  return compose(strandId, rung, rng);
}

function strandSalt(id: string): number {
  return id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function answerLeaks(prompt: string, answer: string): boolean {
  const token = answer.replace(/^-/, "");
  if (token.length === 0) {
    return false;
  }
  return prompt.split(/[^0-9.]+/).filter((part) => part.length > 0).includes(token);
}

function compose(strandId: string, level: number, rng: Rng): PlainItem {
  if (strandId === "counting") {
    return counting(level, rng);
  }
  if (strandId === "measuring") {
    return measuring(level, rng);
  }
  if (strandId === "adding") {
    return adding(level, rng);
  }
  if (strandId === "multiplying") {
    return multiplying(level, rng);
  }
  if (strandId === "dividing") {
    return dividing(level, rng);
  }
  if (strandId === "fractions") {
    return fractions(level, rng);
  }
  if (strandId === "ratios") {
    return ratios(level, rng);
  }
  if (strandId === "geometry") {
    return geometry(level, rng);
  }
  return algebra(level, rng);
}

function item(prompt: string, answer: number | string, steps: string[], why: string): PlainItem {
  const text = String(answer);
  return { prompt, answer: text, steps, why };
}

function counting(level: number, rng: Rng): PlainItem {
  if (level <= 2) {
    const left = intBetween(rng, 2, 8);
    const extra = intBetween(rng, 1, 5);
    return item(`How much larger is ${left + extra} than ${left}?`, extra, [`${left + extra} take away ${left}.`, `The difference is ${extra}.`], "Comparing asks how much more one amount is.");
  }
  if (level <= 4) {
    const left = intBetween(rng, 2, level <= 3 ? 12 : 40);
    const right = intBetween(rng, 2, level <= 3 ? 9 : 30);
    return item(`${left} + ${right}`, left + right, [`Start at ${left}.`, `Count on ${right}.`, `You land on ${left + right}.`], "Adding puts the two amounts together.");
  }
  const groups = intBetween(rng, 2, 6);
  const each = intBetween(rng, 2, 9);
  return item(`${groups} groups of ${each}`, groups * each, [`Each group has ${each}.`, `There are ${groups} groups.`, `That is ${groups * each}.`], "Equal groups are a count of the groups times the size.");
}

function measuring(level: number, rng: Rng): PlainItem {
  if (level <= 2) {
    const left = intBetween(rng, 2, 8);
    const extra = intBetween(rng, 1, 5);
    return item(`How much longer is ${left + extra} than ${left}?`, extra, [`Compare ${left + extra} and ${left}.`, `The longer one wins by ${extra}.`], "The difference is how much longer the bigger length is.");
  }
  if (level <= 4) {
    const span = level <= 3 ? 18 : 90;
    const right = intBetween(rng, 6, span);
    const left = intBetween(rng, 1, right - 1);
    return item(`${right} - ${left}`, right - left, [`Start at ${right}.`, `Take away ${left}.`, `${right - left} is left.`], "The gap between two marks is the difference.");
  }
  return dividing(level, rng);
}

function adding(level: number, rng: Rng): PlainItem {
  if (level <= 3) {
    const cap = level === 1 ? 6 : 12;
    const left = intBetween(rng, 1, cap);
    const right = intBetween(rng, 1, cap);
    return item(`${left} + ${right}`, left + right, [`Put ${left} and ${right} together.`, `The total is ${left + right}.`], "Addition joins two amounts.");
  }
  if (level <= 6) {
    const left = intBetween(rng, 12, level <= 4 ? 60 : 400);
    const right = intBetween(rng, 12, level <= 4 ? 40 : 250);
    return item(`${left} + ${right}`, left + right, [`Add the ones, then the tens.`, `${left} + ${right} = ${left + right}.`], "Add each place, and carry when a place reaches ten.");
  }
  if (level <= 9) {
    const known = intBetween(rng, 2, 15);
    const missing = intBetween(rng, 2, 12);
    return item(`n + ${known} = ${known + missing}`, missing, [`The total is ${known + missing}.`, `Take away the ${known} you already have.`, `n is ${missing}.`], "A missing addend is the total minus the part you know.");
  }
  const left = intBetween(rng, 20, 80);
  const right = intBetween(rng, 20, 80);
  return item(`${left} + ${right}`, left + right, [`Add the tens and the ones.`, `The sum is ${left + right}.`], "Addition joins the two numbers, place by place.");
}

function multiplying(level: number, rng: Rng): PlainItem {
  const left = intBetween(rng, 2, level <= 3 ? 5 : 12);
  const right = intBetween(rng, 2, level <= 5 ? 9 : 12);
  if (level >= 10) {
    return algebra(level, rng);
  }
  return item(`${left} × ${right}`, left * right, [`${left} groups of ${right}.`, `That is ${left * right}.`], "Multiplication is equal groups.");
}

function dividing(level: number, rng: Rng): PlainItem {
  if (level >= 8 && level <= 9) {
    const divisor = intBetween(rng, 2, 9);
    const quot = intBetween(rng, 2, 9);
    return item(`-${divisor * quot} ÷ ${divisor}`, -quot, [`The numbers have opposite signs.`, `The amount is ${quot}.`, `The result is -${quot}.`], "A negative divided by a positive is negative.");
  }
  if (level >= 5 && level <= 6 && rng() > 0.45) {
    const divisor = intBetween(rng, 2, 9);
    const quot = intBetween(rng, 2, 9);
    const remainder = intBetween(rng, 1, divisor - 1);
    const dividend = divisor * quot + remainder;
    return item(`Remainder of ${dividend} ÷ ${divisor}`, remainder, [`${divisor} fits ${quot} times.`, `${remainder} is left over.`], "The remainder is what is left after equal groups.");
  }
  const divisor = intBetween(rng, 2, level <= 3 ? 5 : 9);
  const quot = intBetween(rng, 2, level <= 3 ? 5 : 12);
  return item(`${divisor * quot} ÷ ${divisor}`, quot, [`How many ${divisor}s fit in ${divisor * quot}.`, `That is ${quot}.`], "Division asks how many equal groups fit.");
}

function fractions(level: number, rng: Rng): PlainItem {
  if (level <= 5) {
    return dividing(Math.max(4, level), rng);
  }
  const denominator = intBetween(rng, 2, 6);
  const numerator = intBetween(rng, 1, denominator - 1);
  const groups = intBetween(rng, 2, 6);
  const whole = groups * denominator;
  return item(`${numerator}/${denominator} of ${whole}`, groups * numerator, [`${whole} split into ${denominator} equal parts is ${groups} each.`, `${numerator} of those parts is ${groups * numerator}.`], "A fraction of a whole is that many equal parts.");
}

function ratios(level: number, rng: Rng): PlainItem {
  if (level <= 6) {
    return multiplying(Math.max(4, level), rng);
  }
  if (level <= 8) {
    const percent = intBetween(rng, 2, 5) * 10;
    const whole = intBetween(rng, 2, 8) * 10;
    return item(`${percent}% of ${whole}`, (percent / 100) * whole, [`${percent}% is ${percent / 10} tenths of the whole.`, `${percent}% of ${whole} is ${(percent / 100) * whole}.`], "Percent is a fraction of 100.");
  }
  return algebra(level, rng);
}

function geometry(level: number, rng: Rng): PlainItem {
  if (level >= 12) {
    const angle = intBetween(rng, 2, 8) * 5;
    return item(`A right triangle has an acute angle of ${angle} degrees. What is the other acute angle?`, 90 - angle, [`The two acute angles add to 90.`, `90 - ${angle} = ${90 - angle}.`], "The acute angles of a right triangle add to 90 degrees.");
  }
  if (level >= 9) {
    const triples: readonly [number, number, number][] = [
      [3, 4, 5],
      [6, 8, 10],
      [5, 12, 13],
    ];
    const triple = triples[intBetween(rng, 0, triples.length - 1)];
    return item(
      `A right triangle has legs ${triple[0]} and ${triple[1]}. How long is the hypotenuse?`,
      triple[2],
      [`Square ${triple[0]} and square ${triple[1]}.`, `Add the squares.`, `The square root is ${triple[2]}.`],
      "The long side is the square root of the two short sides, squared and added.",
    );
  }
  const width = intBetween(rng, 2, level <= 4 ? 6 : 12);
  const height = intBetween(rng, 2, level <= 4 ? 6 : 9);
  return item(`Area of a ${width} by ${height} rectangle`, width * height, [`${width} rows of ${height}.`, `The area is ${width * height}.`], "Area of a rectangle is length times width.");
}

function algebra(level: number, rng: Rng): PlainItem {
  if (level >= 12) {
    const root = intBetween(rng, 2, 9);
    return item(`x² = ${root * root}`, root, [`What number times itself is ${root * root}.`, `x is ${root}.`], "A square root undoes a square.");
  }
  if (level >= 10) {
    const slope = intBetween(rng, 2, 6);
    const x = intBetween(rng, 2, 6);
    return item(`y = ${slope}x. What is y when x is ${x}?`, slope * x, [`${slope} times ${x}.`, `y is ${slope * x}.`], "A line through the origin multiplies x by the slope.");
  }
  const factor = intBetween(rng, 2, 6);
  const value = intBetween(rng, 2, 8);
  const added = intBetween(rng, 1, 7);
  const total = factor * value + added;
  return item(`${factor}x + ${added} = ${total}`, value, [`Take away ${added}.`, `${factor}x = ${factor * value}.`, `x is ${value}.`], "Undo the addition, then undo the multiplication.");
}
