import { useEffect, useRef, useState } from "react";
import { skills } from "../data/load-skills";
import {
  applySkillCheck,
  bridgeParts,
  buildModes,
  candyLevels,
  firstUnmet,
  gradeQuestion,
  levelUnlocked,
  makeSkillCheck,
  measureAnswer,
  modeUnlocked,
  partById,
  partUnlocked,
  questionProblem,
  spanReadout,
  suggestWorld,
  unlockSkillName,
  worldUnlocked,
  worlds,
  type BuildMode,
  type CandyLevel,
  type Requirement,
  type WorldId,
} from "../engine/bridge/catalog";
import {
  createBlockSimulation,
  type BlockBridge,
  type BridgeSnapshot,
  type DrawBody,
} from "../engine/bridge/simulate";
import { emptyScribble, type Scribble } from "../engine/scribble";
import type { LearnerMap } from "../engine/placement";
import type { Problem } from "../engine/types";
import { AnswerPanel } from "./AnswerPanel";
import { ProblemBoard } from "./ProblemBoard";

type Step = "measure" | "earn" | "build" | "drive";
type Placed = { col: number; row: 0 | 1; partId: string };
type ThemeId = "candy" | "wood" | "steel";

const STEPS: { id: Step; label: string }[] = [
  { id: "measure", label: "Measure" },
  { id: "earn", label: "Earn parts" },
  { id: "build", label: "Build" },
  { id: "drive", label: "Drive" },
];

const THEME_FILL: Record<ThemeId, Record<string, string>> = {
  candy: {
    cliff: "#6F4529",
    grass: "#FFD6E8",
    water: "#2E9BD6",
    sky: "#3A2470",
    chocolate: "#94603A",
    cane: "#E8344E",
    gummy: "#7FD6C2",
    wafer: "#E8B36B",
    pretzel: "#C47A3A",
    marshmallow: "#FFF6EA",
    car: "#FF7A1A",
  },
  wood: {
    cliff: "#7A5236",
    grass: "#5DAA3C",
    water: "#2E7FB8",
    sky: "#8FD0F0",
    chocolate: "#C98F52",
    cane: "#8A5E30",
    gummy: "#D7B07A",
    wafer: "#E6C48A",
    pretzel: "#A56B3C",
    marshmallow: "#F3E6D0",
    car: "#FF7A1A",
  },
  steel: {
    cliff: "#3B3F4C",
    grass: "#8F97AA",
    water: "#1F4F7A",
    sky: "#5B6A8C",
    chocolate: "#C8CFDF",
    cane: "#FF7A1A",
    gummy: "#9AA3B5",
    wafer: "#D7DCE6",
    pretzel: "#6E7688",
    marshmallow: "#EEF2F8",
    car: "#FF7A1A",
  },
};

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
      level={level}
      map={map}
      earned={earned[level.id] ?? {}}
      onBack={() => setLevelId(null)}
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

