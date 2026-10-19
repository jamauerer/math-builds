import { blank, row, type Drawn, type PlainDraw } from "./parts";
import { dividingPicture } from "./dividing";

export function fractionsPicture(draw: PlainDraw): Drawn {
  if (draw.op !== "frac") {
    return dividingPicture(draw);
  }
  const whole = draw.c ?? draw.b;
  const colored = Math.round((draw.a / Math.max(draw.b, 1)) * whole);
  const shown = Math.min(whole, 12);
  const tinted = Math.round((colored / Math.max(whole, 1)) * shown);
  return {
    caption: "How many are colored?",
    picture: blank(row("plank-side.png", shown, 20, 78, 36, 16, 4).map((bit, index) => ({ ...bit, mark: index < tinted })), [
      { text: `${draw.a}/${draw.b}`, x: 20, y: 28 },
    ]),
  };
}
