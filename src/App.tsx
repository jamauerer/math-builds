import { useMemo, useState } from "react";
import { skills } from "./data/load-skills";
import { createLearnerMap, recordAnswer, type LearnerMap } from "./engine/placement";
import { browserProgressStore } from "./storage/progress";
import { LearnerMap as LearnerMapScreen } from "./ui/LearnerMap";
import { PlacementQuiz, PracticeQuiz } from "./ui/PlacementQuiz";

type Screen =
  | { name: "map" }
  | { name: "placement" }
  | { name: "practice"; skillId: string };

export function App() {
  const store = useMemo(() => browserProgressStore(skills), []);
  const [map, setMap] = useState<LearnerMap>(() => store.load() ?? createLearnerMap(skills));
  const [screen, setScreen] = useState<Screen>({ name: "map" });

  function save(next: LearnerMap) {
    setMap(next);
    store.save(next);
  }

  return (
    <div className="app">
      <nav className="nav">
        <button type="button" className="nav-button" onPointerUp={() => setScreen({ name: "map" })}>
          Map
        </button>
        <button type="button" className="nav-button" onPointerUp={() => setScreen({ name: "placement" })}>
          Placement
        </button>
      </nav>
      {screen.name === "map" ? (
        <LearnerMapScreen map={map} onPractice={(skillId) => setScreen({ name: "practice", skillId })} />
      ) : null}
      {screen.name === "placement" ? (
        <PlacementQuiz
          key="placement"
          initialMap={map}
          onMap={save}
          onClose={() => setScreen({ name: "map" })}
        />
      ) : null}
      {screen.name === "practice" ? (
        <PracticeQuiz
          key={screen.skillId}
          skillId={screen.skillId}
          onAnswer={(skillId, correct) => save(recordAnswer(map, skillId, correct))}
          onClose={() => setScreen({ name: "map" })}
        />
      ) : null}
    </div>
  );
}
