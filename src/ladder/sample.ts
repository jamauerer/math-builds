import { beginLadderPlace, ladderPlaceAnswer, ladderPlaceAsk, settleLadder } from "./place";
import { serveQuestion, type ServedQuestion } from "./serve";
import { legalSteps } from "./steps";
import { answerEarn, blankEarn, currentQuestion, earnPrompt, startGuided } from "../machines/bridge/kits/earn";
import { skillsFromLevels, withState } from "../machines/bridge/kits/skills";

export type SampleLine = {
  n: number;
  phase: string;
  stepId: string;
  prompt: string;
  answer: string;
};

export function sampleLearnerQuestions(grade: number, seed = 1): SampleLine[] {
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
    });
    place = ladderPlaceAnswer(place, grade, lines.length % 3 !== 0);
  }
  const settled = settleLadder(place, grade);
  const legal = legalSteps(grade);
  const firstAdd = legal.find((step) => step.op === "A")?.skillId ?? "adding.1.a1";
  const firstSub = legal.find((step) => step.op === "S")?.skillId ?? "adding.1.s1";
  const book = withState(withState(skillsFromLevels(settled.levels, "2026-10-20"), firstAdd, "practicing"), firstSub, "practicing");
  let state = blankEarn(settled.levels, seed + 20, book, "2026-10-20", 0, grade);
  let guard = 0;
  while (lines.length < 60 && guard < 80) {
    guard += 1;
    if (state.phase === "learn") {
      const question = state.current;
      lines.push({
        n: lines.length + 1,
        phase: "learn",
        stepId: question.stepId ?? question.skillId ?? "?",
        prompt: earnPrompt(question),
        answer: question.answer,
      });
      state = startGuided(state, settled.levels);
      continue;
    }
    const question = currentQuestion(state);
    if (!question || state.phase === "done") {
      const legal = legalSteps(grade);
      const extra: ServedQuestion = serveQuestion({ grade, step: legal[(lines.length + seed) % legal.length], seed: seed + lines.length * 7, kind: "run" });
      lines.push({
        n: lines.length + 1,
        phase: "run",
        stepId: extra.stepId ?? "?",
        prompt: extra.prompt,
        answer: extra.answer,
      });
      continue;
    }
    lines.push({
      n: lines.length + 1,
      phase: state.phase,
      stepId: question.stepId ?? question.skillId ?? "?",
      prompt: earnPrompt(question),
      answer: question.answer,
    });
    state = answerEarn(state, question.answer, settled.levels).state;
  }
  return lines.slice(0, 60);
}

export function sampleMarkdown(grade: number, lines: SampleLine[]): string {
  const rows = lines.map((line) => `${line.n}. [${line.phase}] ${line.stepId}  ${line.prompt}  → ${line.answer}`);
  return `# Grade ${grade} sample\n\n60 questions as a learner would see them in placement and a first round.\n\n${rows.join("\n")}\n`;
}
