import { blank, type Drawn, type PlainDraw } from "./parts";

export function geometryPicture(draw: PlainDraw): Drawn {
  if (draw.op === "hyp") {
    const width = 180;
    const height = 110;
    const x = 150;
    const y = 140;
    return {
      caption: "How long is the beam?",
      picture: blank(
        [
          { sprite: "beam-side.png", x, y, w: width, h: 18 },
          { sprite: "post.png", x: x - 8, y: y - height, w: 24, h: height },
          {
            sprite: "beam-half.png",
            x,
            y: y - height,
            w: Math.hypot(width, height),
            h: 16,
            rotate: (Math.atan2(height, width) * 180) / Math.PI,
          },
        ],
        [
          { text: String(draw.a), x: x + 60, y: y + 6 },
          { text: String(draw.b), x: x - 56, y: y - 60 },
        ],
      ),
    };
  }
  if (draw.op === "angle") {
    return {
      caption: "How big is the other angle?",
      picture: blank(
        [
          { sprite: "beam-side.png", x: 140, y: 130, w: 200, h: 18 },
          { sprite: "post.png", x: 132, y: 24, w: 24, h: 106 },
          {
            sprite: "beam-half.png",
            x: 150,
            y: 30,
            w: 220,
            h: 16,
            rotate: 28,
          },
        ],
        [{ text: `${draw.a}°`, x: 180, y: 90 }],
      ),
    };
  }
  const width = 80 + draw.a * 16;
  const height = 40 + draw.b * 8;
  return {
    caption: "How big is it?",
    picture: blank(
      [
        { sprite: "beam-side.png", x: 140, y: 40, w: Math.min(width, 280), h: 16 },
        { sprite: "beam-side.png", x: 140, y: 40 + Math.min(height, 90), w: Math.min(width, 280), h: 16 },
        { sprite: "post.png", x: 132, y: 40, w: 18, h: Math.min(height, 90) },
        { sprite: "post.png", x: 132 + Math.min(width, 280), y: 40, w: 18, h: Math.min(height, 90) },
      ],
      [
        { text: String(draw.a), x: 160, y: 18 },
        { text: String(draw.b), x: 80, y: 70 },
      ],
    ),
  };
}
