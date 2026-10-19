/** @vitest-environment happy-dom */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { createLearnerMap } from "../../../engine/placement";
import { skills } from "../../../data/load-skills";
import { setUnitSystem } from "../../../units";
import { GoatKit } from "./GoatKit";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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
        <GoatKit map={createLearnerMap(skills)} marks={38} onMarks={() => undefined} units="metric" onUnits={() => undefined} start={stage} />,
      );
    });
    const sources = [...container.querySelectorAll("img")].map((img) => img.getAttribute("src") ?? "");
    expect(sources.some((src) => src.includes("/art/"))).toBe(true);
    if (stage === "assemble" || stage === "drive" || stage === "wreck") {
      expect(sources).toContain("/art/banks.png");
    }
    if (stage === "wreck") {
      expect(container.textContent).toContain("1 m short");
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
    expect(container.textContent).toContain("1 of 5");
    expect(container.textContent).toContain("The goat waits on the bank.");
    expect(container.querySelector(".gk-qpic")).toBeNull();
    expect(container.querySelector(".gk-keys")?.textContent).not.toContain(".");
    root.unmount();
    container.remove();
  });
});
