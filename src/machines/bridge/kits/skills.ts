import { KIT_STRANDS } from "../../../engine/strand-placement";

export type SkillStateName = "new" | "learning" | "practicing" | "mastered";

export type KitSkill = {
  id: string;
  strandId: string;
  level: number;
  name: string;
};

export type SkillRecent = {
  prompt: string;
  correct: boolean;
};

export type SkillProgress = {
  state: SkillStateName;
  days: { day: string; right: number; asked: number }[];
  recent: SkillRecent[];
  warmUp: boolean;
  sessionsSince: number;
};

export type SkillBook = {
  skills: Record<string, SkillProgress>;
  session: number;
  introduced: string | null;
  earned: string[];
  tally: Record<string, { right: number; asked: number }>;
};

const SMALL_PIECES = ["gussets", "bolts"];

export function isSmallPiece(groupId: string): boolean {
  return SMALL_PIECES.includes(groupId);
}

function band(level: number): string {
  if (level <= 2) return "small numbers";
  if (level <= 3) return "to 20";
  if (level <= 4) return "to 100";
  if (level <= 5) return "facts";
  if (level <= 6) return "remainders";
  if (level <= 7) return "fractions";
  if (level <= 8) return "percent";
  if (level <= 9) return "negatives";
  if (level <= 10) return "shapes";
  if (level <= 11) return "lines";
  return "curves";
}

function pair(strandId: string, level: number): string[] {
  if (strandId === "multiplying" && level === 4) {
    return ["Times tables to 5", "Times tables to 10", "Multiply by 10", "Two-digit times one-digit"];
  }
  const word = band(level);
  const names: Record<string, [string, string]> = {
    counting: [`Count ${word}`, `Compare ${word}`],
    measuring: [`Measure ${word}`, `Gaps ${word}`],
    adding: [`Add ${word}`, `Subtract ${word}`],
    multiplying: [`Multiply ${word}`, `Groups ${word}`],
    dividing: [`Divide ${word}`, `Share ${word}`],
    fractions: [`Fractions ${word}`, `Decimals ${word}`],
    ratios: [`Ratios ${word}`, `Percent ${word}`],
    geometry: [`Area ${word}`, `Triangles ${word}`],
    algebra: [`Equations ${word}`, `Lines ${word}`],
  };
  return names[strandId] ?? [`${strandId} ${word}`, `${strandId} ${word} again`];
}

export const KIT_SKILLS: KitSkill[] = KIT_STRANDS.flatMap((strandId) =>
  Array.from({ length: 13 }, (_, index) => {
    const level = index + 1;
    return pair(strandId, level).map((name, order) => ({
      id: `${strandId}-${level}-${order + 1}`,
      strandId,
      level,
      name,
    }));
  }).flat(),
);

export function skillById(id: string): KitSkill | undefined {
  return KIT_SKILLS.find((skill) => skill.id === id);
}

function blankProgress(state: SkillStateName): SkillProgress {
  return { state, days: [], recent: [], warmUp: false, sessionsSince: 0 };
}

/** Skills below the placed level start mastered. The placed level starts new. */
export function skillsFromLevels(levels: Record<string, number> | null): SkillBook {
  const skills: Record<string, SkillProgress> = {};
  for (const skill of KIT_SKILLS) {
    const placed = levels?.[skill.strandId] ?? 1;
    skills[skill.id] = blankProgress(skill.level < placed ? "mastered" : "new");
  }
  return { skills, session: 0, introduced: null, earned: [], tally: {} };
}

export function workingLevel(book: SkillBook, strandId: string, placed = 1): number {
  for (let level = 1; level <= 13; level += 1) {
    const at = KIT_SKILLS.filter((skill) => skill.strandId === strandId && skill.level === level);
    if (at.some((skill) => book.skills[skill.id]?.state !== "mastered")) {
      return level;
    }
  }
  return Math.min(13, Math.max(1, placed));
}

export function newSkill(book: SkillBook, strandId: string, level: number): KitSkill | null {
  return (
    KIT_SKILLS.find((skill) => skill.strandId === strandId && skill.level === level && book.skills[skill.id]?.state === "new") ??
    null
  );
}