function LevelFlow({
  level,
  map,
  earned,
  onBack,
  onPractice,
  onComplete,
  onEarn,
}: {
  level: CandyLevel;
  map: LearnerMap;
  earned: Record<string, number>;
  onBack: () => void;
  onPractice: (skillId: string) => void;
  onComplete: (levelId: string) => void;
  onEarn: (partId: string, count: number) => void;
}) {
  const [step, setStep] = useState<Step>("measure");
  const [measured, setMeasured] = useState(false);
  const [theme, setTheme] = useState<ThemeId>("candy");
  const [placed, setPlaced] = useState<Placed[]>([]);
  const [selected, setSelected] = useState("chocolate");
  const [driveKey, setDriveKey] = useState(0);
  const [mode, setMode] = useState<BuildMode>("count");
  const [modeGate, setModeGate] = useState<Requirement | null>(null);
  const ready = level.questions.every((question) => (earned[question.partId] ?? 0) >= question.count);

  function go(next: Step) {
    if ((next === "earn" || next === "build" || next === "drive") && !measured) {
      setStep("measure");
      return;
    }
    if ((next === "build" || next === "drive") && !ready) {
      setStep("earn");
      return;
    }
    setStep(next);
  }

  return (
    <div className={`level-flow ${step === "build" || step === "drive" ? "build-theme" : "measure-theme"}`}>
      <header className="level-bar">
        <button type="button" className="back" onPointerUp={onBack}>
          Worlds
        </button>
        <div className="step-bar">
          {STEPS.map((item, index) => (
            <button
              key={item.id}
              type="button"
              className={step === item.id ? "step on" : "step"}
              onPointerUp={() => go(item.id)}
            >
              {index + 1} {item.label}
            </button>
          ))}
        </div>
        <div className="theme-switch" aria-label="Build mode">
          {buildModes.map((item) => {
            const open = modeUnlocked(item.id, map);
            const need = firstUnmet(item.requires, map);
            return (
              <button
                key={item.id}
                type="button"
                className={mode === item.id ? "on" : ""}
                onPointerUp={() => {
                  if (open) {
                    setMode(item.id);
                    setModeGate(null);
                    return;
                  }
                  if (need) {
                    setModeGate(need);
                  }
                }}
              >
                {item.label}
              </button>
            );
          })}
        </div>
        <div className="theme-switch" aria-label="Theme">
          {(["candy", "wood", "steel"] as ThemeId[]).map((item) => (
            <button key={item} type="button" className={theme === item ? "on" : ""} onPointerUp={() => setTheme(item)}>
              {item === "candy" ? "Candy" : item === "wood" ? "Wood" : "Steel"}
            </button>
          ))}
        </div>
      </header>
      {modeGate ? (
        <p className="hint mode-note">
          This build opens with {skills.find((item) => item.id === modeGate.skillId)?.name ?? modeGate.skillId}, level {modeGate.level}.
          <button type="button" className="practice-link" onPointerUp={() => onPractice(modeGate.skillId)}>
            Practice
          </button>
        </p>
      ) : null}
      {step === "measure" ? (
        <MeasureStep level={level} theme={theme} onDone={() => { setMeasured(true); setStep("earn"); }} />
      ) : null}
      {step === "earn" ? (
        <EarnStep
          level={level}
          earned={earned}
          onEarn={onEarn}
          onDone={() => setStep("build")}
        />
      ) : null}
      {step === "build" || step === "drive" ? (
        <BuildStep
          level={level}
          theme={theme}
          map={map}
          earned={earned}
          placed={placed}
          selected={selected}
          mode={mode}
          driving={step === "drive"}
          driveKey={driveKey}
          onSelect={setSelected}
          onPlaced={setPlaced}
          onPractice={onPractice}
          onDrive={() => {
            setDriveKey((value) => value + 1);
            setStep("drive");
          }}
          onBuild={() => setStep("build")}
          onComplete={() => onComplete(level.id)}
        />
      ) : null}
    </div>
  );
}

function MeasureStep({ level, theme, onDone }: { level: CandyLevel; theme: ThemeId; onDone: () => void }) {
  const answer = measureAnswer(level);
  const [marked, setMarked] = useState<boolean[]>(() => Array.from({ length: level.gapBlocks }, () => false));
  const [count, setCount] = useState(0);
  const [hint, setHint] = useState("");
  const colors = THEME_FILL[theme];

  function check(given: number) {
    if (given === answer) {
      onDone();
      return;
    }
    setHint(
      level.measure === "ruler"
        ? `The right cliff is at ${level.rulerRight} and the left cliff is at ${level.rulerLeft}.`
        : "Tap each block in the gap, then check the count.",
    );
  }

  return (
    <div className="measure-layout">
      <section className="measure-scene">
        <h2>{level.measure === "count" ? "Count the blocks. How wide is the gap?" : "Read the ruler. How wide is the gap?"}</h2>
        <div className="scene-frame" style={{ background: colors.sky }}>
          <div className="water" style={{ background: colors.water }} />
          <div className="cliff" style={{ background: colors.cliff }}>
            <div className="grass" style={{ background: colors.grass }} />
          </div>
          <div className="gap-row">
            {marked.map((on, index) => (
              <button
                key={index}
                type="button"
                className={on ? "gap-block filled" : "gap-block"}
                style={on ? { background: colors.chocolate } : undefined}
                aria-label={`Gap block ${index + 1}`}
                onPointerUp={() => {
                  if (level.measure !== "count") {
                    return;
                  }
                  const next = marked.map((value, markIndex) => (markIndex === index ? !value : value));
                  setMarked(next);
                  setCount(next.filter(Boolean).length);
                }}
              >
                {level.measure === "count" ? index + 1 : ""}
              </button>
            ))}
          </div>
          <div className="cliff" style={{ background: colors.cliff }}>
            <div className="grass" style={{ background: colors.grass }} />
          </div>
          {level.measure === "ruler" ? (
            <div className="ruler" aria-hidden="true">
              <span>{level.rulerLeft}</span>
              <span>?</span>
              <span>{level.rulerRight}</span>
            </div>
          ) : null}
        </div>
      </section>
      <aside className="measure-panel">
        {level.measure === "count" ? (
          <>
            <p className="plan-line">The gap is {count} blocks wide</p>
            <div className="stepper">
              <button type="button" aria-label="Fewer" onPointerUp={() => setCount((value) => Math.max(0, value - 1))}>
                -
              </button>
              <strong>{count}</strong>
              <button type="button" aria-label="More" onPointerUp={() => setCount((value) => value + 1)}>
                +
              </button>
            </div>
            <button type="button" className="check" onPointerUp={() => check(count)}>
              Check my answer
            </button>
          </>
        ) : (
          <AnswerPanel
            key="measure"
            problem={{ prompt: "How many meters is the gap?", answer: String(answer) }}
            locked={false}
            onSubmit={(given) => check(Number(given))}
            onSkip={() => setHint("Look at the two numbers on the ruler.")}
          />
        )}
        {hint ? <p className="hint">{hint}</p> : null}
      </aside>
    </div>
  );
}

