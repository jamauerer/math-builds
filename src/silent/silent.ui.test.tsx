/** @vitest-environment happy-dom */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { createLearnerMap } from "../engine/placement";
import { skills } from "../data/load-skills";
import { GoatKit } from "../machines/bridge/kit/GoatKit";
import type { KitProfile } from "../storage/progress";
import { resetHands } from "./pre-reader";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const profile: KitProfile = {
  grade: 0,
  country: "US",
  levels: { counting: 1, adding: 1, measuring: 1, geometry: 1, multiplying: 1, dividing: 1, fractions: 1, ratios: 1, algebra: 1 },
  history: [],
  notes: [],
};

async function mount(skill: string, demo?: string) {
  resetHands();
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <GoatKit
        map={createLearnerMap(skills)}
        marks={0}
        onMarks={() => undefined}
        units="us"
        onUnits={() => undefined}
        start="earn"
        skill={skill}
        demo={demo ?? null}
        kitProfile={profile}
      />,
    );
  });
  return { container, root };
}

describe("silent pre-reader cards", () => {
  it("shows a fill-box picture, parent words, no Hear it, and a first-time hand", async () => {
    const { container, root } = await mount("adding.1.a1");
    expect(container.querySelector("[data-speak]")).toBeNull();
    expect(container.textContent).not.toContain("Hear it");
    expect(container.querySelector(".gk-keys")).toBeNull();
    expect(container.querySelector('input[aria-label="Answer"]')).toBeNull();
    expect(container.querySelector("[data-picture-help='fill-box']")).toBeTruthy();
    expect(container.querySelector("[data-action='drag-count']")).toBeTruthy();
    expect(container.querySelector("[data-hand='fill-box']")).toBeTruthy();
    expect(container.querySelector("h2.gk-prompt")?.classList.contains("is-parent")).toBe(true);
    expect(container.querySelector(".is-wrong")).toBeNull();
    expect(container.textContent).not.toMatch(/[✗✕]/);
    root.unmount();
    container.remove();
  });

  it("shows a count-tray and a compare-piles card", async () => {
    const count = await mount("counting.1.to-10");
    expect(count.container.querySelector("[data-picture-help='count-tray']")).toBeTruthy();
    expect(count.container.querySelector("[data-numeral]")).toBeTruthy();
    count.root.unmount();
    count.container.remove();

    const compare = await mount("counting.1.compare");
    expect(compare.container.querySelector("[data-picture-help='compare-piles']")).toBeTruthy();
    expect(compare.container.querySelector("[data-action='compare-piles']")).toBeTruthy();
    expect(compare.container.querySelector(".gk-compare-goat")).toBeTruthy();
    compare.root.unmount();
    compare.container.remove();
  });

  it("freezes the first-time hand mid-motion for the demo", async () => {
    const { container, root } = await mount("adding.1.a1", "hand");
    const hand = container.querySelector("[data-hand-demo='1']");
    expect(hand).toBeTruthy();
    expect(hand?.classList.contains("is-mid")).toBe(true);
    root.unmount();
    container.remove();
  });
});
