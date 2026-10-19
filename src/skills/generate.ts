import { createRng, intBetween, pick, shuffle, type Rng } from "../engine/rng";
import type { PlainDraw } from "../pictures/parts";
import { curriculumSkill, type CurriculumSkill } from "./index";

export type ChoiceOption = {
  value: string;
  kind: "number" | "label" | "picture";
  label?: string;
  draw?: PlainDraw;
};

export type SkillItem = {
  prompt: string;
  answer: string;
  steps: string[];
  why: string;
  draw: PlainDraw;
  truth?: number;
  choices?: ChoiceOption[];
};

/** One plain question in the curriculum notation form for this skill. */
export function skillQuestion(skillId: string, seed: number): SkillItem {
  const skill = curriculumSkill(skillId);
  if (!skill) {
    throw new Error(`Unknown skill ${skillId}`);
  }
  const rng = createRng((seed + 1) * 997 + skill.level * 131 + salt(skillId));
  return make(skill, rng);
}

function salt(id: string): number {
  return id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function item(prompt: string, answer: number | string, steps: string[], why: string, draw: PlainDraw, choices?: ChoiceOption[]): SkillItem {
  const numeric = typeof answer === "number" ? answer : Number(answer);
  const whole = Number.isFinite(numeric) && Math.abs(numeric - Math.round(numeric)) < 1e-9;
  const shown = whole || !Number.isFinite(numeric) ? String(answer) : (Math.round(numeric * 10) / 10).toFixed(1);
  return {
    prompt,
    answer: shown,
    steps,
    why,
    draw,
    truth: whole || !Number.isFinite(numeric) ? undefined : numeric,
    choices,
  };
}

function choice(prompt: string, answer: string, steps: string[], why: string, draw: PlainDraw, options: ChoiceOption[], rng: Rng): SkillItem {
  const unique = options.filter((option, index, list) => list.findIndex((item) => item.value === option.value) === index);
  if (unique.length < 2 || unique.length > 4) {
    throw new Error(`Choice needs 2 to 4 options, got ${unique.length} for ${prompt}`);
  }
  if (!unique.some((option) => option.value === answer)) {
    throw new Error(`Choice answer ${answer} missing from options for ${prompt}`);
  }
  return item(prompt, answer, steps, why, draw, shuffle(rng, unique));
}

function numOpt(value: string | number): ChoiceOption {
  return { value: String(value), kind: "number", label: String(value) };
}

function labelOpt(value: string, label = value): ChoiceOption {
  return { value, kind: "label", label };
}

function picOpt(value: string, draw: PlainDraw, label?: string): ChoiceOption {
  return { value, kind: "picture", draw, label };
}

function makeChoice(skill: CurriculumSkill, rng: Rng): SkillItem {
  const id = skill.id;
  const why = skill.learnPicture;

  if (id.includes("compare") && id.includes("counting")) {
    const a = intBetween(rng, 3, 9);
    const b = intBetween(rng, 1, a - 1);
    return choice(
      "Which has more?",
      String(a),
      [`${a} is more than ${b}.`],
      why,
      { op: "compare", a, b },
      [picOpt(String(a), { op: "groups", a, b: 1 }), picOpt(String(b), { op: "groups", a: b, b: 1 })],
      rng,
    );
  }
  if (id.includes("numerals")) {
    const n = intBetween(rng, 0, 10);
    const pool = shuffle(
      rng,
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].filter((value) => value !== n),
    ).slice(0, 3);
    return choice(`Tap ${n}`, String(n), [`Find ${n}.`], why, { op: "add", a: n, b: 0 }, [n, ...pool].map(numOpt), rng);
  }
  if (id.includes("to-1000") && skill.answer === "choice") {
    const tens = intBetween(rng, 1, 8);
    const onesA = intBetween(rng, 1, 8);
    const onesB = intBetween(rng, onesA + 1, 9);
    const left = 300 + tens * 10 + onesA;
    const right = 300 + tens * 10 + onesB;
    const bigger = Math.max(left, right);
    return choice(
      `Tap the bigger number: ${left} or ${right}`,
      String(bigger),
      [`${bigger} is bigger.`],
      why,
      { op: "compare", a: left, b: right },
      [numOpt(left), numOpt(right)],
      rng,
    );
  }
  if (id.includes("even-odd")) {
    const n = intBetween(rng, 10, 40);
    const answer = n % 2 === 0 ? "even" : "odd";
    return choice(`Is ${n} even or odd?`, answer, [`${n} is ${answer}.`], why, { op: "add", a: n, b: 0 }, [labelOpt("even"), labelOpt("odd")], rng);
  }
  if (id.includes("factors") && !id.includes("gcf")) {
    return choice(`Is 24 a multiple of 6?`, "yes", [`24 ÷ 6 = 4.`], why, { op: "mul", a: 6, b: 4 }, [labelOpt("yes"), labelOpt("no")], rng);
  }
  if (id.includes("primes")) {
    return choice(`Is 17 prime?`, "yes", [`17 has only 1 and itself.`], why, { op: "add", a: 17, b: 0 }, [labelOpt("yes"), labelOpt("no")], rng);
  }
  if (id.includes("negatives")) {
    return choice(`Which is colder, -3 or -7?`, "-7", [`-7 is farther below zero.`], why, { op: "compare", a: -3, b: -7 }, [numOpt("-3"), numOpt("-7")], rng);
  }
  if (id.includes("estimate")) {
    return choice(`About how much is 298 + 403?`, "700", [`Round first.`], why, { op: "add", a: 300, b: 400 }, [numOpt("500"), numOpt("700"), numOpt("900")], rng);
  }
  if (id.includes("halves")) {
    return choice(
      "Tap the plank cut in half",
      "half",
      ["Two equal parts."],
      why,
      { op: "frac", a: 1, b: 2, c: 2 },
      [
        picOpt("half", { op: "frac", a: 1, b: 2, c: 2 }, "2 equal"),
        picOpt("third", { op: "frac", a: 1, b: 3, c: 3 }, "3 equal"),
        picOpt("unequal", { op: "frac", a: 1, b: 2, c: -2 }, "2 unequal"),
      ],
      rng,
    );
  }
  if (id.includes("fractions.4.unit") || (id.includes("unit") && id.includes("fractions"))) {
    return choice(`Where is 1/4 on the tape?`, "1/4", [`One of four equal parts.`], why, { op: "frac", a: 1, b: 4, c: 4 }, [labelOpt("1/4"), labelOpt("1/2"), labelOpt("3/4")], rng);
  }
  if (id.includes("fractions.4.compare")) {
    return choice(`Which is bigger, 2/3 or 3/5?`, "2/3", [`Compare carefully.`], why, { op: "frac", a: 2, b: 3, c: 5 }, [labelOpt("2/3"), labelOpt("3/5")], rng);
  }
  if (id.includes("decimal-compare")) {
    return choice(`Order 0.6, 2/3, 0.65`, "2/3", [`2/3 is about 0.67.`], why, { op: "frac", a: 2, b: 3, c: 3 }, [labelOpt("0.6"), labelOpt("2/3"), labelOpt("0.65")], rng);
  }
  if (id.includes("longer") && id.includes("measuring")) {
    const a = intBetween(rng, 4, 8);
    const b = intBetween(rng, 2, a - 1);
    return choice(
      "Which beam is longer?",
      String(a),
      [`${a} is longer than ${b}.`],
      why,
      { op: "compare", a, b },
      [picOpt(String(a), { op: "compare", a, b: 0 }, `${a}`), picOpt(String(b), { op: "compare", a: b, b: 0 }, `${b}`)],
      rng,
    );
  }
  if (id.includes("time") && id.includes("measuring")) {
    return choice(`Started at 2:45, took 35 min, ends at ?`, "3:20", [`Add 35 minutes.`], why, { op: "add", a: 45, b: 35 }, [labelOpt("3:20"), labelOpt("3:15"), labelOpt("2:80")], rng);
  }
  if (id.includes("angles") && id.includes("measuring")) {
    return choice(`What angle is the brace?`, "acute", [`Less than 90.`], why, { op: "angle", a: 45, b: 90 }, [labelOpt("acute"), labelOpt("right"), labelOpt("obtuse")], rng);
  }
  if (id.includes("shapes")) {
    return choice(`Tap the triangle`, "triangle", [`Three sides.`], why, { op: "angle", a: 3, b: 3 }, [labelOpt("triangle"), labelOpt("square"), labelOpt("circle")], rng);
  }
  if (id.includes("angles-names")) {
    const answer = pick(rng, ["right", "acute", "obtuse"] as const);
    const deg = answer === "right" ? 90 : answer === "acute" ? intBetween(rng, 25, 70) : intBetween(rng, 100, 150);
    return choice(
      "Is this angle right, acute or obtuse?",
      answer,
      [`A ${answer} angle.`],
      why,
      { op: "angle", a: deg, b: 90 },
      [labelOpt("right"), labelOpt("acute"), labelOpt("obtuse")],
      rng,
    );
  }
  if (id.includes("symmetry")) {
    return choice(`Tap the line of symmetry`, "vertical", [`The fold line.`], why, { op: "line", a: 1, b: 0 }, [labelOpt("vertical"), labelOpt("horizontal"), labelOpt("none")], rng);
  }
  if (id.includes("longest-side")) {
    return choice(
      "Which is longer, the brace or the post?",
      "brace",
      ["The brace is the longest side."],
      why,
      { op: "hyp", a: 3, b: 2 },
      [labelOpt("brace"), labelOpt("post"), labelOpt("beam")],
      rng,
    );
  }
  if (id.includes("coordinates")) {
    return choice(`Which point is (3, 2)?`, "(3, 2)", [`Across 3, up 2.`], why, { op: "add", a: 3, b: 2 }, [labelOpt("(3, 2)"), labelOpt("(2, 3)"), labelOpt("(0, 0)")], rng);
  }
  if (id.includes("triangles") && skill.answer === "choice") {
    return choice(
      "Are these two braces the same triangle?",
      "yes",
      ["Matching sides."],
      why,
      { op: "hyp", a: 3, b: 4 },
      [labelOpt("yes"), labelOpt("no")],
      rng,
    );
  }
  if (id.includes("proofs")) {
    return choice(`Which fact proves the braces are equal?`, "SAS", [`Matching sides and angle.`], why, { op: "angle", a: 1, b: 1 }, [labelOpt("SAS"), labelOpt("AAA"), labelOpt("SSA")], rng);
  }
  if (id.includes("inequalities")) {
    return choice(`Which x make 3x < 12?`, "x < 4", [`Divide by 3.`], why, { op: "mul", a: 3, b: 4 }, [labelOpt("x < 4"), labelOpt("x > 4"), labelOpt("x = 4")], rng);
  }
  throw new Error(`No choice generator for ${id}`);
}

