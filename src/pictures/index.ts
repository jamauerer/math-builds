import { algebraPicture } from "./algebra";
import { addingPicture } from "./adding";
import { countingPicture } from "./counting";
import { dividingPicture } from "./dividing";
import { fractionsPicture } from "./fractions";
import { geometryPicture } from "./geometry";
import { measuringPicture } from "./measuring";
import { multiplyingPicture } from "./multiplying";
import { ratiosPicture } from "./ratios";
import type { Drawn, PictureLabel, PlainDraw } from "./parts";

const generators: Record<string, (draw: PlainDraw) => Drawn> = {
  counting: countingPicture,
  adding: addingPicture,
  multiplying: multiplyingPicture,
  dividing: dividingPicture,
  fractions: fractionsPicture,
  ratios: ratiosPicture,
  measuring: measuringPicture,
  geometry: geometryPicture,
  algebra: algebraPicture,
};

export function drawPlain(strandId: string, draw: PlainDraw, answer: string): Drawn | null {
  const make = generators[strandId] ?? generators.algebra;
  const drawn = make(draw);
  if (drawn.picture.bits.length === 0) {
    return null;
  }
  const token = answer.replace(/^-/, "");
  if (token.length > 0 && drawn.caption.split(/[^0-9.]+/).includes(token)) {
    return null;
  }
  const labels = drawn.picture.labels.filter((label) => !leaks(label, token));
  const measure = drawn.picture.measure && leaks({ text: drawn.picture.measure.text, x: 0, y: 0 }, token) ? undefined : drawn.picture.measure;
  const shown = [drawn.caption, ...labels.map((label) => label.text), measure?.text ?? ""].join(" ");
  const tokens = new Set(shown.split(/[^0-9.]+/).filter((part) => part.length > 0));
  const needed = [draw.a, draw.b, ...(draw.c != null && draw.c !== -1 ? [draw.c] : [])].map(String).filter((part) => part !== token);
  if (needed.some((part) => !tokens.has(part))) {
    return null;
  }
  return { caption: drawn.caption, picture: { ...drawn.picture, labels, measure } };
}

function leaks(label: PictureLabel, token: string): boolean {
  if (token.length === 0) {
    return false;
  }
  return label.text.split(/[^0-9.]+/).filter((part) => part.length > 0).includes(token);
}
