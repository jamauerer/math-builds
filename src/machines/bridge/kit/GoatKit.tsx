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
  questionForStrand,
  runLength,
  startPractice,
  type EarnQuestion,
  type EarnState,
} from "../kits/earn";
import { queenPost, wreckLines } from "../kits/kit";
import { simulateCrossing, type CrossingFrame, type CrossingResult } from "../kits/simulate";
import "./goat.css";
import { bicycle, catapult, ramp, teeter, winch } from "./pick-svgs";
import { art, BridgeScene, CrossingPicture, frameNear, TrussThumb } from "./scene";

type Stage = "pick" | "earn" | "assemble" | "drive" | "wreck" | "grade" | "place" | "place2" | "explain" | "practice" | "profile";
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
  kitProfile?: KitProfile | null;
  onKitProfile?: (profile: KitProfile) => void;
}) {
  setUnitSystem(units);
  void map;
  const savedLevels = strandLevels(level, kitProfile?.levels);
  const [stage, setStage] = useState<Stage>(start === "place2" ? "place" : start === "faster" ? "earn" : start);
  const [earn, setEarn] = useState<EarnState>(() => (word && piece ? earnAtWord(savedLevels, piece) : openingEarn(savedLevels, start)));
  const [run, setRun] = useState<AdaptiveRun | null>(() => openingRun(start));
  const [grade, setGrade] = useState<GradeChoice | null>(kitProfile?.grade ?? (start === "place" || start === "place2" || start === "profile" ? 3 : null));
  const [typed, setTyped] = useState("");
  const [lengths, setLengths] = useState<Record<string, string>>(() => faultLengths(start, fault));
  const [placed, setPlaced] = useState<Record<string, boolean>>({});
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
  const earnedGroups = earn.earned;
  const promptKey = `${earn.phase}:${earn.groupIndex}:${earn.runGot}:${earn.practiceIndex}:${earn.current.answer}`;

  useEffect(() => {
    askedAt.current = Date.now();
  }, [promptKey]);

  function openEarn() {
    setStage("earn");
  }

  function remember(question: EarnQuestion, correct: boolean, levels = savedLevels ?? {}, note: string | null = null, lastRunMs = kitProfile?.lastRunMs) {
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
    });
  }

  function submitAnswer() {
    const question = currentQuestion(earn);
    const elapsed = earn.phase === "plain" ? Math.max(0, Date.now() - askedAt.current) : 0;
    const next = answerEarn(earn, typed, savedLevels ?? {}, elapsed, kitProfile?.lastRunMs ?? null);
    setEarn(next.state);
    setTyped("");
    if (next.marksDelta > 0) {
      onMarks(marks + next.marksDelta);
    }
    if (question) {
      const lastRunMs = next.state.phase === "done" ? next.state.timesMs.reduce((sum, time) => sum + time, 0) : kitProfile?.lastRunMs;
      remember(question, next.correct, next.levels, next.note, lastRunMs);
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
          profile={shownProfile(kitProfile, start)}
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
                      setStage("earn");
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
          {stage === "earn" || stage === "explain" || stage === "practice" ? (
            <EarnView
              earn={earn}
              typed={typed}
              setTyped={setTyped}
              onCheck={submitAnswer}
              onPractice={() => {
                setEarn(startPractice(earn));
                setTyped("");
              }}
              onBuild={() => setStage("assemble")}
              earned={earnedGroups}
            />
          ) : null}
          {stage === "assemble" ? (
            <AssembleView
              lengths={lengths}
              placed={placed}
              drag={drag}
              trayLeft={trayLeft}
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
  onCheck,
  onPractice,
  onBuild,
  earned,
}: {
  earn: EarnState;
  typed: string;
  setTyped: (value: string) => void;
  onCheck: () => void;
  onPractice: () => void;
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
          <EarnedBar earned={earned} />
          <GoatWait />
        </div>
        <KitPanel earned={earned} />
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
        <KitPanel earned={earned} current={groupId} />
      </div>
    );
  }
  const counter = earn.phase === "practice" ? `${earn.streak + 1} of 3` : earn.phase === "word" ? "Word problem" : `${earn.runGot + 1} of ${runLength(groupId)}`;
  return (
    <div className="gk-body">
      <div className="gk-earn">
        <div className="gk-card">
          <div className="gk-kicker">
            <span>{counter}</span>
          </div>
          <h2 className="gk-prompt">{earnPrompt(question)}</h2>
          {picture ? <EarnSketch question={question} /> : null}
          {hint ? <p className="gk-hint">{hint}</p> : null}
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
        <EarnedBar earned={earned} />
        <GoatWait />
      </div>
      <KitPanel earned={earned} current={groupId} />
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

function EarnedBar({ earned }: { earned: string[] }) {
  return (
    <div>
      <div className="gk-kicker">EARNED SO FAR</div>
      <div className="gk-bar">
        <i style={{ width: `${(earned.length / queenPost.groups.length) * 100}%` }} />
      </div>
      <p className="gk-muted">
        {earned.length} of {queenPost.groups.length} pieces
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

function KitPanel({ earned, current }: { earned: string[]; current?: string }) {
  return (
    <aside className="gk-panel">
      <h2>Your kit</h2>
      <p className="gk-muted">greyed = not yet earned</p>
      {queenPost.groups.map((group) => {
        const have = earned.includes(group.id);
        const now = group.id === current;
        const state = have ? "earned" : now ? "current" : "locked";
        return (
          <div key={group.id} className={`gk-row ${state}`}>
            <img src={art(group.sprite)} alt="" />
            <div>
              <b>
                {group.name} ×{group.count}
              </b>
              <span>{group.blurb}</span>
            </div>
            {have ? <span className="gk-ok">{groupLength(group.id)} ✓</span> : null}
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
  onLength,
  onDrag,
  onUp,
  onSend,
}: {
  lengths: Record<string, string>;
  placed: Record<string, boolean>;
  drag: string | null;
  trayLeft: number;
  onLength: (id: string, value: string) => void;
  onDrag: (id: string | null) => void;
  onUp: (event: ReactPointerEvent<HTMLElement>, id: string) => void;
  onSend: () => void;
}) {
  const numbers = numericLengths(lengths);
  return (
    <div className="gk-body">
      <div className="gk-scene-col">
        <BridgeScene
          placed={placed}
          lengths={numbers}
          drops
          goat={{ src: "goat-idle.png", left: 120, top: 205, width: 149, height: 150 }}
        />
        <div className="gk-strip">
          <p>
            Gap is {formatLength(8)}. Bottom: two beams, 8 ÷ 2 = {formatLength(4)} each. ✓ Posts at {formatLength(2)} and {formatLength(6)}, so the top beam is 6 - 2 = {formatLength(4)}. Drop it on the dotted line.
          </p>
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

function groupLength(groupId: string): string {
  const slot = queenPost.slots.find((item) => item.group === groupId && item.length != null);
  if (!slot || slot.length == null) {
    return "";
  }
  return formatLength(slot.length);
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

function openingEarn(levels: Record<string, number> | null, start: Open): EarnState {
  if (start === "faster") {
    return finishedEarn("12 s faster than last time");
  }
  const base = blankEarn(levels);
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

function shownProfile(profile: KitProfile | null, start: Open): KitProfile {
  if (profile && Object.keys(profile.levels).length > 0) {
    return profile;
  }
  if (start !== "profile") {
    return profile ?? { grade: null, levels: {}, history: [], notes: [] };
  }
  const levels: Record<string, number> = {};
  for (const id of KIT_STRANDS) {
    levels[id] = id === "measuring" ? 3 : 4;
  }
  const history = KIT_STRANDS.flatMap((id, index) => [
    { strandId: id, level: levels[id] ?? 1, prompt: earnPrompt(questionForStrand(id, levels[id] ?? 1, index)), correct: index % 3 !== 0 },
    { strandId: id, level: levels[id] ?? 1, prompt: earnPrompt(questionForStrand(id, levels[id] ?? 1, index + 1)), correct: index % 2 === 0 },
  ]);
  return {
    grade: 3,
    levels,
    history,
    notes: ["Measuring dropped to level 3 after two practice rounds."],
  };
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
        <h1>Strand levels</h1>
        <p className="gk-sub">Marks never move these. Only answers do.</p>
        <div className="gk-unit-toggle" role="group" aria-label="Units">
          {(["us", "metric"] as const).map((choice) => (
            <button key={choice} type="button" className={choice === units ? "on" : ""} onClick={() => onUnits(choice)}>
              {systemLabel(choice)}
            </button>
          ))}
        </div>
        <div className="gk-ladder">
          {KIT_STRANDS.map((id) => {
            const level = profile.levels[id] ?? 1;
            return (
              <div key={id} className="gk-rung">
                <b>{strandName(id)}</b>
                <span className="gk-muted">level {level}</span>
                <div className="gk-rungs">
                  {Array.from({ length: 13 }, (_, index) => (
                    <i key={index} className={index < level ? "on" : ""} style={{ height: `${8 + index * 3}px` }} />
                  ))}
                </div>
              </div>
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

