import type { Skill } from "../engine/types";
import { sanitizeProgress, type SavedProgress } from "../storage/progress";

export function exportProgress(progress: SavedProgress): string {
  return JSON.stringify(progress, null, 2);
}

export function importProgress(raw: string, skillList: readonly Skill[]): SavedProgress {
  return sanitizeProgress(skillList, JSON.parse(raw) as unknown);
}
