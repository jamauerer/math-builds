import { describe, expect, it } from "vitest";
import { setUnitSystem } from "../../../units";
import { answerEarn, blankEarn, earnAtWord, earnPrompt, speedLine, startPractice } from "./earn";
import { correctLengths, wreckLines } from "./kit";
import { simulateCrossing } from "./simulate";

describe("goat bridge kit", () => {
  it("asks five plain dividing questions, then one word problem, for the bottom beam", () => {
    const levels = { dividing: 5 };
    let state = blankEarn(levels, 3);
    const prompts: string[] = [];
    for (let index = 0; index < 5; index += 1) {
      expect(state.phase).toBe("plain");
      expect(state.runGot).toBe(index);
      expect(state.current.groupId).toBe("bottom");
      expect(state.current.strandId).toBe("dividing");
      expect(state.current.fact.kind).toBe("plain");
      const prompt = earnPrompt(state.current);
      expect(prompt.toLowerCase()).not.toContain("level");
      expect(prompt.split(/[^0-9.]+/).filter((part) => part.length > 0)).not.toContain(state.current.answer.replace(/^-/, ""));
      prompts.push(prompt);
      const step = answerEarn(state, state.current.answer, levels, 1000);
      expect(step.marksDelta).toBe(1);
      state = step.state;
    }
    expect(new Set(prompts).size).toBe(5);
    expect(state.phase).toBe("word");
    const word = earnPrompt(state.current);
    expect(word.toLowerCase()).not.toContain("level");
    expect(word.split(/[^0-9.]+/).filter((part) => part.length > 0)).not.toContain(state.current.answer);
    const earned = answerEarn(state, state.current.answer, levels);
    expect(earned.marksDelta).toBe(3);
    expect(earned.state.earned).toEqual(["bottom"]);
    expect(earned.state.phase).toBe("plain");
    expect(earned.state.runGot).toBe(0);
    const top = earnAtWord(levels, "top");
    expect(earnPrompt(top.current)).toBe("The posts stand at 2 and 6. How long is the top beam?");
    expect(top.current.answer).toBe("4");
    expect(speedLine(10_000, 22_000)).toBe("12 s faster than last time");
    expect(speedLine(22_000, 10_000)).toBeNull();
    expect(speedLine(8_000, null)).toBe("fastest run yet");
  });

  it("resumes the run at the same count after the explain and practice loop", () => {
    const levels = { dividing: 5, geometry: 4 };
    let state = blankEarn(levels, 2);
    state = answerEarn(state, state.current.answer, levels).state;
    expect(state.runGot).toBe(1);
    const missed = answerEarn(state, "nope", levels);
    expect(missed.state.phase).toBe("explain");
    expect(missed.state.runGot).toBe(1);
    expect(missed.marksDelta).toBe(0);
    let practice = startPractice(missed.state);
    expect(practice.practice).toHaveLength(3);
    for (let index = 0; index < 3; index += 1) {
      const answer = practice.practice[practice.practiceIndex]?.answer ?? "";
      practice = answerEarn(practice, answer, levels).state;
    }
    expect(practice.phase).toBe("plain");
    expect(practice.runGot).toBe(1);
    expect(practice.earned).toEqual([]);
    const brace = earnAtWord(levels, "braces");
    expect(`${earnPrompt(brace.current)}`).not.toContain("2.83");
    expect(brace.current.answer).not.toBe("2.83");
  });

  it("drops the strand after two failed practice rounds and stays on the same count", () => {
    const levels = { dividing: 4 };
    let state = blankEarn(levels, 1);
    state = answerEarn(state, "nope", levels).state;
    state = startPractice(state);
    state = answerEarn(state, "nope", levels).state;
    state = startPractice(state);
    const dropped = answerEarn(state, "nope", levels);
    expect(dropped.levels.dividing).toBe(3);
    expect(dropped.note).toContain("dividing");
    expect(dropped.state.earned).toEqual([]);
    expect(dropped.state.phase).toBe("plain");
    expect(dropped.state.runGot).toBe(0);
    expect(dropped.state.groupIndex).toBe(0);
    expect(dropped.state.current.level).toBe(3);
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
