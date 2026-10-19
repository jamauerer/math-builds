/** @vitest-environment happy-dom */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { createLearnerMap } from "../../../engine/placement";
import { skills } from "../../../data/load-skills";
import type { KitProfile } from "../../../storage/progress";
import { readFileSync } from "node:fs";
import { GoatKit } from "./GoatKit";

const css = readFileSync("src/machines/bridge/kit/goat.css", "utf8");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const placed: KitProfile = {
  grade: 3,
  levels: { dividing: 4, measuring: 4, adding: 4, multiplying: 4, fractions: 4, ratios: 4, geometry: 4, algebra: 4, counting: 4 },
  history: [],
  notes: [],
};

const screens = [
  { name: "placement", start: "place", lesson: null },
  { name: "earn", start: "earn", lesson: null },
  { name: "learn", start: "earn", lesson: "learn" },
  { name: "practice", start: "practice", lesson: null },
  { name: "assemble", start: "assemble", lesson: null },
  { name: "drive", start: "drive", lesson: null },
  { name: "wreck", start: "wreck", lesson: null },
] as const;

describe("learner screens fit a tablet", () => {
  it.each(screens)("keeps $name inside 1024x768", async (screen) => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    document.documentElement.style.width = "1024px";
    document.documentElement.style.height = "768px";
    document.body.style.margin = "0";
    document.body.style.width = "1024px";
    document.body.style.height = "768px";
    document.body.style.overflow = "auto";
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 768 });
    const container = document.createElement("div");
    container.style.width = "1024px";
    container.style.height = "768px";
    container.style.overflow = "auto";
    const sheet = document.createElement("style");
    sheet.textContent = css;
    document.head.appendChild(sheet);
    document.body.appendChild(container);
    const view = createRoot(container);
    await act(async () => {
      view.render(
        <GoatKit
          map={createLearnerMap(skills)}
          marks={4}
          onMarks={() => undefined}
          units="us"
          onUnits={() => undefined}
          start={screen.start}
          lesson={screen.lesson}
          level={4}
          kitProfile={placed}
        />,
      );
    });
    const root = container.querySelector(".goat-kit") as HTMLElement | null;
    expect(root, screen.name).toBeTruthy();
    const style = getComputedStyle(root as HTMLElement);
    expect(style.overflow, screen.name).toBe("hidden");
    expect(style.height, screen.name).toBe("768px");
    expect(document.documentElement.scrollHeight, screen.name).toBeLessThanOrEqual(768);
    const check = container.querySelector(".gk-idk, .gk-check") as HTMLElement | null;
    if (check) {
      expect(getComputedStyle(check).height, screen.name).not.toBe("0px");
    }
    const panel = container.querySelector(".gk-panel") as HTMLElement | null;
    if (panel) {
      expect(["auto", "scroll"], screen.name).toContain(getComputedStyle(panel).overflowY);
    }
    const picture = container.querySelector(".gk-qpic") as HTMLElement | null;
    if (picture) {
      expect(Number.parseFloat(getComputedStyle(picture).maxHeight)).toBeLessThanOrEqual(768 * 0.4 + 1);
    }
    view.unmount();
    container.remove();
  });
});
