import { describe, expect, it, vi } from "vitest";
import { skills, strands } from "../data/load-skills";
import {
  CEILING_MESSAGE,
  continueQuiz,
  createLearnerMap,
  createQuizSession,
  gradeAnswer,
  inferImpliedLevels,
  labelForLevel,
  placementMinutes,
  practiceLevel,
  questionsRemaining,
  recordLevelPass,
  restoreQuiz,
  runPlacement,
  skipQuestion,
  snapshotQuiz,
  strandIsMastered,
  type LearnerMap,
} from "./placement";
import type { Skill } from "./types";

const BORROW_IDS = [
  "subtract-borrow-two-digit",
  "subtract-borrow-three-digit",
  "subtract-across-zeros",
];

const MULTIPLY_IDS = skills.filter((skill) => skill.strand === "multiplication").map((skill) => skill.id);
const PLACE_IDS = skills.filter((skill) => skill.strand === "place-value").map((skill) => skill.id);

function levels(map: LearnerMap, ids: string[]): number[] {
  return ids.map((id) => map[id].level);
}

function learnerMixed(skill: Skill): boolean {
  if (BORROW_IDS.includes(skill.id)) {
    return false;
  }
  return true;
}

function learnerReverse(skill: Skill): boolean {
  return skill.strand !== "multiplication";
}

function place(respond: (skill: Skill) => boolean, seed: number) {
  return runPlacement({
    skills,
    strands,
    seed,
    respond: (skill) => respond(skill),
  });
}

function play(respond: (skill: Skill) => boolean, seed: number, pauseAfter: number | null) {
  let session = createQuizSession({ skills, strands, seed });
  const questions: { skillId: string; level: number; prompt: string }[] = [];
  let restored = false;
  for (let guard = 0; session.phase !== "done" && guard < 200; guard += 1) {
    if (pauseAfter != null && questions.length === pauseAfter && !restored) {
      session = restoreQuiz(snapshotQuiz(session), skills, strands);
      restored = true;
    }
    const skill = skills.find((item) => item.id === session.skillId);
    if (!skill || !session.problem) {
      break;
    }
    const correct = respond(skill);
    questions.push({ skillId: skill.id, level: session.level, prompt: session.problem.prompt });
    const given = correct ? session.problem.answer : "nope";
    session = continueQuiz(gradeAnswer(session, given));
  }
  return { session, questions };
}

describe("level labels", () => {
  it("keeps not checked yet separate from a checked level of 0", () => {
    expect(labelForLevel(0)).toBe("not-started");
    expect(labelForLevel(1)).toBe("learning");
    expect(labelForLevel(2)).toBe("learning");
    expect(labelForLevel(3)).toBe("solid");
    expect(labelForLevel(4)).toBe("solid");
    expect(labelForLevel(5)).toBe("mastered");
    const fresh = createLearnerMap(skills);
    expect(fresh["tens-and-ones"]).toEqual({ level: 0, state: "unchecked" });
    let map = recordLevelPass(fresh, "tens-and-ones", 3);
    expect(map["tens-and-ones"]).toEqual({ level: 3, state: "solid" });
    map = recordLevelPass(map, "tens-and-ones", 1);
    expect(map["tens-and-ones"].level).toBe(3);
    expect(practiceLevel(map["tens-and-ones"])).toBe(4);
    expect(practiceLevel(fresh["hundreds"])).toBe(1);
    expect(CEILING_MESSAGE).toBe("You have finished all current skills in this strand");
    expect(placementMinutes(strands.length, skills.length)).toBe(10);
  });
});

describe("implied levels", () => {
  it("copies a level 4 or 5 pass onto unchecked prerequisites", () => {
    const map = inferImpliedLevels(createLearnerMap(skills), skills, "round-to-ten", 5);
    expect(map["round-to-ten"]).toEqual({ level: 5, state: "mastered" });
    expect(map["compare-numbers"].level).toBe(5);
    expect(map["hundreds"].level).toBe(5);
    expect(map["tens-and-ones"].level).toBe(5);
    expect(map["thousands-place"].state).toBe("unchecked");
  });

  it("marks dependents at level 0 when level 1 is failed", () => {
    const map = inferImpliedLevels(createLearnerMap(skills), skills, "multiply-facts-2-to-5", 0);
    expect(map["multiply-facts-2-to-5"]).toEqual({ level: 0, state: "not-started" });
    for (const id of MULTIPLY_IDS.slice(1)) {
      expect(map[id]).toEqual({ level: 0, state: "not-started" });
    }
    expect(map["tens-and-ones"].state).toBe("unchecked");
  });
});

