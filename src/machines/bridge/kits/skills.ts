import { fitLevels, KIT_STRANDS, type GradeChoice } from "../../../engine/strand-placement";
import {
  currentLadderStep,
  maxOpenStep,
  passedLadderSteps,
  startsFromIds,
  type LadderStarts,
  type ServeCeiling,
} from "../../../ladder/current";
import { gradeCap, ladderStep, opStrand, stepsForOp, strandAllowed, type LadderOp } from "../../../ladder/steps";
import { CURRICULUM_SKILLS } from "../../../skills";

export type SkillStateName = "new" | "learning" | "practicing" | "fluent" | "mastered";

export const SKILL_STATE_LABEL: Record<SkillStateName, string> = {
  new: "New",
  learning: "Learning",
  practicing: "Practicing",
  fluent: "Fluent",
  mastered: "Mastered",
};

export type KitSkill = {
  id: string;
  strandId: string;
  level: number;
  name: string;
  prereqs: string[];
  notation: string;
  learnPicture: string;
  timeTarget: number;
};

export type SkillRecent = {
  prompt: string;
  correct: boolean;
  help?: boolean;
  ms?: number;
};

export type SkillProgress = {
  state: SkillStateName;
  days: { day: string; right: number; asked: number }[];
  recent: SkillRecent[];
  warmUp: boolean;
  sessionsSince: number;
  struggling?: boolean;
  reviewInterval: number;
  lastReview: string | null;
  fastDays: string[];
  fluentOn?: string;
};

export type SkillBook = {
  skills: Record<string, SkillProgress>;
  session: number;
  introduced: string | null;
  earned: string[];
  tally: Record<string, { right: number; asked: number }>;
  steps: number;
  placedAt?: string;
  fastRuns?: Record<string, number>;
  ladderStarts?: LadderStarts;
  roundStart?: ServeCeiling;
  roundCeil?: ServeCeiling;
};

export type AnswerNote = {
  ms?: number;
  day?: string;
  mixed?: boolean;
};

const SMALL_PIECES = ["gussets", "bolts"];

export function isSmallPiece(groupId: string): boolean {
  return SMALL_PIECES.includes(groupId);
}

export const KIT_SKILLS: KitSkill[] = CURRICULUM_SKILLS.map((skill) => ({
  id: skill.id,
  strandId: skill.strandId,
  level: skill.level,
  name: skill.name,
  prereqs: skill.prereqs,
  notation: skill.notation,
  learnPicture: skill.learnPicture,
  timeTarget: skill.timeTarget,
}));

export function timeTargetFor(skillId: string): number {
  return ladderStep(skillId)?.timeTarget ?? KIT_SKILLS.find((skill) => skill.id === skillId)?.timeTarget ?? 8;
}

export function dayDiff(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return 0;
  }
  return Math.round((end - start) / 86400000);
}

export function skillIsDue(progress: SkillProgress | undefined, day: string): boolean {
  if (!progress || progress.state === "new" || progress.state === "learning") {
    return false;
  }
  if (!progress.lastReview) {
    return progress.state === "practicing";
  }
  return dayDiff(progress.lastReview, day) >= progress.reviewInterval;
}

