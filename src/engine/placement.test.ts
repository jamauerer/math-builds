import { describe, expect, it, vi } from "vitest";
import { skills, strands } from "../data/load-skills";
import { createRng } from "./rng";
import {
  CEILING_MESSAGE,
  continueQuiz,
  createLearnerMap,
  createQuizSession,
  gradeAnswer,
  labelForLevel,
  practiceLevel,
  recordLevelPass,
  runPlacement,
  skipQuestion,
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

function learnerA(skill: Skill): boolean {
  if (skill.strand === "multiplication" || skill.strand === "place-value") {
    return true;
  }
  return !BORROW_IDS.includes(skill.id);
}

function learnerB(skill: Skill): boolean {
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

describe("level labels", () => {
  it("derives unknown, shaky, and solid from the highest level passed", () => {
    expect(labelForLevel(0)).toBe("unknown");
    expect(labelForLevel(3)).toBe("shaky");
    expect(labelForLevel(5)).toBe("solid");
    let map = createLearnerMap(skills);
    map = recordLevelPass(map, "tens-and-ones", 3);
    expect(map["tens-and-ones"]).toEqual({ level: 3, state: "shaky" });
    map = recordLevelPass(map, "tens-and-ones", 1);
    expect(map["tens-and-ones"].level).toBe(3);
    expect(practiceLevel(map["tens-and-ones"])).toBe(4);
    expect(CEILING_MESSAGE).toBe("You have finished all current skills in this strand");
  });
});

describe("quiz session", () => {
  it("raises the level after a correct answer and stops a skill after two level-1 misses", () => {
    const rng = createRng(5);
    let session = createQuizSession({ skills, strands, rng });
    expect(session.skillId).toBe("tens-and-ones");
    expect(session.level).toBe(1);
    session = gradeAnswer(session, session.problem?.answer ?? "");
    expect(session.correct).toBe(true);
    expect(session.map["tens-and-ones"].level).toBe(1);
    session = continueQuiz(session, rng);
    expect(session.skillId).toBe("tens-and-ones");
    expect(session.level).toBe(2);

    let missed = createQuizSession({ skills, strands, rng: createRng(9) });
    const wrong = missed.problem?.answer === "4" ? "5" : "4";
    missed = gradeAnswer(missed, wrong);
    missed = continueQuiz(missed, createRng(9));
    expect(missed.skillId).toBe("tens-and-ones");
    expect(missed.level).toBe(1);
    missed = gradeAnswer(missed, wrong);
    missed = continueQuiz(missed, createRng(9));
    expect(missed.map["tens-and-ones"].level).toBe(0);
    expect(missed.skillId).toBe("add-two-digit-no-regroup");
  });

  it("steps back one level after a miss, then stops on the next miss", () => {
    const rng = createRng(4);
    let session = createQuizSession({ skills, strands, rng });
    session = continueQuiz(gradeAnswer(session, session.problem?.answer ?? ""), rng);
    expect(session.level).toBe(2);
    const wrong = session.problem?.answer === "4" ? "5" : "4";
    session = continueQuiz(gradeAnswer(session, wrong), rng);
    expect(session.skillId).toBe("tens-and-ones");
    expect(session.level).toBe(1);
    session = continueQuiz(gradeAnswer(session, wrong), rng);
    expect(session.map["tens-and-ones"].level).toBe(1);
    expect(session.skillId).not.toBe("tens-and-ones");
  });

  it("counts I don't know yet as a miss and moves on", () => {
    const rng = createRng(6);
    let session = createQuizSession({ skills, strands, rng });
    session = skipQuestion(session, rng);
    expect(session.phase).toBe("answering");
    expect(session.skillId).toBe("tens-and-ones");
    session = skipQuestion(session, rng);
    expect(session.map["tens-and-ones"].level).toBe(0);
    expect(session.skillId).toBe("add-two-digit-no-regroup");
  });
});

describe("simulated placement", () => {
  const a = place(learnerA, 11);
  const b = place(learnerB, 22);
  const weak = place(() => false, 33);
  const strong = place(() => true, 44);

  it("gives a multiplication-strong learner a different map from a borrowing-strong learner", () => {
    expect(levels(a.map, MULTIPLY_IDS)).toEqual(MULTIPLY_IDS.map(() => 5));
    expect(levels(a.map, BORROW_IDS)).toEqual(BORROW_IDS.map(() => 0));
    expect(a.map["add-two-digit-no-regroup"].level).toBe(5);
    expect(a.map["subtract-no-borrow-two-digit"].level).toBe(5);
    expect(levels(a.map, PLACE_IDS)).toEqual(PLACE_IDS.map(() => 5));

    expect(levels(b.map, BORROW_IDS)).toEqual(BORROW_IDS.map(() => 5));
    expect(b.map["multiply-facts-2-to-5"].level).toBe(0);
    expect(levels(b.map, MULTIPLY_IDS.slice(1))).toEqual(MULTIPLY_IDS.slice(1).map(() => 0));
    expect(levels(b.map, PLACE_IDS)).toEqual(PLACE_IDS.map(() => 5));

    expect(levels(a.map, MULTIPLY_IDS)).not.toEqual(levels(b.map, MULTIPLY_IDS));
    expect(a.map).not.toEqual(b.map);
  });

  it("stops a weak learner early and still finishes the session", () => {
    expect(weak.questions).toHaveLength(6);
    for (const skill of skills) {
      expect(weak.map[skill.id].level).toBe(0);
      expect(weak.map[skill.id].state).toBe("unknown");
    }
    expect(weak.toppedOut).toEqual([]);
    const roots = new Set(weak.questions.map((item) => item.skillId));
    expect(roots).toEqual(
      new Set(["tens-and-ones", "add-two-digit-no-regroup", "multiply-facts-2-to-5"]),
    );
  });

  it("masters every skill in one session and records each strand that topped out", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const result = place(() => true, 45);
    for (const skill of skills) {
      expect(result.map[skill.id].level).toBe(5);
      expect(result.map[skill.id].state).toBe("solid");
    }
    expect(result.questions).toHaveLength(skills.length * 5);
    expect(new Set(result.questions.map((item) => item.strandId))).toEqual(
      new Set(strands.map((strand) => strand.id)),
    );
    expect(result.toppedOut).toEqual(strands.map((strand) => strand.id));
    for (const strand of strands) {
      expect(strandIsMastered(strand, result.map)).toBe(true);
      expect(log).toHaveBeenCalledWith(`Strand topped out: ${strand.id}`);
    }
    log.mockRestore();
    expect(strong.toppedOut).toEqual(strands.map((strand) => strand.id));
  });
});
