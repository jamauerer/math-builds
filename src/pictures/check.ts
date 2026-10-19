import type { Picture } from "./parts";

export function numberTokens(text: string): string[] {
  return text.split(/[^0-9.]+/).filter((part) => part.length > 0 && part !== ".");
}

function near(left: number, right: number): boolean {
  return Number.isFinite(left) && Math.abs(left - right) < 0.06;
}

/** A served picture: labels are numbers from the question, and the answer can be read off it. */
export function pictureAgrees(prompt: string, answer: string, picture: Picture): boolean {
  const allowed = new Set(numberTokens(prompt));
  const labelText = [...picture.labels.map((label) => label.text), picture.measure?.text ?? ""].join(" ");
  for (const token of numberTokens(labelText)) {
    if (!allowed.has(token)) {
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
    return groups.some((count) => near(count, target));
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
