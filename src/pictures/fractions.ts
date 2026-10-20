import { slice } from "./layout";
import type { Drawn, FracTapeMark, Picture, PlainDraw } from "./parts";
import { dividingPicture } from "./dividing";

const PLANKS = ["plank-1", "plank-2", "plank-3", "plank-4", "plank-5", "plank-6", "plank-7", "plank-8"];

function tapePicture(draw: PlainDraw): Drawn {
  const parts = Math.max(2, draw.c ?? draw.b);
  const at = draw.a / Math.max(draw.b, 1);
  if (draw.mark === "one") {
    return {
      caption: "",
      picture: {
        banks: false,
        ruler: false,
        bits: [],
        labels: [],
        figure: { kind: "frac-tape", parts, marks: [{ at }] },
      },
    };
  }
  const marks: FracTapeMark[] = [
    { at: 1 / parts, letter: "A" },
    { at: 2 / parts, letter: "B" },
    { at: 3 / parts, letter: "C" },
  ];
  return {
    caption: "",
    picture: {
      banks: false,
      ruler: false,
      bits: [],
      labels: [],
      figure: { kind: "frac-tape", parts, marks },
    },
  };
}

export function fractionsPicture(draw: PlainDraw): Drawn {
  if (draw.op !== "frac") {
    return dividingPicture(draw);
  }
  if (draw.mark === "ABC" || draw.mark === "one") {
    return tapePicture(draw);
  }
  const whole = draw.c ?? draw.b;
  if (whole > PLANKS.length) {
    return { caption: "", picture: slice([], []) };
  }
  const colored = Math.max(0, Math.min(whole, Math.round((draw.a / Math.max(draw.b, 1)) * whole)));
  const picture: Picture = slice(
    PLANKS.slice(0, whole),
    [],
    PLANKS.slice(0, colored),
  );
  return {
    caption: "",
    picture,
  };
}
