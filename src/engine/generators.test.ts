import { describe, expect, it } from "vitest";
import { skills, skillsInStrand, strands } from "../data/load-skills";
import { generateProblem } from "../engine/generate";
import { generators, generateStackedSubtraction } from "../engine/generators";
import { createRng } from "../engine/rng";
import type { PlaceName, Problem, SkillParams } from "../engine/types";

const PLACE_FACTOR: Record<PlaceName, number> = {
  ones: 1,
  tens: 10,
  hundreds: 100,
  thousands: 1000,
};

function independentAnswer(problem: Problem): string {
  const visual = problem.visual;
  if (!visual) {
    throw new Error("Problem is missing visual data");
  }
  if (visual.kind === "expression") {
    if (visual.operator === "+") {
      return String(visual.left + visual.right);
    }
    if (visual.operator === "x") {
      return String(visual.left * visual.right);
    }
    return String(visual.left - visual.right);
  }
  if (visual.kind === "stacked") {
    if (visual.operator === "-") {
      return String(visual.top - visual.bottom);
    }
    if (visual.operator === "x") {
      return String(visual.top * visual.bottom);
    }
    return String(visual.top + visual.bottom);
  }
  if (visual.kind === "place-value") {
    const digit = Math.floor(visual.number / PLACE_FACTOR[visual.place]) % 10;
    return String(digit * PLACE_FACTOR[visual.place]);
  }
  if (visual.kind === "compare") {
    return String(Math.max(visual.left, visual.right));
  }
  const unit = visual.place === "ten" ? 10 : 100;
  return String(Math.round(visual.number / unit) * unit);
}

/** Independent pencil-and-paper borrow check. Not the generator's classifier. */
function borrowFacts(top: number, bottom: number, digits: number): {
  count: number;
  acrossZero: boolean;
} {
  const topDigits = String(top).padStart(digits, "0").split("").map(Number);
  const bottomDigits = String(bottom).padStart(digits, "0").split("").map(Number);
  let owed = 0;
  let count = 0;
  let acrossZero = false;
  for (let index = digits - 1; index >= 0; index -= 1) {
    const available = topDigits[index] - owed;
    if (available < bottomDigits[index]) {
      count += 1;
      if (available < 0) {
        acrossZero = true;
      }
      owed = 1;
    } else {
      owed = 0;
    }
  }
  return { count, acrossZero };
}

function assertBorrow(pattern: string, top: number, bottom: number, digits: number) {
  const facts = borrowFacts(top, bottom, digits);
  if (pattern === "none") {
    expect(facts.count).toBe(0);
    expect(facts.acrossZero).toBe(false);
  } else if (pattern === "once") {
    expect(facts.count).toBe(1);
    expect(facts.acrossZero).toBe(false);
  } else if (pattern === "twice") {
    expect(facts.count).toBe(2);
    expect(facts.acrossZero).toBe(false);
  } else if (pattern === "across-zeros") {
    expect(facts.acrossZero).toBe(true);
  }
}

function digitLength(value: number): number {
  return String(value).length;
}

function assertSkillConstraints(generator: string, params: SkillParams, problem: Problem) {
  const visual = problem.visual;
  expect(visual).toBeTruthy();
  if (!visual) {
    return;
  }
  if (generator === "stacked-subtraction") {
    expect(visual.kind).toBe("stacked");
    if (visual.kind !== "stacked") {
      return;
    }
    expect(visual.layout).toBe("vertical");
    expect(visual.operator).toBe("-");
    const digits = params.digits;
    const borrow = params.borrow;
    expect(digitLength(visual.top)).toBe(digits);
    expect(digitLength(visual.bottom)).toBe(digits);
    expect(visual.top).toBeGreaterThan(visual.bottom);
    if (params.topMax != null) {
      expect(visual.top).toBeLessThanOrEqual(Number(params.topMax));
    }
    assertBorrow(String(borrow), visual.top, visual.bottom, Number(digits));
  }
  if (generator === "addition" && visual.kind === "stacked") {
    expect(visual.operator).toBe("+");
    expect(digitLength(visual.top)).toBe(params.digits);
    expect(digitLength(visual.bottom)).toBe(params.digits);
    if (params.maxAddend != null) {
      expect(visual.top).toBeLessThanOrEqual(Number(params.maxAddend));
      expect(visual.bottom).toBeLessThanOrEqual(Number(params.maxAddend));
    }
    const width = Number(params.digits);
    const left = String(visual.top).padStart(width, "0");
    const right = String(visual.bottom).padStart(width, "0");
    for (let index = 0; index < width; index += 1) {
      expect(Number(left[index]) + Number(right[index])).toBeLessThan(10);
    }
  }
  if (generator === "place-value" && visual.kind === "place-value") {
    expect(visual.number).toBeGreaterThanOrEqual(Number(params.min));
    expect(visual.number).toBeLessThanOrEqual(Number(params.max));
    expect(params.places).toContain(visual.place);
  }
  if (generator === "compare-numbers" && visual.kind === "compare") {
    const digits = Number(params.digits);
    expect(digitLength(visual.left)).toBe(digits);
    expect(digitLength(visual.right)).toBe(digits);
    if (params.max != null) {
      expect(visual.left).toBeLessThanOrEqual(Number(params.max));
      expect(visual.right).toBeLessThanOrEqual(Number(params.max));
    }
    expect(visual.left).not.toBe(visual.right);
    expect(problem.choices).toEqual(expect.arrayContaining([String(visual.left), String(visual.right)]));
  }
  if (generator === "round-number" && visual.kind === "round") {
    expect(visual.place).toBe(params.place);
    expect(visual.number).toBeGreaterThanOrEqual(Number(params.min));
    expect(visual.number).toBeLessThanOrEqual(Number(params.max));
  }
  if (generator === "multiplication" && visual.kind === "stacked") {
    expect(visual.operator).toBe("x");
    expect(visual.top).toBeGreaterThanOrEqual(Number(params.leftMin));
    expect(visual.top).toBeLessThanOrEqual(Number(params.leftMax));
    expect(visual.bottom).toBeGreaterThanOrEqual(Number(params.rightMin));
    expect(visual.bottom).toBeLessThanOrEqual(Number(params.rightMax));
  }
}

