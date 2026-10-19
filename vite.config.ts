import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { measuredWaterY } from "./src/machines/bridge/kits/water-line";

function banksWater() {
  const waterY = measuredWaterY();
  return {
    name: "banks-water",
    enforce: "pre" as const,
    transform(code: string, id: string) {
      if (!id.replace(/\\/g, "/").endsWith("queen-post.json")) {
        return;
      }
      return code.replace(/"waterY"\s*:\s*[0-9.]+/, `"waterY": ${waterY}`);
    },
  };
}

export default defineConfig({
  plugins: [banksWater(), react()],
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