function make(skill: CurriculumSkill, rng: Rng): SkillItem {
  if (skill.answer === "choice") {
    return makeChoice(skill, rng);
  }
  const id = skill.id;
  if (id.startsWith("counting.1.to-10") || id.startsWith("counting.2.to-100")) {
    const n = intBetween(rng, 1, id.includes("100") ? 40 : 10);
    return item(`How many?`, n, [`Count the bolts.`, `There are ${n}.`], skill.learnPicture, { op: "add", a: n, b: 0 });
  }
  if (id.includes("compare") || id.includes("longer") || id.includes("colder") || id.includes("heavier")) {
    const a = intBetween(rng, 2, 9);
    const b = intBetween(rng, 1, a - 1);
    return item(`Which has more?`, String(a), [`${a} is more than ${b}.`], skill.learnPicture, { op: "compare", a, b });
  }
  if (id.includes("skip-2")) {
    const start = intBetween(rng, 1, 3) * 2;
    return item(`${start}, ${start + 2}, ${start + 4}, ?, ${start + 8}`, start + 6, [`Count by 2.`, `The missing number is ${start + 6}.`], skill.learnPicture, { op: "add", a: start, b: 2 });
  }
  if (id.includes("place-value")) {
    const tens = intBetween(rng, 1, 9);
    const ones = intBetween(rng, 0, 9);
    return item(`${tens * 10 + ones} = ? tens and ? ones`, tens, [`${tens} tens and ${ones} ones.`], skill.learnPicture, { op: "add", a: tens, b: ones });
  }
  if (id.includes("round-10")) {
    const n = intBetween(rng, 11, 89);
    const rounded = Math.round(n / 10) * 10;
    return item(`Round ${n} to the nearest 10`, rounded, [`${n} is nearer ${rounded}.`], skill.learnPicture, { op: "add", a: n, b: rounded });
  }
  if (id.includes("round-100")) {
    const n = intBetween(rng, 1100, 2900);
    const rounded = Math.round(n / 100) * 100;
    return item(`Round ${n.toLocaleString("en-US")} to the nearest 100`, rounded, [`${n} is nearer ${rounded}.`], skill.learnPicture, { op: "add", a: n, b: rounded });
  }
  if (id.includes("even-odd")) {
    const n = intBetween(rng, 10, 40);
    const answer = n % 2 === 0 ? "even" : "odd";
    return item(`Is ${n} even or odd?`, answer, [`${n} is ${answer}.`], skill.learnPicture, { op: "add", a: n, b: 0 });
  }
  if (id.includes("factors") && !id.includes("gcf")) {
    return item(`Is 24 a multiple of 6?`, "yes", [`24 ÷ 6 = 4.`], skill.learnPicture, { op: "mul", a: 6, b: 4 });
  }
  if (id.includes("primes")) {
    return item(`Is 17 prime?`, "yes", [`17 has only 1 and itself.`], skill.learnPicture, { op: "add", a: 17, b: 0 });
  }
  if (id.includes("negatives") && skill.answer === "choice") {
    return item(`Which is colder, -3 or -7?`, "-7", [`-7 is farther below zero.`], skill.learnPicture, { op: "compare", a: -3, b: -7 });
  }
  if (id.includes("integers-add")) {
    const a = -intBetween(rng, 1, 6);
    const b = intBetween(rng, 2, 9);
    return item(`${a} + ${b} = ?`, a + b, [`${a} + ${b} = ${a + b}.`], skill.learnPicture, { op: "add", a, b });
  }
  if (id.includes("integers-multiply") || id === "counting.8.integers-multiply") {
    const a = -intBetween(rng, 2, 5);
    const b = intBetween(rng, 2, 6);
    return item(`${a} × ${b} = ?`, a * b, [`${a} times ${b} is ${a * b}.`], skill.learnPicture, { op: "mul", a: Math.abs(a), b, c: -1 });
  }
  if (id.includes("exponents") && !id.includes("rules")) {
    const base = intBetween(rng, 2, 4);
    const power = intBetween(rng, 2, 4);
    return item(`${base}^${power} = ?`, base ** power, [`${base} multiplied ${power} times.`], skill.learnPicture, { op: "mul", a: base, b: power });
  }
  if (id.includes("scientific")) {
    return item(`Write 4500 as a × 10^n`, "4.5 × 10^3", [`4.5 times 10 to the 3.`], skill.learnPicture, { op: "mul", a: 45, b: 100 });
  }

  if (id.includes("to-5") && id.includes("adding.1") && !id.includes("take")) {
    const a = intBetween(rng, 1, 3);
    const b = intBetween(rng, 1, 5 - a);
    return item(`${a} + ${b} = ?`, a + b, [`${a} + ${b} = ${a + b}.`], skill.learnPicture, { op: "add", a, b });
  }
  if (id.includes("take-away")) {
    const total = intBetween(rng, 3, 5);
    const take = intBetween(rng, 1, total - 1);
    return item(`${total} − ${take} = ?`, total - take, [`${total} take away ${take}.`], skill.learnPicture, { op: "sub", a: total, b: take });
  }
  if (id.includes("to-20") && id.includes("adding") && !id.includes("subtract")) {
    const a = intBetween(rng, 4, 12);
    const b = intBetween(rng, 3, Math.min(9, 20 - a));
    return item(`${a} + ${b} = ?`, a + b, [`${a} + ${b} = ${a + b}.`], skill.learnPicture, { op: "add", a, b });
  }
  if (id.includes("subtract-20") || (id.includes("subtract") && skill.level <= 3)) {
    const a = intBetween(rng, 10, 20);
    const b = intBetween(rng, 2, 9);
    return item(`${a} − ${b} = ?`, a - b, [`${a} − ${b} = ${a - b}.`], skill.learnPicture, { op: "sub", a, b });
  }
  if (id.includes("missing") || id.includes("unknown") && skill.level <= 6) {
    const known = intBetween(rng, 2, 12);
    const missing = intBetween(rng, 2, 10);
    return item(`${known} + ? = ${known + missing}`, missing, [`Take away ${known}.`, `? is ${missing}.`], skill.learnPicture, { op: "missing", a: known, b: known + missing });
  }
  if (id.includes("three-numbers")) {
    const a = intBetween(rng, 2, 8);
    const b = intBetween(rng, 2, 8);
    const c = intBetween(rng, 2, 8);
    return item(`${a} + ${b} + ${c} = ?`, a + b + c, [`Add ${a}, ${b} and ${c}.`], skill.learnPicture, { op: "add", a, b: b + c });
  }
  if (id.includes("to-100") && !id.includes("subtract") && !id.includes("to-1000")) {
    const a = intBetween(rng, 20, 60);
    const b = intBetween(rng, 10, 40);
    return item(`${a} + ${b} = ?`, a + b, [`${a} + ${b} = ${a + b}.`], skill.learnPicture, { op: "add", a, b });
  }
  if (id.includes("to-1000") || id.includes("big-numbers")) {
    const a = intBetween(rng, 100, 500);
    const b = intBetween(rng, 100, 400);
    return item(`${a} + ${b} = ?`, a + b, [`Add by place.`], skill.learnPicture, { op: "add", a, b });
  }
  if (id.includes("estimate")) {
    return item(`About how much is 298 + 403?`, "700", [`Round first.`], skill.learnPicture, { op: "add", a: 300, b: 400 });
  }
  if (id.includes("decimals-tenths") || id.includes("adding.5.decimals") || id.includes("adding.6.decimals") || id.includes("adding.8.integers-mixed")) {
    const a = intBetween(rng, 10, 40) / 10;
    const b = intBetween(rng, 10, 30) / 10;
    const sum = Math.round((a + b) * 10) / 10;
    return item(`${a} + ${b} = ?`, sum, [`Line up the point.`], skill.learnPicture, { op: "add", a, b });
  }
  if (id.includes("fractions-like")) {
    const d = intBetween(rng, 4, 8);
    const a = intBetween(rng, 1, d - 2);
    const b = intBetween(rng, 1, d - a);
    return item(`${a}/${d} + ${b}/${d} = ?`, `${a + b}/${d}`, [`Add the tops.`], skill.learnPicture, { op: "frac", a, b: d, c: a + b });
  }
  if (id.includes("fractions-unlike") || id.includes("mixed") && id.includes("adding.7")) {
    return item(`1/2 + 1/3 = ?`, "5/6", [`Common denominator 6.`], skill.learnPicture, { op: "frac", a: 1, b: 2, c: 3 });
  }

  if (id.includes("equal-groups") || id.includes("tables") || id.includes("doubles") || id.includes("two-by-one") || id.includes("multi-digit") || (id.includes("multiplying") && skill.level <= 5 && !id.includes("lcm") && !id.includes("by-10"))) {
    const a = intBetween(rng, 2, skill.level <= 3 ? 5 : 9);
    const b = intBetween(rng, 2, skill.level <= 4 ? 5 : 9);
    return item(`${a} × ${b} = ?`, a * b, [`${a} groups of ${b}.`], skill.learnPicture, { op: "mul", a, b });
  }
  if (id.includes("by-10-100") && id.includes("multiplying")) {
    const a = intBetween(rng, 12, 48);
    return item(`${a} × 10 = ?`, a * 10, [`Digits slide left.`], skill.learnPicture, { op: "mul", a, b: 10 });
  }
  if (id.includes("lcm")) {
    return item(`LCM of 4 and 6 = ?`, "12", [`4, 8, 12 and 6, 12.`], skill.learnPicture, { op: "mul", a: 4, b: 6 });
  }
  if (id.includes("multiplying.6.decimals") || id.includes("multiplying.8.integers")) {
    return item(`2.5 × 4 = ?`, "10", [`2.5 four times.`], skill.learnPicture, { op: "mul", a: 25, b: 4 });
  }
  if (id.includes("multiplying.6.fractions") || id.includes("multiplying.7.mixed")) {
    return item(`2/3 × 3/4 = ?`, "1/2", [`Multiply tops and bottoms.`], skill.learnPicture, { op: "frac", a: 2, b: 3, c: 4 });
  }
  if (id.includes("exponent-rules")) {
    return item(`2^3 × 2^4 = 2^?`, "7", [`Add the exponents.`], skill.learnPicture, { op: "add", a: 3, b: 4 });
  }

  if (id.includes("share") || id.includes("facts-5") || id.includes("facts-10") || id.includes("fact-families") || id.includes("long") || (id.includes("dividing") && skill.level <= 6 && !id.includes("remainder") && !id.includes("decimal") && !id.includes("by-10"))) {
    const b = intBetween(rng, 2, skill.level <= 4 ? 5 : 9);
    const q = intBetween(rng, 2, skill.level <= 4 ? 5 : 9);
    return item(`${b * q} ÷ ${b} = ?`, q, [`How many ${b}s fit.`], skill.learnPicture, { op: "div", a: b * q, b });
  }
  if (id.includes("remainders")) {
    const b = intBetween(rng, 3, 8);
    const q = intBetween(rng, 2, 7);
    const r = intBetween(rng, 1, b - 1);
    return item(`${b * q + r} ÷ ${b} = ? r ?`, r, [`Quotient ${q}, remainder ${r}.`], skill.learnPicture, { op: "rem", a: b * q + r, b, c: r });
  }
  if (id.includes("by-10-100") && id.includes("dividing")) {
    const a = intBetween(rng, 2, 9) * 10;
    return item(`${a} ÷ 10 = ?`, a / 10, [`Digits slide right.`], skill.learnPicture, { op: "div", a, b: 10 });
  }
  if (id.includes("dividing.6.decimals") || id.includes("dividing.8.integers")) {
    return item(`7 ÷ 2 = ?`, "3.5", [`7 halves.`], skill.learnPicture, { op: "div", a: 7, b: 2 });
  }
  if (id.includes("dividing.7.fractions")) {
    return item(`3 ÷ (1/2) = ?`, "6", [`How many halves fit in 3.`], skill.learnPicture, { op: "div", a: 3, b: 2 });
  }
  if (id.includes("gcf")) {
    return item(`GCF of 24 and 36 = ?`, "12", [`Common factors.`], skill.learnPicture, { op: "div", a: 24, b: 12 });
  }

  if (id.includes("halves")) {
    return item(`Tap the plank cut in half`, "half", [`Two equal parts.`], skill.learnPicture, { op: "frac", a: 1, b: 2, c: 2 });
  }
  if (id.includes("fractions.3.name") || id.includes("name") && id.includes("fractions")) {
    return item(`What part is colored?`, "2/3", [`2 of 3 parts.`], skill.learnPicture, { op: "frac", a: 2, b: 3, c: 3 });
  }
  if (id.includes("unit") && id.includes("fractions")) {
    return item(`Where is 1/4 on the tape?`, "1/4", [`One of four equal parts.`], skill.learnPicture, { op: "frac", a: 1, b: 4, c: 4 });
  }
  if (id.includes("equivalent")) {
    return item(`2/4 = ?/8`, "4", [`Double top and bottom.`], skill.learnPicture, { op: "frac", a: 2, b: 4, c: 8 });
  }
  if (id.includes("fractions.4.compare") || id.includes("decimal-compare")) {
    return item(`Which is bigger, 2/3 or 3/5?`, "2/3", [`Compare carefully.`], skill.learnPicture, { op: "frac", a: 2, b: 3, c: 5 });
  }
  if (id.includes("of-a-number")) {
    const whole = intBetween(rng, 2, 5) * 4;
    return item(`3/4 of ${whole} = ?`, (3 * whole) / 4, [`Three quarters of ${whole}.`], skill.learnPicture, { op: "frac", a: 3, b: 4, c: whole });
  }
  if (id.includes("decimals-tenths") && id.includes("fractions")) {
    return item(`3/10 = 0.?`, "3", [`Tenths.`], skill.learnPicture, { op: "frac", a: 3, b: 10, c: 10 });
  }
  if (id.includes("simplify")) {
    return item(`6/8 = ?`, "3/4", [`Divide by 2.`], skill.learnPicture, { op: "frac", a: 6, b: 8, c: 4 });
  }
  if (id.includes("to-decimal")) {
    return item(`3/4 = 0.?`, "75", [`Hundredths.`], skill.learnPicture, { op: "frac", a: 3, b: 4, c: 4 });
  }
  if (id.includes("improper")) {
    return item(`7/4 = 1 ?/4`, "3", [`One whole and 3 quarters.`], skill.learnPicture, { op: "frac", a: 7, b: 4, c: 4 });
  }
  if (id.includes("repeating")) {
    return item(`1/3 = 0.?`, "3...", [`Repeating.`], skill.learnPicture, { op: "frac", a: 1, b: 3, c: 3 });
  }

  if (id.includes("write") && id.includes("ratios")) {
    return item(`3 bolts for every 2 planks: 3:2. 9 bolts, how many planks?`, "6", [`Same ratio.`], skill.learnPicture, { op: "mul", a: 3, b: 2 });
  }
  if (id.includes("unit-rate") || id.includes("rates")) {
    return item(`12 lb for 4 ft, how many lb per ft?`, "3", [`12 ÷ 4.`], skill.learnPicture, { op: "div", a: 12, b: 4 });
  }
  if (id.includes("percent") && !id.includes("change")) {
    return item(`25% of 80 = ?`, "20", [`A quarter of 80.`], skill.learnPicture, { op: "percent", a: 25, b: 80 });
  }
  if (id.includes("percent-change")) {
    return item(`80 lb up 25% = ?`, "100", [`Add a quarter.`], skill.learnPicture, { op: "percent", a: 25, b: 80 });
  }
  if (id.includes("scale") || id.includes("proportion")) {
    return item(`3/4 = x/12`, "9", [`Cross multiply.`], skill.learnPicture, { op: "mul", a: 3, b: 4 });
  }
  if (id.includes("slope") || id.includes("similar")) {
    return item(`Rise 3, run 12, slope = ?`, "1/4", [`Rise over run.`], skill.learnPicture, { op: "frac", a: 3, b: 12, c: 12 });
  }

  if (id.includes("units") || id.includes("gap") || id.includes("measure")) {
    const a = intBetween(rng, 2, 6);
    const b = intBetween(rng, a + 1, 8);
    return item(`Posts at ${a} and ${b}. How far apart?`, b - a, [`${b} − ${a}.`], skill.learnPicture, { op: "sub", a: b, b: a });
  }
  if (id.includes("perimeter")) {
    return item(`Sides 3, 4, 3, 4. Perimeter = ?`, "14", [`Add the sides.`], skill.learnPicture, { op: "add", a: 7, b: 7 });
  }
  if (id.includes("weight")) {
    return item(`40 lb + 40 lb = ?`, "80", [`Two goats.`], skill.learnPicture, { op: "add", a: 40, b: 40 });
  }
  if (id.includes("area") && !id.includes("triangle") && !id.includes("compound") && !id.includes("circle")) {
    const a = intBetween(rng, 3, 8);
    const b = intBetween(rng, 3, 8);
    return item(`${a} by ${b} = ? square ft`, a * b, [`${a} × ${b}.`], skill.learnPicture, { op: "area", a, b });
  }
  if (id.includes("convert")) {
    return item(`3 ft = ? in`, "36", [`12 inches in a foot.`], skill.learnPicture, { op: "mul", a: 3, b: 12 });
  }
  if (id.includes("decimal-length")) {
    return item(`2.8 ft on the tape`, "2.8", [`Read the tenths.`], skill.learnPicture, { op: "add", a: 28, b: 10 });
  }
  if (id.includes("time")) {
    return item(`Started at 2:45, took 35 min, ends at ?`, "3:20", [`Add 35 minutes.`], skill.learnPicture, { op: "add", a: 45, b: 35 });
  }
  if (id.includes("volume")) {
    return item(`3 × 4 × 2 = ? cubic ft`, "24", [`Multiply.`], skill.learnPicture, { op: "mul", a: 12, b: 2 });
  }
  if (id.includes("angles") && id.includes("measuring")) {
    return item(`What angle is the brace?`, "acute", [`Less than 90.`], skill.learnPicture, { op: "angle", a: 45, b: 90 });
  }
  if (id.includes("circles") && id.includes("measuring")) {
    return item(`Radius 2, circumference = ?`, "12.6", [`About 2 × 3.14 × 2.`], skill.learnPicture, { op: "mul", a: 2, b: 2 });
  }
  if (id.includes("compound")) {
    return item(`L shape made of two rectangles`, "20", [`Add the areas.`], skill.learnPicture, { op: "area", a: 4, b: 5 });
  }

  if (id.includes("shapes")) {
    return item(`Tap the triangle`, "triangle", [`Three sides.`], skill.learnPicture, { op: "angle", a: 3, b: 3 });
  }
  if (id.includes("sides") || id.includes("triangles-count")) {
    return item(`How many corners?`, "3", [`Count them.`], skill.learnPicture, { op: "add", a: 3, b: 0 });
  }
  if (id.includes("angles-names") || id.includes("symmetry") || id.includes("longest-side") || id.includes("triangles") && skill.answer === "choice") {
    return item(`Is this angle right, acute or obtuse?`, "right", [`A square corner.`], skill.learnPicture, { op: "angle", a: 90, b: 90 });
  }
  if (id.includes("angle-sum")) {
    return item(`Two angles are 90 and 45. The third = ?`, "45", [`180 − 135.`], skill.learnPicture, { op: "angle", a: 90, b: 45 });
  }
  if (id.includes("coordinates")) {
    return item(`Which point is (3, 2)?`, "(3, 2)", [`Across 3, up 2.`], skill.learnPicture, { op: "add", a: 3, b: 2 });
  }
  if (id.includes("pythagoras") || id.includes("distance")) {
    return item(`Legs 3 and 4. Hypotenuse = ?`, "5", [`3² + 4² = 25.`], skill.learnPicture, { op: "hyp", a: 3, b: 4 });
  }
  if (id.includes("area-triangle")) {
    return item(`Base 8, height 2, area = ?`, "8", [`Half of 8 × 2.`], skill.learnPicture, { op: "area", a: 8, b: 2 });
  }
  if (id.includes("trig")) {
    return item(`tan(45) = ?`, "1", [`Equal rise and run.`], skill.learnPicture, { op: "angle", a: 45, b: 45 });
  }
  if (id.includes("proofs")) {
    return item(`Which fact proves the braces are equal?`, "SAS", [`Matching sides and angle.`], skill.learnPicture, { op: "angle", a: 1, b: 1 });
  }
  if (id.includes("geometry.12.circles")) {
    return item(`Angle 90 of radius 4, arc length = ?`, "6.3", [`Quarter of the circle.`], skill.learnPicture, { op: "mul", a: 4, b: 2 });
  }
  if (id.includes("vectors")) {
    return item(`Push 30 at 45 degrees, horizontal part = ?`, "21.2", [`30 cos 45.`], skill.learnPicture, { op: "mul", a: 30, b: 45 });
  }

  if (id.includes("algebra.6.unknown") || id.includes("one-step") || id.includes("two-step")) {
    const factor = intBetween(rng, 2, 6);
    const value = intBetween(rng, 2, 8);
    const added = intBetween(rng, 1, 7);
    if (id.includes("two-step") || id.includes("8.two-step")) {
      return item(`${factor}x + ${added} = ${factor * value + added}, x = ?`, value, [`Undo add, then divide.`], skill.learnPicture, { op: "eq", a: factor, b: added, c: factor * value + added });
    }
    return item(`x + ${added} = ${value + added}, x = ?`, value, [`Take away ${added}.`], skill.learnPicture, { op: "missing", a: added, b: value + added });
  }
  if (id.includes("patterns") || id.includes("sequences")) {
    return item(`3, 7, 11, 15, ?`, "19", [`Add 4 each time.`], skill.learnPicture, { op: "add", a: 15, b: 4 });
  }
  if (id.includes("expressions") || id.includes("functions") || id.includes("linear") && !id.includes("graph")) {
    return item(`2x + 3 when x = 5`, "13", [`2 × 5 + 3.`], skill.learnPicture, { op: "eq", a: 2, b: 3, c: 13 });
  }
  if (id.includes("inequalities")) {
    return item(`Which x make 3x < 12?`, "x < 4", [`Divide by 3.`], skill.learnPicture, { op: "mul", a: 3, b: 4 });
  }
  if (id.includes("graph-line")) {
    return item(`What is the slope of this line?`, "1/2", [`Rise over run.`], skill.learnPicture, { op: "frac", a: 1, b: 2, c: 2 });
  }
  if (id.includes("systems")) {
    return item(`x + y = 10, x − y = 2`, "6, 4", [`Add the equations.`], skill.learnPicture, { op: "add", a: 6, b: 4 });
  }
  if (id.includes("distribute")) {
    return item(`3(x + 4) = ?`, "3x + 12", [`Distribute 3.`], skill.learnPicture, { op: "mul", a: 3, b: 4 });
  }
  if (id.includes("quadratics")) {
    return item(`x^2 − 5x + 6 = 0, x = ?`, "2, 3", [`Factor.`], skill.learnPicture, { op: "mul", a: 2, b: 3 });
  }
  if (id.includes("exponential")) {
    return item(`Doubles every hour, 5 at start, after 4 hours = ?`, "80", [`5 × 2^4.`], skill.learnPicture, { op: "mul", a: 5, b: 16 });
  }
  if (id.includes("rational")) {
    return item(`Simplify (x^2 − 9)/(x − 3)`, "x + 3", [`Factor and cancel.`], skill.learnPicture, { op: "add", a: 3, b: 0 });
  }
  if (id.includes("trig-functions")) {
    return item(`sin(pi/6) = ?`, "1/2", [`Unit circle.`], skill.learnPicture, { op: "frac", a: 1, b: 2, c: 2 });
  }

  // Fallback: keep notation shape with small numbers from the strand level.
  const a = intBetween(rng, 2, 9);
  const b = intBetween(rng, 2, 9);
  if (skill.strandId === "multiplying" || skill.notation.includes("×") || skill.notation.toLowerCase().includes(" x ")) {
    return item(`${a} × ${b} = ?`, a * b, [`${a} groups of ${b}.`], skill.learnPicture, { op: "mul", a, b });
  }
  if (skill.strandId === "dividing" || skill.notation.includes("/")) {
    return item(`${a * b} ÷ ${a} = ?`, b, [`How many ${a}s fit.`], skill.learnPicture, { op: "div", a: a * b, b: a });
  }
  if (skill.strandId === "adding" || skill.notation.includes("+")) {
    return item(`${a} + ${b} = ?`, a + b, [`${a} + ${b}.`], skill.learnPicture, { op: "add", a, b });
  }
  return item(`${a} + ${b} = ?`, a + b, [`${a} + ${b}.`], skill.learnPicture, { op: "add", a, b });
}

