import { describe, expect, it, vi } from "vitest";
import { gradeStartLevel, KIT_STRANDS, runAdaptive } from "../../../engine/strand-placement";
import { answerEarn, blankEarn, currentQuestion, earnPrompt, freshKit, guardQuestion, openRun, startGuided, startPractice } from "./earn";
import { queenPost } from "./kit";
import { plainQuestion } from "./plain";
import { skillsFromLevels } from "./skills";

describe("level guard", () => {
  it("serves a grade 3 profile a hundred questions inside the rule", () => {
    const placed = runAdaptive({
      startLevel: gradeStartLevel(3),
      correct: (level) => level <= 4,
    }).levels;
    for (const id of KIT_STRANDS) {
      expect(placed[id]).toBeGreaterThanOrEqual(3);
      expect(placed[id]).toBeLessThanOrEqual(5);
    }
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    let state = blankEarn(placed, 1);
    const served: { strandId: string; level: number; phase: string; piece: string; prompt: string }[] = [];
    for (let guard = 0; served.length < 100 && guard < 160; guard += 1) {
      if (state.phase === "done") {
        const nextRound = state.round + 1;
        state =
          nextRound < queenPost.rounds.length
            ? blankEarn(placed, state.seed + 1, state.book, state.day, nextRound)
            : freshKit(placed, state.book);
        continue;
      }
      if (state.phase === "learn") {
        const question = state.current;
        served.push({ strandId: question.strandId, level: question.level, phase: "learn", piece: queenPost.groups[state.groupIndex]?.strand ?? "", prompt: earnPrompt(question) });
        state = startGuided(state, placed);
        continue;
      }
      const question = currentQuestion(state);
      if (!question) {
        break;
      }
      served.push({ strandId: question.strandId, level: question.level, phase: state.phase, piece: queenPost.groups[state.groupIndex]?.strand ?? "", prompt: earnPrompt(question) });
      state = answerEarn(state, question.answer, placed).state;
    }
    expect(served.length).toBeGreaterThanOrEqual(100);
    for (const question of served.slice(0, 100)) {
      const learner = question.strandId === "subtracting" ? (placed.adding ?? 1) : (placed[question.strandId] ?? 1);
      expect(question.level).toBeLessThanOrEqual(learner + 1);
      if (question.phase === "warmup") {
        expect(question.level).toBeLessThanOrEqual(learner + 1);
      } else if (question.phase !== "word") {
        const sameFamily = question.piece === "adding" && question.strandId === "subtracting";
        expect(question.strandId === question.piece || sameFamily).toBe(true);
      }
      expect(question.prompt.toLowerCase()).not.toContain("legs 4 and 5");
    }
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });

  it("keeps practice on the missed skill, already at the learner's level", () => {
    const levels = Object.fromEntries(KIT_STRANDS.map((id) => [id, 4]));
    let state = openRun(levels, "bottom", 2);
    const missed = state.current;
    state = answerEarn(state, "nope", levels).state;
    const practice = startPractice(state, levels);
    expect(practice.phase).toBe("practice");
    for (const question of practice.practice) {
      expect(question.skillId).toBe(missed.skillId);
      expect(question.strandId).toBe("dividing");
      expect(question.level).toBeLessThanOrEqual(5);
    }
  });

  it("replaces a Pythagoras question on a dividing piece", () => {
    const levels = Object.fromEntries(KIT_STRANDS.map((id) => [id, 4]));
    const book = skillsFromLevels(levels);
    const item = plainQuestion("geometry", 11, 4);
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const served = guardQuestion(
      {
        groupId: "bottom",
        strandId: "geometry",
        level: 11,
        answer: item.answer,
        skillId: "geometry-11-1",
        fact: { kind: "plain", prompt: item.prompt, steps: item.steps, why: item.why, draw: item.draw },
      },
      { pieceStrand: "dividing", allowed: ["dividing"], levels, book, groupId: "bottom" },
      3,
      false,
    );
    expect(served.strandId).toBe("dividing");
    expect(served.level).toBeLessThanOrEqual(5);
    expect(earnPrompt(served).toLowerCase()).not.toContain("hypotenuse");
    expect(errors).toHaveBeenCalled();
    errors.mockRestore();
  });
});
