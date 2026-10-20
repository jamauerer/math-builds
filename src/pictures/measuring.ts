import { slice } from "./layout";
import type { Drawn, PlainDraw, Tape } from "./parts";
import { dividingPicture } from "./dividing";

function readingTape(value: number, end = 4): Tape {
  const x = 36;
  const y = 118;
  const w = 448;
  const h = 20;
  const inner = w - 24;
  const ticks = [];
  for (let n = 0; n <= end; n += 1) {
    ticks.push({ x: x + 12 + (n / end) * inner, label: String(n) });
  }
  const markX = x + 12 + (value / end) * inner;
  ticks.push({ x: markX, label: "" });
  return { x, y, w, h, ticks, goat: { x: markX - 28, y: y - 52 } };
}

export function measuringPicture(draw: PlainDraw): Drawn {
  if (draw.op === "div" || draw.op === "rem") {
    return dividingPicture(draw);
  }
  if (draw.mark === "tape") {
    const value = draw.a / Math.max(draw.b, 1);
    return {
      caption: "",
      picture: { banks: false, ruler: false, bits: [], labels: [], tape: readingTape(value) },
    };
  }
  if (draw.op === "angle" && draw.a >= 10) {
    return {
      caption: "",
      picture: {
        banks: false,
        ruler: false,
        bits: [],
        labels: [],
        figure: { kind: "angle", deg: draw.a, ox: 200, oy: 142, arm: 150 },
      },
    };
  }
  return {
    caption: draw.op === "compare" ? "How much longer?" : "How long is the gap?",
    picture: slice(["post-a", "post-b"], []),
  };
}
