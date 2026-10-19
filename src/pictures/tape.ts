import type { PictureBit, Tape } from "./parts";

/**
 * A tape along the feet of the posts. Ticks every unit. Numbers every unit
 * when they fit, and always at the posts' marks.
 */
export function tapeOnPosts(bits: Pick<PictureBit, "slot" | "x" | "y" | "w" | "h">[], marks: number[]): Tape {
  const posts = bits.filter((bit) => bit.slot.startsWith("post-")).sort((a, b) => a.x - b.x);
  const values = marks.filter((mark) => Number.isFinite(mark));
  const lo = values.length > 0 ? Math.min(...values) : 0;
  const hi = Math.max(lo + 1, values.length > 0 ? Math.max(...values) : 8);
  let x1 = 72;
  let x2 = 440;
  let foot = 150;
  if (posts.length >= 1) {
    x1 = posts[0].x + posts[0].w / 2;
    x2 = posts[posts.length - 1].x + posts[posts.length - 1].w / 2;
    foot = Math.max(...posts.map((post) => post.y + post.h));
  }
  if (x2 - x1 < 40) {
    x1 = 72;
    x2 = 440;
  }
  const span = hi - lo;
  const count = Math.round(span);
  const step = count <= 12 ? 1 : Math.ceil(count / 12);
  const ticks = [];
  for (let value = lo; value <= hi + 0.001; value += 1) {
    const x = x1 + ((value - lo) / span) * (x2 - x1);
    const atMark = values.some((mark) => Math.abs(mark - value) < 0.001);
    const numbered = value === lo || value === hi || atMark || step === 1 || Math.round(value - lo) % step === 0;
    ticks.push({ x, label: numbered ? String(Math.round(value)) : "" });
  }
  const goat = x1 >= 70 ? { x: x1 - 62, y: foot - 56 } : null;
  return {
    x: x1 - 12,
    y: foot - 2,
    w: x2 - x1 + 24,
    h: 18,
    ticks,
    goat,
  };
}
