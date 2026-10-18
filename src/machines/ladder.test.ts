import { describe, expect, it } from "vitest";
import bridge from "./bridge/ladder.json";
import gears from "./gears/ladder.json";
import lever from "./lever/ladder.json";

type Dials = {
  numbers: number;
  representation: number;
  given: number;
  freedom: number;
  precision: number;
};

type LadderChallenge = {
  id: string;
  predict: string;
  predictAnswer: number;
  output: string;
  measureAnswer: number;
  partAnswer: number;
  scene: Record<string, number>;
};

type LadderFile = {
  machine: string;
  levels: {
    level: number;
    output: string;
    mission: string;
    dials: Dials;
    challenges: LadderChallenge[];
  }[];
};

const files = [gears, bridge, lever] as LadderFile[];
const dialKeys: (keyof Dials)[] = ["numbers", "representation", "given", "freedom", "precision"];

describe("machine ladders", () => {
  it("gives every machine 13 levels, 3 challenges, an output, and a predict question", () => {
    for (const file of files) {
      expect(file.levels).toHaveLength(13);
      for (const level of file.levels) {
        expect(level.challenges.length).toBeGreaterThanOrEqual(3);
        expect(level.output.length).toBeGreaterThan(0);
        expect(level.mission.length).toBeGreaterThan(0);
        const signatures = new Set<string>();
        for (const challenge of level.challenges) {
          expect(challenge.output.length).toBeGreaterThan(0);
          expect(challenge.predict.length).toBeGreaterThan(0);
          expect(Number.isFinite(challenge.predictAnswer)).toBe(true);
          signatures.add(`${challenge.measureAnswer}|${challenge.partAnswer}|${JSON.stringify(challenge.scene)}`);
        }
        expect(signatures.size).toBe(level.challenges.length);
      }
    }
  });

  it("keeps dial values from falling as the ladder climbs", () => {
    for (const file of files) {
      for (let index = 1; index < file.levels.length; index += 1) {
        const previous = file.levels[index - 1].dials;
        const current = file.levels[index].dials;
        for (const key of dialKeys) {
          expect(current[key]).toBeGreaterThanOrEqual(previous[key]);
        }
      }
    }
  });
});
