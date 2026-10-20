import { formatCount, unitSystem, type UnitSystem } from "../units";
import type { LadderLayout } from "./generate";

/** Wide enough for a finger-drawn digit. */
export const STACK_COL = 48;
export const STACK_ROW = 52;
export const STACK_SEP = 16;
export const STACK_PAD = 20;
export const STACK_MIN_W = 640;
export const STACK_MIN_H = 280;
export const STACK_FONT = 40;

export type StackRow = {
  kind: "carry" | "top" | "bottom" | "answer" | "quotient" | "dividend" | "work";
  y: number;
  height: number;
};

export type StackColumn = {
  centerX: number;
};

export type StackMark = {
  text: string;
  x: number;
  y: number;
  size?: number;
  role?: "digit" | "divisor";
};

export type StackGeom = {
  width: number;
  height: number;
  canvasWidth: number;
  canvasHeight: number;
  kind: "stacked" | "long-division";
  columns: StackColumn[];
  carry: StackRow;
  top: StackRow;
  bottom: StackRow;
  answer: StackRow;
  lineY: number;
  op?: StackMark;
  digits: StackMark[];
  seps: StackMark[];
  bracket?: { x: number; y: number; w: number; h: number };
};

export function parseDigits(value: string): string[] {
  return value.replace(/[^0-9]/g, "").split("").filter(Boolean);
}

function groupAfter(indexFromRight: number): boolean {
  return indexFromRight > 0 && indexFromRight % 3 === 0;
}

function groupMark(system: UnitSystem): string {
  return system === "us" ? "," : ".";
}

export function stackSpec(top: string, bottom: string, op: LadderLayout["op"], kind: LadderLayout["kind"] = "stacked"): LadderLayout {
  return { kind, top, bottom, op };
}

export function acrossPrompt(top: string | number, op: string, bottom: string | number): string {
  return `${formatCount(top)} ${op} ${formatCount(bottom)} = ?`;
}

export function parseStackSpec(value: string): { prompt: string; answer: string; layout: LadderLayout } | null {
  const match = value.trim().match(/^(\d+)(\+|−|-|x|×|\*|\/|÷)(\d+)$/i);
  if (!match) {
    return null;
  }
  const top = match[1];
  const rawOp = match[2];
  const bottom = match[3];
  const a = Number(top);
  const b = Number(bottom);
  if (rawOp === "+" ) {
    return { prompt: acrossPrompt(a, "+", b), answer: String(a + b), layout: stackSpec(top, bottom, "+") };
  }
  if (rawOp === "-" || rawOp === "−") {
    return { prompt: acrossPrompt(a, "−", b), answer: String(a - b), layout: stackSpec(top, bottom, "−") };
  }
  if (rawOp === "x" || rawOp === "×" || rawOp === "*") {
    return { prompt: acrossPrompt(a, "×", b), answer: String(a * b), layout: stackSpec(top, bottom, "×") };
  }
  return { prompt: acrossPrompt(a, "÷", b), answer: String(b === 0 ? 0 : a / b), layout: stackSpec(top, bottom, "÷", "long-division") };
}

export const SAMPLE_STACKS = [
  { id: "47+36", ...parseStackSpec("47+36")! },
  { id: "82-47", ...parseStackSpec("82-47")! },
  { id: "4827+3596", ...parseStackSpec("4827+3596")! },
  { id: "47x6", ...parseStackSpec("47x6")! },
  { id: "84/4", ...parseStackSpec("84/4")! },
];

export function stackGeom(layout: LadderLayout, system: UnitSystem = unitSystem()): StackGeom {
  return layout.kind === "long-division" ? longGeom(layout, system) : addGeom(layout, system);
}

