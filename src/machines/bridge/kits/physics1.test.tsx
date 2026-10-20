/** @vitest-environment happy-dom */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { setUnitSystem } from "../../../units";
import { CrossingPicture } from "../kit/scene";
import { causeText, correctLengths, pieceRows, queenPost, rowLabel, waterPixel, waterWorld } from "./kit";
import { simulateCrossing } from "./simulate";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("physics 1", () => {
  it("holds the goat on the water line and splashes there", async () => {
    const result = simulateCrossing({ ...correctLengths(), top: 3 });
    const water = waterWorld();
    const crossed = result.frames.findIndex((frame) => frame.mode === "splash" || frame.mode === "swim");
    expect(crossed).toBeGreaterThan(0);
    for (const frame of result.frames.filter((item) => item.mode === "swim" || item.mode === "splash")) {
      expect(frame.goatY).toBeLessThanOrEqual(water + 0.02);
      expect(frame.splashes.length).toBeGreaterThan(0);
      const splashPx = queenPost.scene.deckY - queenPost.pxPerMetre * frame.splashes[0].y;
      expect(Math.abs(splashPx - waterPixel())).toBeLessThanOrEqual(10);
    }
    const swim = result.frames.find((frame) => frame.mode === "swim");
    expect(swim).toBeTruthy();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<CrossingPicture frame={swim!} />);
    });
    const splash = container.querySelector("[data-splash]") as HTMLElement;
    const belly = Number(container.querySelector("[data-belly]")?.getAttribute("data-belly"));
    expect(splash).toBeTruthy();
    expect(Math.abs(parseFloat(splash.style.top) + 8 - waterPixel())).toBeLessThanOrEqual(10);
    expect(Math.abs(belly - waterPixel())).toBeLessThanOrEqual(10);
    root.unmount();
    container.remove();
  });

  it("clears the splash sprite 2 s after the last water entry", async () => {
    const result = simulateCrossing({ ...correctLengths(), top: 3 });
    const lastAt = Math.max(0, ...result.frames.flatMap((frame) => frame.splashes.map((mark) => mark.at)));
    expect(lastAt).toBeGreaterThan(0);
    const late = [...result.frames].reverse().find((frame) => frame.t >= lastAt + 2);
    expect(late).toBeTruthy();
    expect(late!.splashes.every((mark) => late!.t - mark.at > 0.6)).toBe(true);
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<CrossingPicture frame={late!} />);
    });
    expect(container.querySelector("[data-splash]")).toBeNull();
    root.unmount();
    container.remove();
  });

  it("drifts the goat to the open gap center before swim frames", () => {
    const result = simulateCrossing({ ...correctLengths(), top: 3 });
    const firstSwim = result.frames.find((frame) => frame.mode === "swim");
    expect(firstSwim).toBeTruthy();
    expect(Math.abs(firstSwim!.goatX - 4)).toBeLessThanOrEqual(0.35);
  });

  it("names missing planks as the cause and a long top beam as not the cause", () => {
    setUnitSystem("us");
    const lengths = correctLengths();
    lengths.top = 6;
    for (const slot of queenPost.slots) {
      if (slot.kind === "plank") {
        delete lengths[slot.id];
      }
    }
    const result = simulateCrossing(lengths);
    expect(result.cause?.kind).toBe("planks");
    expect(causeText(result.cause).toLowerCase()).toContain("no planks");
    const top = pieceRows(lengths, result.cause, result.broke).find((row) => row.id === "top");
    expect(top?.state).toBe("long");
    expect(top?.caused).toBe(false);
    expect(rowLabel(top!)).toBe("long by 2 ft");
    expect(`${rowLabel(top!)}, wrong, but not what broke`).toContain("wrong, but not what broke");
  });
});
