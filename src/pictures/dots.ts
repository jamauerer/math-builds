import type { Drawn, PictureBit, PlainDraw } from "./parts";

/** Equal groups of dots for A1, A2, S1, S2, M1 and D1. D1 is the total split into equal groups. */
export function dotGroups(draw: { op: string; a: number; b: number }): number[] {
  if (draw.op === "div") {
    const groups = Math.max(1, Math.min(5, Math.abs(Math.round(draw.b)) || 1));
    const each = Math.max(1, Math.round(Math.abs(draw.a) / Math.max(Math.abs(draw.b), 1)));
    return Array.from({ length: groups }, () => Math.min(8, each));
  }
  if (draw.op === "mul" || draw.op === "groups") {
    const rows = Math.max(1, Math.min(5, Math.abs(Math.round(draw.a)) || 1));
    const each = Math.max(1, Math.min(8, Math.abs(Math.round(draw.b)) || 1));
    return Array.from({ length: rows }, () => each);
  }
  if (draw.op === "sub") {
    return [Math.max(0, Math.min(12, Math.abs(Math.round(draw.a))))];
  }
  return [draw.a, draw.b].filter((count) => count > 0).map((count) => Math.min(12, Math.abs(Math.round(count))));
}

export function dotsPicture(draw: PlainDraw): Drawn {
  const groups = dotGroups(draw);
  const bits: PictureBit[] = [];
  groups.forEach((count, row) => {
    for (let index = 0; index < count; index += 1) {
      bits.push({
        slot: `dot-${row}`,
        sprite: "bolt.png",
        x: 16 + index * 18,
        y: 36 + row * 22,
        w: 14,
        h: 14,
      });
    }
  });
  const labels = [{ text: String(Math.abs(draw.a)), x: 8, y: 4 }];
  if (draw.b) {
    labels.push({ text: String(Math.abs(draw.b)), x: 56, y: 4 });
  }
  return {
    caption: "",
    picture: { banks: false, ruler: false, bits, labels },
  };
}
