export type PlainOp = "add" | "sub" | "mul" | "div" | "rem" | "frac" | "percent" | "compare" | "groups" | "missing" | "area" | "hyp" | "angle" | "square" | "line" | "eq";

export type PlainDraw = {
  op: PlainOp;
  a: number;
  b: number;
  c?: number;
};

export type PictureBit = {
  slot: string;
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
