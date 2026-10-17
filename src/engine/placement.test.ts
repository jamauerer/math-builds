import { describe, expect, it } from "vitest";
import { skills, strands } from "../data/load-skills";
import { createRng } from "./rng";
import {
  continueQuiz,
  createLearnerMap,
  createQuizSession,
  DEFAULT_MAX_QUESTIONS_PER_STRAND,
  gradeAnswer,
  recordAnswer,
  runPlacement,
  type LearnerMap,
} from "./placement";
import type { Skill } from "./types";

const BORROW_IDS = [
  "subtract-borrow-two-digit",
  "subtract-borrow-three-digit",
  "subtract-across-zeros",
];

const MULTIPLY_IDS = skills.filter((skill) => skill.strand === "multiplication").map((skill) => skill.id);
const SUBTRACT_IDS = skills
  .filter((skill) => skill.strand === "addition-subtraction")
  .map((skill) => skill.id);

function learnerA(skill: Skill): boolean {
  if (skill.strand === "multiplication" || skill.strand === "place-value") {
    return true;
  }
  return !BORROW_IDS.includes(skill.id);
}

function learnerB(skill: Skill): boolean {
  return skill.strand !== "multiplication";
}

function states(map: LearnerMap, ids: string[]): string[] {
  return ids.map((id) => map[id].state);
}

function place(respond: (skill: Skill) => boolean, seed: number) {
  return runPlacement({
    skills,
    strands,
    seed,
    respond: (skill) => respond(skill),
  });
}

describe("practice updates", () => {
  it("uses the same recordAnswer path as placement", () => {
    let map = createLearnerMap(skills);
    map = recordAnswer(map, "tens-and-ones", true);
    expect(map["tens-and-ones"].state).toBe("shaky");
    map = recordAnswer(map, "tens-and-ones", true);
    expect(map["tens-and-ones"].state).toBe("solid");
    map = recordAnswer(map, "hundreds", false);
    expect(map["hundreds"].state).toBe("unknown");
    expect(map["tens-and-ones"].state).toBe("solid");
    map = recordAnswer(map, "tens-and-ones", false);
    expect(map["tens-and-ones"].state).toBe("shaky");
  });
});

describe("quiz session", () => {
  it("confirms a skill before moving forward, and leaves a strand after a miss", () => {
    const rng = createRng(5);
    let session = createQuizSession({ skills, strands, rng });
    expect(session.skillId).toBe("tens-and-ones");
    session = gradeAnswer(session, session.problem?.answer ?? "");
    expect(session.correct).toBe(true);
    expect(session.map["tens-and-ones"].state).toBe("shaky");
    session = continueQuiz(session, rng);
    expect(session.skillId).toBe("tens-and-ones");
    session = gradeAnswer(session, session.problem?.answer ?? "");
    session = continueQuiz(session, rng);
    expect(session.map["tens-and-ones"].state).toBe("solid");
    expect(session.skillId).toBe("hundreds");

    const started = createQuizSession({ skills, strands, rng: createRng(9) });
    const wrong = started.problem?.answer === "4" ? "5" : "4";
    const missed = gradeAnswer(started, wrong);
    const next = continueQuiz(missed, createRng(9));
    expect(missed.map["tens-and-ones"].state).toBe("unknown");
    expect(next.skillId).toBe("add-two-digit-no-regroup");
  });
});

describe("simulated placement", () => {
  const a = place(learnerA, 11);
  const b = place(learnerB, 22);
  const c = place(() => false, 33);
  const d = place(() => true, 44);

  it("keeps learner A solid in multiplication and not solid on borrowing", () => {
    expect(states(a.map, MULTIPLY_IDS)).toEqual(MULTIPLY_IDS.map(() => "solid"));
    expect(states(a.map, BORROW_IDS)).toEqual(BORROW_IDS.map(() => "unknown"));
    expect(a.map["add-two-digit-no-regroup"].state).toBe("solid");
    expect(a.map["subtract-no-borrow-two-digit"].state).toBe("solid");
    for (const skill of skills.filter((item) => item.strand === "place-value")) {
      expect(a.map[skill.id].state).toBe("solid");
    }
  });

  it("keeps learner B solid on borrowing subtraction and unknown in multiplication", () => {
    expect(states(b.map, SUBTRACT_IDS)).toEqual(SUBTRACT_IDS.map(() => "solid"));
    expect(states(b.map, MULTIPLY_IDS)).toEqual(MULTIPLY_IDS.map(() => "unknown"));
    for (const skill of skills.filter((item) => item.strand === "place-value")) {
      expect(b.map[skill.id].state).toBe("solid");
    }
  });

  it("gives learner A and learner B different maps", () => {
    expect(states(a.map, MULTIPLY_IDS)).not.toEqual(states(b.map, MULTIPLY_IDS));
    expect(states(a.map, SUBTRACT_IDS)).not.toEqual(states(b.map, SUBTRACT_IDS));
    expect(a.map).not.toEqual(b.map);
  });

  it("marks learner C unknown everywhere and learner D solid everywhere", () => {
    for (const skill of skills) {
      expect(c.map[skill.id].state).toBe("unknown");
      expect(d.map[skill.id].state).toBe("solid");
    }
  });

  it("stops each strand on a boundary inside the question cap", () => {
    for (const result of [a, b, c, d]) {
      for (const strand of strands) {
        expect(result.questionsPerStrand[strand.id]).toBeLessThanOrEqual(
          DEFAULT_MAX_QUESTIONS_PER_STRAND,
        );
        expect(result.stopReason[strand.id]).toBe("boundary");
      }
    }
    expect(d.questionsPerStrand["multiplication"]).toBe(10);
    expect(c.questionsPerStrand["addition-subtraction"]).toBe(1);
  });
});
