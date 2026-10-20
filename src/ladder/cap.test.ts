import { describe, expect, it } from "vitest";
import { answerEarn, blankEarn, currentQuestion, startGuided } from "../machines/bridge/kits/earn";
import { queenPost } from "../machines/bridge/kits/kit";
import { beginLadderPlace, ladderPlaceAnswer, ladderPlaceAsk } from "./place";
import { serveQuestion } from "./serve";
import { LADDER_STEPS, legalSteps } from "./steps";

describe("grade cap", () => {
  it("grade 1: 2000 served questions stay inside A13/S11 and adding only", () => {
    const grade = 1;
    const served: { prompt: string; stepId?: string; strandId: string }[] = [];
    let place = beginLadderPlace(grade);
    while (!place.done && served.length < 12) {
      const question = ladderPlaceAsk(place, grade, served.length + 1);
      served.push(question);
      place = ladderPlaceAnswer(place, grade, served.length % 3 !== 0);
    }
    for (let round = 0; round < 5 && served.length < 2000; round += 1) {
      for (let i = 0; i < 15 && served.length < 2000; i += 1) {
        const seed = 100 + round * 40 + i;
        if (i === 3) {
          served.push(serveQuestion({ grade, skillId: "geometry.11.trig-ratios", seed, kind: "run" }));
        } else if (i === 7) {
          served.push(serveQuestion({ grade, skillId: "multiplying.4.m7", seed, kind: "practice" }));
        } else {
          const legal = legalSteps(grade);
          served.push(serveQuestion({ grade, step: legal[seed % legal.length], seed, kind: i === 14 ? "word" : "run" }));
        }
      }
    }
    let seed = 400;
    while (served.length < 2000) {
      const legal = legalSteps(grade);
      if (seed % 11 === 0) {
        served.push(serveQuestion({ grade, skillId: "algebra.13.trig-functions", seed, kind: "learn" }));
      } else {
        served.push(serveQuestion({ grade, step: legal[seed % legal.length], seed, kind: "warmup" }));
      }
      seed += 1;
    }
    expect(served).toHaveLength(2000);
    for (const question of served) {
      expect(question.strandId, question.prompt).toBe("adding");
      const step = LADDER_STEPS.find((item) => item.id === question.stepId);
      expect(step, question.prompt).toBeTruthy();
      if (step?.op === "A") {
        expect(step.n, question.stepId).toBeLessThanOrEqual(13);
      }
      if (step?.op === "S") {
        expect(step.n, question.stepId).toBeLessThanOrEqual(11);
      }
      expect(step?.op === "A" || step?.op === "S", question.stepId).toBe(true);
    }
  });

  it("grade 1 earn path never leaves adding A13/S11", () => {
    const grade = 1;
    const levels = { adding: 2, subtracting: 2, counting: 1, measuring: 1, multiplying: 1, dividing: 1, fractions: 1, ratios: 1, geometry: 1, algebra: 1 };
    const served: string[] = [];
    for (let round = 0; round < 5; round += 1) {
      let state = blankEarn(levels, 10 + round, null, "2026-10-20", Math.min(round, queenPost.rounds.length - 1), grade);
      for (let guard = 0; guard < 80 && served.length < 80; guard += 1) {
        if (state.phase === "done") {
          break;
        }
        if (state.phase === "learn") {
          served.push(state.current.stepId ?? state.current.skillId ?? "");
          state = startGuided(state, levels);
          continue;
        }
        const question = currentQuestion(state);
        if (!question) {
          break;
        }
        served.push(question.stepId ?? question.skillId ?? "");
        state = answerEarn(state, question.answer, levels).state;
      }
    }
    expect(served.length).toBeGreaterThan(20);
    for (const id of served) {
      const step = LADDER_STEPS.find((item) => item.id === id || item.skillId === id);
      expect(step, id).toBeTruthy();
      expect(step?.op === "A" || step?.op === "S", id).toBe(true);
      if (step?.op === "A") {
        expect(step.n).toBeLessThanOrEqual(13);
      }
      if (step?.op === "S") {
        expect(step.n).toBeLessThanOrEqual(11);
      }
    }
  });
});
