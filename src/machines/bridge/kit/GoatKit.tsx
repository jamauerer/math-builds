import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { LearnerMap } from "../../../engine/placement";
import {
  adaptiveAnswer,
  adaptiveAsk,
  beginAdaptive,
  gradeStartLevel,
  KIT_STRANDS,
  strandName,
  type AdaptiveRun,
  type GradeChoice,
} from "../../../engine/strand-placement";
import type { KitProfile } from "../../../storage/progress";
import {
  formatLength,
  formatWeight,
  lengthAbbrev,
  setUnitSystem,
  systemLabel,
  systemShort,
  weightAbbrev,
  type UnitSystem,
} from "../../../units";
import {
  answerEarn,
  blankEarn,
  currentQuestion,
  earnAtWord,
  earnHint,
  earnMeasure,
  earnPicture,
  earnPrompt,
  explainQuestion,
  finishedEarn,
  kitQuestionTotal,
  lessonFrame,
  questionForStrand,
  runLength,
  startGuided,
  startPractice,
  type EarnQuestion,
  type EarnState,
} from "../kits/earn";
import { knownLine, queenPost, typedLine, wreckLines } from "../kits/kit";
import { KIT_SKILLS, skillsFromLevels, type SkillBook } from "../kits/skills";
import { simulateCrossing, type CrossingFrame, type CrossingResult } from "../kits/simulate";
import "./goat.css";
import { bicycle, catapult, ramp, teeter, winch } from "./pick-svgs";
import { art, BridgeScene, CrossingPicture, frameNear, TrussThumb } from "./scene";

type Stage = "pick" | "intro" | "earn" | "assemble" | "drive" | "wreck" | "grade" | "place" | "place2" | "explain" | "practice" | "profile";
type Open = Stage | "faster";

const TRAY = [
  "bottom-a",
  "bottom-b",
  "post-a",
  "post-b",
  "top",
  "brace-a",
  "brace-b",
  "gussets",
  "bolts",
  "rails",
];

function slotById(id: string) {
  return queenPost.slots.find((slot) => slot.id === id);
}

function needsLength(id: string): boolean {
  const slot = slotById(id);
  return Boolean(slot && slot.length != null && !slot.bonus && slot.kind !== "rail");
}

