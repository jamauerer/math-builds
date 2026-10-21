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
  renderGroundedScene,
  writeDebugScene,
} from "./water-line";

describe("grounded banks", () => {
  it.each(["little", "big"] as const)("measures both bank faces on the %s kit", (kind) => {
    const scene = measuredScene(kind);
    const bankNear = (x: number, y: number) => {
      for (const dx of [-16, -8, 0, 8, 16]) {
        for (const dy of [8, 16, 24, 32]) {
          if (isBank(pixelAt(x + dx, y + dy, kind))) {
            return true;
          }
        }
      }
      return false;
    };
    expect(scene.rightEdge - scene.leftEdge, JSON.stringify(scene)).toBeGreaterThan(200);
    expect(scene.leftEdge).toBeGreaterThan(40);
    expect(scene.rightEdge).toBeLessThan(960);
    expect(scene.leftTopY).toBeGreaterThan(200);
    expect(scene.rightTopY).toBeGreaterThan(200);
    expect(bankNear(scene.leftEdge, scene.leftTopY), JSON.stringify(scene)).toBe(true);
    expect(bankNear(scene.rightEdge, scene.rightTopY), JSON.stringify(scene)).toBe(true);
  }, 20_000);

  it.each(["little", "big"] as const)("seats each bottom beam end on bank pixels for the %s kit", (kind) => {
    const scene = measuredScene(kind);
    const folder = kind === "big" ? "docs/screens/2026-10-21-big-goat" : "docs/screens/2026-10-20-grounded";
    mkdirSync(folder, { recursive: true });
    try {
      writeDebugScene(`${folder}/debug-edges.png`, kind);
    } catch {
      // Another run may have the debug shot open; seating still uses the live canvas.
    }
    const canvas = renderGroundedScene(false, kind);
    for (const side of ["left", "right"] as const) {
      const box = deckBeamBox(side, scene.span / 2, scene);
      const x = Math.round(side === "left" ? scene.leftEdge - BEARING_FT * 0.25 * scene.pxPerFt : scene.rightEdge + BEARING_FT * 0.25 * scene.pxPerFt);
      const mid = canvasPixel(canvas, x, Math.round((box.top + box.bottom) / 2));
      expect(isBeam(mid), `${kind} ${side} mid ${JSON.stringify(mid)}`).toBe(true);
      const below = [8, 12, 16, 20].some((down) => isBank(canvasPixel(canvas, x, Math.round(box.bottom + down))));
      expect(below, `${kind} ${side} below bank`).toBe(true);
    }
  }, 20_000);
});
