import { describe, expect, it } from "vitest";
import { setUnitSystem } from "../units";
import { formatCount } from "../units";
import {
  SAMPLE_STACKS,
  carryInside,
  columnCenters,
  drawPencilCarries,
  drawStack,
  parseStackSpec,
  stackGeom,
} from "./stack";

type Stroke = { kind: string; text?: string; x?: number; y?: number };

function recorder() {
  const strokes: Stroke[] = [];
  const ctx = {
    strokes,
    save() {},
    restore() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    quadraticCurveTo() {},
    stroke() {
      strokes.push({ kind: "stroke" });
    },
    fillText(text: string, x: number, y: number) {
      strokes.push({ kind: "text", text, x, y });
    },
    clearRect() {
      strokes.length = 0;
      strokes.push({ kind: "clear" });
    },
    font: "",
    fillStyle: "",
    strokeStyle: "",
    textAlign: "",
    textBaseline: "",
    lineWidth: 1,
    lineCap: "",
  };
  return ctx;
}

describe("sketch stack", () => {
  it("renders the five sample problems with a carry row inside the canvas and lined-up columns", () => {
    setUnitSystem("us");
    expect(parseStackSpec("4827+3596")?.prompt).toBe("4,827 + 3,596 = ?");
    expect(formatCount(703801, "us")).toBe("703,801");
    expect(formatCount(703801, "metric")).toBe("703.801");
    for (const sample of SAMPLE_STACKS) {
      const geom = stackGeom(sample.layout);
      expect(carryInside(geom), sample.id).toBe(true);
      const xs = columnCenters(geom);
      expect(xs.length).toBeGreaterThan(0);
      expect(new Set(xs).size).toBe(xs.length);
      for (const col of geom.columns) {
        expect(col.centerX).toBe(col.centerX);
        expect(geom.top.y).toBeLessThan(geom.bottom.y);
        expect(geom.answer.y).toBeGreaterThan(geom.bottom.y);
      }
      for (const mark of geom.digits.filter((item) => item.role !== "divisor")) {
        expect(xs.some((center) => Math.abs(center - mark.x) < 0.5), `${sample.id} digit ${mark.text}`).toBe(true);
      }
      const bg = recorder();
      const ink = recorder();
      drawStack(bg as unknown as CanvasRenderingContext2D, geom);
      const kept = bg.strokes.filter((stroke) => stroke.kind === "text").length;
      expect(kept).toBeGreaterThan(0);
      drawPencilCarries(ink as unknown as CanvasRenderingContext2D, geom);
      ink.clearRect();
      expect(ink.strokes.every((stroke) => stroke.kind === "clear")).toBe(true);
      expect(bg.strokes.filter((stroke) => stroke.kind === "text").length).toBe(kept);
    }
  });
});
