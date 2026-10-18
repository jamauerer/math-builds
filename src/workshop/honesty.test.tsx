/** @vitest-environment happy-dom */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { skills, strands } from "../data/load-skills";
import { generators } from "../engine/generators";
import { machines, models } from "../machines";
import type { Challenge } from "../machines/types";
import { SceneCanvas } from "./Workshop";
import { calcColumnLayout, paintMachine, requiredSubject, resultAllowed, rulerEnds, sceneIdFor, subjectsFor, type ScenePainter } from "./scenes";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function challenges(): Challenge[] {
  return machines.flatMap((machine) => machine.challenges);
}

function recorder(): ScenePainter & { rects: { x: number; y: number; w: number; h: number }[]; texts: string[] } {
  const rects: { x: number; y: number; w: number; h: number }[] = [];
  const texts: string[] = [];
  return {
    rects,
    texts,
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    font: "",
    fillRect(x, y, w, h) {
      rects.push({ x, y, w, h });
    },
    beginPath() {},
    arc() {},
    fill() {},
    stroke() {},
    moveTo() {},
    lineTo() {},
    fillText(text) {
      texts.push(text);
    },
  };
}

describe("one scene per family", () => {
  it("gives every family its own scene id", () => {
    const ids = challenges().map((challenge) => sceneIdFor(challenge));
    const families = new Set(challenges().map((challenge) => challenge.family));
    expect(new Set(ids).size).toBe(families.size);
  });

  it("draws the measure subject inside that family's scene", () => {
    for (const challenge of challenges()) {
      const measure = challenge.questions.find((question) => question.kind === "measure");
      const subject = requiredSubject(measure?.prompt ?? "");
      if (!subject) {
        continue;
      }
      expect(subjectsFor(sceneIdFor(challenge))).toContain(subject);
    }
  });

  it("labels both ends of the ruler", () => {
    const ruler = rulerEnds(6.5);
    expect(ruler.start).toBe("0");
    expect(ruler.end).not.toBe("0");
    expect(ruler.ticks).toBeGreaterThanOrEqual(2);
    expect(rulerEnds(Number.NaN).end).not.toBe("undefined");
  });
});

describe("test step drawing", () => {
  it("renders drawn frames and a body that moves before a result is allowed", async () => {
    const challenge = challenges().find((item) => item.family === "Counting a stick bridge");
    if (!challenge) {
      throw new Error("missing bridge");
    }
    const frames = new Map<HTMLCanvasElement, ReturnType<typeof recorder>>();
    (HTMLCanvasElement.prototype as unknown as { getContext: () => unknown }).getContext = function getContext(this: HTMLCanvasElement) {
      const existing = frames.get(this);
      if (existing) {
        return existing;
      }
      const next = recorder();
      frames.set(this, next);
      return next;
    };
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<SceneCanvas challenge={challenge} progress={0} angle={0} placed={4} slow={false} />);
    });
    const canvas = container.querySelector("canvas") as HTMLCanvasElement;
    const first = frames.get(canvas);
    expect(first?.rects.length).toBeGreaterThan(0);
    expect(canvas.getAttribute("data-scene")).toBe("stick-bridge");
    const startX = first?.rects.find((rect) => rect.w === 36)?.x;
    await act(async () => {
      root.render(<SceneCanvas challenge={challenge} progress={0.5} angle={0.4} placed={4} slow={false} />);
    });
    const laterX = frames.get(canvas)?.rects.filter((rect) => rect.w === 36).at(-1)?.x;
    expect(startX).not.toBe(laterX);
    expect(resultAllowed(0)).toBe(false);
    expect(resultAllowed(first?.rects.length ?? 0)).toBe(true);
    const gear = challenges().find((item) => item.family === "Count the turns");
    if (!gear) {
      throw new Error("missing gears");
    }
    const drawn = recorder();
    paintMachine(drawn, { sceneId: sceneIdFor(gear), span: 12, progress: 0.4, angle: 0.2, placed: 24, slow: false });
    expect(drawn.texts).toContain("gear");
    const movie = models.bridge.simulate([{ id: "beam", kind: "beam", spec: 4, slot: "main" }], challenge.scene);
    const firstBody = movie[0]?.bodies.find((body) => body.id === "car");
    const lastBody = movie.at(-1)?.bodies.find((body) => body.id === "car");
    expect(firstBody).toBeTruthy();
    expect(lastBody && (lastBody.x !== firstBody?.x || lastBody.y !== firstBody?.y || lastBody.angle !== firstBody?.angle)).toBe(true);
    root.unmount();
  });
});

describe("calculate column layout", () => {
  it("keeps the keypad below the pad at the three play sizes", () => {
    for (const viewport of [768, 820, 900]) {
      const column = viewport - 52 - 16;
      const layout = calcColumnLayout(column);
      const host = document.createElement("div");
      host.setAttribute("data-calc-column", "");
      host.style.position = "relative";
      host.style.height = `${column}px`;
      host.style.width = "320px";
      const pad = document.createElement("div");
      pad.setAttribute("data-pad", "");
      pad.style.position = "absolute";
      pad.style.top = `${layout.pad.top}px`;
      pad.style.height = `${layout.pad.bottom - layout.pad.top}px`;
      const keypad = document.createElement("div");
      keypad.setAttribute("data-keypad", "");
      keypad.style.position = "absolute";
      keypad.style.top = `${layout.keypad.top}px`;
      keypad.style.height = `${layout.keypad.bottom - layout.keypad.top}px`;
      host.append(pad, keypad);
      document.body.append(host);
      const padBox = { top: pad.offsetTop, bottom: pad.offsetTop + pad.offsetHeight };
      const keyBox = { top: keypad.offsetTop, bottom: keypad.offsetTop + keypad.offsetHeight };
      expect(padBox.bottom).toBeLessThanOrEqual(keyBox.top);
      expect(keyBox.bottom).toBeLessThanOrEqual(column);
      host.remove();
    }
  });
});

describe("curriculum tags", () => {
  it("tags each challenge to a skill in its strand that has a generator", () => {
    for (const challenge of challenges()) {
      for (const need of challenge.skills) {
        const skill = skills.find((item) => item.id === need.skillId);
        expect(skill).toBeTruthy();
        if (!skill) {
          continue;
        }
        expect(generators[skill.generator]).toBeTypeOf("function");
        const strand = strands.find((item) => item.id === skill.strand);
        expect(strand?.skills).toContain(skill.id);
      }
    }
  });
});
