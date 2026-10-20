import type { PlainDraw } from "../pictures/parts";
import type { ExplainPicture, ExplainStep } from "../machines/bridge/kits/explain";
import { curriculumSkill, type CurriculumSkill, type LearnPictureKind } from "./index";

/** Pictures that render as the generic bolt/dot pile template. Fractions and geometry never use these. */
const DOT_PICTURES = new Set<ExplainPicture>(["pile", "rows", "count"]);

const KIND_CYCLE: Record<LearnPictureKind, ExplainPicture[]> = {
  bolts: ["pile", "rows", "count"],
  dots: ["count", "rows", "pile"],
  planks: ["plank", "plank-cut", "plank-apart", "plank-thirds"],
  beams: ["beam", "beams-pair", "brace-angle"],
  tape: ["tape", "tape-marks", "number-line"],
  "number-line": ["number-line", "tape-marks", "tape"],
  rows: ["rows", "pile", "count"],
  area: ["area", "area-fill", "squares"],
  triangle: ["triangle", "squares", "sum", "root"],
  balance: ["balance", "symbol", "beam"],
  sign: ["sign", "symbol", "count"],
  grid: ["grid", "number-line", "symbol"],
  none: ["symbol", "tape-marks", "grid"],
};

export function skillExplain(
  skillId: string,
  prompt: string,
  answer: string,
  draw?: PlainDraw,
): { steps: ExplainStep[]; why: string } {
  const skill = curriculumSkill(skillId);
  if (!skill) {
    return {
      steps: cover(
        [
          { text: `Start with the numbers.`, picture: "symbol" },
          { text: `Work the question.`, picture: "tape-marks" },
          { text: `That comes to ${answer}.`, picture: "grid" },
        ],
        prompt,
        "none",
      ),
      why: "Use the numbers in the question.",
    };
  }
  const why = `${skill.name}: ${skill.learnPicture}.`;
  const steps = cover(stepsFor(skill, prompt, answer, draw), prompt, skill.learnPictureKind, skill.strandId);
  return { steps, why };
}

