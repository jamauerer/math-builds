import { skills } from "../../../data/load-skills";
import type { LearnerMap } from "../../../engine/placement";
import { practiceLevel } from "../../../engine/placement";
import {
  generateDoubleRun,
  generateHypotenuse,
  generateMeasureGap,
  generateTimesAsMany,
  generateTrussTriangles,
} from "../../../engine/generators/extended";
import { generateMultiplication } from "../../../engine/generators/multiplication";
import { createRng, type Rng } from "../../../engine/rng";
import type { Problem, SkillParams } from "../../../engine/types";
import { queenPost, type KitGroup } from "./kit";

export type EarnQuestion = {
  groupId: string;
  prompt: string;
  answer: string;
  hint: string;
  unit: string;
  level: number;
  visual?: Problem["visual"];
};

export type EarnState = {
  queue: EarnQuestion[];
  index: number;
  earned: string[];
};

const BRIDGE_SKILLS = [
  "gap-between-marks",
  "multiply-facts-2-to-5",
  "truss-triangles",
  "times-as-many",
  "right-triangle-hypotenuse",
  "double-the-run",
];

/** Skill progress is 0 to 5. Spread that across the 13 bridge rungs. Pythagoras starts at rung 9. */
export function placedKitLevel(map: LearnerMap): number {
  const best = Math.max(0, ...BRIDGE_SKILLS.map((id) => map[id]?.level ?? 0));
  return Math.min(13, Math.max(1, best * 2 + 1));
}

function paramsFor(skillId: string, level: number): SkillParams {
  const skill = skills.find((item) => item.id === skillId);
  if (!skill) {
    throw new Error(`Missing skill ${skillId}`);
  }
  const index = Math.min(skill.levels.length, Math.max(1, level)) - 1;
  return skill.levels[index] ?? {};
}

function levelFor(map: LearnerMap, skillId: string): number {
  return practiceLevel(map[skillId]);
}

function themed(problem: Problem, unit: string, hint: string): Omit<EarnQuestion, "groupId" | "level"> {
  return {
    prompt: problem.prompt,
    answer: problem.answer,
    hint,
    unit,
    visual: problem.visual,
  };
}

