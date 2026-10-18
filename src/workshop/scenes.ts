import type { Challenge } from "../machines/types";

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

export function sceneIdFor(challenge: Pick<Challenge, "family">): string {
  const id = FAMILY_SCENE[challenge.family];
  if (!id) {
    throw new Error(`No scene for ${challenge.family}`);
  }
  return id;
}

export function subjectsFor(sceneId: string): string[] {
  if (sceneId === "clock") {
    return ["gear", "clock"];
  }
  if (sceneId.startsWith("gear")) {
    return ["gear"];
  }
  if (sceneId.startsWith("seesaw") || sceneId.startsWith("lever")) {
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
  if (kind.startsWith("gear") || kind === "clock") {
    drawGears(ctx, input);
    return;
  }
  if (kind.startsWith("seesaw") || kind.startsWith("lever")) {
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
  if (input.sceneId === "truss") {
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
  } else if (input.sceneId === "arch") {
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
    ctx.fillStyle = input.slow ? "#e85d4c" : "#c47b3a";
    ctx.fillRect(130, 168, reach, 18);
  }
  const carX = 40 + input.progress * 460;
  ctx.fillStyle = "#e85d4c";
  ctx.fillRect(carX, 148, 36, 16);
  ctx.fillStyle = "#1c1917";
  ctx.beginPath();
  ctx.arc(carX + 8, 166, 5, 0, Math.PI * 2);
  ctx.arc(carX + 28, 166, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#b6e34a";
  ctx.fillRect(560, 110, 6, 50);
  ctx.fillRect(566, 110, 28, 16);
}

function drawLever(ctx: ScenePainter, input: PaintInput): void {
  ctx.fillStyle = "#6b3a1f";
  ctx.fillRect(300, 170, 24, 70);
  ctx.strokeStyle = "#c47b3a";
  ctx.lineWidth = 12;
  ctx.beginPath();
  const tip = Math.sin(input.angle) * 40;
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
  ctx.fillText("plank", 300, 150);
}

function drawGears(ctx: ScenePainter, input: PaintInput): void {
  const spin = input.progress * Math.PI * 2;
  gear(ctx, 180, 150, 48, spin, "#e85d4c");
  gear(ctx, 300, 150, 70, -spin * 0.6, "#f0d090");
  if (input.sceneId === "clock") {
    ctx.strokeStyle = "#2b2117";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(480, 140, 50, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(480, 140);
    ctx.lineTo(480 + Math.sin(spin / 12) * 30, 140 - Math.cos(spin / 12) * 30);
    ctx.moveTo(480, 140);
    ctx.lineTo(480 + Math.sin(spin / 60) * 42, 140 - Math.cos(spin / 60) * 42);
    ctx.stroke();
  }
  ctx.fillStyle = "#2b2117";
  ctx.fillText("gear", 160, 230);
}

function gear(ctx: ScenePainter, x: number, y: number, r: number, angle: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#1c1917";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(angle) * r, y + Math.sin(angle) * r);
  ctx.stroke();
  for (let tooth = 0; tooth < 8; tooth += 1) {
    const a = angle + (tooth / 8) * Math.PI * 2;
    ctx.fillRect(x + Math.cos(a) * r - 4, y + Math.sin(a) * r - 4, 8, 8);
  }
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
