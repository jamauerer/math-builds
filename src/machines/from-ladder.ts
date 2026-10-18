import type { Challenge } from "./types";
import { makeChallenge, type Seed } from "./make";

export type LadderChallenge = {
  id: string;
  title: string;
  skillId: string;
  level: number;
  scene: Record<string, number>;
  measure: string;
  measureAnswer: number;
  part: string;
  partAnswer: number;
  predict: string;
  predictAnswer: number;
  decoy: number;
  output: string;
};

export type LadderFile = {
  machine: string;
  levels: {
    level: number;
    name: string;
    job: string;
    mission: string;
    output: string;
    family: string;
    sceneId: string;
    challenges: LadderChallenge[];
  }[];
};

export function challengesFromLadder(file: LadderFile, partKind: string, stages: string[]): Challenge[] {
  const firstFamily = new Set<string>();
  const challenges: Challenge[] = [];
  for (const level of file.levels) {
    for (const item of level.challenges) {
      const spare = !firstFamily.has(level.family);
      firstFamily.add(level.family);
      const seed: Seed = {
        id: item.id,
        machine: file.machine,
        family: level.family,
        title: item.title,
        skillId: item.skillId,
        level: item.level,
        scene: item.scene,
        stages,
        measure: item.measure,
        measureAnswer: item.measureAnswer,
        part: item.part,
        partAnswer: item.partAnswer,
        partKind: item.scene.ask === 3 && file.machine === "gears" ? "torque" : partKind,
        predict: item.predict,
        predictAnswer: item.predictAnswer,
        decoy: item.decoy,
        creative: null,
        spare,
        mission: level.mission,
        output: item.output,
        ladderLevel: level.level,
        job: level.job,
      };
      challenges.push(makeChallenge(seed));
    }
  }
  return challenges;
}
