import { skillsInStrand, strands } from "../data/load-skills";
import { responseConflicts } from "../engine/answers";
import { CEILING_MESSAGE, type AttemptRecord, type LearnerMap as LearnerMapData } from "../engine/placement";

const STATE_LABEL = {
  "not-started": "Not started",
  learning: "Learning",
  solid: "Solid",
  mastered: "Mastered",
  unchecked: "Not checked yet",
} as const;

const VERDICT_LABEL = {
  right: "Right",
  wrong: "Wrong",
  skip: "I don't know yet",
} as const;

type Props = {
  map: LearnerMapData;
  toppedOut?: string[];
  history?: AttemptRecord[];
  onPractice: (skillId: string) => void;
};

export function LearnerMap({ map, toppedOut = [], history = [], onPractice }: Props) {
  return (
    <section className="screen">
      <header className="screen-head">
        <h1>Learner map</h1>
        <p>Each strand keeps its own picture of what you know. Tap a skill to practice it.</p>
      </header>
      <div className="legend">
        <span className="skill unchecked">Not checked yet</span>
        <span className="skill not-started">Not started</span>
        <span className="skill learning">Learning</span>
        <span className="skill solid">Solid</span>
        <span className="skill mastered">Mastered ★</span>
      </div>
      <div className="strand-grid">
        {strands.map((strand) => (
          <section key={strand.id} className="strand">
            <h2>{strand.name}</h2>
            {toppedOut.includes(strand.id) ? <p className="ceiling">{CEILING_MESSAGE}</p> : null}
            {skillsInStrand(strand.id).map((skill) => {
              const progress = map[skill.id];
              const state = progress?.state ?? "unchecked";
              const level = progress?.level ?? 0;
              return (
                <button
                  key={skill.id}
                  type="button"
                  className={`skill ${state}`}
                  onPointerUp={() => onPractice(skill.id)}
                >
                  <span className="skill-name">{skill.name}</span>
                  <span className="skill-meta">
                    {state === "unchecked"
                      ? `${skill.gradeBand} · Not checked yet`
                      : `${skill.gradeBand} · ${STATE_LABEL[state]} · ${level} of 5`}
                  </span>
                </button>
              );
            })}
          </section>
        ))}
      </div>
      <details className="what-happened">
        <summary>What happened</summary>
        {history.length === 0 ? (
          <p>No questions yet in this sitting.</p>
        ) : (
          <ol>
            {history.map((item, index) => {
              const conflict = responseConflicts(item.verdict, item.given, item.answer);
              return (
                <li key={`${item.skillId}-${index}`}>
                  <p>
                    {item.skillName} · Level {item.level}
                  </p>
                  <p>{item.prompt}</p>
                  <p>{item.verdict === "skip" ? "I don't know yet" : `Answered: ${item.given}`}</p>
                  <p>Correct answer: {item.answer}</p>
                  <p>{VERDICT_LABEL[item.verdict]}</p>
                  {item.scribble ? <img src={item.scribble} alt="" /> : null}
                  {conflict ? (
                    <p className="check-warning">
                      Warning: this was marked wrong, but it matches the correct answer.
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}
      </details>
    </section>
  );
}
