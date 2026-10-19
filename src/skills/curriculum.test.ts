import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CURRICULUM_SKILLS, curriculumSkillIds, KIT_PIECE_STRANDS } from "./index";
import { skillExplain, skillLearnLine, skillQuestion } from "./generate";
import graph from "./graph.json";
import { queenPost } from "../machines/bridge/kits/kit";
import { KIT_SKILLS } from "../machines/bridge/kits/skills";

function parseCurriculumIds(): string[] {
  const text = readFileSync(resolve("docs/curriculum.md"), "utf8");
  const ids: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith("|")) {
      continue;
    }
    const parts = line.split("|").slice(1, -1).map((part) => part.trim());
    if (parts.length < 8) {
      continue;
    }
    const id = parts[1];
    if (/^[a-z]+\.\d+\.[a-z0-9-]+$/.test(id)) {
      ids.push(id);
    }
  }
  return ids;
}

describe("curriculum graph", () => {
  const fileIds = parseCurriculumIds();

  it("keeps graph.json equal to docs/curriculum.md", () => {
    expect(graph.skills.map((skill) => skill.id)).toEqual(fileIds);
    expect(CURRICULUM_SKILLS.map((skill) => skill.id)).toEqual(fileIds);
    expect(KIT_SKILLS.map((skill) => skill.id)).toEqual(fileIds);
  });

  it("gives every file skill a generator, Learn card and explanation", () => {
    for (const id of fileIds) {
      const question = skillQuestion(id, 3);
      expect(question.prompt.length, id).toBeGreaterThan(0);
      expect(question.answer.length, id).toBeGreaterThan(0);
      expect(question.steps.length, id).toBeGreaterThan(0);
      const learn = skillLearnLine(id, 3);
      expect(learn.title.length, id).toBeGreaterThan(0);
      expect(learn.line.length, id).toBeGreaterThan(0);
      const explained = skillExplain(id, question.prompt, question.answer);
      expect(explained.steps.length, id).toBeGreaterThanOrEqual(3);
      expect(explained.why.length, id).toBeGreaterThan(0);
    }
  });

  it("gives every choice skill an option generator with 2 to 4 shuffled choices", () => {
    const choiceIds = CURRICULUM_SKILLS.filter((skill) => skill.answer === "choice").map((skill) => skill.id);
    expect(choiceIds.length).toBeGreaterThan(10);
    for (const id of choiceIds) {
      const question = skillQuestion(id, 3);
      expect(question.choices, id).toBeTruthy();
      expect(question.choices!.length, id).toBeGreaterThanOrEqual(2);
      expect(question.choices!.length, id).toBeLessThanOrEqual(4);
      expect(
        question.choices!.some((option) => option.value === question.answer),
        id,
      ).toBe(true);
    }
  });

  it("puts the right choice in every position across 100 renders", () => {
    const choiceIds = CURRICULUM_SKILLS.filter((skill) => skill.answer === "choice").map((skill) => skill.id);
    for (const id of choiceIds) {
      const seen = new Set<number>();
      let width = 0;
      for (let seed = 1; seed <= 100; seed += 1) {
        const question = skillQuestion(id, seed);
        const options = question.choices ?? [];
        expect(options.length, id).toBeGreaterThanOrEqual(2);
        expect(options.length, id).toBeLessThanOrEqual(4);
        width = Math.max(width, options.length);
        const index = options.findIndex((option) => option.value === question.answer);
        expect(index, `${id} seed ${seed}`).toBeGreaterThanOrEqual(0);
        seen.add(index);
      }
      for (let slot = 0; slot < width; slot += 1) {
        expect(seen.has(slot), `${id} never right at index ${slot}`).toBe(true);
      }
    }
  });

  it("rejects skills in code that are not in the file", () => {
    const allowed = new Set(fileIds);
    for (const id of curriculumSkillIds()) {
      expect(allowed.has(id), id).toBe(true);
    }
    for (const skill of KIT_SKILLS) {
      expect(allowed.has(skill.id), skill.id).toBe(true);
    }
  });

  it("names queen-post piece strands and question types from the kit table", () => {
    const byPiece: Record<string, { strand: string; questions: string }> = {
      "Bottom beams": { strand: "dividing", questions: "share equally (3), facts (4), decimals (6), x in an equation (8)" },
      Posts: { strand: "measuring", questions: "measure with the tape (2), convert units (4), decimal length (5)" },
      "Top beam": { strand: "adding", questions: "difference of two marks (2), to 100 (3), decimals (6), x (6 and up)" },
      Braces: { strand: "geometry", questions: "count triangles (3), angle names (4), longest side (5), angle sum (6), Pythagoras (9), trig (11)" },
      Gussets: { strand: "counting", questions: "count to 10 (1), corners (2), factors (5)" },
      Bolts: { strand: "multiplying", questions: "equal groups (3), tables (4), two-digit (5), ratio (6)" },
      Planks: { strand: "fractions", questions: "halves (2), name (3), fraction of a number (5), area of the deck (measuring 4)" },
      Railing: { strand: "measuring", questions: "perimeter (3), compound area (8)" },
    };
    const nameOf: Record<string, string> = {
      bottom: "Bottom beams",
      posts: "Posts",
      top: "Top beam",
      braces: "Braces",
      gussets: "Gussets",
      bolts: "Bolts",
      planks: "Planks",
      railing: "Railing",
    };
    for (const group of queenPost.groups) {
      const label = nameOf[group.id];
      if (!label) {
        continue;
      }
      const expected = byPiece[label];
      expect(group.strand, group.id).toBe(expected.strand);
      expect(group.questions, group.id).toBe(expected.questions);
    }
    expect(KIT_PIECE_STRANDS.length).toBe(9);
    expect(KIT_PIECE_STRANDS.find((piece) => piece.piece === "Heavy goat")?.strand).toBe("ratios");
  });
});
