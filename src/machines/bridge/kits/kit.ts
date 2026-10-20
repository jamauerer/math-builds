import { formatLength, lengthAbbrev } from "../../../units";
import raw from "./queen-post.json";

export type DunkTag = "general" | "short beam" | "long beam" | "missing planks" | "missing brace" | "missing post";

export type KitNode = { id: string; m: number; h: number };

export type KitGroup = {
  id: string;
  name: string;
  count: number;
  sprite: string;
  blurb: string;
  strand: string;
  lengthLabel: string;
  questions?: string;
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
  coming?: string;
  marks?: number;
};

export type QueenPostKit = {
  version: number;
  id: string;
  name: string;
  intro: string;
  kind: string;
  span: number;
  marks: number;
  pxPerMetre: number;
  scene: { width: number; height: number; originX: number; deckY: number; waterY: number };
  nodes: KitNode[];
  groups: KitGroup[];
  rounds: KitRound[];
  guide: { piece: string; say: string }[];
  dunks: { line: string; cause: DunkTag }[];
  bigDunks: { line: string; cause: DunkTag }[];
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
  if (id === "planks" || id.startsWith("plank")) {
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

export function waterWorld(): number {
  return -queenPost.scene.waterY;
}

export function waterPixel(): number {
  return queenPost.scene.deckY - queenPost.pxPerMetre * waterWorld();
}

export type PieceRow = {
  id: string;
  name: string;
  state: "fit" | "short" | "long" | "missing" | "broke";
  by: number;
  caused: boolean;
};

export type WreckCause = { kind: "planks" | "joint" | "support"; id: string; name: string };

export function pieceRows(lengths: Record<string, number>, cause: WreckCause | null, broke: string[] = []): PieceRow[] {
  const rows: PieceRow[] = [];
  const planks = plankSlots();
  const laid = planks.filter((slot) => lengths[slot.id] != null);
  if (laid.length < planks.length) {
    rows.push({ id: "planks", name: "Planks", state: "missing", by: planks.length - laid.length, caused: cause?.kind === "planks" });
  }
  for (const slot of queenPost.slots) {
    if (slot.kind === "plank" || slot.kind === "gusset" || slot.kind === "bolt" || slot.bonus || slot.length == null) {
      continue;
    }
    const typed = lengths[slot.id];
    const brokeThis = broke.includes(slot.id) || cause?.id === slot.id && cause.kind === "joint";
    if (typed == null) {
      rows.push({ id: slot.id, name: slot.name, state: "missing", by: slot.length, caused: cause?.id === slot.id });
      continue;
    }
    const delta = slot.length - typed;
    if (brokeThis) {
      rows.push({ id: slot.id, name: slot.name, state: "broke", by: 0, caused: cause?.id === slot.id });
    } else if (delta > 0.05) {
      rows.push({ id: slot.id, name: slot.name, state: "short", by: delta, caused: cause?.id === slot.id });
    } else if (delta < -0.05) {
      rows.push({ id: slot.id, name: slot.name, state: "long", by: -delta, caused: false });
    } else {
      rows.push({ id: slot.id, name: slot.name, state: "fit", by: 0, caused: false });
    }
  }
  return rows;
}

export function rowLabel(row: PieceRow): string {
  if (row.state === "short") {
    return `short by ${formatLength(row.by)}`;
  }
  if (row.state === "long") {
    return `long by ${formatLength(row.by)}`;
  }
  if (row.state === "missing") {
    return "missing";
  }
  if (row.state === "broke") {
    return "broke";
  }
  return "fit";
}

export function causeText(cause: WreckCause | null): string {
  if (!cause) {
    return "A piece let go.";
  }
  if (cause.kind === "planks") {
    return "No planks: the goat stepped into the floor that is not there.";
  }
  if (cause.kind === "joint") {
    return `${cause.name} broke.`;
  }
  return `${cause.name} lost support.`;
}

export function causeHint(cause: WreckCause | null, lengths: Record<string, number>): string | null {
  const tag = dunkTag(cause, lengths);
  if (tag === "missing planks") {
    return "Next time, count the planks.";
  }
  if (tag === "short beam") {
    return "Next time, make that beam longer.";
  }
  if (tag === "long beam") {
    return "Next time, make that beam shorter.";
  }
  if (tag === "missing brace") {
    return "Next time, put the braces on.";
  }
  if (tag === "missing post") {
    return "Next time, stand the posts up.";
  }
  return null;
}

export function dunkTag(cause: WreckCause | null, lengths: Record<string, number>): DunkTag {
  if (!cause) {
    return "general";
  }
  if (cause.kind === "planks") {
    return "missing planks";
  }
  if (cause.id.startsWith("brace") && lengths[cause.id] == null) {
    return "missing brace";
  }
  if (cause.id.startsWith("post") && lengths[cause.id] == null) {
    return "missing post";
  }
  const slot = queenPost.slots.find((item) => item.id === cause.id);
  if (slot?.length != null && lengths[slot.id] != null) {
    const delta = slot.length - lengths[slot.id];
    if (delta > 0.05) {
      return "short beam";
    }
    if (delta < -0.05) {
      return "long beam";
    }
  }
  return "general";
}

export function stareLine(lengths: Record<string, number>, cause: WreckCause | null = null, heavy = false): string {
  const tag = dunkTag(cause, lengths);
  const lines = heavy ? queenPost.bigDunks : queenPost.dunks;
  const tagged = lines.filter((item) => item.cause === tag);
  const pool = tagged.length > 0 ? tagged : lines.filter((item) => item.cause === "general");
  if (lengths.top === 3 && !heavy) {
    const named = pool.find((item) => item.line.includes("needed a 4")) ?? queenPost.dunks.find((item) => item.line.includes("needed a 4"));
    if (named) {
      return named.line;
    }
  }
  const key = `${tag}|${Object.entries(lengths)
    .map(([id, value]) => `${id}:${value}`)
    .join("|")}`;
  let hash = 0;
  for (const char of key) {
    hash = (hash + char.charCodeAt(0)) % pool.length;
  }
  return pool[hash]?.line ?? pool[0].line;
}

function isDunkTag(value: string): value is DunkTag {
  switch (value) {
    case "general":
    case "short beam":
    case "long beam":
    case "missing planks":
    case "missing brace":
    case "missing post":
      return true;
    default:
      return false;
  }
}

function isSlotKind(value: string): value is KitSlot["kind"] {
  switch (value) {
    case "beam":
    case "post":
    case "brace":
    case "gusset":
    case "bolt":
    case "rail":
    case "plank":
      return true;
    default:
      return false;
  }
}

function readObject(value: unknown, label: string): Record<string, unknown> {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function readString(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string`);
  }
  return value;
}

function readNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} must be a number`);
  }
  return value;
}

function readArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }
  return value;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function optionalBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function readDunk(value: unknown): { line: string; cause: DunkTag } {
  const dunk = readObject(value, "dunk");
  const cause = readString(dunk.cause, "dunk.cause");
  if (!isDunkTag(cause)) {
    throw new Error(`dunk.cause is not a known tag: ${cause}`);
  }
  return { line: readString(dunk.line, "dunk.line"), cause };
}

