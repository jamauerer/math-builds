import { describe, expect, it } from "vitest";
import type { EngineeringModel } from "../engine/model";
import { nextDrivePhase } from "../engine/bridge/place";
import { createLearnerMap, recordLevelPass } from "../engine/placement";
import { skills } from "../data/load-skills";
import { skillsMet } from "../curriculum/mastery";
import { bridgeMachine } from "./bridge/definition";
import { archThrust, bridgeModel, hangerDrop, sag, trussForces } from "./bridge/model";
import { gearMachine } from "./gears/definition";
import { compoundRatio, directionSign, gearModel, gearRadius, meshes } from "./gears/model";
import { leverMachine } from "./lever/definition";
import { effortFor, leverModel, moment } from "./lever/model";
import { craftStars, numbersMatch, predictsChecked, referenceDesign, returnFailed, specFromAnswer, stockAllows, wrongDesign } from "./loop";
import type { Challenge } from "./types";

const machines: { challenges: Challenge[]; model: EngineeringModel }[] = [
  { challenges: bridgeMachine.challenges, model: bridgeModel },
  { challenges: leverMachine.challenges, model: leverModel },
  { challenges: gearMachine.challenges, model: gearModel },
];

describe("every challenge", () => {
  for (const machine of machines) {
    for (const challenge of machine.challenges) {
      it(`${challenge.id} is solvable, graded, and predictable`, () => {
        const reference = referenceDesign(challenge);
        const right = machine.model.evaluate(reference, challenge.scene);
        const wrong = machine.model.evaluate(wrongDesign(challenge), challenge.scene);
        const limit = machine.model.evaluate(reference, challenge.scene);
        expect(right.ok, right.failures.map((item) => item.text).join(" ")).toBe(true);
        expect(wrong.ok).toBe(false);
        expect(wrong.failures[0]?.text.length).toBeGreaterThan(0);
        expect(limit.ok).toBe(true);
        expect(stockAllows(challenge)).toBe(true);
        const part = challenge.questions.find((question) => question.kind === "part");
        expect(part).toBeTruthy();
        expect(specFromAnswer(String(part?.answer))).toBe(part?.answer);
        expect(returnFailed(reference).placed).toEqual([]);
        expect(returnFailed(reference).tray).toEqual(reference);
        expect(predictsChecked(challenge.questions, {})).toBe(false);
        const attempts: Record<string, boolean> = {};
        for (const question of challenge.questions) {
          if (question.kind === "predict") {
            attempts[question.id] = true;
          }
        }
        expect(predictsChecked(challenge.questions, attempts)).toBe(true);
        expect(challenge.questions.some((question) => question.kind === "predict")).toBe(true);
        expect(numbersMatch(String(part?.answer), part?.answer ?? 0)).toBe(true);
      });
    }
  }
});

describe("bridge model", () => {
  it("grows sag with span cubed and shrinks it with depth cubed", () => {
    const base = sag(10, 1, 1, 100);
    expect(sag(10, 2, 1, 100) / base).toBeCloseTo(8);
    expect(sag(10, 1, 2, 100) / base).toBeCloseTo(1 / 8);
  });

  it("puts the tie in tension and the rafters in compression", () => {
    const forces = trussForces(12, 6, 2);
    expect(forces.tie).toBeGreaterThan(0);
    expect(forces.rafter).toBeGreaterThan(0);
    expect(archThrust(12, 8, 3)).toBeCloseTo(8);
    expect(hangerDrop(4, 8, 4)).toBeCloseTo(4);
  });

  it("drops a short beam in the planck scene", () => {
    const frames = bridgeModel.simulate(
      [{ id: "beam", kind: "beam", spec: 2, slot: "main" }],
      { ask: 1, gap: 4, bearing: 0, load: 4, stick: 20, stiffness: 8000, depth: 1 },
    );
    const first = frames[0].bodies.find((body) => body.id === "beam");
    const last = frames[frames.length - 1].bodies.find((body) => body.id === "beam");
    expect(last && first && last.y).toBeLessThan((first?.y ?? 0) - 0.3);
  });
});

describe("lever model", () => {
  it("balances when the moments match", () => {
    expect(moment(4, 1)).toBe(moment(2, 2));
    expect(effortFor(12, 1, 2)).toBe(6);
    expect(effortFor(12, 2, 1)).toBe(24);
  });

  it("tips toward the heavier moment in the planck scene", () => {
    const frames = leverModel.simulate(
      [{ id: "mass", kind: "mass", spec: 1, slot: "main" }],
      { ask: 1, plank: 8, leftMass: 4, leftDistance: 2, rightMass: 2, rightDistance: 1 },
    );
    const last = frames[frames.length - 1].bodies;
    const left = last.find((body) => body.id === "left");
    const right = last.find((body) => body.id === "right");
    expect(left && right && left.y).toBeLessThan((right?.y ?? 0) - 0.05);
  });
});

describe("gear model", () => {
  it("matches ratios and direction through a compound train", () => {
    expect(gearRadius(12)).toBe(6);
    expect(meshes(12, 24, 18)).toBe(true);
    expect(meshes(12, 24, 10)).toBe(false);
    expect(compoundRatio([{ driver: 10, driven: 30 }, { driver: 10, driven: 40 }])).toBeCloseTo(1 / 12);
    expect(directionSign(1)).toBe(-1);
    expect(directionSign(2)).toBe(1);
    const frames = gearModel.simulate(
      [{ id: "gear", kind: "gear", spec: 24, slot: "main" }],
      { ask: 1, driver: 12, driven: 24, distance: 18, goal: 0.5 },
    );
    const start = frames[0].bodies.find((body) => body.id === "driven");
    const end = frames[frames.length - 1].bodies.find((body) => body.id === "driven");
    expect(end && start && Math.abs(end.angle - start.angle)).toBeGreaterThan(0.05);
  });
});

describe("gates and test timing", () => {
  it("ignores age and opens only after the skill is met", () => {
    const challenge = bridgeMachine.challenges.find((item) => item.id === "bridge-count-2");
    expect(challenge).toBeTruthy();
    const map = createLearnerMap(skills);
    expect(skillsMet(challenge?.skills ?? [], map, 7)).toBe(false);
    expect(skillsMet(challenge?.skills ?? [], map, 16)).toBe(false);
    const passed = recordLevelPass(map, "tens-and-ones", 1);
    expect(skillsMet(challenge?.skills ?? [], passed, 7)).toBe(true);
  });

  it("holds the result until the animation phase says so", () => {
    expect(nextDrivePhase("playing", "driving")).toBe("playing");
    expect(nextDrivePhase("playing", "crossed")).toBe("holding");
    expect(nextDrivePhase("holding", "crossed")).toBe("result");
    expect(craftStars(true, true)).toEqual(["Elegant support"]);
    expect(craftStars(false, false)).toEqual([]);
  });
});
