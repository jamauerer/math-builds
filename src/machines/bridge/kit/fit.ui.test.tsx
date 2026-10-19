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
  kitVersion: 2,
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

/** Happy-dom returns an empty DOMRect, so the box is read from computed style down the column. */
function actionBox(action: HTMLElement, viewportHeight: number): { top: number; bottom: number; left: number; right: number; height: number } {
  const style = getComputedStyle(action);
  const height = px(style.height, viewportHeight);
  const width = px(style.width, viewportHeight) || action.parentElement?.clientWidth || 120;
  let top = 0;
  let node: HTMLElement | null = action;
  while (node && node !== document.body) {
    const parent = node.parentElement;
    if (!parent) {
      break;
    }
    const parentStyle = getComputedStyle(parent);
    const column = parentStyle.display === "flex" && parentStyle.flexDirection !== "row" && parentStyle.flexDirection !== "row-reverse";
    if (column) {
      for (const sibling of [...parent.children]) {
        if (sibling === node) {
          break;
        }
        top += px(getComputedStyle(sibling).height, viewportHeight);
      }
    }
    top += px(parentStyle.paddingTop, viewportHeight);
    node = parent;
  }
  return { top, bottom: top + height, left: 0, right: width, height };
}

function px(value: string, viewportHeight: number): number {
  if (value.endsWith("px")) {
    return Number.parseFloat(value);
  }
  if (value.endsWith("vh")) {
    return (Number.parseFloat(value) / 100) * viewportHeight;
  }
  return 0;
}

const viewports = [
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
] as const;

describe("learner screens fit a tablet", () => {
  it.each(viewports.flatMap((viewport) => screens.map((screen) => ({ ...screen, ...viewport }))))(
    "keeps the $name action inside $width x $height",
    async (screen) => {
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      document.documentElement.style.width = `${screen.width}px`;
      document.documentElement.style.height = `${screen.height}px`;
      document.body.style.margin = "0";
      document.body.style.width = `${screen.width}px`;
      document.body.style.height = `${screen.height}px`;
      document.body.style.overflow = "visible";
      Object.defineProperty(window, "innerWidth", { configurable: true, value: screen.width });
      Object.defineProperty(window, "innerHeight", { configurable: true, value: screen.height });
      const container = document.createElement("div");
      container.className = "app";
      container.style.width = `${screen.width}px`;
      container.style.height = `${screen.height}px`;
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
      const root = container.querySelector(".goat-kit") as HTMLElement;
      expect(root, screen.name).toBeTruthy();
      expect(getComputedStyle(root).overflow, screen.name).not.toBe("hidden");
      expect(document.documentElement.scrollHeight, screen.name).toBeLessThanOrEqual(screen.height);
      expect(document.body.scrollHeight, screen.name).toBeLessThanOrEqual(screen.height);
      const action = container.querySelector("[data-action='primary']") as HTMLElement;
      expect(action, screen.name).toBeTruthy();
      const box = actionBox(action, screen.height);
      expect(box.height, screen.name).toBeGreaterThan(0);
      expect(box.top, screen.name).toBeGreaterThanOrEqual(0);
      expect(box.bottom, screen.name).toBeLessThanOrEqual(screen.height + 1);
      expect(box.left, screen.name).toBeGreaterThanOrEqual(0);
      expect(box.right, screen.name).toBeLessThanOrEqual(screen.width + 1);
      view.unmount();
      container.remove();
    },
  );

  it("starts assemble with a Place button and nothing on the bridge", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const view = createRoot(container);
    await act(async () => {
      view.render(
        <GoatKit
          map={createLearnerMap(skills)}
          marks={0}
          onMarks={() => undefined}
          units="us"
          onUnits={() => undefined}
          start="assemble"
          level={2}
          guideMode="off"
          kitProfile={placed}
        />,
      );
    });
    const tray = container.querySelector("[data-drag]") as HTMLElement;
    expect(tray.textContent).toContain("Place");
    expect(tray.textContent).not.toContain("on the bridge");
    expect(container.textContent).toContain("Put every piece on its dotted line.");
    expect(container.textContent).toContain("Test");
    expect(container.textContent).not.toContain("Drive");
    view.unmount();
    container.remove();
  });
});
