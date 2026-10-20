import { labelAt, slice } from "./layout";
import type { Drawn, Picture, PlainDraw } from "./parts";

function emptyPicture(figure: Picture["figure"]): Picture {
  return { banks: false, ruler: false, bits: [], labels: [], figure };
}

export function geometryPicture(draw: PlainDraw): Drawn {
  if (draw.op === "hyp") {
    return {
      caption: "How long is the brace?",
      picture: slice(["brace-a"], [labelAt("bottom-a", String(draw.a)), labelAt("post-a", String(draw.b), -22)]),
    };
  }
  if (draw.op === "angle" && draw.a >= 10) {
    return {
      caption: "",
      picture: emptyPicture({ kind: "angle", deg: draw.a, ox: 200, oy: 142, arm: 150 }),
    };
  }
  if (draw.op === "angle") {
    const name = draw.a <= 0 ? "circle" : draw.a === 4 ? "square" : "triangle";
    return {
      caption: "",
      picture: emptyPicture({ kind: "shape", name }),
    };
  }
  return {
    caption: "How big is it?",
    picture: slice(["top", "post-a", "post-b"], [labelAt("top", String(draw.a), -24), labelAt("post-a", String(draw.b), -22)]),
  };
}
