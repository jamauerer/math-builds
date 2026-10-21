/** Scene placement and foot sizes shared by the browser kit and the Node measurement. */

export const BANKS_LAYOUT = {
  left: -79,
  top: 224,
  width: 1158,
  height: 386,
};

export const BEAM_THICK_FT = 22 / 50;
export const PLANK_THICK_FT = 16 / 50;
export const BEAM_THICK_PX = 22;
export const PLANK_THICK_PX = 16;
export const SPAN_FT = 8;
export const BEARING_FT = 0.5;
export const SCENE_WIDTH = 1000;
export const SCENE_HEIGHT = 620;

export type KitKind = "little" | "big";

export const BANKS_FILE: Record<KitKind, string> = {
  little: "public/art/banks.png",
  big: "public/art/banks-big.png",
};

export const BANKS_NAME: Record<KitKind, string> = {
  little: "banks.png",
  big: "banks-big.png",
};

export const SPAN_FOR: Record<KitKind, number> = { little: 8, big: 16 };

export type MeasuredScene = {
  leftEdge: number;
  rightEdge: number;
  bankTopY: number;
  leftTopY: number;
  rightTopY: number;
  pxPerFt: number;
  originX: number;
  deckY: number;
  waterY: number;
  span: number;
  banks: string;
};
