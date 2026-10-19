import { blank, grid, row, type Drawn, type PlainDraw } from "./parts";

export function dividingPicture(draw: PlainDraw): Drawn {
  if (draw.op === "rem") {
    const divisor = Math.max(1, draw.b);
    const whole = draw.a - (draw.c ?? 0);
    const per = Math.max(1, Math.round(whole / divisor));
    const rows = Math.min(divisor, 6);
    return {
      caption: "How many are left?",
      picture: blank(
        [...grid("bolt.png", Math.min(per, 10), Math.min(rows * Math.min(per, 10), 40), 24, 24, 18, 18), ...row("bolt.png", draw.c ?? 1, 400, 70, 22, 22)],
        draw.a > 40 ? [{ text: String(draw.a), x: 24, y: 4 }] : [],
      ),
    };
  }
  const rows = Math.max(1, Math.min(draw.b, 8));
  const each = Math.max(1, Math.round(draw.a / Math.max(draw.b, 1)));
  const per = Math.min(each, 10);
  const width = per * 24;
  const x = Math.max(16, (500 - width) / 2);
  const bits = grid("bolt.png", per, Math.min(rows * per, 60), x, 20, 20, 20);
  const labels = [];
  if (draw.c === -1) {
    labels.push({ text: "−", x: 8, y: 70 });
  }
  if (draw.a > 60) {
    labels.push({ text: String(draw.a), x: 28, y: 4 });
  }
  return { caption: draw.c === -1 ? "What is the result?" : "How many in a row?", picture: blank(bits, labels) };
}
