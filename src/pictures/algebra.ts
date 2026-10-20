import { labelAt, slice } from "./layout";
import type { Drawn, PlainDraw } from "./parts";

export function algebraPicture(draw: PlainDraw): Drawn {
  if (draw.op === "square") {
    return {
      caption: "How long is a side?",
      picture: slice(["top", "bottom-a", "bottom-b", "post-a", "post-b"], [labelAt("top", String(draw.a), -24)]),
    };
  }
  if (draw.mark === "line") {
    return {
      caption: "",
      picture: {
        banks: false,
        ruler: false,
        bits: [],
        labels: [],
        figure: { kind: "line", rise: draw.a, run: Math.max(1, draw.b) },
      },
    };
  }
  return {
    caption: "How many in each group?",
    picture: slice(
      ["gusset-n2", "gusset-n4", "gusset-n6", "bolts"],
      [labelAt("bottom-a", String(draw.a), -36), labelAt("bolts", String(draw.b), -28), labelAt("bottom-b", String(draw.c ?? draw.b), -36)],
    ),
  };
}
