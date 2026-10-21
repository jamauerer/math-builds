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
import { defaultUnitSystem, type UnitSystem } from "../units";
import { fitLevels, gradeStartLevels, strandName, type GradeChoice, type GradeSystem } from "../engine/strand-placement";
import { LADDER_VERSION } from "../ladder/steps";
import { countryByCode, defaultsForCountry } from "../locale/countries";
import type { EarnState } from "../machines/bridge/kits/earn";
import { queenPost } from "../machines/bridge/kits/kit";
import { sanitizeBook, skillsFromLevels, type SkillBook } from "../machines/bridge/kits/skills";

export type KitAttempt = {
  strandId: string;
  level: number;
  prompt: string;
  correct: boolean;
  help?: boolean;
};

export type KitProfile = {
  grade: GradeChoice | null;
  country?: string;
  gradeSystem?: GradeSystem;
  levels: Record<string, number>;
  history: KitAttempt[];
  notes: string[];
  lastRunMs?: number;
  skills?: SkillBook;
  seenIntro?: boolean;
  session?: EarnState;
  build?: { lengths: Record<string, string>; placed: Record<string, boolean> };
  built?: boolean;
  dunks?: number;
  kitVersion?: number;
  placedAt?: string;
  fastRuns?: Record<string, number>;
  ladderAt?: number;
  ladderSteps?: { adding: string; subtracting: string; multiplying?: string; dividing?: string };
  kitId?: "little" | "big";
  littleRounds?: number;
};

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
  units?: UnitSystem;
  kitProfile?: KitProfile;
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
    return { map, toppedOut: [], placement: null, history: [], age: null, ageAsked: false, bridgeCompleted: [], bridgeEarned: {}, workshop: sanitizeWorkshop(undefined), units: defaultUnitSystem(), kitProfile: blankKitProfile() };
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
    units?: unknown;
    kitProfile?: unknown;
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
    units: record.units === "us" || record.units === "metric" ? record.units : defaultUnitSystem(),
    kitProfile: sanitizeKitProfile(record.kitProfile),
  };
}

export function blankKitProfile(): KitProfile {
  return { grade: null, levels: {}, history: [], notes: [], kitVersion: queenPost.version };
}

export function needsLadderPlace(profile: KitProfile | null | undefined): boolean {
  if (!profile) {
    return false;
  }
  const placed = Boolean(profile.placedAt) || Object.keys(profile.levels).length > 0;
  return placed && profile.ladderAt !== LADDER_VERSION;
}

/** Grade 3 guest with placement skipped, for the public Try it path. */
export function guestKitProfile(day = new Date().toISOString().slice(0, 10)): KitProfile {
  const levels = gradeStartLevels(3, "us");
  return {
    grade: 3,
    country: "US",
    gradeSystem: "us",
    levels,
    history: [],
    notes: [],
    seenIntro: true,
    skills: skillsFromLevels(levels, day),
    placedAt: day,
    fastRuns: {},
    kitVersion: queenPost.version,
    ladderAt: LADDER_VERSION,
  };
}

export function profileGradeSystem(profile: KitProfile | null | undefined): GradeSystem {
  if (profile?.gradeSystem === "us" || profile?.gradeSystem === "europe") {
    return profile.gradeSystem;
  }
  if (profile?.country) {
    return defaultsForCountry(profile.country).gradeSystem;
  }
  return "us";
}

function sanitizeKitProfile(raw: unknown): KitProfile {
  const blank = blankKitProfile();
  if (!raw || typeof raw !== "object") {
    return blank;
  }
  const record = raw as Partial<KitProfile>;
  const grade = record.grade;
  const levels: Record<string, number> = {};
  if (record.levels && typeof record.levels === "object") {
    for (const [id, level] of Object.entries(record.levels)) {
      if (typeof level === "number" && level >= 1 && level <= 13) {
        levels[id] = level;
      }
    }
  }
  const history = Array.isArray(record.history)
    ? record.history.filter((item) => item && typeof item.prompt === "string" && typeof item.strandId === "string").map((item) => ({
        strandId: item.strandId,
        level: typeof item.level === "number" ? item.level : 1,
        prompt: item.prompt,
        correct: item.correct === true,
        help: item.help === true || undefined,
      }))
    : [];
  const notes = Array.isArray(record.notes) ? record.notes.filter((item): item is string => typeof item === "string") : [];
  const clamped = clampStoredLevels(levels, notes);
  const migrated = migrateKit(record, clamped.notes);
  const country = typeof record.country === "string" && countryByCode(record.country) ? record.country.toUpperCase() : undefined;
  const gradeSystem =
    record.gradeSystem === "us" || record.gradeSystem === "europe"
      ? record.gradeSystem
      : country
        ? defaultsForCountry(country).gradeSystem
        : undefined;
  return {
    grade: grade === "unsure" || (typeof grade === "number" && grade >= 0 && grade <= 13) ? grade : null,
    country,
    gradeSystem,
    levels: clamped.levels,
    history,
    notes: migrated.notes,
    kitVersion: queenPost.version,
    lastRunMs: typeof record.lastRunMs === "number" && record.lastRunMs >= 0 ? record.lastRunMs : undefined,
    skills: migrated.skills,
    seenIntro: record.seenIntro === true,
    session: migrated.session,
    build: migrated.build,
    built: migrated.built,
    dunks: typeof record.dunks === "number" && record.dunks >= 0 ? Math.floor(record.dunks) : 0,
    kitId: record.kitId === "big" ? "big" : record.kitId === "little" ? "little" : undefined,
    littleRounds: typeof record.littleRounds === "number" && record.littleRounds >= 0 ? Math.min(3, Math.floor(record.littleRounds)) : 0,
    placedAt: typeof record.placedAt === "string" ? record.placedAt : undefined,
    ladderAt: typeof record.ladderAt === "number" ? record.ladderAt : undefined,
    ladderSteps:
      record.ladderSteps && typeof record.ladderSteps === "object"
        ? {
            adding: String((record.ladderSteps as { adding?: unknown }).adding ?? ""),
            subtracting: String((record.ladderSteps as { subtracting?: unknown }).subtracting ?? ""),
            multiplying: (record.ladderSteps as { multiplying?: unknown }).multiplying
              ? String((record.ladderSteps as { multiplying?: unknown }).multiplying)
              : undefined,
            dividing: (record.ladderSteps as { dividing?: unknown }).dividing
              ? String((record.ladderSteps as { dividing?: unknown }).dividing)
              : undefined,
          }
        : undefined,
    fastRuns:
      record.fastRuns && typeof record.fastRuns === "object"
        ? Object.fromEntries(Object.entries(record.fastRuns).filter((entry): entry is [string, number] => typeof entry[1] === "number"))
        : undefined,
  };
}

