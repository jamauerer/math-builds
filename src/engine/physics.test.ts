import { describe, expect, it } from "vitest";
import { dropOntoFloor } from "./physics";

describe("planck world wrapper", () => {
  it("settles a dropped box on the floor", () => {
    const landed = dropOntoFloor();
    expect(landed.settled).toBe(true);
    expect(landed.y).toBeGreaterThan(0.3);
    expect(landed.y).toBeLessThan(0.8);
  });
});