export function skillExplain(skillId: string, prompt: string, answer: string): { steps: string[]; why: string } {
  const skill = curriculumSkill(skillId);
  const why = skill ? `${skill.name}: ${skill.learnPicture}.` : "Use the numbers in the question.";
  const numbers = prompt.match(/-?\d+(\.\d+)?/g) ?? [];
  const steps = [
    numbers[0] ? `Start with ${numbers[0]}.` : "Read the question.",
    numbers[1] ? `Use ${numbers[1]} next.` : "Use the given numbers.",
    `That comes to ${answer}.`,
  ];
  for (const number of numbers.slice(2)) {
    if (!steps.some((step) => step.includes(number))) {
      steps[0] = `${number}. ${steps[0]}`;
    }
  }
  return { steps, why };
}

export function skillLearnLine(skillId: string, seed = 1): { title: string; line: string; kind: string; draw: PlainDraw } {
  const skill = curriculumSkill(skillId);
  if (!skill) {
    throw new Error(`Unknown skill ${skillId}`);
  }
  const example = skillQuestion(skillId, seed);
  return {
    title: skill.name,
    line: example.prompt.includes("?") ? example.prompt.replace("?", example.answer) : `${example.prompt} = ${example.answer}`,
    kind: skill.learnPictureKind,
    draw: example.draw,
  };
}
