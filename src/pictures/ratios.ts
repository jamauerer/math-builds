import { blank, row, type Drawn, type PlainDraw } from "./parts";
import { multiplyingPicture } from "./multiplying";

export function ratiosPicture(draw: PlainDraw): Drawn {
  if (draw.op !== "percent") {
    return multiplyingPicture(draw);
  }
  const parts = 10;
  const colored = Math.round(draw.a / 10);
  return {
    caption: "How many?",
    picture: blank(
      row("plank-side.png", parts, 30, 80, 40, 18, 6).map((bit, index) => ({ ...bit, mark: index < colored })),
      [
        { text: `${draw.a}%`, x: 30, y: 24 },
        { text: String(draw.b), x: 160, y: 24 },
      ],
    ),
  };
}