export function currentSkill(book: SkillBook, strandId: string, level: number): KitSkill {
  const at = KIT_SKILLS.filter((skill) => skill.strandId === strandId && skill.level === level);
  const rank: SkillStateName[] = ["learning", "practicing", "new", "mastered"];
  for (const state of rank) {
    const found = at.find((skill) => book.skills[skill.id]?.state === state);
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

/** Five warm-up slots: missed skills first, then practicing skills that are due, with a mastered skill about 1 in 10. */
export function warmUpPlan(book: SkillBook): WarmSlot[] {
  const flagged = KIT_SKILLS.filter((skill) => book.skills[skill.id]?.warmUp);
  const practicing = KIT_SKILLS.filter((skill) => {
    const progress = book.skills[skill.id];
    return progress?.state === "practicing" && progress.sessionsSince >= dueEvery(skill.id);
  });
  const otherPractice = KIT_SKILLS.filter((skill) => book.skills[skill.id]?.state === "practicing" && !practicing.includes(skill));
  const mastered = KIT_SKILLS.filter((skill) => book.skills[skill.id]?.state === "mastered");
  const pool = [...flagged, ...practicing, ...otherPractice];
  const slots: WarmSlot[] = [];
  const used = new Set<string>();
  for (const skill of pool) {
    if (slots.length >= 5 || used.has(skill.id)) {
      continue;
    }
    used.add(skill.id);
    slots.push({ skillId: skill.id, strandId: skill.strandId, level: skill.level });
  }
  const includeMastered = book.session % 2 === 1 && mastered.length > 0;
  let fill = mastered.length > 0 ? mastered : KIT_SKILLS.filter((skill) => skill.level === 1);
  let cursor = 0;
  while (slots.length < 5 && fill.length > 0) {
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
  return slots.slice(0, 5);
}

export type RunSlot = { skillId: string; strandId: string; level: number; mixed: boolean };

/** 70% the piece's current skill, 30% other strands, never five of one strand in a row. */
export function runPlan(book: SkillBook, strandId: string, level: number, length: number, seed: number): RunSlot[] {
  const focus = currentSkill(book, strandId, level);
  const mixedCount = Math.max(1, Math.round(length * 0.3));
  const focusCount = Math.max(0, length - mixedCount);
  const others = mixPool(book, strandId);
  const pool = others.length > 0 ? others : KIT_SKILLS.filter((skill) => skill.strandId !== strandId).slice(0, 6);
  const mixedAt = new Set<number>();
  for (let index = 0; index < mixedCount; index += 1) {
    mixedAt.add(Math.min(length - 1, 3 + index * 3));
  }
  const slots: RunSlot[] = [];
  let streak = 0;
  let focusLeft = focusCount;
  let mixedLeft = mixedCount;
  for (let index = 0; index < length; index += 1) {
    const wantMix = mixedAt.has(index) || streak >= 4;
    if ((wantMix && mixedLeft > 0) || focusLeft === 0) {
      const other = pool[(seed + index) % pool.length] ?? focus;
      slots.push({ skillId: other.id, strandId: other.strandId, level: other.level, mixed: other.strandId !== strandId });
      mixedLeft -= 1;
      streak = 0;
      continue;
    }
    slots.push({ skillId: focus.id, strandId: focus.strandId, level: focus.level, mixed: false });
    focusLeft -= 1;
    streak += 1;
  }
  return breakStreak(slots, pool, strandId);
}

function mixPool(book: SkillBook, strandId: string): KitSkill[] {
  const pool = KIT_SKILLS.filter((skill) => {
    if (skill.strandId === strandId) {
      return false;
    }
    const state = book.skills[skill.id]?.state;
    return state === "learning" || state === "practicing";
  });
  if (pool.length > 0) {
    return pool;
  }
  return KIT_SKILLS.filter((skill) => skill.strandId !== strandId && book.skills[skill.id]?.state === "mastered").slice(0, 8);
}

function breakStreak(slots: RunSlot[], others: KitSkill[], strandId: string): RunSlot[] {
  const next = slots.slice();
  let streak = 0;
  let last = "";
  for (let index = 0; index < next.length; index += 1) {
    if (next[index].strandId === last) {
      streak += 1;
    } else {
      streak = 1;
      last = next[index].strandId;
    }
    if (streak >= 5 && others.length > 0) {
      const other = others[index % others.length];
      next[index] = { skillId: other.id, strandId: other.strandId, level: other.level, mixed: other.strandId !== strandId };
      streak = 1;
      last = other.strandId;
    }
  }
  return next;
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

export function rememberAnswer(book: SkillBook, skillId: string, prompt: string, correct: boolean): SkillBook {
  const progress = book.skills[skillId];
  if (!progress) {
    return book;
  }
  const recent = [...progress.recent, { prompt, correct }].slice(-10);
  const tally = book.tally[skillId] ?? { right: 0, asked: 0 };
  return {
    ...book,
    skills: {
      ...book.skills,
      [skillId]: { ...progress, recent, warmUp: correct ? progress.warmUp : true },
    },
    tally: { ...book.tally, [skillId]: { right: tally.right + (correct ? 1 : 0), asked: tally.asked + 1 } },
  };
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
            .map((entry) => ({ prompt: entry.prompt, correct: entry.correct === true }))
        : [],
      warmUp: item.warmUp === true,
      sessionsSince: typeof item.sessionsSince === "number" ? item.sessionsSince : 0,
    };
  }
  return {
    skills: base.skills,
    session: typeof record.session === "number" ? record.session : 0,
    introduced: typeof record.introduced === "string" ? record.introduced : null,
    earned: Array.isArray(record.earned) ? record.earned.filter((item): item is string => typeof item === "string") : [],
    tally: {},
  };
}
