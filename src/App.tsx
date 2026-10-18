import { useMemo, useState } from "react";
import { skills, strands } from "./data/load-skills";
import {
  createLearnerMap,
  noteCeilings,
  practiceLevel,
  recordLevelPass,
} from "./engine/placement";
import { blankWorkshop, browserProgressStore, type SavedProgress } from "./storage/progress";
import { blankSequence } from "./sequence/logic";
import { BridgeApp } from "./sequence/BridgeApp";
import { PracticeQuiz } from "./ui/PlacementQuiz";
import { Workshop } from "./workshop/Workshop";

type Screen =
  | { name: "map" }
  | { name: "placement" }
  | { name: "workshop" }
  | { name: "practice"; skillId: string };

export function App() {
  const store = useMemo(() => browserProgressStore(skills), []);
  const [progress, setProgress] = useState<SavedProgress>(
    () =>
      store.load() ?? {
        map: createLearnerMap(skills),
        toppedOut: [],
        placement: null,
        history: [],
        age: null,
        ageAsked: false,
        bridgeCompleted: [],
        bridgeEarned: {},
        workshop: blankWorkshop(),
      },
  );
  const [screen, setScreen] = useState<Screen>(() =>
    new URLSearchParams(window.location.search).get("challenge") ? { name: "workshop" } : { name: "map" },
  );
  const [practiceReturn, setPracticeReturn] = useState<"map" | "workshop">("map");

  function save(next: SavedProgress) {
    setProgress(next);
    store.save(next);
  }

  function openPractice(skillId: string, returnTo: "map" | "workshop" = "map") {
    setPracticeReturn(returnTo);
    setScreen({ name: "practice", skillId });
  }

  function raiseSkill(skillId: string, level: number) {
    const map = recordLevelPass(progress.map, skillId, level);
    const toppedOut = noteCeilings(strands, map, progress.toppedOut);
    save({ ...progress, map, toppedOut });
  }

  return (
    <div className="app">
      {screen.name === "workshop" ? (
        <Workshop
          map={progress.map}
          progress={progress}
          onProgress={save}
          onSkillPass={raiseSkill}
          onPractice={(skillId) => openPractice(skillId, "workshop")}
        />
      ) : (
        <BridgeApp
          map={progress.map}
          sequence={progress.sequence ?? blankSequence()}
          onSequence={(sequence) => save({ ...progress, sequence })}
          onSkillPass={raiseSkill}
        />
      )}
      {screen.name === "practice" ? (
        <PracticeQuiz
          key={screen.skillId}
          skillId={screen.skillId}
          level={practiceLevel(progress.map[screen.skillId])}
          onAnswer={(skillId, level, correct) => {
            if (!correct) {
              return;
            }
            const map = recordLevelPass(progress.map, skillId, level);
            const toppedOut = noteCeilings(strands, map, progress.toppedOut);
            save({
              map,
              toppedOut,
              placement: progress.placement,
              history: progress.history,
              age: progress.age,
              ageAsked: progress.ageAsked,
              bridgeCompleted: progress.bridgeCompleted,
              bridgeEarned: progress.bridgeEarned,
              workshop: progress.workshop,
            });
          }}
          onClose={() => setScreen(practiceReturn === "workshop" ? { name: "workshop" } : { name: "map" })}
        />
      ) : null}
    </div>
  );
}
