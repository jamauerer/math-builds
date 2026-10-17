import { skillsInStrand, strands } from "../data/load-skills";
import type { LearnerMap } from "../engine/placement";

const STATE_LABEL = {
  unknown: "Unknown",
  shaky: "Shaky",
  solid: "Solid",
} as const;

type Props = {
  map: LearnerMap;
  onPractice: (skillId: string) => void;
};

export function LearnerMap({ map, onPractice }: Props) {
  return (
    <section className="screen">
      <header className="screen-head">
        <h1>Learner map</h1>
        <p>Each strand keeps its own picture of what you know. Tap a skill to practice it.</p>
      </header>
      <div className="legend">
        <span className="skill unknown">Unknown</span>
        <span className="skill shaky">Shaky</span>
        <span className="skill solid">Solid</span>
      </div>
      <div className="strand-grid">
        {strands.map((strand) => (
          <section key={strand.id} className="strand">
            <h2>{strand.name}</h2>
            {skillsInStrand(strand.id).map((skill) => {
              const state = map[skill.id]?.state ?? "unknown";
              return (
                <button
                  key={skill.id}
                  type="button"
                  className={`skill ${state}`}
                  onPointerUp={() => onPractice(skill.id)}
                >
                  <span className="skill-name">{skill.name}</span>
                  <span className="skill-meta">
                    {skill.gradeBand} · {STATE_LABEL[state]}
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
