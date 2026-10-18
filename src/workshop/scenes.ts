import bridgeLadder from "../machines/bridge/ladder.json";
import gearsLadder from "../machines/gears/ladder.json";
import leverLadder from "../machines/lever/ladder.json";
import type { LadderFile } from "../machines/from-ladder";
import type { Challenge } from "../machines/types";
import { skinColor } from "./craft";

export type DrawCall = { op: "rect" | "circle" | "text"; x: number; y: number; w: number; h: number; color: string; text?: string };

export type ScenePainter = {
  fillRect: (x: number, y: number, w: number, h: number) => void;
  fillStyle: string;
  strokeStyle: string;
  lineWidth: number;
  beginPath: () => void;
  arc: (x: number, y: number, r: number, a0: number, a1: number) => void;
  fill: () => void;
  stroke: () => void;
  moveTo: (x: number, y: number) => void;
  lineTo: (x: number, y: number) => void;
  font: string;
  fillText: (text: string, x: number, y: number) => void;
};

const FAMILY_SCENE: Record<string, string> = {
  "Counting a stick bridge": "stick-bridge",
  "Beam count from the load": "beam-count",
  "Units and half-meter bearing": "units-bridge",
  "Piers halve the span": "pier-bridge",
  "Beam depth and sag": "depth-bridge",
  "Truss members": "truss",
  "Arch thrust": "arch",
  "Suspension hangers": "suspension",
  "Intuitive balance": "seesaw-feel",
  "Where the lighter load goes": "seesaw-place",
  "Unknown mass": "seesaw-mass",
  "Mechanical advantage": "lever-class",
  "Two-lever machine": "lever-pair",
  "Count the turns": "gear-turns",
  "Build a ratio": "gear-ratio",
  "Direction and idlers": "gear-idler",
  "Compound train": "gear-compound",
  "Clock hands": "clock",
  "Torque and speed": "gear-torque",
};

for (const file of [gearsLadder, bridgeLadder, leverLadder] as LadderFile[]) {
  for (const level of file.levels) {
    FAMILY_SCENE[level.family] = level.sceneId;
  }
}

export function sceneIdFor(challenge: Pick<Challenge, "family">): string {
  const id = FAMILY_SCENE[challenge.family];
  if (!id) {
    throw new Error(`No scene for ${challenge.family}`);
  }
  return id;
}

export function subjectsFor(sceneId: string): string[] {
  if (sceneId.includes("clock") || sceneId === "watch") {
    return ["gear", "clock"];
  }
  if (
    sceneId.startsWith("gear") ||
    sceneId.startsWith("carousel") ||
    sceneId.startsWith("music") ||
    sceneId.startsWith("winch") ||
    sceneId.startsWith("bike") ||
    sceneId.startsWith("hoist") ||
    sceneId.startsWith("crane-hoist")
  ) {
    return ["gear"];
  }
  if (
    sceneId.startsWith("seesaw") ||
    sceneId.startsWith("lever") ||
    sceneId.startsWith("wheelbarrow") ||
    sceneId.startsWith("drawbridge") ||
    sceneId === "crane-boom"
  ) {
    return ["plank"];
  }
  return ["gap", "car", "flag"];
}

export function requiredSubject(prompt: string): string | null {
  const text = prompt.toLowerCase();
  if (text.includes("teeth") || text.includes("gear") || text.includes("idler") || text.includes("crank") || text.includes("hand")) {
    return "gear";
  }
  if (text.includes("plank") || text.includes("pivot") || text.includes("kg") || text.includes("arm") || text.includes("lever")) {
    return "plank";
  }
  if (text.includes("gap") || text.includes("meter") || text.includes("block") || text.includes("span") || text.includes("beam") || text.includes("hanger") || text.includes("rise")) {
    return "gap";
  }
  return null;
}

export function rulerEnds(span: number): { start: string; end: string; ticks: number } {
  const safe = Number.isFinite(span) && span > 0 ? span : 1;
  const ticks = Math.min(12, Math.max(2, Math.round(safe)));
  return { start: "0", end: String(Math.round(safe * 100) / 100), ticks };
}

export function resultAllowed(framesDrawn: number): boolean {
  return framesDrawn > 0;
}