/** Pull any stored strand that sits more than one above the lowest arithmetic strand. Once. */
export function clampStoredLevels(levels: Record<string, number>, notes: string[]): { levels: Record<string, number>; notes: string[] } {
  if (Object.keys(levels).length === 0) {
    return { levels, notes };
  }
  const fitted = fitLevels(levels);
  const pulled = Object.keys(levels).filter((id) => levels[id] > fitted[id]);
  if (pulled.length === 0) {
    return { levels, notes };
  }
  const line = pulled.map((id) => `${strandName(id)} pulled down to level ${fitted[id]}`).join(". ");
  const note = `${line}. That was more than one above the lowest arithmetic strand.`;
  const already = notes.some((item) => item.includes("pulled down to level"));
  return { levels: fitted, notes: already ? notes : [...notes, note] };
}

/** Drop a stored build that was saved before this kit file. */
function migrateKit(
  record: Partial<KitProfile>,
  notes: string[],
): { notes: string[]; skills: SkillBook | undefined; session: EarnState | undefined; build: KitProfile["build"]; built: boolean } {
  const skills = sanitizeBook(record.skills);
  const session = sanitizeSession(record.session);
  const build = sanitizeBuild(record.build);
  const built = record.built === true;
  const earned = skills?.earned.length ?? 0;
  const stale = record.kitVersion !== queenPost.version && (session != null || build != null || built || earned > 0);
  if (!stale) {
    return { notes, skills, session, build, built };
  }
  const cleared = skills ? { ...skills, earned: [], steps: 0 } : undefined;
  const note = "Cleared the old kit. This kit's rounds start over.";
  return {
    notes: notes.some((item) => item === note) ? notes : [...notes, note],
    skills: cleared,
    session: undefined,
    build: undefined,
    built: false,
  };
}

function sanitizeSession(raw: unknown): EarnState | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }
  const record = raw as EarnState;
  const phases = ["warmup", "learn", "guided", "plain", "word", "explain", "practice"];
  if (!phases.includes(record.phase) || !record.current || typeof record.current.answer !== "string" || !Array.isArray(record.earned)) {
    return undefined;
  }
  const book = sanitizeBook(record.book);
  if (!book) {
    return undefined;
  }
  return {
    ...record,
    book,
    earned: record.earned.filter((item) => typeof item === "string"),
    round: typeof record.round === "number" && record.round >= 0 ? record.round : 0,
    short: record.short === true,
    grade: record.grade === "unsure" || typeof record.grade === "number" ? record.grade : 13,
  };
}

function sanitizeBuild(raw: unknown): KitProfile["build"] {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }
  const record = raw as { lengths?: unknown; placed?: unknown };
  const lengths: Record<string, string> = {};
  const placed: Record<string, boolean> = {};
  if (record.lengths && typeof record.lengths === "object") {
    for (const [id, value] of Object.entries(record.lengths)) {
      if (typeof value === "string" && value.trim()) {
        lengths[id] = value;
      }
    }
  }
  if (record.placed && typeof record.placed === "object") {
    for (const [id, value] of Object.entries(record.placed)) {
      if (value === true) {
        placed[id] = true;
      }
    }
  }
  return { lengths, placed };
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
        const parsed = JSON.parse(raw) as { kitProfile?: { levels?: Record<string, number>; notes?: string[] } };
        const stored = sanitizeProgress(skills, parsed);
        const rawLevels = JSON.stringify(parsed.kitProfile?.levels ?? {});
        const rawNotes = JSON.stringify(parsed.kitProfile?.notes ?? []);
        if (rawLevels !== JSON.stringify(stored.kitProfile?.levels ?? {}) || rawNotes !== JSON.stringify(stored.kitProfile?.notes ?? [])) {
          storage.setItem(STORAGE_KEY, JSON.stringify(stored));
        }
        return stored;
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