describe("quiz session", () => {
  it("starts at level 3, jumps up after a correct answer, and drops after a skip", () => {
    let session = createQuizSession({ skills, strands, seed: 5 });
    expect(session.skillId).toBe("tens-and-ones");
    expect(session.level).toBe(3);
    expect(questionsRemaining(skills, session.map, session.probe)).toBe(skills.length * 3);
    const formatted = (session.problem?.answer ?? "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    session = continueQuiz(gradeAnswer(session, ` ${formatted} `));
    expect(session.history[0]?.verdict).toBe("right");
    expect(session.history[0]?.prompt).toBeTruthy();
    expect(session.skillId).toBe("tens-and-ones");
    expect(session.level).toBe(4);

    let skipped = createQuizSession({ skills, strands, seed: 6 });
    skipped = skipQuestion(skipped);
    expect(skipped.phase).toBe("answering");
    expect(skipped.level).toBe(2);
    skipped = skipQuestion(skipped);
    expect(skipped.level).toBe(1);
    skipped = skipQuestion(skipped);
    expect(skipped.map["tens-and-ones"]).toEqual({ level: 0, state: "not-started" });
    expect(skipped.map["hundreds"]).toEqual({ level: 0, state: "not-started" });
    expect(skipped.skillId).toBe("add-two-digit-no-regroup");
  });
});

describe("simulated placement", () => {
  const mixed = place(learnerMixed, 11);
  const reverse = place(learnerReverse, 22);
  const weak = place(() => false, 33);
  const strong = place(() => true, 44);

  it("gives a multiplication-strong learner a different map from a borrowing-strong learner", () => {
    expect(levels(mixed.map, MULTIPLY_IDS)).toEqual(MULTIPLY_IDS.map(() => 5));
    expect(levels(mixed.map, BORROW_IDS)).toEqual(BORROW_IDS.map(() => 0));
    expect(mixed.map["add-two-digit-no-regroup"].level).toBe(5);
    expect(mixed.map["subtract-no-borrow-two-digit"].level).toBe(5);
    expect(levels(mixed.map, PLACE_IDS)).toEqual(PLACE_IDS.map(() => 5));

    expect(levels(reverse.map, BORROW_IDS)).toEqual(BORROW_IDS.map(() => 5));
    expect(reverse.map["multiply-facts-2-to-5"].level).toBe(0);
    expect(levels(reverse.map, MULTIPLY_IDS.slice(1))).toEqual(MULTIPLY_IDS.slice(1).map(() => 0));
    expect(mixed.map).not.toEqual(reverse.map);
  });

  it("finishes a weak learner in under 20 questions", () => {
    expect(weak.questions.length).toBeLessThan(20);
    for (const skill of skills) {
      expect(weak.map[skill.id].level).toBe(0);
      expect(weak.map[skill.id].state).toBe("not-started");
    }
    expect(weak.toppedOut).toEqual([]);
    const asked = new Set(weak.questions.map((item) => item.skillId));
    expect(asked).toEqual(
      new Set(["tens-and-ones", "add-two-digit-no-regroup", "multiply-facts-2-to-5"]),
    );
  });

  it("finishes a strong learner in 45 questions or fewer at level 5", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const result = place(() => true, 45);
    for (const skill of skills) {
      expect(result.map[skill.id]).toEqual({ level: 5, state: "mastered" });
    }
    expect(result.questions.length).toBeLessThanOrEqual(45);
    expect(result.questions[0].level).toBe(3);
    const perSkill = new Map<string, number>();
    for (const question of result.questions) {
      perSkill.set(question.skillId, (perSkill.get(question.skillId) ?? 0) + 1);
    }
    for (const count of perSkill.values()) {
      expect(count).toBeLessThanOrEqual(3);
    }
    expect(result.toppedOut).toEqual(strands.map((strand) => strand.id));
    for (const strand of strands) {
      expect(strandIsMastered(strand, result.map)).toBe(true);
      expect(log).toHaveBeenCalledWith(`Strand topped out: ${strand.id}`);
    }
    log.mockRestore();
    expect(strong.questions.length).toBeLessThanOrEqual(45);
  });

  it("matches an uninterrupted sitting after a stop and resume", () => {
    const steady = play(() => true, 45, null);
    const paused = play(() => true, 45, 4);
    expect(paused.questions).toEqual(steady.questions);
    expect(paused.session.map).toEqual(steady.session.map);
    expect(paused.questions.length).toBe(steady.questions.length);
    const mid = play(learnerMixed, 11, 5);
    const whole = play(learnerMixed, 11, null);
    expect(mid.session.map).toEqual(whole.session.map);
    expect(mid.questions).toEqual(whole.questions);
  });
});
