/** @vitest-environment happy-dom */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { createLearnerMap } from "../../../engine/placement";
import { skills } from "../../../data/load-skills";
import { setUnitSystem } from "../../../units";
import { answerEarn, openRun } from "../kits/earn";
import { queenPost } from "../kits/kit";
import { GoatKit } from "./GoatKit";
import type { KitProfile } from "../../../storage/progress";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const placedProfile: KitProfile = {
  grade: 3,
  levels: { dividing: 4, measuring: 4, adding: 4, multiplying: 4, fractions: 4, ratios: 4, geometry: 4, algebra: 4, counting: 4 },
  history: [],
  notes: [],
};

const stages = ["pick", "earn", "assemble", "drive", "wreck"] as const;

describe("goat bridge screens", () => {
  it.each(stages)("renders the %s screen with the art and no console errors", async (stage) => {
    const errors: unknown[] = [];
    const spy = vi.spyOn(console, "error").mockImplementation((...args) => {
      errors.push(args);
    });
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <GoatKit map={createLearnerMap(skills)} marks={38} onMarks={() => undefined} units="metric" onUnits={() => undefined} start={stage} kitProfile={placedProfile} />,
      );
    });
    const sources = [...container.querySelectorAll("img")].map((img) => img.getAttribute("src") ?? "");
    expect(sources.some((src) => src.includes("/art/"))).toBe(true);
    if (stage === "assemble" || stage === "drive" || stage === "wreck") {
      expect(sources).toContain("/art/banks.png");
    }
    if (stage === "wreck") {
      expect(container.textContent).toContain("short by 1 m");
      expect(container.textContent).toContain("Top beam");
    }
    expect(errors, JSON.stringify(errors)).toEqual([]);
    spy.mockRestore();
    root.unmount();
    container.remove();
  });

  it("keeps level numbers off the earn screen", async () => {
    setUnitSystem("us");
    const map = createLearnerMap(skills);
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <GoatKit map={map} marks={0} onMarks={() => undefined} units="us" onUnits={() => undefined} start="earn" level={1} />,
      );
    });
    expect(container.textContent?.toLowerCase()).not.toContain("level");
    expect(container.textContent).toContain("1 of 3");
    expect(container.textContent).toContain("Round 1 of 3");
    expect(container.textContent).toContain("The goat waits on the bank.");
    expect(container.querySelector(".gk-qpic")).toBeNull();
    expect(container.querySelector(".gk-keys")?.textContent).not.toContain(".");
    root.unmount();
    container.remove();
  });

  it("sends a profile with no placement to the grade pick", async () => {
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
          start="pick"
          kitProfile={{ grade: 3, levels: {}, history: [], notes: [] }}
        />,
      );
    });
    const card = [...container.querySelectorAll("button")].find((button) => button.textContent?.includes("The Goat Bridge"));
    await act(async () => {
      card?.click();
    });
    expect(container.textContent).toContain("What grade are you in");
    root.unmount();
    container.remove();
  });

  it("widens the earned bar after one right answer", async () => {
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
          level={4}
          lesson="step"
          kitProfile={placedProfile}
        />,
      );
    });
    const bar = container.querySelector(".gk-earn .gk-bar i") as HTMLElement | null;
    expect(parseFloat(bar?.style.width ?? "0")).toBeGreaterThan(0);
    root.unmount();
    container.remove();
  });

  it("renders the next question when three pieces are already earned", async () => {
    const levels = placedProfile.levels;
    let state = openRun(levels, "bottom", 2);
    state = {
      ...state,
      book: { ...state.book, introduced: "already" },
    };
    while (state.phase === "plain") {
      state = answerEarn(state, state.current.answer, levels).state;
    }
    const next = answerEarn(state, state.current.answer, levels).state;
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
          level={4}
          kitProfile={{ ...placedProfile, seenIntro: true, session: next }}
        />,
      );
    });
    expect(container.textContent).not.toContain("That's the lesson");
    expect(container.textContent).not.toContain("The kit is earned");
    expect(container.querySelector(".gk-prompt")?.textContent?.trim().length).toBeGreaterThan(0);
    root.unmount();
    container.remove();
  });

  it("shows the earned piece in the center and then lights its row", async () => {
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
          level={4}
          piece="bottom"
          word
          kitProfile={{ ...placedProfile, seenIntro: true }}
        />,
      );
    });
    const four = [...container.querySelectorAll(".gk-keys button")].find((button) => button.textContent === "4") as HTMLButtonElement | undefined;
    await act(async () => {
      four?.click();
    });
    const check = [...container.querySelectorAll("button")].find((button) => button.textContent === "Check") as HTMLButtonElement | undefined;
    await act(async () => {
      check?.click();
    });
    expect(container.querySelector(".gk-celebrate img")).toBeTruthy();
    expect(container.textContent).toContain("You earned the bottom beam!");
    const moment = container.querySelector(".gk-celebrate");
    await act(async () => {
      (moment as HTMLButtonElement | null)?.click();
    });
    expect(container.querySelector(".gk-celebrate")).toBeNull();
    expect(container.querySelector('[data-group="bottom"]')?.className).toContain("earned");
    root.unmount();
    container.remove();
  });

  it("hides slot digits until a length is typed and adds one strip line per length", async () => {
    setUnitSystem("us");
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
          start="assemble"
          level={4}
          guideMode="off"
          kitProfile={{ ...placedProfile, built: true }}
        />,
      );
    });
    const labels = [...container.querySelectorAll(".gk-slot-label")].map((label) => label.textContent ?? "");
    expect(labels.length).toBeGreaterThan(0);
    expect(labels.every((label) => !/\d/.test(label))).toBe(true);
    expect(container.querySelectorAll(".gk-work")).toHaveLength(0);
    const inputs = [...container.querySelectorAll("input.gk-len")] as HTMLInputElement[];
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    await act(async () => {
      setValue?.call(inputs[0], "4");
      inputs[0]?.dispatchEvent(new Event("input", { bubbles: true }));
      setValue?.call(inputs[1], "3");
      inputs[1]?.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const lines = [...container.querySelectorAll(".gk-work")].map((line) => line.textContent);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("4");
    expect(lines[1]).toContain("3");
    root.unmount();
    container.remove();
  });

  it("hides length fields in pre-cut mode and shows them when measuring is level 5", async () => {
    const low = document.createElement("div");
    document.body.appendChild(low);
    const lowRoot = createRoot(low);
    await act(async () => {
      lowRoot.render(
        <GoatKit map={createLearnerMap(skills)} marks={0} onMarks={() => undefined} units="us" onUnits={() => undefined} start="assemble" level={2} kitProfile={placedProfile} />,
      );
    });
    expect(low.querySelectorAll("input.gk-len")).toHaveLength(0);
    expect(low.textContent).toContain("The bottom beams are the sides of the bridge. The planks are the floor. No planks, no floor.");
    lowRoot.unmount();
    low.remove();

    const high = document.createElement("div");
    document.body.appendChild(high);
    const highRoot = createRoot(high);
    await act(async () => {
      highRoot.render(
        <GoatKit map={createLearnerMap(skills)} marks={12} onMarks={() => undefined} units="us" onUnits={() => undefined} start="assemble" level={5} guideMode="off" kitProfile={{ ...placedProfile, built: true }} />,
      );
    });
    expect(high.querySelectorAll("input.gk-len").length).toBeGreaterThan(0);
    highRoot.unmount();
    high.remove();
  });

  it("draws a beam at the typed length before anything else happens", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <GoatKit map={createLearnerMap(skills)} marks={0} onMarks={() => undefined} units="us" onUnits={() => undefined} start="assemble" level={5} guideMode="off" kitProfile={{ ...placedProfile, built: true }} />,
      );
    });
    const input = container.querySelector('input[aria-label="Bottom beam length"]') as HTMLInputElement;
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    await act(async () => {
      setValue?.call(input, "40");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const beam = container.querySelector('[data-piece="bottom-a"]') as HTMLElement;
    expect(beam.getAttribute("data-length")).toBe("40");
    expect(parseFloat(beam.style.width)).toBe(2000);
    root.unmount();
    container.remove();
  });

  it("names the pieces still in the tray before the goat is sent", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <GoatKit map={createLearnerMap(skills)} marks={0} onMarks={() => undefined} units="us" onUnits={() => undefined} start="assemble" level={5} guideMode="off" kitProfile={{ ...placedProfile, built: true }} />,
      );
    });
    const send = [...container.querySelectorAll("button")].find((button) => button.textContent === "Send the goat") as HTMLButtonElement;
    await act(async () => {
      send.click();
    });
    expect(container.textContent).toContain("The bridge is not finished yet. Send him anyway?");
    expect(container.textContent).toContain("Send him");
    expect(container.textContent).toContain("Earn more pieces first");
    expect(container.textContent).toContain("Bottom beam");
    expect(container.textContent).toContain("Gusset");
    expect(container.textContent).not.toContain("Post");
    root.unmount();
    container.remove();
  });

  it("shows the next round marker and only that round in the tray", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <GoatKit map={createLearnerMap(skills)} marks={0} onMarks={() => undefined} units="us" onUnits={() => undefined} start="earn" level={4} round={2} kitProfile={placedProfile} />,
      );
    });
    expect(container.textContent).toContain("Round 2 of 3");
    const bar = container.querySelector(".gk-earn .gk-bar i") as HTMLElement | null;
    expect(parseFloat(bar?.style.width ?? "1")).toBe(0);
    root.unmount();
    container.remove();

    const assemble = document.createElement("div");
    document.body.appendChild(assemble);
    const assembleRoot = createRoot(assemble);
    await act(async () => {
      assembleRoot.render(
        <GoatKit map={createLearnerMap(skills)} marks={0} onMarks={() => undefined} units="us" onUnits={() => undefined} start="assemble" level={4} round={1} guideMode="off" kitProfile={{ ...placedProfile, built: true }} />,
      );
    });
    const tray = assemble.querySelector("[data-drag]")?.textContent ?? "";
    expect(tray).toContain("Bottom beam");
    expect(tray).toContain("Gusset");
    expect(tray).not.toContain("Post");
    expect(tray).not.toContain("Plank");
    assembleRoot.unmount();
    assemble.remove();
  });

  it("shows a stare line after a dunk and does not change marks", async () => {
    vi.useFakeTimers();
    const onMarks = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <GoatKit map={createLearnerMap(skills)} marks={12} onMarks={onMarks} units="us" onUnits={() => undefined} start="wreck" fault="top" level={4} kitProfile={placedProfile} />,
      );
    });
    await act(async () => {
      vi.advanceTimersByTime(1600);
    });
    const line = queenPost.dunks.find((item) => container.textContent?.includes(item.line));
    expect(line).toBeTruthy();
    expect(onMarks).not.toHaveBeenCalled();
    vi.useRealTimers();
    root.unmount();
    container.remove();
  });

  it("places a tray piece with a length when it is tapped", async () => {
    setUnitSystem("us");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <GoatKit map={createLearnerMap(skills)} marks={0} onMarks={() => undefined} units="us" onUnits={() => undefined} start="assemble" level={2} guideMode="off" kitProfile={{ ...placedProfile, built: true, levels: { ...placedProfile.levels, measuring: 2 } }} />,
      );
    });
    const row = [...container.querySelectorAll(".gk-row")].find((item) => item.textContent?.includes("Bottom beam")) as HTMLElement;
    await act(async () => {
      row.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: 20, clientY: 20 }));
      row.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, clientX: 22, clientY: 21 }));
    });
    expect(row.textContent).toContain("on the bridge");
    expect(container.textContent).toContain("Bottom beam: 4 ft");
    root.unmount();
    container.remove();
  });
});
