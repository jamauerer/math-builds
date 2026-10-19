import { labelAt, slice } from "./layout";
import type { Drawn, PlainDraw } from "./parts";

export function countingPicture(draw: PlainDraw): Drawn {
  if (draw.op === "groups") {
    return {
      caption: "How many bolts?",
      picture: slice(
        ["gusset-n4", "gusset-n2", "gusset-n6", "gusset-p2", "gusset-p6"],
        [labelAt("bottom-a", String(draw.a), -36), labelAt("bottom-b", String(draw.b), -36)],
      ),
    };
  }
  return {
    caption: draw.op === "compare" ? "How many more?" : "How many altogether?",
    picture: slice(["bottom-a", "bottom-b"], [labelAt("bottom-a", String(draw.a)), labelAt("bottom-b", String(draw.b))]),
  };
}