function EarnStep({
  level,
  earned,
  onEarn,
  onDone,
}: {
  level: CandyLevel;
  earned: Record<string, number>;
  onEarn: (partId: string, count: number) => void;
  onDone: () => void;
}) {
  const firstOpen = level.questions.findIndex((question) => (earned[question.partId] ?? 0) < question.count);
  const [index, setIndex] = useState(firstOpen < 0 ? level.questions.length : firstOpen);
  const [hint, setHint] = useState("");
  const [scribble, setScribble] = useState<Scribble>(emptyScribble());
  const question = level.questions[index];

  useEffect(() => {
    setScribble(emptyScribble());
    setHint("");
  }, [index]);

  if (!question) {
    return (
      <div className="earn-done">
        <h2>Parts earned</h2>
        <p>The hotbar is ready. Build the bridge next.</p>
        <button type="button" className="check" onPointerUp={onDone}>
          Build
        </button>
      </div>
    );
  }

  const problem = questionProblem(question);
  return (
    <div className="earn-layout">
      <aside className="question-list">
        {level.questions.map((item, itemIndex) => {
          const done = (earned[item.partId] ?? 0) >= item.count;
          const state = done ? "done" : itemIndex === index ? "current" : "upcoming";
          return (
            <p key={item.prompt} className={`q-card ${state}`}>
              {item.prompt}
            </p>
          );
        })}
      </aside>
      <section className="work-panel">
        <h2>Work it out</h2>
        <ProblemBoard problem={problem} scribble={scribble} onScribble={setScribble} />
        <AnswerPanel
          key={question.prompt}
          problem={problem}
          locked={false}
          onSubmit={(given) => {
            const result = gradeQuestion(question, given);
            if (!result.correct || result.count <= 0) {
              setHint(result.hint || "Try again.");
              return;
            }
            onEarn(result.partId, result.count);
            setIndex((value) => value + 1);
          }}
          onSkip={() => setHint(question.hint)}
        />
        {hint ? <p className="hint">{hint}</p> : null}
      </section>
    </div>
  );
}

