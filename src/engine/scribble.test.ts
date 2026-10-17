import { describe, expect, it } from "vitest";
import {
  beginStroke,
  canvasPixelSize,
  clearScribble,
  emptyScribble,
  extendStroke,
  scribbleForQuestion,
  undoStroke,
} from "./scribble";

describe("scribble store", () => {
  it("draws, undoes, and clears", () => {
    let scribble = emptyScribble();
    scribble = beginStroke(scribble, { color: "#111", size: 3, eraser: false, point: { x: 1, y: 2 } });
    scribble = extendStroke(scribble, { x: 4, y: 6 });
    scribble = beginStroke(scribble, { color: "#00f", size: 3, eraser: false, point: { x: 8, y: 8 } });
    expect(scribble.strokes).toHaveLength(2);
    expect(scribble.strokes[0].points).toEqual([
      { x: 1, y: 2 },
      { x: 4, y: 6 },
    ]);
    scribble = undoStroke(scribble);
    expect(scribble.strokes).toHaveLength(1);
    expect(clearScribble().strokes).toEqual([]);
  });

  it("resets on a new question and restores the same question", () => {
    const drawn = beginStroke(emptyScribble(), {
      color: "#111",
      size: 3,
      eraser: false,
      point: { x: 3, y: 3 },
    });
    expect(scribbleForQuestion("q2", "q1", drawn).strokes).toEqual([]);
    expect(scribbleForQuestion("q1", "q1", drawn)).toEqual(drawn);
  });

  it("sizes the canvas to the problem box", () => {
    expect(canvasPixelSize(200, 80, 2)).toEqual({ width: 400, height: 160 });
  });
});