function readSlot(value: unknown): KitSlot {
  const slot = readObject(value, "slot");
  const kind = readString(slot.kind, "slot.kind");
  if (!isSlotKind(kind)) {
    throw new Error(`slot.kind is not a known kind: ${kind}`);
  }
  return {
    id: readString(slot.id, "slot.id"),
    group: readString(slot.group, "slot.group"),
    name: readString(slot.name, "slot.name"),
    kind,
    sprite: readString(slot.sprite, "slot.sprite"),
    from: optionalString(slot.from),
    to: optionalString(slot.to),
    at: optionalString(slot.at),
    length: slot.length == null ? null : readNumber(slot.length, "slot.length"),
    structural: optionalBoolean(slot.structural),
    bonus: optionalBoolean(slot.bonus),
    need: optionalString(slot.need),
  };
}

function readGroup(value: unknown): KitGroup {
  const group = readObject(value, "group");
  return {
    id: readString(group.id, "group.id"),
    name: readString(group.name, "group.name"),
    count: readNumber(group.count, "group.count"),
    sprite: readString(group.sprite, "group.sprite"),
    blurb: readString(group.blurb, "group.blurb"),
    strand: readString(group.strand, "group.strand"),
    lengthLabel: readString(group.lengthLabel, "group.lengthLabel"),
    questions: optionalString(group.questions),
    bonus: optionalBoolean(group.bonus),
  };
}

function readRound(value: unknown): KitRound {
  const round = readObject(value, "round");
  const runs: Record<string, number> = {};
  for (const [id, amount] of Object.entries(readObject(round.runs, "round.runs"))) {
    runs[id] = readNumber(amount, `round.runs.${id}`);
  }
  return {
    groups: readArray(round.groups, "round.groups").map((id, index) => readString(id, `round.groups.${index}`)),
    runs,
    trial: readString(round.trial, "round.trial"),
    say: readString(round.say, "round.say"),
    coming: optionalString(round.coming),
    marks: typeof round.marks === "number" ? round.marks : undefined,
  };
}