function questionFor(group: KitGroup, map: LearnerMap, rng: Rng, ladder: number): EarnQuestion {
  const level = levelFor(map, "gap-between-marks");
  if (group.id === "bottom") {
    const problem = generateMeasureGap(rng, level, paramsFor("gap-between-marks", level));
    return {
      groupId: group.id,
      level,
      ...themed(
        {
          ...problem,
          prompt: problem.prompt.replace("units", "metres").replace("gap", "gap under the bridge"),
        },
        "m",
        "Hint: take the left mark away from the right mark.",
      ),
    };
  }
  if (group.id === "posts") {
    const postLevel = levelFor(map, "multiply-facts-2-to-5");
    const problem = generateMultiplication(rng, postLevel, paramsFor("multiply-facts-2-to-5", postLevel));
    const visual = problem.visual as { top?: number; bottom?: number } | undefined;
    const each = visual?.top ?? 2;
    const count = visual?.bottom ?? 2;
    return {
      groupId: group.id,
      level: postLevel,
      prompt: `Each post is ${each} m of timber. The kit needs ${count} posts. How many metres of post is that?`,
      answer: problem.answer,
      hint: `Hint: ${count} lots of ${each}.`,
      unit: "m",
      visual: problem.visual,
    };
  }
  if (group.id === "gussets") {
    const gussetLevel = levelFor(map, "truss-triangles");
    const problem = generateTrussTriangles(rng, gussetLevel, paramsFor("truss-triangles", gussetLevel));
    return {
      groupId: group.id,
      level: gussetLevel,
      prompt: `Gusset plates sit on the corners. ${problem.prompt}`,
      answer: problem.answer,
      hint: "Hint: each diagonal makes two triangles.",
      unit: "",
      visual: problem.visual,
    };
  }
  if (group.id === "top") {
    const topLevel = levelFor(map, "multiply-facts-2-to-5");
    const problem = generateMultiplication(rng, topLevel, paramsFor("multiply-facts-2-to-5", topLevel));
    const visual = problem.visual as { top?: number; bottom?: number } | undefined;
    const kg = visual?.bottom ?? 12;
    const metres = visual?.top ?? 4;
    return {
      groupId: group.id,
      level: topLevel,
      prompt: `Oak weighs ${kg} kg for every metre of beam. The top beam is ${metres} m long. How heavy is it?`,
      answer: problem.answer,
      hint: `Hint: ${metres} lots of ${kg}. Count them up, or times them.`,
      unit: "kg",
      visual: problem.visual,
    };
  }
  if (group.id === "braces") {
    if (ladder >= 9) {
      const braceLevel = levelFor(map, "right-triangle-hypotenuse");
      const problem = generateHypotenuse(rng, braceLevel, paramsFor("right-triangle-hypotenuse", braceLevel));
      return {
        groupId: group.id,
        level: ladder,
        prompt: `A brace is the hypotenuse. ${problem.prompt}`,
        answer: problem.answer,
        hint: "Hint: square both sides, add, then square root.",
        unit: "m",
        visual: problem.visual,
      };
    }
    return {
      groupId: group.id,
      level: ladder,
      prompt: "The brace runs 2 m across and 2 m up. Below level 9 the length is given. How long is the brace?",
      answer: "2.83",
      hint: "Hint: you are given 2.83 m. Type it.",
      unit: "m",
    };
  }
  if (group.id === "bolts") {
    const boltLevel = levelFor(map, "times-as-many");
    const problem = generateTimesAsMany(rng, boltLevel, paramsFor("times-as-many", boltLevel));
    const visual = problem.visual as { left?: number; right?: number } | undefined;
    const perPlate = visual?.right ?? 2;
    const plates = visual?.left ?? 5;
    return {
      groupId: group.id,
      level: boltLevel,
      prompt: `Bolts: ${perPlate} per gusset plate, and this bridge has ${plates} plates. How many bolts?`,
      answer: problem.answer,
      hint: `Hint: ${plates} plates times ${perPlate}.`,
      unit: "",
      visual: problem.visual,
    };
  }
  const railLevel = levelFor(map, "double-the-run");
  const problem = generateDoubleRun(rng, railLevel, paramsFor("double-the-run", railLevel));
  const visual = problem.visual as { left?: number } | undefined;
  const side = visual?.left ?? 8;
  return {
    groupId: group.id,
    level: railLevel,
    prompt: `The railing runs both sides of a deck. One side is ${side} m. How many metres of railing is that?`,
    answer: problem.answer,
    hint: "Hint: both sides means twice one side.",
    unit: "m",
    visual: problem.visual,
  };
}

export function buildEarnQueue(map: LearnerMap, seed = 1): EarnQuestion[] {
  const rng = createRng(seed);
  const ladder = placedKitLevel(map);
  return queenPost.groups.map((group) => questionFor(group, map, rng, ladder));
}

export function blankEarn(map: LearnerMap, seed = 1): EarnState {
  return { queue: buildEarnQueue(map, seed), index: 0, earned: [] };
}

export function earnDone(state: EarnState): boolean {
  return state.index >= state.queue.length;
}

/**
 * A correct answer earns the piece and moves on.
 * A wrong answer keeps every piece already earned and sends this question to the end.
 */
export function answerEarn(state: EarnState, given: string): { state: EarnState; correct: boolean } {
  const current = state.queue[state.index];
  if (!current) {
    return { state, correct: false };
  }
  const correct = given.trim() === current.answer.trim();
  if (correct) {
    return {
      correct: true,
      state: {
        queue: state.queue,
        index: state.index + 1,
        earned: [...state.earned, current.groupId],
      },
    };
  }
  const queue = state.queue.slice(0, state.index).concat(state.queue.slice(state.index + 1), [current]);
  return {
    correct: false,
    state: {
      queue,
      index: state.index,
      earned: state.earned.slice(),
    },
  };
}
