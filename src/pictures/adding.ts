import { labelAt, slice } from "./layout";
import type { Drawn, PlainDraw } from "./parts";

export function addingPicture(draw: PlainDraw): Drawn {
  if (draw.op === "missing") {
    return {
      caption: "How many more?",
      picture: slice(["bottom-a", "bottom-b"], [labelAt("bottom-a", String(draw.a)), labelAt("bottom-b", String(draw.b))]),
    };
  }
  return {
    caption: "How many altogether?",
    picture: slice(["bottom-a", "bottom-b"], [labelAt("bottom-a", String(draw.a)), labelAt("bottom-b", String(draw.b))]),
  };
}