function addGeom(layout: LadderLayout, system: UnitSystem): StackGeom {
  const top = parseDigits(layout.top);
  const bottom = parseDigits(layout.bottom);
  const extra = layout.op === "+" || layout.op === "×" ? 1 : 0;
  const count = Math.max(top.length, bottom.length, 1) + extra;
  const topPad = padLeft(top, count);
  const botPad = padLeft(bottom, count);
  const sepCount = Math.max(0, Math.floor((count - 1) / 3));
  const innerW = count * STACK_COL + sepCount * STACK_SEP;
  const opW = 36;
  const width = STACK_PAD * 2 + opW + innerW;
  const height = STACK_PAD * 2 + STACK_ROW * 4 + 8;
  const canvasWidth = Math.max(STACK_MIN_W, width);
  const canvasHeight = Math.max(STACK_MIN_H, height);
  const right = canvasWidth - STACK_PAD;
  const left = right - innerW;
  const columns: StackColumn[] = [];
  const seps: StackMark[] = [];
  let x = right - STACK_COL / 2;
  for (let i = 0; i < count; i += 1) {
    columns.unshift({ centerX: x });
    if (i < count - 1 && groupAfter(i + 1)) {
      x -= STACK_COL / 2 + STACK_SEP / 2;
      seps.push({ text: groupMark(system), x, y: 0 });
      x -= STACK_COL / 2 + STACK_SEP / 2;
    } else {
      x -= STACK_COL;
    }
  }
  const carryY = STACK_PAD + STACK_ROW / 2;
  const topY = STACK_PAD + STACK_ROW + STACK_ROW / 2;
  const botY = STACK_PAD + STACK_ROW * 2 + STACK_ROW / 2;
  const lineY = STACK_PAD + STACK_ROW * 3 + 2;
  const ansY = STACK_PAD + STACK_ROW * 3 + 8 + STACK_ROW / 2;
  const digits: StackMark[] = [];
  columns.forEach((col, index) => {
    if (topPad[index] && topPad[index] !== " ") {
      digits.push({ text: topPad[index], x: col.centerX, y: topY, role: "digit" });
    }
    if (botPad[index] && botPad[index] !== " ") {
      digits.push({ text: botPad[index], x: col.centerX, y: botY, role: "digit" });
    }
  });
  const placedSeps = seps.flatMap((sep) => [
    { ...sep, y: topY },
    { ...sep, y: botY },
  ]);
  return {
    width,
    height,
    canvasWidth,
    canvasHeight,
    kind: "stacked",
    columns,
    carry: { kind: "carry", y: carryY, height: STACK_ROW },
    top: { kind: "top", y: topY, height: STACK_ROW },
    bottom: { kind: "bottom", y: botY, height: STACK_ROW },
    answer: { kind: "answer", y: ansY, height: STACK_ROW },
    lineY,
    op: { text: layout.op, x: left - 22, y: botY },
    digits,
    seps: placedSeps,
  };
}

function longGeom(layout: LadderLayout, system: UnitSystem): StackGeom {
  const dividend = parseDigits(layout.top);
  const divisor = parseDigits(layout.bottom);
  const count = Math.max(dividend.length, 1);
  const sepCount = Math.max(0, Math.floor((count - 1) / 3));
  const innerW = count * STACK_COL + sepCount * STACK_SEP;
  const divW = Math.max(STACK_COL, divisor.length * 22 + 12);
  const steps = Math.max(2, count);
  const workRows = steps * 2;
  const width = STACK_PAD * 2 + divW + 16 + innerW;
  const height = STACK_PAD * 2 + STACK_ROW * (2 + workRows);
  const canvasWidth = Math.max(STACK_MIN_W, width);
  const canvasHeight = Math.max(STACK_MIN_H, height);
  const right = canvasWidth - STACK_PAD;
  const columns: StackColumn[] = [];
  const seps: StackMark[] = [];
  let x = right - STACK_COL / 2;
  for (let i = 0; i < count; i += 1) {
    columns.unshift({ centerX: x });
    if (i < count - 1 && groupAfter(i + 1)) {
      x -= STACK_COL / 2 + STACK_SEP / 2;
      seps.push({ text: groupMark(system), x, y: 0 });
      x -= STACK_COL / 2 + STACK_SEP / 2;
    } else {
      x -= STACK_COL;
    }
  }
  const quotY = STACK_PAD + STACK_ROW / 2;
  const divY = STACK_PAD + STACK_ROW + STACK_ROW / 2;
  const workY = STACK_PAD + STACK_ROW * 2 + STACK_ROW / 2;
  const digits: StackMark[] = [];
  const pad = padLeft(dividend, count);
  columns.forEach((col, index) => {
    if (pad[index] && pad[index] !== " ") {
      digits.push({ text: pad[index], x: col.centerX, y: divY, role: "digit" });
    }
  });
  digits.push({
    text: formatCount(layout.bottom, system).replace(/[^0-9.,]/g, "") || layout.bottom,
    x: columns[0].centerX - innerW / 2 - 28,
    y: divY,
    size: 32,
    role: "divisor",
  });
  const barLeft = columns[0].centerX - STACK_COL / 2;
  const barRight = columns[columns.length - 1].centerX + STACK_COL / 2;
  return {
    width,
    height,
    canvasWidth,
    canvasHeight,
    kind: "long-division",
    columns,
    carry: { kind: "carry", y: quotY, height: STACK_ROW },
    top: { kind: "quotient", y: quotY, height: STACK_ROW },
    bottom: { kind: "dividend", y: divY, height: STACK_ROW },
    answer: { kind: "work", y: workY, height: STACK_ROW * workRows },
    lineY: STACK_PAD + STACK_ROW + 4,
    digits,
    seps: seps.map((sep) => ({ ...sep, y: divY })),
    bracket: { x: barLeft - 4, y: STACK_PAD + STACK_ROW + 2, w: barRight - barLeft + 8, h: STACK_ROW },
  };
}

