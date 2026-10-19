import { labelAt, slice } from "./layout";
import type { Drawn, PlainDraw } from "./parts";
import { dividingPicture } from "./dividing";

export function measuringPicture(draw: PlainDraw): Drawn {
  if (draw.op === "div" || draw.op === "rem") {
    return dividingPicture(draw);
  }
  const left = Math.min(draw.a, draw.b);
  const right = Math.max(draw.a, draw.b);
  return {
    caption: draw.op === "compare" ? "How much longer?" : "How long is the gap?",
    picture: slice(["post-a", "post-b"], [labelAt("post-a", String(left), -22), labelAt("post-b", String(right), -22)]),
  };
}