export function GoatKit({
  map,
  marks,
  onMarks,
  start = "pick",
  seek = null,
  fault = null,
  units,
  onUnits,
  level = null,
  piece = null,
  word = false,
  lesson = null,
  unplaced = false,
  moment = null,
  drops = {},
  kitProfile = null,
  onKitProfile,
}: {
  map: LearnerMap;
  marks: number;
  onMarks: (marks: number) => void;
  start?: Open;
  seek?: number | null;
  fault?: "top" | "post" | "bottom" | null;
  units: UnitSystem;
  onUnits: (units: UnitSystem) => void;
  level?: number | null;
  piece?: string | null;
  word?: boolean;
  lesson?: string | null;
  unplaced?: boolean;
  moment?: string | null;
  drops?: Record<string, string>;
  kitProfile?: KitProfile | null;
  onKitProfile?: (profile: KitProfile) => void;
}) {
  setUnitSystem(units);
  void map;
  const savedLevels = strandLevels(level, kitProfile?.levels);
  const hasPlacement = !unplaced && (level != null || Object.keys(kitProfile?.levels ?? {}).length > 0);
  const [stage, setStage] = useState<Stage>(() => {
    const opened = start === "place2" ? "place" : start === "faster" ? "earn" : start;
    if (!hasPlacement && !lesson && (opened === "earn" || start === "explain" || start === "practice")) {
      return "grade";
    }
    return opened;
  });
  const [earn, setEarn] = useState<EarnState>(() => {
    if (word && piece) {
      return earnAtWord(savedLevels, piece);
    }
    if (!lesson && start !== "faster" && start !== "explain" && start !== "practice" && kitProfile?.session) {
      return kitProfile.session;
    }
    return openingEarn(savedLevels, start, lesson, kitProfile?.skills);
  });
  const [reveal, setReveal] = useState<EarnState | null>(null);
  const [celebrate, setCelebrate] = useState<string[] | null>(moment === "spin" && piece ? [piece] : null);
  const [pulse, setPulse] = useState<string | null>(moment === "lit" ? piece : null);
  const [run, setRun] = useState<AdaptiveRun | null>(() => openingRun(start));
  const [grade, setGrade] = useState<GradeChoice | null>(kitProfile?.grade ?? (start === "place" || start === "place2" || start === "profile" ? 3 : null));
  const [typed, setTyped] = useState("");
  const [lengths, setLengths] = useState<Record<string, string>>(() =>
    Object.keys(drops).length > 0 ? drops : { ...(kitProfile?.build?.lengths ?? {}), ...faultLengths(start, fault) },
  );
  const [placed, setPlaced] = useState<Record<string, boolean>>(() =>
    Object.keys(drops).length > 0
      ? Object.fromEntries(Object.keys(drops).map((id) => [id, true]))
      : { ...(kitProfile?.build?.placed ?? {}) },
  );
  const [drag, setDrag] = useState<string | null>(null);
  const [result, setResult] = useState<CrossingResult | null>(() => {
    if (start === "drive") {
      return simulateCrossing(numericLengths(filledLengths()));
    }
    if (start === "wreck" || fault) {
      return simulateCrossing(scenarioLengths(start, fault));
    }
    return null;
  });
  const [mass, setMass] = useState(40);
  const [badge, setBadge] = useState(start === "wreck");
  const awarded = useRef(start === "drive");
  const askedAt = useRef(Date.now());
  const view = reveal ?? earn;
  const earnedGroups =
    moment === "lit" && piece ? [...new Set([...view.earned, piece])] : view.earned;
  const promptKey = `${view.phase}:${view.groupIndex}:${view.runGot}:${view.practiceIndex}:${view.current.answer}`;

  useEffect(() => {
    askedAt.current = Date.now();
  }, [promptKey]);

  function openEarn() {
    if (!hasPlacement) {
      setStage("grade");
      return;
    }
    if (!kitProfile?.seenIntro && !kitProfile?.session) {
      setStage("intro");
      return;
    }
    if (kitProfile?.session) {
      setEarn(kitProfile.session);
      setReveal(null);
    }
    setStage("earn");
  }

  function saveKit(next: EarnState, seenIntro = kitProfile?.seenIntro === true) {
    if (!onKitProfile || lesson || word || moment || Object.keys(drops).length > 0) {
      return;
    }
    onKitProfile({
      grade: kitProfile?.grade ?? grade,
      levels: Object.keys(kitProfile?.levels ?? {}).length > 0 ? (kitProfile?.levels ?? {}) : (savedLevels ?? {}),
      history: kitProfile?.history ?? [],
      notes: kitProfile?.notes ?? [],
      lastRunMs: next.phase === "done" ? next.timesMs.reduce((sum, time) => sum + time, 0) : kitProfile?.lastRunMs,
      skills: next.book,
      seenIntro,
      session: next.phase === "done" ? undefined : next,
      build: { lengths, placed },
    });
  }

  useEffect(() => {
    if (stage === "earn" || stage === "assemble") {
      saveKit(earn, true);
    }
  }, [earn, stage, lengths, placed]);

  function remember(
    question: EarnQuestion,
    correct: boolean,
    levels = savedLevels ?? {},
    note: string | null = null,
    lastRunMs = kitProfile?.lastRunMs,
    skills: SkillBook | undefined = undefined,
  ) {
    if (!onKitProfile) {
      return;
    }
    const history = [
      ...(kitProfile?.history ?? []),
      { strandId: question.strandId, level: question.level, prompt: earnPrompt(question), correct },
    ].slice(-80);
    const notes = note ? [...(kitProfile?.notes ?? []), note] : (kitProfile?.notes ?? []);
    onKitProfile({
      grade: kitProfile?.grade ?? grade,
      levels,
      history,
      notes,
      lastRunMs,
      skills: skills ?? kitProfile?.skills,
      seenIntro: kitProfile?.seenIntro,
      session: kitProfile?.session,
      build: kitProfile?.build,
    });
  }

  function finishMoment() {
    setCelebrate((current) => {
      if (!current || current.length === 0) {
        return null;
      }
      setPulse(current[0]);
      if (current.length === 1) {
        setReveal(null);
        return null;
      }
      return current.slice(1);
    });
  }

  function submitAnswer() {
    const question = currentQuestion(earn);
    const elapsed = earn.phase === "plain" ? Math.max(0, Date.now() - askedAt.current) : 0;
    const next = answerEarn(earn, typed, savedLevels ?? {}, elapsed, kitProfile?.lastRunMs ?? null);
    const fresh = next.correct ? next.state.earned.filter((id) => !earn.earned.includes(id)) : [];
    setTyped("");
    if (fresh.length > 0) {
      setReveal(earn);
      setEarn(next.state);
      setCelebrate(fresh);
    } else {
      setReveal(null);
      setEarn(next.state);
    }
    if (next.marksDelta > 0) {
      onMarks(marks + next.marksDelta);
    }
    if (question) {
      const lastRunMs = next.state.phase === "done" ? next.state.timesMs.reduce((sum, time) => sum + time, 0) : kitProfile?.lastRunMs;
      remember(question, next.correct, next.levels, next.note, lastRunMs, next.state.book);
    }
  }

  function submitPlace() {
    if (!run) {
      return;
    }
    const ask = adaptiveAsk(run);
    const question = questionForStrand(ask.strandId, ask.level, ask.number);
    const correct = typed.trim() === question.answer;
    const stepped = adaptiveAnswer(run, correct);
    setTyped("");
    const history = [
      ...(kitProfile?.history ?? []),
      { strandId: ask.strandId, level: ask.level, prompt: earnPrompt(question), correct },
    ].slice(-80);
    if (stepped.levels) {
      onKitProfile?.({
        grade: grade ?? "unsure",
        levels: stepped.levels,
        history,
        notes: kitProfile?.notes ?? [],
        lastRunMs: kitProfile?.lastRunMs,
        skills: skillsFromLevels(stepped.levels),
      });
      setEarn(blankEarn(stepped.levels));
      setStage("profile");
      return;
    }
    onKitProfile?.({
      grade: grade ?? "unsure",
      levels: kitProfile?.levels ?? {},
      history,
      notes: kitProfile?.notes ?? [],
      lastRunMs: kitProfile?.lastRunMs,
      skills: kitProfile?.skills,
    });
    setRun(stepped.run);
  }

  function place(id: string, drop: string | null) {
    if (!drop) {
      return;
    }
    if (id === "gussets" && drop.startsWith("node-")) {
      for (const slot of queenPost.slots.filter((item) => item.kind === "gusset")) {
        setPlaced((current) => ({ ...current, [slot.id]: true }));
      }
      setPlaced((current) => ({ ...current, gussets: true }));
      return;
    }
    if (id === "bolts" && (drop === "bolts" || drop.startsWith("node-"))) {
      setPlaced((current) => ({ ...current, bolts: true }));
      return;
    }
    if (id === "rails" && (drop === "rails" || drop.startsWith("node-") || drop.startsWith("bottom"))) {
      setPlaced((current) => ({ ...current, rails: true, "rail-a": true, "rail-b": true }));
      return;
    }
    if (drop === id) {
      setPlaced((current) => ({ ...current, [id]: true }));
    }
  }

  function onTrayUp(event: ReactPointerEvent<HTMLElement>, id: string) {
    const target = document.elementFromPoint(event.clientX, event.clientY);
    const drop = target?.closest("[data-drop]")?.getAttribute("data-drop") ?? null;
    if (needsLength(id) && !Number(lengths[id])) {
      setDrag(null);
      return;
    }
    place(id, drop);
    setDrag(null);
  }

  function sendGoat(nextMass = mass) {
    const numbers = numericLengths(lengths);
    const crossing = simulateCrossing(numbers, nextMass);
    setMass(nextMass);
    setResult(crossing);
    setStage("drive");
    if (crossing.ok) {
      if (!awarded.current) {
        awarded.current = true;
        onMarks(marks + queenPost.marks);
      }
      return;
    }
    if (!badge) {
      setBadge(true);
    }
  }

  const shown = result;
  const active = stage === "wreck" ? "drive" : stage === "explain" || stage === "practice" ? "earn" : stage;
  const trayLeft = TRAY.filter((id) => !placed[id]).length;

  return (
    <div className="goat-kit" data-stage={stage}>
      {stage === "pick" ? (
        <Pick marks={marks} units={units} onUnits={onUnits} onProfile={() => setStage(kitProfile?.grade == null ? "grade" : "profile")} onOpen={openEarn} />
      ) : stage === "grade" ? (
        <GradePick
          marks={marks}
          units={units}
          onUnits={onUnits}
          onProfile={() => setStage("pick")}
          onChoose={(choice) => {
            setGrade(choice);
            setRun(beginAdaptive(gradeStartLevel(choice)));
            setTyped("");
            setStage("place");
          }}
        />
      ) : stage === "place" && run ? (
        <PlaceView
          marks={marks}
          units={units}
          onUnits={onUnits}
          onProfile={() => setStage("profile")}
          run={run}
          typed={typed}
          setTyped={setTyped}
          onCheck={submitPlace}
        />
      ) : stage === "profile" ? (
        <ProfileView
          marks={marks}
          units={units}
          onUnits={onUnits}
          profile={unplaced ? { grade: null, levels: {}, history: [], notes: [] } : shownProfile(kitProfile)}
          onRetake={() => setStage("grade")}
          onBack={() => setStage("pick")}
        />
      ) : (
        <>
          <header className="gk-header">
            <button className="gk-codex" type="button" onClick={() => setStage("pick")}>
              Codex
            </button>
            <div>
              <div className="gk-title">The Goat Bridge</div>
              <div className="gk-sub">{subtitle(stage)}</div>
            </div>
            <div className="gk-chips">
              {(["pick", "earn", "assemble", "drive"] as const).map((chip) => (
                <button
                  key={chip}
                  className={chip === active || (chip === "earn" && active === "earn") ? `gk-chip${chip === active ? " on" : ""}` : "gk-chip"}
                  type="button"
                  onClick={() => {
                    if (chip === "pick") {
                      setStage("pick");
                    } else if (chip === "earn") {
                      openEarn();
                    } else if (chip === "assemble") {
                      setStage("assemble");
                    } else if (shown) {
                      setStage(shown.ok ? "drive" : "wreck");
                    }
                  }}
                >
                  {chip === "pick" ? "Pick" : chip === "earn" ? "Earn pieces" : chip === "assemble" ? "Assemble" : "Drive"}
                </button>
              ))}
            </div>
            <Account marks={marks} units={units} onUnits={onUnits} onProfile={() => setStage(kitProfile?.grade == null ? "grade" : "profile")} />
          </header>
          {stage === "intro" ? (
            <IntroView
              onStart={() => {
                saveKit(earn, true);
                setStage("earn");
              }}
            />
          ) : null}
          {stage === "earn" || stage === "explain" || stage === "practice" ? (
            <EarnView
              earn={view}
              typed={typed}
              setTyped={setTyped}
              fading={celebrate != null}
              pulse={pulse}
              onCheck={submitAnswer}
              onPractice={() => {
                setEarn(startPractice(earn));
                setTyped("");
              }}
              onLearn={() => {
                const next = startGuided(earn);
                setEarn(next);
                onKitProfile?.({
                  grade: kitProfile?.grade ?? grade,
                  levels: savedLevels ?? kitProfile?.levels ?? {},
                  history: kitProfile?.history ?? [],
                  notes: kitProfile?.notes ?? [],
                  lastRunMs: kitProfile?.lastRunMs,
                  skills: next.book,
                  seenIntro: kitProfile?.seenIntro,
                  session: next,
                  build: kitProfile?.build,
                });
              }}
              onBuild={() => setStage("assemble")}
              earned={earnedGroups}
            />
          ) : null}
          {celebrate && (stage === "earn" || stage === "explain" || stage === "practice") ? (
            <PieceMoment groupId={celebrate[0]} frozen={moment === "spin"} onDone={finishMoment} />
          ) : null}
          {stage === "assemble" ? (
            <AssembleView
              lengths={lengths}
              placed={placed}
              drag={drag}
              trayLeft={trayLeft}
              geometryLevel={savedLevels?.geometry ?? kitProfile?.levels.geometry ?? 4}
              onLength={(id, value) => setLengths((current) => ({ ...current, [id]: value }))}
              onDrag={setDrag}
              onUp={onTrayUp}
              onSend={() => sendGoat(40)}
            />
          ) : null}
          {stage === "drive" && shown ? (
            <DriveView
              result={shown}
              seek={seek}
              onHeavy={() => sendGoat(mass * 2)}
              onNext={() => setStage("pick")}
              onSettled={() => {
                if (!shown.ok) {
                  setStage("wreck");
                }
              }}
            />
          ) : null}
          {stage === "wreck" && shown ? (
            <WreckView
              result={shown}
              lengths={lengths}
              badge={badge}
              onAgain={() => setStage("drive")}
              onBack={() => {
                setPlaced({});
                setStage("assemble");
              }}
            />
          ) : null}
        </>
      )}
    </div>
  );
}

