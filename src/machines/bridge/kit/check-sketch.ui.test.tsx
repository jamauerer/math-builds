/** @vitest-environment happy-dom */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { createLearnerMap } from "../../../engine/placement";
import { skills } from "../../../data/load-skills";
import { skillQuestion } from "../../../skills/generate";
import { LADDER_STEPS } from "../../../ladder/steps";
import { GoatKit } from "./GoatKit";
import type { KitProfile } from "../../../storage/progress";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const profile: KitProfile = {
  grade: 3,
  levels: { counting: 4, adding: 5, measuring: 5, geometry: 5, multiplying: 5, dividing: 5, fractions: 5, ratios: 5, algebra: 5 },
  history: [],
  notes: [],
  seenIntro: true,
};

async function mount(skill: string, seed = 3) {
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
        skillSeed={seed}
        kitProfile={profile}
      />,
    );
  });
  return { container, root };
}

function checkButton(container: HTMLElement) {
  return container.querySelector("[data-check]") as HTMLButtonElement;
}

function checked(container: HTMLElement, prompt: string) {
  const now = container.querySelector("h2.gk-prompt")?.textContent ?? "";
  return now !== prompt || Boolean(container.querySelector(".gk-celebrate")) || (container.textContent?.includes("Try again") ?? false) || (container.textContent?.includes("You earned") ?? false);
}

