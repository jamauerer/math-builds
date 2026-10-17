import { answersMatch } from "./answers";
import { generateProblem } from "./generate";
import type { Rng } from "./rng";
import { createRng } from "./rng";
import { MAX_LEVEL, type Problem, type Skill, type Strand } from "./types";

export type SkillStateName = "unknown" | "shaky" | "solid";

export type SkillProgress = {
  /** Highest level passed, from 0 through 5. */
  level: number;
  state: SkillStateName;
};

/** One entry per skill. Strands stay independent. */
export type LearnerMap = Record<string, SkillProgress>;

export const CEILING_MESSAGE = "You have finished all current skills in this strand";

export function labelForLevel(level: number): SkillStateName {
  if (level >= MAX_LEVEL) {
    return "solid";
  }
  if (level >= 1) {
    return "shaky";
  }
  return "unknown";
}

export function createLearnerMap(skills: readonly Skill[]): LearnerMap {
  const map: LearnerMap = {};
  for (const skill of skills) {
    map[skill.id] = { level: 0, state: "unknown" };
  }
  return map;
}

/** Highest level passed only moves up. Practice and placement share this. */
export function recordLevelPass(map: LearnerMap, skillId: string, level: number): LearnerMap {
  const previous = map[skillId];
  if (!previous) {
    throw new Error(`Unknown skill ${skillId}`);
  }
  const nextLevel = Math.max(previous.level, Math.min(MAX_LEVEL, Math.max(0, Math.floor(level))));
  return {
    ...map,
    [skillId]: { level: nextLevel, state: labelForLevel(nextLevel) },
  };
}

/** Next practice item is one step above the highest level passed, and never above 5. */
export function practiceLevel(progress: SkillProgress | undefined): number {
  return Math.min(MAX_LEVEL, (progress?.level ?? 0) + 1);
}

export function strandIsMastered(strand: Strand, map: LearnerMap): boolean {
  return strand.skills.every((id) => (map[id]?.level ?? 0) >= MAX_LEVEL);
}

/** Records a strand the first time every skill in it is level 5, and logs that strand. */
export function noteCeilings(
  strands: readonly Strand[],
  map: LearnerMap,
  already: readonly string[],
): string[] {
  const next = [...already];
  for (const strand of strands) {
    if (next.includes(strand.id) || !strandIsMastered(strand, map)) {
      continue;
    }
    next.push(strand.id);
    console.log(`Strand topped out: ${strand.id}`);
  }
  return next;
}

type Probe = {
  skillId: string;
  level: number;
  misses: number[];
  steppedBack: boolean;
};

function freshProbe(skillId: string): Probe {
  return { skillId, level: 1, misses: [0, 0, 0, 0, 0, 0], steppedBack: false };
}

function applyResult(
  probe: Probe,
  correct: boolean,
): { probe: Probe | null; passedLevel: number | null } {
  if (correct) {
    const passedLevel = probe.level;
    if (probe.level >= MAX_LEVEL) {
      return { probe: null, passedLevel };
    }
    return {
      probe: { ...probe, level: probe.level + 1 },
      passedLevel,
    };
  }
  const misses = probe.misses.slice();
  misses[probe.level] = (misses[probe.level] ?? 0) + 1;
  if (misses[probe.level] >= 2) {
    return { probe: null, passedLevel: null };
  }
  if (probe.level > 1 && !probe.steppedBack) {
    return {
      probe: { ...probe, misses, level: probe.level - 1, steppedBack: true },
      passedLevel: null,
    };
  }
  if (probe.steppedBack) {
    return { probe: null, passedLevel: null };
  }
  return { probe: { ...probe, misses }, passedLevel: null };
}

function skillById(skills: readonly Skill[]): Map<string, Skill> {
  return new Map(skills.map((skill) => [skill.id, skill]));
}

function prerequisitesMet(skill: Skill, map: LearnerMap): boolean {
  return skill.prerequisites.every((id) => (map[id]?.level ?? 0) >= MAX_LEVEL);
}

function nextSkill(
  skills: readonly Skill[],
  strands: readonly Strand[],
  map: LearnerMap,
  finished: ReadonlySet<string>,
): Skill | null {
  const byId = skillById(skills);
  for (const strand of strands) {
    for (const id of strand.skills) {
      if (finished.has(id)) {
        continue;
      }
      const skill = byId.get(id);
      if (!skill) {
        throw new Error(`Strand ${strand.id} lists missing skill ${id}`);
      }
      if (prerequisitesMet(skill, map)) {
        return skill;
      }
    }
  }
  return null;
}

export type PlacementQuestion = {
  strandId: string;
  skillId: string;
  level: number;
  correct: boolean;
  prompt: string;
};

export type PlacementResult = {
  map: LearnerMap;
  questions: PlacementQuestion[];
  toppedOut: string[];
};