function stepsFor(skill: CurriculumSkill, prompt: string, answer: string, draw?: PlainDraw): ExplainStep[] {
  const id = skill.id;
  const nums = numbers(prompt);
  const [a, b, c] = nums.length > 0 ? nums : [draw?.a ?? 1, draw?.b ?? 1, draw?.c];

  if (id === "fractions.2.halves") {
    return halvesSteps();
  }
  if (id.includes("pythagoras") || id.includes("distance") || (draw?.op === "hyp" && skill.learnPictureKind === "triangle")) {
    return legSquareSteps(draw?.a ?? a ?? 3, draw?.b ?? b ?? 4);
  }
  if (id.includes("angles-names") || (id.includes("angles") && skill.strandId === "geometry") || (id.includes("angles") && id.includes("measuring"))) {
    const deg = draw?.a ?? a ?? 45;
    return [
      { text: `Look at the brace angle of ${deg}°.`, picture: "brace-angle", a: deg },
      { text: `Compare it to a right angle (90°).`, picture: "beams-pair", a: 90, b: deg },
      {
        text:
          answer === "right"
            ? `It matches 90°, so it is right.`
            : answer === "acute"
              ? `${deg} is less than 90, so it is acute.`
              : `${deg} is more than 90, so it is obtuse.`,
        picture: "beam",
        a: deg,
      },
    ];
  }
  if (id.includes("even-odd")) {
    const n = a ?? 12;
    return [
      { text: `Take ${n} bolts.`, picture: "pile", count: Math.min(24, n), a: n },
      { text: `Pair them up.`, picture: "rows", rows: 2, each: Math.min(8, Math.ceil(n / 2)), a: n },
      { text: n % 2 === 0 ? `None left over: even.` : `One left over: odd.`, picture: "count", each: n % 2 === 0 ? 2 : 1, a: n },
    ];
  }
  if (id.includes("halves") === false && skill.learnPictureKind === "planks") {
    return plankSteps(prompt, answer, a, b, c);
  }
  if (skill.learnPictureKind === "bolts" || skill.learnPictureKind === "dots") {
    return boltSteps(prompt, answer, a, b, skill.learnPictureKind);
  }
  if (skill.learnPictureKind === "beams") {
    return beamSteps(prompt, answer, a, b);
  }
  if (skill.learnPictureKind === "tape" || skill.learnPictureKind === "number-line") {
    return tapeSteps(prompt, answer, a, b, skill.learnPictureKind);
  }
  if (skill.learnPictureKind === "rows") {
    return [
      { text: nums[0] != null ? `Start with ${nums[0]}.` : "Read the rows.", picture: "rows", rows: Math.min(8, Math.max(1, a ?? 2)), each: Math.min(8, Math.max(1, b ?? 2)), a, b },
      { text: nums[1] != null ? `Use ${nums[1]} next.` : "Count each row.", picture: "pile", count: Math.min(24, Math.max(1, a ?? 4)), a },
      { text: `That comes to ${answer}.`, picture: "count", each: Math.min(12, Math.max(1, Math.abs(Number(answer)) || 1)) },
    ];
  }
  if (skill.learnPictureKind === "area") {
    return [
      { text: nums[0] != null ? `A side of ${nums[0]}.` : "Mark the area box.", picture: "area", a: a ?? 3, b: b ?? 4 },
      { text: nums[1] != null ? `And ${nums[1]} the other way.` : "Fill the cells.", picture: "area-fill", a: a ?? 3, b: b ?? 4 },
      { text: `That comes to ${answer}.`, picture: "squares", a: Math.min(36, Math.max(1, Math.abs(Number(answer)) || 4)) },
    ];
  }
  if (skill.learnPictureKind === "triangle") {
    return legSquareSteps(a ?? 3, b ?? 4);
  }
  if (skill.learnPictureKind === "balance") {
    return [
      { text: nums[0] != null ? `Put ${nums[0]} on one side.` : "Balance the scale.", picture: "balance", a },
      { text: nums[1] != null ? `Match it with ${nums[1]}.` : "Keep both sides equal.", picture: "symbol", a, b },
      { text: `That comes to ${answer}.`, picture: "beam", a: Number(answer) || a },
    ];
  }
  if (skill.learnPictureKind === "sign") {
    return [
      { text: nums[0] != null ? `Start with ${nums[0]}.` : "Watch the signs.", picture: "sign", a },
      { text: nums[1] != null ? `Times or divide by ${nums[1]}.` : "Apply the sign rule.", picture: "symbol", a, b },
      { text: `That comes to ${answer}.`, picture: "count", each: Math.min(12, Math.max(1, Math.abs(Number(answer)) || 1)) },
    ];
  }
  if (skill.learnPictureKind === "grid") {
    return [
      { text: nums[0] != null ? `Plot from ${nums[0]}.` : "Use the grid.", picture: "grid", a },
      { text: nums[1] != null ? `Move by ${nums[1]}.` : "Follow the curve or line.", picture: "number-line", a, b },
      { text: `That comes to ${answer}.`, picture: "symbol" },
    ];
  }
  // learnPictureKind "none": symbolic marks, never the dots pile for fractions/geometry
  if (skill.strandId === "fractions" || skill.strandId === "geometry") {
    return [
      { text: nums[0] != null ? `Start with ${nums[0]}.` : "Read the figure.", picture: "symbol", a },
      { text: nums[1] != null ? `Use ${nums[1]} next.` : "Apply the rule.", picture: "tape-marks", a, b },
      { text: `That comes to ${answer}.`, picture: "grid" },
    ];
  }
  return [
    { text: nums[0] != null ? `Start with ${nums[0]}.` : "Read the question.", picture: "symbol", a },
    { text: nums[1] != null ? `Use ${nums[1]} next.` : "Use the given numbers.", picture: "tape-marks", a, b },
    { text: `That comes to ${answer}.`, picture: "grid" },
  ];
}

function halvesSteps(): ExplainStep[] {
  return [
    { text: "One plank.", picture: "plank", a: 1, b: 1 },
    { text: "Cut in the middle.", picture: "plank-cut", a: 1, b: 2 },
    {
      text: "Both parts are the same size. Each one is a half.",
      picture: "plank-apart",
      a: 1,
      b: 2,
    },
    {
      text: "Cut in 3 is thirds. Cut in 2 unequal parts is not a half.",
      picture: "plank-thirds",
      a: 1,
      b: 3,
    },
  ];
}

