import { useState } from "react";
import { skills } from "../data/load-skills";
import {
  applySkillCheck,
  candyLevels,
  firstUnmet,
  levelUnlocked,
  makeSkillCheck,
  suggestWorld,
  worldUnlocked,
  worlds,
  type Requirement,
  type WorldId,
} from "../engine/bridge/catalog";
import { emptyScribble, type Scribble } from "../engine/scribble";
import type { LearnerMap } from "../engine/placement";
import type { Problem } from "../engine/types";
import { AnswerPanel } from "./AnswerPanel";
import { LevelFlow } from "./BridgeFlow";
import { ProblemBoard } from "./ProblemBoard";

const AGES = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];

export function AgePrompt({ onAge, onSkip }: { onAge: (age: number) => void; onSkip: () => void }) {
  return (
    <div className="worlds age-gate">
      <h1>How old are you?</h1>
      <p>Optional. This only picks a starting world. You can skip it or change it later.</p>
      <div className="age-choices">
        {AGES.map((age) => (
          <button key={age} type="button" onPointerUp={() => onAge(age)}>
            {age}
          </button>
        ))}
      </div>
      <button type="button" className="check" onPointerUp={onSkip}>
        Skip
      </button>
    </div>
  );
}

type Props = {
  age: number | null;
  map: LearnerMap;
  completed: string[];
  earned: Record<string, Record<string, number>>;
  onAge: (age: number | null) => void;
  onSkillPass: (skillId: string, level: number) => void;
  onPractice: (skillId: string) => void;
  onComplete: (levelId: string) => void;
  onEarn: (levelId: string, partId: string, count: number) => void;
};

export function BridgeBuild({ age, map, completed, earned, onAge, onSkillPass, onPractice, onComplete, onEarn }: Props) {
  const [worldId, setWorldId] = useState<WorldId>(suggestWorld(age, map));
  const [levelId, setLevelId] = useState<string | null>(null);
  const [agesOpen, setAgesOpen] = useState(false);
  const [gate, setGate] = useState<Requirement | null>(null);
  const [notice, setNotice] = useState("");
  const level = levelId ? candyLevels.find((item) => item.id === levelId) ?? null : null;

  if (!level) {
    return (
      <WorldPicker
        age={age}
        map={map}
        worldId={worldId}
        completed={completed}
        agesOpen={agesOpen}
        gate={gate}
        notice={notice}
        onWorld={setWorldId}
        onOpenAges={() => setAgesOpen((open) => !open)}
        onAge={(next) => {
          onAge(next);
          setWorldId(suggestWorld(next, map));
          setAgesOpen(false);
        }}
        onClearAge={() => {
          onAge(null);
          setWorldId(suggestWorld(null, map));
          setAgesOpen(false);
        }}
        onGate={setGate}
        onPractice={onPractice}
        onSkillPass={onSkillPass}
        onPlay={(id) => {
          setGate(null);
          setNotice("");
          setLevelId(id);
        }}
        onNotice={setNotice}
      />
    );
  }

  return (
    <LevelFlow
      key={level.id}
      level={level}
      map={map}
      earned={earned[level.id] ?? {}}
      onBack={() => setLevelId(null)}
      onNext={() => {
        const next = candyLevels.find((item) => item.world === level.world && item.number === level.number + 1);
        if (next && next.playable && levelUnlocked(next, map)) {
          setLevelId(next.id);
          return;
        }
        setLevelId(null);
      }}
      onPractice={onPractice}
      onComplete={onComplete}
      onEarn={(partId, count) => onEarn(level.id, partId, count)}
    />
  );
}

