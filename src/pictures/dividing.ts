import { labelAt, slice } from "./layout";
import type { Drawn, PlainDraw } from "./parts";

const PLANKS = ["plank-1", "plank-2", "plank-3", "plank-4", "plank-5", "plank-6", "plank-7", "plank-8"];

export function dividingPicture(draw: PlainDraw): Drawn {
  const quotient = draw.op === "rem" ? Math.abs(draw.c ?? 1) : Math.max(1, Math.round(Math.abs(draw.a / Math.max(draw.b, 1))));
  const rows = Math.max(1, Math.min(quotient, PLANKS.length));
  return {
    caption: "",
    picture: slice(PLANKS.slice(0, rows), [
      labelAt("bottom-a", draw.c === -1 ? `−${draw.a}` : String(draw.a), -36),
      labelAt("bottom-b", String(draw.b), -36),
    ]),
  };
}
