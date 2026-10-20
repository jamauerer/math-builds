/** @vitest-environment happy-dom */
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { FigureSvg, pictureBoxSize } from "../../../pictures/view";
import { promptNeedsPicture } from "../../../pictures/need";
import { CURRICULUM_SKILLS } from "../../../skills";
import { skillQuestion } from "../../../skills/generate";
import { earnPicture, earnPrompt, listPictureTemplates, questionNeedsPicture, serveGradeQuestion, type EarnQuestion } from "./earn";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SCREEN_DIR = resolve(tmpdir(), "math-builds-no-picture-no-question");

function PictureProbe({ question }: { question: EarnQuestion }) {
  const picture = earnPicture(question);
  if (!picture) {
    return <div data-missing-picture="" />;
  }
  const box = pictureBoxSize(picture);
  return (
    <div className="gk-qpic" data-picture="probe" data-ink-w={box.width} data-ink-h={box.height} style={{ width: Math.max(box.width, 160), height: Math.max(box.height, 96) }}>
      {picture.figure ? <FigureSvg figure={picture.figure} /> : null}
      {picture.tape ? <div className="gk-tape" data-tape="" style={{ width: picture.tape.w, height: picture.tape.h }} /> : null}
      {picture.bits.map((bit, index) => (
        <i key={`${bit.slot}-${index}`} data-bit={bit.slot} style={{ width: bit.w, height: bit.h }} />
      ))}
    </div>
  );
}

async function renderPicture(question: EarnQuestion): Promise<{ container: HTMLDivElement; unmount: () => void }> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<PictureProbe question={question} />);
  });
  return {
    container,
    unmount: () => {
      root.unmount();
      container.remove();
    },
  };
}

describe("no picture no question", () => {
  it("declares needsPicture on every template and marks picture wording", () => {
    for (const skill of CURRICULUM_SKILLS) {
      for (const seed of [1, 2, 3, 7, 11]) {
        const item = skillQuestion(skill.id, seed);
        expect(typeof item.needsPicture, skill.id).toBe("boolean");
        if (promptNeedsPicture(item.prompt)) {
          expect(item.needsPicture, `${skill.id} ${item.prompt}`).toBe(true);
        }
      }
    }
  });

  it("serves 300 questions each for grades 1, 3 and 5 with pictures in the DOM", async () => {
    for (const grade of [1, 3, 5]) {
      for (let seed = 1; seed <= 300; seed += 1) {
        const question = serveGradeQuestion(grade, seed + grade * 1000);
        const prompt = earnPrompt(question);
        const needs = questionNeedsPicture(question) || promptNeedsPicture(prompt);
        if (!needs) {
          expect(promptNeedsPicture(prompt), prompt).toBe(false);
          continue;
        }
        const picture = earnPicture(question);
        expect(picture, prompt).toBeTruthy();
        expect(picture && pictureBoxSize(picture).width > 0, prompt).toBe(true);
        expect(picture && pictureBoxSize(picture).height > 0, prompt).toBe(true);
        const view = await renderPicture(question);
        const box = view.container.querySelector(".gk-qpic") as HTMLElement | null;
        expect(box, prompt).toBeTruthy();
        expect(Number(box?.dataset.inkW), prompt).toBeGreaterThan(0);
        expect(Number(box?.dataset.inkH), prompt).toBeGreaterThan(0);
        const ink = box?.querySelector("[data-figure], [data-tape], [data-bit], .gk-tape");
        expect(ink, prompt).toBeTruthy();
        view.unmount();
      }
    }
  }, 120000);

  it("renders each needsPicture template once and saves the image", () => {
    mkdirSync(SCREEN_DIR, { recursive: true });
    const templates = listPictureTemplates();
    expect(templates.map((item) => item.id).sort()).toEqual(
      expect.arrayContaining(["angle-name", "tape-where", "tape-mark", "shape-name"]),
    );
    for (const item of templates) {
      const picture = earnPicture(item.question);
      expect(picture, item.id).toBeTruthy();
      const box = pictureBoxSize(picture!);
      expect(box.width, item.id).toBeGreaterThan(0);
      expect(box.height, item.id).toBeGreaterThan(0);
      const figure = picture!.figure?.kind ?? (picture!.tape ? "tape" : "bits");
      writeFileSync(
        resolve(SCREEN_DIR, `${item.id}.svg.txt`),
        `${item.id}\n${item.skillId}\n${item.prompt}\nfigure=${figure}\nsize=${box.width}x${box.height}\n`,
        "utf8",
      );
    }
  });
});