function WorldPicker({
  age,
  map,
  worldId,
  completed,
  agesOpen,
  gate,
  notice,
  onWorld,
  onOpenAges,
  onAge,
  onClearAge,
  onGate,
  onPractice,
  onSkillPass,
  onPlay,
  onNotice,
}: {
  age: number | null;
  map: LearnerMap;
  worldId: WorldId;
  completed: string[];
  agesOpen: boolean;
  gate: Requirement | null;
  notice: string;
  onWorld: (id: WorldId) => void;
  onOpenAges: () => void;
  onAge: (age: number) => void;
  onClearAge: () => void;
  onGate: (requirement: Requirement | null) => void;
  onPractice: (skillId: string) => void;
  onSkillPass: (skillId: string, level: number) => void;
  onPlay: (id: string) => void;
  onNotice: (text: string) => void;
}) {
  return (
    <div className="worlds">
      <header className="worlds-bar">
        <div className="brand">
          <Logo />
          <div className="brand-name">Math Builds</div>
        </div>
        <div className="worlds-tools">
          <div className="star-count">
            <Star />
            <span>{completed.length}</span>
          </div>
          <button type="button" className="age-chip" onPointerUp={onOpenAges}>
            <span>{age ?? "?"}</span>
            {age == null ? "Set age" : `Age ${age}`}
          </button>
        </div>
      </header>
      {agesOpen ? (
        <div className="age-settings">
          <p>How old are you? This only changes the suggested world.</p>
          <div className="age-choices">
            {AGES.map((choice) => (
              <button key={choice} type="button" onPointerUp={() => onAge(choice)}>
                {choice}
              </button>
            ))}
          </div>
          <button type="button" className="back" onPointerUp={onClearAge}>
            Clear age
          </button>
        </div>
      ) : null}
      {notice ? <p className="hint">{notice}</p> : null}
      {gate ? (
        <SkillGate
          requirement={gate}
          map={map}
          onPractice={onPractice}
          onPass={onSkillPass}
          onClose={() => onGate(null)}
        />
      ) : null}
      <div className="worlds-intro">
        <h1>Pick a world to build in.</h1>
        <p>Every level is a real problem. Do the math, earn blocks, build it, test it.</p>
      </div>
      <div className="world-grid">
        {worlds.map((world) => (
          <WorldCard
            key={world.id}
            worldId={world.id}
            selected={world.id === worldId}
            completed={completed}
          map={map}
          onSelect={() => onWorld(world.id)}
          onPlay={onPlay}
          onGate={onGate}
          onNotice={onNotice}
        />
        ))}
      </div>
    </div>
  );
}

function WorldCard({
  worldId,
  selected,
  completed,
  map,
  onSelect,
  onPlay,
  onGate,
  onNotice,
}: {
  worldId: WorldId;
  selected: boolean;
  completed: string[];
  map: LearnerMap;
  onSelect: () => void;
  onPlay: (id: string) => void;
  onGate: (requirement: Requirement) => void;
  onNotice: (text: string) => void;
}) {
  const world = worlds.find((item) => item.id === worldId);
  if (!world) {
    return null;
  }
  const worldOpen = worldUnlocked(world, map);
  const worldNeed = firstUnmet(world.requires, map);
  const current = candyLevels.find(
    (level) => level.world === worldId && level.playable && levelUnlocked(level, map) && !completed.includes(level.id),
  );
  return (
    <section className={`world-card ${worldId} ${selected ? "selected" : ""}`}>
      <WorldArt worldId={worldId} />
      <div className="world-copy">
        <div className="world-title">
          <h2>{world.name}</h2>
          <span className={`age-badge ${worldId}`}>{world.ability}</span>
        </div>
        <p>{world.blurb}</p>
        <div className="level-tiles">
          {Array.from({ length: 6 }, (_, index) => {
            const number = index + 1;
            const level = candyLevels.find((item) => item.world === worldId && item.number === number);
            const open = level != null && levelUnlocked(level, map);
            const done = level ? completed.includes(level.id) : false;
            const isCurrent = level != null && current?.id === level.id;
            const state = done ? "done" : isCurrent ? "current" : open && level?.playable ? "open" : "locked";
            const need = level ? firstUnmet([...world.requires, ...level.requires], map) : worldNeed;
            return (
              <button
                key={number}
                type="button"
                className={`level-tile ${state}`}
                aria-label={`Level ${number}, ${state}`}
                onPointerUp={() => {
                  onSelect();
                  if (level && open && level.playable) {
                    onPlay(level.id);
                    return;
                  }
                  if (need) {
                    onGate(need);
                    return;
                  }
                  onNotice(`${level?.title ?? world.name} is open. The build for it comes later.`);
                }}
              >
                {number}
              </button>
            );
          })}
        </div>
        {current ? (
          <button type="button" className="continue" onPointerUp={() => onPlay(current.id)}>
            Continue: Level {current.number}
          </button>
        ) : worldNeed ? (
          <button type="button" className="continue" onPointerUp={() => onGate(worldNeed)}>
            See what opens this
          </button>
        ) : (
          <button type="button" className="continue" onPointerUp={() => onSelect()}>
            {worldOpen ? "Skills are ready" : "Look at the levels"}
          </button>
        )}
      </div>
    </section>
  );
}

