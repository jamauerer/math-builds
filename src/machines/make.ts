import type { HintRung } from "../curriculum/hints";
import type { SceneNumbers } from "../engine/model";
import type { Challenge } from "./types";

export type Seed = {
  id: string;
  machine: string;
  family: string;
  title: string;
  skillId: string;
  level: number;
  scene: SceneNumbers;
  stages: string[];
  measure: string;
  measureAnswer: number;
  part: string;
  partAnswer: number;
  partKind: string;
  predict: string;
  predictAnswer: number;
  decoy: number;
  creative: { kind: string; spec: number } | null;
  spare: boolean;
  mission?: string;
  output?: string;
  ladderLevel?: number;
  job?: string;
};

function hints(answer: number): HintRung {
  const practice = answer + 7;
  return [
    "Read the number off the scene.",
    "Write the relationship, then compute it.",
    `A practice problem used ${practice}. Do the same steps with the numbers on this screen.`,
  ];
}

export function makeChallenge(seed: Seed): Challenge {
  return {
    id: seed.id,
    machine: seed.machine,
    family: seed.family,
    title: seed.title,
    skills: [{ skillId: seed.skillId, level: seed.level }],
    scene: seed.scene,
    stages: seed.stages,
    questions: [
      {
        id: `${seed.id}-measure`,
        kind: "measure",
        prompt: seed.measure,
        answer: seed.measureAnswer,
        hints: hints(seed.measureAnswer),
      },
      {
        id: `${seed.id}-part`,
        kind: "part",
        prompt: seed.part,
        answer: seed.partAnswer,
        produces: seed.partKind,
        hints: hints(seed.partAnswer),
      },
      {
        id: `${seed.id}-predict`,
        kind: "predict",
        prompt: seed.predict,
        answer: seed.predictAnswer,
        hints: hints(seed.predictAnswer),
      },
    ],
    decoy: { kind: seed.partKind, spec: seed.decoy },
    creative: seed.creative,
    spare: seed.spare,
    mission: seed.mission,
    output: seed.output,
    ladderLevel: seed.ladderLevel,
    job: seed.job,
  };
}
