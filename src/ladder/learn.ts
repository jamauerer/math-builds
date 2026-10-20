import { generateStep, type LadderItem } from "./generate";
import { DOT_STEPS, LADDER_STEPS, ladderStep, type LadderStep } from "./steps";

export type LearnCard = {
  stepId: string;
  title: string;
  lines: string[];
  template: string;
  dots: boolean;
};

const TEMPLATES: Record<string, (item: LadderItem) => LearnCard> = {
  A1: (item) => card(item, "dots-join-5", [`Join ${item.operands[0]} dots and ${item.operands[1]} dots.`, `That is ${item.answer}.`]),
  A2: (item) => card(item, "dots-join-10", [`Join the dots. They start to fade.`, `${item.prompt} is ${item.answer}.`]),
  A3: (item) => card(item, "count-on", [`Start at ${item.operands[0]}.`, `Count on ${item.operands[1]}.`, `You land on ${item.answer}.`]),
  A4: (item) => card(item, "ten-frame", [`Put ${item.operands[0]} on the ten-frame.`, `The empty boxes make ${item.answer}.`, `${item.operands[0]} + ${item.answer} = 10.`]),
  A5: (item) => card(item, "no-cross", [`The ones do not make a ten.`, `${item.prompt} is ${item.answer}.`]),
  A6: (item) => {
    const [a, b] = item.operands;
    const need = 10 - a;
    const rest = b - need;
    return card(item, "make-ten", [`${a} + ${b} = ${a} + ${need} + ${rest}.`, `${a} + ${need} = 10.`, `10 + ${rest} = ${item.answer}.`]);
  },
  A7: (item) => card(item, "doubles", [`This is a double or a near double.`, `${item.prompt} is ${item.answer}.`]),
  A8: (item) => card(item, "tens", [`Count tens.`, `${item.operands[0] / 10} tens + ${item.operands[1] / 10} tens = ${Number(item.answer) / 10} tens.`]),
  A9: (item) => card(item, "no-carry", [`Add ones, then tens. No carry.`, `${item.answer}.`]),
  A10: (item) => card(item, "carry-ones", [`Ones make 10 or more.`, `Write 1 above the tens.`, `The sum is ${item.answer}.`]),
  A11: (item) => card(item, "stacked-add", [`Write the numbers in columns.`, `Add ones, then tens.`, `${item.answer}.`]),
  A12: (item) => card(item, "carry-tens", [`Ones make 10 or more.`, `Write 1 above the tens column.`, `Add the tens with that 1. ${item.answer}.`]),
  A13: (item) => card(item, "over-100", [`The total goes past 100.`, `Keep the extra hundred.`, `${item.answer}.`]),
  A14: (item) => card(item, "three", [`Look for a pair that makes 10.`, `Then add the third number.`, `${item.answer}.`]),
  A15: (item) => card(item, "stacked-3", [`Each column stays under 10.`, `${item.answer}.`]),
  A16: (item) => card(item, "carry-3", [`Write each carry above the next column.`, `${item.answer}.`]),
  A17: (item) => card(item, "big-add", [`Line up the ones.`, `Add one column at a time.`, `${item.answer}.`]),
  A18: (item) => card(item, "decimals-add", [`Line up the decimal points.`, `Add as usual.`, `${item.answer}.`]),
  S1: (item) => card(item, "dots-take-5", [`Start with ${item.operands[0]} dots.`, `Cross out ${item.operands[1]}.`, `${item.answer} left.`]),
  S2: (item) => card(item, "dots-take-10", [`Take away ${item.operands[1]} dots.`, `${item.answer} left.`]),
  S3: (item) => card(item, "count-back", [`Count back ${item.operands[1]} from ${item.operands[0]}.`, `${item.answer}.`]),
  S4: (item) => card(item, "from-ten", [`10 take away ${item.operands[1]} is ${item.answer}.`]),
  S5: (item) => card(item, "no-cross-sub", [`The ones are enough.`, `${item.answer}.`]),
  S6: (item) => card(item, "count-back-ten", [`The ones are not enough.`, `Count back through 10.`, `${item.answer}.`]),
  S7: (item) => card(item, "tens-sub", [`Subtract tens.`, `${item.answer}.`]),
  S8: (item) => card(item, "no-borrow", [`Ones can give ${item.operands[1]}.`, `${item.answer}.`]),
  S9: (item) => card(item, "borrow-ones", [`Ones need more.`, `Cross out the tens digit and add 10 to the ones.`, `${item.answer}.`]),
  S10: (item) => card(item, "stacked-sub", [`Each column has enough.`, `${item.answer}.`]),
  S11: (item) => card(item, "borrow-tens", [`Ones borrow.`, `Cross out the tens digit and add 10 to the ones.`, `${item.answer}.`]),
  S12: (item) => card(item, "borrow-once", [`Only one column borrows.`, `${item.answer}.`]),
  S13: (item) => card(item, "borrow-zero", [`The middle digit is 0.`, `Borrow across zero.`, `${item.answer}.`]),
  S14: (item) => card(item, "big-sub", [`Line up the ones.`, `${item.answer}.`]),
  S15: (item) => card(item, "decimals-sub", [`Line up the points.`, `${item.answer}.`]),
  M1: (item) => card(item, "rows-dots", [`${item.operands[0]} rows of ${item.operands[1]} dots.`, `That is ${item.answer}.`]),
  M2: (item) => card(item, "times-2-10", [`${item.prompt} is ${item.answer}.`]),
  M3: (item) => card(item, "times-5", [`Skip count by 5.`, `${item.answer}.`]),
  M4: (item) => card(item, "times-3-4", [`${item.prompt} is ${item.answer}.`]),
  M5: (item) => card(item, "times-6-7", [`${item.prompt} is ${item.answer}.`]),
  M6: (item) => card(item, "times-8-9", [`${item.prompt} is ${item.answer}.`]),
  M7: (item) => card(item, "tables", [`A known fact.`, `${item.answer}.`]),
  M8: (item) => card(item, "times-10-100", [`Slide the digits left.`, `${item.answer}.`]),
  M9: (item) => {
    const [a, b] = item.operands;
    const tens = Math.floor(a / 10) * 10;
    return card(item, "partial-products", [`${tens} × ${b} = ${tens * b}.`, `${a % 10} × ${b} = ${(a % 10) * b}.`, `Add them: ${item.answer}.`]);
  },
  M10: (item) => card(item, "mul-3-1", [`Multiply each place.`, `${item.answer}.`]),
  M11: (item) => card(item, "mul-2-2", [`Multiply by ones, then tens.`, `${item.answer}.`]),
  M12: (item) => card(item, "mul-large", [`Keep the places lined up.`, `${item.answer}.`]),
  M13: (item) => card(item, "mul-decimals", [`Count the decimal places.`, `${item.answer}.`]),
  D1: (item) => card(item, "deal-dots", [`Deal ${item.operands[0]} dots into ${item.operands[1]} groups.`, `Each group has ${item.answer}.`]),
  D2: (item) => card(item, "div-2-5-10", [`${item.prompt} is ${item.answer}.`]),
  D3: (item) => card(item, "div-3-4", [`${item.prompt} is ${item.answer}.`]),
  D4: (item) => card(item, "div-6-9", [`${item.prompt} is ${item.answer}.`]),
  D5: (item) => card(item, "div-mix", [`A known fact family.`, `${item.answer}.`]),
  D6: (item) => card(item, "remainder", [`Write how many fit, then the leftover.`, `${item.answer}.`]),
  D7: (item) => card(item, "long-div-1", [`Write the division bracket.`, `Divide the first digit, multiply, subtract.`, `Bring down. The quotient is ${item.answer}.`]),
  D8: (item) => card(item, "long-div-3", [`One step at a time under the bracket.`, `${item.answer}.`]),
  D9: (item) => card(item, "long-div-2", [`How many ${item.operands[1]}s fit?`, `${item.answer}.`]),
  D10: (item) => card(item, "long-div-dec", [`Put a point and keep dividing.`, `${item.answer}.`]),
};

function card(item: LadderItem, template: string, lines: string[]): LearnCard {
  const step = ladderStep(item.stepId);
  return {
    stepId: item.stepId,
    title: step?.name ?? item.stepId,
    lines,
    template,
    dots: DOT_STEPS.has(item.stepId),
  };
}

export function learnCard(step: LadderStep, seed = 1): LearnCard {
  const item = generateStep(step, seed);
  const make = TEMPLATES[step.id];
  if (!make) {
    throw new Error(`Missing Learn card for ${step.id}`);
  }
  return make(item);
}

export function explainStep(skillId: string, seed = 1): LearnCard {
  const step = ladderStep(skillId);
  if (!step) {
    return { stepId: skillId, title: skillId, lines: ["Use the numbers."], template: "generic", dots: false };
  }
  return learnCard(step, seed);
}

export function allLearnTemplates(): { stepId: string; template: string; dots: boolean }[] {
  return LADDER_STEPS.map((step) => {
    const card = learnCard(step, 3);
    return { stepId: step.id, template: card.template, dots: card.dots };
  });
}
