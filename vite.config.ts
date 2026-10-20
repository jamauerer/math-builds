import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { syncArt } from "./scripts/sync-art.mjs";
import { measuredScene } from "./src/machines/bridge/kits/water-line";

function banksScene() {
  syncArt();
  const scene = measuredScene();
  return {
    name: "banks-scene",
    enforce: "pre" as const,
    transform(code: string, id: string) {
      if (!id.replace(/\\/g, "/").endsWith("queen-post.json")) {
        return;
      }
      return code
        .replace(/"pxPerMetre"\s*:\s*[0-9.]+/, `"pxPerMetre": ${scene.pxPerFt}`)
        .replace(/"waterY"\s*:\s*[0-9.]+/, `"waterY": ${scene.waterY}`)
        .replace(/"originX"\s*:\s*[0-9.]+/, `"originX": ${scene.originX}`)
        .replace(/"deckY"\s*:\s*[0-9.]+/, `"deckY": ${scene.deckY}`)
        .replace(/"leftEdge"\s*:\s*[0-9.]+/, `"leftEdge": ${scene.leftEdge}`)
        .replace(/"rightEdge"\s*:\s*[0-9.]+/, `"rightEdge": ${scene.rightEdge}`)
        .replace(/"bankTopY"\s*:\s*[0-9.]+/, `"bankTopY": ${scene.bankTopY}`);
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
