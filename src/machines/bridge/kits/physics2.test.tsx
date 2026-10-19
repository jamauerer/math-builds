/** @vitest-environment happy-dom */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { createLearnerMap } from "../../../engine/placement";
import { skills } from "../../../data/load-skills";
import { queenPost, waterPixel } from "./kit";
import { simulateCrossing } from "./simulate";
import { blueDominates, measuredWaterY, pixelAt, BANKS_LAYOUT } from "./water-line";
import { GoatKit } from "../kit/GoatKit";
import type { KitProfile } from "../../../storage/progress";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const profile: KitProfile = {
  grade: 3,
  levels: { dividing: 4, measuring: 5, adding: 4, multiplying: 4, fractions: 4, ratios: 4, geometry: 4, algebra: 4, counting: 4 },
  history: [],
  notes: [],
  kitVersion: queenPost.version,
};

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

describe("physics 2", () => {
  it("reads the water line from the painted banks", () => {
    expect(queenPost.scene.waterY).toBeCloseTo(measuredWaterY(), 5);
    const sceneX = BANKS_LAYOUT.originX + BANKS_LAYOUT.gapCenterM * BANKS_LAYOUT.pxPerMetre;
    expect(blueDominates(pixelAt(sceneX, waterPixel() + 5))).toBe(true);
  });

  it("rests both bottom beams on the abutment top", () => {
    const result = simulateCrossing(truss());
    expect(result.ok).toBe(true);
    const beams = result.bodies.filter((body) => body.id === "bottom-a" || body.id === "bottom-b");
    expect(beams).toHaveLength(2);
    for (const beam of beams) {
      const bottom = beam.y - 0.06;
      expect(Math.abs(bottom) * queenPost.pxPerMetre).toBeLessThanOrEqual(2);
    }
  });

  it("seats beam bottoms on abutment tops within 2 px in the scene", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const drops = Object.fromEntries(Object.entries(truss()).map(([id, value]) => [id, String(value)]));
    await act(async () => {
      root.render(
        <GoatKit
          map={createLearnerMap(skills)}
          marks={0}
          onMarks={() => undefined}
          units="us"
          onUnits={() => undefined}
          start="assemble"
          level={5}
          guideMode="off"
          drops={drops}
          kitProfile={{ ...profile, built: true }}
        />,
      );
    });
    const left = container.querySelector('[data-piece="abutment-left"]') as HTMLElement;
    const beamA = container.querySelector('[data-piece="bottom-a"]') as HTMLElement;
    const beamB = container.querySelector('[data-piece="bottom-b"]') as HTMLElement;
    expect(left).toBeTruthy();
    expect(beamA).toBeTruthy();
    expect(beamB).toBeTruthy();
    const abutmentTop = parseFloat(left.style.top);
    for (const beam of [beamA, beamB]) {
      const beamBottom = parseFloat(beam.style.top) + parseFloat(beam.style.height);
      expect(Math.abs(beamBottom - abutmentTop)).toBeLessThanOrEqual(2);
    }
    root.unmount();
    container.remove();
  });

  it("redraws both bottom beams when their lengths change", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <GoatKit
          map={createLearnerMap(skills)}
          marks={0}
          onMarks={() => undefined}
          units="us"
          onUnits={() => undefined}
          start="assemble"
          level={5}
          guideMode="off"
          kitProfile={{ ...profile, built: true }}
        />,
      );
    });
    const inputs = [...container.querySelectorAll("input.gk-len")] as HTMLInputElement[];
    const beams = inputs.filter((input) => input.getAttribute("aria-label") === "Bottom beam length");
    expect(beams).toHaveLength(2);
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    await act(async () => {
      for (const input of beams) {
        setValue?.call(input, "6");
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
    for (const id of ["bottom-a", "bottom-b"]) {
      const body = container.querySelector(`[data-piece="${id}"]`) as HTMLElement;
      expect(body.getAttribute("data-length")).toBe("6");
      expect(parseFloat(body.style.width)).toBe(6 * queenPost.pxPerMetre);
    }
    root.unmount();
    container.remove();
  });

  it("folds a plank bridge at the middle joint and drops through a missing plank in any round", () => {
    const folded = simulateCrossing({ "bottom-a": 4, "bottom-b": 4, ...planks() });
    expect(folded.ok).toBe(false);
    expect(folded.cause?.kind).toBe("joint");
    expect(folded.frames.some((frame) => frame.goatY < 0)).toBe(true);

    const open = { ...truss() };
    for (const slot of queenPost.slots) {
      if (slot.kind === "plank") {
        delete open[slot.id];
      }
    }
    const dropped = simulateCrossing(open);
    expect(dropped.cause?.kind).toBe("planks");
    expect(dropped.goatX).toBeLessThan(1);
  });

  it("sags under a heavier goat without bolts and holds when the bolts are in", () => {
    const loose = simulateCrossing(truss(), 80);
    expect(loose.ok).toBe(false);
    expect(loose.frames.some((frame) => frame.pieces.some((piece) => piece.y - 0.06 < queenPost.scene.waterY * -1 + 0.05) || frame.goatY < 0)).toBe(true);

    const held = simulateCrossing({ ...truss(), bolts: 1, "rail-a": 8, "rail-b": 8 }, 80);
    expect(held.ok).toBe(true);
    expect(held.goatX).toBeGreaterThanOrEqual(8);
    const hop = held.frames.filter((frame) => frame.celebrate > 0.2 && frame.celebrate < 1.3);
    expect(hop.some((frame) => frame.goatY > 0.05)).toBe(true);
    expect(hop.some((frame) => (frame.follower?.y ?? 0) > 0.05)).toBe(true);
    expect(held.frames.some((frame) => frame.celebrate >= 1.5)).toBe(true);

    const openRail = simulateCrossing({ ...truss(), bolts: 1 }, 80);
    expect(openRail.frames.some((frame) => frame.follower?.mode === "fall" || frame.follower?.mode === "swim")).toBe(true);
  });
});
