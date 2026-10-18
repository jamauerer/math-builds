import {
  labelForLevel,
  type AttemptRecord,
  type AttemptVerdict,
  type LearnerMap,
  type PlacementSnapshot,
  type Probe,
  type QuizPhase,
} from "../engine/placement";
import { emptyScribble, type Scribble, type ScribbleStroke } from "../engine/scribble";
import type { MasteryRecord } from "../curriculum/mastery";
import type { Problem, Skill } from "../engine/types";
import { blankSequence, type CodexPage, type SequenceSave } from "../sequence/logic";

const STORAGE_KEY = "math-builds.progress.v3";

export type KeyValueStore = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

export type SavedProgress = {
  map: LearnerMap;
  toppedOut: string[];
  placement: PlacementSnapshot | null;
  history: AttemptRecord[];
  age: number | null;
  ageAsked: boolean;
  bridgeCompleted: string[];
  bridgeEarned: Record<string, Record<string, number>>;
  workshop?: WorkshopSave;
  sequence?: SequenceSave;
};

export type GalleryShot = {
  id: string;
  machine: string;
  challengeId: string;
  title: string;
  image: string;
  at: number;
};

export type SavedBadge = {
  id: string;
  title: string;
  machine: string;
  snapshotId: string;
  at: number;
};

export type WorkshopSave = {
  completed: string[];
  mastery: Record<string, MasteryRecord>;
  sandbox: string[];
  theme: "draft" | "candy" | "wood" | "steel";
  stars: Record<string, string[]>;
  badges: SavedBadge[];
  snapshots: GalleryShot[];
  prizes: string[];
  equipped: string;
  sound: boolean;
  haptic: boolean;
  weekly: Record<string, string>;
};

export function blankWorkshop(): WorkshopSave {
  return {
    completed: [],
    mastery: {},
    sandbox: [],
    theme: "draft",
    stars: {},
    badges: [],
    snapshots: [],
    prizes: [],
    equipped: "",
    sound: false,
    haptic: false,
    weekly: {},
  };
}

export type ProgressStore = {
  load: () => SavedProgress | null;
  save: (progress: SavedProgress) => void;
};

function blank(skills: readonly Skill[]): LearnerMap {
  const map: LearnerMap = {};
  for (const skill of skills) {
    map[skill.id] = { level: 0, state: "unchecked" };
  }
  return map;
}

export function sanitizeProgress(skills: readonly Skill[], raw: unknown): SavedProgress {
  const map = blank(skills);
  if (!raw || typeof raw !== "object") {
    return { map, toppedOut: [], placement: null, history: [], age: null, ageAsked: false, bridgeCompleted: [], bridgeEarned: {}, workshop: sanitizeWorkshop(undefined) };
  }
  const record = raw as {
    map?: unknown;
    toppedOut?: unknown;
    placement?: unknown;
    history?: unknown;
    age?: unknown;
    ageAsked?: unknown;
    bridgeCompleted?: unknown;
    bridgeEarned?: unknown;
    workshop?: unknown;
    sequence?: unknown;
  };
  const source = record.map && typeof record.map === "object" ? (record.map as Record<string, unknown>) : {};
  for (const skill of skills) {
    const entry = source[skill.id];
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const state = (entry as { state?: unknown }).state;
    if (state === "unchecked") {
      map[skill.id] = { level: 0, state: "unchecked" };
      continue;
    }
    const level = (entry as { level?: unknown }).level;
    if (typeof level !== "number" || !Number.isInteger(level) || level < 0 || level > 5) {
      continue;
    }
    map[skill.id] = { level, state: labelForLevel(level) };
  }
  const toppedOut = Array.isArray(record.toppedOut)
    ? record.toppedOut.filter((item): item is string => typeof item === "string")
    : [];
  const age = record.age;
  const bridgeCompleted = Array.isArray(record.bridgeCompleted)
    ? record.bridgeCompleted.filter((item): item is string => typeof item === "string")
    : [];
  return {
    map,
    toppedOut,
    placement: sanitizePlacement(skills, record.placement),
    history: sanitizeHistory(record.history),
    age: typeof age === "number" && Number.isInteger(age) && age >= 5 && age <= 18 ? age : null,
    ageAsked: record.ageAsked === true || (typeof age === "number" && Number.isInteger(age)),
    bridgeCompleted,
    bridgeEarned: sanitizeEarned(record.bridgeEarned),
    workshop: sanitizeWorkshop(record.workshop),
    sequence: sanitizeSequence(record.sequence),
  };
}

