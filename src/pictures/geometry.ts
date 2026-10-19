import { labelAt, slice } from "./layout";
import type { Drawn, PlainDraw } from "./parts";

export function geometryPicture(draw: PlainDraw): Drawn {
  if (draw.op === "hyp") {
    return {
      caption: "How long is the brace?",
      picture: slice(["brace-a"], [labelAt("bottom-a", String(draw.a)), labelAt("post-a", String(draw.b), -22)]),
    };
  }
  if (draw.op === "angle") {
    return {
      caption: "How big is the other angle?",
      picture: slice(["brace-a"], [labelAt("brace-a", `${draw.a}°`, -20), labelAt("post-a", `${draw.b}°`, -22)]),
    };
  }
  return {
    caption: "How big is it?",
    picture: slice(["top", "post-a", "post-b"], [labelAt("top", String(draw.a), -24), labelAt("post-a", String(draw.b), -22)]),
  };
}
