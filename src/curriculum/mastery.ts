import type { LearnerMap } from "../engine/placement";

export const RECALL_DELAY_MS = 24 * 60 * 60 * 1000;

export type SkillNeed = { skillId: string; level: number };

export type MasteryRecord = {
  challengeDone: boolean;
  transferPassed: boolean;
  recallAt: number | null;
  recallPassed: boolean;
};

export function emptyMastery(): MasteryRecord {
  return { challengeDone: false, transferPassed: false, recallAt: null, recallPassed: false };
}

/** Age never changes this. A need of level 0 is open before any pass. */
export function skillsMet(needs: readonly SkillNeed[], map: LearnerMap, _age: number | null = null): boolean {
  return needs.every((need) => (map[need.skillId]?.level ?? 0) >= need.level);
}

export function masteryMet(record: MasteryRecord): boolean {
  return record.challengeDone && record.transferPassed && record.recallPassed;
}

export function queueRecall(now: number): number {
  return now + RECALL_DELAY_MS;
}

export function recallReady(record: MasteryRecord, now: number): boolean {
  return record.recallAt != null && now >= record.recallAt && !record.recallPassed;
}

export type StrandMastery = {
  id: string;
  name: string;
  skills: number;
  averageLevel: number;
  mastered: number;
};

export function strandSummary(
  strands: readonly { id: string; name: string; skills: readonly string[] }[],
  map: LearnerMap,
  records: Record<string, MasteryRecord>,
): StrandMastery[] {
  return strands.map((strand) => {
    const levels = strand.skills.map((id) => map[id]?.level ?? 0);
    const average = levels.length === 0 ? 0 : levels.reduce((sum, level) => sum + level, 0) / levels.length;
    const mastered = strand.skills.filter((id) => masteryMet(records[id] ?? emptyMastery())).length;
    return { id: strand.id, name: strand.name, skills: strand.skills.length, averageLevel: average, mastered };
  });
}
