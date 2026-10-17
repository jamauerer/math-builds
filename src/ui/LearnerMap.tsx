import { skillsInStrand, strands } from "../data/load-skills";
import { CEILING_MESSAGE, type LearnerMap as LearnerMapData } from "../engine/placement";

const STATE_LABEL = {
  unknown: "Unknown",
  shaky: "Shaky",
  solid: "Solid",
  unchecked: "Not checked yet",
} as const;

type Props = {
  map: LearnerMapData;
  toppedOut?: string[];
  onPractice: (skillId: string) => void;
};

export function LearnerMap({ map, toppedOut = [], onPractice }: Props) {
  return (
    <section className="screen">
      <header className="screen-head">
        <h1>Learner map</h1>
        <p>Each strand keeps its own picture of what you know. Tap a skill to practice it.</p>
      </header>
      <div className="legend">
        <span className="skill unchecked">Not checked yet</span>
        <span className="skill unknown">Unknown</span>
        <span className="skill shaky">Shaky</span>
        <span className="skill solid">Solid</span>
      </div>
      <div className="strand-grid">
        {strands.map((strand) => (
          <section key={strand.id} className="strand">
            <h2>{strand.name}</h2>
            {toppedOut.includes(strand.id) ? <p className="ceiling">{CEILING_MESSAGE}</p> : null}
            {skillsInStrand(strand.id).map((skill) => {
              const progress = map[skill.id];
              const state = progress?.state ?? "unknown";
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
    </section>
  );
}