function BuildStep({
  level,
  theme,
  map,
  earned,
  placed,
  selected,
  mode,
  driving,
  driveKey,
  onSelect,
  onPlaced,
  onPractice,
  onDrive,
  onBuild,
  onComplete,
}: {
  level: CandyLevel;
  theme: ThemeId;
  map: LearnerMap;
  earned: Record<string, number>;
  placed: Placed[];
  selected: string;
  mode: BuildMode;
  driving: boolean;
  driveKey: number;
  onSelect: (id: string) => void;
  onPlaced: (next: Placed[]) => void;
  onPractice: (skillId: string) => void;
  onDrive: () => void;
  onBuild: () => void;
  onComplete: () => void;
}) {
  const colors = THEME_FILL[theme];
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [report, setReport] = useState("");

  useEffect(() => {
    if (!driving) {
      return;
    }
    const sim = createBlockSimulation(toBridge(level, placed));
    sim.spawnCar();
    let last = performance.now();
    let frame = 0;
    let raf = 0;
    const tick = (now: number) => {
      const steps = Math.min(90, Math.max(1, Math.round((now - last) / 16.67)));
      last = now;
      for (let index = 0; index < steps; index += 1) {
        sim.step();
      }
      const snap = sim.snapshot();
      paintBridge(canvasRef.current, snap, colors, mode === "free");
      if (sim.status() === "crossed") {
        setReport("The car crossed. This bridge is complete.");
        onComplete();
        return;
      }
      if (sim.status() === "collapsed") {
        setReport(sim.failure()?.text ?? "The bridge fell.");
        return;
      }
      frame += 1;
      if (frame < 500) {
        raf = requestAnimationFrame(tick);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [driving, driveKey]);

  function stock(partId: string) {
    const used = placed.filter((item) => item.partId === partId).length;
    return Math.max(0, (earned[partId] ?? 0) - used);
  }

  function tap(col: number, row: 0 | 1) {
    if (driving) {
      return;
    }
    const existing = placed.find((item) => item.col === col && item.row === row);
    if (existing || selected === "remove") {
      if (existing) {
        onPlaced(placed.filter((item) => item !== existing));
      }
      return;
    }
    const part = partById(selected);
    if (!part || part.role === "ramp" || !partUnlocked(part, map) || stock(part.id) <= 0) {
      return;
    }
    if (row === 0 && part.role !== "deck") {
      return;
    }
    if (row === 1 && part.role !== "pillar") {
      return;
    }
    if (row === 1 && !placed.some((item) => item.col === col && item.row === 0)) {
      return;
    }
    onPlaced([...placed, { col, row, partId: part.id }]);
  }

  return (
    <div className="build-layout">
      <div className="build-stage">
        <p className="mission">Fill the gap, flush with the ground. The car has to roll across.</p>
        {mode === "calculate" ? (
          <p className="plan-line">
            Place {level.questions.find((question) => question.partId === "chocolate")?.count ?? level.gapBlocks} deck blocks
            and {level.questions.find((question) => question.partId === "cane")?.count ?? 0} pillars.
          </p>
        ) : null}
        {mode === "free" ? (
          <p className="plan-line">
            Length {spanReadout(level, placed.filter((item) => item.row === 0).length).length}. Load {spanReadout(level, 0).load}.
            Stress colors show while the car drives.
          </p>
        ) : null}
        {driving ? (
          <canvas ref={canvasRef} className="drive-canvas" width={960} height={420} />
        ) : (
          <div className="builder" style={{ background: `linear-gradient(${colors.sky}, ${colors.sky} 42%, ${colors.water} 42%)` }}>
            <div className="land" style={{ background: colors.cliff }}>
              <div className="grass" style={{ background: colors.grass }} />
            </div>
            <div className="span" style={{ gridTemplateColumns: `repeat(${level.gapBlocks}, 52px)` }}>
              {Array.from({ length: level.gapBlocks }, (_, col) => (
                <div key={col} className="column">
                  <Cell
                    label={`Deck ${col + 1}`}
                    placed={placed.find((item) => item.col === col && item.row === 0)}
                    colors={colors}
                    onTap={() => tap(col, 0)}
                  />
                  <Cell
                    label={`Pillar ${col + 1}`}
                    placed={placed.find((item) => item.col === col && item.row === 1)}
                    colors={colors}
                    tall
                    onTap={() => tap(col, 1)}
                  />
                </div>
              ))}
            </div>
            <div className="land" style={{ background: colors.cliff }}>
              <div className="grass" style={{ background: colors.grass }} />
            </div>
          </div>
        )}
        <p className="gap-label">gap: {level.gapBlocks} blocks</p>
        {report ? <p className={report.includes("complete") ? "drive-ok" : "drive-fail"}>{report}</p> : null}
        <div className="drive-actions">
          {driving ? (
            <button type="button" className="back" onPointerUp={onBuild}>
              Change the build
            </button>
          ) : (
            <button type="button" className="drive" onPointerUp={onDrive}>
              Drive
            </button>
          )}
        </div>
      </div>
      <div className="hotbar">
        {bridgeParts.map((part) => {
          const locked = part.role === "ramp" || !partUnlocked(part, map);
          return (
            <button
              key={part.id}
              type="button"
              className={selected === part.id ? "slot on" : locked ? "slot locked" : "slot"}
              disabled={locked}
              onPointerUp={() => onSelect(part.id)}
            >
              <span className="swatch" style={{ background: colors[part.id] ?? "#ccc" }} />
              <span>{part.name}</span>
              <strong>{locked ? "Locked" : stock(part.id)}</strong>
              {locked ? (
                <small>
                  {part.role === "ramp"
                    ? "A later level"
                    : `${unlockSkillName(part, skills)} level ${part.unlock.level}`}
                </small>
              ) : null}
            </button>
          );
        })}
        <button type="button" className={selected === "remove" ? "slot on" : "slot"} onPointerUp={() => onSelect("remove")}>
          <span>Remove</span>
        </button>
        {bridgeParts
          .filter((part) => part.role === "ramp" || !partUnlocked(part, map))
          .filter((part) => part.role !== "ramp")
          .map((part) => (
            <button key={`${part.id}-practice`} type="button" className="practice-link" onPointerUp={() => onPractice(part.unlock.skillId)}>
              Practice {unlockSkillName(part, skills)}
            </button>
          ))}
      </div>
    </div>
  );
}

function Cell({
  label,
  placed,
  colors,
  tall,
  onTap,
}: {
  label: string;
  placed: Placed | undefined;
  colors: Record<string, string>;
  tall?: boolean;
  onTap: () => void;
}) {
  return (
    <button
      type="button"
      className={tall ? "cell tall" : "cell"}
      aria-label={label}
      style={placed ? { background: colors[placed.partId] ?? "#fff" } : undefined}
      onPointerUp={onTap}
    />
  );
}

function toBridge(level: CandyLevel, placed: Placed[]): BlockBridge {
  return {
    gap: level.gapBlocks,
    carKg: level.carWeight,
    pieces: placed.flatMap((item) => {
      const part = partById(item.partId);
      if (!part) {
        return [];
      }
      return [
        {
          id: `${item.partId}-${item.col}-${item.row}`,
          name: part.name,
          col: item.col,
          role: item.row === 0 ? "deck" as const : "pillar" as const,
          strengthKg: part.strength,
        },
      ];
    }),
  };
}

function paintBridge(
  canvas: HTMLCanvasElement | null,
  snap: BridgeSnapshot,
  colors: Record<string, string>,
  showStress: boolean,
) {
  if (!canvas) {
    return;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }
  const width = canvas.width;
  const height = canvas.height;
  const scale = width / (snap.maxX - snap.minX);
  const xOf = (x: number) => (x - snap.minX) * scale;
  const yOf = (y: number) => height - (y - snap.minY) * scale;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = colors.sky ?? "#3A2470";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = colors.water ?? "#2E9BD6";
  ctx.fillRect(0, yOf(1.2), width, height);
  for (const body of snap.bodies) {
    drawBody(ctx, body, colors, xOf, yOf, scale, showStress);
  }
}

function drawBody(
  ctx: CanvasRenderingContext2D,
  body: DrawBody,
  colors: Record<string, string>,
  xOf: (x: number) => number,
  yOf: (y: number) => number,
  scale: number,
  showStress: boolean,
) {
  const stressed = showStress && body.role === "deck" && body.stress > 0.5 ? (body.stress > 0.85 ? "#b91c1c" : "#f59e0b") : "";
  const fill = stressed ||
    (body.role === "cliff"
      ? colors.cliff
      : body.role === "pillar"
        ? colors.cane
        : body.role === "car"
          ? colors.car
          : body.role === "wheel"
            ? "#1A1033"
            : body.name.toLowerCase().includes("wafer")
              ? colors.wafer
              : body.name.toLowerCase().includes("gummy")
                ? colors.gummy
                : colors.chocolate);
  ctx.save();
  ctx.translate(xOf(body.x), yOf(body.y));
  ctx.rotate(-body.angle);
  ctx.fillStyle = body.broken ? "#7f1d1d" : (fill ?? "#fff");
  if (body.radius > 0) {
    ctx.beginPath();
    ctx.arc(0, 0, body.radius * scale, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillRect(-body.halfWidth * scale, -body.halfHeight * scale, body.halfWidth * 2 * scale, body.halfHeight * 2 * scale);
  }
  ctx.restore();
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
