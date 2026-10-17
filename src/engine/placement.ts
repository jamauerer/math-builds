import { answersMatch } from "./answers";
import { generateProblem } from "./generate";
import type { Rng } from "./rng";
import { MAX_LEVEL, type Problem, type Skill, type Strand } from "./types";

export type SkillStateName = "unknown" | "shaky" | "solid" | "unchecked";

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
    map[skill.id] = { level: 0, state: "unchecked" };
  }
  return map;
}

/** Worst-case sitting length turned into a minute estimate. Uses both strand and skill counts. */
export function placementMinutes(strandCount: number, skillCount: number): number {
  const seconds = skillCount * 3 * 12 + strandCount * 20;
  return Math.max(1, Math.round(seconds / 60));
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

const MAX_PROBE_QUESTIONS = 3;

export type Probe = {
  skillId: string;
  level: number;
  /** Highest level passed so far in this skill's probe. */
  passed: number;
  asked: number;
};

function freshProbe(skillId: string): Probe {
  return { skillId, level: 3, passed: 0, asked: 0 };
}

/** Correct jumps up, a miss drops down, and the probe ends in at most three questions. */
function nextProbeLevel(level: number, correct: boolean): number | null {
  if (level === 3) {
    return correct ? 4 : 2;
  }
  if (level === 4) {
    return correct ? 5 : null;
  }
  if (level === 2) {
    return correct ? null : 1;
  }
  return null;
}

function applyResult(
  probe: Probe,
  correct: boolean,
): { probe: Probe | null; finalLevel: number | null } {
  const passed = correct ? Math.max(probe.passed, probe.level) : probe.passed;
  const asked = probe.asked + 1;
  const next = nextProbeLevel(probe.level, correct);
  if (next == null || asked >= MAX_PROBE_QUESTIONS) {
    return { probe: null, finalLevel: passed };
  }
  return {
    probe: { skillId: probe.skillId, level: next, passed, asked },
    finalLevel: null,
  };
}

function skillById(skills: readonly Skill[]): Map<string, Skill> {
  return new Map(skills.map((skill) => [skill.id, skill]));
}

function transitivePrerequisites(skills: readonly Skill[], skillId: string): string[] {
  const byId = skillById(skills);
  const found: string[] = [];
  const walk = (id: string) => {
    const skill = byId.get(id);
    if (!skill) {
      return;
    }
    for (const prerequisite of skill.prerequisites) {
      if (found.includes(prerequisite)) {
        continue;
      }
      found.push(prerequisite);
      walk(prerequisite);
    }
  };
  walk(skillId);
  return found;
}

function transitiveDependents(skills: readonly Skill[], skillId: string): string[] {
  const found: string[] = [];
  const walk = (id: string) => {
    for (const skill of skills) {
      if (!skill.prerequisites.includes(id) || found.includes(skill.id)) {
        continue;
      }
      found.push(skill.id);
      walk(skill.id);
    }
  };
  walk(skillId);
  return found;
}

function assignLevel(map: LearnerMap, skillId: string, level: number): LearnerMap {
  const previous = map[skillId];
  if (!previous) {
    throw new Error(`Unknown skill ${skillId}`);
  }
  if (previous.state !== "unchecked" && previous.level >= level) {
    return map;
  }
  const nextLevel = previous.state === "unchecked" ? level : Math.max(previous.level, level);
  return {
    ...map,
    [skillId]: { level: nextLevel, state: labelForLevel(nextLevel) },
  };
}

/** Passing 4 or 5 fills unchecked prerequisites. Failing level 1 fills dependents with 0. */
export function inferImpliedLevels(
  map: LearnerMap,
  skills: readonly Skill[],
  skillId: string,
  level: number,
): LearnerMap {
  let next = assignLevel(map, skillId, level);
  if (level >= 4) {
    for (const prerequisite of transitivePrerequisites(skills, skillId)) {
      if (next[prerequisite]?.state === "unchecked") {
        next = assignLevel(next, prerequisite, level);
      }
    }
  }
  if (level === 0) {
    for (const dependent of transitiveDependents(skills, skillId)) {
      if (next[dependent]?.state === "unchecked") {
        next = assignLevel(next, dependent, 0);
      }
    }
  }
  return next;
}

function nextSkill(skills: readonly Skill[], strands: readonly Strand[], map: LearnerMap): Skill | null {
  const byId = skillById(skills);
  for (const strand of strands) {
    for (const id of strand.skills) {
      if (map[id]?.state !== "unchecked") {
        continue;
      }
      const skill = byId.get(id);
      if (!skill) {
        throw new Error(`Strand ${strand.id} lists missing skill ${id}`);
      }
      const waiting = skill.prerequisites.some((prerequisite) => map[prerequisite]?.state === "unchecked");
      const blocked = skill.prerequisites.some(
        (prerequisite) => map[prerequisite]?.state !== "unchecked" && (map[prerequisite]?.level ?? 0) === 0,
      );
      if (!waiting && !blocked) {
        return skill;
      }
    }
  }
  return null;
}

export function questionsRemaining(skills: readonly Skill[], map: LearnerMap, probe: Probe | null): number {
  let total = 0;
  for (const skill of skills) {
    if (map[skill.id]?.state !== "unchecked") {
      continue;
    }
    if (probe && probe.skillId === skill.id) {
      total += Math.max(0, MAX_PROBE_QUESTIONS - probe.asked);
    } else {
      total += MAX_PROBE_QUESTIONS;
    }
  }
  return total;
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

function cursorRng(cursor: { state: number }): Rng {
  return () => {
    cursor.state = (cursor.state + 0x6d2b79f5) >>> 0;
    let mixed = cursor.state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

export function runPlacement(options: {
  skills: readonly Skill[];
  strands: readonly Strand[];
  respond: (skill: Skill, problem: Problem, level: number) => boolean;
  seed?: number;
}): PlacementResult {
  let session = createQuizSession({
    skills: options.skills,
    strands: options.strands,
    seed: options.seed ?? 1,
  });
  const questions: PlacementQuestion[] = [];
  for (let guard = 0; session.phase !== "done" && guard < 500; guard += 1) {
    const skill = options.skills.find((item) => item.id === session.skillId);
    if (!skill || !session.problem) {
      break;
    }
    const correct = options.respond(skill, session.problem, session.level);
    questions.push({
      strandId: skill.strand,
      skillId: skill.id,
      level: session.level,
      correct,
      prompt: session.problem.prompt,
    });
    const given = correct ? session.problem.answer : "nope";
    session = continueQuiz(gradeAnswer(session, given));
  }
  return { map: session.map, questions, toppedOut: session.toppedOut };
}

export type QuizPhase = "answering" | "feedback" | "done";

export type QuizSession = {
  skills: readonly Skill[];
  strands: readonly Strand[];
  map: LearnerMap;
  toppedOut: string[];
  phase: QuizPhase;
  probe: Probe | null;
  problem: Problem | null;
  skillId: string | null;
  level: number;
  questionNumber: number;
  correct: boolean | null;
  skipped: boolean;
  rngState: number;
};

export type PlacementSnapshot = {
  map: LearnerMap;
  toppedOut: string[];
  phase: QuizPhase;
  probe: Probe | null;
  problem: Problem | null;
  skillId: string | null;
  level: number;
  questionNumber: number;
  correct: boolean | null;
  skipped: boolean;
  rngState: number;
};

function withResult(session: QuizSession, correct: boolean): QuizSession {
  if (!session.probe || !session.skillId) {
    return session;
  }
  const result = applyResult(session.probe, correct);
  let map = session.map;
  let toppedOut = session.toppedOut;
  if (result.finalLevel != null) {
    map = inferImpliedLevels(map, session.skills, session.skillId, result.finalLevel);
    toppedOut = noteCeilings(session.strands, map, toppedOut);
  }
  return {
    ...session,
    map,
    toppedOut,
    probe: result.probe,
  };
}

function presentQuestion(session: QuizSession): QuizSession {
  let probe = session.probe;
  let toppedOut = session.toppedOut;
  if (!probe) {
    const skill = nextSkill(session.skills, session.strands, session.map);
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
  const cursor = { state: session.rngState };
  const problem = generateProblem(skill, cursorRng(cursor), probe.level);
  return {
    ...session,
    toppedOut,
    probe,
    phase: "answering",
    skillId: skill.id,
    level: probe.level,
    problem,
    questionNumber: session.questionNumber + 1,
    correct: null,
    skipped: false,
    rngState: cursor.state,
  };
}

export function createQuizSession(options: {
  skills: readonly Skill[];
  strands: readonly Strand[];
  map?: LearnerMap;
  toppedOut?: string[];
  seed?: number;
  rngState?: number;
}): QuizSession {
  const seed = options.seed ?? 1;
  const base: QuizSession = {
    skills: options.skills,
    strands: options.strands,
    map: options.map ?? createLearnerMap(options.skills),
    toppedOut: options.toppedOut ?? [],
    phase: "answering",
    probe: null,
    problem: null,
    skillId: null,
    level: 3,
    questionNumber: 0,
    correct: null,
    skipped: false,
    rngState: options.rngState ?? (seed >>> 0 || 1),
  };
  return presentQuestion(base);
}

export function snapshotQuiz(session: QuizSession): PlacementSnapshot {
  return {
    map: session.map,
    toppedOut: session.toppedOut,
    phase: session.phase,
    probe: session.probe,
    problem: session.problem,
    skillId: session.skillId,
    level: session.level,
    questionNumber: session.questionNumber,
    correct: session.correct,
    skipped: session.skipped,
    rngState: session.rngState,
  };
}

export function restoreQuiz(
  snapshot: PlacementSnapshot,
  skills: readonly Skill[],
  strands: readonly Strand[],
): QuizSession {
  return {
    ...snapshot,
    skills,
    strands,
  };
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
export function skipQuestion(session: QuizSession): QuizSession {
  if (session.phase !== "answering" || !session.problem) {
    return session;
  }
  return presentQuestion(withResult(session, false));
}

export function continueQuiz(session: QuizSession): QuizSession {
  if (session.phase === "answering") {
    return session;
  }
  return presentQuestion(session);
}
