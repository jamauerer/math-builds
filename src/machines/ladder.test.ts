import { describe, expect, it } from "vitest";
import bridge from "./bridge/ladder.json";
import { gearMachine } from "./gears/definition";
import gears from "./gears/ladder.json";
import { bucketRise, crankForce, gearModel, meshes } from "./gears/model";
import lever from "./lever/ladder.json";
import { referenceDesign } from "./loop";

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

  it("rejects a wrong gear center distance and grades the winch from circumference and load", () => {
    expect(meshes(12, 36, (12 + 36) / 2)).toBe(true);
    expect(meshes(12, 36, 20)).toBe(false);
    expect(bucketRise(3, 3)).toBe(1);
    expect(crankForce(20, 3)).toBeCloseTo(20 / 3);
    const winch = gearMachine.challenges.find((item) => item.id === "gears-l04-a");
    expect(winch?.output).toBe("bucket");
    const report = gearModel.evaluate(referenceDesign(winch!), winch!.scene);
    expect(report.ok).toBe(true);
    expect(report.numbers.some((item) => item.label === "Bucket height per crank" && item.value.startsWith("1"))).toBe(true);
    expect(report.assumptions.some((item) => item.text.includes("ideal"))).toBe(true);
    const wrong = gearModel.evaluate(
      [{ id: "part", kind: "gear", spec: 24, slot: "main" }],
      winch!.scene,
    );
    expect(wrong.ok).toBe(false);
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
