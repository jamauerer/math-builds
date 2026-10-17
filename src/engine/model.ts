/** A placed piece. `spec` is the number the learner committed, right or wrong. */
export type DesignPart = {
  id: string;
  kind: string;
  spec: number;
  slot: string;
};

export type SceneNumbers = Record<string, number>;

export type Assumption = { text: string };

export type ModelNumber = { label: string; value: string };

export type ModelFailure = {
  partId: string;
  text: string;
  followUp: string;
};

export type ModelReport = {
  ok: boolean;
  failures: ModelFailure[];
  numbers: ModelNumber[];
  assumptions: Assumption[];
};

export type SettleReport = { ok: boolean; text: string };

export type SimBody = {
  id: string;
  x: number;
  y: number;
  angle: number;
  w: number;
  h: number;
  fill: string;
};

export type SimFrame = { bodies: SimBody[] };

/**
 * Each machine implements this on top of rigid bodies.
 * The report, not the rigid-body world alone, decides that a design is sound.
 */
export type EngineeringModel = {
  id: string;
  assumptions: Assumption[];
  evaluate: (design: readonly DesignPart[], scene: SceneNumbers) => ModelReport;
  settle: (design: readonly DesignPart[], scene: SceneNumbers) => SettleReport;
  simulate: (design: readonly DesignPart[], scene: SceneNumbers) => SimFrame[];
};

export function sameSpec(left: number, right: number): boolean {
  return Math.abs(left - right) < 0.001;
}
