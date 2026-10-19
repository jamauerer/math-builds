import { describe, expect, it } from "vitest";
import { setUnitSystem } from "../../../units";
import { answerEarn, blankEarn, earnHint, earnPrompt, startPractice } from "./earn";
import { correctLengths, wreckLines } from "./kit";
import { simulateCrossing } from "./simulate";

describe("goat bridge kit", () => {
  it("explains a miss, then earns the piece only after 3 practice answers in a row", () => {
    const levels = { dividing: 1, measuring: 1, adding: 1, geometry: 1, counting: 1, multiplying: 1 };
    const state0 = blankEarn(levels, 3);
    const missed = answerEarn(state0, "nope", levels);
    expect(missed.correct).toBe(false);
    expect(missed.state.phase).toBe("explain");
    expect(missed.state.earned).toEqual([]);
    expect(missed.state.index).toBe(0);
    const practice = startPractice(missed.state);
    expect(practice.phase).toBe("practice");
    expect(practice.practice).toHaveLength(3);
    const restarted = answerEarn(practice, "nope", levels);
    expect(restarted.state.phase).toBe("explain");
    expect(restarted.state.roundsFailed).toBe(1);
    expect(restarted.state.earned).toEqual([]);
    let round = startPractice(restarted.state);
    for (let index = 0; index < 3; index += 1) {
      const answer = round.practice[round.practiceIndex]?.answer ?? "";
      const step = answerEarn(round, answer, levels);
      round = step.state;
    }
    expect(round.earned).toEqual(["bottom"]);
    expect(round.phase).toBe("ask");
    expect(round.index).toBe(1);
  });

  it("drops the strand after two failed practice rounds and never asks the brace length below level 9", () => {
    const levels = { dividing: 4, measuring: 4, adding: 4, geometry: 4, counting: 4, multiplying: 4 };
    let state = blankEarn(levels, 1);
    const brace = state.queue.find((item) => item.groupId === "braces");
    expect(brace?.fact.kind).not.toBe("brace-hyp");
    expect(`${earnPrompt(brace!)} ${earnHint(brace!)}`).not.toContain("2.83");
    expect(earnHint(brace!)).not.toContain(brace?.answer ?? "missing");
    state = answerEarn(state, "nope", levels).state;
    state = startPractice(state);
    state = answerEarn(state, "nope", levels).state;
    state = startPractice(state);
    const dropped = answerEarn(state, "nope", levels);
    expect(dropped.levels.dividing).toBe(3);
    expect(dropped.note).toContain("dividing");
    expect(dropped.state.earned).toEqual([]);
    expect(dropped.state.index).toBe(1);
    const high = blankEarn({ ...levels, geometry: 9 }, 1).queue.find((item) => item.groupId === "braces");
    expect(high?.fact.kind).toBe("brace-hyp");
    expect(earnHint(high!)).not.toContain(high?.answer ?? "");
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
    setUnitSystem("metric");
    const line = wreckLines(lengths).find((item) => item.startsWith("Top beam"));
    expect(line).toContain("1 m short");
    expect(line).toContain("6 - 2 = 4");
    setUnitSystem("us");
    expect(wreckLines(lengths).find((item) => item.startsWith("Top beam"))).toContain("1 ft short");
  });

  it("drops the goat before the far bank when a bottom beam is 3 m", () => {
    const result = simulateCrossing({ ...correctLengths(), "bottom-a": 3 });
    expect(result.ok).toBe(false);
    expect(result.goatX).toBeLessThan(8);
    expect(result.goatY).toBeLessThan(0);
  });
});
