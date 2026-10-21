import { readFileSync, writeFileSync } from "node:fs";
import { deflateSync, inflateSync } from "node:zlib";

/** Matches `.gk-scene img.banks`. Scene numbers come from the picture. */
export const BANKS_LAYOUT = {
  left: -79,
  top: 224,
  width: 1158,
  height: 386,
};

export const BEAM_THICK_FT = 22 / 50;
export const PLANK_THICK_FT = 16 / 50;
export const BEAM_THICK_PX = 22;
export const PLANK_THICK_PX = 16;
export const SPAN_FT = 8;
export const BEARING_FT = 0.5;
export const SCENE_WIDTH = 1000;
export const SCENE_HEIGHT = 620;

export type KitKind = "little" | "big";

export const BANKS_FILE: Record<KitKind, string> = {
  little: "public/art/banks.png",
  big: "public/art/banks-big.png",
};

export const BANKS_NAME: Record<KitKind, string> = {
  little: "banks.png",
  big: "banks-big.png",
};

export const SPAN_FOR: Record<KitKind, number> = { little: 8, big: 16 };

export type Rgba = { width: number; height: number; data: Uint8Array };
export type Pixel = { r: number; g: number; b: number; a: number };

export type MeasuredScene = {
  leftEdge: number;
  rightEdge: number;
  bankTopY: number;
  leftTopY: number;
  rightTopY: number;
  pxPerFt: number;
  originX: number;
  deckY: number;
  waterY: number;
  span: number;
  banks: string;
};

const cachedImage: Partial<Record<KitKind, Rgba>> = {};
const cachedScene: Partial<Record<KitKind, MeasuredScene>> = {};

function paeth(left: number, up: number, ul: number): number {
  const estimate = left + up - ul;
  const leftScore = Math.abs(estimate - left);
  const upScore = Math.abs(estimate - up);
  const ulScore = Math.abs(estimate - ul);
  if (leftScore <= upScore && leftScore <= ulScore) {
    return left;
  }
  return upScore <= ulScore ? up : ul;
}

export function decodePng(bytes: Uint8Array): Rgba {
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 8;
  let colorType = 6;
  const parts: Uint8Array[] = [];
  while (offset < bytes.length) {
    const length = new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0);
    offset += 4;
    const kind = String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
    offset += 4;
    const data = bytes.subarray(offset, offset + length);
    offset += length + 4;
    if (kind === "IHDR") {
      const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
      width = view.getUint32(0);
      height = view.getUint32(4);
      bitDepth = view.getUint8(8);
      colorType = view.getUint8(9);
    }
    if (kind === "IDAT") {
      parts.push(data);
    }
    if (kind === "IEND") {
      break;
    }
  }
  if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) {
    throw new Error(`Unsupported PNG colorType=${colorType} bitDepth=${bitDepth}`);
  }
  const bpp = colorType === 2 ? 3 : 4;
  const packed = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let cursor = 0;
  for (const part of parts) {
    packed.set(part, cursor);
    cursor += part.length;
  }
  const raw = inflateSync(packed);
  const stride = width * bpp + 1;
  const scan = new Uint8Array(width * height * bpp);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * stride];
    const row = raw.subarray(y * stride + 1, (y + 1) * stride);
    for (let x = 0; x < width * bpp; x += 1) {
      const left = x >= bpp ? scan[y * width * bpp + x - bpp] : 0;
      const up = y > 0 ? scan[(y - 1) * width * bpp + x] : 0;
      const ul = y > 0 && x >= bpp ? scan[(y - 1) * width * bpp + x - bpp] : 0;
      let value = row[x];
      if (filter === 1) {
        value = (value + left) & 255;
      } else if (filter === 2) {
        value = (value + up) & 255;
      } else if (filter === 3) {
        value = (value + Math.floor((left + up) / 2)) & 255;
      } else if (filter === 4) {
        value = (value + paeth(left, up, ul)) & 255;
      }
      scan[y * width * bpp + x] = value;
    }
  }
  if (bpp === 4) {
    return { width, height, data: scan };
  }
  const pixels = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    pixels[i * 4] = scan[i * 3];
    pixels[i * 4 + 1] = scan[i * 3 + 1];
    pixels[i * 4 + 2] = scan[i * 3 + 2];
    pixels[i * 4 + 3] = 255;
  }
  return { width, height, data: pixels };
}

