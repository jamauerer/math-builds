import { fitLevels, KIT_STRANDS } from "../../../engine/strand-placement";
import { CURRICULUM_SKILLS } from "../../../skills";

export type SkillStateName = "new" | "learning" | "practicing" | "mastered";

export type KitSkill = {
  id: string;
  strandId: string;
  level: number;
  name: string;
  prereqs: string[];
  notation: string;
  learnPicture: string;
};

export type SkillRecent = {
  prompt: string;
  correct: boolean;
  help?: boolean;
};

export type SkillProgress = {
  state: SkillStateName;
  days: { day: string; right: number; asked: number }[];
  recent: SkillRecent[];
  warmUp: boolean;
  sessionsSince: number;
  struggling?: boolean;
};

export type SkillBook = {
  skills: Record<string, SkillProgress>;
  session: number;
  introduced: string | null;
  earned: string[];
  tally: Record<string, { right: number; asked: number }>;
  steps: number;
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
}));

export function skillById(id: string): KitSkill | undefined {
  return KIT_SKILLS.find((skill) => skill.id === id);
}

function blankProgress(state: SkillStateName): SkillProgress {
  return { state, days: [], recent: [], warmUp: false, sessionsSince: 0 };
}

/** Skills below the placed level start mastered. The placed level starts new. */
export function skillsFromLevels(levels: Record<string, number> | null): SkillBook {
  const fitted = levels && Object.keys(levels).length > 0 ? fitLevels(levels) : null;
  const skills: Record<string, SkillProgress> = {};
  for (const skill of KIT_SKILLS) {
    const placed = fitted?.[skill.strandId] ?? 1;
    skills[skill.id] = blankProgress(skill.level < placed ? "mastered" : "new");
  }
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
          return state === "mastered" || state === "learning" || state === "practicing";
        });
        if (ready) {
          skills[id] = blankProgress("learning");
          changed = true;
        }
      }
    }
  }
  return { skills, session: 0, introduced: null, earned: [], tally: {}, steps: 0 };
}

