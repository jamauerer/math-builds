import { useMemo, useState } from "react";
import { skills, strands } from "./data/load-skills";
import {
  createLearnerMap,
  noteCeilings,
  practiceLevel,
  recordLevelPass,
} from "./engine/placement";
import { blankKitProfile, blankWorkshop, browserProgressStore, type SavedProgress } from "./storage/progress";
import { blankSequence } from "./sequence/logic";
import { GoatKit } from "./machines/bridge/kit/GoatKit";
import { defaultUnitSystem, setUnitSystem, type UnitSystem } from "./units";
import { PracticeQuiz } from "./ui/PlacementQuiz";
import { Workshop } from "./workshop/Workshop";

function seekMetre(value: string | null): number | null {
  if (value == null || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function kitFault(value: string | null): "top" | "post" | "bottom" | null {
  if (value === "top" || value === "post" || value === "bottom") {
    return value;
  }
  return null;
}

function kitUnits(value: string | null, saved: UnitSystem | undefined): UnitSystem {
  if (value === "us" || value === "metric") {
    return value;
  }
  return saved ?? defaultUnitSystem();
}

function kitLevel(value: string | null): number | null {
  if (value == null || value === "") {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 13) {
    return null;
  }
  return parsed;
}

function kitStage(value: string | null): "pick" | "earn" | "assemble" | "drive" | "wreck" | "live" | "grade" | "place" | "place2" | "explain" | "practice" | "profile" | "faster" | "intro" | "where" {
  if (
    value === "earn" ||
    value === "assemble" ||
    value === "drive" ||
    value === "wreck" ||
    value === "live" ||
    value === "grade" ||
    value === "place" ||
    value === "place2" ||
    value === "explain" ||
    value === "practice" ||
    value === "profile" ||
    value === "faster" ||
    value === "intro" ||
    value === "where"
  ) {
    return value;
  }
  return "pick";
}

function kitRound(value: string | null): number | null {
  const round = Number(value);
  return round === 1 || round === 2 || round === 3 ? round : null;
}

function kitDrops(value: string | null): Record<string, string> {
  const lengths: Record<string, string> = {};
  if (!value) {
    return lengths;
  }
  for (const part of value.split(",")) {
    const [id, length] = part.split(":");
    if (id && length) {
      lengths[id] = length;
    }
  }
  return lengths;
}

type Screen =
  | { name: "map" }
  | { name: "placement" }
  | { name: "workshop" }
  | { name: "practice"; skillId: string };

export function App() {
  const store = useMemo(() => browserProgressStore(skills), []);
  const [progress, setProgress] = useState<SavedProgress>(() => {
    const loaded = store.load();
    const units = kitUnits(new URLSearchParams(window.location.search).get("units"), loaded?.units);
    setUnitSystem(units);
    return (
      loaded ?? {
        map: createLearnerMap(skills),
        toppedOut: [],
        placement: null,
        history: [],
        age: null,
        ageAsked: false,
        bridgeCompleted: [],
        bridgeEarned: {},
        workshop: blankWorkshop(),
        units,
      }
    );
  });
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
        <GoatKit
          map={progress.map}
          marks={progress.sequence?.marks ?? 0}
          onMarks={(marks) => save({ ...progress, sequence: { ...(progress.sequence ?? blankSequence()), marks } })}
          start={kitStage(new URLSearchParams(window.location.search).get("kit"))}
          seek={seekMetre(new URLSearchParams(window.location.search).get("at"))}
          fault={kitFault(new URLSearchParams(window.location.search).get("fault"))}
          level={kitLevel(new URLSearchParams(window.location.search).get("level"))}
          piece={new URLSearchParams(window.location.search).get("piece")}
          word={new URLSearchParams(window.location.search).get("word") === "1"}
          lesson={new URLSearchParams(window.location.search).get("lesson")}
          unplaced={new URLSearchParams(window.location.search).get("placed") === "0"}
          moment={new URLSearchParams(window.location.search).get("moment")}
          drops={kitDrops(new URLSearchParams(window.location.search).get("drops"))}
          guideMode={new URLSearchParams(window.location.search).get("guide")}
          checkOpen={new URLSearchParams(window.location.search).get("check") === "1"}
          stareNow={new URLSearchParams(window.location.search).get("stare") === "1"}
          pose={new URLSearchParams(window.location.search).get("pose")}
          round={kitRound(new URLSearchParams(window.location.search).get("round"))}
          picture={new URLSearchParams(window.location.search).get("picture")}
          beam={new URLSearchParams(window.location.search).get("beam")}
          heavy={new URLSearchParams(window.location.search).get("heavy") === "1"}
          seedCountry={new URLSearchParams(window.location.search).get("country")}
          focusSlot={new URLSearchParams(window.location.search).get("focus")}
          flyGusset={new URLSearchParams(window.location.search).get("fly")}
          skill={new URLSearchParams(window.location.search).get("skill")}
          skillSeed={kitLevel(new URLSearchParams(window.location.search).get("seed"))}
          units={kitUnits(new URLSearchParams(window.location.search).get("units"), progress.units)}
          onUnits={(units) => {
            setUnitSystem(units);
            save({ ...progress, units });
          }}
          kitProfile={progress.kitProfile ?? blankKitProfile()}
          onKitProfile={(kitProfile) => save({ ...progress, kitProfile })}
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
              units: progress.units,
              kitProfile: progress.kitProfile,
            });
          }}
          onClose={() => setScreen(practiceReturn === "workshop" ? { name: "workshop" } : { name: "map" })}
        />
      ) : null}
    </div>
  );
}