function subtitle(stage: Stage): string {
  if (stage === "earn" || stage === "explain" || stage === "practice") {
    return "Answer, and the kit fills up.";
  }
  if (stage === "intro") {
    return "Every right answer earns a piece.";
  }
  if (stage === "assemble") {
    return "Every piece needs a number.";
  }
  if (stage === "drive") {
    return "Send the goat.";
  }
  return "Well. That happened.";
}

function Account({
  marks,
  units,
  onUnits,
  onProfile,
}: {
  marks: number;
  units: UnitSystem;
  onUnits: (units: UnitSystem) => void;
  onProfile: () => void;
}) {
  return (
    <>
      <div className="gk-marks">
        <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
          <circle cx="14" cy="14" r="12" fill="#F2B544" />
          <circle cx="14" cy="14" r="8" fill="none" stroke="#9A6A12" strokeWidth="1.5" />
          <text x="14" y="18" textAnchor="middle" fontFamily="Fraunces, serif" fontSize="12" fontWeight="800" fill="#9A6A12">
            M
          </text>
        </svg>
        {marks} marks
        <div className="gk-unit-toggle" role="group" aria-label="Units">
          {(["us", "metric"] as const).map((choice) => (
            <button key={choice} type="button" className={choice === units ? "on" : ""} onClick={() => onUnits(choice)}>
              {systemShort(choice)}
            </button>
          ))}
        </div>
      </div>
      <div className="gk-profile-wrap">
        <button className="gk-profile" type="button" onClick={onProfile}>
          <div className="gk-avatar">M</div>
          Maya
        </button>
      </div>
    </>
  );
}

