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
import { AgePrompt, BridgeBuild } from "./ui/BridgeBuild";

type Screen =
  | { name: "map" }
  | { name: "placement" }
  | { name: "bridge" }
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
      },
  );
  const [screen, setScreen] = useState<Screen>({ name: "map" });
  const [placementRunning, setPlacementRunning] = useState(false);
  const [practiceReturn, setPracticeReturn] = useState<"map" | "bridge">("map");

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
    });
  }

  function openPractice(skillId: string, returnTo: "map" | "bridge" = "map") {
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
      {placementRunning ? null : (
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
          <button type="button" className="nav-button" onPointerUp={() => setScreen({ name: "bridge" })}>
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
      {screen.name === "bridge" ? (
        <BridgeBuild
          age={progress.age}
          map={progress.map}
          completed={progress.bridgeCompleted}
          earned={progress.bridgeEarned}
          onAge={chooseAge}
          onSkillPass={raiseSkill}
          onPractice={(skillId) => openPractice(skillId, "bridge")}
          onComplete={(levelId) => {
            if (progress.bridgeCompleted.includes(levelId)) {
              return;
            }
            save({ ...progress, bridgeCompleted: [...progress.bridgeCompleted, levelId] });
          }}
          onEarn={(levelId, partId, count) => {
            const current = progress.bridgeEarned[levelId] ?? {};
            save({
              ...progress,
              bridgeEarned: {
                ...progress.bridgeEarned,
                [levelId]: { ...current, [partId]: Math.max(current[partId] ?? 0, count) },
              },
            });
          }}
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
            });
          }}
          onClose={() => setScreen(practiceReturn === "bridge" ? { name: "bridge" } : { name: "map" })}
        />
      ) : null}
    </div>
  );
}