function plankSteps(prompt: string, answer: string, a?: number, b?: number, c?: number): ExplainStep[] {
  const parts = Math.max(2, Math.min(8, Math.abs(c ?? b ?? 2)));
  return [
    { text: numbers(prompt)[0] != null ? `Start with the plank and ${numbers(prompt)[0]}.` : "Start with one plank.", picture: "plank", a: a ?? 1, b: parts },
    { text: `Cut into ${parts} equal parts.`, picture: "plank-cut", a: a ?? 1, b: parts },
    { text: `Slide the parts apart. That comes to ${answer}.`, picture: "plank-apart", a: a ?? 1, b: parts },
  ];
}

function boltSteps(prompt: string, answer: string, a?: number, b?: number, kind: LearnPictureKind = "bolts"): ExplainStep[] {
  const first = a ?? 1;
  const second = b ?? 1;
  const pic1: ExplainPicture = kind === "dots" ? "count" : "pile";
  const pic2: ExplainPicture = "rows";
  const pic3: ExplainPicture = kind === "dots" ? "pile" : "count";
  return [
    { text: numbers(prompt)[0] != null ? `Start with ${numbers(prompt)[0]}.` : `Start with ${first}.`, picture: pic1, a: first, count: Math.min(24, Math.max(1, Math.abs(first))) },
    {
      text: numbers(prompt)[1] != null ? `Use ${numbers(prompt)[1]} next.` : `Use ${second} next.`,
      picture: pic2,
      a: first,
      b: second,
      rows: Math.max(1, Math.min(8, Math.abs(second))),
      each: Math.max(1, Math.min(8, Math.abs(first))),
    },
    { text: `That comes to ${answer}.`, picture: pic3, each: Math.max(1, Math.min(12, Math.abs(Number(answer)) || 1)), count: Math.max(1, Math.min(12, Math.abs(Number(answer)) || 1)) },
  ];
}

function beamSteps(prompt: string, answer: string, a?: number, b?: number): ExplainStep[] {
  return [
    { text: numbers(prompt)[0] != null ? `Look at the beam of ${numbers(prompt)[0]}.` : "Look at the beams.", picture: "beam", a: a ?? 4 },
    { text: numbers(prompt)[1] != null ? `Compare with ${numbers(prompt)[1]}.` : "Compare the pieces.", picture: "beams-pair", a: a ?? 4, b: b ?? 2 },
    { text: `That comes to ${answer}.`, picture: "brace-angle", a: a ?? 3, b: b ?? 2 },
  ];
}

function tapeSteps(prompt: string, answer: string, a?: number, b?: number, kind: LearnPictureKind = "tape"): ExplainStep[] {
  const first: ExplainPicture = kind === "number-line" ? "number-line" : "tape";
  const second: ExplainPicture = "tape-marks";
  const third: ExplainPicture = kind === "number-line" ? "tape" : "number-line";
  return [
    { text: numbers(prompt)[0] != null ? `Mark ${numbers(prompt)[0]} on the measure.` : "Mark the measure.", picture: first, a },
    { text: numbers(prompt)[1] != null ? `Use ${numbers(prompt)[1]} next.` : "Read the marks.", picture: second, a, b },
    { text: `That comes to ${answer}.`, picture: third, a: Number(answer) || a },
  ];
}

