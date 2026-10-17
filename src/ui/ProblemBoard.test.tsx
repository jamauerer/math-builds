/** @vitest-environment happy-dom */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { emptyScribble } from "../engine/scribble";
import type { Problem } from "../engine/types";
import { ProblemBoard } from "./ProblemBoard";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const problem: Problem = {
  prompt: "Subtract.",
  answer: "124",
  visual: { kind: "stacked", layout: "vertical", operator: "-", top: 167, bottom: 43 },
};

describe("problem drawing layer", () => {
  it("matches the problem size after a resize", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<ProblemBoard problem={problem} scribble={emptyScribble()} onScribble={() => undefined} />);
    });
    const stage = container.querySelector(".problem-stage") as HTMLElement;
    const canvas = container.querySelector("canvas") as HTMLCanvasElement;
    stage.getBoundingClientRect = () =>
      ({
        width: 480,
        height: 260,
        top: 0,
        left: 0,
        bottom: 260,
        right: 480,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;
    await act(async () => {
      window.dispatchEvent(new Event("resize"));
    });
    expect(canvas.style.width).toBe("480px");
    expect(canvas.style.height).toBe("260px");
    root.unmount();
    container.remove();
  });
});
