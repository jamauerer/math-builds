import { blank, grid, row, type Drawn, type PlainDraw } from "./parts";

export function countingPicture(draw: PlainDraw): Drawn {
  if (draw.op === "groups" && draw.a <= 6 && draw.b <= 8) {
    return { caption: "How many bolts?", picture: blank(grid("bolt.png", draw.b, draw.a * draw.b, 28, 36, 22, 22)) };
  }
  if (draw.op === "compare") {
    return pair(draw.a, draw.b, "How many more?");
  }
  return pair(draw.a, draw.b, "How many bolts?");
}

function pair(a: number, b: number, caption: string): Drawn {
  if (a <= 10 && b <= 10) {
    return {
      caption,
      picture: blank([...row("bolt.png", a, 24, 28, 28, 28), ...row("bolt.png", b, 24, 100, 28, 28)]),
    };
  }
  return {
    caption,
    picture: blank(
      [
        { sprite: "beam-side.png", x: 36, y: 70, w: 200, h: 24 },
        { sprite: "beam-side.png", x: 270, y: 70, w: 200, h: 24 },
      ],
      [
        { text: String(a), x: 100, y: 36 },
        { text: String(b), x: 340, y: 36 },
      ],
    ),
  };
}
