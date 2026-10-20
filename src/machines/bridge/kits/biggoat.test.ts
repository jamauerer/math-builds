import { describe, expect, it } from "vitest";
import { queenPost, stareLine } from "./kit";
import { BIG_GOAT_MASS, SMALL_GOAT_MASS, simulateCrossing } from "./simulate";
import { fireworkDraws, frameNear, goatSprite } from "../kit/scene";

function planks(): Record<string, number> {
  return Object.fromEntries(queenPost.slots.filter((slot) => slot.kind === "plank").map((slot) => [slot.id, 1]));
}

function truss(): Record<string, number> {
  const lengths: Record<string, number> = { ...planks() };
  for (const slot of queenPost.slots) {
    if (slot.length != null && slot.kind !== "rail" && slot.group !== "bolts") {
      lengths[slot.id] = slot.length;
    }
  }
  return lengths;
}

describe("big goat", () => {
  it("sends one big goat at 120 lb, twice the small height, with no follower", () => {
    const small = goatSprite("idle", 1, "small");
    const big = goatSprite("idle", 1, "big");
    expect(big.height).toBe(small.height * 2);
    const result = simulateCrossing(truss(), BIG_GOAT_MASS);
    expect(result.massKg).toBe(120);
    expect(result.frames[0]?.goat).toBe("big");
    expect(result.frames.every((frame) => frame.follower == null)).toBe(true);
    const walking = result.frames.filter((frame) => frame.mode === "walk");
    expect(walking.some((frame) => frame.walkFrame === 6)).toBe(true);
    expect(walking.every((frame) => frame.walkFrame >= 1 && frame.walkFrame <= 6)).toBe(true);
    const src = goatSprite("walk", 3, "big").src;
    expect(src).toBe("biggoat-walk-3.png");
  });

  it("uses the big goat frames for fall, swim, climb and glare", () => {
    expect(goatSprite("fall", 1, "big").src).toBe("biggoat-fall.png");
    expect(goatSprite("swim", 1, "big").src).toBe("biggoat-swim-1.png");
    expect(goatSprite("swim", 2, "big").src).toBe("biggoat-swim-2.png");
    expect(goatSprite("drip", 2, "big").src).toBe("biggoat-drip-2.png");
    expect(goatSprite("shake", 1, "big").src).toBe("biggoat-climb-out.png");
    expect(goatSprite("glare", 1, "big").src).toBe("biggoat-swim-glare.png");
    const wreck = simulateCrossing({ ...truss(), top: 3 }, BIG_GOAT_MASS);
    expect(wreck.frames.at(-1)?.mode).toBe("glare");
    expect(wreck.frames.at(-1)?.goat).toBe("big");
    const line = stareLine({ ...truss(), top: 3 }, wreck.cause, true);
    expect(queenPost.bigDunks).toHaveLength(5);
    expect(queenPost.bigDunks.map((item) => item.line)).toContain(line);
  });

  it("sags the unbolted truss under the big goat and holds when bolted", () => {
    const loose = simulateCrossing(truss(), BIG_GOAT_MASS);
    expect(loose.ok).toBe(false);
    expect(loose.frames.some((frame) => frame.goatY < 0 || frame.pieces.some((piece) => piece.y < 0))).toBe(true);
    const held = simulateCrossing({ ...truss(), bolts: 1, "rail-a": 8, "rail-b": 8 }, BIG_GOAT_MASS);
    expect(held.ok).toBe(true);
    expect(held.goatX).toBeGreaterThanOrEqual(8);
  });

  it("plays rocket, burst, fade and dance frames on arrival", () => {
    expect(fireworkDraws(0.2)).toBeGreaterThanOrEqual(3);
    const held = simulateCrossing({ ...truss(), bolts: 1, "rail-a": 8, "rail-b": 8 }, SMALL_GOAT_MASS);
    const dancing = held.frames.find((frame) => frame.mode === "arrived" && frame.celebrate > 0.2 && frame.celebrate < 1);
    expect(dancing).toBeTruthy();
    expect(goatSprite(dancing!.mode, dancing!.walkFrame, "small", dancing!.celebrate).src).toMatch(/goat-dance-\d+\.png/);
    const bigDance = goatSprite("arrived", 1, "big", 0.4);
    expect(bigDance.src).toMatch(/biggoat-dance-\d+\.png/);
    const idle = goatSprite("arrived", 1, "big", 3);
    expect(idle.src).toBe("biggoat-idle.png");
    const rocket = frameNear(held.frames, 8.2);
    expect(rocket.celebrate).toBeGreaterThan(0);
  });
});
