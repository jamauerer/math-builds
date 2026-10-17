import type { SceneNumbers } from "../engine/model";
import type { HintRung } from "../curriculum/hints";
import type { SkillNeed } from "../curriculum/mastery";

export type MachineQuestion = {
  id: string;
  kind: "measure" | "part" | "predict";
  prompt: string;
  answer: number;
  produces?: string;
  hints: HintRung;
};

export type Challenge = {
  id: string;
  machine: string;
  family: string;
  title: string;
  skills: SkillNeed[];
  scene: SceneNumbers;
  stages: string[];
  questions: MachineQuestion[];
  decoy: { kind: string; spec: number };
  creative: { kind: string; spec: number } | null;
  /** First challenge in a family keeps a correct spare in the tray. */
  spare: boolean;
};

export type MachineDefinition = {
  id: string;
  name: string;
  summary: string;
  challenges: Challenge[];
};
