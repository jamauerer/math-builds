import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { LearnerMap } from "../../../engine/placement";
import { answerEarn, blankEarn, earnDone, type EarnState } from "../kits/earn";
import { queenPost, wreckLines } from "../kits/kit";
import { simulateCrossing, type CrossingFrame, type CrossingResult } from "../kits/simulate";
import "./goat.css";
import { bicycle, catapult, ramp, teeter, winch } from "./pick-svgs";
import { art, BridgeScene, CrossingPicture, frameNear, TrussThumb } from "./scene";

type Stage = "pick" | "earn" | "assemble" | "drive" | "wreck";

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
}: {
  map: LearnerMap;
  marks: number;
  onMarks: (marks: number) => void;
  start?: Stage;
  seek?: number | null;
  fault?: "top" | "post" | "bottom" | null;
}) {
  const [stage, setStage] = useState<Stage>(start);
  const [earn, setEarn] = useState<EarnState>(() => blankEarn(map, 7));
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
  const earnedGroups = earn.earned;

  function openEarn() {
    setStage("earn");
  }

  function submitAnswer() {
    const next = answerEarn(earn, typed);
    setEarn(next.state);
    setTyped("");
    if (earnDone(next.state)) {
      setStage("assemble");
    }
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
  const active = stage === "wreck" ? "drive" : stage;
  const trayLeft = TRAY.filter((id) => !placed[id]).length;

  return (
    <div className="goat-kit" data-stage={stage}>
      {stage === "pick" ? (
        <Pick marks={marks} onOpen={openEarn} />
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
            <Marks marks={marks} />
          </header>
          {stage === "earn" ? (
            <EarnView
              earn={earn}
              typed={typed}
              setTyped={setTyped}
              onCheck={submitAnswer}
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
  if (stage === "earn") {
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

function Marks({ marks }: { marks: number }) {
  return (
    <div className="gk-marks">
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
        <circle cx="14" cy="14" r="12" fill="#F2B544" />
        <circle cx="14" cy="14" r="8" fill="none" stroke="#9A6A12" strokeWidth="1.5" />
        <text x="14" y="18" textAnchor="middle" fontFamily="Fraunces, serif" fontSize="12" fontWeight="800" fill="#9A6A12">
          M
        </text>
      </svg>
      {marks} marks
    </div>
  );
}

function Pick({ marks, onOpen }: { marks: number; onOpen: () => void }) {
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
        <Marks marks={marks} />
        <div className="gk-profile">
          <div className="gk-avatar">M</div>
          Maya
        </div>
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
              <div style={{ fontSize: 14, color: "#6B6459" }}>An 8 m queen-post truss. Earn the pieces, give each one a length, send the goat.</div>
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
      <div className="gk-thumb" style={{ background: "#F7F3EC" }} dangerouslySetInnerHTML={{ __html: thumb }} />
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
  earned,
}: {
  earn: EarnState;
  typed: string;
  setTyped: (value: string) => void;
  onCheck: () => void;
  earned: string[];
}) {
  const question = earn.queue[earn.index];
  if (!question) {
    return null;
  }
  const group = queenPost.groups.find((item) => item.id === question.groupId);
  const upcoming = earn.queue.slice(earn.index + 1, earn.index + 3);
  return (
    <div className="gk-body">
      <div className="gk-earn">
        <div className="gk-card">
          <div className="gk-kicker">
            <span>
              QUESTION {earn.index + 1} OF {earn.queue.length} · LEVEL {question.level}
            </span>
            <span>answer right = earn the {group?.name.toLowerCase()}</span>
          </div>
          <h2 className="gk-prompt">{question.prompt}</h2>
          {question.unit === "kg" ? <WeightSketch questionTop={question.visual} /> : null}
          <p className="gk-hint">{question.hint}</p>
          <div className="gk-answer">
            <input aria-label="Answer" value={typed} onChange={(event) => setTyped(event.target.value)} />
            <span className="gk-unit">{question.unit}</span>
            <button className="gk-check" type="button" onClick={onCheck}>
              Check
            </button>
          </div>
          <div className="gk-keys">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", ".", "←"].map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setTyped(key === "←" ? typed.slice(0, -1) : `${typed}${key}`)}
              >
                {key}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="gk-kicker">EARNED SO FAR</div>
          <div className="gk-bar">
            <i style={{ width: `${(earned.length / queenPost.groups.length) * 100}%` }} />
          </div>
          <p className="gk-muted">
            {earned.length} of {queenPost.groups.length} pieces
          </p>
          <p className="gk-note">Wrong answer? You keep the pieces you have. Try the next one, the beam waits for you.</p>
        </div>
        <div className="gk-goat-line">
          <img src={art("goat-idle.png")} alt="" />
          <p className="gk-note">I&apos;m not crossing anything until you&apos;ve earned the braces.</p>
        </div>
        <div className="gk-next">
          {upcoming.map((item, index) => {
            const nextGroup = queenPost.groups.find((groupItem) => groupItem.id === item.groupId);
            return (
              <div key={`${item.groupId}-${index}`}>
                Up next · Q{earn.index + 2 + index}
                <br />
                {nextGroup?.name}
              </div>
            );
          })}
        </div>
      </div>
      <KitPanel earned={earned} current={question.groupId} />
    </div>
  );
}

function WeightSketch({ questionTop }: { questionTop: EarnState["queue"][number]["visual"] }) {
  const visual = questionTop as { top?: number; bottom?: number } | undefined;
  const metres = visual?.top ?? 4;
  const kg = visual?.bottom ?? 12;
  return (
    <div style={{ position: "relative", height: 90 }}>
      <img src={art("beam-side.png")} alt="" style={{ position: "absolute", left: 20, top: 40, width: 380, height: 41 }} />
      <p className="gk-note" style={{ color: "#2E7FB0", position: "absolute", left: 20, top: 0 }}>
        {kg} kg · {metres} m
      </p>
    </div>
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
            {have ? <span className="gk-ok">{group.lengthLabel} ✓</span> : null}
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
            Gap is 8 m. Bottom: two beams, 8 ÷ 2 = 4 m each. ✓ Posts at 2 m and 6 m, so the top beam is 6 - 2 = 4 m. Drop it on the dotted line.
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
          <strong>{result.massKg} kg</strong>
          <span className="gk-muted">{result.massKg === 40 ? "one goat" : "a heavier goat"}</span>
          <div className="gk-bar">
            <i style={{ width: `${result.loadPercent}%`, background: "#3C7A2B" }} />
          </div>
          <p className="gk-muted">holds up to about 180 kg</p>
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
              ? "Top beam was 3 m. The posts are 4 m apart. The right post had nothing to hold on to. The goat is fine. Mostly."
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
        <p className="gk-muted">Marks stay at the last award. This crossing added none. Load was {result.massKg} kg.</p>
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

function faultLengths(start: Stage, fault: "top" | "post" | "bottom" | null): Record<string, string> {
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

function scenarioLengths(start: Stage, fault: "top" | "post" | "bottom" | null): Record<string, number> {
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

