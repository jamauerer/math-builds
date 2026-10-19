import { describe, expect, it } from "vitest";
import { setUnitSystem, lengthAbbrev } from "../../../units";
import { answerEarn, blankEarn, earnAtWord, earnHint, earnPrompt, kitQuestionTotal, openRun, roundQuestionTotal, roundsAreShort, runLength, speedLine, startGuided, startPractice } from "./earn";
import { queenPost, correctLengths, wreckLines } from "./kit";
import { KIT_SKILLS, skillsFromLevels, withState } from "./skills";
import { goatSprite } from "../kit/scene";
import { simulateCrossing } from "./simulate";

const roundLevels = {
  counting: 4,
  measuring: 4,
  adding: 4,
  multiplying: 4,
  dividing: 4,
  fractions: 4,
  ratios: 4,
  geometry: 4,
  algebra: 4,
};

function finishRound(round = 0) {
  let state = blankEarn(roundLevels, 1, null, "2026-10-19", round);
  for (let guard = 0; state.phase !== "done" && guard < 40; guard += 1) {
    if (state.phase === "learn") {
      state = startGuided(state);
      continue;
    }
    state = answerEarn(state, state.current.answer, roundLevels).state;
  }
  return state;
}

describe("goat bridge kit", () => {
  it("asks five plain dividing questions, then one word problem, for the bottom beam", () => {
    const levels = { dividing: 5 };
    let state = openRun(levels, "bottom", 3);
    const strands: string[] = [];
    const prompts: string[] = [];
    for (let index = 0; index < 5; index += 1) {
      expect(state.phase).toBe("plain");
      expect(state.runGot).toBe(index);
      expect(state.current.groupId).toBe("bottom");
      expect(state.current.fact.kind).toBe("plain");
      const prompt = earnPrompt(state.current);
      expect(prompt.toLowerCase()).not.toContain("level");
      expect(prompt.split(/[^0-9.]+/).filter((part) => part.length > 0)).not.toContain(state.current.answer.replace(/^-/, ""));
      prompts.push(prompt);
      strands.push(state.current.strandId);
      const step = answerEarn(state, state.current.answer, levels, 1000);
      expect(step.marksDelta).toBe(1);
      state = step.state;
    }
    expect(strands).toContain("dividing");
    expect(new Set(prompts).size).toBe(5);
    expect(state.phase).toBe("word");
    const word = earnPrompt(state.current);
    expect(word.toLowerCase()).not.toContain("level");
    expect(word.split(/[^0-9.]+/).filter((part) => part.length > 0)).not.toContain(state.current.answer);
    const earned = answerEarn(state, state.current.answer, levels);
    expect(earned.marksDelta).toBe(3);
    expect(earned.state.earned).toContain("bottom");
    expect(earned.state.phase).not.toBe("done");
    expect(["learn", "plain"]).toContain(earned.state.phase);
    const top = earnAtWord(levels, "top");
    setUnitSystem("us");
    expect(earnPrompt(top.current)).toContain("2 ft");
    expect(earnPrompt(top.current)).toContain("6 ft");
    expect(top.current.answer).toBe("4");
    expect(speedLine(10_000, 22_000)).toBe("12 s faster than last time");
    expect(speedLine(22_000, 10_000)).toBeNull();
    expect(speedLine(8_000, null)).toBe("fastest run yet");
  });

  it("steps the kit bar after one right answer and puts a unit in every word problem", () => {
    setUnitSystem("us");
    const levels = { dividing: 4 };
    const start = blankEarn(levels, 1);
    const next = answerEarn(start, start.current.answer, levels);
    expect(next.state.steps).toBe(start.steps + 1);
    expect((next.state.steps / kitQuestionTotal()) * 100).toBeGreaterThan((start.steps / kitQuestionTotal()) * 100);
    for (const group of queenPost.groups) {
      const word = earnAtWord(levels, group.id);
      const prompt = earnPrompt(word.current);
      expect(prompt).toContain(lengthAbbrev());
      const token = word.current.answer.replace(/^-/, "");
      expect(prompt.split(/[^0-9.]+/).filter((part) => part.length > 0)).not.toContain(token);
      expect(earnHint(word.current).split(/[^0-9.]+/).filter((part) => part.length > 0)).not.toContain(token);
    }
  });

  it("resumes the run at the same count after the explain and practice loop", () => {
    const levels = { dividing: 5, geometry: 4 };
    let state = openRun(levels, "bottom", 2);
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
    let state = openRun(levels, "bottom", 1);
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
    expect(result.frames.some((frame) => frame.goatY < 0)).toBe(true);
    expect(result.frames.at(-1)?.mode).toBe("glare");
    expect(result.bodies.some((body) => body.id.includes("beam") || body.id === "top" || body.id.startsWith("bottom"))).toBe(true);
    expect(result.bodies.some((body) => (body.id === "top" || body.id.startsWith("bottom")) && body.y < 0)).toBe(true);
    setUnitSystem("metric");
    const line = wreckLines(lengths).find((item) => item.startsWith("Top beam"));
    expect(line).toContain("1 m short");
    expect(line).toContain("6 - 2 = 4");
    setUnitSystem("us");
    expect(wreckLines(lengths).find((item) => item.startsWith("Top beam"))).toContain("1 ft short");
  });

  it("drops the goat at the first plank slot when the deck has no planks", () => {
    const lengths = correctLengths();
    for (const slot of queenPost.slots) {
      if (slot.kind === "plank") {
        delete lengths[slot.id];
      }
    }
    const result = simulateCrossing(lengths);
    expect(result.ok).toBe(false);
    expect(result.frames.some((frame) => frame.goatY < 0 && frame.goatX < 1)).toBe(true);
    expect(result.goatX).toBeLessThan(1);
    expect(result.frames.at(-1)?.mode).toBe("glare");
  });

  it("drops the goat before the far bank when a bottom beam is 3 m", () => {
    const result = simulateCrossing({ ...correctLengths(), "bottom-a": 3 });
    expect(result.ok).toBe(false);
    expect(result.goatX).toBeLessThan(8);
    expect(result.frames.some((frame) => frame.goatY < 0)).toBe(true);
    expect(result.frames.at(-1)?.mode).toBe("glare");
  });

  it("renders a slip, then a swim, then a glare on a wreck run", () => {
    const result = simulateCrossing({ ...correctLengths(), top: 3 });
    const sources = result.frames.map((frame) => goatSprite(frame.mode, frame.walkFrame).src);
    const slip = sources.findIndex((src) => src.includes("goat-slip"));
    const swim = sources.findIndex((src) => src.includes("goat-swim"));
    const glare = sources.findIndex((src) => src.includes("goat-glare"));
    expect(slip).toBeGreaterThanOrEqual(0);
    expect(swim).toBeGreaterThan(slip);
    expect(glare).toBeGreaterThan(swim);
  });

  it("earns one round at a time, resets the bar, and tests the build that round can make", () => {
    expect(roundQuestionTotal(0)).toBeGreaterThanOrEqual(12);
    expect(roundQuestionTotal(0)).toBeLessThanOrEqual(15);
    expect(roundQuestionTotal(1)).toBeGreaterThanOrEqual(12);
    expect(roundQuestionTotal(1)).toBeLessThanOrEqual(15);
    expect(roundQuestionTotal(2)).toBeGreaterThanOrEqual(12);
    expect(roundQuestionTotal(2)).toBeLessThanOrEqual(15);
    expect(runLength("braces")).toBe(5);
    const done = finishRound(0);
    expect(done.phase).toBe("done");
    expect(done.earned.slice().sort()).toEqual(["bottom", "gussets"]);
    expect(done.steps).toBeGreaterThan(0);
    const next = blankEarn(roundLevels, 4, done.book, done.day, 1);
    expect(next.round).toBe(1);
    expect(next.steps).toBe(0);
    expect((next.steps / kitQuestionTotal(next.round)) * 100).toBe(0);
    const folded = simulateCrossing({ "bottom-a": 4, "bottom-b": 4 });
    expect(folded.ok).toBe(false);
    expect(folded.frames.some((frame) => frame.goatY < 0)).toBe(true);
    const crossed = simulateCrossing(correctLengths());
    expect(crossed.ok).toBe(true);
    expect(crossed.goatX).toBeGreaterThanOrEqual(8);
  });

  it("asks 3 questions a piece when every strand is mastered at the kit level", () => {
    let book = skillsFromLevels(roundLevels);
    for (const skill of KIT_SKILLS) {
      if (roundLevels[skill.strandId as keyof typeof roundLevels] === skill.level) {
        book = withState(book, skill.id, "mastered");
      }
    }
    expect(roundsAreShort(book, roundLevels)).toBe(true);
    const state = blankEarn(roundLevels, 1, book);
    expect(state.short).toBe(true);
    expect(runLength("bottom", true)).toBe(3);
    expect(runLength("braces", true)).toBe(3);
    expect(roundQuestionTotal(0, true)).toBeLessThan(roundQuestionTotal(0));
  });
});
