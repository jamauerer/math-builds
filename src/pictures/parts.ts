export type PlainOp = "add" | "sub" | "mul" | "div" | "rem" | "frac" | "percent" | "compare" | "groups" | "missing" | "area" | "hyp" | "angle" | "square" | "line" | "eq";

export type PlainDraw = {
  op: PlainOp;
  a: number;
  b: number;
  c?: number;
  /** Tape letters (A/B/C), a single mark (one), a tape reading (tape), or a graphed line (line). */
  mark?: string;
};

export type AngleFigure = {
  kind: "angle";
  deg: number;
  ox: number;
  oy: number;
  arm: number;
};

export type ShapeFigure = {
  kind: "shape";
  name: "triangle" | "square" | "circle";
};

export type FracTapeMark = {
  at: number;
  letter?: string;
};

export type FracTapeFigure = {
  kind: "frac-tape";
  parts: number;
  marks: FracTapeMark[];
};

export type LineFigure = {
  kind: "line";
  rise: number;
  run: number;
};

export type PictureFigure = AngleFigure | ShapeFigure | FracTapeFigure | LineFigure;

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

export type TapeTick = {
  x: number;
  label: string;
};

export type Tape = {
  x: number;
  y: number;
  w: number;
  h: number;
  ticks: TapeTick[];
  goat: { x: number; y: number } | null;
};

export type Picture = {
  banks: boolean;
  ruler: boolean;
  bits: PictureBit[];
  labels: PictureLabel[];
  measure?: { x: number; y: number; w: number; text: string };
  tape?: Tape;
  figure?: PictureFigure;
};

export type Drawn = {
  caption: string;
  picture: Picture;
};