function legSquareSteps(across: number, up: number): ExplainStep[] {
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

function numbers(prompt: string): number[] {
  return (prompt.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
}

/** Keep every prompt number visible, at least three steps, and consecutive pictures different within the skill's Learn kind. */
export function cover(steps: ExplainStep[], prompt: string, kind: LearnPictureKind, strandId?: string): ExplainStep[] {
  const cycle = KIND_CYCLE[kind] ?? KIND_CYCLE.none;
  const forbidDots = strandId === "fractions" || strandId === "geometry";
  const needed = prompt.match(/\d+(\.\d+)?/g) ?? [];
  let joined = steps.map((step) => step.text).join(" ");
  for (const number of needed) {
    if (!joined.includes(number)) {
      steps[0] = { ...steps[0], text: `${number}. ${steps[0].text}` };
      joined = steps.map((step) => step.text).join(" ");
    }
  }
  while (steps.length < 3) {
    const picture = pickPicture(cycle, steps[steps.length - 1]?.picture, forbidDots);
    steps.push({ text: steps[steps.length - 1]?.text ?? "Look again.", picture });
  }
  return steps.map((step, index) => {
    let picture = step.picture;
    if (forbidDots && DOT_PICTURES.has(picture)) {
      picture = pickPicture(cycle, index > 0 ? steps[index - 1].picture : null, true);
    }
    const previous = index > 0 ? steps[index - 1].picture : null;
    if (previous === picture || (index > 0 && steps[index - 1].picture === picture)) {
      picture = pickPicture(cycle, previous, forbidDots);
    }
    // Re-check against already-fixed previous in the mapped result
    if (index > 0) {
      // previous will be fixed in earlier iteration; use original previous after forbid remap
    }
    return { ...step, picture };
  }).map((step, index, list) => {
    if (index === 0) {
      return step;
    }
    if (list[index - 1].picture !== step.picture) {
      return step;
    }
    return { ...step, picture: pickPicture(cycle, list[index - 1].picture, forbidDots) };
  });
}

function pickPicture(cycle: ExplainPicture[], avoid: ExplainPicture | null | undefined, forbidDots: boolean): ExplainPicture {
  for (let offset = 0; offset < cycle.length * 2; offset += 1) {
    const candidate = cycle[offset % cycle.length];
    if (candidate === avoid) {
      continue;
    }
    if (forbidDots && DOT_PICTURES.has(candidate)) {
      continue;
    }
    return candidate;
  }
  return forbidDots ? "symbol" : cycle[0] ?? "symbol";
}

/** True when every explanation step uses the skill's Learn picture family (never dots for fractions/geometry). */
export function explanationMatchesLearn(skillId: string, steps: ExplainPicture[]): boolean {
  const skill = curriculumSkill(skillId);
  if (!skill) {
    return false;
  }
  const allowed = new Set(KIND_CYCLE[skill.learnPictureKind] ?? KIND_CYCLE.none);
  // Pythagoras and triangle Learn cards draw squares on the legs
  if (skill.learnPictureKind === "triangle" || skill.id.includes("pythagoras") || skill.learnPicture.toLowerCase().includes("square")) {
    for (const pic of ["triangle", "squares", "sum", "root"] as ExplainPicture[]) {
      allowed.add(pic);
    }
  }
  // Angle skills may use brace pictures even when Learn kind is beams
  if (skill.id.includes("angle")) {
    for (const pic of ["brace-angle", "beams-pair", "beam", "triangle"] as ExplainPicture[]) {
      allowed.add(pic);
    }
  }
  if (skill.strandId === "fractions" || skill.strandId === "geometry") {
    for (const pic of steps) {
      if (DOT_PICTURES.has(pic)) {
        return false;
      }
    }
  }
  return steps.every((pic) => allowed.has(pic) || familyOk(skill.learnPictureKind, pic, skill.strandId));
}

function familyOk(kind: LearnPictureKind, pic: ExplainPicture, strandId: string): boolean {
  if (strandId === "fractions" || strandId === "geometry") {
    if (DOT_PICTURES.has(pic)) {
      return false;
    }
  }
  switch (kind) {
    case "planks":
      return pic.startsWith("plank");
    case "bolts":
      return pic === "pile" || pic === "rows" || pic === "count";
    case "dots":
      return pic === "pile" || pic === "rows" || pic === "count";
    case "beams":
      return pic === "beam" || pic === "beams-pair" || pic === "brace-angle" || pic === "triangle";
    case "tape":
      return pic === "tape" || pic === "tape-marks" || pic === "number-line";
    case "number-line":
      return pic === "number-line" || pic === "tape" || pic === "tape-marks";
    case "rows":
      return pic === "rows" || pic === "pile" || pic === "count";
    case "area":
      return pic === "area" || pic === "area-fill" || pic === "squares";
    case "triangle":
      return pic === "triangle" || pic === "squares" || pic === "sum" || pic === "root";
    case "balance":
      return pic === "balance" || pic === "symbol" || pic === "beam";
    case "sign":
      return pic === "sign" || pic === "symbol" || pic === "count";
    case "grid":
      return pic === "grid" || pic === "number-line" || pic === "symbol";
    case "none":
      return pic === "symbol" || pic === "tape-marks" || pic === "grid" || pic === "brace-angle" || pic.startsWith("plank");
    default:
      return false;
  }
}
