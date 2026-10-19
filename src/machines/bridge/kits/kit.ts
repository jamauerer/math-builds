import { formatLength, lengthAbbrev } from "../../../units";
import raw from "./queen-post.json";

export type KitNode = { id: string; m: number; h: number };

export type KitGroup = {
  id: string;
  name: string;
  count: number;
  sprite: string;
  blurb: string;
  strand: string;
  lengthLabel: string;
  bonus?: boolean;
};

export type KitSlot = {
  id: string;
  group: string;
  name: string;
  kind: "beam" | "post" | "brace" | "gusset" | "bolt" | "rail" | "plank";
  sprite: string;
  from?: string;
  to?: string;
  at?: string;
  length: number | null;
  structural?: boolean;
  bonus?: boolean;
  need?: string;
};

/** One sitting of a kit. `trial` is what a test of this partial build does. */
export type KitRound = {
  groups: string[];
  runs: Record<string, number>;
  trial: string;
  say: string;
};

export type QueenPostKit = {
  id: string;
  name: string;
  intro: string;
  kind: string;
  span: number;
  marks: number;
  pxPerMetre: number;
  scene: { width: number; height: number; originX: number; deckY: number };
  nodes: KitNode[];
  groups: KitGroup[];
  rounds: KitRound[];
  guide: { piece: string; say: string }[];
  dunks: string[];
  slots: KitSlot[];
};

export function preCut(measuringLevel: number): boolean {
  return measuringLevel <= 3;
}

export function plankSlots(): KitSlot[] {
  return queenPost.slots.filter((slot) => slot.kind === "plank");
}

export function plankStart(slot: KitSlot): number {
  return Math.max(0, plankSlots().findIndex((item) => item.id === slot.id));
}

/** True when a placed plank covers this point along the deck. */
export function plankCovers(lengths: Record<string, number>, x: number): boolean {
  return plankSlots().some((slot) => {
    const typed = lengths[slot.id];
    if (typed == null) {
      return false;
    }
    const start = plankStart(slot);
    return x >= start - 0.02 && x <= start + typed + 0.02;
  });
}

const TRAY_WORDS: Record<string, [string, string]> = {
  bottom: ["bottom beam", "bottom beams"],
  posts: ["post", "posts"],
  top: ["top beam", "top beams"],
  braces: ["brace", "braces"],
  gussets: ["gusset", "gussets"],
  bolts: ["bolt", "bolts"],
  railing: ["railing", "railings"],
  planks: ["plank", "planks"],
};

export function pieceGroup(id: string): string {
  if (id.startsWith("plank")) {
    return "planks";
  }
  if (id.startsWith("brace")) {
    return "braces";
  }
  if (id.startsWith("bottom")) {
    return "bottom";
  }
  if (id.startsWith("post")) {
    return "posts";
  }
  if (id === "gussets" || id.startsWith("gusset")) {
    return "gussets";
  }
  if (id === "bolts") {
    return "bolts";
  }
  if (id === "rails" || id.startsWith("rail")) {
    return "railing";
  }
  if (id === "top") {
    return "top";
  }
  return id;
}

/** Names the pieces still sitting in the tray. */
export function trayNote(ids: string[]): string | null {
  const counts = new Map<string, number>();
  for (const id of ids) {
    const group = pieceGroup(id);
    counts.set(group, (counts.get(group) ?? 0) + 1);
  }
  const parts = [...counts.entries()].map(([group, count]) => {
    const words = TRAY_WORDS[group] ?? [group, group];
    return `${count} ${count === 1 ? words[0] : words[1]}`;
  });
  if (parts.length === 0) {
    return null;
  }
  const list = parts.length === 1 ? parts[0] : parts.length === 2 ? `${parts[0]} and ${parts[1]}` : `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
  return `You still have ${list} in the tray.`;
}

export function stareLine(lengths: Record<string, number>): string {
  const lines = queenPost.dunks;
  const top = queenPost.slots.find((slot) => slot.id === "top");
  if (lengths.top === 3 && top?.length === 4) {
    return lines.find((line) => line.includes("needed a 4")) ?? lines[0];
  }
  const key = Object.entries(lengths)
    .map(([id, value]) => `${id}:${value}`)
    .join("|");
  let hash = 0;
  for (const char of key) {
    hash = (hash + char.charCodeAt(0)) % lines.length;
  }
  return lines[hash] ?? lines[0];
}

export const queenPost = raw as QueenPostKit;

/** Highest round whose structural pieces are all present in this build. */
export function testedRound(lengths: Record<string, number>): number {
  let found = 0;
  queenPost.rounds.forEach((round, index) => {
    const slots = queenPost.slots.filter((slot) => round.groups.includes(slot.group) && slot.structural && slot.length != null);
    if (slots.length > 0 && slots.every((slot) => lengths[slot.id] != null)) {
      found = index;
    }
  });
  return found;
}

export function roundTrial(lengths: Record<string, number>): string {
  return queenPost.rounds[testedRound(lengths)]?.trial ?? "cross";
}

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

/** Facts the learner can see before they type a length. */
export function knownLine(): string {
  const posts = queenPost.nodes
    .filter((node) => node.h === 0 && node.m > 0 && node.m < queenPost.span)
    .map((node) => node.m)
    .sort((a, b) => a - b);
  const stands = posts.filter((metre) => metre === 2 || metre === 6).map((metre) => formatLength(metre));
  return `The gap is ${formatLength(queenPost.span)}. The posts stand at ${stands[0]} and ${stands[1]}.`;
}

/** One handwriting line for a length the learner typed, right or wrong. */
export function typedLine(name: string, value: string): string | null {
  const parsed = Number(value);
  if (!value.trim() || !Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return `${name}: ${formatLength(parsed)}`;
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
