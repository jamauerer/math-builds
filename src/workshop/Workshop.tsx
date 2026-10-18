import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { skills, strands } from "../data/load-skills";
import { answersMatch } from "../engine/answers";
import { generateProblem } from "../engine/generate";
import type { DesignPart, ModelReport, SimFrame } from "../engine/model";
import { nextDrivePhase, type DrivePhase } from "../engine/bridge/place";
import type { LearnerMap } from "../engine/placement";
import { createRng } from "../engine/rng";
import { emptyScribble, type Scribble } from "../engine/scribble";
import type { Problem } from "../engine/types";
import { hintFor } from "../curriculum/hints";
import { emptyMastery, queueRecall, recallReady, skillsMet, strandSummary } from "../curriculum/mastery";
import { machines, models } from "../machines";
import { craftStars, numbersMatch, piecesFor, predictsChecked, returnFailed, specFromAnswer } from "../machines/loop";
import type { Challenge } from "../machines/types";
import { exportProgress, importProgress } from "../progress/transfer";
import type { SavedProgress, WorkshopSave } from "../storage/progress";
import { AnswerPanel } from "../ui/AnswerPanel";
import { ProblemBoard } from "../ui/ProblemBoard";

type Step = "measure" | "calculate" | "build" | "test" | "diagnose" | "sandbox";

type Props = {
  map: LearnerMap;
  progress: SavedProgress;
  onProgress: (next: SavedProgress) => void;
  onSkillPass: (skillId: string, level: number) => void;
  onPractice: (skillId: string) => void;
};

const THEME = {
  candy: { ground: "#8a4b2f", beam: "#c47b3a", accent: "#e85d4c", water: "#3ec6e0", gear: "#f0d090" },
  wood: { ground: "#6b4423", beam: "#a56a32", accent: "#d7b48a", water: "#2f6f8f", gear: "#e6d3b1" },
  steel: { ground: "#3e4c59", beam: "#9aa7b5", accent: "#d5dde6", water: "#1d4e89", gear: "#c5ced6" },
};

function challengeById(id: string): Challenge | undefined {
  for (const machine of machines) {
    const found = machine.challenges.find((item) => item.id === id);
    if (found) {
      return found;
    }
  }
  return undefined;
}

