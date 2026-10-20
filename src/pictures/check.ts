import { figureLetters, pictureHasInk } from "./need";
import type { Picture } from "./parts";

export function numberTokens(text: string): string[] {
  return text.split(/[^0-9.]+/).filter((part) => part.length > 0 && part !== ".");
}

function near(left: number, right: number): boolean {
  return Number.isFinite(left) && Math.abs(left - right) < 0.06;
}

function angleName(deg: number): "right" | "acute" | "obtuse" {
  if (Math.abs(deg - 90) < 1) {
    return "right";
  }
  return deg < 90 ? "acute" : "obtuse";
}

function figureAgrees(prompt: string, answer: string, picture: Picture): boolean | null {
  const figure = picture.figure;
  if (!figure) {
    return null;
  }
  if (figure.kind === "angle") {
    return answer.toLowerCase() === angleName(figure.deg);
  }
  if (figure.kind === "shape") {
    if (/corner|side/i.test(prompt)) {
      const count = figure.name === "triangle" ? 3 : figure.name === "square" ? 4 : 0;
      return near(count, Number(answer));
    }
    return answer.toLowerCase() === figure.name;
  }
  if (figure.kind === "frac-tape") {
    if (/^[A-Z]$/i.test(answer)) {
      const asked = prompt.match(/(\d+)\s*\/\s*(\d+)/);
      if (!asked) {
        return figure.marks.some((mark) => mark.letter === answer);
      }
      const target = Number(asked[1]) / Number(asked[2]);
      const hit = figure.marks.find((mark) => near(mark.at, target));
      return hit?.letter === answer;
    }
    const frac = answer.match(/^(\d+)\s*\/\s*(\d+)$/);
    if (frac) {
      const target = Number(frac[1]) / Number(frac[2]);
      return figure.marks.some((mark) => near(mark.at, target) && !mark.letter);
    }
    return false;
  }
  if (figure.kind === "line") {
    const slope = figure.rise / Math.max(figure.run, 1);
    if (answer.includes("/")) {
      const [n, d] = answer.split("/").map(Number);
      return near(n / Math.max(d, 1), slope);
    }
    return near(Number(answer), slope);
  }
  return null;
}

function tapeTickNumbers(picture: Picture): Set<string> {
  const ticks = new Set<string>();
  for (const tick of picture.tape?.ticks ?? []) {
    if (tick.label && /^\d+(\.\d+)?$/.test(tick.label)) {
      ticks.add(tick.label);
    }
  }
  return ticks;
}

/** A served picture: labels, marks and letters agree with the prompt and the right answer. */
export function pictureAgrees(prompt: string, answer: string, picture: Picture): boolean {
  if (!pictureHasInk(picture)) {
    return false;
  }
  const figured = figureAgrees(prompt, answer, picture);
  if (figured != null) {
    return figured;
  }
  const letters = figureLetters(picture);
  if (letters.length > 0 && /^[A-Z]$/i.test(answer)) {
    return letters.includes(answer);
  }
  const allowed = new Set(numberTokens(prompt));
  const ruler = tapeTickNumbers(picture);
  const labelText = [...picture.labels.map((label) => label.text), picture.measure?.text ?? ""].join(" ");
  for (const token of numberTokens(labelText)) {
    if (!allowed.has(token) && !ruler.has(token)) {
      return false;
    }
  }
  const target = Number(answer);
  if (!Number.isFinite(target)) {
    // Choice answers are words or labels; the picture shows the situation, not the word.
    return true;
  }
  const marked = picture.bits.filter((bit) => bit.mark).length;
  if (marked > 0 && near(marked, target)) {
    return true;
  }
  const planks = picture.bits.filter((bit) => bit.slot.startsWith("plank")).length;
  if (planks > 0 && near(planks, target)) {
    return true;
  }
  const nums = numberTokens(picture.labels.map((label) => label.text).join(" ")).map(Number);
  const counts = new Map<string, number>();
  for (const bit of picture.bits) {
    const kind = bit.slot.split("-")[0];
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }
  const groups = [...counts.values()];
  if (nums.length === 0) {
    return groups.some((count) => near(count, target)) || Boolean(picture.tape);
  }
  if (nums.length === 1) {
    const value = nums[0];
    return groups.some((count) => count > 0 && [value / count, value * count, value + count, value - count, count - value].some((option) => near(option, target)));
  }
  const [a, b, c] = nums;
  const options = [a + b, a - b, b - a, a * b, b ? a / b : NaN, a ? b / a : NaN, Math.hypot(a, b)];
  if (c != null && b) {
    options.push((a / b) * c);
  }
  return options.some((option) => near(option, target));
}

/** If the picture has letter marks, the choices must be those letters. */
export function choicesMatchPicture(choices: { value: string }[] | undefined, picture: Picture): boolean {
  if (!choices || choices.length === 0) {
    return true;
  }
  const letters = figureLetters(picture);
  if (letters.length === 0) {
    return true;
  }
  const values = choices.map((choice) => choice.value);
  return letters.every((letter) => values.includes(letter)) && values.every((value) => letters.includes(value));
}