function readQueenPost(value: unknown): QueenPostKit {
  const kit = readObject(value, "queen-post");
  const scene = readObject(kit.scene, "scene");
  return {
    version: readNumber(kit.version, "version"),
    id: readString(kit.id, "id"),
    name: readString(kit.name, "name"),
    intro: readString(kit.intro, "intro"),
    kind: readString(kit.kind, "kind"),
    span: readNumber(kit.span, "span"),
    marks: readNumber(kit.marks, "marks"),
    pxPerMetre: readNumber(kit.pxPerMetre, "pxPerMetre"),
    scene: {
      width: readNumber(scene.width, "scene.width"),
      height: readNumber(scene.height, "scene.height"),
      originX: readNumber(scene.originX, "scene.originX"),
      deckY: readNumber(scene.deckY, "scene.deckY"),
      waterY: readNumber(scene.waterY, "scene.waterY"),
    },
    nodes: readArray(kit.nodes, "nodes").map((node, index) => {
      const item = readObject(node, `nodes.${index}`);
      return {
        id: readString(item.id, `nodes.${index}.id`),
        m: readNumber(item.m, `nodes.${index}.m`),
        h: readNumber(item.h, `nodes.${index}.h`),
      };
    }),
    groups: readArray(kit.groups, "groups").map(readGroup),
    rounds: readArray(kit.rounds, "rounds").map(readRound),
    guide: readArray(kit.guide, "guide").map((step, index) => {
      const item = readObject(step, `guide.${index}`);
      return { piece: readString(item.piece, `guide.${index}.piece`), say: readString(item.say, `guide.${index}.say`) };
    }),
    dunks: readArray(kit.dunks, "dunks").map(readDunk),
    bigDunks: readArray(kit.bigDunks, "bigDunks").map(readDunk),
    slots: readArray(kit.slots, "slots").map(readSlot),
  };
}

export const queenPost = readQueenPost(raw);

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

/** Pixel sizes for the deck stack: plank on beam on abutment. */
export const BEAM_THICK_PX = 22;
export const PLANK_THICK_PX = 16;

/** CSS top of the abutment (deck minus beam minus plank thickness). Sunk so plank tops sit on the deck line. */
export function abutmentTopPx(): number {
  return queenPost.scene.deckY + PLANK_THICK_PX + BEAM_THICK_PX;
}

/** CSS left of each abutment: outer edge 0.3 m inside the bank face at 0 m / 8 m. */
export function abutmentLeftPx(side: "left" | "right", width = 110): number {
  const inset = 0.3 * queenPost.pxPerMetre;
  if (side === "left") {
    return queenPost.scene.originX - inset - width;
  }
  return queenPost.scene.originX + 8 * queenPost.pxPerMetre + inset;
}

/** Dotted-slot label: where the piece runs, never how long it is. */
export function slotRunLabel(slot: KitSlot): string {
  if (slot.kind === "post" && slot.from) {
    const at = kitNode(slot.from);
    return `at ${formatLength(at.m)}`;
  }
  const nodes = slotNodes(slot);
  if (!nodes) {
    return slot.name;
  }
  if (slot.kind === "brace") {
    return `${formatLength(nodes.from.m)} → ${formatLength(nodes.to.m)}`;
  }
  if (Math.abs(nodes.from.h - nodes.to.h) < 0.02) {
    const left = Math.min(nodes.from.m, nodes.to.m);
    const right = Math.max(nodes.from.m, nodes.to.m);
    return `${formatLength(left)}–${formatLength(right)}`;
  }
  return `${formatLength(nodes.from.m)} to ${formatLength(nodes.to.m)}`;
}

/**
 * Handwriting strip facts for a focused slot. Positions come from kit nodes.
 * Never states the length the learner must find.
 */
export function slotFact(slot: KitSlot, printed = false): string {
  const nodes = slotNodes(slot);
  if (slot.kind === "post" && slot.from && slot.to) {
    const foot = kitNode(slot.from);
    const top = kitNode(slot.to);
    const tall = Math.abs(top.h - foot.h);
    const base = `This post stands at ${formatLength(foot.m)} and is ${formatLength(tall)} tall.`;
    return printed ? `${base} The number is on the piece.` : `${base}`;
  }
  if (slot.kind === "brace" && nodes) {
    const deck = nodes.from.h <= nodes.to.h ? nodes.from : nodes.to;
    const peak = nodes.from.h > nodes.to.h ? nodes.from : nodes.to;
    return `This brace goes from ${formatLength(deck.m)} on the deck up to the top of the post at ${formatLength(peak.m)}.${printed ? " The number is on the piece." : " How long?"}`;
  }
  if (slot.id === "top" && nodes) {
    return `The top beam runs from the left post to the right post, ${formatLength(nodes.from.m)} to ${formatLength(nodes.to.m)}.${printed ? " The number is on the piece." : " How long?"}`;
  }
  if (slot.kind === "beam" && nodes) {
    const left = Math.min(nodes.from.m, nodes.to.m);
    const right = Math.max(nodes.from.m, nodes.to.m);
    return `It runs from ${formatLength(left)} to ${formatLength(right)} on the tape.${printed ? "" : " How long?"}`;
  }
  if (slot.kind === "plank") {
    return `${formatLength(queenPost.span)} of bridge, ${formatLength(1)} each, so ${plankSlots().length} planks.`;
  }
  if (slot.kind === "gusset") {
    return "They go on every corner.";
  }
  return knownLine();
}

export function gussetSlots(): KitSlot[] {
  return queenPost.slots.filter((slot) => slot.kind === "gusset");
}

export function nextGusset(placed: Record<string, boolean>): KitSlot | null {
  return gussetSlots().find((slot) => !placed[slot.id]) ?? null;
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
