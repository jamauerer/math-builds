import { blank, grid, type Drawn, type PlainDraw } from "./parts";

export function algebraPicture(draw: PlainDraw): Drawn {
  if (draw.op === "square") {
    return {
      caption: "How long is a side?",
      picture: blank(
        [
          { sprite: "beam-side.png", x: 160, y: 36, w: 160, h: 16 },
          { sprite: "beam-side.png", x: 160, y: 140, w: 160, h: 16 },
          { sprite: "post.png", x: 152, y: 36, w: 18, h: 104 },
          { sprite: "post.png", x: 310, y: 36, w: 18, h: 104 },
        ],
        [{ text: String(draw.a), x: 210, y: 78 }],
      ),
    };
  }
  if (draw.op === "line") {
    const rows = Math.min(draw.a, 6);
    const each = Math.min(draw.b, 8);
    return {
      caption: "How many bolts?",
      picture: blank(grid("bolt.png", each, rows * each, 40, 36, 24, 24), draw.a > 6 ? [{ text: String(draw.a), x: 40, y: 8 }] : []),
    };
  }
  const groups = Math.min(draw.a, 6);
  const added = Math.min(draw.b, 8);
  const bits = [
    ...Array.from({ length: groups }, (_, index) => ({
      sprite: "beam-side.png",
      x: 24 + index * 70,
      y: 70,
      w: 58,
      h: 18,
    })),
    ...Array.from({ length: added }, (_, index) => ({
      sprite: "bolt.png",
      x: 24 + groups * 70 + index * 28,
      y: 64,
      w: 24,
      h: 24,
    })),
  ];
  return {
    caption: "How many in each group?",
    picture: blank(bits, [{ text: String(draw.c ?? draw.b), x: 24, y: 24 }]),
  };
}
