import type { Drawn, PlainDraw } from "./parts";
import { dividingPicture } from "./dividing";

export function measuringPicture(draw: PlainDraw): Drawn {
  if (draw.op === "div" || draw.op === "rem") {
    return dividingPicture(draw);
  }
  const right = Math.max(draw.a, draw.b, 1);
  const left = Math.min(draw.a, draw.b);
  const far = Math.max(draw.a, draw.b);
  const x = 36;
  const width = 440;
  const scale = width / right;
  return {
    caption: "How long is the gap?",
    picture: {
      banks: false,
      ruler: false,
      bits: [
        { sprite: "beam-side.png", x, y: 108, w: width, h: 18 },
        { sprite: "post.png", x: x + left * scale - 12, y: 30, w: 24, h: 76 },
        { sprite: "post.png", x: x + far * scale - 12, y: 30, w: 24, h: 76 },
      ],
      labels: [
        { text: String(left), x: x + left * scale - 8, y: 8 },
        { text: String(far), x: x + far * scale - 8, y: 8 },
      ],
    },
  };
}