export function runPlacement(options: {
  skills: readonly Skill[];
  strands: readonly Strand[];
  respond: (skill: Skill, problem: Problem, level: number) => boolean;
  seed?: number;
  rng?: Rng;
}): PlacementResult {
  const rng = options.rng ?? createRng(options.seed ?? 1);
  let map = createLearnerMap(options.skills);
  let toppedOut: string[] = [];
  const questions: PlacementQuestion[] = [];
  const finished = new Set<string>();

  for (let guard = 0; guard < options.skills.length + 2; guard += 1) {
    const skill = nextSkill(options.skills, options.strands, map, finished);
    if (!skill) {
      break;
    }
    let probe: Probe | null = freshProbe(skill.id);
    for (let asked = 0; probe && asked < 20; asked += 1) {
      const problem = generateProblem(skill, rng, probe.level);
      const correct = options.respond(skill, problem, probe.level);
      questions.push({
        strandId: skill.strand,
        skillId: skill.id,
        level: probe.level,
        correct,
        prompt: problem.prompt,
      });
      const result = applyResult(probe, correct);
      if (result.passedLevel != null) {
        map = recordLevelPass(map, skill.id, result.passedLevel);
      }
      probe = result.probe;
    }
    finished.add(skill.id);
    toppedOut = noteCeilings(options.strands, map, toppedOut);
  }

  return { map, questions, toppedOut };
}

export type QuizPhase = "answering" | "feedback" | "done";

export type QuizSession = {
  skills: readonly Skill[];
  strands: readonly Strand[];
  map: LearnerMap;
  toppedOut: string[];
  phase: QuizPhase;
  probe: Probe | null;
  finished: string[];
  problem: Problem | null;
  skillId: string | null;
  level: number;
  questionNumber: number;
  correct: boolean | null;
  skipped: boolean;
};

function withResult(session: QuizSession, correct: boolean): QuizSession {
  if (!session.probe || !session.skillId) {
    return session;
  }
  const result = applyResult(session.probe, correct);
  let map = session.map;
  if (result.passedLevel != null) {
    map = recordLevelPass(map, session.skillId, result.passedLevel);
  }
  const finished = result.probe ? session.finished : [...session.finished, session.skillId];
  const toppedOut = result.probe ? session.toppedOut : noteCeilings(session.strands, map, session.toppedOut);
  return {
    ...session,
    map,
    toppedOut,
    finished,
    probe: result.probe,
  };
}

function presentQuestion(session: QuizSession, rng: Rng): QuizSession {
  let probe = session.probe;
  let toppedOut = session.toppedOut;
  if (!probe) {
    const skill = nextSkill(session.skills, session.strands, session.map, new Set(session.finished));
    if (!skill) {
      toppedOut = noteCeilings(session.strands, session.map, toppedOut);
      return {
        ...session,
        toppedOut,
        phase: "done",
        probe: null,
        problem: null,
        skillId: null,
        correct: null,
        skipped: false,
      };
    }
    probe = freshProbe(skill.id);
  }
  const skill = skillById(session.skills).get(probe.skillId);
  if (!skill) {
    throw new Error(`Missing skill ${probe.skillId}`);
  }
  return {
    ...session,
    toppedOut,
    probe,
    phase: "answering",
    skillId: skill.id,
    level: probe.level,
    problem: generateProblem(skill, rng, probe.level),
    questionNumber: session.questionNumber + 1,
    correct: null,
    skipped: false,
  };
}

export function createQuizSession(options: {
  skills: readonly Skill[];
  strands: readonly Strand[];
  map?: LearnerMap;
  toppedOut?: string[];
  rng: Rng;
}): QuizSession {
  const base: QuizSession = {
    skills: options.skills,
    strands: options.strands,
    map: options.map ?? createLearnerMap(options.skills),
    toppedOut: options.toppedOut ?? [],
    phase: "answering",
    probe: null,
    finished: [],
    problem: null,
    skillId: null,
    level: 1,
    questionNumber: 0,
    correct: null,
    skipped: false,
  };
  return presentQuestion(base, options.rng);
}

export function gradeAnswer(session: QuizSession, given: string): QuizSession {
  if (session.phase !== "answering" || !session.problem || !session.skillId) {
    return session;
  }
  const correct = answersMatch(given, session.problem.answer);
  return {
    ...withResult(session, correct),
    phase: "feedback",
    correct,
    skipped: false,
  };
}

/** A skip is a miss and moves straight to the next problem. */
export function skipQuestion(session: QuizSession, rng: Rng): QuizSession {
  if (session.phase !== "answering" || !session.problem) {
    return session;
  }
  return presentQuestion(withResult(session, false), rng);
}

export function continueQuiz(session: QuizSession, rng: Rng): QuizSession {
  if (session.phase === "answering") {
    return session;
  }
  return presentQuestion(session, rng);
}
