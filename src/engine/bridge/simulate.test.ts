import { describe, expect, it } from "vitest";
import { bridgeFromPieces, candyLevels, deckPiece, partById, referenceBridges } from "./catalog";
import { createBlockSimulation, type BlockBridge } from "./simulate";

function run(design: BlockBridge) {
  const sim = createBlockSimulation(design);
  sim.spawnCar();
  for (let step = 0; step < 2200 && sim.status() === "driving"; step += 1) {
    sim.step();
  }
  return sim;
}

describe("candy bridge physics", () => {
  for (const level of candyLevels.filter((item) => item.playable)) {
    const designs = referenceBridges(level);

    it(`${level.id} carries the car when the math design is complete`, () => {
      const sim = run(designs.correct);
      expect(sim.status()).toBe("crossed");
      expect(sim.failure()).toBeNull();
    });

    it(`${level.id} fails when a block is missing`, () => {
      const sim = run(designs.weak);
      expect(sim.status()).toBe("collapsed");
      expect(sim.failure()?.text.length).toBeGreaterThan(10);
    });

    it(`${level.id} holds at the strength limit`, () => {
      const sim = run(designs.limit);
      expect(sim.status()).toBe("crossed");
    });
  }

  it("a wafer deck is too weak for the car", () => {
    const level = candyLevels.find((item) => item.id === "candy-1");
    const wafer = partById("wafer");
    if (!level || !wafer) {
      throw new Error("wafer level is missing");
    }
    const sim = run(
      bridgeFromPieces(
        level,
        Array.from({ length: level.gapBlocks }, (_, col) => deckPiece(wafer, col)),
      ),
    );
    expect(sim.status()).toBe("collapsed");
    expect(sim.failure()?.text).toContain("wafer");
  });
});
