import { kitNode, nodePixel, plankStart, queenPost, type KitSlot } from "../machines/bridge/kits/kit";
import type { Picture, PictureBit, PictureLabel } from "./parts";

/** Question stage. Scene pixels shift into this box; they are not placed by hand. */
const STAGE_W = 520;
const STAGE_H = 180;
const ORIGIN_X = 232;
const ORIGIN_Y = 220;

const NEEDS: Record<string, string[]> = {
  "post-a": ["bottom-a", "bottom-b"],
  "post-b": ["bottom-a", "bottom-b"],
  top: ["post-a", "post-b"],
  "brace-a": ["post-a", "bottom-a", "bottom-b"],
  "brace-b": ["post-b", "bottom-a", "bottom-b"],
  "gusset-n2": ["post-a"],
  "gusset-n6": ["post-b"],
  "gusset-n4": ["bottom-a", "bottom-b"],
  "gusset-p2": ["top", "post-a"],
  "gusset-p6": ["top", "post-b"],
  "rail-a": ["bottom-a", "bottom-b"],
  "rail-b": ["bottom-a", "bottom-b"],
  bolts: ["gusset-n4"],
};

/** Pieces a slice needs so posts, beams, planks, and braces stay supported. */
export function standing(ids: string[]): string[] {
  const chosen = new Set(ids);
  let grew = true;
  while (grew) {
    grew = false;
    for (const id of chosen) {
      const extra = id.startsWith("plank") ? ["bottom-a", "bottom-b"] : (NEEDS[id] ?? []);
      for (const need of extra) {
        if (!chosen.has(need)) {
          chosen.add(need);
          grew = true;
        }
      }
    }
  }
  return queenPost.slots.map((slot) => slot.id).filter((id) => chosen.has(id));
}

/** One kit slot, at the same place the bridge draws it. */
export function pictureSlot(id: string, mark = false): PictureBit {
  const slot = queenPost.slots.find((item) => item.id === id);
  if (!slot) {
    throw new Error(`Unknown kit slot ${id}`);
  }
  const frame = slotFrame(slot);
  const point = shift(frame.x, frame.y);
  return {
    slot: id,
    sprite: slot.sprite,
    x: point.x,
    y: point.y,
    w: frame.w,
    h: frame.h,
    rotate: frame.rotate,
    mark,
  };
}

export function labelAt(slotId: string, text: string, dy = -48): PictureLabel {
  const bit = pictureSlot(slotId);
  const lift = Math.min(dy, -48);
  return { text, x: bit.x + 8, y: Math.max(4, bit.y + lift) };
}

/** A standing subset of the kit, plus labels. */
export function slice(ids: string[], labels: PictureLabel[] = [], marks: string[] = []): Picture {
  const chosen = standing(ids);
  const tint = new Set(marks);
  return {
    banks: false,
    ruler: false,
    bits: chosen.map((id) => pictureSlot(id, tint.has(id))),
    labels,
  };
}

function shift(x: number, y: number): { x: number; y: number } {
  return { x: x - ORIGIN_X, y: y - ORIGIN_Y };
}

/** Same geometry as the bridge scene, in scene pixels. */
function slotFrame(slot: KitSlot): { x: number; y: number; w: number; h: number; rotate?: number } {
  const typed = slot.length ?? 1;
  if (slot.kind === "gusset" && slot.at) {
    const node = kitNode(slot.at);
    const point = nodePixel(node);
    return { x: point.x - 15, y: node.h === 0 ? point.y - 3 : point.y - 13, w: 30, h: 27 };
  }
  if (slot.kind === "plank") {
    return {
      x: queenPost.scene.originX + plankStart(slot) * queenPost.pxPerMetre,
      y: queenPost.scene.deckY - 16,
      w: Math.max(8, typed * queenPost.pxPerMetre),
      h: 16,
    };
  }
  if (slot.kind === "bolt") {
    return { x: 542, y: 330, w: 30, h: 17 };
  }
  if (slot.kind === "post" && slot.from) {
    const point = nodePixel(kitNode(slot.from));
    const height = Math.max(8, typed * queenPost.pxPerMetre);
    return { x: point.x - 16, y: point.y - height, w: 32, h: height };
  }
  if (!slot.from || !slot.to) {
    return { x: 0, y: 0, w: 8, h: 8 };
  }
  const fromNode = kitNode(slot.from);
  const toNode = kitNode(slot.to);
  const from = nodePixel(fromNode);
  const to = nodePixel(toNode);
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const height = slot.kind === "brace" ? 15 : slot.kind === "rail" ? 28 : 22;
  const alongDeck = slot.kind === "beam" && fromNode.h === 0 && Math.abs(angle) < 0.2;
  const top = alongDeck ? from.y : from.y - (slot.kind === "brace" ? 11 : height / 2);
  return {
    x: from.x,
    y: top,
    w: Math.max(8, typed * queenPost.pxPerMetre),
    h: height,
    rotate: Math.abs(angle) > 0.01 ? (angle * 180) / Math.PI : undefined,
  };
}

export const PICTURE_STAGE = { width: STAGE_W, height: STAGE_H };
