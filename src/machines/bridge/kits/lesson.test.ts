import { describe, expect, it } from "vitest";
import { answerEarn, blankEarn, currentQuestion, earnPrompt, openRun, startGuided } from "./earn";
import { queenPost } from "./kit";
import { pieceQuestion } from "./pieces";
import { currentSkill, KIT_SKILLS, longestStrandRun, noteSession, skillsFromLevels, withState } from "./skills";
import { KIT_STRANDS } from "../../../engine/strand-placement";

const levels = {
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

describe("lesson structure", () => {
  it("shows Learn before the run only when the piece has a new skill", () => {
    let fresh = blankEarn(levels, 2);
    for (let index = 0; index < 3; index += 1) {
      expect(fresh.phase).toBe("warmup");
      fresh = answerEarn(fresh, fresh.current.answer, levels).state;
    }
    expect(fresh.phase).toBe("learn");
    expect(fresh.earned).toEqual([]);
    const guided = startGuided(fresh);
    expect(guided.phase).toBe("guided");
    expect(guided.book.skills[fresh.current.skillId ?? ""].state).toBe("learning");
    expect(earnPrompt(guided.current).toLowerCase()).not.toContain("level");

    let book = skillsFromLevels(levels);
    for (const skill of KIT_SKILLS.filter((item) => item.strandId === "dividing" && item.level === 4)) {
      book = withState(book, skill.id, "practicing");
    }
    let settled = blankEarn(levels, 2, book);
    for (let index = 0; index < 3; index += 1) {
      settled = answerEarn(settled, settled.current.answer, levels).state;
    }
    expect(settled.phase).toBe("plain");
  });

  it("never asks five questions from the same strand in a row", () => {
    let state = openRun(levels, "braces", 5);
    const strands: string[] = [];
    while (state.phase === "plain") {
      strands.push(state.current.strandId);
      state = answerEarn(state, state.current.answer, levels).state;
    }
    expect(strands.length).toBe(5);
    expect(longestStrandRun(strands)).toBeLessThan(5);
  });

  it("puts a skill missed on the word problem into the next warm-up", () => {
    let state = openRun(levels, "bottom", 4);
    while (state.phase === "plain") {
      state = answerEarn(state, state.current.answer, levels).state;
    }
    expect(state.phase).toBe("word");
    const skillId = state.current.skillId ?? "";
    const missed = answerEarn(state, "nope", levels);
    expect(missed.state.book.skills[skillId].warmUp).toBe(true);
    const next = blankEarn(levels, 8, missed.state.book);
    expect(next.phase).toBe("warmup");
    expect(next.current.skillId).toBe(skillId);
  });

  it("keeps going after three pieces instead of ending the lesson", () => {
    let state = openRun(levels, "bottom", 2);
    state = {
      ...state,
      book: { ...state.book, introduced: "already" },
    };
    while (state.phase === "plain") {
      state = answerEarn(state, state.current.answer, levels).state;
    }
    const next = answerEarn(state, state.current.answer, levels).state;
    expect(next.earned).toEqual(["bottom"]);
    expect(next.phase).not.toBe("done");
    expect(currentQuestion(next)?.answer).toBeTruthy();
  });

  it("shows the Learn card before the first Pythagoras question", () => {
    const high = Object.fromEntries(KIT_STRANDS.map((id) => [id, 9]));
    let state = blankEarn(high, 1, null, "2026-10-19", 1);
    state = { ...state, earned: ["posts", "top"], round: 1 };
    for (let index = 0; index < 3; index += 1) {
      expect(state.phase).toBe("warmup");
      state = answerEarn(state, state.current.answer, high).state;
    }
    expect(state.phase).toBe("learn");
    expect(state.current.strandId).toBe("geometry");
    expect(state.current.level).toBe(9);
    expect(earnPrompt(state.current).toLowerCase()).toContain("hypotenuse");
    expect(state.current.answer).not.toContain(".");
    expect(state.book.skills[state.current.skillId ?? ""].state).toBe("new");
    expect(KIT_SKILLS.find((skill) => skill.id === state.current.skillId)?.name).toBe("Pythagoras");
  });

  it("has a whole-number question for every piece at every level", () => {
    for (const group of queenPost.groups) {
      for (let level = 1; level <= 13; level += 1) {
        const question = pieceQuestion(group.id, level);
        expect(question.prompt.length).toBeGreaterThan(0);
        expect(question.answer.length).toBeGreaterThan(0);
        if (level <= 4) {
          expect(question.answer).not.toContain(".");
          expect(question.prompt.toLowerCase()).not.toContain("square root");
        }
      }
    }
    expect(pieceQuestion("braces", 3).prompt.toLowerCase()).toContain("longest");
    expect(pieceQuestion("braces", 4).prompt.toLowerCase()).toContain("triangles");
    expect(pieceQuestion("braces", 6).prompt).toContain("across");
    expect(pieceQuestion("braces", 6).prompt).toContain("up");
    expect(pieceQuestion("braces", 9).prompt.toLowerCase()).toContain("triangle");
    expect(pieceQuestion("braces", 9).answer).toBe("5");
  });

  it("keeps a level 4 run off decimals and square roots", () => {
    for (const group of queenPost.groups) {
      let state = openRun(levels, group.id, 3);
      for (let index = 0; index < 8 && state.phase !== "done"; index += 1) {
        const question = currentQuestion(state);
        expect(question?.answer ?? "").not.toContain(".");
        expect(earnPrompt(question ?? state.current).toLowerCase()).not.toContain("square root");
        state = answerEarn(state, state.current.answer, levels).state;
      }
    }
  });

  it("masters a skill only across three different days", () => {
    const skill = currentSkill(skillsFromLevels(levels), "dividing", 4);
    let book = withState(skillsFromLevels(levels), skill.id, "learning");
    book = noteSession(book, skill.id, "2026-10-01", 4, 5);
    book = noteSession(book, skill.id, "2026-10-01", 4, 5);
    book = noteSession(book, skill.id, "2026-10-01", 4, 5);
    expect(book.skills[skill.id].state).not.toBe("mastered");
    book = noteSession(book, skill.id, "2026-10-02", 4, 5);
    expect(book.skills[skill.id].state).not.toBe("mastered");
    book = noteSession(book, skill.id, "2026-10-03", 5, 5);
    expect(book.skills[skill.id].state).toBe("mastered");
  });
});
