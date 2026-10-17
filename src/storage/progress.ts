import { judgeState, HISTORY_LIMIT, type LearnerMap, type SkillStateName } from "../engine/placement";
import type { Skill } from "../engine/types";

const STORAGE_KEY = "math-builds.progress.v1";

export type KeyValueStore = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

export type ProgressStore = {
  load: () => LearnerMap | null;
  save: (map: LearnerMap) => void;
};

export function sanitizeMap(skills: readonly Skill[], raw: unknown): LearnerMap {
  const map: LearnerMap = {};
  for (const skill of skills) {
    map[skill.id] = { state: "unknown", recent: [] };
  }
  if (!raw || typeof raw !== "object") {
    return map;
  }
  const record = raw as Record<string, unknown>;
  for (const skill of skills) {
    const entry = record[skill.id];
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const recentValue = (entry as { recent?: unknown }).recent;
    if (!Array.isArray(recentValue)) {
      continue;
    }
    const recent = recentValue
      .filter((item): item is boolean => typeof item === "boolean")
      .slice(-HISTORY_LIMIT);
    if (recent.length !== recentValue.length) {
      continue;
    }
    map[skill.id] = { recent, state: judgeState(recent) };
  }
  return map;
}

export function createProgressStore(
  skills: readonly Skill[],
  storage: KeyValueStore,
): ProgressStore {
  return {
    load() {
      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) {
        return null;
      }
      try {
        return sanitizeMap(skills, JSON.parse(raw) as unknown);
      } catch {
        return null;
      }
    },
    save(map) {
      const stored: Record<string, { state: SkillStateName; recent: boolean[] }> = {};
      for (const skill of skills) {
        stored[skill.id] = map[skill.id] ?? { state: "unknown", recent: [] };
      }
      storage.setItem(STORAGE_KEY, JSON.stringify(stored));
    },
  };
}

export function browserProgressStore(skills: readonly Skill[]): ProgressStore {
  return createProgressStore(skills, localStorage);
}