function padLeft(digits: string[], count: number): string[] {
  return Array.from({ length: count }, (_, index) => digits[index - (count - digits.length)] ?? " ");
}

export function drawStack(ctx: CanvasRenderingContext2D, geom: StackGeom): void {
  ctx.save();
  ctx.fillStyle = "#22201c";
  ctx.strokeStyle = "#22201c";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `600 ${STACK_FONT}px Figtree, "Segoe UI", sans-serif`;
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  if (geom.kind === "stacked") {
    ctx.beginPath();
    const left = geom.columns[0].centerX - STACK_COL / 2;
    const right = geom.columns[geom.columns.length - 1].centerX + STACK_COL / 2;
    ctx.moveTo(left - 28, geom.lineY);
    ctx.lineTo(right, geom.lineY);
    ctx.stroke();
  }
  if (geom.bracket) {
    const box = geom.bracket;
    ctx.beginPath();
    ctx.moveTo(box.x, box.y + box.h);
    ctx.lineTo(box.x, box.y);
    ctx.lineTo(box.x + box.w, box.y);
    ctx.stroke();
  }
  for (const digit of geom.digits) {
    ctx.font = `600 ${digit.size ?? STACK_FONT}px Figtree, "Segoe UI", sans-serif`;
    ctx.fillText(digit.text, digit.x, digit.y);
  }
  ctx.font = `700 28px Figtree, "Segoe UI", sans-serif`;
  for (const sep of geom.seps) {
    ctx.fillText(sep.text, sep.x, sep.y + 10);
  }
  if (geom.op) {
    ctx.font = `600 ${STACK_FONT}px Figtree, "Segoe UI", sans-serif`;
    ctx.fillText(geom.op.text, geom.op.x, geom.op.y);
  }
  ctx.restore();
}

/** Handwritten-looking carries on the ink layer only. */
export function drawPencilCarries(ctx: CanvasRenderingContext2D, geom: StackGeom): void {
  if (geom.kind !== "stacked" || geom.columns.length < 2) {
    return;
  }
  const col = geom.columns[geom.columns.length - 2];
  ctx.save();
  ctx.strokeStyle = "#2a2620";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  const x = col.centerX;
  const y = geom.carry.y;
  ctx.moveTo(x - 4, y - 14);
  ctx.quadraticCurveTo(x + 8, y - 16, x + 2, y + 14);
  ctx.moveTo(x - 10, y + 14);
  ctx.lineTo(x + 10, y + 14);
  ctx.stroke();
  ctx.restore();
}

export function columnCenters(geom: StackGeom): number[] {
  return geom.columns.map((col) => col.centerX);
}

export function carryInside(geom: StackGeom): boolean {
  const top = geom.carry.y - geom.carry.height / 2;
  const bot = geom.carry.y + geom.carry.height / 2;
  return top >= 0 && bot <= geom.canvasHeight;
}