function sanitizeSequence(raw: unknown): SequenceSave {
  const blank = blankSequence();
  if (!raw || typeof raw !== "object") {
    return blank;
  }
  const record = raw as Partial<SequenceSave>;
  const codex: CodexPage[] = [];
  if (Array.isArray(record.codex)) {
    for (const item of record.codex) {
      if (!item || typeof item !== "object") {
        continue;
      }
      const page = item as CodexPage;
      if (typeof page.handwriting !== "string" || typeof page.image !== "string" || !page.results) {
        continue;
      }
      codex.push({
        id: typeof page.id === "string" ? page.id : "page",
        title: typeof page.title === "string" ? page.title : "Bridge",
        image: page.image,
        handwriting: page.handwriting,
        gap: typeof page.gap === "number" ? page.gap : 0,
        bearing: typeof page.bearing === "number" ? page.bearing : 0,
        loadKg: typeof page.loadKg === "number" ? page.loadKg : 0,
        budget: typeof page.budget === "number" ? page.budget : 0,
        beamLength: typeof page.beamLength === "number" ? page.beamLength : 0,
        materials: Array.isArray(page.materials) ? page.materials.filter((entry) => typeof entry === "string") : [],
        alternatives: Array.isArray(page.alternatives) ? page.alternatives.filter((entry) => typeof entry === "string") : [],
        changes: Array.isArray(page.changes) ? page.changes.filter((entry) => typeof entry === "string") : [],
        results: {
          designWorked: page.results.designWorked === true,
          mathUse: page.results.mathUse === "assisted" || page.results.mathUse === "corrected" ? page.results.mathUse : "independent",
          explained: page.results.explained === true,
        },
        reflection: typeof page.reflection === "string" ? page.reflection : "",
        next: typeof page.next === "string" ? page.next : "",
        disclaimer: typeof page.disclaimer === "string" ? page.disclaimer : blankSequence().codex[0]?.disclaimer ?? "",
      });
    }
  }
  return {
    narration: record.narration !== false,
    completedTiers: Array.isArray(record.completedTiers) ? record.completedTiers.filter((item): item is string => typeof item === "string") : [],
    marks: typeof record.marks === "number" ? record.marks : 0,
    codex,
  };
}

function sanitizeWorkshop(raw: unknown): WorkshopSave {
  const blank = blankWorkshop();
  if (!raw || typeof raw !== "object") {
    return blank;
  }
  const record = raw as Partial<WorkshopSave>;
  const theme =
    record.theme === "candy" || record.theme === "wood" || record.theme === "steel" || record.theme === "draft"
      ? record.theme
      : "draft";
  const mastery: Record<string, MasteryRecord> = {};
  if (record.mastery && typeof record.mastery === "object") {
    for (const [id, entry] of Object.entries(record.mastery)) {
      if (!entry || typeof entry !== "object") {
        continue;
      }
      mastery[id] = {
        challengeDone: entry.challengeDone === true,
        transferPassed: entry.transferPassed === true,
        recallAt: typeof entry.recallAt === "number" ? entry.recallAt : null,
        recallPassed: entry.recallPassed === true,
      };
    }
  }
  const stars: Record<string, string[]> = {};
  if (record.stars && typeof record.stars === "object") {
    for (const [id, names] of Object.entries(record.stars)) {
      if (Array.isArray(names)) {
        stars[id] = names.filter((name): name is string => typeof name === "string");
      }
    }
  }
  const badges: WorkshopSave["badges"] = Array.isArray(record.badges)
    ? record.badges.filter((badge): badge is WorkshopSave["badges"][number] => {
        return Boolean(badge) && typeof badge.id === "string" && typeof badge.title === "string" && typeof badge.machine === "string";
      }).map((badge) => ({
        id: badge.id,
        title: badge.title,
        machine: badge.machine,
        snapshotId: typeof badge.snapshotId === "string" ? badge.snapshotId : "",
        at: typeof badge.at === "number" ? badge.at : 0,
      }))
    : [];
  const snapshots: WorkshopSave["snapshots"] = Array.isArray(record.snapshots)
    ? record.snapshots.filter((shot): shot is WorkshopSave["snapshots"][number] => {
        return Boolean(shot) && typeof shot.id === "string" && typeof shot.image === "string" && typeof shot.machine === "string";
      }).map((shot) => ({
        id: shot.id,
        machine: shot.machine,
        challengeId: typeof shot.challengeId === "string" ? shot.challengeId : "",
        title: typeof shot.title === "string" ? shot.title : shot.machine,
        image: shot.image,
        at: typeof shot.at === "number" ? shot.at : 0,
      }))
    : [];
  return {
    completed: Array.isArray(record.completed) ? record.completed.filter((item): item is string => typeof item === "string") : [],
    mastery,
    sandbox: Array.isArray(record.sandbox) ? record.sandbox.filter((item): item is string => typeof item === "string") : [],
    theme,
    stars,
    badges,
    snapshots,
    prizes: Array.isArray(record.prizes) ? record.prizes.filter((item): item is string => typeof item === "string") : [],
    equipped: typeof record.equipped === "string" ? record.equipped : "",
    sound: record.sound === true,
    haptic: record.haptic === true,
    weekly: record.weekly && typeof record.weekly === "object"
      ? Object.fromEntries(Object.entries(record.weekly).filter((entry): entry is [string, string] => typeof entry[1] === "string"))
      : {},
  };
}

