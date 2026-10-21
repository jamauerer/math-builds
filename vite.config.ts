import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { syncArt } from "./scripts/sync-art.mjs";
import { measuredScene, type MeasuredScene } from "./src/machines/bridge/kits/water-line";

function paintScene(code: string, scene: MeasuredScene): string {
  const numeric: Record<string, number> = {
    pxPerMetre: scene.pxPerFt,
    waterY: scene.waterY,
    originX: scene.originX,
    deckY: scene.deckY,
    leftEdge: scene.leftEdge,
    rightEdge: scene.rightEdge,
    bankTopY: scene.bankTopY,
  };
  let next = code;
  for (const [key, value] of Object.entries(numeric)) {
    next = next.replace(new RegExp(`"${key}"\\s*:\\s*-?[0-9.]+`), `"${key}": ${value}`);
  }
  if (/"leftTopY"\s*:/.test(next)) {
    next = next.replace(/"leftTopY"\s*:\s*-?[0-9.]+/, `"leftTopY": ${scene.leftTopY}`);
    next = next.replace(/"rightTopY"\s*:\s*-?[0-9.]+/, `"rightTopY": ${scene.rightTopY}`);
    return next;
  }
  return next.replace(
    /"bankTopY"\s*:\s*-?[0-9.]+/,
    `"bankTopY": ${scene.bankTopY}, "leftTopY": ${scene.leftTopY}, "rightTopY": ${scene.rightTopY}`,
  );
}

function banksScene() {
  syncArt();
  const little = measuredScene("little");
  const big = measuredScene("big");
  return {
    name: "banks-scene",
    enforce: "pre" as const,
    transform(code: string, id: string) {
      const file = id.replace(/\\/g, "/").split("?")[0];
      if (file.endsWith("/queen-post-big.json")) {
        return paintScene(code, big);
      }
      if (file.endsWith("/queen-post.json")) {
        return paintScene(code, little);
      }
      return;
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [banksScene(), react()],
  server: {
    watch: {
      ignored: ["**/docs/**", "**/node_modules/**"],
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