function Pick({
  marks,
  units,
  onUnits,
  onProfile,
  onOpen,
}: {
  marks: number;
  units: UnitSystem;
  onUnits: (units: UnitSystem) => void;
  onProfile: () => void;
  onOpen: () => void;
}) {
  return (
    <>
      <header className="gk-header">
        <div className="gk-logo">
          <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true">
            <path d="M4 28 H32 M10 28 L18 10 L26 28 M18 10 V28" fill="none" stroke="#22201C" strokeWidth="2" />
            <circle cx="28" cy="10" r="5" fill="#E0661A" />
          </svg>
          Math Builds
        </div>
        <Account marks={marks} units={units} onUnits={onUnits} onProfile={onProfile} />
      </header>
      <div className="gk-pick">
        <h1>What will you build?</h1>
        <p className="gk-sub">Pick one. Earn the pieces, give each one a number, build it, send the goat.</p>
        <div className="gk-strands">
          <span className="gk-strand" style={{ background: "#E8F3EA", color: "#1F6B3A" }}>
            Measuring 7
          </span>
          <span className="gk-strand" style={{ background: "#E8F3EA", color: "#1F6B3A" }}>
            Adding 7
          </span>
          <span className="gk-strand" style={{ background: "#E8F3EA", color: "#1F6B3A" }}>
            Dividing 5
          </span>
          <span className="gk-strand" style={{ background: "#FFF3DA", color: "#9A6A12" }}>
            Fractions 4
          </span>
          <span className="gk-strand" style={{ background: "#F1EFEA", color: "#6B6459" }}>
            Ratios 2
          </span>
        </div>
        <div className="gk-grid">
          <button className="gk-card-btn" type="button" onClick={onOpen}>
            <TrussThumb />
            <div className="meta">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <h3>The Goat Bridge</h3>
                <span className="gk-pill" style={{ background: "#E8F3EA", color: "#1F6B3A" }}>
                  Queen-post truss
                </span>
              </div>
              <div style={{ fontSize: 14, color: "#6B6459" }}>An {formatLength(8)} queen-post truss. Earn the pieces, give each one a length, send the goat.</div>
              <div className="gk-progress">
                <div style={{ flex: 1, height: 8, borderRadius: 99, background: "#F1EFEA", overflow: "hidden" }}>
                  <i style={{ width: "8%" }} />
                </div>
                <span className="gk-sub">start</span>
              </div>
            </div>
          </button>
          <LockedCard title="The Teeter Totter" note="Comparing, multiplying, balance. Later moments and unknown masses." pill="Level 3 of 13" thumb={teeter} />
          <LockedCard title="The Well Winch" note="Counting teeth, ratios, fractions of a turn. Later torque and clockwork." pill="Not started" thumb={winch} />
          <LockedCard title="The Mountain Ramp" note="Rise over run, angles, how steep a car can climb. Later speed and energy." pill="Not started" thumb={ramp} />
          <LockedCard title="The Bicycle" note="Gear ratios, wheel size, how far one pedal turn takes you." pill="Opens at Ratios 3" locked thumb={bicycle} />
          <LockedCard title="The Catapult" note="Arm ratios, angles, how far it flies. Later trajectories." pill="Opens at Angles 1" locked thumb={catapult} />
        </div>
      </div>
    </>
  );
}

function LockedCard({
  title,
  note,
  pill,
  locked,
  thumb,
}: {
  title: string;
  note: string;
  pill: string;
  locked?: boolean;
  thumb: string;
}) {
  return (
    <button className={locked ? "gk-card-btn locked" : "gk-card-btn"} type="button">
      <div className="gk-thumb" style={{ background: "#F7F3EC" }} dangerouslySetInnerHTML={{ __html: thumb.split(" kg").join(` ${weightAbbrev()}`).split(" m<").join(` ${lengthAbbrev()}<`) }} />
      <div className="meta">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h3>{title}</h3>
          <span className="gk-pill" style={{ background: locked ? "#FBE9E4" : "#F1EFEA", color: locked ? "#B3452B" : "#6B6459" }}>
            {pill}
          </span>
        </div>
        <div style={{ fontSize: 14, color: "#6B6459" }}>{note}</div>
      </div>
    </button>
  );
}