function sanitizeEarned(raw: unknown): Record<string, Record<string, number>> {
  if (!raw || typeof raw !== "object") {
    return {};
  }
  const earned: Record<string, Record<string, number>> = {};
  for (const [levelId, parts] of Object.entries(raw as Record<string, unknown>)) {
    if (!parts || typeof parts !== "object") {
      continue;
    }
    const counts: Record<string, number> = {};
    for (const [partId, count] of Object.entries(parts as Record<string, unknown>)) {
      if (typeof count === "number" && Number.isFinite(count) && count >= 0) {
        counts[partId] = count;
      }
    }
    earned[levelId] = counts;
  }
  return earned;
}

function sanitizeHistory(raw: unknown): AttemptRecord[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const history: AttemptRecord[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const entry = item as Partial<AttemptRecord>;
    const verdict: AttemptVerdict | null =
      entry.verdict === "right" || entry.verdict === "wrong" || entry.verdict === "skip" ? entry.verdict : null;
    if (
      !verdict ||
      typeof entry.skillId !== "string" ||
      typeof entry.skillName !== "string" ||
      typeof entry.prompt !== "string" ||
      typeof entry.answer !== "string" ||
      typeof entry.level !== "number"
    ) {
      continue;
    }
    history.push({
      skillId: entry.skillId,
      skillName: entry.skillName,
      level: entry.level,
      prompt: entry.prompt,
      given: typeof entry.given === "string" ? entry.given : "",
      answer: entry.answer,
      verdict,
      scribble: typeof entry.scribble === "string" ? entry.scribble : "",
    });
  }
  return history;
}

function sanitizePlacement(skills: readonly Skill[], raw: unknown): PlacementSnapshot | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const entry = raw as Partial<PlacementSnapshot>;
  const phase: QuizPhase | null =
    entry.phase === "answering" || entry.phase === "feedback" ? entry.phase : null;
  if (!phase || typeof entry.skillId !== "string" || !skills.some((skill) => skill.id === entry.skillId)) {
    return null;
  }
  if (!entry.problem || typeof entry.problem.prompt !== "string" || typeof entry.problem.answer !== "string") {
    return null;
  }
  if (typeof entry.rngState !== "number" || !Number.isInteger(entry.rngState)) {
    return null;
  }
  if (typeof entry.level !== "number" || entry.level < 1 || entry.level > 5) {
    return null;
  }
  const probe = sanitizeProbe(entry.probe);
  if (!probe || probe.skillId !== entry.skillId) {
    return null;
  }
  const map = sanitizeProgress(skills, { map: entry.map, toppedOut: entry.toppedOut }).map;
  return {
    map,
    toppedOut: Array.isArray(entry.toppedOut)
      ? entry.toppedOut.filter((item): item is string => typeof item === "string")
      : [],
    phase,
    probe,
    problem: entry.problem as Problem,
    skillId: entry.skillId,
    level: entry.level,
    questionNumber: typeof entry.questionNumber === "number" ? entry.questionNumber : 0,
    correct: typeof entry.correct === "boolean" ? entry.correct : null,
    skipped: entry.skipped === true,
    rngState: entry.rngState,
    history: sanitizeHistory(entry.history),
    scribble: sanitizeScribble(entry.scribble),
  };
}

function sanitizeScribble(raw: unknown): Scribble {
  if (!raw || typeof raw !== "object" || !Array.isArray((raw as { strokes?: unknown }).strokes)) {
    return emptyScribble();
  }
  const strokes: ScribbleStroke[] = [];
  for (const item of (raw as { strokes: unknown[] }).strokes) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const stroke = item as Partial<ScribbleStroke>;
    if (typeof stroke.color !== "string" || !Array.isArray(stroke.points)) {
      continue;
    }
    const points = stroke.points.filter(
      (point) => point && typeof point.x === "number" && typeof point.y === "number",
    );
    strokes.push({
      color: stroke.color,
      size: typeof stroke.size === "number" ? stroke.size : 3,
      eraser: stroke.eraser === true,
      points,
    });
  }
  return { strokes };
}

function sanitizeProbe(raw: unknown): Probe | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const probe = raw as Partial<Probe>;
  if (typeof probe.skillId !== "string") {
    return null;
  }
  if (typeof probe.level !== "number" || probe.level < 1 || probe.level > 5) {
    return null;
  }
  if (typeof probe.passed !== "number" || probe.passed < 0 || probe.passed > 5) {
    return null;
  }
  if (typeof probe.asked !== "number" || probe.asked < 0 || probe.asked > 3) {
    return null;
  }
  return { skillId: probe.skillId, level: probe.level, passed: probe.passed, asked: probe.asked };
}

export function createProgressStore(skills: readonly Skill[], storage: KeyValueStore): ProgressStore {
  return {
    load() {
      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) {
        return null;
      }
      try {
        return sanitizeProgress(skills, JSON.parse(raw) as unknown);
      } catch {
        return null;
      }
    },
    save(progress) {
      const stored = sanitizeProgress(skills, progress);
      storage.setItem(STORAGE_KEY, JSON.stringify(stored));
    },
  };
}

export function browserProgressStore(skills: readonly Skill[]): ProgressStore {
  return createProgressStore(skills, localStorage);
}
