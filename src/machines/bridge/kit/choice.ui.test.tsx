/** @vitest-environment happy-dom */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { createLearnerMap } from "../../../engine/placement";
import { skills } from "../../../data/load-skills";
import { CURRICULUM_SKILLS } from "../../../skills";
import { isFormChoice, skillQuestion } from "../../../skills/generate";
import { GoatKit } from "./GoatKit";
import type { KitProfile } from "../../../storage/progress";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const profile: KitProfile = {
  grade: 3,
  levels: { dividing: 5, measuring: 5, adding: 5, multiplying: 5, fractions: 5, ratios: 5, geometry: 5, algebra: 8, counting: 5 },
  history: [],
  notes: [],
  built: true,
};

describe("choice screen", () => {
  it(
    "renders 2 to 4 options and no keypad for every choice skill",
    async () => {
      const choiceIds = CURRICULUM_SKILLS.filter((skill) => skill.answer === "choice").map((skill) => skill.id);
      expect(choiceIds.length).toBeGreaterThan(10);
      for (const skillId of choiceIds) {
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
              skill={skillId}
              kitProfile={profile}
            />,
          );
        });
        const options = container.querySelectorAll("[data-choice]");
        expect(options.length, skillId).toBeGreaterThanOrEqual(2);
        expect(options.length, skillId).toBeLessThanOrEqual(4);
        expect(container.querySelector(".gk-keys"), skillId).toBeNull();
        expect(container.querySelector('input[aria-label="Answer"]'), skillId).toBeNull();
        expect(container.textContent, skillId).toContain("I don't know");
        expect(container.querySelector('canvas[aria-label="Work it out"]'), skillId).toBeNull();
        const check = container.querySelector("[data-check]") as HTMLButtonElement | null;
        expect(check, skillId).toBeTruthy();
        expect(check?.disabled, skillId).toBe(true);
        root.unmount();
        container.remove();
      }
    },
    30000,
  );

  it("draws picture options for geometry, fractions, counting and measuring", async () => {
    const pictured = CURRICULUM_SKILLS.filter((skill) => {
      if (skill.answer !== "choice") {
        return false;
      }
      if (!["geometry", "fractions", "counting", "measuring"].includes(skill.strandId)) {
        return false;
      }
      const sample = skillQuestion(skill.id, 3);
      return !isFormChoice(sample.answer) && (sample.choices ?? []).every((option) => option.kind === "picture");
    });
    expect(pictured.length).toBeGreaterThan(3);
    for (const skill of pictured) {
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
            skill={skill.id}
            kitProfile={profile}
          />,
        );
      });
      const options = [...container.querySelectorAll("[data-choice]")];
      expect(options.length, skill.id).toBeGreaterThanOrEqual(2);
      for (const option of options) {
        expect(option.querySelector("img, svg"), skill.id).toBeTruthy();
        expect(option.querySelector(".gk-choice-label"), skill.id).toBeNull();
      }
      root.unmount();
      container.remove();
    }
  });

  it("keeps the right option moving across positions for Tap 7", () => {
    const seen = new Set<number>();
    for (let seed = 1; seed <= 100; seed += 1) {
      const question = skillQuestion("counting.1.numerals", seed);
      const index = question.choices!.findIndex((option) => option.value === question.answer);
      expect(index).toBeGreaterThanOrEqual(0);
      seen.add(index);
    }
    expect(seen.has(0)).toBe(true);
    expect(seen.has(1)).toBe(true);
    expect(seen.has(2)).toBe(true);
    expect(seen.has(3)).toBe(true);
  });
});
