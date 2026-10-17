import { useEffect, useRef, useState, type MutableRefObject, type PointerEvent as ReactPointerEvent } from "react";
import { skills } from "../data/load-skills";
import {
  bridgeParts,
  buildModes,
  firstUnmet,
  gradeQuestion,
  measureAnswer,
  modeUnlocked,
  partById,
  partUnlocked,
  questionProblem,
  spanReadout,
  traySupply,
  unlockSkillName,
  type BuildMode,
  type CandyLevel,
} from "../engine/bridge/catalog";
import {
  driveMessage,
  dropPiece,
  nextDrivePhase,
  removePiece,
  stockLeft,
  type DrivePhase,
  type GridSlot,
  type PlacedBlock,
} from "../engine/bridge/place";
import { createBlockSimulation, type BlockBridge, type BridgeSnapshot, type DrawBody } from "../engine/bridge/simulate";
import { emptyScribble, type Scribble } from "../engine/scribble";
import type { LearnerMap } from "../engine/placement";
import { AnswerPanel } from "./AnswerPanel";
import { ProblemBoard } from "./ProblemBoard";

type Step = "measure" | "earn" | "build" | "drive";
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
    stripe: "#FFFFFF",
    ink: "#3B2412",
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
    stripe: "#F3E6D0",
    ink: "#3B2412",
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
    stripe: "#1A1033",
    ink: "#1A1033",
  },
};

const SCENE_W = 1000;
const SCENE_H = 480;
const GAP_LEFT = 160;
const GAP_RIGHT = 840;

export function LevelFlow({
  level,
  map,
  earned,
  onBack,
  onNext,
  onPractice,
  onComplete,
  onEarn,
}: {
  level: CandyLevel;
  map: LearnerMap;
  earned: Record<string, number>;
  onBack: () => void;
  onNext: () => void;
  onPractice: (skillId: string) => void;
  onComplete: (levelId: string) => void;
  onEarn: (partId: string, count: number) => void;
}) {
  const [step, setStep] = useState<Step>("measure");
  const [measured, setMeasured] = useState(false);
  const [theme, setTheme] = useState<ThemeId>("candy");
  const [placed, setPlaced] = useState<PlacedBlock[]>([]);
  const [selected, setSelected] = useState("chocolate");
  const [driveKey, setDriveKey] = useState(0);
  const [mode, setMode] = useState<BuildMode>("count");
  const [settingsOpen, setSettingsOpen] = useState(false);
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
        <button type="button" className="gear" onPointerUp={() => setSettingsOpen((open) => !open)}>
          Settings
        </button>
      </header>
      {settingsOpen ? (
        <SettingsMenu
          map={map}
          mode={mode}
          theme={theme}
          onMode={setMode}
          onTheme={setTheme}
          onPractice={onPractice}
        />
      ) : null}
      {step === "measure" ? (
        <MeasureStep level={level} theme={theme} onDone={() => { setMeasured(true); setStep("earn"); }} />
      ) : null}
      {step === "earn" ? <EarnStep level={level} earned={earned} onEarn={onEarn} onDone={() => setStep("build")} /> : null}
      {step === "build" || step === "drive" ? (
        <BuildStep
          level={level}
          theme={theme}
          placed={placed}
          selected={selected}
          mode={mode}
          driving={step === "drive"}
          driveKey={driveKey}
          onSelect={setSelected}
          onPlaced={setPlaced}
          onDrive={() => {
            setDriveKey((value) => value + 1);
            setStep("drive");
          }}
          onAgain={() => setStep("build")}
          onNext={onNext}
          onComplete={() => onComplete(level.id)}
        />
      ) : null}
    </div>
  );
}

