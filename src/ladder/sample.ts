import { beginLadderPlace, ladderPlaceAnswer, ladderPlaceAsk, settleLadder } from "./place";
import { serveQuestion } from "./serve";
import { validateStep } from "./generate";
import {
  beginSession,
  bookCeiling,
  bookCurrentStep,
  closeTallies,
  markLearning,
  rememberAnswer,
  runPlan,
  skillsFromLevels,
  warmUpPlan,
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
  correctAt: (asked: number) => boolean = () => true,
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
    place = ladderPlaceAnswer(place, grade, correctAt(lines.length - 1));
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
  for (let index = 1; index <= rounds; index += 1) {
    const day = `2026-10-${19 + index}`;
    book = beginSession(book);
    const start = snapshot(book, grade);
    const warmup = warmUpPlan(book, 3, "adding", settled.levels, day, grade);
    const rest = runPlan(book, "adding", settled.levels.adding ?? 1, 10, seed + index * 19, grade);
    const slots = [
      ...warmup.map((slot) => ({ ...slot, phase: "warmup" as const })),
      ...rest.map((slot) => ({ ...slot, phase: "plain" as const })),
    ];
    const collected: SampleLine[] = [];
    const seen = new Set<string>();
    const ceiling = bookCeiling(book, grade);
    for (const slot of slots) {
      let question = serveQuestion({
        grade,
        skillId: slot.skillId,
        seed: seed + index * 50 + collected.length * 17,
        kind: slot.phase === "warmup" ? "warmup" : "run",
        ceiling,
      });
      for (let extra = 1; extra < 24 && (seen.has(question.prompt) || (question.item && question.stepId && !validateStep(ladderStep(question.stepId) ?? ladderStep(slot.skillId)!, question.item))); extra += 1) {
        question = serveQuestion({
          grade,
          skillId: slot.skillId,
          seed: seed + index * 50 + collected.length * 17 + extra * 23,
          kind: slot.phase === "warmup" ? "warmup" : "run",
          ceiling,
        });
      }
      seen.add(question.prompt);
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
      book = rememberAnswer(book, question.skillId, question.prompt, correctAt(asked), false, { day, mixed: slot.phase === "warmup" });
    }
    book = closeTallies(book, day);
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
