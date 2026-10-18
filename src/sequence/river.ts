import type { SceneFrame } from "./logic";

export type RiverPainter = {
  fillStyle: string;
  strokeStyle: string;
  lineWidth: number;
  font: string;
  fillRect: (x: number, y: number, w: number, h: number) => void;
  strokeRect?: (x: number, y: number, w: number, h: number) => void;
  beginPath: () => void;
  arc: (x: number, y: number, r: number, a: number, b: number) => void;
  fill: () => void;
  stroke: () => void;
  moveTo: (x: number, y: number) => void;
  lineTo: (x: number, y: number) => void;
  fillText: (text: string, x: number, y: number) => void;
};

export type RiverDraw = {
  frame: SceneFrame;
  theme: "day" | "dusk";
  truckX: number;
  beam: boolean;
  beamSpec: number;
  needed: number;
  stress: number;
  fail: boolean;
  celebrate: boolean;
  label: string;
};

export function paintRiver(ctx: RiverPainter, draw: RiverDraw) {
  const sky = draw.theme === "dusk" ? "#F3C9A0" : "#C9E7F6";
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 900, 150);
  ctx.fillStyle = draw.theme === "dusk" ? "#E7B56A" : "#F7E7A1";
  ctx.beginPath();
  ctx.arc(760, 48, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#B7D7A8";
  ctx.fillRect(0, 120, 900, 50);
  ctx.fillStyle = "#8FBF78";
  ctx.beginPath();
  ctx.moveTo(40, 140);
  ctx.lineTo(120, 90);
  ctx.lineTo(210, 145);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(640, 145);
  ctx.lineTo(730, 86);
  ctx.lineTo(820, 145);
  ctx.fill();
  ctx.fillStyle = "#2F6B3A";
  ctx.fillRect(150, 108, 8, 28);
  ctx.beginPath();
  ctx.arc(154, 100, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(700, 104, 8, 30);
  ctx.beginPath();
  ctx.arc(704, 96, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#2E7FB0";
  ctx.fillRect(0, 210, 900, 130);
  ctx.fillStyle = "#8CCBE8";
  ctx.fillRect(0, 248, 900, 10);
  ctx.fillRect(30, 290, 120, 6);
  const stones = [0, 28, 54, 86, 112, 140];
  ctx.fillStyle = "#C4BBAC";
  for (const x of stones) {
    ctx.fillRect(draw.frame.beamStart - 70 + x, 188, 24, 16);
    ctx.fillRect(draw.frame.beamEnd - 20 + (x % 50), 188, 22, 16);
  }
  ctx.fillStyle = "#A89F91";
  ctx.fillRect(0, 200, draw.frame.gapStart, 140);
  ctx.fillRect(draw.frame.gapEnd, 200, 900 - draw.frame.gapEnd, 140);
  if (draw.beam) {
    const stress = draw.fail ? 1 : draw.stress;
    ctx.fillStyle = stress > 0.85 ? "#C8452B" : stress > 0.55 ? "#E0A15A" : "#C58B4E";
    const sag = stress * 10;
    ctx.fillRect(draw.frame.beamStart, draw.frame.beamY + sag * 0.2, draw.frame.beamEnd - draw.frame.beamStart, 16);
    ctx.fillStyle = "#7E4F22";
    ctx.fillRect(draw.frame.beamStart, draw.frame.beamY + 4, draw.frame.beamEnd - draw.frame.beamStart, 2);
    ctx.fillStyle = "#5A3A16";
    ctx.beginPath();
    ctx.arc(draw.frame.beamStart + 18, draw.frame.beamY + 8, 3, 0, Math.PI * 2);
    ctx.arc(draw.frame.beamEnd - 18, draw.frame.beamY + 8, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  paintTruck(ctx, draw.truckX, draw.frame.beamY - 28);
  if (draw.celebrate) {
    ctx.fillStyle = "#F2B544";
    for (let i = 0; i < 8; i += 1) {
      ctx.fillRect(120 + i * 70, 40 + (i % 3) * 12, 6, 6);
    }
  }
  if (draw.label) {
    ctx.fillStyle = "#B3452B";
    ctx.font = "700 22px Caveat, cursive";
    ctx.fillText(draw.label, draw.frame.gapStart + 8, draw.frame.beamY - 24);
  }
}

function paintTruck(ctx: RiverPainter, x: number, y: number) {
  ctx.fillStyle = "#FF8A3C";
  ctx.fillRect(x, y + 16, 78, 22);
  ctx.fillRect(x + 40, y + 4, 28, 16);
  ctx.fillStyle = "#CFEFFF";
  ctx.fillRect(x + 46, y + 7, 16, 10);
  ctx.fillStyle = "#2A2A2E";
  ctx.beginPath();
  ctx.arc(x + 18, y + 40, 8, 0, Math.PI * 2);
  ctx.arc(x + 62, y + 40, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#C9CBD1";
  ctx.beginPath();
  ctx.arc(x + 18, y + 40, 3, 0, Math.PI * 2);
  ctx.arc(x + 62, y + 40, 3, 0, Math.PI * 2);
  ctx.fill();
}
