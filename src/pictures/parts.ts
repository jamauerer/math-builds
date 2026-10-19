export type PlainOp = "add" | "sub" | "mul" | "div" | "rem" | "frac" | "percent" | "compare" | "groups" | "missing" | "area" | "hyp" | "angle" | "square" | "line" | "eq";

export type PlainDraw = {
  op: PlainOp;
  a: number;
  b: number;
  c?: number;
};

export type PictureBit = {
  sprite: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotate?: number;
  mark?: boolean;
};

export type PictureLabel = {
  text: string;
  x: number;
  y: number;
};

export type Picture = {
  banks: boolean;
  ruler: boolean;
  bits: PictureBit[];
  labels: PictureLabel[];
  measure?: { x: number; y: number; w: number; text: string };
};

export type Drawn = {
  caption: string;
  picture: Picture;
};

export function row(sprite: string, count: number, x: number, y: number, w: number, h: number, gap = 4, mark = false): PictureBit[] {
  const shown = Math.max(0, Math.min(count, 14));
  return Array.from({ length: shown }, (_, index) => ({
    sprite,
    x: x + index * (w + gap),
    y,
    w,
    h,
    mark,
  }));
}

export function grid(sprite: string, columns: number, count: number, x: number, y: number, w: number, h: number, gap = 3, colored = 0): PictureBit[] {
  const shown = Math.max(0, Math.min(count, 60));
  const cols = Math.max(1, columns);
  return Array.from({ length: shown }, (_, index) => ({
    sprite,
    x: x + (index % cols) * (w + gap),
    y: y + Math.floor(index / cols) * (h + gap),
    w,
    h,
    mark: index < colored,
  }));
}

export function blank(bits: PictureBit[], labels: PictureLabel[] = [], banks = false): Picture {
  return { banks, ruler: false, bits, labels };
}