function SettingsMenu({
  map,
  mode,
  theme,
  onMode,
  onTheme,
  onPractice,
}: {
  map: LearnerMap;
  mode: BuildMode;
  theme: ThemeId;
  onMode: (mode: BuildMode) => void;
  onTheme: (theme: ThemeId) => void;
  onPractice: (skillId: string) => void;
}) {
  const locked = bridgeParts.filter((part) => part.role === "ramp" || !partUnlocked(part, map));
  return (
    <div className="settings-menu">
      <p>Build</p>
      <div className="theme-switch">
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
                  onMode(item.id);
                  return;
                }
                if (need) {
                  onPractice(need.skillId);
                }
              }}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {buildModes.map((item) => {
        const need = firstUnmet(item.requires, map);
        if (!need || modeUnlocked(item.id, map)) {
          return null;
        }
        const name = skills.find((skill) => skill.id === need.skillId)?.name ?? need.skillId;
        return (
          <p key={item.id}>
            {item.label} opens with {name}, level {need.level}.
            <button type="button" className="practice-link" onPointerUp={() => onPractice(need.skillId)}>
              Practice
            </button>
          </p>
        );
      })}
      <p>Theme</p>
      <div className="theme-switch" aria-label="Theme">
        {(["candy", "wood", "steel"] as ThemeId[]).map((item) => (
          <button key={item} type="button" className={theme === item ? "on" : ""} onPointerUp={() => onTheme(item)}>
            {item === "candy" ? "Candy" : item === "wood" ? "Wood" : "Steel"}
          </button>
        ))}
      </div>
      {locked.map((part) => (
        <p key={part.id}>
          {part.name}: {part.role === "ramp" ? "A later level." : `${unlockSkillName(part, skills)}, level ${part.unlock.level}.`}
          {part.role === "ramp" ? null : (
            <button type="button" className="practice-link" onPointerUp={() => onPractice(part.unlock.skillId)}>
              Practice
            </button>
          )}
        </p>
      ))}
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
    setHint(level.measure === "ruler" ? "Subtract the left cliff from the right cliff." : "Tap each block in the gap.");
  }

  return (
    <div className="measure-layout">
      <div className="scene-fit">
        <svg viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Gap to measure">
          <SceneBackdrop colors={colors} />
          {level.measure === "ruler" ? (
            <g aria-hidden="true">
              <rect x={GAP_LEFT} y="132" width={GAP_RIGHT - GAP_LEFT} height="36" rx="8" fill="#FFB070" />
              <text x={GAP_LEFT + 16} y="156" fontFamily="JetBrains Mono, monospace" fontSize="22" fill="#1A1033">
                {level.rulerLeft}
              </text>
              <text x={(GAP_LEFT + GAP_RIGHT) / 2} y="156" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="22" fill="#1A1033">
                ?
              </text>
              <text x={GAP_RIGHT - 16} y="156" textAnchor="end" fontFamily="JetBrains Mono, monospace" fontSize="22" fill="#1A1033">
                {level.rulerRight}
              </text>
            </g>
          ) : null}
          {Array.from({ length: level.gapBlocks }, (_, col) => {
            const box = slotRect(col, 0, level.gapBlocks);
            const on = marked[col];
            return (
              <g key={col} onPointerUp={() => {
                if (level.measure !== "count") {
                  return;
                }
                const next = marked.map((value, index) => (index === col ? !value : value));
                setMarked(next);
                setCount(next.filter(Boolean).length);
              }}>
                <rect
                  x={box.x}
                  y={box.y}
                  width={box.w}
                  height={box.h}
                  rx="8"
                  fill={on ? colors.chocolate : "transparent"}
                  stroke="#F6F1FF"
                  strokeWidth="3"
                  strokeDasharray={on ? undefined : "7 5"}
                />
                {level.measure === "count" ? (
                  <text x={box.x + box.w / 2} y={box.y + box.h / 2 + 8} textAnchor="middle" fontSize="28" fontWeight="700" fill={on ? "#1A1033" : "#F6F1FF"}>
                    {col + 1}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>
      <aside className="measure-panel">
        {level.measure === "count" ? (
          <>
            <p className="ask">How many blocks wide is the gap?</p>
            <div className="stepper">
              <button type="button" aria-label="Fewer" onPointerUp={() => setCount((value) => Math.max(0, value - 1))}>-</button>
              <strong>{count}</strong>
              <button type="button" aria-label="More" onPointerUp={() => setCount((value) => value + 1)}>+</button>
            </div>
            <button type="button" className="check" onPointerUp={() => check(count)}>Check</button>
          </>
        ) : (
          <>
            <p className="ask">How many meters is the gap?</p>
            <AnswerPanel
              key="measure"
              problem={{ prompt: "How many meters is the gap?", answer: String(answer) }}
              locked={false}
              onSubmit={(given) => check(Number(given))}
              onSkip={() => setHint("Subtract the left cliff from the right cliff.")}
            />
          </>
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
        <h2>Parts are ready</h2>
        <button type="button" className="check" onPointerUp={onDone}>Build</button>
      </div>
    );
  }

  const problem = questionProblem(question);
  return (
    <div className="earn-layout">
      <p className="ask">{question.prompt}</p>
      <div className="earn-pad">
        <ProblemBoard problem={problem} scribble={scribble} onScribble={setScribble} />
      </div>
      <div className="earn-keys">
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
      </div>
      {hint ? <p className="hint earn-hint">{hint}</p> : <p className="hint earn-hint">Write on the pad, then check.</p>}
    </div>
  );
}

function BuildStep({
  level,
  theme,
  placed,
  selected,
  mode,
  driving,
  driveKey,
  onSelect,
  onPlaced,
  onDrive,
  onAgain,
  onNext,
  onComplete,
}: {
  level: CandyLevel;
  theme: ThemeId;
  placed: PlacedBlock[];
  selected: string;
  mode: BuildMode;
  driving: boolean;
  driveKey: number;
  onSelect: (id: string) => void;
  onPlaced: (next: PlacedBlock[]) => void;
  onDrive: () => void;
  onAgain: () => void;
  onNext: () => void;
  onComplete: () => void;
}) {
  const colors = THEME_FILL[theme];
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [message, setMessage] = useState("");
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const [note, setNote] = useState("");
  const tray = traySupply(level);
  const trayParts = bridgeParts.filter((part) => (tray[part.id] ?? 0) > 0);

  useEffect(() => {
    if (!driving) {
      setMessage("");
      return;
    }
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (canvas && parent) {
      const rect = parent.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    }
    const sim = createBlockSimulation(toBridge(level, placed));
    sim.spawnCar();
    let phase: DrivePhase = "playing";
    let raf = 0;
    const tick = () => {
      for (let index = 0; index < 2; index += 1) {
        sim.step();
      }
      const snap = sim.snapshot();
      paintBridge(canvasRef.current, snap, colors, mode === "free");
      phase = nextDrivePhase(phase, snap.status);
      if (phase === "result") {
        const text = driveMessage(phase, snap.status, snap.failure?.text ?? "The bridge fell.");
        setMessage(text);
        if (snap.status === "crossed") {
          onComplete();
        }
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [driving, driveKey]);

  function placeSelected(slot: GridSlot) {
    if (driving || message) {
      return;
    }
    const existing = placed.find((item) => item.col === slot.col && item.row === slot.row);
    if (existing) {
      onPlaced(removePiece(placed, slot));
      return;
    }
    const part = partById(selected);
    if (!part) {
      return;
    }
    const dropped = dropPiece(placed, tray, part.id, part.role, slot);
    if (dropped.accepted) {
      onPlaced(dropped.placed);
      setNote("");
      return;
    }
    setNote(stockLeft(tray, placed, part.id) <= 0 ? "None of those are left." : "That piece does not fit there.");
  }

  function finishDrag(event: ReactPointerEvent) {
    const current = dragRef.current;
    if (!current) {
      return;
    }
    const hover = findHover(event.clientX, event.clientY);
    const part = partById(current.partId);
    if (!current.moved) {
      if (current.from) {
        onPlaced(removePiece(placed, current.from));
      } else if (part && stockLeft(tray, placed, part.id) > 0) {
        onSelect(part.id);
      } else {
        setNote("None of those are left.");
      }
      dragRef.current = null;
      setDrag(null);
      return;
    }
    if (part && hover && hover !== "tray") {
      const base = current.from ? removePiece(placed, current.from) : placed;
      const dropped = dropPiece(base, tray, part.id, part.role, hover);
      if (dropped.accepted) {
        onPlaced(dropped.placed);
        setNote("");
      }
    } else if (current.from && hover === "tray") {
      onPlaced(removePiece(placed, current.from));
    }
    dragRef.current = null;
    setDrag(null);
  }

  const guide =
    mode === "calculate"
      ? `Place ${level.gapBlocks} deck blocks and ${level.questions.find((question) => question.partId === "cane")?.count ?? 0} pillars.`
      : mode === "free"
        ? `Length ${spanReadout(level, placed.filter((item) => item.row === 0).length).length}. Load ${spanReadout(level, 0).load}.`
        : "Drag a piece into the gap.";

  return (
    <div className="build-layout">
      <p className="hint">{note || (driving && !message ? "Watch the car." : message ? "" : guide)}</p>
      <div className="scene-fit">
        {driving ? (
          <canvas ref={canvasRef} className="drive-canvas" />
        ) : (
          <svg viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Bridge builder">
            <SceneBackdrop colors={colors} />
            <CarGraphic x={22} y={126} />
            <FlagGraphic />
            {Array.from({ length: level.gapBlocks }, (_, col) =>
              ([0, 1] as const).map((row) => {
                const box = slotRect(col, row, level.gapBlocks);
                const tone = slotTone(drag, placed, tray, { col, row });
                return (
                  <rect
                    key={`${col}-${row}`}
                    data-slot={`${col}-${row}`}
                    x={box.x}
                    y={box.y}
                    width={box.w}
                    height={box.h}
                    rx="8"
                    className={tone}
                    onPointerUp={() => placeSelected({ col, row })}
                  />
                );
              }),
            )}
            {placed.map((item) => {
              if (drag?.from && drag.from.col === item.col && drag.from.row === item.row) {
                return null;
              }
              const box = slotRect(item.col, item.row, level.gapBlocks);
              return (
                <svg
                  key={`${item.partId}-${item.col}-${item.row}`}
                  data-slot={`${item.col}-${item.row}`}
                  x={box.x}
                  y={box.y}
                  width={box.w}
                  height={box.h}
                  viewBox="0 0 80 80"
                  onPointerDown={(event) => startDrag(event, item.partId, item, dragRef, setDrag)}
                  onPointerMove={(event) => moveDrag(event, dragRef, setDrag)}
                  onPointerUp={finishDrag}
                >
                  <PieceShape partId={item.partId} theme={theme} />
                </svg>
              );
            })}
          </svg>
        )}
      </div>
      {message ? (
        <div className="build-footer">
          <p className={message.includes("complete") ? "drive-ok result-line" : "drive-fail result-line"}>{message}</p>
          <button type="button" className="check" onPointerUp={onNext}>Next level</button>
          <button type="button" className="back" onPointerUp={onAgain}>Try again</button>
        </div>
      ) : (
        <div className="build-footer">
          <div className="tray" data-tray="true">
            {trayParts.map((part) => {
              const left = stockLeft(tray, placed, part.id);
              return (
                <div
                  key={part.id}
                  className={selected === part.id ? "tray-piece on" : "tray-piece"}
                  role="button"
                  aria-label={`${part.name}, ${left} left`}
                  onPointerDown={(event) => {
                    if (driving || left <= 0) {
                      setNote("None of those are left.");
                      return;
                    }
                    startDrag(event, part.id, null, dragRef, setDrag);
                  }}
                  onPointerMove={(event) => moveDrag(event, dragRef, setDrag)}
                  onPointerUp={finishDrag}
                >
                  <svg viewBox="0 0 80 80" width="56" height="48" aria-hidden="true">
                    <PieceShape partId={part.id} theme={theme} />
                  </svg>
                  <strong>{left}</strong>
                </div>
              );
            })}
          </div>
          <button type="button" className="drive" onPointerUp={onDrive}>Drive</button>
        </div>
      )}
      {drag ? (
        <div className="drag-ghost" style={{ left: drag.x, top: drag.y }}>
          <svg viewBox="0 0 80 80" width="84" height="84">
            <PieceShape partId={drag.partId} theme={theme} />
          </svg>
        </div>
      ) : null}
    </div>
  );
}

type DragState = {
  partId: string;
  from: GridSlot | null;
  x: number;
  y: number;
  originX: number;
  originY: number;
  moved: boolean;
};

function startDrag(
  event: ReactPointerEvent,
  partId: string,
  from: GridSlot | null,
  dragRef: MutableRefObject<DragState | null>,
  setDrag: (drag: DragState) => void,
) {
  event.preventDefault();
  try {
    event.currentTarget.setPointerCapture(event.pointerId);
  } catch {
    /* untrusted events in tests */
  }
  const next = { partId, from, x: event.clientX, y: event.clientY, originX: event.clientX, originY: event.clientY, moved: false };
  dragRef.current = next;
  setDrag(next);
}

function moveDrag(
  event: ReactPointerEvent,
  dragRef: MutableRefObject<DragState | null>,
  setDrag: (drag: DragState) => void,
) {
  const current = dragRef.current;
  if (!current) {
    return;
  }
  const moved = current.moved || Math.hypot(event.clientX - current.originX, event.clientY - current.originY) > 6;
  const next = { ...current, x: event.clientX, y: event.clientY, moved };
  dragRef.current = next;
  setDrag(next);
}

function findHover(x: number, y: number): GridSlot | "tray" | null {
  const el = document.elementFromPoint(x, y);
  if (!el) {
    return null;
  }
  if (el.closest("[data-tray]")) {
    return "tray";
  }
  const value = el.closest("[data-slot]")?.getAttribute("data-slot");
  if (!value) {
    return null;
  }
  const [col, row] = value.split("-").map(Number);
  if (!Number.isFinite(col) || (row !== 0 && row !== 1)) {
    return null;
  }
  return { col, row };
}

function slotTone(
  drag: DragState | null,
  placed: readonly PlacedBlock[],
  tray: Record<string, number>,
  slot: GridSlot,
): string {
  if (!drag || !drag.moved) {
    return "slot-open";
  }
  const hover = findHover(drag.x, drag.y);
  if (!hover || hover === "tray" || hover.col !== slot.col || hover.row !== slot.row) {
    return "slot-open";
  }
  const part = partById(drag.partId);
  if (!part) {
    return "slot-bad";
  }
  const base = drag.from ? removePiece(placed, drag.from) : placed;
  return dropPiece(base, tray, part.id, part.role, slot).accepted ? "slot-ok" : "slot-bad";
}

function slotRect(col: number, row: 0 | 1, gap: number) {
  const span = (GAP_RIGHT - GAP_LEFT) / Math.max(gap, 1);
  const x = GAP_LEFT + col * span + 8;
  const w = Math.max(44, span - 16);
  if (row === 0) {
    return { x, y: 188, w, h: 72 };
  }
  return { x: x + w * 0.22, y: 260, w: w * 0.56, h: 146 };
}

function SceneBackdrop({ colors }: { colors: Record<string, string> }) {
  return (
    <>
      <rect width={SCENE_W} height={SCENE_H} fill={colors.sky} />
      <rect y="390" width={SCENE_W} height="90" fill={colors.water} />
      <rect width="160" y="188" height="250" fill={colors.cliff} />
      <rect x="840" y="188" width="160" height="250" fill={colors.cliff} />
      <rect width="160" y="188" height="16" fill={colors.grass} />
      <rect x="840" y="188" width="160" height="16" fill={colors.grass} />
    </>
  );
}

function CarGraphic({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x="8" y="28" width="96" height="32" rx="8" fill="#FF7A1A" />
      <rect x="36" y="10" width="40" height="22" rx="6" fill="#FFF6EA" />
      <circle cx="30" cy="62" r="12" fill="#1A1033" />
      <circle cx="82" cy="62" r="12" fill="#1A1033" />
    </g>
  );
}

function FlagGraphic() {
  return (
    <g>
      <rect x="900" y="118" width="5" height="70" fill="#F6F1FF" />
      <polygon points="905,118 944,136 905,154" fill="#FF7A1A" />
    </g>
  );
}

function PieceShape({ partId, theme }: { partId: string; theme: ThemeId }) {
  const colors = THEME_FILL[theme];
  if (partId === "cane") {
    return (
      <g>
        <path d="M30 28c0-12 22-16 28-4 4 8-2 14-10 14h-6v36c0 6-12 6-12 0V28z" fill={colors.cane} />
        <path d="M36 16c8-2 16 4 14 10" fill="none" stroke={colors.stripe} strokeWidth="4" strokeLinecap="round" />
        <rect x="32" y="40" width="10" height="6" fill={colors.stripe} />
        <rect x="32" y="52" width="10" height="6" fill={colors.stripe} />
        <rect x="32" y="64" width="10" height="6" fill={colors.stripe} />
      </g>
    );
  }
  if (partId === "wafer") {
    return (
      <g>
        <rect x="8" y="22" width="64" height="38" rx="6" fill={colors.wafer} stroke={colors.ink} strokeWidth="3" />
        <path d="M24 22v38M40 22v38M56 22v38M8 34h64M8 46h64" stroke={colors.ink} strokeWidth="2" />
      </g>
    );
  }
  if (partId === "gummy") {
    return (
      <g>
        <rect x="10" y="18" width="60" height="46" rx="18" fill={colors.gummy} />
        <ellipse cx="32" cy="32" rx="14" ry="8" fill="#FFFFFF" opacity="0.7" />
      </g>
    );
  }
  if (partId === "pretzel") {
    return (
      <g fill="none" stroke={colors.pretzel} strokeLinecap="round">
        <path d="M16 58c6-28 42-28 48 0" strokeWidth="10" />
        <path d="M24 46c8 14 24 14 32 0" strokeWidth="8" />
      </g>
    );
  }
  if (partId === "marshmallow") {
    return <rect x="14" y="20" width="52" height="42" rx="18" fill={colors.marshmallow} stroke={colors.ink} strokeWidth="3" />;
  }
  if (partId === "ramp") {
    return <polygon points="10,66 70,66 70,22" fill={colors.ink} />;
  }
  return (
    <g>
      <rect x="4" y="20" width="72" height="42" rx="7" fill={colors.ink} />
      <rect x="8" y="24" width="64" height="34" rx="4" fill={colors.chocolate} />
      <path d="M28 24v34M48 24v34M8 41h64" stroke={colors.ink} strokeWidth="2" />
    </g>
  );
}

function toBridge(level: CandyLevel, placed: PlacedBlock[]): BlockBridge {
  return {
    gap: level.gapBlocks,
    carKg: level.carWeight,
    pieces: placed.flatMap((item) => {
      const part = partById(item.partId);
      if (!part || part.role === "ramp") {
        return [];
      }
      return [
        {
          id: `${item.partId}-${item.col}-${item.row}`,
          name: part.name,
          col: item.col,
          role: item.row === 0 ? ("deck" as const) : ("pillar" as const),
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
  const worldW = snap.maxX - snap.minX;
  const worldH = snap.maxY - snap.minY;
  const scale = Math.min(width / worldW, height / worldH);
  const x0 = (width - worldW * scale) / 2;
  const y0 = (height - worldH * scale) / 2;
  const xOf = (x: number) => x0 + (x - snap.minX) * scale;
  const yOf = (y: number) => y0 + (snap.maxY - y) * scale;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = colors.sky ?? "#3A2470";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = colors.water ?? "#2E9BD6";
  ctx.fillRect(0, yOf(1.2), width, height - yOf(1.2));
  for (const body of snap.bodies) {
    drawBody(ctx, body, colors, xOf, yOf, scale, showStress);
  }
  const flagX = xOf(snap.maxX - 1.4);
  const flagY = yOf(5);
  ctx.fillStyle = "#F6F1FF";
  ctx.fillRect(flagX, flagY - 46, 4, 46);
  ctx.fillStyle = "#FF7A1A";
  ctx.beginPath();
  ctx.moveTo(flagX + 4, flagY - 46);
  ctx.lineTo(flagX + 28, flagY - 32);
  ctx.lineTo(flagX + 4, flagY - 18);
  ctx.fill();
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
  const fill =
    stressed ||
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
  } else if (body.role === "car") {
    const w = body.halfWidth * 2 * scale;
    const h = body.halfHeight * 2 * scale;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.fillStyle = "#FFF6EA";
    ctx.fillRect(-w * 0.15, -h * 1.15, w * 0.5, h * 0.7);
  } else {
    ctx.fillRect(-body.halfWidth * scale, -body.halfHeight * scale, body.halfWidth * 2 * scale, body.halfHeight * 2 * scale);
  }
  if (body.broken && body.radius === 0) {
    ctx.strokeStyle = "#FF5A36";
    ctx.lineWidth = 6;
    ctx.strokeRect(-body.halfWidth * scale, -body.halfHeight * scale, body.halfWidth * 2 * scale, body.halfHeight * 2 * scale);
  }
  ctx.restore();
}
