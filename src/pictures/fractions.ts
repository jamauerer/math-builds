import { labelAt, slice } from "./layout";
import type { Drawn, PlainDraw } from "./parts";
import { dividingPicture } from "./dividing";

const PLANKS = ["plank-1", "plank-2", "plank-3", "plank-4", "plank-5", "plank-6", "plank-7", "plank-8"];

export function fractionsPicture(draw: PlainDraw): Drawn {
  if (draw.op !== "frac") {
    return dividingPicture(draw);
  }
  const whole = draw.c ?? draw.b;
  if (whole > PLANKS.length) {
    return { caption: "", picture: slice([], []) };
  }
  const colored = Math.max(0, Math.min(whole, Math.round((draw.a / Math.max(draw.b, 1)) * whole)));
  return {
    caption: "",
    picture: slice(
      PLANKS.slice(0, whole),
      [labelAt("bottom-a", `${draw.a}/${draw.b}`, -36), labelAt("bottom-b", String(whole), -36)],
      PLANKS.slice(0, colored),
    ),
  };
}
