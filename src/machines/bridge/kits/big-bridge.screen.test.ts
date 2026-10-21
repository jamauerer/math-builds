import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { decodePng, encodePng, measuredScene, renderGroundedScene, writeDebugScene } from "./water-line";
import { readFileSync } from "node:fs";

const FOLDER = "docs/screens/2026-10-21-big-goat";

function blit(dest: ReturnType<typeof renderGroundedScene>, src: ReturnType<typeof decodePng>, dx: number, dy: number, dw: number, dh: number) {
  for (let y = 0; y < dh; y += 1) {
    const destY = Math.round(dy + y);
    if (destY < 0 || destY >= dest.height) {
      continue;
    }
    const srcY = Math.min(src.height - 1, Math.max(0, Math.floor((y / dh) * src.height)));
    for (let x = 0; x < dw; x += 1) {
      const destX = Math.round(dx + x);
      if (destX < 0 || destX >= dest.width) {
        continue;
      }
      const srcX = Math.min(src.width - 1, Math.max(0, Math.floor((x / dw) * src.width)));
      const srcI = (srcY * src.width + srcX) * 4;
      const a = src.data[srcI + 3] / 255;
      if (a < 0.04) {
        continue;
      }
      const destI = (destY * dest.width + destX) * 4;
      dest.data[destI] = Math.round(src.data[srcI] * a + dest.data[destI] * (1 - a));
      dest.data[destI + 1] = Math.round(src.data[srcI + 1] * a + dest.data[destI + 1] * (1 - a));
      dest.data[destI + 2] = Math.round(src.data[srcI + 2] * a + dest.data[destI + 2] * (1 - a));
      dest.data[destI + 3] = 255;
    }
  }
}

function fillRect(dest: ReturnType<typeof renderGroundedScene>, x: number, y: number, w: number, h: number, r: number, g: number, b: number) {
  for (let row = 0; row < h; row += 1) {
    for (let col = 0; col < w; col += 1) {
      const px = Math.round(x + col);
      const py = Math.round(y + row);
      if (px < 0 || py < 0 || px >= dest.width || py >= dest.height) {
        continue;
      }
      const i = (py * dest.width + px) * 4;
      dest.data[i] = r;
      dest.data[i + 1] = g;
      dest.data[i + 2] = b;
      dest.data[i + 3] = 255;
    }
  }
}

describe("big goat screens", () => {
  it("writes the measured debug shot and scene stills", () => {
    mkdirSync(FOLDER, { recursive: true });
    const scene = measuredScene("big");
    writeDebugScene(`${FOLDER}/debug-edges.png`, "big");
    const finished = renderGroundedScene(false, "big");
    writeFileSync(`${FOLDER}/finished-bridge.png`, encodePng(finished));
    const mid = renderGroundedScene(false, "big");
    const walk = decodePng(readFileSync("public/art/biggoat-walk-3.png"));
    const goatH = Math.round(6 * scene.pxPerFt);
    const goatW = Math.round((walk.width * goatH) / walk.height);
    blit(mid, walk, scene.originX + 6 * scene.pxPerFt - goatW / 2, scene.deckY - goatH, goatW, goatH);
    writeFileSync(`${FOLDER}/mid-crossing.png`, encodePng(mid));
    const river = renderGroundedScene(false, "big");
    const swim = decodePng(readFileSync("public/art/biggoat-swim-1.png"));
    blit(river, swim, (scene.leftEdge + scene.rightEdge) / 2 - goatW / 2, scene.bankTopY + 36, goatW, goatH);
    writeFileSync(`${FOLDER}/in-the-river.png`, encodePng(river));
    const unlock = renderGroundedScene(false, "big");
    fillRect(unlock, 220, 140, 560, 280, 250, 246, 236);
    fillRect(unlock, 250, 260, 240, 64, 224, 102, 26);
    fillRect(unlock, 510, 260, 240, 64, 80, 72, 60);
    writeFileSync(`${FOLDER}/unlock-card.png`, encodePng(unlock));
    const guided = renderGroundedScene(false, "big");
    fillRect(guided, 20, 520, 280, 72, 250, 246, 236);
    writeFileSync(`${FOLDER}/guided-step-1.png`, encodePng(guided));
    writeFileSync(
      `${FOLDER}/index.md`,
      `# Big goat's bridge

The 16 ft queen-post on the wide banks. The big goat is the only test load.

- \`debug-edges.png\` — measured leftEdge, rightEdge, leftTopY and rightTopY as red lines. leftEdge ${Math.round(scene.leftEdge)}, rightEdge ${Math.round(scene.rightEdge)}, leftTopY ${Math.round(scene.leftTopY)}, rightTopY ${Math.round(scene.rightTopY)}.
- \`unlock-card.png\` — choice after three little rounds: build the big goat's bridge, or the little one again.
- \`guided-step-1.png\` — first guided step on the wide banks.
- \`finished-bridge.png\` — finished 16 ft deck on both bank tops.
- \`mid-crossing.png\` — big goat walking the deck.
- \`in-the-river.png\` — big goat in the water after a fold.
`,
    );
    expect(scene.span).toBe(16);
    expect(scene.leftTopY).not.toBe(scene.rightTopY);
  }, 20_000);
});
