import { labelAt, slice } from "./layout";
import type { Drawn, PlainDraw } from "./parts";

const PLANKS = ["plank-1", "plank-2", "plank-3", "plank-4", "plank-5", "plank-6", "plank-7", "plank-8"];

export function dividingPicture(draw: PlainDraw): Drawn {
  const rows = Math.max(1, Math.min(draw.b, 8));
  if (draw.op === "rem") {
    return {
      caption: "How many are left?",
      picture: slice(PLANKS.slice(0, rows), [labelAt("bottom-a", String(draw.a), -36), labelAt("bottom-b", String(draw.b), -36)]),
    };
  }
  return {
    caption: draw.c === -1 ? "What is the result?" : "How many in a row?",
    picture: slice(PLANKS.slice(0, rows), [
      labelAt("bottom-a", draw.c === -1 ? `−${draw.a}` : String(draw.a), -36),
      labelAt("bottom-b", String(draw.b), -36),
    ]),
  };
}
