# Math Builds learning system

The design the app implements: how a learner is placed, taught, practiced, reviewed and moved on. It draws on well-established teaching research and common practice in adaptive math programs; no product's materials are used.

## The five principles

1. **Start a little below the learner's level.** An easy start builds confidence and speed before difficulty.
2. **Teach one small step at a time,** each with one worked example, then guided tries with help that fades.
3. **Practice until right and fast.** Speed is part of mastery: recalled facts free working memory for harder math.
4. **Bring old skills back on a schedule, mixed with new ones.** Review just before a skill is forgotten, and mix strands within a session.
5. **Move on only when the learner proves it,** and confirm it again later in mixed practice.

What Math Builds adds: questions earn real pieces, the math is visible in the thing the learner builds, and a wrong number is allowed to fail in the physics, so a mistake is funny and informative instead of a red X.

## Placement

- Pick grade (US) or Klasse (Europe), then a staircase per strand starting at that grade's level: up after right, down after wrong, stop after two reversals or 12 questions.
- Start every strand one level below where it settled.
- In the first 7 days, three fast correct runs in a strand move it up one level, so an easy start is corrected quickly.
- Young children get the spoken, drag-and-drop version. Placement never takes longer than 12 minutes and can stop and resume.

## Teaching a new skill

1. **One worked example** in the learner's kind of numbers, every step shown, with a picture that changes per step.
2. **Guided tries** with the hint open or the first step done. Objects and pictures come before symbols for young learners.
3. **On your own:** plain problems. Two right in a row ends the guided part.
4. **A wrong answer shows how:** that exact problem solved step by step in the learner's numbers, then a fresh problem.
5. **"I don't know"** goes straight to the worked example and never counts against the learner.

## Practice, speed and mastery

- **Fluency first, then time.** Timing only helps once a fact is recalled rather than counted out. Benchmarks: all one-digit sums by the end of grade 2, all one-digit products by the end of grade 3.
- **Small sets, high success.** Introduce a few new facts at a time, built from known ones (7 × 8 from 7 × 7), and keep each answer just within reach.
- **Mixed beats blocked.** Mixing problem types within practice produces much better long-term retention than practicing one type at a time (a large randomized trial in grade 7 found 61% vs 38% correct a month later).
- **Review by forgetting.** Each skill has a review interval that grows when the learner succeeds on time and shrinks after a miss. A right answer on a harder skill also counts as partial review of the easier skills inside it, so review costs less time.
- **The top must be earned.** Mastery needs the skill right again later, in a mix with other skills.

### Skill states

| State | How you get there | What the learner sees |
| --- | --- | --- |
| New | Not met yet | Learn card next time it comes up |
| Learning | Finished the Learn card and guided tries | Practice in runs |
| Practicing | 4 of 5 right in one session | Mixed into warm-ups and runs |
| Fluent | Right and under the time target on 3 different days | Shows up rarely, timed |
| Mastered | Fluent, then right in a mixed check at least 7 days later | Only in the spiral, about 1 in 10 |

Time targets are per skill: 3 s for a one-digit fact, longer for multi-step work. The clock is never shown during a question. A miss in Fluent or Mastered drops the skill one state, not to zero.

## Pre-readers (levels 1 and 2)

- **Every question is spoken,** with a replay button. On-screen words are small and for the parent.
- **Answers are actions, not typing:** drag 5 bolts into the box, tap the bigger pile, order planks shortest to longest, drag the goat to the triangle.
- **Numerals always appear with their dots** until the counting strand reaches level 3.
- **No keypad at level 1.** Level 2 uses a big 0 to 10 numeral strip.
- **Short:** 5 to 8 questions, then something gets built.

Level 1 skills, all without reading: count up to 10 objects, match a numeral to a quantity, more or fewer, longer or shorter, heavier or lighter, tap a named shape, sort by size, finish a pattern, combine two piles and count. The level 1 build is pre-cut: pieces arrive sized and the child drags them onto their outlines.

## A round (about 5 minutes, 12 to 15 questions)

1. **Warm-up, 3 questions:** mixed, from skills due for review and from fluent skills (timed). Fast and easy on purpose.
2. **New skill,** only when one is ready and never more than one per round: Learn card, guided tries.
3. **Practice run:** about 70% the current skill, 30% mixed from other strands. Plain notation (7 × 8 = ?); one in four as a picture where pictures help (counting, fractions, geometry).
4. **Word problem:** the build's real question with its picture, one per piece.
5. **Pieces earned, build, test** with the goat.

## Levels and strands

- 13 levels per strand, one per school year, each a short list of named skills in docs/curriculum.md.
- A level is done when all its skills are Fluent.
- Strands move separately, but none may run more than one level ahead of the arithmetic spine (adding, multiplying, dividing).
- The learner never sees a level number; the parent view does.

## When a learner is stuck

- One missed practice round offers "Try an easier one" (same strand, one level down, for the rest of that piece).
- Two missed rounds drop that skill's level by one and bring back the worked example.

## Parent view

Each skill's state, its median answer time over the last 10 answers, and the last answers per skill.
