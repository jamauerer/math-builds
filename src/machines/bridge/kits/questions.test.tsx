/** @vitest-environment happy-dom */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { createLearnerMap } from "../../../engine/placement";
import { KIT_STRANDS } from "../../../engine/strand-placement";
import { skills } from "../../../data/load-skills";
import { lessonFrame } from "./earn";
import { KIT_SKILLS } from "./skills";
import { GoatKit } from "../kit/GoatKit";
import type { KitProfile } from "../../../storage/progress";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const profile: KitProfile = {
  grade: 3,
  levels: Object.fromEntries(KIT_STRANDS.map((id) => [id, 5])),
  history: [],
  notes: [],
};

describe("question cards", () => {
  it("titles the Learn card with the skill name and shows the example", async () => {
    const levels = Object.fromEntries(KIT_STRANDS.map((id) => [id, 5]));
    const frame = lessonFrame("learn", levels);
    const skill = KIT_SKILLS.find((item) => item.id === frame.current.skillId);
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <GoatKit map={createLearnerMap(skills)} marks={0} onMarks={() => undefined} units="us" onUnits={() => undefined} start="earn" lesson="learn" level={5} kitProfile={profile} />,
      );
    });
    expect(container.querySelector("h2.gk-prompt")?.textContent).toBe(skill?.name);
    const line = container.querySelector("[data-learn-line]")?.textContent ?? "";
    const numbers = frame.current.fact.kind === "plain" ? [frame.current.fact.draw.a, frame.current.fact.draw.b] : [];
    for (const number of numbers) {
      expect(line).toContain(String(number));
    }
    if (frame.current.fact.kind === "plain" && frame.current.fact.draw.op === "mul") {
      expect(container.querySelector("[data-rows]")?.getAttribute("data-rows")).toBe(String(frame.current.fact.draw.a));
      expect(container.querySelector("[data-each]")?.getAttribute("data-each")).toBe(String(frame.current.fact.draw.b));
    }
    root.unmount();
    container.remove();
  });

  it("opens scratch at level 7 and keeps it behind a button at level 2", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <GoatKit map={createLearnerMap(skills)} marks={0} onMarks={() => undefined} units="us" onUnits={() => undefined} start="earn" lesson="mixed" level={7} kitProfile={{ ...profile, levels: Object.fromEntries(KIT_STRANDS.map((id) => [id, 7])) }} />,
      );
    });
    expect(container.querySelector('canvas[aria-label="Work it out"]')).toBeTruthy();
    expect(container.querySelector(".gk-keys")).toBeTruthy();
    root.unmount();
    container.remove();

    const low = document.createElement("div");
    document.body.appendChild(low);
    const lowRoot = createRoot(low);
    await act(async () => {
      lowRoot.render(
        <GoatKit map={createLearnerMap(skills)} marks={0} onMarks={() => undefined} units="us" onUnits={() => undefined} start="earn" lesson="mixed" level={2} kitProfile={{ ...profile, levels: Object.fromEntries(KIT_STRANDS.map((id) => [id, 2])) }} />,
      );
    });
    expect(low.querySelector("canvas")).toBeNull();
    expect(low.textContent).toContain("Work it out");
    expect(low.querySelector(".gk-dots")).toBeTruthy();
    lowRoot.unmount();
    low.remove();
  });

  it("moves on after a right plain answer without an extra tap", async () => {
    vi.useFakeTimers();
    const levels = Object.fromEntries(KIT_STRANDS.map((id) => [id, 5]));
    const frame = lessonFrame("mixed", levels);
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <GoatKit map={createLearnerMap(skills)} marks={0} onMarks={() => undefined} units="us" onUnits={() => undefined} start="earn" lesson="mixed" level={5} kitProfile={{ ...profile, levels }} />,
      );
    });
    const before = container.querySelector("h2.gk-prompt")?.textContent;
    const input = container.querySelector('input[aria-label="Answer"]') as HTMLInputElement;
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    await act(async () => {
      setValue?.call(input, frame.current.answer);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    expect(container.querySelector("h2.gk-prompt")?.textContent).not.toBe(before);
    vi.useRealTimers();
    root.unmount();
    container.remove();
  });
});
