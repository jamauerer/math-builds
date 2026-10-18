import { useMemo, useState } from "react";
import { skills, strands } from "./data/load-skills";
import {
  createLearnerMap,
  noteCeilings,
  practiceLevel,
  recordLevelPass,
  snapshotQuiz,
  type QuizSession,
} from "./engine/placement";
import { browserProgressStore, type SavedProgress } from "./storage/progress";
import { LearnerMap as LearnerMapScreen } from "./ui/LearnerMap";
import { PlacementQuiz, PracticeQuiz } from "./ui/PlacementQuiz";
import { AgePrompt } from "./ui/BridgeBuild";
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
        workshop: { completed: [], mastery: {}, sandbox: [], theme: "draft" },
      },
  );
  const [screen, setScreen] = useState<Screen>(() =>
    new URLSearchParams(window.location.search).get("challenge") ? { name: "workshop" } : { name: "map" },
  );
  const [placementRunning, setPlacementRunning] = useState(false);
  const [practiceReturn, setPracticeReturn] = useState<"map" | "workshop">("map");

  function save(next: SavedProgress) {
    setProgress(next);
    store.save(next);
  }

  function saveSession(session: QuizSession, keepPlacement: boolean) {
    save({
      map: session.map,
      toppedOut: session.toppedOut,
      placement: keepPlacement && session.phase !== "done" ? snapshotQuiz(session) : null,
      history: session.history,
      age: progress.age,
      ageAsked: progress.ageAsked,
      bridgeCompleted: progress.bridgeCompleted,
      bridgeEarned: progress.bridgeEarned,
      workshop: progress.workshop,
    });
  }

  function openPractice(skillId: string, returnTo: "map" | "workshop" = "map") {
    setPracticeReturn(returnTo);
    setPlacementRunning(false);
    setScreen({ name: "practice", skillId });
  }

  function chooseAge(age: number | null) {
    save({ ...progress, age, ageAsked: true });
  }

  function raiseSkill(skillId: string, level: number) {
    const map = recordLevelPass(progress.map, skillId, level);
    const toppedOut = noteCeilings(strands, map, progress.toppedOut);
    save({ ...progress, map, toppedOut });
  }

  if (!progress.ageAsked) {
    return (
      <div className="app">
        <AgePrompt onAge={chooseAge} onSkip={() => chooseAge(null)} />
      </div>
    );
  }

  return (
    <div className="app">
      {placementRunning || screen.name === "workshop" ? null : (
        <nav className="nav">
          <button type="button" className="nav-button" onPointerUp={() => setScreen({ name: "map" })}>
            Map
          </button>
          <button
            type="button"
            className="nav-button"
            onPointerUp={() => {
              setScreen({ name: "placement" });
              if (progress.placement) {
                setPlacementRunning(true);
              }
            }}
          >
            Placement
          </button>
          <button type="button" className="nav-button" onPointerUp={() => setScreen({ name: "workshop" })}>
            Worlds
          </button>
        </nav>
      )}
      {screen.name === "map" ? (
        <LearnerMapScreen
          map={progress.map}
          toppedOut={progress.toppedOut}
          history={progress.history}
          onPractice={openPractice}
        />
      ) : null}
      {screen.name === "placement" ? (
        <PlacementQuiz
          key="placement"
          initialMap={progress.map}
          initialToppedOut={progress.toppedOut}
          initialSnapshot={progress.placement}
          onProgress={(session) => saveSession(session, true)}
          onStop={(session) => {
            saveSession(session, true);
            setPlacementRunning(false);
            setScreen({ name: "map" });
          }}
          onRunning={setPlacementRunning}
          onPractice={openPractice}
        />
      ) : null}
      {screen.name === "workshop" ? (
        <Workshop
          map={progress.map}
          progress={progress}
          onProgress={save}
          onSkillPass={raiseSkill}
          onPractice={(skillId) => openPractice(skillId, "workshop")}
        />
      ) : null}
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
