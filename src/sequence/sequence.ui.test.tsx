/** @vitest-environment happy-dom */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { App } from "../App";
import { createLearnerMap } from "../engine/placement";
import { skills } from "../data/load-skills";
import { blankSequence } from "./logic";
import { BridgeApp } from "./BridgeApp";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("first minutes and notebook", () => {
  it("starts a new learner without an age or placement screen", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<App />);
    });
    const text = container.textContent ?? "";
    expect(text).toContain("Welcome, inventor");
    expect(text).not.toContain("How old are you");
    expect(text).not.toContain("Placement");
    expect(container.querySelector('[data-phase="welcome"]')).toBeTruthy();
    root.unmount();
  });

  it("opens the notebook without changing the build", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <BridgeApp
          map={createLearnerMap(skills)}
          sequence={blankSequence()}
          onSequence={() => undefined}
          onSkillPass={() => undefined}
          initial={{ phase: "build", beamSpec: 14, tierId: "bridge-04", deck: true }}
        />,
      );
    });
    const shell = container.querySelector(".bridge-app") as HTMLElement;
    expect(shell.getAttribute("data-beam")).toBe("14");
    const open = [...container.querySelectorAll("button")].find((button) => button.textContent === "Notebook");
    await act(async () => {
      open?.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    });
    expect(shell.getAttribute("data-notebook")).toBe("open");
    expect(shell.getAttribute("data-beam")).toBe("14");
    const close = [...container.querySelectorAll("button")].find((button) => button.textContent === "Close");
    await act(async () => {
      close?.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    });
    expect(shell.getAttribute("data-notebook")).toBe("closed");
    expect(shell.getAttribute("data-beam")).toBe("14");
    root.unmount();
  });
});
