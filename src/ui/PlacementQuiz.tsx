import { useEffect, useRef, useState } from "react";
import { skills, strands } from "../data/load-skills";
import { answersMatch } from "../engine/answers";
import { generateProblem } from "../engine/generate";
import {
  continueQuiz,
  createQuizSession,
  gradeAnswer,
  placementMinutes,
  practiceLevel,
  questionsRemaining,
  restoreQuiz,
  skipQuestion,
  type LearnerMap,
  type PlacementSnapshot,
  type QuizSession,
} from "../engine/placement";
import { createRng } from "../engine/rng";
import { AnswerPanel } from "./AnswerPanel";
import { LearnerMap as LearnerMapScreen } from "./LearnerMap";
import { ProblemView } from "./ProblemView";

type PlacementProps = {
  initialMap: LearnerMap;
  initialToppedOut: string[];
  initialSnapshot: PlacementSnapshot | null;
  onProgress: (session: QuizSession) => void;
  onStop: (session: QuizSession) => void;
  onRunning: (running: boolean) => void;
  onPractice: (skillId: string) => void;
};

export function PlacementQuiz({
  initialMap,
  initialToppedOut,
  initialSnapshot,
  onProgress,
  onStop,
  onRunning,
  onPractice,
}: PlacementProps) {
  const [started, setStarted] = useState(initialSnapshot != null);
  const [session, setSession] = useState<QuizSession | null>(() =>
    initialSnapshot ? restoreQuiz(initialSnapshot, skills, strands) : null,
  );
  const minutes = placementMinutes(strands.length, skills.length);

  useEffect(() => {
    if (initialSnapshot) {
      onRunning(true);
    }
  }, [initialSnapshot, onRunning]);

  function publish(next: QuizSession) {
    setSession(next);
    onProgress(next);
    if (next.phase === "done") {
      onRunning(false);
    }
  }

  if (!started || !session) {
    return (
      <section className="screen">
        <header className="screen-head">
          <h1>Placement</h1>
          <p>One sitting across every strand. A few questions find the level of each skill.</p>
          <p>About {minutes} {minutes === 1 ? "minute" : "minutes"}.</p>
        </header>
        <button
          type="button"
          className="primary"
          onPointerUp={() => {
            const next = createQuizSession({
              skills,
              strands,
              map: initialMap,
              toppedOut: initialToppedOut,
              seed: Math.floor(Math.random() * 1_000_000_000) + 1,
            });
            setSession(next);
            setStarted(true);
            onRunning(true);
            onProgress(next);
          }}
        >
          Start
        </button>
      </section>
    );
  }

  if (session.phase === "done" || !session.problem) {
    return (
      <LearnerMapScreen map={session.map} toppedOut={session.toppedOut} onPractice={onPractice} />
    );
  }

  const skill = skills.find((item) => item.id === session.skillId);
  const strand = strands.find((item) => item.id === skill?.strand);

  return (
    <section className="screen">
      <header className="screen-head">
        <h1>Placement</h1>
        <p className="progress">
          Question {session.questionNumber} · {strand?.name ?? "Strand"} · Level {session.level} of 5 · About{" "}
          {questionsRemaining(skills, session.map, session.probe)}{" "}
          {questionsRemaining(skills, session.map, session.probe) === 1 ? "question" : "questions"} left
        </p>
        {skill ? <p>{skill.name}</p> : null}
      </header>
      <div className="work">
        <ProblemView problem={session.problem} />
        {session.phase === "answering" ? (
          <AnswerPanel
            key={`${session.skillId}-${session.level}-${session.questionNumber}`}
            problem={session.problem}
            locked={false}
            onSubmit={(answer) => {
              publish(gradeAnswer(session, answer));
            }}
            onSkip={() => {
              publish(skipQuestion(session));
            }}
          />
        ) : (
          <div className="feedback">
            <p>{session.correct ? "Correct." : `Not yet. The answer is ${session.problem.answer}.`}</p>
            <button type="button" className="primary" onPointerUp={() => publish(continueQuiz(session))}>
              Next
            </button>
          </div>
        )}
        <button type="button" className="choice skip" onPointerUp={() => onStop(session)}>
          Stop for now
        </button>
      </div>
    </section>
  );
}

type PracticeProps = {
  skillId: string;
  level: number;
  onAnswer: (skillId: string, level: number, correct: boolean) => void;
  onClose: () => void;
};

export function PracticeQuiz({ skillId, level, onAnswer, onClose }: PracticeProps) {
  const skill = skills.find((item) => item.id === skillId);
  const asked = Math.min(5, Math.max(1, level));
  const rng = useRef(createRng(Math.floor(Math.random() * 1_000_000_000) + 1));
  const [problem] = useState(() => (skill ? generateProblem(skill, rng.current, asked) : null));
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
        <p>
          {skill.description} Level {asked} of 5.
        </p>
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
              onAnswer(skill.id, asked, matched);
            }}
            onSkip={onClose}
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

export { practiceLevel };
