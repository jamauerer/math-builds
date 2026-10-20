import { mkdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  BEARING_FT,
  canvasPixel,
  deckBeamBox,
  isBank,
  isBeam,
  measuredScene,
  pixelAt,
  writeDebugScene,
} from "./water-line";

describe("grounded banks", () => {
  it("measures both bank faces and the walking surface from the picture", () => {
    const scene = measuredScene();
    const left = pixelAt(scene.leftEdge - 16, scene.bankTopY + 8);
    const right = pixelAt(scene.rightEdge + 16, scene.bankTopY + 8);
    expect(scene.rightEdge - scene.leftEdge, JSON.stringify({ scene, left, right })).toBeGreaterThan(200);
    expect(scene.leftEdge).toBeGreaterThan(80);
    expect(scene.rightEdge).toBeLessThan(900);
    expect(scene.bankTopY).toBeGreaterThan(250);
    expect(scene.bankTopY).toBeLessThan(500);
    expect(isBank(left), JSON.stringify({ scene, left })).toBe(true);
    expect(isBank(right), JSON.stringify({ scene, right })).toBe(true);
  }, 20_000);

  it("seats each bottom beam end on bank pixels in the rendered canvas", () => {
    const scene = measuredScene();
    mkdirSync("docs/screens/2026-10-20-grounded", { recursive: true });
    const canvas = writeDebugScene("docs/screens/2026-10-20-grounded/debug-edges.png");
    for (const side of ["left", "right"] as const) {
      const box = deckBeamBox(side);
      const inward = side === "left" ? box.left + BEARING_FT * 0.5 * scene.pxPerFt : box.left + box.width - BEARING_FT * 0.5 * scene.pxPerFt;
      const x = Math.round(inward);
      const below = canvasPixel(canvas, x, Math.round(box.bottom + 2));
      expect(isBank(below), `${side} below ${JSON.stringify(below)}`).toBe(true);
      for (let up = 1; up <= 4; up += 1) {
        const beam = canvasPixel(canvas, x, Math.round(scene.bankTopY - up));
        expect(isBeam(beam), `${side} above ${up} ${JSON.stringify(beam)}`).toBe(true);
      }
    }
  }, 20_000);
});