function EarnView({
  earn,
  typed,
  setTyped,
  fading,
  pulse,
  onCheck,
  onPractice,
  onLearn,
  onBuild,
  earned,
}: {
  earn: EarnState;
  typed: string;
  setTyped: (value: string) => void;
  fading?: boolean;
  pulse?: string | null;
  onCheck: () => void;
  onPractice: () => void;
  onLearn: () => void;
  onBuild: () => void;
  earned: string[];
}) {
  const question = earn.phase === "done" ? null : currentQuestion(earn);
  const groupId = question?.groupId ?? earn.current.groupId;
  const picture = question ? earnPicture(question) : null;
  const hint = question ? earnHint(question) : "";
  const keys = question ? keysFor(question.answer) : [];
  if (earn.phase === "done") {
    return (
      <div className="gk-body">
        <div className="gk-earn">
          <div className="gk-card">
            <h2 className="gk-prompt">The kit is earned.</h2>
            {earn.speedLine ? <p className="gk-speed">{earn.speedLine}</p> : null}
            <button className="gk-check" type="button" onClick={onBuild}>
              Build it
            </button>
          </div>
          <EarnedBar steps={earn.steps} />
          <GoatWait />
        </div>
        <KitPanel earned={earned} pulse={pulse} />
      </div>
    );
  }
  if (earn.phase === "learn") {
    const explained = explainQuestion(earn.current);
    const skill = KIT_SKILLS.find((item) => item.id === earn.current.skillId);
    return (
      <div className="gk-body">
        <div className="gk-earn">
          <div className="gk-card">
            <div className="gk-kicker">
              <span>Learn</span>
              <span>{skill?.name}</span>
            </div>
            <h2 className="gk-prompt">{earnPrompt(earn.current)}</h2>
            <div className="gk-steps">
              {explained.steps.map((step) => (
                <p className="gk-note" key={step}>
                  {step}
                </p>
              ))}
            </div>
            <p>{explained.why}</p>
            <button className="gk-check" type="button" onClick={onLearn}>
              Try 3 questions
            </button>
          </div>
          <EarnedBar steps={earn.steps} />
          <GoatWait />
        </div>
        <KitPanel earned={earned} current={earn.current.groupId} pulse={pulse} />
      </div>
    );
  }
  if (!question) {
    return null;
  }
  if (earn.phase === "explain") {
    const explained = explainQuestion(question);
    return (
      <div className="gk-body">
        <div className="gk-earn">
          <div className="gk-card">
            <div className="gk-kicker">
              <span>{strandName(question.strandId)}</span>
              <span>then three practice questions</span>
            </div>
            <h2 className="gk-prompt">{earnPrompt(question)}</h2>
            {picture ? <EarnSketch question={question} /> : null}
            <div className="gk-steps">
              {explained.steps.map((step) => (
                <p className="gk-note" key={step}>
                  {step}
                </p>
              ))}
            </div>
            <p>{explained.why}</p>
            <button className="gk-check" type="button" onClick={onPractice}>
              Try 3 practice questions
            </button>
          </div>
        </div>
        <KitPanel earned={earned} current={groupId} pulse={pulse} />
      </div>
    );
  }
  const counter =
    earn.phase === "practice"
      ? `${earn.streak + 1} of 3`
      : earn.phase === "word"
        ? "Word problem"
        : earn.phase === "warmup"
          ? `${earn.runGot + 1} of 5`
          : earn.phase === "guided"
            ? `${earn.runGot + 1} of 3`
            : `${earn.runGot + 1} of ${runLength(groupId)}`;
  const openHint = earn.phase === "guided" ? earn.current.hint || hint : hint;
  return (
    <div className="gk-body">
      <div className="gk-earn">
        <div className={fading ? "gk-card is-fading" : "gk-card"}>
          <div className="gk-kicker">
            <span>{counter}</span>
          </div>
          <h2 className="gk-prompt">{earnPrompt(question)}</h2>
          {picture ? <EarnSketch question={question} /> : null}
          {openHint ? <p className="gk-hint">{openHint}</p> : null}
          <div className="gk-answer">
            <input aria-label="Answer" value={typed} onChange={(event) => setTyped(event.target.value)} />
            <span className="gk-unit">{earnMeasure(question) === "weight" ? weightAbbrev() : earnMeasure(question) === "length" ? lengthAbbrev() : ""}</span>
            <button className="gk-check" type="button" onClick={onCheck}>
              Check
            </button>
          </div>
          <div className="gk-keys">
            {keys.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setTyped(key === "←" ? typed.slice(0, -1) : key === "−" ? `${typed}-` : `${typed}${key}`)}
              >
                {key}
              </button>
            ))}
          </div>
        </div>
        <EarnedBar steps={earn.steps} />
        <GoatWait />
      </div>
      <KitPanel earned={earned} current={groupId} pulse={pulse} />
    </div>
  );
}

function keysFor(answer: string): string[] {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
  if (answer.includes(".")) {
    keys.push(".");
  }
  if (answer.startsWith("-")) {
    keys.push("−");
  }
  keys.push("←");
  return keys;
}

function EarnedBar({ steps }: { steps: number }) {
  const total = kitQuestionTotal();
  return (
    <div>
      <div className="gk-kicker">EARNED SO FAR</div>
      <div className="gk-bar">
        <i style={{ width: `${(steps / total) * 100}%` }} />
      </div>
      <p className="gk-muted">
        {steps} of {total}
      </p>
    </div>
  );
}

function GoatWait() {
  return (
    <div className="gk-goat-line">
      <img src={art("goat-idle.png")} alt="" />
      <p className="gk-note">The goat waits on the bank.</p>
    </div>
  );
}

function IntroView({ onStart }: { onStart: () => void }) {
  return (
    <div className="gk-intro">
      <BridgeScene placed={{}} lengths={{}} goat={{ src: "goat-idle.png", left: 120, top: 205, width: 149, height: 150 }} />
      <div className="gk-intro-card">
        <p>{queenPost.intro}</p>
        <button className="gk-check" type="button" onClick={onStart}>
          Start
        </button>
      </div>
    </div>
  );
}

function PieceMoment({ groupId, frozen, onDone }: { groupId: string; frozen: boolean; onDone: () => void }) {
  const done = useRef(onDone);
  done.current = onDone;
  const imgRef = useRef<HTMLImageElement>(null);
  const group = queenPost.groups.find((item) => item.id === groupId) ?? queenPost.groups[0];
  useEffect(() => {
    if (frozen) {
      return;
    }
    const spin = window.setTimeout(() => {
      const img = imgRef.current;
      const row = document.querySelector(`[data-group="${group.id}"] img`);
      if (img && row) {
        const from = img.getBoundingClientRect();
        const to = row.getBoundingClientRect();
        const dx = to.left + to.width / 2 - (from.left + from.width / 2);
        const dy = to.top + to.height / 2 - (from.top + from.height / 2);
        const scale = Math.max(0.18, to.width / Math.max(from.width, 1));
        img.style.animation = "none";
        img.style.transition = "transform 1.3s ease-in-out";
        img.style.transform = `translate(${dx}px, ${dy}px) scale(${scale}) rotate(360deg)`;
      }
    }, 1200);
    const finish = window.setTimeout(() => done.current(), 2500);
    return () => {
      window.clearTimeout(spin);
      window.clearTimeout(finish);
    };
  }, [frozen, group.id]);
  return (
    <button className="gk-celebrate" type="button" onClick={() => done.current()}>
      <img ref={imgRef} className={frozen ? "mid" : undefined} src={art(group.sprite)} alt="" />
      <h2>You earned the {group.name.toLowerCase()}!</h2>
    </button>
  );
}

