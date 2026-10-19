import { slice } from "./layout";
import type { Drawn, PlainDraw } from "./parts";
import { dividingPicture } from "./dividing";

export function measuringPicture(draw: PlainDraw): Drawn {
  if (draw.op === "div" || draw.op === "rem") {
    return dividingPicture(draw);
  }
  return {
    caption: draw.op === "compare" ? "How much longer?" : "How long is the gap?",
    picture: slice(["post-a", "post-b"], []),
  };
}
