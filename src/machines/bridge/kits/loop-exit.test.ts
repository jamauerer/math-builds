import { describe, expect, it } from "vitest";
import { skills } from "../../../data/load-skills";
import { KIT_STRANDS } from "../../../engine/strand-placement";
import { sanitizeProgress } from "../../../storage/progress";
import { acceptsAnswer, answerEarn, easierPiece, explainHold, explainQuestion, numberSignature, openRun, startPractice } from "./earn";
import { plainQuestion } from "./plain";
import { KIT_SKILLS } from "./skills";

const levels = Object.fromEntries(KIT_STRANDS.map((id) => [id, 4]));

describe("loop exit", () => {
  it("pulls a stored strand down to the arithmetic band once", () => {
    const loaded = sanitizeProgress(skills, {
      kitProfile: {
        grade: 6,
        levels: { adding: 4, multiplying: 4, dividing: 4, geometry: 12 },
        history: [],
        notes: [],
      },
    });
    expect(loaded.kitProfile?.levels.geometry).toBe(5);
    expect(loaded.kitProfile?.notes.join(" ")).toContain("Geometry pulled down to level 5");
    const again = sanitizeProgress(skills, { kitProfile: loaded.kitProfile });
    expect(again.kitProfile?.levels.geometry).toBe(5);
    expect(again.kitProfile?.notes).toEqual(loaded.kitProfile?.notes);
  });

  it("explains every skill with the missed numbers and at least three steps", () => {
    for (const skill of KIT_SKILLS) {
      const item = plainQuestion(skill.strandId, skill.level, skill.level * 17 + skill.name.length);
      const explained = explainQuestion({
        groupId: "deck",
        strandId: skill.strandId,
        level: skill.level,
        answer: item.answer,
        truth: item.truth,
        skillId: skill.id,
        fact: { kind: "plain", prompt: item.prompt, steps: item.steps, why: item.why, draw: item.draw },
      });
      expect(explained.steps.length).toBeGreaterThanOrEqual(3);
      const body = explained.steps.map((step) => step.text).join(" ");
      for (const number of item.prompt.match(/\d+(\.\d+)?/g) ?? []) {
        expect(body, skill.id).toContain(number);
      }
      for (let index = 1; index < explained.steps.length; index += 1) {
        expect(explained.steps[index].picture).not.toBe(explained.steps[index - 1].picture);
      }
    }
    const pythagoras = explainHold("geometry", 9, 1);
    const worked = explainQuestion(pythagoras.current);
    expect(worked.steps.map((step) => step.text).join(" ")).toContain("9 + 16 = 25");
    expect(worked.steps.map((step) => step.text).join(" ")).toContain("5 x 5");
    expect(worked.steps.some((step) => step.picture === "squares" && step.a === 9 && step.b === 16)).toBe(true);
  });

  it("drops the strand after two failed rounds and asks an easier question", () => {
    const start = openRun({ dividing: 4 }, "bottom", 1);
    const missed = answerEarn(start, "nope", { dividing: 4 });
    const once = answerEarn(startPractice(missed.state), "nope", { dividing: 4 });
    expect(once.state.phase).toBe("explain");
    expect(once.state.roundsFailed).toBe(1);
    const dropped = answerEarn(startPractice(once.state), "nope", { dividing: 4 });
    expect(dropped.levels.dividing).toBe(3);
    expect(dropped.note).toContain("dividing dropped to level 3");
    expect(dropped.state.current.level).toBe(3);
    expect(dropped.state.current.level).toBeLessThan(start.current.level);
    expect(dropped.state.upcoming.every((question) => question.level === 3)).toBe(true);
    const skillId = start.current.skillId ?? "";
    expect(dropped.state.book.skills[skillId]?.struggling).toBe(true);
    const fact = dropped.state.current.fact;
    if (fact.kind === "plain" && fact.draw && fact.draw.op === "div") {
      expect(fact.draw.b).toBeLessThanOrEqual(5);
    }
  });

  it("earns the rest of the piece one level down when the learner asks for an easier one", () => {
    const held = explainHold("geometry", 9, 1);
    const next = easierPiece(held, Object.fromEntries(KIT_STRANDS.map((id) => [id, 9])));
    expect(next.state.phase).not.toBe("explain");
    expect(next.state.current.level).toBe(8);
    expect(next.levels.geometry).toBe(8);
    expect(next.note).toContain("struggling");
    expect(next.state.book.skills[held.current.skillId ?? ""]?.struggling).toBe(true);
    expect(next.state.current.level).toBeLessThan(held.current.level);
  });

  it("accepts 2.8 and 2.83 for 2.828 and rounds the shown answer", () => {
    const item = plainQuestion("geometry", 10, 1);
    expect(item.why.toLowerCase()).toContain("round to one decimal");
    expect(item.prompt.toLowerCase()).not.toContain("round");
    expect(item.answer).toBe((Math.round((item.truth ?? 0) * 10) / 10).toFixed(1));
    expect(acceptsAnswer("2.8", "2.8", 2.828)).toBe(true);
    expect(acceptsAnswer("2.83", "2.8", 2.828)).toBe(true);
    expect(acceptsAnswer("2.9", "2.8", 2.828)).toBe(false);
    expect(acceptsAnswer(item.answer, item.answer, item.truth)).toBe(true);
    const hundredths = (Math.round((item.truth ?? 0) * 100) / 100).toFixed(2);
    expect(acceptsAnswer(hundredths, item.answer, item.truth)).toBe(true);
    for (const strand of KIT_STRANDS) {
      for (let level = 1; level <= 13; level += 1) {
        const question = plainQuestion(strand, level, 3);
        if (question.answer.includes(".")) {
          expect(question.why.toLowerCase()).toContain("round to one decimal");
          expect(question.prompt.toLowerCase()).not.toContain("round");
        }
      }
    }
  });

  it("gives practice questions different numbers from the miss and from each other", () => {
    let state = openRun(levels, "bottom", 4);
    state = answerEarn(state, "nope", levels).state;
    const missed = numberSignature(state.current);
    const practice = startPractice(state);
    const signs = practice.practice.map((question) => numberSignature(question));
    expect(signs).toHaveLength(3);
    expect(new Set(signs).size).toBe(3);
    expect(signs).not.toContain(missed);
  });
});