export type PaintInput = {
  sceneId: string;
  span: number;
  progress: number;
  angle: number;
  placed: number;
  slow: boolean;
  output?: string;
  teethA?: number;
  teethB?: number;
  load?: number;
  stress?: number;
  celebrate?: boolean;
  fail?: boolean;
  skin?: string;
};

export function paintMachine(ctx: ScenePainter, input: PaintInput): void {
  const width = 640;
  const height = 280;
  ctx.fillStyle = "#f3ebd9";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#eadfc6";
  ctx.fillRect(0, 40, width, 200);
  const ruler = rulerEnds(input.span);
  ctx.fillStyle = "#2b2117";
  ctx.font = "16px Figtree, sans-serif";
  ctx.fillText(ruler.start, 24, 28);
  ctx.fillText(ruler.end, 560, 28);
  if (input.fail) {
    ctx.fillStyle = "#c8450a";
    ctx.fillRect(8, 48, width - 16, 6);
  }
  if (input.celebrate) {
    ctx.fillStyle = "#e0a526";
    for (let bit = 0; bit < 10; bit += 1) {
      const x = 80 + ((bit * 53) % 480);
      const y = 60 + ((bit * 29) % 140);
      ctx.fillRect(x, y, 6, 6);
    }
  }
  ctx.strokeStyle = "#2b2117";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(40, 36);
  ctx.lineTo(600, 36);
  ctx.stroke();
  for (let mark = 0; mark <= ruler.ticks; mark += 1) {
    const x = 40 + (mark / ruler.ticks) * 560;
    ctx.beginPath();
    ctx.moveTo(x, 36);
    ctx.lineTo(x, 46);
    ctx.stroke();
  }
  const kind = input.sceneId;
  if (subjectsFor(kind).includes("gear")) {
    drawGears(ctx, input);
    return;
  }
  if (subjectsFor(kind).includes("plank")) {
    drawLever(ctx, input);
    return;
  }
  drawBridge(ctx, input);
}

