import { labelAt, slice } from "./layout";
import type { Drawn, PlainDraw } from "./parts";

export function multiplyingPicture(draw: PlainDraw): Drawn {
  return {
    caption: "How many bolts?",
    picture: slice(
      ["gusset-n4", "gusset-n2", "gusset-n6", "gusset-p2", "gusset-p6"],
      [labelAt("bottom-a", String(draw.a), -36), labelAt("bottom-b", String(draw.b), -36)],
    ),
  };
}
