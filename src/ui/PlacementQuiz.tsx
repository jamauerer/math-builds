import { useRef, useState } from "react";
import { skills, strands } from "../data/load-skills";
import { answersMatch } from "../engine/answers";
import { generateProblem } from "../engine/generate";
import { continueQuiz, createQuizSession, gradeAnswer, type LearnerMap, type QuizSession } from "../engine/placement";
import { createRng } from "../engine/rng";
import { AnswerPanel } from "./AnswerPanel";
import { ProblemView } from "./ProblemView";

type PlacementProps = {
  initialMap: LearnerMap;
  onMap: (map: LearnerMap) => void;
  onClose: () => void;
};

export function PlacementQuiz({ initialMap, onMap, onClose }: PlacementProps) {
  const rng = useRef(createRng(Math.floor(Math.random() * 1_000_000_000) + 1));
  const [session, setSession] = useState<QuizSession>(() =>
    createQuizSession({
      skills,
      strands,
      map: initialMap,
      rng: rng.current,
    }),
  );

  const skill = skills.find((item) => item.id === session.skillId);
  const strand = strands[session.strandIndex];

  return (
    <section className="screen">
      <header className="screen-head">
        <h1>Placement</h1>
        {skill && strand ? (
          <p>
            {strand.name}: {skill.name}
          </p>
        ) : (
          <p>Checking each strand on its own.</p>
        )}
      </header>
      {session.phase === "done" || !session.problem ? (
        <div className="feedback">
          <p>Placement is finished. Your map is updated.</p>
          <button type="button" className="primary" onPointerUp={onClose}>
            See the map
          </button>
        </div>
      ) : (
        <div className="work">
          <ProblemView problem={session.problem} />
          {session.phase === "answering" ? (
            <AnswerPanel
              key={`${session.skillId}-${session.problem.prompt}-${session.problem.answer}`}
              problem={session.problem}
              locked={false}
              onSubmit={(answer) => {
                const graded = gradeAnswer(session, answer);
                setSession(graded);
                onMap(graded.map);
              }}
            />
          ) : (
            <div className="feedback">
              <p>{session.correct ? "Correct." : `Not yet. The answer is ${session.problem.answer}.`}</p>
              <button
                type="button"
                className="primary"
                onPointerUp={() => setSession((current) => continueQuiz(current, rng.current))}
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

type PracticeProps = {
  skillId: string;
  onAnswer: (skillId: string, correct: boolean) => void;
  onClose: () => void;
};

export function PracticeQuiz({ skillId, onAnswer, onClose }: PracticeProps) {
  const skill = skills.find((item) => item.id === skillId);
  const rng = useRef(createRng(Math.floor(Math.random() * 1_000_000_000) + 1));
  const [problem] = useState(() => (skill ? generateProblem(skill, rng.current, 3) : null));
  const [correct, setCorrect] = useState<boolean | null>(null);

  if (!skill || !problem) {
    return (
      <section className="screen">
        <p>That skill is missing.</p>
        <button type="button" className="primary" onPointerUp={onClose}>
          Back to map
        </button>
      </section>
    );
  }

  return (
    <section className="screen">
      <header className="screen-head">
        <h1>{skill.name}</h1>
        <p>{skill.description}</p>
      </header>
      <div className="work">
        <ProblemView problem={problem} />
        {correct === null ? (
          <AnswerPanel
            problem={problem}
            locked={false}
            onSubmit={(answer) => {
              const matched = answersMatch(answer, problem.answer);
              setCorrect(matched);
              onAnswer(skill.id, matched);
            }}
          />
        ) : (
          <div className="feedback">
            <p>{correct ? "Correct." : `Not yet. The answer is ${problem.answer}.`}</p>
            <button type="button" className="primary" onPointerUp={onClose}>
              Back to map
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
