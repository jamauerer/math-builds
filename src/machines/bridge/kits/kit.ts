import { formatLength, lengthAbbrev } from "../../../units";
import raw from "./queen-post.json";

export type KitNode = { id: string; m: number; h: number };

export type KitGroup = {
  id: string;
  name: string;
  count: number;
  sprite: string;
  blurb: string;
  lengthLabel: string;
  bonus?: boolean;
};

export type KitSlot = {
  id: string;
  group: string;
  name: string;
  kind: "beam" | "post" | "brace" | "gusset" | "bolt" | "rail";
  sprite: string;
  from?: string;
  to?: string;
  at?: string;
  length: number | null;
  structural?: boolean;
  bonus?: boolean;
  need?: string;
};

export type QueenPostKit = {
  id: string;
  name: string;
  kind: string;
  span: number;
  marks: number;
  pxPerMetre: number;
  scene: { width: number; height: number; originX: number; deckY: number };
  nodes: KitNode[];
  groups: KitGroup[];
  slots: KitSlot[];
};

export const queenPost = raw as QueenPostKit;

export const PX_PER_M = queenPost.pxPerMetre;

export function kitNode(id: string): KitNode {
  const node = queenPost.nodes.find((item) => item.id === id);
  if (!node) {
    throw new Error(`Unknown kit node ${id}`);
  }
  return node;
}

/** Node (m, h) maps to scene pixels. Deck top is y = 355, gap starts at x = 292. */
export function nodePixel(node: KitNode): { x: number; y: number } {
  return {
    x: queenPost.scene.originX + PX_PER_M * node.m,
    y: queenPost.scene.deckY - PX_PER_M * node.h,
  };
}

export function slotNodes(slot: KitSlot): { from: KitNode; to: KitNode } | null {
  if (!slot.from || !slot.to) {
    return null;
  }
  return { from: kitNode(slot.from), to: kitNode(slot.to) };
}

/** End of a piece that starts at its from-node and runs toward its to-node for `typed` metres. */
export function pieceEnd(slot: KitSlot, typed: number): { m: number; h: number } {
  const nodes = slotNodes(slot);
  if (!nodes) {
    const at = kitNode(slot.at ?? "n0");
    return { m: at.m, h: at.h };
  }
  const dx = nodes.to.m - nodes.from.m;
  const dy = nodes.to.h - nodes.from.h;
  const span = Math.hypot(dx, dy) || 1;
  return {
    m: nodes.from.m + (dx / span) * typed,
    h: nodes.from.h + (dy / span) * typed,
  };
}

export function lengthDelta(slot: KitSlot, typed: number): number {
  if (slot.length == null) {
    return 0;
  }
  return Math.round((slot.length - typed) * 100) / 100;
}

export function wreckLine(slot: KitSlot, typed: number): string | null {
  if (slot.length == null || slot.bonus) {
    return null;
  }
  const delta = lengthDelta(slot, typed);
  if (Math.abs(delta) < 0.05) {
    if (slot.id === "post-b") {
      return null;
    }
    return null;
  }
  const short = delta > 0;
  const amount = Math.abs(delta);
  const way = short ? "short" : "long";
  if (slot.id === "top" && slot.need) {
    return `Top beam, ${formatLength(typed)}, needed ${slot.need} ${lengthAbbrev()}, ${formatLength(amount)} ${way}`;
  }
  return `${slot.name}, ${formatLength(typed)}, needed ${formatLength(slot.length)}, ${formatLength(amount)} ${way}`;
}

/** When the top beam does not reach the far post, that post has nothing to hold. */
export function wreckLines(lengths: Record<string, number>): string[] {
  const lines: string[] = [];
  for (const slot of queenPost.slots) {
    if (slot.length == null || lengths[slot.id] == null) {
      continue;
    }
    const line = wreckLine(slot, lengths[slot.id]);
    if (line) {
      lines.push(line);
    }
  }
  const top = queenPost.slots.find((slot) => slot.id === "top");
  const post = queenPost.slots.find((slot) => slot.id === "post-b");
  if (top && post && lengths.top != null && lengthDelta(top, lengths.top) > 0.05) {
    lines.push(`Right post, ${formatLength(2)}, needed ${formatLength(2)}, right length, nothing on top, fell`);
  }
  return lines;
}

export function correctLengths(): Record<string, number> {
  const lengths: Record<string, number> = {};
  for (const slot of queenPost.slots) {
    if (slot.length != null) {
      lengths[slot.id] = slot.length;
    }
  }
  return lengths;
}
