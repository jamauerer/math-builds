import { describe, expect, it } from "vitest";
import { scenarios, referenceDesigns, type Scenario } from "./catalog";
import { createDesignSimulation, type BridgeStatus } from "./simulate";

function run(scenario: Scenario, kind: "correct" | "weak" | "margin") {
  const design = referenceDesigns(scenario)[kind];
  const sim = createDesignSimulation(design);
  const settled = sim.status();
  sim.spawnTruck();
  let steps = 0;
  while (sim.status() === "driving" && steps < 2200) {
    sim.step();
    steps += 1;
  }
  return {
    settled,
    status: sim.status() as BridgeStatus,
    broken: sim.brokenJoints(),
    failure: sim.failure()?.text ?? "",
  };
}

describe("bridge math matches the physics", () => {
  for (const scenario of scenarios) {
    it(`${scenario.mode}: a correct design crosses`, () => {
      const result = run(scenario, "correct");
      expect(result.status).toBe("crossed");
    });

    it(`${scenario.mode}: a design the math calls too weak collapses`, () => {
      const result = run(scenario, "weak");
      expect(result.status).toBe("collapsed");
    });

    it(`${scenario.mode}: a design at the limit plus a margin holds`, () => {
      const result = run(scenario, "margin");
      expect(result.status).toBe("crossed");
    });
  }
});
