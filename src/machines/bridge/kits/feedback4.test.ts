import { describe, expect, it } from "vitest";
import { KIT_STRANDS } from "../../../engine/strand-placement";
import { setUnitSystem } from "../../../units";
import { earnPicture, earnPrompt, questionForStrand, wordTemplate, answerEarn, blankEarn, startPractice } from "./earn";
import { queenPost } from "./kit";
import { pieceQuestion, strandWord } from "./pieces";
import { plainQuestion } from "./plain";
import { KIT_SKILLS } from "./skills";

describe("feedback 4", () => {
  it("names skills as written, without a shapes suffix", () => {
    expect(KIT_SKILLS.some((skill) => skill.name === "Measure with a tape")).toBe(true);
    expect(KIT_SKILLS.some((skill) => skill.name === "Add within 20")).toBe(true);
    expect(KIT_SKILLS.some((skill) => skill.name === "Times tables to 10")).toBe(true);
    expect(KIT_SKILLS.some((skill) => skill.name === "Share equally")).toBe(true);
    expect(KIT_SKILLS.some((skill) => skill.name === "Pythagoras")).toBe(true);
    for (const skill of KIT_SKILLS) {
      expect(skill.name.toLowerCase(), skill.name).not.toBe("shapes");
    }
  });

  it("gives every strand its own word problem", () => {
    setUnitSystem("us");
    const templates = KIT_STRANDS.map((strand) => wordTemplate(strand));
    expect(new Set(templates).size).toBe(templates.length);
    expect(strandWord("fractions").prompt).toContain("3/4 of the deck");
    expect(strandWord("ratios").prompt).toContain("bolts per gusset");
    expect(strandWord("algebra").prompt).toContain("x");
    const fractions = questionForStrand("fractions", 4, 1);
    const algebra = questionForStrand("algebra", 4, 1);
    expect(fractions.strandId).toBe("fractions");
    expect(fractions.groupId).toBe("planks");
    expect(earnPrompt(fractions).toLowerCase()).toContain("plank");
    expect(strandWord("fractions").prompt).toContain("3/4 of the deck");
    expect(earnPrompt(algebra)).toContain("x");
    expect(earnPrompt(algebra)).not.toBe(earnPrompt(questionForStrand("dividing", 4, 1)));
  });

  it("keeps banned words out of question text", () => {
    setUnitSystem("us");
    const texts: string[] = [];
    for (const group of queenPost.groups) {
      for (let level = 1; level <= 13; level += 1) {
        const question = pieceQuestion(group.id, level);
        texts.push(question.prompt);
      }
    }
    for (const strand of ["fractions", "ratios", "algebra"]) {
      texts.push(strandWord(strand).prompt);
    }
    for (const strand of KIT_STRANDS) {
      for (const level of [1, 4, 7, 10, 13]) {
        for (const seed of [1, 2, 3]) {
          const item = plainQuestion(strand, level, seed);
          texts.push(item.prompt, ...item.steps, item.why);
          texts.push(earnPrompt(questionForStrand(strand, level, seed)));
        }
      }
    }
    for (const text of texts) {
      expect(text.toLowerCase(), text).not.toMatch(/\blabeled\b|\bdrawn\b|the beams drawn|\blevel\b/);
    }
  });

  it("draws a numbered tape for a measuring question", () => {
    setUnitSystem("us");
    const question = questionForStrand("measuring", 4, 1);
    const picture = earnPicture(question);
    expect(picture?.tape).toBeTruthy();
    const labels = picture?.tape?.ticks.map((tick) => tick.label).filter(Boolean) ?? [];
    expect(labels).toContain("2");
    expect(labels).toContain("6");
    expect(labels).toContain("4");
  });

  it("logs help without dropping a level", () => {
    const levels = Object.fromEntries(KIT_STRANDS.map((id) => [id, 4]));
    const opened = blankEarn(levels);
    const missed = answerEarn(opened, "nope", levels);
    const practice = startPractice(missed.state);
    const helped = answerEarn(practice, "", levels, 0, null, true);
    expect(helped.help).toBe(true);
    expect(helped.state.phase).toBe("explain");
    expect(helped.state.roundsFailed).toBe(0);
    expect(helped.levels).toEqual(levels);
    const again = answerEarn(startPractice(helped.state), "", levels, 0, null, true);
    expect(again.levels).toEqual(levels);
    const recent = Object.values(again.state.book.skills).flatMap((skill) => skill.recent);
    expect(recent.some((item) => item.help)).toBe(true);
  });
});