export function workingLevel(book: SkillBook, strandId: string, placed?: number): number {
  const levels = [...new Set(KIT_SKILLS.filter((skill) => skill.strandId === strandId).map((skill) => skill.level))].sort((a, b) => a - b);
  for (const level of levels) {
    const at = KIT_SKILLS.filter((skill) => skill.strandId === strandId && skill.level === level);
    if (at.some((skill) => book.skills[skill.id]?.state !== "mastered")) {
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
    return state === "learning" || state === "practicing" || state === "mastered";
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
  let at = KIT_SKILLS.filter((skill) => skill.strandId === strandId && skill.level === level);
  if (at.length === 0) {
    const levels = KIT_SKILLS.filter((skill) => skill.strandId === strandId).map((skill) => skill.level);
    const nearest = levels.sort((a, b) => Math.abs(a - level) - Math.abs(b - level))[0] ?? 1;
    at = KIT_SKILLS.filter((skill) => skill.strandId === strandId && skill.level === nearest);
  }
  const rank: SkillStateName[] = ["learning", "practicing", "new", "mastered"];
  for (const state of rank) {
    const found = at.find((skill) => book.skills[skill.id]?.state === state && (state !== "new" || prereqsMet(book, skill)));
    if (found) {
      return found;
    }
  }
  return at[0] ?? KIT_SKILLS[0];
}

function dueEvery(skillId: string): number {
  return skillId.charCodeAt(skillId.length - 1) % 2 === 0 ? 2 : 3;
}

export type WarmSlot = { skillId: string; strandId: string; level: number };

function withinLevel(skill: KitSkill, levels: Record<string, number> | null): boolean {
  return skill.level <= (levels?.[skill.strandId] ?? 1) + 1;
}

/** Warm-up slots: missed skills first, then practicing skills that are due, with a mastered skill about 1 in 10. */
export function warmUpPlan(book: SkillBook, count = 3, pieceStrand = "dividing", levels: Record<string, number> | null = null): WarmSlot[] {
  const legal = (skill: KitSkill) => withinLevel(skill, levels);
  const flagged = KIT_SKILLS.filter((skill) => book.skills[skill.id]?.warmUp && legal(skill));
  const practicing = KIT_SKILLS.filter((skill) => {
    const progress = book.skills[skill.id];
    return progress?.state === "practicing" && progress.sessionsSince >= dueEvery(skill.id) && legal(skill);
  });
  const otherPractice = KIT_SKILLS.filter((skill) => book.skills[skill.id]?.state === "practicing" && !practicing.includes(skill) && legal(skill));
  const mastered = KIT_SKILLS.filter((skill) => book.skills[skill.id]?.state === "mastered" && legal(skill));
  const pool = [...flagged, ...practicing, ...otherPractice];
  const slots: WarmSlot[] = [];
  const used = new Set<string>();
  for (const skill of pool) {
    if (slots.length >= count || used.has(skill.id)) {
      continue;
    }
    used.add(skill.id);
    slots.push({ skillId: skill.id, strandId: skill.strandId, level: skill.level });
  }
  const includeMastered = book.session % 2 === 1 && mastered.length > 0;
  const pieceLevel = workingLevel(book, pieceStrand, levels?.[pieceStrand]);
  const piece = KIT_SKILLS.filter((skill) => skill.strandId === pieceStrand && skill.level === pieceLevel && legal(skill));
  let fill = mastered.length > 0 ? mastered : piece;
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
  if (includeMastered && mastered[0] && !slots.some((slot) => slot.skillId === mastered[0].id)) {
    slots[slots.length - 1] = { skillId: mastered[0].id, strandId: mastered[0].strandId, level: mastered[0].level };
  }
  return slots.slice(0, count);
}

export type RunSlot = { skillId: string; strandId: string; level: number; mixed: boolean };

/** Every question in a piece run is that piece's strand, at the learner's working level. */
export function runPlan(book: SkillBook, strandId: string, level: number, length: number, seed: number): RunSlot[] {
  void seed;
  const focus = currentSkill(book, strandId, level);
  const slots: RunSlot[] = [];
  for (let index = 0; index < length; index += 1) {
    slots.push({ skillId: focus.id, strandId: focus.strandId, level: focus.level, mixed: false });
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
  return { ...book, skills, session: book.session + 1, introduced: null, tally: {} };
}

export function rememberAnswer(book: SkillBook, skillId: string, prompt: string, correct: boolean, help = false): SkillBook {
  const progress = book.skills[skillId];
  if (!progress) {
    return book;
  }
  const recent = [...progress.recent, { prompt, correct: help ? false : correct, help: help || undefined }].slice(-10);
  const tally = book.tally[skillId] ?? { right: 0, asked: 0 };
  return {
    ...book,
    skills: {
      ...book.skills,
      [skillId]: { ...progress, recent, warmUp: help || correct ? progress.warmUp : true },
    },
    tally: { ...book.tally, [skillId]: { right: tally.right + (correct ? 1 : 0), asked: tally.asked + 1 } },
  };
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
 * The same calendar day updates that day. Mastery needs three different days.
 */
export function noteSession(book: SkillBook, skillId: string, day: string, right: number, asked: number): SkillBook {
  const progress = book.skills[skillId];
  if (!progress || progress.state === "new" || progress.state === "mastered" || asked < 5 || right < 4) {
    return book;
  }
  const days = progress.days.some((entry) => entry.day === day)
    ? progress.days.map((entry) => (entry.day === day ? { day, right, asked } : entry))
    : [...progress.days, { day, right, asked }];
  const counted = days.filter((entry) => entry.asked >= 5 && entry.right >= 4);
  let state: SkillStateName = progress.state;
  if (state === "learning" && counted.length >= 1) {
    state = "practicing";
  }
  if (counted.length >= 3) {
    state = "mastered";
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
      item.state === "learning" || item.state === "practicing" || item.state === "mastered" || item.state === "new" ? item.state : "new";
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
            .map((entry) => ({ prompt: entry.prompt, correct: entry.correct === true, help: entry.help === true || undefined }))
        : [],
      warmUp: item.warmUp === true,
      sessionsSince: typeof item.sessionsSince === "number" ? item.sessionsSince : 0,
      struggling: item.struggling === true || undefined,
    };
  }
  return {
    skills: base.skills,
    session: typeof record.session === "number" ? record.session : 0,
    introduced: typeof record.introduced === "string" ? record.introduced : null,
    earned: Array.isArray(record.earned) ? record.earned.filter((item): item is string => typeof item === "string") : [],
    tally: {},
    steps: typeof record.steps === "number" && record.steps >= 0 ? record.steps : 0,
  };
}
