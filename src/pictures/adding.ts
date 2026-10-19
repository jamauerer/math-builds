import { blank, row, type Drawn, type PlainDraw } from "./parts";

export function addingPicture(draw: PlainDraw): Drawn {
  if (draw.op === "missing") {
    return {
      caption: "How many more bolts?",
      picture: blank(
        [...row("bolt.png", Math.min(draw.a, 10), 24, 70, 28, 28), { sprite: "beam-side.png", x: 340, y: 78, w: 140, h: 22 }],
        [
          { text: String(draw.a), x: 24, y: 36 },
          { text: String(draw.b), x: 360, y: 36 },
        ],
      ),
    };
  }
  if (draw.a <= 10 && draw.b <= 10) {
    return {
      caption: "How many bolts?",
      picture: blank([...row("bolt.png", draw.a, 24, 28, 28, 28), ...row("bolt.png", draw.b, 24, 100, 28, 28)]),
    };
  }
  return {
    caption: "How many bolts?",
    picture: blank(
      [
        { sprite: "beam-side.png", x: 36, y: 70, w: 200, h: 24 },
        { sprite: "beam-side.png", x: 270, y: 70, w: 200, h: 24 },
      ],
      [
        { text: String(draw.a), x: 100, y: 36 },
        { text: String(draw.b), x: 340, y: 36 },
      ],
    ),
  };
}
