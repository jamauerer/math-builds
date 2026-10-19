import { describe, expect, it } from "vitest";
import { skills } from "../../../data/load-skills";
import { KIT_STRANDS } from "../../../engine/strand-placement";
import { sanitizeProgress } from "../../../storage/progress";
import { answerEarn, freshKit, kitQuestionTotal, openRun, roundEndHold } from "./earn";
import { queenPost } from "./kit";

const levels = Object.fromEntries(KIT_STRANDS.map((id) => [id, 4]));

describe("feedback 6", () => {
  it("ends round 1 on its last piece and keeps the bar inside the round", () => {
    const fresh = freshKit(levels, null);
    expect(fresh.round).toBe(0);
    expect(fresh.earned).toEqual([]);
    expect(fresh.steps).toBe(0);
    expect(fresh.steps).toBeLessThanOrEqual(kitQuestionTotal(fresh.round, fresh.short));
    const end = roundEndHold(levels, 0);
    expect(end.current.groupId).toBe("gussets");
    expect(end.steps).toBe(kitQuestionTotal(0, end.short) - 1);
    const done = answerEarn(end, end.current.answer, levels);
    expect(done.state.phase).toBe("done");
    expect(done.state.earned.slice().sort()).toEqual(["bottom", "gussets"]);
    expect(done.state.steps).toBeLessThanOrEqual(kitQuestionTotal(0, done.state.short));
    expect(done.state.round).toBe(0);
  });

  it("asks geometry at the clamped level when a stored profile is ahead of multiplying", () => {
    const loaded = sanitizeProgress(skills, {
      kitProfile: {
        grade: 6,
        levels: { geometry: 9, multiplying: 4 },
        history: [],
        notes: [],
        kitVersion: queenPost.version,
      },
    });
    expect(loaded.kitProfile?.levels.geometry).toBeLessThanOrEqual(5);
    expect(loaded.kitProfile?.notes.join(" ")).toContain("Geometry pulled down to level");
    const run = openRun(loaded.kitProfile?.levels ?? {}, "braces", 2);
    const geometry = [run.current, ...run.upcoming].find((question) => question.strandId === "geometry");
    expect(geometry).toBeTruthy();
    expect(geometry?.level).toBeLessThanOrEqual(5);
  });
});