export function banksImage(kind: KitKind = "little"): Rgba {
  if (!cachedImage[kind]) {
    cachedImage[kind] = decodePng(readFileSync(BANKS_FILE[kind]));
  }
  return cachedImage[kind];
}

export function imagePixel(image: Rgba, x: number, y: number): Pixel {
  const px = Math.max(0, Math.min(image.width - 1, Math.round(x)));
  const py = Math.max(0, Math.min(image.height - 1, Math.round(y)));
  const index = (py * image.width + px) * 4;
  return { r: image.data[index], g: image.data[index + 1], b: image.data[index + 2], a: image.data[index + 3] };
}

function sceneToImage(sceneX: number, sceneY: number, image: Rgba): { x: number; y: number } {
  const displayX = ((sceneX - BANKS_LAYOUT.left) / BANKS_LAYOUT.width) * image.width;
  const displayY = ((sceneY - BANKS_LAYOUT.top) / BANKS_LAYOUT.height) * image.height;
  return {
    x: Math.max(0, Math.min(image.width - 1, Math.round(displayX))),
    y: Math.max(0, Math.min(image.height - 1, Math.round(displayY))),
  };
}

function imageToScene(imageX: number, imageY: number, image: Rgba): { x: number; y: number } {
  return {
    x: BANKS_LAYOUT.left + (imageX / image.width) * BANKS_LAYOUT.width,
    y: BANKS_LAYOUT.top + (imageY / image.height) * BANKS_LAYOUT.height,
  };
}

export function pixelAt(sceneX: number, sceneY: number, kind: KitKind = "little"): Pixel {
  const image = banksImage(kind);
  const point = sceneToImage(sceneX, sceneY, image);
  return imagePixel(image, point.x, point.y);
}

export function isSky(pixel: Pixel): boolean {
  return pixel.a < 32 || (pixel.r > 245 && pixel.g > 245 && pixel.b > 245);
}

export function blueDominates(pixel: Pixel): boolean {
  return pixel.a > 128 && pixel.b > pixel.r + 15 && pixel.b > pixel.g + 10 && pixel.b > 70;
}

export function isFoam(pixel: Pixel): boolean {
  const avg = (pixel.r + pixel.g + pixel.b) / 3;
  return pixel.a > 180 && avg > 200 && !blueDominates(pixel);
}

export function isGap(pixel: Pixel): boolean {
  return isSky(pixel) || blueDominates(pixel) || isFoam(pixel) || pixel.a < 32;
}

export function isGrass(pixel: Pixel): boolean {
  return pixel.a > 180 && pixel.g > pixel.r + 6 && pixel.g > pixel.b && pixel.g > 55;
}

export function isStone(pixel: Pixel): boolean {
  const avg = (pixel.r + pixel.g + pixel.b) / 3;
  const spread = Math.max(pixel.r, pixel.g, pixel.b) - Math.min(pixel.r, pixel.g, pixel.b);
  return pixel.a > 180 && avg > 95 && avg < 190 && spread < 40 && !blueDominates(pixel);
}

export function isDirt(pixel: Pixel): boolean {
  return pixel.a > 180 && pixel.r > 145 && pixel.g > 115 && pixel.g <= pixel.r + 12 && pixel.b < pixel.g - 12 && pixel.r - pixel.b > 28;
}

export function isBank(pixel: Pixel): boolean {
  return isGrass(pixel) || isStone(pixel) || isDirt(pixel);
}

