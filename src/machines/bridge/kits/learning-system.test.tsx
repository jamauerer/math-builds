/** @vitest-environment happy-dom */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { createLearnerMap } from "../../../engine/placement";
import { KIT_STRANDS } from "../../../engine/strand-placement";
import { skills } from "../../../data/load-skills";
import { CURRICULUM_SKILLS } from "../../../skills";
import { skillQuestion } from "../../../skills/generate";
import { GoatKit } from "../kit/GoatKit";
import { rememberAnswer, skillsFromLevels, withState } from "./skills";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("learning system", () => {
  it("gives every level 1 skill a drag or tap generator", () => {
    const levelOne = CURRICULUM_SKILLS.filter((skill) => skill.level === 1);
    expect(levelOne.length).toBeGreaterThanOrEqual(9);
    for (const skill of levelOne) {
      const question = skillQuestion(skill.id, 3);
      const action = question.action ?? (question.choices?.length ? "tap-choice" : "keypad");
      expect(["drag-count", "tap-choice", "order", "drag-goat"].includes(action), skill.id).toBe(true);
    }
  });

  it("renders a level 1 question with no keypad and fires speech", async () => {
    const spoken: string[] = [];
    vi.stubGlobal(
      "SpeechSynthesisUtterance",
      class {
        text = "";
        lang = "";
        constructor(text: string) {
          this.text = text;
        }
      },
    );
    vi.stubGlobal("speechSynthesis", {
      speak: (utterance: { text: string }) => spoken.push(utterance.text),
      cancel: () => undefined,
      getVoices: () => [],
    });
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <GoatKit
          map={createLearnerMap(skills)}
          marks={0}
          onMarks={() => undefined}
          units="us"
          onUnits={() => undefined}
          start="earn"
          skill="counting.1.to-10"
          kitProfile={{
            grade: 0,
            country: "US",
            levels: Object.fromEntries(KIT_STRANDS.map((id) => [id, 1])),
            history: [],
            notes: [],
          }}
        />,
      );
    });
    expect(container.querySelector(".gk-keys")).toBeNull();
    expect(container.querySelector('input[aria-label="Answer"]')).toBeNull();
    expect(container.querySelector("[data-action='drag-count']")).toBeTruthy();
    expect(container.querySelector("[data-speak='replay']")).toBeTruthy();
    expect(spoken.some((line) => line.toLowerCase().includes("drag") || line.toLowerCase().includes("bolt"))).toBe(true);
    root.unmount();
    container.remove();
    vi.unstubAllGlobals();
  });

  it("reaches Fluent only after 3 separate days under the time target", () => {
    const skillId = "adding.2.to-20";
    let book = withState(skillsFromLevels(Object.fromEntries(KIT_STRANDS.map((id) => [id, 4]))), skillId, "practicing");
    book = rememberAnswer(book, skillId, "8 + 7", true, false, { ms: 2000, day: "2026-10-01" });
    book = rememberAnswer(book, skillId, "8 + 7", true, false, { ms: 2000, day: "2026-10-01" });
    book = rememberAnswer(book, skillId, "8 + 7", true, false, { ms: 2000, day: "2026-10-01" });
    expect(book.skills[skillId].state).toBe("practicing");
    book = rememberAnswer(book, skillId, "6 + 5", true, false, { ms: 2000, day: "2026-10-02" });
    expect(book.skills[skillId].state).toBe("practicing");
    book = rememberAnswer(book, skillId, "4 + 3", true, false, { ms: 2000, day: "2026-10-03" });
    expect(book.skills[skillId].state).toBe("fluent");
  });

  it("doubles the review interval after a passed due review", () => {
    const skillId = "adding.2.to-20";
    let book = withState(skillsFromLevels(Object.fromEntries(KIT_STRANDS.map((id) => [id, 4]))), skillId, "practicing");
    book = {
      ...book,
      skills: {
        ...book.skills,
        [skillId]: { ...book.skills[skillId], reviewInterval: 2, lastReview: "2026-10-17" },
      },
    };
    book = rememberAnswer(book, skillId, "8 + 7", true, false, { ms: 2000, day: "2026-10-20" });
    expect(book.skills[skillId].reviewInterval).toBe(4);
    expect(book.skills[skillId].lastReview).toBe("2026-10-20");
  });

  it("advances the adding prerequisite when a multiplication answer is right", () => {
    const mul = "multiplying.3.equal-groups";
    const add = "adding.2.to-20";
    let book = skillsFromLevels(Object.fromEntries(KIT_STRANDS.map((id) => [id, 4])));
    book = withState(book, mul, "practicing");
    book = withState(book, add, "practicing");
    book = {
      ...book,
      skills: {
        ...book.skills,
        [add]: { ...book.skills[add], reviewInterval: 2, lastReview: "2026-10-17" },
      },
    };
    expect(book.skills[add].lastReview).toBe("2026-10-17");
    book = rememberAnswer(book, mul, "3 × 4", true, false, { ms: 2000, day: "2026-10-20" });
    expect(book.skills[add].lastReview).toBe("2026-10-20");
    expect(book.skills[add].reviewInterval).toBeGreaterThanOrEqual(2);
  });
});
