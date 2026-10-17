import { labelForLevel, type LearnerMap } from "../engine/placement";
import type { Skill } from "../engine/types";

const STORAGE_KEY = "math-builds.progress.v2";

export type KeyValueStore = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

export type SavedProgress = {
  map: LearnerMap;
  toppedOut: string[];
};

export type ProgressStore = {
  load: () => SavedProgress | null;
  save: (progress: SavedProgress) => void;
};

function blank(skills: readonly Skill[]): LearnerMap {
  const map: LearnerMap = {};
  for (const skill of skills) {
    map[skill.id] = { level: 0, state: "unknown" };
  }
  return map;
}

export function sanitizeProgress(skills: readonly Skill[], raw: unknown): SavedProgress {
  const map = blank(skills);
  if (!raw || typeof raw !== "object") {
    return { map, toppedOut: [] };
  }
  const record = raw as { map?: unknown; toppedOut?: unknown };
  const source = record.map && typeof record.map === "object" ? (record.map as Record<string, unknown>) : {};
  for (const skill of skills) {
    const entry = source[skill.id];
    if (!entry || typeof entry !== "object") {
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
  return { map, toppedOut };
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
