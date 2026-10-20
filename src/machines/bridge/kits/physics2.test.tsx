/** @vitest-environment happy-dom */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { createLearnerMap } from "../../../engine/placement";
import { skills } from "../../../data/load-skills";
import { deckBeamBox, queenPost, slotAlong, waterPixel } from "./kit";
import { simulateCrossing } from "./simulate";
import { blueDominates, measuredWaterY, pixelAt } from "./water-line";
import { GoatKit } from "../kit/GoatKit";
import { CrossingPicture, goatSprite } from "../kit/scene";
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
    if (slot.kind !== "rail" && slot.group !== "bolts") {
      const along = slotAlong(slot);
      if (along != null) {
        lengths[slot.id] = along;
      }
    }
  }
  return lengths;
}

describe("physics 2", () => {
  it("reads the water line from the painted banks", () => {
    expect(queenPost.scene.waterY).toBeCloseTo(measuredWaterY(), 5);
    const sceneX = (queenPost.scene.leftEdge + queenPost.scene.rightEdge) / 2;
    expect(blueDominates(pixelAt(sceneX, waterPixel() + 5))).toBe(true);
  });

  it("rests both bottom beams on the bank top", () => {
    const result = simulateCrossing(truss());
    expect(result.ok).toBe(true);
    const beams = result.bodies.filter((body) => body.id === "bottom-a" || body.id === "bottom-b");
    expect(beams).toHaveLength(2);
    for (const beam of beams) {
      const bottom = beam.y - 0.06;
      expect(Math.abs(bottom) * queenPost.pxPerMetre).toBeLessThanOrEqual(2);
    }
  });

  it("seats beam bottoms on the measured bank top", async () => {
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
    expect(container.querySelector('[data-piece="abutment-left"]')).toBeNull();
    const beamA = container.querySelector('[data-piece="bottom-a"]') as HTMLElement;
    const beamB = container.querySelector('[data-piece="bottom-b"]') as HTMLElement;
    expect(beamA).toBeTruthy();
    expect(beamB).toBeTruthy();
    for (const beam of [beamA, beamB]) {
      const beamBottom = parseFloat(beam.style.top) + parseFloat(beam.style.height);
      expect(Math.abs(beamBottom - queenPost.scene.bankTopY)).toBeLessThanOrEqual(2);
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
      expect(parseFloat(body.style.width)).toBeCloseTo(deckBeamBox(id === "bottom-a" ? "left" : "right", 6).width, 5);
    }
    root.unmount();
    container.remove();
  });

  it("folds a plank bridge at the middle joint and drops through a missing plank in any round", () => {
    const folded = simulateCrossing({ "bottom-a": 4, "bottom-b": 4, ...planks() });
    expect(folded.ok).toBe(false);
    expect(folded.cause?.kind).toBe("joint");
    expect(folded.frames.some((frame) => frame.goatY < 0)).toBe(true);
    expect(folded.frames[0].pieces.filter((piece) => piece.kind === "plank")).toHaveLength(8);
    expect(folded.bodies.filter((body) => body.id.startsWith("plank-")).length).toBe(8);
    expect(folded.bodies.some((body) => body.id.startsWith("plank-") && body.y < 0)).toBe(true);

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

  it("draws eight plank sprites in Test before the goat starts", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const drops = Object.fromEntries(
      Object.entries({ "bottom-a": 4, "bottom-b": 4, ...planks() }).map(([id, value]) => [id, String(value)]),
    );
    await act(async () => {
      root.render(
        <GoatKit
          map={createLearnerMap(skills)}
          marks={0}
          onMarks={() => undefined}
          units="us"
          onUnits={() => undefined}
          start="drive"
          seek={-1}
          level={4}
          guideMode="off"
          drops={drops}
          kitProfile={{ ...profile, built: true }}
        />,
      );
    });
    const plankImgs = [...container.querySelectorAll('[data-kind="plank"], [data-piece^="plank-"]')] as HTMLImageElement[];
    expect(plankImgs.length).toBeGreaterThanOrEqual(8);
    expect(plankImgs.every((img) => (img.getAttribute("src") ?? "").includes("plank-side.png"))).toBe(true);
    root.unmount();
    container.remove();
  });

  it("does not draw stone abutments", async () => {
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
          level={2}
          guideMode="off"
          kitProfile={{ ...profile, built: true }}
        />,
      );
    });
    expect(container.querySelector('[data-piece="abutment-left"]')).toBeNull();
    expect(container.querySelector('[data-piece="abutment-right"]')).toBeNull();
    expect(container.querySelector("[data-abutment-face]")).toBeNull();
    expect(container.textContent).not.toMatch(/abutment/i);
    root.unmount();
    container.remove();
  });

  it("sags under a heavier goat without bolts and holds when the bolts are in", () => {
    const loose = simulateCrossing(truss(), 120);
    expect(loose.ok).toBe(false);
    expect(loose.frames.every((frame) => frame.follower == null)).toBe(true);
    expect(loose.frames[0]?.goat).toBe("big");
    expect(loose.frames.some((frame) => frame.pieces.some((piece) => piece.y - 0.06 < queenPost.scene.waterY * -1 + 0.05) || frame.goatY < 0)).toBe(true);

    const held = simulateCrossing({ ...truss(), bolts: 1, "rail-a": 8, "rail-b": 8 }, 120);
    expect(held.ok).toBe(true);
    expect(held.goatX).toBeGreaterThanOrEqual(8);
    expect(held.massKg).toBe(120);
    expect(held.frames.every((frame) => frame.follower == null)).toBe(true);
    expect(held.frames.some((frame) => frame.celebrate >= 1.5)).toBe(true);
    expect(held.frames.some((frame) => frame.mode === "arrived" && frame.celebrate > 0.2 && goatSprite(frame.mode, frame.walkFrame, frame.goat, frame.celebrate).src.includes("biggoat-dance"))).toBe(true);
  });

  it("seats Test beam sprites on the bank top at both ends", async () => {
    const result = simulateCrossing({ "bottom-a": 4, "bottom-b": 4, ...planks() });
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<CrossingPicture frame={result.frames[0]} extras={{ "gusset-n4": 1, "gusset-n2": 1 }} />);
    });
    expect(container.querySelector('[data-piece="abutment-left"]')).toBeNull();
    const beamA = container.querySelector('[data-piece="bottom-a"]') as HTMLElement;
    const beamB = container.querySelector('[data-piece="bottom-b"]') as HTMLElement;
    for (const beam of [beamA, beamB]) {
      const beamBottom = parseFloat(beam.style.top) + parseFloat(beam.style.height);
      expect(Math.abs(beamBottom - queenPost.scene.bankTopY)).toBeLessThanOrEqual(2);
    }
    const gusset = container.querySelector('[data-piece="gusset-n4"]') as HTMLElement;
    const plank = container.querySelector('[data-kind="plank"]') as HTMLElement;
    expect(gusset).toBeTruthy();
    expect(parseInt(gusset.style.zIndex || "0", 10)).toBeGreaterThan(parseInt(plank.style.zIndex || "0", 10));
    root.unmount();
    container.remove();
  });

  it("covers the goat center column with the left post at 2 ft", async () => {
    const result = simulateCrossing({ ...truss(), bolts: 1 });
    const atPost = result.frames.find((frame) => frame.mode === "walk" && Math.abs(frame.goatX - 2) < 0.15);
    expect(atPost).toBeTruthy();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<CrossingPicture frame={atPost!} extras={{ "gusset-n2": 1 }} />);
    });
    const goat = container.querySelector('[data-goat="lead"]') as HTMLElement;
    const post = container.querySelector('[data-piece="post-a"]') as HTMLElement;
    expect(goat).toBeTruthy();
    expect(post).toBeTruthy();
    const goatZ = parseInt(goat.style.zIndex || "0", 10);
    const postZ = parseInt(post.style.zIndex || "0", 10);
    expect(postZ).toBeGreaterThan(goatZ);
    const goatCenter = parseFloat(goat.style.left) + parseFloat(goat.style.width) / 2;
    const postLeft = parseFloat(post.style.left);
    const postRight = postLeft + parseFloat(post.style.width);
    expect(goatCenter).toBeGreaterThanOrEqual(postLeft);
    expect(goatCenter).toBeLessThanOrEqual(postRight);
    const canvas = document.createElement("canvas");
    canvas.width = 1000;
    canvas.height = 620;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#00ff00";
      ctx.fillRect(parseFloat(goat.style.left), parseFloat(goat.style.top), parseFloat(goat.style.width), parseFloat(goat.style.height));
      ctx.fillStyle = "#8B5A2B";
      ctx.fillRect(postLeft, parseFloat(post.style.top), parseFloat(post.style.width), parseFloat(post.style.height));
      const sample = ctx.getImageData(Math.round(goatCenter), Math.round(parseFloat(post.style.top) + parseFloat(post.style.height) / 2), 1, 1).data;
      expect(sample[0]).toBeGreaterThan(sample[1]);
      expect(sample[1]).toBeLessThan(100);
    }
    root.unmount();
    container.remove();
  });
});