describe("skill catalog", () => {
  it("loads about fifteen skills across three strands", () => {
    expect(strands).toHaveLength(3);
    expect(skills.length).toBeGreaterThanOrEqual(15);
    expect(skills.length).toBeLessThanOrEqual(18);
  });

  it("gives every skill a known generator, a grade band, and real prerequisites", () => {
    const ids = new Set(skills.map((skill) => skill.id));
    for (const skill of skills) {
      expect(skill.id).toMatch(/^[a-z0-9-]+$/);
      expect(skill.name.length).toBeGreaterThan(0);
      expect(skill.description.endsWith(".")).toBe(true);
      expect(skill.description.includes("\u2014")).toBe(false);
      expect(["K-2", "3-5", "6-8"]).toContain(skill.gradeBand);
      expect(skill.levels).toHaveLength(5);
      expect(generators[skill.generator]).toBeTypeOf("function");
      for (const prerequisite of skill.prerequisites) {
        expect(ids.has(prerequisite)).toBe(true);
        const earlier = skills.find((item) => item.id === prerequisite);
        expect(earlier?.strand).toBe(skill.strand);
      }
    }
    for (const strand of strands) {
      const ordered = skillsInStrand(strand.id);
      expect(ordered.length).toBeGreaterThanOrEqual(5);
      expect(new Set(ordered.map((skill) => skill.strand))).toEqual(new Set([strand.id]));
    }
  });
});

describe("stacked subtraction patterns", () => {
  const cases: { borrow: string; digits: number }[] = [
    { borrow: "none", digits: 2 },
    { borrow: "none", digits: 3 },
    { borrow: "once", digits: 2 },
    { borrow: "twice", digits: 3 },
    { borrow: "across-zeros", digits: 3 },
  ];

  for (const testCase of cases) {
    it(`forces ${testCase.borrow} across ${testCase.digits} digits for 200 problems`, () => {
      for (let index = 0; index < 200; index += 1) {
        const problem = generateStackedSubtraction(createRng(1000 + index * 17), 3, testCase);
        expect(problem.visual?.kind).toBe("stacked");
        if (problem.visual?.kind !== "stacked") {
          continue;
        }
        expect(problem.visual.layout).toBe("vertical");
        expect(problem.answer).toBe(independentAnswer(problem));
        assertBorrow(testCase.borrow, problem.visual.top, problem.visual.bottom, testCase.digits);
      }
    });
  }
});

describe("generators", () => {
  it("registers one function per generator id used by the catalog", () => {
    const used = new Set(skills.map((skill) => skill.generator));
    expect(new Set(Object.keys(generators))).toEqual(used);
  });

  for (const skill of skills) {
    for (let level = 1; level <= 5; level += 1) {
      it(`checks 200 seeded ${skill.id} level ${level} problems`, () => {
        for (let index = 0; index < 200; index += 1) {
          const problem = generateProblem(skill, createRng(level * 1000 + index + 1), level);
          expect(problem.answer).toBe(independentAnswer(problem));
          expect(problem.prompt.includes("\u2014")).toBe(false);
          assertSkillConstraints(skill.generator, skill.levels[level - 1], problem);
        }
      });
    }
  }
});
