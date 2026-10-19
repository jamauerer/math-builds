import { labelAt, slice } from "./layout";
import type { Drawn, PlainDraw } from "./parts";
import { dividingPicture } from "./dividing";

const PLANKS = ["plank-1", "plank-2", "plank-3", "plank-4", "plank-5", "plank-6", "plank-7", "plank-8"];

export function fractionsPicture(draw: PlainDraw): Drawn {
  if (draw.op !== "frac") {
    return dividingPicture(draw);
  }
  const whole = Math.min(draw.c ?? draw.b, PLANKS.length);
  const colored = Math.max(0, Math.min(whole, Math.round((draw.a / Math.max(draw.b, 1)) * whole)));
  return {
    caption: "How many are colored?",
    picture: slice(
      PLANKS.slice(0, whole),
      [labelAt("bottom-a", `${draw.a}/${draw.b}`, -36), labelAt("bottom-b", String(draw.c ?? draw.b), -36)],
      PLANKS.slice(0, colored),
    ),
  };
}