export function medianAnswerMs(progress: SkillProgress | undefined): number | null {
  const times = (progress?.recent ?? []).map((item) => item.ms).filter((ms): ms is number => typeof ms === "number" && ms > 0).slice(-10);
  if (times.length === 0) {
    return null;
  }
  const sorted = [...times].sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function doneState(state: SkillStateName | undefined): boolean {
  return state === "fluent" || state === "mastered";
}

function readyState(state: SkillStateName | undefined): boolean {
  return state === "learning" || state === "practicing" || state === "fluent" || state === "mastered";
}

export function skillById(id: string): KitSkill | undefined {
  return KIT_SKILLS.find((skill) => skill.id === id);
}

function blankProgress(state: SkillStateName): SkillProgress {
  return { state, days: [], recent: [], warmUp: false, sessionsSince: 0, reviewInterval: 1, lastReview: null, fastDays: [] };
}

function applyLadderStarts(skills: Record<string, SkillProgress>, starts?: LadderStarts | null): void {
  if (!starts) {
    return;
  }
  for (const step of Object.values(startsFromIds(starts))) {
    if (!step) {
      continue;
    }
    for (const item of stepsForOp(step.op)) {
      if (!skills[item.skillId]) {
        continue;
      }
      skills[item.skillId] = blankProgress(item.n < step.n ? "mastered" : "new");
    }
  }
}

/** Skills below the placed level start mastered. The placed level starts new. Ladder starts sit one step below settle. */
export function skillsFromLevels(levels: Record<string, number> | null, placedAt?: string, starts?: LadderStarts | null): SkillBook {
  const fitted = levels && Object.keys(levels).length > 0 ? fitLevels(levels) : null;
  const skills: Record<string, SkillProgress> = {};
  for (const skill of KIT_SKILLS) {
    const placed = fitted?.[skill.strandId] ?? 1;
    skills[skill.id] = blankProgress(skill.level < placed ? "mastered" : "new");
  }
  applyLadderStarts(skills, starts);
  // Same-level prereqs on other strands start as learning so an earlier kit piece can open.
  let changed = true;
  while (changed) {
    changed = false;
    for (const skill of KIT_SKILLS) {
      const placed = fitted?.[skill.strandId] ?? 1;
      if (skill.level !== placed) {
        continue;
      }
      for (const id of skill.prereqs) {
        const prereq = KIT_SKILLS.find((item) => item.id === id);
        // Same-strand prereqs stay new until their Learn card; only cross-strand ones bootstrap.
        if (!prereq || prereq.strandId === skill.strandId || prereq.level !== placed || skills[id]?.state !== "new") {
          continue;
        }
        const ready = prereq.prereqs.every((pid) => {
          const state = skills[pid]?.state;
          return readyState(state);
        });
        if (ready) {
          skills[id] = blankProgress("learning");
          changed = true;
        }
      }
    }
  }
  applyLadderStarts(skills, starts);
  return {
    skills,
    session: 0,
    introduced: null,
    earned: [],
    tally: {},
    steps: 0,
    placedAt,
    fastRuns: {},
    ladderStarts: starts ?? undefined,
  };
}

export function workingLevel(book: SkillBook, strandId: string, placed?: number): number {
  const levels = [...new Set(KIT_SKILLS.filter((skill) => skill.strandId === strandId).map((skill) => skill.level))].sort((a, b) => a - b);
  for (const level of levels) {
    const at = KIT_SKILLS.filter((skill) => skill.strandId === strandId && skill.level === level);
    if (at.some((skill) => !doneState(book.skills[skill.id]?.state))) {
      if (placed == null || level <= placed) {
        return level;
      }
      // Strand has no skill at the placed rung; open the first real skill above it.
      const hasAtPlaced = levels.includes(placed);
      return hasAtPlaced ? Math.min(level, placed) : level;
    }
  }
  return Math.min(13, Math.max(1, placed ?? levels[0] ?? 1));
}

export function prereqsMet(book: SkillBook, skill: KitSkill): boolean {
  return skill.prereqs.every((id) => {
    const state = book.skills[id]?.state;
    return readyState(state);
  });
}

export function newSkill(book: SkillBook, strandId: string, level: number): KitSkill | null {
  return (
    KIT_SKILLS.find(
      (skill) => skill.strandId === strandId && skill.level === level && book.skills[skill.id]?.state === "new" && prereqsMet(book, skill),
    ) ?? null
  );
}

export function currentSkill(book: SkillBook, strandId: string, level: number): KitSkill {
  return currentSkillForOp(book, strandId, level) ?? KIT_SKILLS[0];
}

function skillOp(skill: KitSkill): string | undefined {
  return ladderStep(skill.id)?.op;
}

export function currentSkillForOp(book: SkillBook, strandId: string, level: number, op?: "A" | "S"): KitSkill | null {
  let at = KIT_SKILLS.filter((skill) => skill.strandId === strandId && skill.level === level);
  if (op) {
    at = at.filter((skill) => skillOp(skill) === op);
  }
  if (at.length === 0) {
    const levels = KIT_SKILLS.filter((skill) => skill.strandId === strandId && (!op || skillOp(skill) === op)).map((skill) => skill.level);
    const nearest = levels.sort((a, b) => Math.abs(a - level) - Math.abs(b - level))[0];
    if (nearest == null) {
      return op ? null : KIT_SKILLS[0];
    }
    at = KIT_SKILLS.filter((skill) => skill.strandId === strandId && skill.level === nearest && (!op || skillOp(skill) === op));
  }
  const rank: SkillStateName[] = ["learning", "practicing", "new", "fluent", "mastered"];
  for (const state of rank) {
    const found = at.find((skill) => book.skills[skill.id]?.state === state && (state !== "new" || prereqsMet(book, skill)));
    if (found) {
      return found;
    }
  }
  return at[0] ?? null;
}

function stateOf(book: SkillBook): (skillId: string) => SkillStateName | undefined {
  return (skillId) => book.skills[skillId]?.state;
}

export function bookCurrentStep(book: SkillBook, op: LadderOp, grade?: GradeChoice | null): ReturnType<typeof currentLadderStep> {
  return currentLadderStep(op, stateOf(book), grade);
}

export function bookCeiling(book: SkillBook, grade?: GradeChoice | null): ServeCeiling {
  const ceiling: ServeCeiling = {};
  for (const op of ["A", "S", "M", "D"] as const) {
    if (gradeCap(op, grade) <= 0) {
      continue;
    }
    ceiling[op] = maxOpenStep(op, stateOf(book), grade, book.roundCeil?.[op]);
  }
  return ceiling;
}

function useLadderPlan(book: SkillBook, grade?: GradeChoice | null): boolean {
  if (book.ladderStarts) {
    return true;
  }
  return typeof grade === "number" && grade <= 3;
}

function dueEvery(skillId: string): number {
  return skillId.charCodeAt(skillId.length - 1) % 2 === 0 ? 2 : 3;
}

export type WarmSlot = { skillId: string; strandId: string; level: number };

function withinLevel(skill: KitSkill, levels: Record<string, number> | null): boolean {
  const placed = levels?.[skill.strandId] ?? 1;
  return skill.level <= placed + 1 && skill.level >= placed - 2;
}

function ladderWarmSlots(book: SkillBook, count: number, grade?: GradeChoice | null): WarmSlot[] {
  const slots: WarmSlot[] = [];
  const used = new Set<string>();
  const ops = (["A", "S", "M", "D"] as const).filter((op) => gradeCap(op, grade) > 0);
  const pools = ops.map((op) => {
    const current = bookCurrentStep(book, op, grade);
    const passed = passedLadderSteps(op, stateOf(book), current);
    return passed.length > 0 ? passed : [current];
  });
  let cursor = 0;
  while (slots.length < count && cursor < 24) {
    const pool = pools[cursor % pools.length] ?? [];
    const step = pool[Math.floor(cursor / pools.length) % pool.length];
    cursor += 1;
    if (!step || used.has(step.skillId)) {
      continue;
    }
    used.add(step.skillId);
    slots.push({ skillId: step.skillId, strandId: opStrand(step.op), level: step.level });
  }
  return slots;
}

/** Warm-up slots: due reviews first, then missed skills, then practicing skills. */
export function warmUpPlan(
  book: SkillBook,
  count = 3,
  pieceStrand = "dividing",
  levels: Record<string, number> | null = null,
  day = "2026-10-20",
  grade?: GradeChoice | null,
): WarmSlot[] {
  if (useLadderPlan(book, grade)) {
    const ladder = ladderWarmSlots(book, count, grade);
    if (ladder.length >= count) {
      return ladder;
    }
  }
  const legal = (skill: KitSkill) => withinLevel(skill, levels);
  const due = KIT_SKILLS.filter((skill) => skillIsDue(book.skills[skill.id], day) && legal(skill));
  const flagged = KIT_SKILLS.filter((skill) => book.skills[skill.id]?.warmUp && legal(skill) && !due.includes(skill));
  const practicing = KIT_SKILLS.filter((skill) => {
    const progress = book.skills[skill.id];
    return progress?.state === "practicing" && progress.sessionsSince >= dueEvery(skill.id) && legal(skill) && !due.includes(skill);
  });
  const otherPractice = KIT_SKILLS.filter((skill) => book.skills[skill.id]?.state === "practicing" && !practicing.includes(skill) && !due.includes(skill) && legal(skill));
  const mastered = KIT_SKILLS.filter((skill) => doneState(book.skills[skill.id]?.state) && legal(skill));
  const pool = [...due, ...flagged, ...practicing, ...otherPractice];
  const slots: WarmSlot[] = [];
  const used = new Set<string>();
  for (const skill of pool) {
    if (slots.length >= count || used.has(skill.id)) {
      continue;
    }
    used.add(skill.id);
    slots.push({ skillId: skill.id, strandId: skill.strandId, level: skill.level });
  }
  const recentMastered = [...mastered].sort((left, right) => right.level - left.level);
  const includeMastered = book.session % 2 === 1 && recentMastered.length > 0;
  const pieceLevel = workingLevel(book, pieceStrand, levels?.[pieceStrand]);
  const piece = interleaveOps(KIT_SKILLS.filter((skill) => skill.strandId === pieceStrand && skill.level === pieceLevel && legal(skill)));
  let fill = recentMastered.length > 0 ? interleaveOps(recentMastered) : piece;
  if (fill.length === 0) {
    fill = KIT_SKILLS.filter((skill) => skill.strandId === pieceStrand && legal(skill));
  }
  if (fill.length === 0) {
    fill = KIT_SKILLS.filter((skill) => skill.strandId === pieceStrand);
  }
  let cursor = 0;
  while (slots.length < count && fill.length > 0) {
    const skill = fill[cursor % fill.length];
    cursor += 1;
    if (!skill || (used.has(skill.id) && cursor > fill.length * 2)) {
      break;
    }
    if (used.has(skill.id)) {
      continue;
    }
    used.add(skill.id);
    slots.push({ skillId: skill.id, strandId: skill.strandId, level: skill.level });
  }
  if (includeMastered && recentMastered[0] && !slots.some((slot) => slot.skillId === recentMastered[0].id)) {
    slots[slots.length - 1] = { skillId: recentMastered[0].id, strandId: recentMastered[0].strandId, level: recentMastered[0].level };
  }
  return slots.slice(0, count);
}

export type RunSlot = { skillId: string; strandId: string; level: number; mixed: boolean };

function interleaveOps(skills: KitSkill[]): KitSkill[] {
  const add = skills.filter((skill) => skillOp(skill) !== "S");
  const sub = skills.filter((skill) => skillOp(skill) === "S");
  if (sub.length === 0 || add.length === 0) {
    return skills;
  }
  const mixed: KitSkill[] = [];
  const longest = Math.max(add.length, sub.length);
  for (let index = 0; index < longest; index += 1) {
    if (add[index]) {
      mixed.push(add[index]);
    }
    if (sub[index]) {
      mixed.push(sub[index]);
    }
  }
  return mixed;
}

function pickLadderStep(book: SkillBook, op: LadderOp, review: boolean, index: number, seed: number, grade?: GradeChoice | null) {
  const current = bookCurrentStep(book, op, grade);
  const maxN = maxOpenStep(op, stateOf(book), grade, book.roundCeil?.[op]);
  const served = current.n <= maxN ? current : stepsForOp(op).find((step) => step.n === maxN) ?? current;
  const passed = passedLadderSteps(op, stateOf(book), served).filter((step) => step.n <= maxN);
  if (review && passed.length > 0) {
    return passed[Math.abs(index + seed) % passed.length];
  }
  return served;
}

function ladderRunSlots(book: SkillBook, ops: LadderOp[], length: number, seed: number, grade?: GradeChoice | null): RunSlot[] {
  const slots: RunSlot[] = [];
  const reviewCount = Math.round(length * 0.3);
  for (let index = 0; index < length; index += 1) {
    const review = index >= length - reviewCount;
    const op = ops.length > 1 && (index + seed) % 3 === 0 ? (ops[1] ?? ops[0]) : (ops[0] ?? "A");
    const step = pickLadderStep(book, op, review, index, seed, grade);
    slots.push({ skillId: step.skillId, strandId: opStrand(step.op), level: step.level, mixed: review });
  }
  return slots;
}

/** Every question in a piece run is that piece's strand, at the learner's working level. Adding mixes in subtracting. */
export function runPlan(book: SkillBook, strandId: string, level: number, length: number, seed: number, grade?: GradeChoice | null): RunSlot[] {
  if (useLadderPlan(book, grade)) {
    if (strandId === "multiplying" && gradeCap("M", grade) > 0) {
      return ladderRunSlots(book, ["M"], length, seed, grade);
    }
    if (strandId === "dividing" && gradeCap("D", grade) > 0) {
      return ladderRunSlots(book, ["D"], length, seed, grade);
    }
    if (strandId === "adding" || strandId === "subtracting" || (grade != null && !strandAllowed(strandId, grade))) {
      const ops: LadderOp[] = ["A"];
      if (gradeCap("S", grade) > 0) {
        ops.push("S");
      }
      return ladderRunSlots(book, ops, length, seed, grade);
    }
  }
  const focus = currentSkill(book, strandId, level);
  const add = strandId === "adding" ? currentSkillForOp(book, strandId, level, "A") : null;
  const sub = strandId === "adding" ? currentSkillForOp(book, strandId, level, "S") : null;
  const slots: RunSlot[] = [];
  for (let index = 0; index < length; index += 1) {
    const useSub = Boolean(sub) && (index + seed) % 3 === 0;
    const skill = (useSub ? sub : add) ?? focus;
    slots.push({ skillId: skill.id, strandId: skill.strandId, level: skill.level, mixed: false });
  }
  return slots;
}

export function longestStrandRun(strandIds: string[]): number {
  let best = 0;
  let streak = 0;
  let last = "";
  for (const id of strandIds) {
    streak = id === last ? streak + 1 : 1;
    last = id;
    best = Math.max(best, streak);
  }
  return best;
}

export function beginSession(book: SkillBook): SkillBook {
  const skills: SkillBook["skills"] = {};
  for (const [id, progress] of Object.entries(book.skills)) {
    const sessionsSince = progress.state === "practicing" ? progress.sessionsSince + 1 : progress.sessionsSince;
    skills[id] = { ...progress, sessionsSince };
  }
  const roundStart: ServeCeiling = {};
  const roundCeil: ServeCeiling = {};
  for (const op of ["A", "S", "M", "D"] as const) {
    const current = currentLadderStep(op, (id) => skills[id]?.state);
    roundStart[op] = current.n;
    roundCeil[op] = current.n + 1;
  }
  return { ...book, skills, session: book.session + 1, introduced: null, tally: {}, roundStart, roundCeil };
}

function applyReview(progress: SkillProgress, correct: boolean, day: string, half = false): SkillProgress {
  if (progress.state === "new" || progress.state === "learning") {
    return { ...progress, lastReview: day };
  }
  const due = skillIsDue(progress, day);
  if (!due && !half) {
    return correct ? { ...progress, lastReview: day } : progress;
  }
  if (correct) {
    const nextInterval = due ? (half ? Math.max(progress.reviewInterval, Math.round(progress.reviewInterval * 1.5)) : progress.reviewInterval * 2) : progress.reviewInterval;
    return { ...progress, lastReview: day, reviewInterval: nextInterval };
  }
  if (!due) {
    return progress;
  }
  return { ...progress, lastReview: day, reviewInterval: Math.max(1, Math.floor(progress.reviewInterval / 2)) };
}

function dropState(state: SkillStateName): SkillStateName {
  if (state === "mastered") {
    return "fluent";
  }
  if (state === "fluent") {
    return "practicing";
  }
  return state;
}

export function rememberAnswer(book: SkillBook, skillId: string, prompt: string, correct: boolean, help = false, note: AnswerNote = {}): SkillBook {
  const progress = book.skills[skillId];
  if (!progress) {
    return book;
  }
  const day = note.day ?? "";
  const recent = [
    ...progress.recent,
    { prompt, correct: help ? false : correct, help: help || undefined, ms: typeof note.ms === "number" ? note.ms : undefined },
  ].slice(-10);
  const tally = book.tally[skillId] ?? { right: 0, asked: 0 };
  let next: SkillProgress = {
    ...progress,
    recent,
    warmUp: help || correct ? progress.warmUp : true,
  };
  if (!help && day) {
    next = applyReview(next, correct, day, false);
    if (!correct) {
      next = { ...next, state: dropState(next.state) };
    } else {
      const targetMs = timeTargetFor(skillId) * 1000;
      const fast = typeof note.ms === "number" && note.ms <= targetMs;
      const fastDays = fast && !next.fastDays.includes(day) ? [...next.fastDays, day].slice(-8) : next.fastDays;
      next = { ...next, fastDays };
      if (next.state === "practicing" && fastDays.length >= 3) {
        next = { ...next, state: "fluent", fluentOn: next.fluentOn ?? day };
      }
      if (next.state === "fluent" && note.mixed === true && next.fluentOn && dayDiff(next.fluentOn, day) >= 7) {
        next = { ...next, state: "mastered" };
      }
    }
  }
  const skills = { ...book.skills, [skillId]: next };
  if (correct && !help && day) {
    const skill = KIT_SKILLS.find((item) => item.id === skillId);
    for (const prereqId of skill?.prereqs ?? []) {
      const prereq = skills[prereqId];
      if (!prereq) {
        continue;
      }
      skills[prereqId] = applyReview(prereq, true, day, true);
    }
  }
  return {
    ...book,
    skills,
    tally: { ...book.tally, [skillId]: { right: tally.right + (correct ? 1 : 0), asked: tally.asked + 1 } },
  };
}

export function maybeBoostStrand(
  book: SkillBook,
  levels: Record<string, number>,
  strand: string,
  day: string,
  cleanFast: boolean,
): { book: SkillBook; levels: Record<string, number> } {
  if (!cleanFast || !book.placedAt || dayDiff(book.placedAt, day) > 7) {
    return { book, levels };
  }
  const fastRuns = { ...(book.fastRuns ?? {}), [strand]: ((book.fastRuns ?? {})[strand] ?? 0) + 1 };
  const nextBook = { ...book, fastRuns };
  if (fastRuns[strand] < 3) {
    return { book: nextBook, levels };
  }
  const nextLevel = Math.min(13, (levels[strand] ?? 1) + 1);
  return { book: nextBook, levels: fitLevels({ ...levels, [strand]: nextLevel }) };
}

export function markStruggling(book: SkillBook, skillId: string): SkillBook {
  const progress = book.skills[skillId];
  if (!progress) {
    return book;
  }
  return { ...book, skills: { ...book.skills, [skillId]: { ...progress, struggling: true } } };
}

export function flagWarmUp(book: SkillBook, skillId: string): SkillBook {
  const progress = book.skills[skillId];
  if (!progress) {
    return book;
  }
  return { ...book, skills: { ...book.skills, [skillId]: { ...progress, warmUp: true } } };
}

export function clearWarmFlag(book: SkillBook, skillId: string): SkillBook {
  const progress = book.skills[skillId];
  if (!progress?.warmUp) {
    return book;
  }
  return { ...book, skills: { ...book.skills, [skillId]: { ...progress, warmUp: false, sessionsSince: 0 } } };
}

export function markLearning(book: SkillBook, skillId: string): SkillBook {
  const progress = book.skills[skillId];
  if (!progress || progress.state !== "new") {
    return { ...book, introduced: skillId };
  }
  return {
    ...book,
    introduced: skillId,
    skills: { ...book.skills, [skillId]: { ...progress, state: "learning" } },
  };
}

/**
 * A counted day is at least 4 right out of 5.
 * That session moves Learning to Practicing. Fluent needs three fast days.
 */
export function noteSession(book: SkillBook, skillId: string, day: string, right: number, asked: number): SkillBook {
  const progress = book.skills[skillId];
  if (!progress || progress.state === "new" || progress.state === "fluent" || progress.state === "mastered" || asked < 5 || right < 4) {
    return book;
  }
  const days = progress.days.some((entry) => entry.day === day)
    ? progress.days.map((entry) => (entry.day === day ? { day, right, asked } : entry))
    : [...progress.days, { day, right, asked }];
  const counted = days.filter((entry) => entry.asked >= 5 && entry.right >= 4);
  let state: SkillStateName = progress.state;
  if (state === "learning" && counted.length >= 1) {
    const step = ladderStep(skillId);
    const startN = step ? book.roundStart?.[step.op] : undefined;
    if (step && startN != null && step.n > startN) {
      state = "learning";
    } else {
      state = "practicing";
    }
  }
  return { ...book, skills: { ...book.skills, [skillId]: { ...progress, state, days } } };
}

export function closeTallies(book: SkillBook, day: string): SkillBook {
  let next = book;
  for (const [skillId, tally] of Object.entries(book.tally)) {
    next = noteSession(next, skillId, day, tally.right, tally.asked);
  }
  return { ...next, tally: {} };
}

export function strandLevelsFrom(book: SkillBook): Record<string, number> {
  const levels: Record<string, number> = {};
  for (const strandId of KIT_STRANDS) {
    levels[strandId] = workingLevel(book, strandId);
  }
  return levels;
}

export function allLevelMap(level = 4): Record<string, number> {
  return Object.fromEntries(KIT_STRANDS.map((id) => [id, level]));
}

export function demoFluentBook(day = "2026-10-20"): SkillBook {
  let book = withState(skillsFromLevels(allLevelMap(4), day), "measuring.1.longer", "fluent");
  const times = [4200, 3800, 3500, 3100, 2900, 2700, 2500, 2400, 2200, 2100];
  const recent = times.map((ms, index) => ({ prompt: `Which beam is longer? ${index}`, correct: true, ms }));
  book = {
    ...book,
    skills: {
      ...book.skills,
      "measuring.1.longer": {
        ...book.skills["measuring.1.longer"],
        fluentOn: "2026-10-18",
        fastDays: ["2026-10-16", "2026-10-17", "2026-10-18"],
        lastReview: day,
        reviewInterval: 2,
        recent,
      },
    },
  };
  return book;
}

export function demoReviewBook(_day = "2026-10-20"): SkillBook {
  let book = withState(skillsFromLevels(allLevelMap(4), "2026-10-13"), "adding.2.a6", "practicing");
  book = {
    ...book,
    skills: {
      ...book.skills,
      "adding.2.a6": {
        ...book.skills["adding.2.a6"],
        lastReview: "2026-10-19",
        reviewInterval: 1,
        warmUp: true,
      },
    },
  };
  return book;
}

export function withState(book: SkillBook, skillId: string, state: SkillStateName): SkillBook {
  const progress = book.skills[skillId];
  if (!progress) {
    return book;
  }
  return { ...book, skills: { ...book.skills, [skillId]: { ...progress, state } } };
}

export function sanitizeBook(raw: unknown): SkillBook | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }
  const record = raw as Partial<SkillBook>;
  const base = skillsFromLevels(null);
  if (!record.skills || typeof record.skills !== "object") {
    return undefined;
  }
  for (const skill of KIT_SKILLS) {
    const item = record.skills[skill.id];
    if (!item || typeof item !== "object") {
      continue;
    }
    const state: SkillStateName =
      item.state === "learning" || item.state === "practicing" || item.state === "fluent" || item.state === "mastered" || item.state === "new"
        ? item.state
        : "new";
    base.skills[skill.id] = {
      state,
      days: Array.isArray(item.days)
        ? item.days.filter((entry) => entry && typeof entry.day === "string").map((entry) => ({
            day: entry.day,
            right: Number(entry.right) || 0,
            asked: Number(entry.asked) || 0,
          }))
        : [],
      recent: Array.isArray(item.recent)
        ? item.recent
            .filter((entry) => entry && typeof entry.prompt === "string")
            .slice(-10)
            .map((entry) => ({
              prompt: entry.prompt,
              correct: entry.correct === true,
              help: entry.help === true || undefined,
              ms: typeof entry.ms === "number" && entry.ms >= 0 ? entry.ms : undefined,
            }))
        : [],
      warmUp: item.warmUp === true,
      sessionsSince: typeof item.sessionsSince === "number" ? item.sessionsSince : 0,
      struggling: item.struggling === true || undefined,
      reviewInterval: typeof item.reviewInterval === "number" && item.reviewInterval >= 1 ? Math.round(item.reviewInterval) : 1,
      lastReview: typeof item.lastReview === "string" ? item.lastReview : null,
      fastDays: Array.isArray(item.fastDays) ? item.fastDays.filter((entry): entry is string => typeof entry === "string").slice(-8) : [],
      fluentOn: typeof item.fluentOn === "string" ? item.fluentOn : undefined,
    };
  }
  return {
    skills: base.skills,
    session: typeof record.session === "number" ? record.session : 0,
    introduced: typeof record.introduced === "string" ? record.introduced : null,
    earned: Array.isArray(record.earned) ? record.earned.filter((item): item is string => typeof item === "string") : [],
    tally: {},
    steps: typeof record.steps === "number" && record.steps >= 0 ? record.steps : 0,
    placedAt: typeof record.placedAt === "string" ? record.placedAt : undefined,
    fastRuns:
      record.fastRuns && typeof record.fastRuns === "object"
        ? Object.fromEntries(Object.entries(record.fastRuns).filter((entry): entry is [string, number] => typeof entry[1] === "number"))
        : {},
    ladderStarts: record.ladderStarts,
    roundStart: record.roundStart,
    roundCeil: record.roundCeil,
  };
}
