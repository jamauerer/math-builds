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
          kitProfile={{ grade: 3, country: "US", gradeSystem: "us", levels: {}, history: [], notes: [] }}
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

  it("labels empty slots by where they run, not by length, and adds one strip line per length", async () => {
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
    expect(labels.some((label) => label.includes("0 ft") || label.includes("at 2 ft"))).toBe(true);
    expect(labels.every((label) => !label.includes("How long"))).toBe(true);
    expect(container.querySelectorAll(".gk-work")).toHaveLength(0);
    expect(container.querySelectorAll(".gk-say")).toHaveLength(1);
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
    expect(low.textContent).toContain("The stone blocks are the abutments. They are already there. The beams rest on them.");
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
    expect(tray).toContain("8 planks");
    expect(tray).toContain("Coming in round 2: posts, top beam, braces");
    expect(tray).not.toContain("Post");
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
    expect(row.textContent).toContain("4 ft");
    root.unmount();
    container.remove();
  });

  it("writes slot facts from kit coordinates when a slot is focused", async () => {
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
          level={5}
          guideMode="off"
          focusSlot="bottom-a"
          kitProfile={{ ...placedProfile, built: true }}
        />,
      );
    });
    expect(container.querySelector("[data-slot-fact]")?.textContent).toContain("It runs from 0 ft to 4 ft on the tape");
    expect(container.querySelector("[data-slot-fact]")?.textContent).toContain("How long?");
    expect(container.querySelector("[data-tape-hi]")).toBeTruthy();
    root.unmount();
    container.remove();
  });

  it("lays planks one after another from the Lay planks button", async () => {
    setUnitSystem("us");
    vi.useFakeTimers();
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
          level={2}
          round={1}
          guideMode="off"
          kitProfile={{ ...placedProfile, built: true, levels: { ...placedProfile.levels, measuring: 2 } }}
        />,
      );
    });
    expect(container.textContent).toContain("8 planks");
    expect(container.textContent).toContain("Lay planks");
    const lay = [...container.querySelectorAll("button")].find((button) => button.textContent === "Lay planks") as HTMLButtonElement;
    await act(async () => {
      lay.click();
    });
    await act(async () => {
      vi.advanceTimersByTime(150 * 4);
    });
    expect(container.querySelectorAll('[data-piece^="plank-"]').length).toBeGreaterThanOrEqual(4);
    await act(async () => {
      vi.advanceTimersByTime(150 * 8);
    });
    expect(container.querySelectorAll('[data-piece^="plank-"]').length).toBe(8);
    vi.useRealTimers();
    root.unmount();
    container.remove();
  });

  it.each([300, 380] as const)("keeps tray rows inside %s px with stamp or cut field", async (width) => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const css = readFileSync(resolve("src/machines/bridge/kit/goat.css"), "utf8");
    expect(css).toMatch(/\.gk-row-copy b[\s\S]*white-space:\s*nowrap/);
    expect(css).toMatch(/\.gk-row-copy span[\s\S]*white-space:\s*nowrap/);
    expect(css).toMatch(/\.gk-place[\s\S]*grid-column:\s*-1/);
    expect(css).toMatch(/\.gk-row[\s\S]*grid-template-columns:\s*64px minmax\(0, 1fr\)/);

    const container = document.createElement("div");
    container.style.width = `${width}px`;
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
          level={2}
          guideMode="off"
          kitProfile={{ ...placedProfile, built: true, levels: { ...placedProfile.levels, measuring: 2 } }}
        />,
      );
    });
    const panel = container.querySelector("[data-drag]") as HTMLElement;
    panel.style.width = `${width}px`;
    const rows = [...panel.querySelectorAll(".gk-row")] as HTMLElement[];
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      row.style.width = `${width}px`;
      row.style.maxWidth = `${width}px`;
      row.style.boxSizing = "border-box";
      const copy = row.querySelector(".gk-row-copy");
      expect(copy?.querySelector("b")).toBeTruthy();
      expect(copy?.querySelector(":scope > span")).toBeTruthy();
      const place = row.querySelector(".gk-place") as HTMLElement | null;
      if (place) {
        expect(row.contains(place)).toBe(true);
      }
      const stamp = row.querySelector(".gk-stamp");
      if (stamp) {
        expect(row.querySelector(".gk-thumb")?.contains(stamp)).toBe(true);
        expect(stamp.textContent).toMatch(/\d+\s*(ft|m)/);
      }
    }
    expect(panel.querySelector(".gk-stamp")?.textContent).toMatch(/\d/);
    expect(container.textContent).toContain("Pieces come cut to size. Put each one on its dotted line.");
    root.unmount();
    container.remove();

    const cutBox = document.createElement("div");
    cutBox.style.width = `${width}px`;
    document.body.appendChild(cutBox);
    const cutRoot = createRoot(cutBox);
    await act(async () => {
      cutRoot.render(
        <GoatKit
          map={createLearnerMap(skills)}
          marks={0}
          onMarks={() => undefined}
          units="us"
          onUnits={() => undefined}
          start="assemble"
          level={5}
          guideMode="off"
          kitProfile={{ ...placedProfile, built: true }}
        />,
      );
    });
    const cutPanel = cutBox.querySelector("[data-drag]") as HTMLElement;
    cutPanel.style.width = `${width}px`;
    const cutRow = [...cutPanel.querySelectorAll(".gk-row")].find((row) => row.querySelector('input[aria-label="Bottom beam length"]')) as HTMLElement;
    expect(cutRow).toBeTruthy();
    cutRow.style.width = `${width}px`;
    cutRow.style.maxWidth = `${width}px`;
    cutRow.style.boxSizing = "border-box";
    const cutField = cutRow.querySelector(".gk-cut") as HTMLElement;
    expect(cutField.querySelector(".gk-unit")?.textContent).toBe("ft");
    const input = cutField.querySelector("input.gk-len") as HTMLInputElement;
    expect(input).toBeTruthy();
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    await act(async () => {
      setValue?.call(input, "4");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const cutPlace = cutRow.querySelector(".gk-place") as HTMLElement;
    expect(cutRow.contains(cutField)).toBe(true);
    expect(cutRow.contains(cutPlace)).toBe(true);
    expect(cutPlace.textContent).toBe("Place");
    const kids = [...cutRow.children];
    expect(kids.indexOf(cutField)).toBeLessThan(kids.indexOf(cutPlace));
    cutRoot.unmount();
    cutBox.remove();
  });

  it("guides assemble one piece at a time with a soft outline and no pulse", async () => {
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
          level={2}
          guideMode="on"
          kitProfile={placedProfile}
        />,
      );
    });
    expect(container.textContent).toContain("The stone blocks are the abutments. They are already there. The beams rest on them.");
    expect(container.textContent).toContain("It runs from 0 ft to 4 ft on the tape");
    expect(container.querySelectorAll(".gk-row").length).toBe(1);
    expect(container.querySelectorAll(".gk-slot-label").length).toBe(1);
    expect(container.querySelector(".gk-row")?.className).toContain("focus");
    expect(container.querySelector(".gk-row.pulse")).toBeNull();
    expect(container.querySelector(".gk-corner-pulse")).toBeNull();
    expect([...container.querySelectorAll("button")].some((button) => button.textContent === "Send the goat")).toBe(false);
    expect([...container.querySelectorAll("button")].some((button) => button.textContent === "Place")).toBe(true);
    root.unmount();
    container.remove();
  });

  it("puts all gussets on at once from Put on the gussets", async () => {
    vi.useFakeTimers();
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
          level={2}
          round={1}
          guideMode="on"
          drops={{ "bottom-a": "4", "bottom-b": "4" }}
          kitProfile={placedProfile}
        />,
      );
    });
    expect(container.textContent).toContain("Put on the gussets");
    const put = [...container.querySelectorAll("button")].find((button) => button.textContent === "Put on the gussets") as HTMLButtonElement;
    await act(async () => {
      put.click();
    });
    await act(async () => {
      vi.advanceTimersByTime(90 * 6);
    });
    expect(container.querySelectorAll('[data-piece^="gusset-"]').length).toBeGreaterThanOrEqual(5);
    vi.useRealTimers();
    root.unmount();
    container.remove();
  });

  it("names pre-cut mode on the intro card and parent profile", async () => {
    const intro = document.createElement("div");
    document.body.appendChild(intro);
    const introRoot = createRoot(intro);
    await act(async () => {
      introRoot.render(
        <GoatKit
          map={createLearnerMap(skills)}
          marks={0}
          onMarks={() => undefined}
          units="us"
          onUnits={() => undefined}
          start="intro"
          level={2}
          kitProfile={{ ...placedProfile, levels: { ...placedProfile.levels, measuring: 2 }, seenIntro: false }}
        />,
      );
    });
    expect(intro.querySelector("[data-precut]")?.textContent).toBe("Your pieces come already cut. You will cut them yourself later.");
    introRoot.unmount();
    intro.remove();

    const profile = document.createElement("div");
    document.body.appendChild(profile);
    const profileRoot = createRoot(profile);
    await act(async () => {
      profileRoot.render(
        <GoatKit
          map={createLearnerMap(skills)}
          marks={0}
          onMarks={() => undefined}
          units="us"
          onUnits={() => undefined}
          start="profile"
          kitProfile={{ ...placedProfile, levels: { ...placedProfile.levels, measuring: 2 } }}
        />,
      );
    });
    expect(profile.querySelector("[data-cut-mode]")?.textContent).toContain("Pre-cut pieces");
    expect(profile.querySelector("[data-cut-mode]")?.textContent).toContain("measuring level 2");
    profileRoot.unmount();
    profile.remove();
  });
});
