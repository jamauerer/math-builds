import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";

/** Matches `.gk-scene img.banks` and the deck in queen-post.json. */
export const BANKS_LAYOUT = {
  left: -79,
  top: 224,
  width: 1158,
  height: 386,
  deckY: 355,
  originX: 292,
  pxPerMetre: 50,
  gapCenterM: 4,
};

type Rgba = { width: number; height: number; data: Uint8Array };

let cachedImage: Rgba | null = null;

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
    }
    if (kind === "IDAT") {
      parts.push(data);
    }
    if (kind === "IEND") {
      break;
    }
  }
  const packed = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let cursor = 0;
  for (const part of parts) {
    packed.set(part, cursor);
    cursor += part.length;
  }
  const raw = inflateSync(packed);
  const stride = width * 4 + 1;
  const pixels = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * stride];
    const row = raw.subarray(y * stride + 1, (y + 1) * stride);
    for (let x = 0; x < width * 4; x += 1) {
      const left = x >= 4 ? pixels[y * width * 4 + x - 4] : 0;
      const up = y > 0 ? pixels[(y - 1) * width * 4 + x] : 0;
      const ul = y > 0 && x >= 4 ? pixels[(y - 1) * width * 4 + x - 4] : 0;
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
      pixels[y * width * 4 + x] = value;
    }
  }
  return { width, height, data: pixels };
}

export function banksImage(): Rgba {
  if (!cachedImage) {
    cachedImage = decodePng(readFileSync("public/art/banks.png"));
  }
  return cachedImage;
}

function sceneToImage(sceneX: number, sceneY: number, image: Rgba): { x: number; y: number } {
  const displayX = ((sceneX - BANKS_LAYOUT.left) / BANKS_LAYOUT.width) * image.width;
  const displayY = ((sceneY - BANKS_LAYOUT.top) / BANKS_LAYOUT.height) * image.height;
  return {
    x: Math.max(0, Math.min(image.width - 1, Math.round(displayX))),
    y: Math.max(0, Math.min(image.height - 1, Math.round(displayY))),
  };
}

export function pixelAt(sceneX: number, sceneY: number): { r: number; g: number; b: number; a: number } {
  const image = banksImage();
  const point = sceneToImage(sceneX, sceneY, image);
  const index = (point.y * image.width + point.x) * 4;
  return { r: image.data[index], g: image.data[index + 1], b: image.data[index + 2], a: image.data[index + 3] };
}

export function blueDominates(pixel: { r: number; g: number; b: number; a: number }): boolean {
  return pixel.a > 128 && pixel.b > pixel.r + 15 && pixel.b > pixel.g + 10 && pixel.b > 70;
}

/** First scene row in the gap's center column where the painted water is blue. Metres below the deck. */
export function measuredWaterY(): number {
  const sceneX = BANKS_LAYOUT.originX + BANKS_LAYOUT.gapCenterM * BANKS_LAYOUT.pxPerMetre;
  for (let row = 0; row < BANKS_LAYOUT.height; row += 1) {
    const sceneY = BANKS_LAYOUT.top + row;
    if (blueDominates(pixelAt(sceneX, sceneY))) {
      return (sceneY - BANKS_LAYOUT.deckY) / BANKS_LAYOUT.pxPerMetre;
    }
  }
  return 1.12;
}