function drawBridge(ctx: ScenePainter, input: PaintInput): void {
  ctx.fillStyle = "#6b3a1f";
  ctx.fillRect(20, 150, 110, 90);
  ctx.fillRect(510, 150, 110, 90);
  ctx.fillStyle = "#3ec6e0";
  ctx.fillRect(130, 210, 380, 24);
  const reach = Math.max(20, Math.min(380, input.placed * 40));
  if (input.sceneId.includes("truss")) {
    ctx.strokeStyle = "#e7c07a";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(130, 190);
    ctx.lineTo(510, 190);
    ctx.moveTo(130, 140);
    ctx.lineTo(320, 100);
    ctx.lineTo(510, 140);
    ctx.moveTo(130, 190);
    ctx.lineTo(320, 100);
    ctx.lineTo(510, 190);
    ctx.stroke();
  } else if (input.sceneId.includes("arch")) {
    ctx.strokeStyle = "#d7b48a";
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.moveTo(140, 190);
    ctx.lineTo(220, 120);
    ctx.lineTo(320, 100);
    ctx.lineTo(420, 120);
    ctx.lineTo(500, 190);
    ctx.stroke();
    ctx.fillStyle = "#f0d090";
    ctx.fillRect(308, 92, 24, 24);
  } else if (input.sceneId === "suspension") {
    ctx.fillStyle = "#9aa7b5";
    ctx.fillRect(150, 70, 16, 120);
    ctx.fillRect(474, 70, 16, 120);
    ctx.strokeStyle = "#2b2117";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(158, 78);
    ctx.lineTo(320, 150);
    ctx.lineTo(482, 78);
    ctx.stroke();
    for (const x of [200, 260, 320, 380, 440]) {
      ctx.beginPath();
      ctx.moveTo(x, 110 + Math.abs(x - 320) / 8);
      ctx.lineTo(x, 190);
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = (input.stress ?? 0) > 0.55 ? "#c8450a" : input.slow ? "#e85d4c" : "#c47b3a";
    ctx.fillRect(130, 168, reach, 18);
  }
  const carX = 40 + input.progress * 460;
  ctx.fillStyle = skinColor("#e85d4c", input.skin);
  ctx.fillRect(carX, 148, 36, 16);
  ctx.fillStyle = "#1c1917";
  ctx.beginPath();
  ctx.arc(carX + 8, 166, 5, 0, Math.PI * 2);
  ctx.arc(carX + 28, 166, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#b6e34a";
  ctx.fillRect(560, 110, 6, 50);
  ctx.fillRect(566, 110, 28, 16);
  ctx.fillStyle = "#8a6a14";
  ctx.font = "22px Caveat, cursive";
  ctx.fillText(`${input.load && input.load > 0 ? input.load : 20} kg ${input.output ?? "car"}`, carX - 8, 136);
}

function drawLever(ctx: ScenePainter, input: PaintInput): void {
  const tip = Math.sin(input.angle) * 40;
  if (input.sceneId.startsWith("wheelbarrow")) {
    ctx.fillStyle = "#9a6230";
    ctx.beginPath();
    ctx.arc(150, 190, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#8a6a14";
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(170, 180);
    ctx.lineTo(460, 150);
    ctx.stroke();
    ctx.fillStyle = "#1f8a8c";
    ctx.fillRect(240, 130, 70, 36);
    ctx.fillStyle = "#2b2117";
    ctx.font = "20px Caveat, cursive";
    ctx.fillText(input.output ?? "barrow", 246, 124);
    ctx.fillText("plank", 300, 210);
    return;
  }
  if (input.sceneId.startsWith("drawbridge")) {
    const rise = input.progress * 70;
    ctx.fillStyle = "#6b3a1f";
    ctx.fillRect(80, 170, 40, 70);
    ctx.fillRect(500, 170, 40, 70);
    ctx.strokeStyle = "#8a6a14";
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.moveTo(120, 190);
    ctx.lineTo(480, 190 - rise);
    ctx.stroke();
    ctx.fillStyle = "#2b2117";
    ctx.font = "20px Caveat, cursive";
    ctx.fillText(input.output ?? "leaf", 220, 170 - rise);
    ctx.fillText("plank", 200, 230);
    return;
  }
  if (input.sceneId === "crane-boom") {
    const hook = 150 - input.progress * 60;
    ctx.strokeStyle = "#8a6a14";
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(120, 200);
    ctx.lineTo(280, 80);
    ctx.lineTo(460, 80);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(460, 80);
    ctx.lineTo(460, hook);
    ctx.stroke();
    ctx.fillStyle = "#c8450a";
    ctx.fillRect(444, hook, 32, 22);
    ctx.fillStyle = "#2b2117";
    ctx.font = "20px Caveat, cursive";
    ctx.fillText(input.output ?? "boom", 430, hook - 8);
    ctx.fillText("plank", 140, 230);
    return;
  }
  ctx.fillStyle = "#6b3a1f";
  ctx.fillRect(300, 170, 24, 70);
  ctx.strokeStyle = "#c47b3a";
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(80, 168 + tip);
  ctx.lineTo(560, 168 - tip);
  ctx.stroke();
  ctx.fillStyle = "#e85d4c";
  ctx.beginPath();
  ctx.arc(140, 150 + tip, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#3d6ea8";
  ctx.beginPath();
  ctx.arc(480, 150 - tip, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#2b2117";
  ctx.font = "20px Caveat, cursive";
  ctx.fillText(input.output ?? "kids", 120, 130 + tip);
  ctx.fillText("plank", 300, 150);
}

function drawGears(ctx: ScenePainter, input: PaintInput): void {
  const spin = input.progress * Math.PI * 2;
  const teethA = input.teethA && input.teethA > 0 ? input.teethA : 12;
  const teethB = input.teethB && input.teethB > 0 ? input.teethB : 24;
  gear(ctx, 170, 150, teethA, spin);
  gear(ctx, 310, 150, teethB, -spin * (teethA / teethB));
  const output = input.output ?? "";
  if (output === "horses" || input.sceneId.startsWith("carousel")) {
    for (let horse = 0; horse < 4; horse += 1) {
      const angle = spin + (horse / 4) * Math.PI * 2;
      ctx.fillStyle = "#c8450a";
      ctx.beginPath();
      ctx.arc(480 + Math.cos(angle) * 36, 140 + Math.sin(angle) * 24, 8, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (output === "drum" || input.sceneId === "music") {
    ctx.fillStyle = "#8a6a14";
    ctx.fillRect(450, 110, 70, 50);
  }
  if (output === "bucket" || input.sceneId.startsWith("winch") || input.sceneId.startsWith("hoist")) {
    const rise = 170 - input.progress * 80;
    ctx.fillStyle = "#2b2117";
    ctx.fillRect(470, 160, 80, 80);
    ctx.strokeStyle = "#5a4210";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(360, 120);
    ctx.lineTo(500, 90);
    ctx.lineTo(500, rise);
    ctx.stroke();
    ctx.fillStyle = "#1f8a8c";
    ctx.fillRect(484, rise, 32, 24);
    ctx.fillStyle = "#fbf6ea";
    ctx.font = "16px Caveat, cursive";
    ctx.fillText(`${input.load && input.load > 0 ? input.load : 20} kg`, 486, rise + 16);
  }
  if (output === "wheel" || input.sceneId === "bike") {
    ctx.strokeStyle = "#2b2117";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(500, 160, 40, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(500, 160);
    ctx.lineTo(500 + Math.cos(spin) * 40, 160 + Math.sin(spin) * 40);
    ctx.stroke();
  }
  if (output === "clock" || input.sceneId.includes("clock") || input.sceneId === "watch") {
    ctx.strokeStyle = "#2b2117";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(500, 130, 46, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(500, 130);
    ctx.lineTo(500 + Math.sin(spin / 12) * 24, 130 - Math.cos(spin / 12) * 24);
    ctx.moveTo(500, 130);
    ctx.lineTo(500 + Math.sin(spin) * 38, 130 - Math.cos(spin) * 38);
    ctx.stroke();
  }
  if (output === "hook" || input.sceneId === "crane-hoist") {
    const hook = 80 + (1 - input.progress) * 90;
    ctx.strokeStyle = "#5a4210";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(480, 70);
    ctx.lineTo(480, hook);
    ctx.stroke();
    ctx.fillStyle = "#c8450a";
    ctx.fillRect(464, hook, 32, 20);
  }
  ctx.fillStyle = "#2b2117";
  ctx.font = "16px Figtree, sans-serif";
  ctx.fillText("gear", 150, 240);
  if (output) {
    ctx.font = "22px Caveat, cursive";
    ctx.fillStyle = "#8a6a14";
    ctx.fillText(output, 430, 40);
  }
}

function enamel(teeth: number): string {
  if (teeth <= 8) return "#e2553a";
  if (teeth <= 12) return "#1f8a8c";
  if (teeth <= 16) return "#e0a526";
  if (teeth <= 24) return "#7b4b9e";
  if (teeth <= 36) return "#2e5bb8";
  return "#2f8f4e";
}

function gear(ctx: ScenePainter, x: number, y: number, teeth: number, angle: number): void {
  const radius = Math.max(22, Math.min(58, 12 + teeth));
  const count = Math.max(6, Math.min(18, Math.round(teeth / 2)));
  ctx.fillStyle = enamel(teeth);
  for (let tooth = 0; tooth < count; tooth += 1) {
    const a = angle + (tooth / count) * Math.PI * 2;
    ctx.fillRect(x + Math.cos(a) * (radius - 6) - 4, y + Math.sin(a) * (radius - 6) - 4, 8, 8);
  }
  ctx.beginPath();
  ctx.arc(x, y, radius * 0.72, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#d9c27a";
  ctx.beginPath();
  ctx.arc(x, y, 6, 0, Math.PI * 2);
  ctx.fill();
}

export function calcColumnLayout(height: number): { pad: { top: number; bottom: number }; keypad: { top: number; bottom: number } } {
  const toolbar = 44;
  const question = 48;
  const keypad = 240;
  const buttons = 48;
  const gaps = 24;
  const padHeight = Math.max(64, height - toolbar - question - keypad - buttons - gaps);
  const padTop = toolbar + question;
  const keyTop = padTop + padHeight + 8;
  return {
    pad: { top: padTop, bottom: padTop + padHeight },
    keypad: { top: keyTop, bottom: keyTop + keypad },
  };
}
