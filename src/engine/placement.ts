import { generateProblem } from "./generate";
import type { Rng } from "./rng";
import { createRng } from "./rng";
import type { Problem, Skill, Strand } from "./types";

export type SkillStateName = "unknown" | "shaky" | "solid";

export type SkillProgress = {
  state: SkillStateName;
  recent: boolean[];
};

/** One entry per skill. Strands are independent, so states can disagree. */
export type LearnerMap = Record<string, SkillProgress>;

export const HISTORY_LIMIT = 4;
export const DEFAULT_MAX_QUESTIONS_PER_STRAND = 12;

export function judgeState(recent: readonly boolean[]): SkillStateName {
  if (recent.length === 0) {
    return "unknown";
  }
  const correct = recent.filter(Boolean).length;
  const wrong = recent.length - correct;
  if (correct >= 2 && wrong === 0 && recent[recent.length - 1] === true) {
    return "solid";
  }
  if (correct >= 1 && wrong >= 1) {
    return "shaky";
  }
  if (correct === 1) {
    return "shaky";
  }
  return "unknown";
}

export function createLearnerMap(skills: readonly Skill[]): LearnerMap {
  const map: LearnerMap = {};
  for (const skill of skills) {
    map[skill.id] = { state: "unknown", recent: [] };
  }
  return map;
}

/** Shared by placement and ordinary practice. */
export function recordAnswer(map: LearnerMap, skillId: string, correct: boolean): LearnerMap {
  const previous = map[skillId];
  if (!previous) {
    throw new Error(`Unknown skill ${skillId}`);
  }
  const recent = [...previous.recent, correct].slice(-HISTORY_LIMIT);
  return {
    ...map,
    [skillId]: { recent, state: judgeState(recent) },
  };
}

export type PlacementQuestion = {
  strandId: string;
  skillId: string;
  correct: boolean;
  prompt: string;
};

export type PlacementResult = {
  map: LearnerMap;
  questions: PlacementQuestion[];
  questionsPerStrand: Record<string, number>;
  stopReason: Record<string, "boundary" | "cap">;
};

function failed(progress: SkillProgress): boolean {
  return progress.recent.length > 0 && progress.recent.every((item) => !item);
}

function selectNext(
  strandSkills: readonly Skill[],
  map: LearnerMap,
  currentId: string | null,
  lastCorrect: boolean | null,
): string | null {
  const open = (skill: Skill) =>
    map[skill.id].state !== "solid" &&
    !failed(map[skill.id]) &&
    skill.prerequisites.every((id) => map[id].state === "solid") &&
    skill.prerequisites.every((id) => !failed(map[id]));

  if (currentId !== null && lastCorrect === true && map[currentId].state !== "solid") {
    return currentId;
  }

  if (currentId !== null && lastCorrect === false) {
    const current = strandSkills.find((skill) => skill.id === currentId);
    const back = current
      ? [...current.prerequisites].reverse().find((id) => {
          const progress = map[id];
          return progress.state !== "solid" && !failed(progress);
        })
      : undefined;
    if (back) {
      return back;
    }
  }

  const next = strandSkills.find((skill) => skill.id !== currentId && open(skill));
  return next?.id ?? null;
}

export function runPlacement(options: {
  skills: readonly Skill[];
  strands: readonly Strand[];
  respond: (skill: Skill, problem: Problem) => boolean;
  seed?: number;
  difficulty?: number;
  maxQuestionsPerStrand?: number;
  rng?: Rng;
}): PlacementResult {
  const maxQuestions = options.maxQuestionsPerStrand ?? DEFAULT_MAX_QUESTIONS_PER_STRAND;
  const difficulty = options.difficulty ?? 3;
  const rng = options.rng ?? createRng(options.seed ?? 1);
  const byId = new Map(options.skills.map((skill) => [skill.id, skill]));
  let map = createLearnerMap(options.skills);
  const questions: PlacementQuestion[] = [];
  const questionsPerStrand: Record<string, number> = {};
  const stopReason: Record<string, "boundary" | "cap"> = {};

  for (const strand of options.strands) {
    const strandSkills = strand.skills.map((id) => {
      const skill = byId.get(id);
      if (!skill) {
        throw new Error(`Strand ${strand.id} lists missing skill ${id}`);
      }
      return skill;
    });
    let currentId: string | null = null;
    let lastCorrect: boolean | null = null;
    let asked = 0;
    while (asked < maxQuestions) {
      const nextId = selectNext(strandSkills, map, currentId, lastCorrect);
      if (!nextId) {
        break;
      }
      const skill = byId.get(nextId);
      if (!skill) {
        throw new Error(`Missing skill ${nextId}`);
      }
      const problem = generateProblem(skill, rng, difficulty);
      const correct = options.respond(skill, problem);
      map = recordAnswer(map, skill.id, correct);
      currentId = skill.id;
      lastCorrect = correct;
      asked += 1;
      questions.push({
        strandId: strand.id,
        skillId: skill.id,
        correct,
        prompt: problem.prompt,
      });
    }
    const pending = selectNext(strandSkills, map, currentId, lastCorrect);
    questionsPerStrand[strand.id] = asked;
    stopReason[strand.id] = pending && asked >= maxQuestions ? "cap" : "boundary";
  }

  return { map, questions, questionsPerStrand, stopReason };
}
