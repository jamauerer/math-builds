import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { skills, strands } from "../data/load-skills";
import { answersMatch } from "../engine/answers";
import { generateProblem } from "../engine/generate";
import type { DesignPart, ModelReport, SimFrame } from "../engine/model";
import type { DrivePhase } from "../engine/bridge/place";
import type { LearnerMap } from "../engine/placement";
import { createRng } from "../engine/rng";
import { emptyScribble, type Scribble } from "../engine/scribble";
import type { Problem } from "../engine/types";
import { hintFor } from "../curriculum/hints";
import { challengeOpen, emptyMastery, queueRecall, recallReady, strandSummary } from "../curriculum/mastery";
import { machines, models } from "../machines";
import { craftStars, numbersMatch, piecesFor, predictsChecked, returnFailed, specFromAnswer } from "../machines/loop";
import type { Challenge } from "../machines/types";
import { exportProgress, importProgress } from "../progress/transfer";
import { paintMachine, resultAllowed, sceneIdFor, subjectsFor, type ScenePainter } from "./scenes";
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
  draft: { ground: "#9A6230", beam: "#8A6A14", accent: "#C8450A", water: "#1F8A8C", gear: "#E0A526" },
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
  const save = progress.workshop ?? { completed: [], mastery: {}, sandbox: [], theme: "draft" as const };
  const [theme, setTheme] = useState(save.theme);
  const [settings, setSettings] = useState(false);
  const [modeled, setModeled] = useState(false);
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
  const [replay, setReplay] = useState(0);
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
    if (found && levelOpen(found, save.completed, map)) {
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
    setNote("");
  }

  useEffect(() => {
    if (step !== "test" || frames.length === 0) {
      return;
    }
    let cursor = 0;
    let paints = 0;
    let timer = 0;
    const tick = () => {
      paints += 1;
      cursor += 1;
      const at = Math.min(cursor, frames.length - 1);
      setFrame(at);
      if (cursor >= frames.length - 1) {
        if (!resultAllowed(paints)) {
          return;
        }
        setPhase("holding");
        timer = window.setTimeout(() => {
          setPhase("result");
          setStep("diagnose");
        }, 280);
        return;
      }
      const slow = Math.abs(cursor - frames.length / 2) < 2;
      setPhase("playing");
      timer = window.setTimeout(tick, slow ? 420 : 80);
    };
    timer = window.setTimeout(tick, 70);
    return () => window.clearTimeout(timer);
  }, [step, frames, replay]);

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
    <div className="workshop" data-theme={theme}>
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
          {(["draft", "candy", "wood", "steel"] as const).map((name) => (
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
          {limitLines(challenge).map((line) => (
            <p key={line}>{line}</p>
          ))}
          <button type="button" onPointerUp={() => setModeled(false)}>Close</button>
        </div>
      ) : null}
      {!challenge ? (
        <div className="workshop-home">
          <div className="strand-bars">
            {summary.map((strand) => (
              <button key={strand.id} type="button" className="strand-bar" title={`${strand.name}: ${strand.mastered} of ${strand.skills}`}>
                <span style={{ width: `${Math.round((strand.mastered / Math.max(1, strand.skills)) * 100)}%` }} />
                <span className="strand-tip">{strand.name}: {strand.mastered}/{strand.skills}</span>
              </button>
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
          <div className="family-grid">
            {machines.map((machine) => (
              families(machine.challenges).map((family) => {
                const list = machine.challenges.filter((item) => item.family === family);
                return (
                  <section key={family} className="family-card">
                    <FamilyThumb family={family} />
                    <h2>{family}</h2>
                    <div className="tile-row">
                      {list.map((item, tileIndex) => {
                        const open = levelOpen(item, save.completed, map);
                        const done = save.completed.includes(item.id);
                        const state = done ? "done" : open ? "current" : "locked";
                        const current = !done && open && list.slice(0, tileIndex).every((earlier) => save.completed.includes(earlier.id));
                        return (
                          <div key={item.id} className="tile-wrap">
                            <button
                              type="button"
                              className={`challenge-tile ${state}${current ? " now" : ""}`}
                              aria-label={item.title}
                              onPointerUp={() => (open ? openChallenge(item) : setGate(gate?.id === item.id ? null : item))}
                            >
                              <TileMark state={state} />
                            </button>
                            {gate?.id === item.id ? (
                              <div className="lock-pop" role="dialog">
                                <p>Opens with {skillName(item)}, level {item.skills[0]?.level}.</p>
                                <button type="button" className="check" onPointerUp={() => onPractice(item.skills[0].skillId)}>Practice</button>
                                <button type="button" className="check" onPointerUp={() => {
                                  const skill = skills.find((entry) => entry.id === item.skills[0].skillId);
                                  if (!skill) {
                                    return;
                                  }
                                  setCheck(generateProblem(skill, createRng(Date.now() % 100000), Math.max(1, item.skills[0].level)));
                                }}>Test me on this</button>
                                {check ? (
                                  <>
                                    <p>{check.prompt}</p>
                                    <AnswerPanel problem={check} locked={false} onSkip={() => setCheck(null)} onSubmit={(answer) => {
                                      if (answersMatch(answer, check.answer)) {
                                        onSkillPass(item.skills[0].skillId, item.skills[0].level);
                                        setCheck(null);
                                        openChallenge(item);
                                      }
                                    }} />
                                  </>
                                ) : null}
                                <button type="button" onPointerUp={() => setGate(null)}>Close</button>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })
            ))}
          </div>
        </div>
      ) : (
        <div className="workshop-play" data-step={step}>
          <div className="workshop-split">
            <div className="scene-wrap">
              {challenge.mission ? <p className="mission-line">{challenge.mission}</p> : null}
              <SceneCanvas
                challenge={challenge}
                progress={step === "test" || step === "diagnose" ? frame / Math.max(1, frames.length - 1) : 0}
                angle={frames[frame]?.bodies.find((body) => body.id === "plank" || body.id === "driver")?.angle ?? 0}
                placed={placed?.spec ?? 0}
                slow={phase === "holding"}
              />
              {step === "build" || step === "sandbox" ? (
                <DropLayer
                  tray={piecesFor(challenge, answers)}
                  dragId={dragId}
                  onDrop={drop}
                  allowExtra={stage >= challenge.stages.length - 1 || step === "sandbox"}
                />
              ) : null}
            </div>
            {step === "measure" || step === "calculate" ? (
              <div className="calc-column" data-calc-column>
                <p className="ask">{current?.prompt}</p>
                <div className="calc-pad" data-pad>
                  <ProblemBoard problem={{ prompt: current?.prompt ?? "", answer: "" }} scribble={scribble} onScribble={setScribble} />
                </div>
                <div data-keypad>
                  <DecimalPad value={typed} onChange={setTyped} onSubmit={() => submit(typed)} />
                </div>
                <div className="calc-actions">
                  {current && current.kind !== "measure" && typed.length > 0 ? (
                    <button type="button" className="check" onPointerUp={keep}>Keep this part</button>
                  ) : null}
                </div>
              </div>
            ) : null}
            {step === "build" || step === "sandbox" ? (
              <div className="tray">
                <p className="ask">{step === "sandbox" ? "Sandbox. Every earned piece is in the tray." : `${challenge.stages[Math.min(stage, challenge.stages.length - 1)]}. Drag a piece into place.`}</p>
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
            ) : null}
            {step === "test" || step === "diagnose" ? (
              <div className="test-side">
                <p className="ask">{step === "test" ? (phase === "holding" ? "Holding the last frame." : "Watch the test.") : report?.ok ? "The design met these numbers." : report?.failures[0]?.text}</p>
                {step === "diagnose" && report ? (
                  <div className="build-footer">
                    {report.numbers.map((item) => (
                      <p key={item.label}>{item.label}: {item.value}</p>
                    ))}
                    {report.ok ? <p>{craftStars(Boolean(extra), true).join(". ")}</p> : <p>{report.failures[0]?.followUp}</p>}
                    {report.ok ? (
                      <button type="button" className="check" onPointerUp={finishSuccess}>Next</button>
                    ) : (
                      <button type="button" className="check" onPointerUp={fix}>Try again</button>
                    )}
                  </div>
                ) : (
                  <button type="button" className="check" onPointerUp={() => { setFrame(0); setPhase("playing"); setReplay((count) => count + 1); }}>Replay</button>
                )}
              </div>
            ) : null}
          </div>
          {hint ? <p className="hint-line">{hint}</p> : null}
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
    </div>
  );
}

function families(challenges: Challenge[]): string[] {
  return [...new Set(challenges.map((item) => item.family))];
}

function familyChallenges(challenge: Challenge): Challenge[] {
  const machine = machines.find((item) => item.id === challenge.machine);
  return machine?.challenges.filter((item) => item.family === challenge.family) ?? [challenge];
}

function levelOpen(challenge: Challenge, completed: string[], map: Parameters<typeof challengeOpen>[3]): boolean {
  if (!challenge.ladderLevel) {
    return challengeOpen(familyChallenges(challenge), challenge.id, completed, map);
  }
  const machine = machines.find((item) => item.id === challenge.machine);
  const all = machine?.challenges ?? [challenge];
  const same = all.filter((item) => item.ladderLevel === challenge.ladderLevel);
  const index = same.findIndex((item) => item.id === challenge.id);
  const previous = all.filter((item) => item.ladderLevel === (challenge.ladderLevel ?? 1) - 1);
  const previousDone = previous.length > 0 && previous.every((item) => completed.includes(item.id));
  if (index <= 0 && (challenge.ladderLevel === 1 || previousDone)) {
    return challenge.ladderLevel === 1 ? challengeOpen(same, challenge.id, completed, map) : true;
  }
  if (index > 0 && completed.includes(same[index - 1].id)) {
    return true;
  }
  return challengeOpen(same, challenge.id, completed, map);
}

function limitLines(challenge: Challenge): string[] {
  if (challenge.machine === "bridge") {
    return [`Sag limit: ${challenge.scene.sagCap}.`, `Stress limit: ${challenge.scene.stressLimit}.`];
  }
  if (challenge.machine === "lever") {
    return [`Plank torque limit: ${challenge.scene.torqueLimit} N m.`];
  }
  const lines = [`Output turns per input turn: ${challenge.scene.goal}.`];
  if (challenge.scene.drum > 0) {
    lines.push(`Bucket height per crank is the drum circumference ${challenge.scene.drum} m divided by the ratio.`);
    lines.push(`Crank force is the load ${challenge.scene.load} divided by the ratio. Ideal, no friction.`);
  }
  if (challenge.scene.hourDriven > 0) {
    lines.push("Minute train: 60 to 1.");
    lines.push("Hour hand: 12 to 1.");
  }
  return lines;
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

function sceneSpan(challenge: Challenge): number {
  const scene = challenge.scene;
  return scene.gap || scene.plank || scene.driver || scene.driven || 8;
}

export function SceneCanvas({
  challenge,
  progress,
  angle,
  placed,
  slow,
}: {
  challenge: Challenge;
  progress: number;
  angle: number;
  placed: number;
  slow: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const sceneId = sceneIdFor(challenge);
  useEffect(() => {
    const canvas = ref.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) {
      return;
    }
    paintMachine(context as unknown as ScenePainter, {
      sceneId,
      span: sceneSpan(challenge),
      progress,
      angle,
      placed,
      slow,
      output: challenge.output,
      teethA: challenge.scene.driver,
      teethB: placed > 0 ? placed : challenge.scene.driven,
      load: challenge.scene.load,
    });
  }, [sceneId, challenge, progress, angle, placed, slow]);
  return (
    <canvas
      ref={ref}
      className="workshop-canvas"
      width={640}
      height={280}
      data-scene={sceneId}
      data-subjects={subjectsFor(sceneId).join(" ")}
      data-progress={String(progress)}
      data-output={challenge.output ?? ""}
    />
  );
}

function FamilyThumb({ family }: { family: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) {
      return;
    }
    const sceneId = sceneIdFor({ family });
    paintMachine(context as unknown as ScenePainter, { sceneId, span: 8, progress: 0.15, angle: 0.2, placed: 6, slow: false });
  }, [family]);
  return <canvas ref={ref} className="family-thumb" width={640} height={280} data-scene={sceneIdFor({ family })} />;
}

function TileMark({ state }: { state: "done" | "current" | "locked" }) {
  if (state === "done") {
    return <span className="tile-mark done" aria-hidden="true" />;
  }
  if (state === "locked") {
    return <span className="tile-mark locked" aria-hidden="true" />;
  }
  return <span className="tile-mark current" aria-hidden="true" />;
}

function DropLayer({
  tray,
  dragId,
  onDrop,
  allowExtra,
}: {
  tray: DesignPart[];
  dragId: string | null;
  onDrop: (part: DesignPart, slot: "main" | "extra") => void;
  allowExtra: boolean;
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
    <div className="drop-layer">
      <div className="drop-main" onDragOver={(event) => event.preventDefault()} onDrop={(event) => fromEvent(event, "main")} onPointerUp={() => dragId && take(dragId, "main")} />
      {allowExtra ? (
        <div className="drop-extra" onDragOver={(event) => event.preventDefault()} onDrop={(event) => fromEvent(event, "extra")} onPointerUp={() => dragId && take(dragId, "extra")} />
      ) : null}
    </div>
  );
}