function SkillGate({
  requirement,
  map,
  onPractice,
  onPass,
  onClose,
}: {
  requirement: Requirement;
  map: LearnerMap;
  onPractice: (skillId: string) => void;
  onPass: (skillId: string, level: number) => void;
  onClose: () => void;
}) {
  const name = skills.find((item) => item.id === requirement.skillId)?.name ?? requirement.skillId;
  const [problems, setProblems] = useState<Problem[] | null>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [scribble, setScribble] = useState<Scribble>(emptyScribble());
  const [note, setNote] = useState("");
  const problem = problems?.[index];

  return (
    <section className="skill-gate">
      <h2>Opens with {name}, level {requirement.level}</h2>
      {problem ? (
        <div className="work-panel">
          <p className="ask">{problem.prompt}</p>
          <ProblemBoard problem={problem} scribble={scribble} onScribble={setScribble} />
          <AnswerPanel
            key={problem.prompt}
            problem={problem}
            locked={false}
            onSubmit={(given) => {
              const next = [...answers, given];
              if (index + 1 < (problems?.length ?? 0)) {
                setAnswers(next);
                setIndex(index + 1);
                setScribble(emptyScribble());
                return;
              }
              const passed = applySkillCheck(map, requirement.skillId, requirement.level, problems ?? [], next) !== map;
              if (passed) {
                onPass(requirement.skillId, requirement.level);
                setNote("That opens it.");
                setProblems(null);
                return;
              }
              setNote("Not yet. Practice, then try the check again.");
              setProblems(null);
              setAnswers([]);
              setIndex(0);
            }}
            onSkip={() => setNote("Answer the question to finish the check.")}
          />
        </div>
      ) : (
        <div className="gate-actions">
          <button type="button" className="practice-link" onPointerUp={() => onPractice(requirement.skillId)}>
            Practice
          </button>
          <button
            type="button"
            className="check"
            onPointerUp={() => {
              const found = skills.find((item) => item.id === requirement.skillId);
              if (!found) {
                return;
              }
              setProblems(makeSkillCheck(found, requirement.level, Date.now() % 100000));
              setIndex(0);
              setAnswers([]);
              setScribble(emptyScribble());
              setNote("");
            }}
          >
            Test me on this
          </button>
          <button type="button" className="back" onPointerUp={onClose}>
            Back
          </button>
        </div>
      )}
      {note ? <p className="hint">{note}</p> : null}
    </section>
  );
}

function Logo() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="4" fill="#FF8FB8" />
      <rect x="26" y="2" width="20" height="20" rx="4" fill="#7FD6C2" />
      <rect x="2" y="26" width="20" height="20" rx="4" fill="#FFD23F" />
      <rect x="26" y="26" width="20" height="20" rx="4" fill="#FF7A1A" />
    </svg>
  );
}

function Star() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z" fill="#FFD23F" />
    </svg>
  );
}

function WorldArt({ worldId }: { worldId: WorldId }) {
  if (worldId === "wood") {
    return (
      <svg viewBox="0 0 400 220" className="world-art" role="img" aria-label="Wood world with a plank bridge">
        <rect width="400" height="220" fill="#8FD0F0" />
        <rect y="150" width="400" height="70" fill="#2E7FB8" />
        <rect x="0" y="100" width="110" height="120" fill="#7A5236" />
        <rect x="290" y="100" width="110" height="120" fill="#7A5236" />
        <rect x="0" y="100" width="110" height="12" fill="#5DAA3C" />
        <rect x="290" y="100" width="110" height="12" fill="#5DAA3C" />
        <rect x="90" y="84" width="220" height="16" fill="#C98F52" />
      </svg>
    );
  }
  if (worldId === "steel") {
    return (
      <svg viewBox="0 0 400 220" className="world-art" role="img" aria-label="Steel world with a truss bridge">
        <rect width="400" height="220" fill="#5B6A8C" />
        <rect y="160" width="400" height="60" fill="#1F4F7A" />
        <rect x="0" y="104" width="100" height="116" fill="#3B3F4C" />
        <rect x="300" y="104" width="100" height="116" fill="#3B3F4C" />
        <rect x="80" y="92" width="240" height="12" fill="#C8CFDF" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 400 220" className="world-art" role="img" aria-label="Candy world with chocolate cliffs">
      <rect width="400" height="220" fill="#FF8FB8" />
      <rect y="150" width="400" height="70" fill="#2E9BD6" />
      <rect x="0" y="100" width="120" height="120" fill="#6F4529" />
      <rect x="280" y="100" width="120" height="120" fill="#6F4529" />
      <rect x="0" y="100" width="120" height="8" fill="#FFD6E8" />
      <rect x="280" y="100" width="120" height="8" fill="#FFD6E8" />
      <rect x="90" y="76" width="220" height="24" fill="#94603A" />
      <rect x="170" y="100" width="24" height="52" fill="#E8344E" />
      <rect x="226" y="100" width="24" height="52" fill="#E8344E" />
    </svg>
  );
}
