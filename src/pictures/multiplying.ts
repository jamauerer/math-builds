import { blank, grid, type Drawn, type PlainDraw } from "./parts";

export function multiplyingPicture(draw: PlainDraw): Drawn {
  if (draw.a <= 6 && draw.b <= 8) {
    const width = draw.b * 26;
    const x = Math.max(20, (500 - width) / 2);
    return { caption: "How many bolts?", picture: blank(grid("bolt.png", draw.b, draw.a * draw.b, x, 24, 22, 22)) };
  }
  return {
    caption: "How many bolts?",
    picture: blank(
      [
        { sprite: "beam-side.png", x: 40, y: 80, w: 180, h: 22 },
        { sprite: "beam-side.png", x: 280, y: 80, w: 180, h: 22 },
      ],
      [
        { text: String(draw.a), x: 100, y: 40 },
        { text: String(draw.b), x: 340, y: 40 },
      ],
    ),
  };
}