export function isBeam(pixel: Pixel): boolean {
  return pixel.a > 180 && pixel.r > pixel.g + 10 && pixel.g > pixel.b && pixel.r > 80 && pixel.b < 140;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

/** Bank top at the face, walking up from the water so inland trees do not win. */
function faceTop(image: Rgba, x: number, waterTop: number): number {
  let top = waterTop;
  for (let y = waterTop; y >= 0; y -= 1) {
    const pixel = imagePixel(image, x, y);
    if (isBank(pixel)) {
      top = y;
      continue;
    }
    if (isSky(pixel) || blueDominates(pixel) || isFoam(pixel)) {
      break;
    }
  }
  return top;
}

function measureImage(image: Rgba): { left: number; right: number; leftTop: number; rightTop: number } {
  const midX = Math.floor(image.width / 2);
  let waterTop = Math.round(image.height * 0.55);
  for (let y = 0; y < image.height; y += 1) {
    if (blueDominates(imagePixel(image, midX, y))) {
      waterTop = y;
      break;
    }
  }
  const faceY = Math.max(8, waterTop - Math.round(image.height * 0.14));
  const lefts: number[] = [];
  const rights: number[] = [];
  const need = 5;
  for (let dy = -16; dy <= 16; dy += 2) {
    const y = Math.max(0, Math.min(image.height - 1, faceY + dy));
    if (!blueDominates(imagePixel(image, midX, y)) && !isFoam(imagePixel(image, midX, y)) && !isSky(imagePixel(image, midX, y))) {
      continue;
    }
    let run = 0;
    let left = -1;
    for (let x = midX; x >= 0; x -= 1) {
      if (isBank(imagePixel(image, x, y))) {
        run += 1;
        if (run >= need) {
          left = x + need - 1;
          break;
        }
      } else {
        run = 0;
      }
    }
    run = 0;
    let right = -1;
    for (let x = midX; x < image.width; x += 1) {
      if (isBank(imagePixel(image, x, y))) {
        run += 1;
        if (run >= need) {
          right = x - need + 1;
          break;
        }
      } else {
        run = 0;
      }
    }
    if (left >= 0 && right > left) {
      lefts.push(left);
      rights.push(right);
    }
  }
  const left = median(lefts);
  const right = median(rights);
  const onto = Math.max(8, Math.min(16, Math.round((right - left) * 0.01)));
  return {
    left,
    right,
    leftTop: faceTop(image, left - onto, waterTop),
    rightTop: faceTop(image, right + onto, waterTop),
  };
}

export function measuredScene(kind: KitKind = "little"): MeasuredScene {
  const hit = cachedScene[kind];
  if (hit) {
    return hit;
  }
  const image = banksImage(kind);
  const found = measureImage(image);
  const left = imageToScene(found.left, found.leftTop, image);
  const right = imageToScene(found.right, found.rightTop, image);
  const leftEdge = left.x;
  const rightEdge = right.x;
  const leftTopY = left.y;
  const rightTopY = right.y;
  const bankTopY = (leftTopY + rightTopY) / 2;
  const span = SPAN_FOR[kind];
  const pxPerFt = (rightEdge - leftEdge) / span;
  const beamPx = BEAM_THICK_FT * pxPerFt;
  const plankPx = PLANK_THICK_FT * pxPerFt;
  const deckY = Math.min(leftTopY, rightTopY) - beamPx - plankPx;
  let waterY = 1.12;
  const gapX = (leftEdge + rightEdge) / 2;
  for (let row = 0; row < BANKS_LAYOUT.height; row += 1) {
    const sceneY = BANKS_LAYOUT.top + row;
    if (blueDominates(pixelAt(gapX, sceneY, kind))) {
      waterY = (sceneY - bankTopY) / pxPerFt;
      break;
    }
  }
  const scene: MeasuredScene = {
    leftEdge,
    rightEdge,
    bankTopY,
    leftTopY,
    rightTopY,
    pxPerFt,
    originX: leftEdge,
    deckY,
    waterY,
    span,
    banks: BANKS_NAME[kind],
  };
  cachedScene[kind] = scene;
  return scene;
}

/** First scene row in the gap's center column where the painted water is blue. Metres below the deck. */
export function measuredWaterY(kind: KitKind = "little"): number {
  return measuredScene(kind).waterY;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc ^= bytes[i];
    for (let bit = 0; bit < 8; bit += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const body = new Uint8Array(4 + data.length);
  for (let i = 0; i < 4; i += 1) {
    body[i] = type.charCodeAt(i);
  }
  body.set(data, 4);
  const out = new Uint8Array(12 + data.length);
  new DataView(out.buffer).setUint32(0, data.length);
  out.set(body, 4);
  new DataView(out.buffer).setUint32(8 + data.length, crc32(body));
  return out;
}

export function encodePng(image: Rgba): Uint8Array {
  const raw = new Uint8Array(image.height * (image.width * 4 + 1));
  for (let y = 0; y < image.height; y += 1) {
    raw[y * (image.width * 4 + 1)] = 0;
    raw.set(image.data.subarray(y * image.width * 4, (y + 1) * image.width * 4), y * (image.width * 4 + 1) + 1);
  }
  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, image.width);
  view.setUint32(4, image.height);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const parts = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", new Uint8Array()),
  ];
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let cursor = 0;
  for (const part of parts) {
    out.set(part, cursor);
    cursor += part.length;
  }
  return out;
}