describe("check and sketch", () => {
  it("checks typed, stacked, choice, picture tap and drag only from the button or Enter", async () => {
    vi.useFakeTimers();
    const typed = skillQuestion("adding.3.a14", 3);
    const typedCard = await mount("adding.3.a14");
    const typedPrompt = typedCard.container.querySelector("h2.gk-prompt");
    expect(typedPrompt?.textContent).toBe(typed.prompt);
    expect(typedPrompt?.hasAttribute("hidden")).toBe(true);
    expect(typedCard.container.querySelector("canvas[data-question]")?.getAttribute("data-question")).toBe(typed.prompt);
    expect(typedCard.container.querySelector('canvas[aria-label="Work it out"]')).toBeTruthy();
    expect(checkButton(typedCard.container).disabled).toBe(true);
    const input = typedCard.container.querySelector('input[aria-label="Answer"]') as HTMLInputElement;
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    await act(async () => {
      setValue?.call(input, typed.answer);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    expect(typedCard.container.querySelector("h2.gk-prompt")?.textContent).toBe(typed.prompt);
    expect(checkButton(typedCard.container).disabled).toBe(false);
    expect(typedCard.container.textContent).not.toContain("You earned");
    expect(typedCard.container.textContent).not.toContain("Try again");
    await act(async () => {
      checkButton(typedCard.container).click();
    });
    expect(checked(typedCard.container, typed.prompt)).toBe(true);
    typedCard.root.unmount();
    typedCard.container.remove();

    const stacked = skillQuestion("adding.4.a17", 3);
    const stackedCard = await mount("adding.4.a17");
    expect(stackedCard.container.querySelector("h2.gk-prompt")?.hasAttribute("hidden")).toBe(true);
    expect(stackedCard.container.querySelector("[data-sketch='on']")?.getAttribute("data-stack")).toBe("stacked");
    expect(stackedCard.container.querySelector("canvas[data-question]")?.getAttribute("data-question")).toBe(stacked.prompt);
    expect(checkButton(stackedCard.container).disabled).toBe(true);
    expect(checkButton(stackedCard.container).textContent).toBe("Check");
    stackedCard.root.unmount();
    stackedCard.container.remove();

    const choice = skillQuestion("counting.4.even-odd", 4);
    const choiceCard = await mount("counting.4.even-odd", 4);
    expect(choiceCard.container.querySelector(".gk-scratch")).toBeNull();
    expect(choiceCard.container.querySelector(".gk-work")?.classList.contains("is-full")).toBe(true);
    expect(checkButton(choiceCard.container).disabled).toBe(true);
    const choicePrompt = choiceCard.container.querySelector("h2.gk-prompt")?.textContent;
    const option = choiceCard.container.querySelector(`[data-choice="${choice.answer}"]`) as HTMLButtonElement;
    await act(async () => {
      option.click();
    });
    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    expect(choiceCard.container.querySelector("h2.gk-prompt")?.textContent).toBe(choicePrompt);
    expect(checkButton(choiceCard.container).disabled).toBe(false);
    await act(async () => {
      document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });
    expect(checked(choiceCard.container, choicePrompt ?? "")).toBe(true);
    choiceCard.root.unmount();
    choiceCard.container.remove();

    const tapCard = await mount("fractions.2.halves");
    expect(tapCard.container.querySelector(".gk-scratch")).toBeNull();
    expect(tapCard.container.querySelector(".gk-qpic")).toBeNull();
    expect(tapCard.container.querySelectorAll("[data-choice] img").length).toBeGreaterThan(0);
    expect(checkButton(tapCard.container).disabled).toBe(true);
    const tapPrompt = tapCard.container.querySelector("h2.gk-prompt")?.textContent;
    const tap = tapCard.container.querySelector("[data-choice]") as HTMLButtonElement;
    await act(async () => {
      tap.click();
    });
    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    expect(tapCard.container.querySelector("h2.gk-prompt")?.textContent).toBe(tapPrompt);
    expect(checkButton(tapCard.container).disabled).toBe(false);
    tapCard.root.unmount();
    tapCard.container.remove();

    let dragSeed = 1;
    let drag = skillQuestion("counting.1.to-10", dragSeed);
    while (drag.answer === "3" && dragSeed < 12) {
      dragSeed += 1;
      drag = skillQuestion("counting.1.to-10", dragSeed);
    }
    const dragCard = await mount("counting.1.to-10", dragSeed);
    const numerals = [...dragCard.container.querySelectorAll("[data-numeral]")];
    expect(numerals).toHaveLength(1);
    expect(numerals[0]?.textContent).toContain(drag.answer);
    expect(dragCard.container.querySelector(".gk-cue")).toBeNull();
    expect(dragCard.container.querySelector(".gk-scratch")).toBeNull();
    expect(dragCard.container.querySelector(".gk-drag-box")?.getAttribute("data-count")).toBe("0");
    expect(checkButton(dragCard.container).textContent).toBe("✓");
    expect(checkButton(dragCard.container).textContent).not.toContain("Check");
    expect(checkButton(dragCard.container).disabled).toBe(true);
    const bolt = dragCard.container.querySelector(".gk-drag-bolt") as HTMLButtonElement;
    await act(async () => {
      bolt.click();
    });
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(dragCard.container.querySelector("[data-numeral]")?.textContent).toContain(drag.answer);
    expect(checkButton(dragCard.container).disabled).toBe(false);
    const dragPrompt = dragCard.container.querySelector("h2.gk-prompt")?.textContent ?? "";
    expect(dragCard.container.textContent).not.toContain("Try again");
    await act(async () => {
      document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });
    expect(checked(dragCard.container, dragPrompt)).toBe(true);
    dragCard.root.unmount();
    dragCard.container.remove();
    vi.useRealTimers();
  });

  it("shows no plank picture on an arithmetic step", async () => {
    const arithmetic = LADDER_STEPS.map((step) => step.skillId);
    for (const skillId of arithmetic) {
      const card = await mount(skillId, 2);
      const planks = [...card.container.querySelectorAll(".gk-card img")].filter((img) => (img.getAttribute("src") ?? "").includes("plank"));
      expect(planks, skillId).toHaveLength(0);
      card.root.unmount();
      card.container.remove();
    }
  });

  it("grows kit cards so one blurb does not sit in the next card", async () => {
    const css = readFileSync(resolve("src/machines/bridge/kit/goat.css"), "utf8");
    expect(css).not.toMatch(/\.gk-row-copy span[\s\S]{0,220}white-space:\s*nowrap/);
    expect(css).toMatch(/\.gk-row \{[^}]*overflow:\s*hidden/);
    const card = await mount("adding.3.a14");
    const bottom = card.container.querySelector('[data-group="bottom"]');
    const posts = card.container.querySelector('[data-group="posts"]');
    expect(bottom?.querySelector(".gk-row-copy span")?.textContent).toBe("the bridge rests on these");
    expect(posts?.textContent).not.toContain("the bridge rests on these");
    const rows = [...card.container.querySelectorAll(".gk-row")];
    expect(rows.length).toBeGreaterThan(2);
    for (const row of rows) {
      expect(row.querySelector(".gk-row-copy span")?.textContent?.trim().length).toBeGreaterThan(0);
    }
    card.root.unmount();
    card.container.remove();
  });
});