export function Workshop({ map, progress, onProgress, onSkillPass, onPractice }: Props) {
  const save = progress.workshop ?? { completed: [], mastery: {}, sandbox: [], theme: "candy" as const };
  const [theme, setTheme] = useState(save.theme);
  const [settings, setSettings] = useState(false);
  const [modeled, setModeled] = useState(false);
  const [machineId, setMachineId] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [step, setStep] = useState<Step>("measure");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [attempts, setAttempts] = useState<Record<string, boolean>>({});
  const [misses, setMisses] = useState<Record<string, number>>({});
  const [hint, setHint] = useState("");
  const [typed, setTyped] = useState("");
  const [placed, setPlaced] = useState<DesignPart | null>(null);
  const [extra, setExtra] = useState<DesignPart | null>(null);
  const [stage, setStage] = useState(0);
  const [note, setNote] = useState("");
  const [report, setReport] = useState<ModelReport | null>(null);
  const [phase, setPhase] = useState<DrivePhase>("playing");
  const [dragId, setDragId] = useState<string | null>(null);
  const [frame, setFrame] = useState(0);
  const [frames, setFrames] = useState<SimFrame[]>([]);
  const [gate, setGate] = useState<Challenge | null>(null);
  const [check, setCheck] = useState<Problem | null>(null);
  const [scribble, setScribble] = useState<Scribble>(emptyScribble());
  const [transfer, setTransfer] = useState<Problem | null>(null);
  const [recall, setRecall] = useState<Problem | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const summary = useMemo(() => strandSummary(strands, map, save.mastery), [map, save.mastery]);
  const colors = THEME[theme];

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("challenge");
    const found = id ? challengeById(id) : undefined;
    if (found && skillsMet(found.skills, map, progress.age)) {
      openChallenge(found);
    }
    const due = Object.entries(save.mastery).find(([, record]) => recallReady(record, Date.now()));
    if (due) {
      const skill = skills.find((item) => item.id === due[0]);
      if (skill) {
        setRecall(generateProblem(skill, createRng(Date.now() % 100000), Math.max(1, map[skill.id]?.level ?? 1)));
      }
    }
    // Open a linked challenge once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function write(next: WorkshopSave) {
    onProgress({ ...progress, workshop: next });
  }

  function openChallenge(next: Challenge) {
    setChallenge(next);
    setMachineId(next.machine);
    setStep("measure");
    setIndex(0);
    setAnswers({});
    setAttempts({});
    setMisses({});
    setHint("");
    setTyped("");
    setPlaced(null);
    setExtra(null);
    setStage(0);
    setNote("");
    setReport(null);
    setGate(null);
    setTransfer(null);
  }

  function question() {
    return challenge?.questions[index];
  }

  function submit(raw: string) {
    const current = question();
    if (!challenge || !current) {
      return;
    }
    const value = specFromAnswer(raw);
    if (value == null) {
      return;
    }
    const right = numbersMatch(raw, current.answer);
    if (current.kind === "predict") {
      setAttempts({ ...attempts, [current.id]: true });
    }
    if (!right) {
      const count = (misses[current.id] ?? 0) + 1;
      setMisses({ ...misses, [current.id]: count });
      setHint(hintFor(current.hints, count) ?? "");
      return;
    }
    setAnswers({ ...answers, [current.id]: value });
    setHint("");
    setTyped("");
    advance();
  }

  function keep() {
    const current = question();
    if (!challenge || !current || current.kind === "measure") {
      return;
    }
    const value = specFromAnswer(typed);
    if (value == null) {
      return;
    }
    setAnswers({ ...answers, [current.id]: value });
    if (current.kind === "predict") {
      setAttempts({ ...attempts, [current.id]: true });
    }
    setHint("");
    setTyped("");
    advance();
  }

  function advance() {
    if (!challenge) {
      return;
    }
    if (index < challenge.questions.length - 1) {
      setIndex(index + 1);
      setStep(challenge.questions[index + 1].kind === "measure" ? "measure" : "calculate");
      return;
    }
    setStep("build");
  }

  function drop(part: DesignPart, slot: "main" | "extra") {
    if (!challenge) {
      return;
    }
    const design = slot === "main" ? [part] : [placed, part].filter((item): item is DesignPart => item != null);
    const settled = models[challenge.machine].settle(
      design.map((item) => ({ ...item, slot: item.id === part.id ? slot : item.slot })),
      challenge.scene,
    );
    if (!settled.ok) {
      setNote(settled.text);
      return;
    }
    const stored = { ...part, slot };
    if (slot === "main") {
      setPlaced(stored);
    } else {
      setExtra(stored);
    }
    setNote("");
  }

  function runTest() {
    if (!challenge || !placed) {
      setNote("Place a piece first.");
      return;
    }
    if (!predictsChecked(challenge.questions, attempts)) {
      setNote("Answer the prediction before the test.");
      return;
    }
    const design = [placed, extra].filter((item): item is DesignPart => item != null);
    const result = models[challenge.machine].evaluate(design, challenge.scene);
    const movie = models[challenge.machine].simulate(design, challenge.scene);
    setReport(result);
    setFrames(movie);
    setFrame(0);
    setPhase("playing");
    setStep("test");
    setNote("Watch the test.");
  }

  useEffect(() => {
    if (step !== "test" || frames.length === 0 || !report) {
      return;
    }
    let cursor = 0;
    let current: DrivePhase = "playing";
    let handle = 0;
    const tick = () => {
      cursor += 1;
      const ended = cursor >= frames.length - 1;
      const status = ended ? (report.ok ? "crossed" : "collapsed") : "driving";
      current = nextDrivePhase(current, status);
      setFrame(Math.min(cursor, frames.length - 1));
      setPhase(current);
      if (current === "result") {
        setStep("diagnose");
        setNote("");
        return;
      }
      handle = window.requestAnimationFrame(tick);
    };
    handle = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(handle);
  }, [step, frames, report]);

  function finishSuccess() {
    if (!challenge) {
      return;
    }
    const completed = save.completed.includes(challenge.id) ? save.completed : [...save.completed, challenge.id];
    const skillId = challenge.skills[0]?.skillId;
    const mastery = { ...save.mastery };
    if (skillId) {
      const prior = mastery[skillId] ?? emptyMastery();
      mastery[skillId] = { ...prior, challengeDone: true };
    }
    const sandbox = save.sandbox.includes(challenge.machine) ? save.sandbox : [...save.sandbox, challenge.machine];
    write({ ...save, completed, mastery, sandbox, theme });
    if (skillId) {
      const skill = skills.find((item) => item.id === skillId);
      if (skill) {
        setTransfer(generateProblem(skill, createRng((Date.now() % 100000) + 3), Math.max(1, challenge.skills[0].level || 1)));
      }
    }
  }

  function passTransfer() {
    const skillId = challenge?.skills[0]?.skillId;
    if (!skillId) {
      setTransfer(null);
      return;
    }
    const prior = save.mastery[skillId] ?? emptyMastery();
    write({
      ...save,
      theme,
      mastery: { ...save.mastery, [skillId]: { ...prior, challengeDone: true, transferPassed: true, recallAt: queueRecall(Date.now()) } },
    });
    setTransfer(null);
    setStep("sandbox");
  }

  function passRecall(skillId: string) {
    const prior = save.mastery[skillId] ?? emptyMastery();
    write({ ...save, theme, mastery: { ...save.mastery, [skillId]: { ...prior, recallPassed: true } } });
    setRecall(null);
  }

  function fix() {
    if (placed || extra) {
      returnFailed([placed, extra].filter((item): item is DesignPart => item != null));
    }
    setPlaced(null);
    setExtra(null);
    setReport(null);
    setStep("build");
    setNote("The pieces are back in the tray.");
  }

  const current = question();
  const playing = Boolean(challenge) && step !== "sandbox";

  return (
    <div className="workshop">
      <header className="workshop-bar">
        <button type="button" className="step-link" onPointerUp={() => setChallenge(null)}>
          Worlds
        </button>
        {playing ? (
          <div className="step-bar">
            {(["measure", "calculate", "build", "test"] as Step[]).map((name, number) => (
              <button key={name} type="button" className={step === name || (name === "test" && step === "diagnose") ? "step-link on" : "step-link"} onPointerUp={() => setStep(name)}>
                {number + 1} {name[0].toUpperCase() + name.slice(1)}
              </button>
            ))}
          </div>
        ) : (
          <strong className="workshop-title">Workshop</strong>
        )}
        <button type="button" className="gear" aria-label="Settings" onPointerUp={() => setSettings((open) => !open)}>
          Settings
        </button>
      </header>
      {settings ? (
        <div className="settings-menu">
          <p>Theme</p>
          {(["candy", "wood", "steel"] as const).map((name) => (
            <button key={name} type="button" className={theme === name ? "on" : ""} onPointerUp={() => { setTheme(name); write({ ...save, theme: name }); }}>
              {name[0].toUpperCase() + name.slice(1)}
            </button>
          ))}
          <button type="button" onPointerUp={() => setModeled(true)}>How this is modeled</button>
          <button type="button" onPointerUp={() => download(exportProgress({ ...progress, workshop: { ...save, theme } }))}>Export</button>
          <button type="button" onPointerUp={() => fileRef.current?.click()}>Import</button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) {
                return;
              }
              void file.text().then((raw) => onProgress(importProgress(raw, skills)));
            }}
          />
        </div>
      ) : null}
      {modeled && challenge ? (
        <div className="settings-menu model-notes">
          {models[challenge.machine].assumptions.map((item) => (
            <p key={item.text}>{item.text}</p>
          ))}
          <button type="button" onPointerUp={() => setModeled(false)}>Close</button>
        </div>
      ) : null}
      {!challenge ? (
        <div className="workshop-home">
          <div className="strand-line">
            {summary.map((strand) => (
              <span key={strand.id}>{strand.name}: {strand.mastered}/{strand.skills}</span>
            ))}
          </div>
          {recall && gate == null ? (
            <div className="ask-block">
              <p className="ask">{recall.prompt}</p>
              <AnswerPanel problem={recall} locked={false} onSkip={() => setRecall(null)} onSubmit={(answer) => {
                const skillId = Object.entries(save.mastery).find(([, record]) => recallReady(record, Date.now()))?.[0];
                if (skillId && answersMatch(answer, recall.answer)) {
                  passRecall(skillId);
                }
              }} />
            </div>
          ) : null}
          <div className="machine-pick">
            {machines.map((machine) => (
              <section key={machine.id} className={machineId === machine.id ? "machine-card on" : "machine-card"}>
                <button type="button" onPointerUp={() => setMachineId(machine.id)}>
                  <h2>{machine.name}</h2>
                  <p>{machine.summary}</p>
                </button>
                {machineId === machine.id ? (
                  <div className="family-list">
                    {families(machine.challenges).map((family) => (
                      <div key={family} className="family-row">
                        <span>{family}</span>
                        {machine.challenges.filter((item) => item.family === family).map((item) => {
                          const open = skillsMet(item.skills, map, progress.age);
                          return (
                            <button key={item.id} type="button" className="challenge-link" onPointerUp={() => (open ? openChallenge(item) : setGate(item))}>
                              {item.title}{save.completed.includes(item.id) ? " done" : ""}{open ? "" : " locked"}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                ) : null}
              </section>
            ))}
          </div>
        </div>
      ) : (
        <div className="workshop-play">
          {step === "measure" || step === "calculate" ? (
            <div className="workshop-ask">
              <p className="ask">{current?.prompt}</p>
              <div className="workshop-split">
                <Scene challenge={challenge} placed={placed} extra={extra} colors={colors} tray={piecesFor(challenge, answers)} dragId={dragId} onDrop={drop} />
                <div>
                  <ProblemBoard problem={{ prompt: current?.prompt ?? "", answer: "" }} scribble={scribble} onScribble={setScribble} />
                  <DecimalPad value={typed} onChange={setTyped} onSubmit={() => submit(typed)} />
                  {current && current.kind !== "measure" && typed.length > 0 ? (
                    <button type="button" className="check" onPointerUp={keep}>Keep this part</button>
                  ) : null}
                </div>
              </div>
              {hint ? <p className="hint-line">{hint}</p> : null}
            </div>
          ) : null}
          {step === "build" || step === "sandbox" ? (
            <div className="workshop-build">
              <p className="ask">{step === "sandbox" ? "Sandbox. Every earned piece is in the tray." : `${challenge.stages[Math.min(stage, challenge.stages.length - 1)]}. Drag a piece into place.`}</p>
              <Scene challenge={challenge} placed={placed} extra={extra} colors={colors} tray={piecesFor(challenge, answers)} dragId={dragId} onDrop={drop} allowExtra={stage >= challenge.stages.length - 1 || step === "sandbox"} />
              <div className="tray">
                {piecesFor(challenge, answers).map((part) => (
                  <div
                    key={part.id}
                    className="tray-piece"
                    draggable
                    onPointerDown={() => setDragId(part.id)}
                    onDragStart={(event) => {
                      event.dataTransfer.setData("text/plain", part.id);
                      setDragId(part.id);
                    }}
                  >
                    <Piece kind={part.kind} spec={part.spec} colors={colors} />
                    <span>{part.kind} {part.spec}</span>
                  </div>
                ))}
                {stage < challenge.stages.length - 1 ? (
                  <button type="button" className="check" onPointerUp={() => setStage(stage + 1)}>Next stage</button>
                ) : (
                  <button type="button" className="check" onPointerUp={runTest}>Test</button>
                )}
              </div>
            </div>
          ) : null}
          {step === "test" || step === "diagnose" ? (
            <div className="workshop-build">
              <p className="ask">{step === "test" ? (phase === "holding" ? "Holding the last frame." : "Watch the test.") : report?.ok ? "The design met these numbers." : report?.failures[0]?.text}</p>
              <FrameView frame={frames[frame]} colors={colors} />
              {step === "diagnose" && report ? (
                <div className="build-footer">
                  {report.numbers.map((item) => (
                    <p key={item.label}>{item.label}: {item.value}</p>
                  ))}
                  {report.ok ? <p>{craftStars(Boolean(extra), true).join(". ")}</p> : <p>{report.failures[0]?.followUp}</p>}
                  {report.ok ? (
                    <button type="button" className="check" onPointerUp={finishSuccess}>Sandbox</button>
                  ) : (
                    <button type="button" className="check" onPointerUp={fix}>Try again</button>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}
          {note ? <p className="hint-line">{note}</p> : null}
          {transfer ? (
            <div className="ask-block">
              <p className="ask">Transfer: {transfer.prompt}</p>
              <ProblemBoard problem={transfer} scribble={scribble} onScribble={setScribble} />
              <AnswerPanel problem={transfer} locked={false} onSkip={() => { setTransfer(null); setStep("sandbox"); }} onSubmit={(answer) => {
                if (answersMatch(answer, transfer.answer)) {
                  passTransfer();
                }
              }} />
            </div>
          ) : null}
        </div>
      )}
      {gate ? (
        <div className="skill-gate">
          <p className="ask">Opens with {skillName(gate)}, level {gate.skills[0]?.level}.</p>
          <button type="button" className="check" onPointerUp={() => onPractice(gate.skills[0].skillId)}>Practice</button>
          <button type="button" className="check" onPointerUp={() => {
            const skill = skills.find((item) => item.id === gate.skills[0].skillId);
            if (!skill) {
              return;
            }
            setCheck(generateProblem(skill, createRng(Date.now() % 100000), Math.max(1, gate.skills[0].level)));
          }}>Test me on this</button>
          {check ? (
            <>
              <p className="ask">{check.prompt}</p>
              <ProblemBoard problem={check} scribble={scribble} onScribble={setScribble} />
              <AnswerPanel problem={check} locked={false} onSkip={() => setCheck(null)} onSubmit={(answer) => {
                if (answersMatch(answer, check.answer)) {
                  onSkillPass(gate.skills[0].skillId, gate.skills[0].level);
                  setCheck(null);
                  openChallenge(gate);
                }
              }} />
            </>
          ) : null}
          <button type="button" onPointerUp={() => setGate(null)}>Close</button>
        </div>
      ) : null}
    </div>
  );
}

function families(challenges: Challenge[]): string[] {
  return [...new Set(challenges.map((item) => item.family))];
}

function skillName(challenge: Challenge): string {
  return skills.find((item) => item.id === challenge.skills[0]?.skillId)?.name ?? "a skill";
}

function download(json: string) {
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "math-builds-progress.json";
  link.click();
  URL.revokeObjectURL(url);
}

function DecimalPad({ value, onChange, onSubmit }: { value: string; onChange: (value: string) => void; onSubmit: () => void }) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "delete", "0", ".", "enter"];
  return (
    <div className="pad">
      <div className="pad-display">{value || " "}</div>
      <div className="pad-keys">
        {keys.map((key) => (
          <button
            key={key}
            type="button"
            className="pad-key"
            onPointerUp={() => {
              if (key === "enter") {
                onSubmit();
              } else if (key === "delete") {
                onChange(value.slice(0, -1));
              } else if (key === "." && value.includes(".")) {
                return;
              } else {
                onChange(`${value}${key}`.slice(0, 8));
              }
            }}
          >
            {key === "delete" ? "Delete" : key === "enter" ? "Check" : key}
          </button>
        ))}
      </div>
    </div>
  );
}

function Piece({ kind, spec, colors }: { kind: string; spec: number; colors: (typeof THEME)["candy"] }) {
  if (kind === "gear" || kind === "idler") {
    return (
      <svg viewBox="0 0 40 40" width="36" height="36" aria-hidden="true">
        <circle cx="20" cy="20" r="14" fill={colors.gear} stroke="#1c1917" />
        <circle cx="20" cy="20" r="4" fill="#1c1917" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 48 28" width="48" height="28" aria-hidden="true">
      <rect x="2" y="6" width="44" height="16" rx="3" fill={colors.beam} stroke="#1c1917" />
      <text x="24" y="18" textAnchor="middle" fontSize="8" fill="#1c1917">{spec}</text>
    </svg>
  );
}

function Scene({
  challenge,
  placed,
  extra,
  colors,
  tray,
  dragId,
  onDrop,
  allowExtra = true,
}: {
  challenge: Challenge;
  placed: DesignPart | null;
  extra: DesignPart | null;
  colors: (typeof THEME)["candy"];
  tray: DesignPart[];
  dragId: string | null;
  onDrop: (part: DesignPart, slot: "main" | "extra") => void;
  allowExtra?: boolean;
}) {
  function take(id: string, slot: "main" | "extra") {
    const part = tray.find((item) => item.id === id);
    if (part) {
      onDrop(part, slot);
    }
  }
  function fromEvent(event: DragEvent, slot: "main" | "extra") {
    event.preventDefault();
    take(event.dataTransfer.getData("text/plain") || dragId || "", slot);
  }
  return (
    <svg className="workshop-scene" viewBox="0 0 640 280" preserveAspectRatio="xMidYMid meet">
      <rect x="0" y="0" width="640" height="280" fill="#24143f" />
      <rect x="40" y="168" width="120" height="72" fill={colors.ground} />
      <rect x="480" y="168" width="120" height="72" fill={colors.ground} />
      <rect x="160" y="214" width="320" height="26" fill={colors.water} />
      <text x="164" y="36" fill="#f6f1ff" fontSize="16">0</text>
      <text x="470" y="36" fill="#f6f1ff" fontSize="16">{challenge.scene.gap}</text>
      <line x1="170" y1="44" x2="470" y2="44" stroke="#f6f1ff" />
      {Array.from({ length: Math.min(12, Math.round(challenge.scene.gap)) }, (_, mark) => (
        <line key={mark} x1={170 + (mark * 290) / Math.max(1, challenge.scene.gap)} y1="48" x2={170 + (mark * 290) / Math.max(1, challenge.scene.gap)} y2="58" stroke="#f6f1ff" />
      ))}
      <rect
        x="160"
        y="150"
        width="320"
        height="40"
        fill="transparent"
        stroke={placed ? colors.beam : "#9ae6b4"}
        strokeDasharray="6 4"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => fromEvent(event, "main")}
        onPointerUp={() => dragId && take(dragId, "main")}
      />
      {placed ? (
        <rect
          x="160"
          y="156"
          width={Math.max(12, (placed.spec / Math.max(challenge.scene.gap, 0.5)) * 320)}
          height="22"
          rx="4"
          fill={colors.beam}
        />
      ) : null}
      {allowExtra ? (
        <rect x="300" y="180" width="70" height="28" fill="transparent" stroke={extra ? colors.accent : "#f6ad55"} strokeDasharray="4 3" onDragOver={(event) => event.preventDefault()} onDrop={(event) => fromEvent(event, "extra")} onPointerUp={() => dragId && take(dragId, "extra")} />
      ) : null}
    </svg>
  );
}

function FrameView({ frame, colors }: { frame: SimFrame | undefined; colors: (typeof THEME)["candy"] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) {
      return;
    }
    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }
    const width = canvas.width;
    const height = canvas.height;
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#24143f";
    context.fillRect(0, 0, width, height);
    if (!frame) {
      return;
    }
    for (const body of frame.bodies) {
      context.save();
      context.translate(80 + body.x * 28, height - 40 - body.y * 28);
      context.rotate(-body.angle);
      context.fillStyle = body.id === "water" ? colors.water : body.fill;
      context.fillRect((-body.w * 28) / 2, (-body.h * 28) / 2, body.w * 28, body.h * 28);
      context.restore();
    }
  }, [frame, colors]);
  return <canvas ref={ref} className="workshop-canvas" width={640} height={280} />;
}
