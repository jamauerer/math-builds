import { describe, expect, it } from "vitest";
import { createBridgeSimulation, type BridgePreset } from "./simulate";

function run(preset: BridgePreset) {
  const sim = createBridgeSimulation(preset);
  const before = sim.status();
  sim.spawnTruck();
  let steps = 0;
  while (sim.status() === "driving" && steps < 1200) {
    sim.step();
    steps += 1;
  }
  return { before, status: sim.status(), broken: sim.brokenJoints() };
}

describe("bridge presets", () => {
  it("lets the supported bridge carry the truck", () => {
    const result = run("holds");
    expect(result.before).toBe("ready");
    expect(result.status).toBe("crossed");
    expect(result.broken).toBe(0);
  });

  it("breaks the long bridge under the truck", () => {
    const result = run("collapses");
    expect(result.before).toBe("ready");
    expect(result.status).toBe("collapsed");
    expect(result.broken).toBeGreaterThan(0);
  });
});
