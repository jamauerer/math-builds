import { labelAt, slice } from "./layout";
import type { Drawn, PlainDraw } from "./parts";
import { multiplyingPicture } from "./multiplying";

const PLANKS = ["plank-1", "plank-2", "plank-3", "plank-4", "plank-5", "plank-6", "plank-7", "plank-8"];

export function ratiosPicture(draw: PlainDraw): Drawn {
  if (draw.op !== "percent") {
    return multiplyingPicture(draw);
  }
  const colored = Math.max(0, Math.min(PLANKS.length, Math.round(draw.a / 10)));
  return {
    caption: "How many?",
    picture: slice(PLANKS, [labelAt("bottom-a", `${draw.a}%`, -36), labelAt("bottom-b", String(draw.b), -36)], PLANKS.slice(0, colored)),
  };
}
