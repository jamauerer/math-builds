import { describe, expect, it } from "vitest";
import { bridgeModel } from "./bridge/model";
import { gearModel } from "./gears/model";
import { leverModel } from "./lever/model";

describe("model limits", () => {
  it("names the bridge limit that is crossed first", () => {
    const scene = { ask: 3, gap: 4, load: 20, stiffness: 1000, depth: 1, sagCap: 4 / 20, stressLimit: 60 };
    const stress = bridgeModel.evaluate([{ id: "beam", kind: "beam", spec: 1, slot: "main" }], scene);
    expect(stress.ok).toBe(false);
    expect(stress.failures[0]?.text).toContain("stress limit");
    const sag = bridgeModel.evaluate([{ id: "beam", kind: "beam", spec: 1, slot: "main" }], { ...scene, stressLimit: 1000, sagCap: 0.01 });
    expect(sag.ok).toBe(false);
    expect(sag.failures[0]?.text).toContain("sag limit");
  });

  it("fails the plank when torque passes the limit", () => {
    const scene = { ask: 1, plank: 8, leftMass: 4, leftDistance: 2, rightMass: 2, rightDistance: 4, torqueLimit: 10 };
    const report = leverModel.evaluate([{ id: "load", kind: "load", spec: 4, slot: "main" }], scene);
    expect(report.ok).toBe(false);
    expect(report.failures[0]?.text.includes("120")).toBe(false);
    expect(report.numbers.some((item) => item.label === "Plank torque limit" && item.value.includes("10"))).toBe(true);
  });

  it("grades the clock hour hand at 12 to 1 after the minute train", () => {
    const scene = {
      ask: 1,
      driver: 12,
      mid: 72,
      driver2: 10,
      mate: 10,
      distance: 55,
      goal: (12 / 72) * (10 / 100),
      hourDriver: 10,
      hourDriven: 120,
    };
    const pass = gearModel.evaluate([{ id: "gear", kind: "gear", spec: 100, slot: "main" }], scene);
    expect(pass.ok).toBe(true);
    expect(pass.numbers.some((item) => item.label.includes("Hour"))).toBe(true);
    const fail = gearModel.evaluate([{ id: "gear", kind: "gear", spec: 100, slot: "main" }], { ...scene, hourDriven: 60 });
    expect(fail.ok).toBe(false);
    expect(fail.failures[0]?.text).toContain("12 to 1");
    const movie = gearModel.simulate([{ id: "gear", kind: "gear", spec: 100, slot: "main" }], scene);
    const hour = movie.at(-1)?.bodies.find((body) => body.id === "hour");
    const minute = movie.at(-1)?.bodies.find((body) => body.id === "driven");
    expect(hour && minute && Math.abs(hour.angle - minute.angle / 12) < 0.02).toBe(true);
  });
});
