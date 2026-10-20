import type { Picture } from "./parts";

const PICTURE_WORDS =
  /\bthis\b|\bthe tape\b|\bthe shape\b|\bthe angle\b|\bthe picture\b|\bshown\b|\bon the\b/i;

/** Prompts that can only be answered by looking at a picture. */
export function promptNeedsPicture(prompt: string): boolean {
  return PICTURE_WORDS.test(prompt);
}

export function pictureHasInk(picture: Picture): boolean {
  if (picture.figure) {
    return true;
  }
  if (picture.tape && picture.tape.w > 0 && picture.tape.h > 0) {
    return true;
  }
  return picture.bits.some((bit) => bit.w > 0 && bit.h > 0);
}

export function figureLetters(picture: Picture): string[] {
  if (picture.figure?.kind === "frac-tape") {
    return picture.figure.marks.map((mark) => mark.letter).filter((letter): letter is string => Boolean(letter));
  }
  return picture.labels.map((label) => label.text).filter((text) => /^[A-Z]$/i.test(text));
}
