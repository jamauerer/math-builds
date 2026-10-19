import { describe, expect, it } from "vitest";
import { createLearnerMap } from "../../../engine/placement";
import { skills } from "../../../data/load-skills";
import { answerEarn, blankEarn } from "./earn";
import { correctLengths, wreckLines } from "./kit";
import { simulateCrossing } from "./simulate";

describe("goat bridge kit", () => {
  it("keeps earned pieces and re-asks the missed one at the end", () => {
    const state0 = blankEarn(createLearnerMap(skills), 3);
    const first = answerEarn(state0, state0.queue[0].answer);
    expect(first.correct).toBe(true);
    expect(first.state.earned).toEqual(["bottom"]);
    const missed = first.state.queue[first.state.index].groupId;
    const second = answerEarn(first.state, "not-the-answer");
    expect(second.correct).toBe(false);
    expect(second.state.earned).toEqual(["bottom"]);
    expect(second.state.queue[second.state.queue.length - 1].groupId).toBe(missed);
    expect(second.state.queue[second.state.index].groupId).not.toBe(missed);
    expect(second.state.queue.length).toBe(state0.queue.length);
  });

  it("walks the goat to the far bank when every length is right", () => {
    const result = simulateCrossing(correctLengths());
    expect(result.ok).toBe(true);
    expect(result.goatX).toBeGreaterThanOrEqual(8);
    expect(result.goatY).toBeGreaterThanOrEqual(0);
    expect(result.frames[0]?.mode).toBe("idle");
    expect(result.frames.some((frame) => frame.mode === "walk" && Math.abs(frame.goatX - 2) < 0.2)).toBe(true);
    expect(result.frames.some((frame) => frame.mode === "walk" && Math.abs(frame.goatX - 4) < 0.2)).toBe(true);
    expect(result.frames.some((frame) => frame.mode === "walk" && Math.abs(frame.goatX - 6) < 0.2)).toBe(true);
    expect(result.frames[result.frames.length - 1]?.mode).toBe("arrived");
  });

  it("drops the goat when the top beam is typed 3 m and names that piece 1 m short", () => {
    const lengths = { ...correctLengths(), top: 3 };
    const result = simulateCrossing(lengths);
    expect(result.ok).toBe(false);
    expect(result.goatY).toBeLessThan(0);
    expect(result.bodies.some((body) => body.id.includes("beam") || body.id === "top" || body.id.startsWith("bottom"))).toBe(true);
    expect(result.bodies.some((body) => (body.id === "top" || body.id.startsWith("bottom")) && body.y < 0)).toBe(true);
    const line = wreckLines(lengths).find((item) => item.startsWith("Top beam"));
    expect(line).toContain("1 m short");
    expect(line).toContain("6 - 2 = 4");
  });

  it("drops the goat before the far bank when a bottom beam is 3 m", () => {
    const result = simulateCrossing({ ...correctLengths(), "bottom-a": 3 });
    expect(result.ok).toBe(false);
    expect(result.goatX).toBeLessThan(8);
    expect(result.goatY).toBeLessThan(0);
  });
});