function EarnSketch({ question }: { question: EarnQuestion }) {
  const picture = earnPicture(question);
  if (!picture) {
    return null;
  }
  return (
    <div className="gk-qpic" data-picture={question.fact.kind}>
      <div className="gk-qstage">
        {picture.banks ? <img className="gk-qbanks" src={art("banks.png")} alt="" /> : null}
        {picture.ruler ? <RulerStrip /> : null}
        {picture.bits.map((bit, index) => (
          <img
            key={`${bit.sprite}-${index}`}
            alt=""
            src={art(bit.sprite)}
            style={{
              position: "absolute",
              left: bit.x,
              top: bit.y,
              width: bit.w,
              height: bit.h,
              transform: bit.rotate ? `rotate(${bit.rotate}deg)` : undefined,
              transformOrigin: "0 0",
            }}
          />
        ))}
        {picture.labels.map((label) => (
          <span key={`${label.text}-${label.x}`} className="gk-qlabel" style={{ left: label.x, top: label.y }}>
            {label.text}
          </span>
        ))}
        {picture.measure ? (
          <span className="gk-measure" style={{ left: picture.measure.x, top: picture.measure.y, width: picture.measure.w }}>
            {picture.measure.text}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function RulerStrip() {
  return (
    <>
      <div className="gk-qline" />
      {[0, 2, 4, 6, 8].map((mark) => (
        <span key={mark} className="gk-qtick" style={{ left: 24 + mark * 55, top: 144 }}>
          {mark} {lengthAbbrev()}
        </span>
      ))}
    </>
  );
}

function KitPanel({ earned, current, pulse }: { earned: string[]; current?: string; pulse?: string | null }) {
  return (
    <aside className="gk-panel">
      <h2>Your kit</h2>
      <p className="gk-muted">greyed = not yet earned</p>
      {queenPost.groups.map((group) => {
        const have = earned.includes(group.id);
        const now = group.id === current && !have;
        const state = have ? "earned" : now ? "current" : "locked";
        return (
          <div key={group.id} data-group={group.id} className={`gk-row ${state}${pulse === group.id ? " pulse" : ""}`}>
            <img src={art(group.sprite)} alt="" />
            <div>
              <b>
                {group.name} ×{group.count}
              </b>
              <span>{group.blurb}</span>
            </div>
            {have ? <span className="gk-ok">earned</span> : null}
            {now ? <span className="gk-wait">answer to earn</span> : null}
            {!have && !now ? <span className="gk-wait">later</span> : null}
          </div>
        );
      })}
    </aside>
  );
}

function AssembleView({
  lengths,
  placed,
  drag,
  trayLeft,
  geometryLevel,
  onLength,
  onDrag,
  onUp,
  onSend,
}: {
  lengths: Record<string, string>;
  placed: Record<string, boolean>;
  drag: string | null;
  trayLeft: number;
  geometryLevel: number;
  onLength: (id: string, value: string) => void;
  onDrag: (id: string | null) => void;
  onUp: (event: ReactPointerEvent<HTMLElement>, id: string) => void;
  onSend: () => void;
}) {
  const numbers = numericLengths(lengths);
  const lines = TRAY.flatMap((id) => {
    const slot = slotById(id);
    const line = typedLine(slot?.name ?? id, lengths[id] ?? "");
    return line ? [{ id, line }] : [];
  });
  return (
    <div className="gk-body">
      <div className="gk-scene-col">
        <BridgeScene
          placed={placed}
          lengths={numbers}
          drops
          geometryLevel={geometryLevel}
          goat={{ src: "goat-idle.png", left: 120, top: 205, width: 149, height: 150 }}
        />
        <div className="gk-strip">
          <p className="gk-known">{knownLine()}</p>
          {lines.map((item) => (
            <p className="gk-work" key={item.id}>
              {item.line}
            </p>
          ))}
          <div className="gk-actions">
            <button className="gk-send" type="button" disabled={trayLeft > 0} onClick={onSend}>
              Send the goat
            </button>
            <span className="gk-caption">{trayLeft === 0 ? "The tray is empty." : `${trayLeft} pieces still in the tray`}</span>
          </div>
        </div>
      </div>
      <aside className="gk-panel" data-drag={drag ?? ""}>
        <h2>Kit tray</h2>
        <p className="gk-muted">Drag a piece onto its dotted line.</p>
        {TRAY.map((id) => {
          const slot = id === "gussets" || id === "bolts" || id === "rails" ? null : slotById(id);
          const group = queenPost.groups.find((item) => item.id === (slot?.group ?? id));
          const sprite = slot?.sprite ?? group?.sprite ?? "beam-side.png";
          const name = id === "gussets" ? "Gusset plate ×5" : id === "bolts" ? "Bolts ×10" : id === "rails" ? "Railing ×2" : slot?.name;
          return (
            <div
              key={id}
              className={`gk-row ${placed[id] ? "earned" : ""}`}
              draggable={false}
              onPointerDown={(event) => {
                if (placed[id]) {
                  return;
                }
                onDrag(id);
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerUp={(event) => onTrayUpSafe(event, id, placed, onUp)}
            >
              <img src={art(sprite)} alt="" />
              <div>
                <b>{name}</b>
                <span>{placed[id] ? "on the bridge" : "in the tray"}</span>
              </div>
              {slot && slot.length != null && !slot.bonus ? (
                <input
                  className={lengths[id] ? "gk-len" : "gk-len empty"}
                  aria-label={`${name} length`}
                  value={lengths[id] ?? ""}
                  placeholder="?"
                  onPointerDown={(event) => event.stopPropagation()}
                  onChange={(event) => onLength(id, event.target.value)}
                />
              ) : null}
            </div>
          );
        })}
      </aside>
    </div>
  );
}

function onTrayUpSafe(
  event: ReactPointerEvent<HTMLElement>,
  id: string,
  placed: Record<string, boolean>,
  onUp: (event: ReactPointerEvent<HTMLElement>, id: string) => void,
) {
  if (placed[id]) {
    return;
  }
  onUp(event, id);
}

function DriveView({
  result,
  seek,
  onHeavy,
  onNext,
  onSettled,
}: {
  result: CrossingResult;
  seek: number | null;
  onHeavy: () => void;
  onNext: () => void;
  onSettled: () => void;
}) {
  const held = seek == null ? null : frameNear(result.frames, seek);
  const frame = usePlayback(result, held, onSettled);
  return (
    <div className="gk-body">
      <div className="gk-scene-col">
        <CrossingPicture frame={frame} />
        <div className="gk-strip">
          <p>Every piece fit. The goat is halfway, the posts are holding, nothing is bending.</p>
          <div className="gk-actions">
            <button className="gk-light" type="button" onClick={onHeavy}>
              Add a heavier goat
            </button>
            <button className="gk-dark" type="button" onClick={onNext}>
              Next design
            </button>
          </div>
        </div>
      </div>
      <aside className="gk-panel">
        <h2>How it is doing</h2>
        <div className="gk-load">
          <small>LOAD ON THE BRIDGE</small>
          <strong>{formatWeight(result.massKg)}</strong>
          <span className="gk-muted">{result.massKg === 40 ? "one goat" : "a heavier goat"}</span>
          <div className="gk-bar">
            <i style={{ width: `${result.loadPercent}%`, background: "#3C7A2B" }} />
          </div>
          <p className="gk-muted">holds up to about {formatWeight(180)}</p>
        </div>
        <p className="gk-muted">Who is working hardest</p>
        {result.members.slice(0, 3).map((member) => (
          <div key={member.name} className="gk-row earned">
            <div>
              <b>{member.name}</b>
              <span className="gk-good">
                {member.job}, fine
              </span>
            </div>
          </div>
        ))}
        <p className="gk-note">Try the heavy goat. Something will go first. Guess which.</p>
        <div className="gk-award">
          <b>+{queenPost.marks} marks · Queen post, built</b>
          <div>Railing unlocked for the next kit</div>
        </div>
      </aside>
    </div>
  );
}

function WreckView({
  result,
  lengths,
  badge,
  onAgain,
  onBack,
}: {
  result: CrossingResult;
  lengths: Record<string, string>;
  badge: boolean;
  onAgain: () => void;
  onBack: () => void;
}) {
  const numbers = { ...numericLengths(filledLengths()), ...numericLengths(lengths) };
  const lines = wreckLines(numbers);
  const frame = result.frames[result.frames.length - 1];
  return (
    <div className="gk-body">
      <div className="gk-scene-col">
        {frame ? <CrossingPicture frame={frame} /> : null}
        <div className="gk-strip">
          <p>
            {numbers.top === 3
              ? `Top beam was ${formatLength(3)}. The posts are ${formatLength(4)} apart. The right post had nothing to hold on to. The goat is fine. Mostly.`
              : `${lines[0] ?? "A piece let go."} The goat is fine. Mostly.`}
          </p>
          <div className="gk-actions">
            <button className="gk-light" type="button" onClick={onAgain}>
              Watch it again
            </button>
            <button className="gk-dark" type="button" onClick={onBack}>
              Back to the kit
            </button>
          </div>
        </div>
      </div>
      <aside className="gk-panel" data-wreck="panel">
        <h2>What went wrong</h2>
        {lines.map((line) => (
          <div key={line} className="gk-row">
            <div>
              <b>{line}</b>
            </div>
            <span className="gk-bad">{line.includes("fine") ? "" : line.includes("short") || line.includes("fell") ? line.split(", ").slice(-1)[0] : ""}</span>
          </div>
        ))}
        <div className="gk-row earned">
          <div>
            <b>Goat</b>
            <span>wet, dignity bruised</span>
          </div>
          <span className="gk-good">fine</span>
        </div>
        <p className="gk-note">You keep all your pieces. Only the number changes.</p>
        {badge ? (
          <div className="gk-badge">
            <b>Wreck it · badge earned</b>
            <div>Every engineer breaks one on purpose.</div>
          </div>
        ) : null}
        <p className="gk-muted">Marks stay at the last award. This crossing added none. Load was {formatWeight(result.massKg)}.</p>
      </aside>
    </div>
  );
}

function usePlayback(result: CrossingResult, held: CrossingFrame | null, onSettled: () => void): CrossingFrame {
  const [frame, setFrame] = useState<CrossingFrame>(held ?? result.frames[0]);
  const settled = useRef(onSettled);
  settled.current = onSettled;
  useEffect(() => {
    if (held || import.meta.env.VITEST) {
      setFrame(held ?? result.frames[0]);
      return;
    }
    let raf = 0;
    let done = false;
    const started = performance.now();
    const last = result.frames[result.frames.length - 1];
    const tick = (now: number) => {
      const elapsed = (now - started) / 1000;
      let chosen = result.frames[0];
      for (const item of result.frames) {
        if (item.t <= elapsed) {
          chosen = item;
        } else {
          break;
        }
      }
      setFrame(chosen);
      if (!last || elapsed < last.t) {
        raf = requestAnimationFrame(tick);
        return;
      }
      if (!result.ok && !done) {
        done = true;
        settled.current();
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [held, result]);
  return frame;
}

function faultLengths(start: Open, fault: "top" | "post" | "bottom" | null): Record<string, string> {
  if (fault === "post") {
    return { "post-a": "1" };
  }
  if (fault === "bottom") {
    return { "bottom-a": "3" };
  }
  if (fault === "top" || start === "wreck") {
    return { top: "3" };
  }
  return {};
}

function scenarioLengths(start: Open, fault: "top" | "post" | "bottom" | null): Record<string, number> {
  return { ...numericLengths(filledLengths()), ...numericLengths(faultLengths(start, fault)) };
}

function filledLengths(): Record<string, string> {
  const lengths: Record<string, string> = {};
  for (const slot of queenPost.slots) {
    if (slot.length != null) {
      lengths[slot.id] = String(slot.length);
    }
  }
  return lengths;
}

function strandLevels(level: number | null, saved: Record<string, number> | undefined): Record<string, number> | null {
  if (level != null) {
    const all: Record<string, number> = {};
    for (const id of KIT_STRANDS) {
      all[id] = level;
    }
    return all;
  }
  if (saved && Object.keys(saved).length > 0) {
    return saved;
  }
  return null;
}

function openingEarn(levels: Record<string, number> | null, start: Open, lesson: string | null, saved: SkillBook | null | undefined): EarnState {
  if (lesson === "warmup" || lesson === "learn" || lesson === "guided" || lesson === "mixed") {
    return lessonFrame(lesson, levels);
  }
  if (lesson === "step") {
    const base = blankEarn(levels, 1, saved);
    return answerEarn(base, base.current.answer, levels ?? {}).state;
  }
  if (start === "faster") {
    return finishedEarn("12 s faster than last time");
  }
  const base = blankEarn(levels, 1, saved);
  if (start === "explain") {
    return answerEarn(base, "nope", levels ?? {}).state;
  }
  if (start === "practice") {
    return startPractice(answerEarn(base, "nope", levels ?? {}).state);
  }
  return base;
}

function openingRun(start: Open): AdaptiveRun | null {
  if (start !== "place" && start !== "place2") {
    return null;
  }
  const run = beginAdaptive(gradeStartLevel(3));
  if (start === "place2") {
    return adaptiveAnswer(run, true).run;
  }
  return run;
}

function shownProfile(profile: KitProfile | null): KitProfile {
  return profile ?? { grade: null, levels: {}, history: [], notes: [] };
}

function GradePick({
  marks,
  units,
  onUnits,
  onProfile,
  onChoose,
}: {
  marks: number;
  units: UnitSystem;
  onUnits: (units: UnitSystem) => void;
  onProfile: () => void;
  onChoose: (grade: GradeChoice) => void;
}) {
  const grades: GradeChoice[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, "unsure"];
  return (
    <>
      <header className="gk-header">
        <button className="gk-codex" type="button" onClick={onProfile}>
          Codex
        </button>
        <div>
          <div className="gk-title">What grade are you in?</div>
          <div className="gk-sub">Not sure is fine. This only picks where the questions start.</div>
        </div>
        <Account marks={marks} units={units} onUnits={onUnits} onProfile={onProfile} />
      </header>
      <div className="gk-pick">
        <div className="gk-grades">
          {grades.map((choice) => (
            <button key={String(choice)} type="button" onClick={() => onChoose(choice)}>
              {choice === 0 ? "K" : choice === "unsure" ? "Not sure" : choice}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function PlaceView({
  marks,
  units,
  onUnits,
  onProfile,
  run,
  typed,
  setTyped,
  onCheck,
}: {
  marks: number;
  units: UnitSystem;
  onUnits: (units: UnitSystem) => void;
  onProfile: () => void;
  run: AdaptiveRun;
  typed: string;
  setTyped: (value: string) => void;
  onCheck: () => void;
}) {
  const ask = adaptiveAsk(run);
  const question = questionForStrand(ask.strandId, ask.level, ask.number);
  const keys = keysFor(question.answer);
  return (
    <>
      <header className="gk-header">
        <button className="gk-codex" type="button" onClick={onProfile}>
          Codex
        </button>
        <div>
          <div className="gk-title">Finding your level</div>
          <div className="gk-sub">{strandName(ask.strandId)}</div>
        </div>
        <Account marks={marks} units={units} onUnits={onUnits} onProfile={onProfile} />
      </header>
      <div className="gk-body">
        <div className="gk-earn">
          <div className="gk-card">
            <div className="gk-kicker">
              <span>QUESTION {ask.number}</span>
            </div>
            <div className="gk-bar thin">
              <i style={{ width: `${((ask.number - 1) / 12) * 100}%` }} />
            </div>
            <h2 className="gk-prompt">{earnPrompt(question)}</h2>
            <EarnSketch question={question} />
            <p className="gk-hint">{earnHint(question)}</p>
            <div className="gk-answer">
              <input aria-label="Answer" value={typed} onChange={(event) => setTyped(event.target.value)} />
              <span className="gk-unit">{earnMeasure(question) === "length" ? lengthAbbrev() : ""}</span>
              <button className="gk-check" type="button" onClick={onCheck}>
                Check
              </button>
            </div>
            <div className="gk-keys">
              {keys.map((key) => (
                <button key={key} type="button" onClick={() => setTyped(key === "←" ? typed.slice(0, -1) : `${typed}${key}`)}>
                  {key}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function ProfileView({
  marks,
  units,
  onUnits,
  profile,
  onRetake,
  onBack,
}: {
  marks: number;
  units: UnitSystem;
  onUnits: (units: UnitSystem) => void;
  profile: KitProfile;
  onRetake: () => void;
  onBack: () => void;
}) {
  return (
    <>
      <header className="gk-header">
        <button className="gk-codex" type="button" onClick={onBack}>
          Codex
        </button>
        <div>
          <div className="gk-title">Maya</div>
          <div className="gk-sub">Grade {profile.grade === "unsure" ? "not sure" : profile.grade === 0 ? "K" : (profile.grade ?? "not set")}</div>
        </div>
        <Account marks={marks} units={units} onUnits={onUnits} onProfile={onBack} />
      </header>
      <div className="gk-pick">
        {Object.keys(profile.levels).length === 0 ? (
          <>
            <h1>Not placed yet, take the placement</h1>
            <button className="gk-check" type="button" onClick={onRetake}>
              Take the placement
            </button>
          </>
        ) : (
          <>
        <h1>Skills</h1>
        <p className="gk-sub">Marks never move these. Only answers do.</p>
        <div className="gk-unit-toggle" role="group" aria-label="Units">
          {(["us", "metric"] as const).map((choice) => (
            <button key={choice} type="button" className={choice === units ? "on" : ""} onClick={() => onUnits(choice)}>
              {systemLabel(choice)}
            </button>
          ))}
        </div>
        <div className="gk-skill-board">
          {KIT_STRANDS.map((id) => {
            const level = profile.levels[id] ?? 1;
            const skills = KIT_SKILLS.filter((skill) => skill.strandId === id && skill.level === level);
            return (
              <section key={id}>
                <h2>{strandName(id)}</h2>
                <div className="gk-skill-grid">
                  {skills.map((skill) => {
                    const progress = profile.skills?.skills[skill.id];
                    const state = progress?.state ?? "new";
                    return (
                      <div key={skill.id} className={`gk-skill ${state}`}>
                        <b>{skill.name}</b>
                        <span>{state}</span>
                        {progress?.recent.slice(-10).map((item, index) => (
                          <small key={`${item.prompt}-${index}`}>
                            {item.prompt} {item.correct ? "right" : "wrong"}
                          </small>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
        {profile.notes.map((note) => (
          <p className="gk-note" key={note}>
            {note}
          </p>
        ))}
        <button className="gk-light" type="button" onClick={onRetake}>
          Retake
        </button>
        {KIT_STRANDS.map((id) => {
          const recent = profile.history.filter((item) => item.strandId === id).slice(-10);
          if (recent.length === 0) {
            return null;
          }
          return (
            <div key={`${id}-log`}>
              <h2>{strandName(id)}</h2>
              <div className="gk-log">
                {recent.map((item, index) => (
                  <div key={`${item.prompt}-${index}`}>
                    <span>{item.prompt}</span>
                    <b>{item.correct ? "right" : "wrong"}</b>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
          </>
        )}
      </div>
    </>
  );
}

function numericLengths(lengths: Record<string, string | number>): Record<string, number> {
  const numbers: Record<string, number> = {};
  for (const [id, value] of Object.entries(lengths)) {
    const parsed = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      numbers[id] = parsed;
    }
  }
  return numbers;
}