function blit(dest: Rgba, src: Rgba, dx: number, dy: number, dw: number, dh: number) {
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

function fill(dest: Rgba, r: number, g: number, b: number) {
  for (let i = 0; i < dest.data.length; i += 4) {
    dest.data[i] = r;
    dest.data[i + 1] = g;
    dest.data[i + 2] = b;
    dest.data[i + 3] = 255;
  }
}

function paintLine(dest: Rgba, x0: number, y0: number, x1: number, y1: number) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= steps; i += 1) {
    const x = Math.round(x0 + ((x1 - x0) * i) / steps);
    const y = Math.round(y0 + ((y1 - y0) * i) / steps);
    if (x < 0 || y < 0 || x >= dest.width || y >= dest.height) {
      continue;
    }
    const index = (y * dest.width + x) * 4;
    dest.data[index] = 220;
    dest.data[index + 1] = 32;
    dest.data[index + 2] = 32;
    dest.data[index + 3] = 255;
  }
}

export function deckBeamBox(side: "left" | "right", typed?: number, scene = measuredScene()) {
  const half = scene.span / 2;
  const length = typed ?? half;
  const bearing = BEARING_FT * scene.pxPerFt;
  const span = length * scene.pxPerFt;
  const thick = BEAM_THICK_FT * scene.pxPerFt;
  if (side === "left") {
    return { left: scene.leftEdge - bearing, top: scene.leftTopY - thick, width: span + bearing, height: thick, bottom: scene.leftTopY };
  }
  return { left: scene.leftEdge + half * scene.pxPerFt, top: scene.rightTopY - thick, width: span + bearing, height: thick, bottom: scene.rightTopY };
}

export function renderGroundedScene(guides = false, kind: KitKind = "little"): Rgba {
  const scene = measuredScene(kind);
  const dest: Rgba = { width: SCENE_WIDTH, height: SCENE_HEIGHT, data: new Uint8Array(SCENE_WIDTH * SCENE_HEIGHT * 4) };
  fill(dest, 231, 242, 250);
  blit(dest, banksImage(kind), BANKS_LAYOUT.left, BANKS_LAYOUT.top, BANKS_LAYOUT.width, BANKS_LAYOUT.height);
  const beam = decodePng(readFileSync("public/art/beam-side.png"));
  for (const side of ["left", "right"] as const) {
    const box = deckBeamBox(side, scene.span / 2, scene);
    blit(dest, beam, box.left, box.top, box.width, box.height);
  }
  if (guides) {
    paintLine(dest, scene.leftEdge, 0, scene.leftEdge, SCENE_HEIGHT - 1);
    paintLine(dest, scene.rightEdge, 0, scene.rightEdge, SCENE_HEIGHT - 1);
    paintLine(dest, 0, scene.leftTopY, SCENE_WIDTH - 1, scene.leftTopY);
    paintLine(dest, 0, scene.rightTopY, SCENE_WIDTH - 1, scene.rightTopY);
  }
  return dest;
}

export function canvasPixel(image: Rgba, x: number, y: number): Pixel {
  return imagePixel(image, x, y);
}

export function writeDebugScene(path: string, kind: KitKind = "little"): Rgba {
  const image = renderGroundedScene(true, kind);
  writeFileSync(path, encodePng(image));
  return image;
}
