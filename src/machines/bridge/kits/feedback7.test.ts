import { describe, expect, it } from "vitest";
import { CURRICULUM_SKILLS } from "../../../skills";
import { skillHint, skillQuestion } from "../../../skills/generate";
import { skillExplain } from "../../../skills/explain";
import { KIT_STRANDS } from "../../../engine/strand-placement";
import { blankEarn, currentQuestion, earnAtWord, earnHint, earnPrompt, explainQuestion, answerEarn } from "./earn";
import { pieceQuestion } from "./pieces";
import { skillsFromLevels, warmUpPlan } from "./skills";
import { fireworkDraws } from "../kit/scene";
import { queenPost } from "./kit";

const FORM = new Set(["right", "acute", "obtuse", "even", "odd"]);
const DEFINE = [
  "three sides",
  "3 sides",
  "is more than",
  "is longer than",
  "less than 90",
  "more than 90",
  "two equal parts",
  "equal parts",
];

function cleanHint(hint: string, answer: string, options: string[]) {
  const lower = hint.toLowerCase();
  const ans = answer.toLowerCase();
  if (ans && hint.includes(answer)) {
    return false;
  }
  if (ans.length > 1 && lower.includes(ans)) {
    return false;
  }
  for (const option of options) {
    const word = option.toLowerCase();
    if (word.length > 1 && FORM.has(word) === false && lower.split(/[^a-z0-9.]+/).includes(word)) {
      return false;
    }
  }
  return DEFINE.every((phrase) => !lower.includes(phrase));
}

describe("feedback 7", () => {
  it("keeps hints free of the answer across 500 generated questions", () => {
    let count = 0;
    for (const skill of CURRICULUM_SKILLS) {
      for (let seed = 1; seed <= 4; seed += 1) {
        const item = skillQuestion(skill.id, seed);
        const hint = skillHint(item);
        count += 1;
        if (!item.choices) {
          expect(hint, skill.id).toBe("");
        } else {
          expect(cleanHint(hint, item.answer, (item.choices ?? []).map((option) => option.value)), `${skill.id} ${hint}`).toBe(true);
        }
      }
    }
    for (const group of queenPost.groups) {
      for (const level of [2, 4, 8]) {
        const piece = pieceQuestion(group.id, level);
        const word = earnAtWord({ [group.strand]: level }, group.id);
        const hint = earnHint(word.current);
        count += 1;
        expect(cleanHint(hint, piece.answer, []), `${group.id} ${hint}`).toBe(true);
      }
    }
    expect(count).toBeGreaterThanOrEqual(500);
  });

  it("stays within 2 levels of the learner on warm-up and spiral", () => {
    const levels = Object.fromEntries(KIT_STRANDS.map((id) => [id, 4]));
    const book = skillsFromLevels(levels);
    for (let session = 0; session < 8; session += 1) {
      const slots = warmUpPlan({ ...book, session }, 3, "adding", levels);
      for (const slot of slots) {
        if (slot.strandId === "adding") {
          expect(slot.level).toBeGreaterThanOrEqual(2);
          expect(slot.level).toBeLessThanOrEqual(5);
        }
      }
    }
    let state = blankEarn(levels, 3);
    for (let step = 0; step < 40 && state.phase !== "done"; step += 1) {
      const question = currentQuestion(state);
      if (!question) {
        break;
      }
      if (question.strandId === "adding") {
        expect(question.level).toBeGreaterThanOrEqual(2);
      }
      state = answerEarn(state, question.answer, levels).state;
    }
  });

  it("explains the top beam word problem with the tape and two posts", () => {
    const word = earnAtWord({ adding: 4, measuring: 4 }, "top");
    expect(word.current.skillId).toBe("measuring.2.gap");
    expect(word.current.strandId).toBe("measuring");
    const explained = explainQuestion(word.current);
    expect(explained.steps.some((step) => step.picture === "tape" || step.picture === "tape-marks")).toBe(true);
    expect(explained.steps.map((step) => step.text).join(" ")).toMatch(/post|tape|gap/i);
    const fromSkill = skillExplain("measuring.2.gap", "Posts at 2 and 6. How far apart?", "4");
    expect(fromSkill.steps[0].picture).toBe("tape");
  });

  it("reads Dividing on the plank 8 divide 1 word problem", () => {
    const word = earnAtWord({ fractions: 4, dividing: 3 }, "planks");
    expect(word.current.skillId).toBe("dividing.3.share");
    expect(word.current.strandId).toBe("dividing");
    expect(earnPrompt(word.current)).toMatch(/plank/i);
  });

  it("counts at least 60 firework draws in the first second", () => {
    expect(fireworkDraws(1)).toBeGreaterThanOrEqual(60);
  });
});
