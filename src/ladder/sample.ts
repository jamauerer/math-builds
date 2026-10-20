import { beginLadderPlace, ladderPlaceAnswer, ladderPlaceAsk, settleLadder } from "./place";
import { serveQuestion } from "./serve";
import { hasBareZero, questionKey, validateStep, zeroStepAllowed } from "./generate";
import {
  beginSession,
  bookCeiling,
  bookCurrentStep,
  closeTallies,
  familyRoundPlan,
  markLearning,
  rememberAnswer,
  skillsFromLevels,
} from "../machines/bridge/kits/skills";
import { ladderStep } from "./steps";

export type SampleLine = {
  n: number;
  phase: string;
  stepId: string;
  prompt: string;
  answer: string;
  round: number;
  current: string;
};

export type PlayedRound = {
  index: number;
  lines: SampleLine[];
  currentAtStart: Partial<Record<"A" | "S" | "M" | "D", string>>;
  currentAtEnd: Partial<Record<"A" | "S" | "M" | "D", string>>;
};

function currentLabel(stepId: string, book: ReturnType<typeof skillsFromLevels>, grade: number): string {
  const step = ladderStep(stepId);
  if (!step) {
    return stepId;
  }
  return bookCurrentStep(book, step.op, grade).id;
}

function snapshot(book: ReturnType<typeof skillsFromLevels>, grade: number): Partial<Record<"A" | "S" | "M" | "D", string>> {
  const out: Partial<Record<"A" | "S" | "M" | "D", string>> = {};
  for (const op of ["A", "S", "M", "D"] as const) {
    out[op] = bookCurrentStep(book, op, grade).id;
  }
  return out;
}

export function playLearner(
  grade: number,
  seed = 1,
  rounds = 5,
  correctAt: (asked: number, phase: "placement" | "round") => boolean = () => true,
): { placement: SampleLine[]; rounds: PlayedRound[]; lines: SampleLine[] } {
  const lines: SampleLine[] = [];
  let place = beginLadderPlace(grade);
  while (!place.done && lines.length < 12) {
    const question = ladderPlaceAsk(place, grade, seed + lines.length);
    lines.push({
      n: lines.length + 1,
      phase: "placement",
      stepId: question.stepId ?? "?",
      prompt: question.prompt,
      answer: question.answer,
      round: 0,
      current: question.stepId ?? "?",
    });
    place = ladderPlaceAnswer(place, grade, correctAt(lines.length - 1, "placement"));
  }
  const settled = settleLadder(place, grade);
  const starts = {
    adding: settled.adding,
    subtracting: settled.subtracting,
    multiplying: settled.multiplying,
    dividing: settled.dividing,
  };
  let book = skillsFromLevels(settled.levels, "2026-10-20", starts);
  const played: PlayedRound[] = [];
  let prevKeys = new Set<string>();
  for (let index = 1; index <= rounds; index += 1) {
    const day = `2026-10-${19 + index}`;
    book = beginSession(book);
    const start = snapshot(book, grade);
    const slots = familyRoundPlan(book, grade, seed + index * 19, day);
    const collected: SampleLine[] = [];
    const thisKeys = new Set<string>();
    const banned = new Set([...prevKeys]);
    let zeroUsed = false;
    const ceiling = bookCeiling(book, grade);
    for (const slot of slots) {
      const baseSeed = seed + index * 50 + collected.length * 17;
      let question = serveQuestion({
        grade,
        skillId: slot.skillId,
        seed: baseSeed,
        kind: slot.phase === "warmup" ? "warmup" : "run",
        ceiling,
        banned,
        zeroUsed,
      });
      for (let extra = 1; extra < 80; extra += 1) {
        const key = question.item ? questionKey(question.item) : question.prompt;
        const zero = question.item ? hasBareZero(question.item) : false;
        const step = question.stepId ? ladderStep(question.stepId) : ladderStep(slot.skillId);
        const badRange = Boolean(question.item && step && !validateStep(step, question.item));
        const badZero = zero && (zeroUsed || !zeroStepAllowed(question.stepId));
        if (!banned.has(key) && !badRange && !badZero) {
          break;
        }
        question = serveQuestion({
          grade,
          skillId: slot.skillId,
          seed: baseSeed + extra * 23,
          kind: slot.phase === "warmup" ? "warmup" : "run",
          ceiling,
          banned,
          zeroUsed,
        });
      }
      const key = question.item ? questionKey(question.item) : question.prompt;
      banned.add(key);
      thisKeys.add(key);
      if (question.item && hasBareZero(question.item)) {
        zeroUsed = true;
      }
      const stepId = question.stepId ?? question.skillId ?? "?";
      if (book.skills[question.skillId]?.state === "new") {
        book = markLearning(book, question.skillId);
      }
      collected.push({
        n: lines.length + collected.length + 1,
        phase: slot.phase,
        stepId,
        prompt: question.prompt,
        answer: question.answer,
        round: index,
        current: currentLabel(stepId, book, grade),
      });
      const asked = lines.length + collected.length - 1;
      book = rememberAnswer(book, question.skillId, question.prompt, correctAt(asked, "round"), false, { day, mixed: slot.phase === "warmup" });
    }
    book = closeTallies(book, day);
    prevKeys = thisKeys;
    played.push({
      index,
      lines: collected,
      currentAtStart: start,
      currentAtEnd: snapshot(book, grade),
    });
    lines.push(...collected);
  }
  return { placement: lines.filter((line) => line.round === 0), rounds: played, lines };
}

export function sampleLearnerQuestions(grade: number, seed = 1): SampleLine[] {
  return playLearner(grade, seed, 5, (asked) => asked >= 12 || asked % 3 !== 2).lines.slice(0, 60);
}

export function sampleMarkdown(grade: number, lines: SampleLine[]): string {
  const rows = lines.map((line) => {
    const tag = line.round === 0 ? "placement" : `round ${line.round}, ${line.current}`;
    return `${line.n}. [${tag}] ${line.stepId}  ${line.prompt}  → ${line.answer}`;
  });
  return `# Grade ${grade} sample\n\nPlacement, then rounds as a learner would see them. Each question is tagged with the round and the current step.\n\n${rows.join("\n")}\n`;
}
