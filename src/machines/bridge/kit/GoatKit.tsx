import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { LearnerMap } from "../../../engine/placement";
import {
  adaptiveAnswer,
  adaptiveAsk,
  beginAdaptive,
  fitLevels,
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
  acceptsAnswer,
  answerEarn,
  blankEarn,
  currentQuestion,
  earnAtWord,
  easierPiece,
  explainHold,
  earnHint,
  earnMeasure,
  earnPicture,
  earnPrompt,
  explainQuestion,
  finishedEarn,
  kitQuestionTotal,
  lessonFrame,
  picturedHold,
  questionForStrand,
  runLength,
  WARMUP_COUNT,
  startGuided,
  startPractice,
  type EarnQuestion,
  type EarnState,
} from "../kits/earn";
import { causeHint, causeText, knownLine, pieceGroup, pieceRows, plankSlots, preCut, queenPost, rowLabel, stareLine, testedRound, trayNote, typedLine } from "../kits/kit";
import type { ExplainStep } from "../kits/explain";
import { KIT_SKILLS, skillsFromLevels, type SkillBook } from "../kits/skills";
import { framePose, simulateCrossing, type CrossingFrame, type CrossingResult } from "../kits/simulate";
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
  guideMode = null,
  checkOpen = false,
  stareNow = false,
  pose = null,
  round = null,
  picture = null,
  beam = null,
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
  guideMode?: string | null;
  checkOpen?: boolean;
  stareNow?: boolean;
  pose?: string | null;
  round?: number | null;
  picture?: string | null;
  beam?: string | null;
  kitProfile?: KitProfile | null;
  onKitProfile?: (profile: KitProfile) => void;
}) {
  setUnitSystem(units);
  void map;
  const savedLevels = strandLevels(level, kitProfile?.levels);
  const [liveLevels, setLiveLevels] = useState<Record<string, number> | null>(savedLevels);
  const hasPlacement = !unplaced && (level != null || Object.keys(kitProfile?.levels ?? {}).length > 0);
  const [stage, setStage] = useState<Stage>(() => {
    const opened = start === "place2" ? "place" : start === "faster" ? "earn" : start;
    if (!hasPlacement && !lesson && (opened === "earn" || start === "explain" || start === "practice")) {
      return "grade";
    }
    return opened;
  });
  const [earn, setEarn] = useState<EarnState>(() => {
    if (picture) {
      return picturedHold(picture, savedLevels?.[picture] ?? level ?? 4);
    }
    if (round != null) {
      return blankEarn(savedLevels, 1, kitProfile?.skills, "2026-10-19", Math.max(0, round - 1));
    }
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
  const [lengths, setLengths] = useState<Record<string, string>>(() => {
    if (round === 1) {
      return { "bottom-a": "4", "bottom-b": "4" };
    }
    if (round === 2) {
      const values = roundLengths(2) ?? {};
      return Object.fromEntries(Object.entries(values).map(([id, value]) => [id, String(value)]));
    }
    const base = Object.keys(drops).length > 0 ? drops : { ...(kitProfile?.build?.lengths ?? {}), ...faultLengths(start, fault) };
    if (beam) {
      base["bottom-a"] = beam;
    }
    return base;
  });
  const [guideOn, setGuideOn] = useState(() =>
    guideMode === "on" || guideMode === "1" ? true : guideMode === "off" || guideMode === "0" ? false : start === "assemble" && kitProfile?.built !== true,
  );
  const [guideStep, setGuideStep] = useState(0);
  const [showCheck, setShowCheck] = useState(checkOpen);
  const [placed, setPlaced] = useState<Record<string, boolean>>(() =>
    Object.keys(drops).length > 0
      ? Object.fromEntries(Object.keys(drops).map((id) => [id, true]))
      : { ...(kitProfile?.build?.placed ?? {}) },
  );
  const [drag, setDrag] = useState<string | null>(null);
  const [result, setResult] = useState<CrossingResult | null>(() => {
    const fromDrops = Object.keys(drops).length > 0 ? numericLengths(drops) : null;
    if (start === "drive") {
      return simulateCrossing(fromDrops ?? numericLengths(filledLengths()));
    }
    if (start === "wreck" || fault) {
      return simulateCrossing(fromDrops ?? roundLengths(round) ?? scenarioLengths(start, fault));
    }
    return null;
  });
  const [mass, setMass] = useState(40);
  const [badge, setBadge] = useState(start === "wreck");
  const awarded = useRef(start === "drive");
  const askedAt = useRef(Date.now());
  const levelsNow = liveLevels ?? savedLevels ?? {};
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
    help = false,
  ) {
    if (!onKitProfile) {
      return;
    }
    const history = [
      ...(kitProfile?.history ?? []),
      { strandId: question.strandId, level: question.level, prompt: earnPrompt(question), correct: help ? false : correct, help: help || undefined },
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
        if (earn.phase === "done") {
          setStage("assemble");
        }
        return null;
      }
      return current.slice(1);
    });
  }

  function submitAnswer(help?: boolean) {
    const question = currentQuestion(earn);
    const elapsed = earn.phase === "plain" ? Math.max(0, Date.now() - askedAt.current) : 0;
    const asked = help === true;
    const next = answerEarn(earn, typed, levelsNow, elapsed, kitProfile?.lastRunMs ?? null, asked);
    if (Object.keys(next.levels).length > 0) {
      setLiveLevels(next.levels);
    }
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
      remember(question, next.correct, next.levels, next.note, lastRunMs, next.state.book, asked);
    }
  }

  function submitPlace() {
    if (!run) {
      return;
    }
    const ask = adaptiveAsk(run);
    const question = questionForStrand(ask.strandId, ask.level, ask.number);
    const correct = acceptsAnswer(typed, question.answer, question.truth);
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

  function askHelp() {
    if (stage !== "place" || !run) {
      submitAnswer(true);
      return;
    }
    const ask = adaptiveAsk(run);
    const question = questionForStrand(ask.strandId, ask.level, ask.number);
    const stepped = adaptiveAnswer(run, false);
    setTyped("");
    const history = [
      ...(kitProfile?.history ?? []),
      { strandId: ask.strandId, level: ask.level, prompt: earnPrompt(question), correct: false, help: true },
    ].slice(-80);
    if (stepped.levels) {
      onKitProfile?.({
        grade: grade ?? "unsure",
        levels: stepped.levels,
        history,
        notes: kitProfile?.notes ?? [],
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
    const measuring = savedLevels?.measuring ?? kitProfile?.levels.measuring ?? 4;
    if (!preCut(measuring) && drop === id) {
      setPlaced((current) => ({ ...current, [id]: true }));
      return;
    }
    if (preCut(measuring) && drop) {
      const home = slotById(id);
      const pieceLength = home?.length;
      setPlaced((current) => ({ ...current, [id]: true, [drop]: true }));
      if (pieceLength != null) {
        setLengths((current) => ({ ...current, [drop]: String(pieceLength) }));
      }
    }
  }

  function tapPlace(id: string) {
    if (placed[id]) {
      return;
    }
    const measuring = savedLevels?.measuring ?? kitProfile?.levels.measuring ?? 4;
    const cutting = !preCut(measuring);
    if (id === "planks") {
      if (cutting && !Number(lengths.planks)) {
        return;
      }
      const next = plankSlots().find((slot) => !placed[slot.id]);
      if (next) {
        layPlank(next);
      }
      return;
    }
    if (cutting && needsLength(id) && !Number(lengths[id])) {
      return;
    }
    place(id, id);
  }

  function onTrayUp(event: ReactPointerEvent<HTMLElement>, id: string) {
    const target = document.elementFromPoint(event.clientX, event.clientY);
    const drop = target?.closest("[data-drop]")?.getAttribute("data-drop") ?? null;
    const measuring = savedLevels?.measuring ?? kitProfile?.levels.measuring ?? 4;
    if (!preCut(measuring) && needsLength(id) && !Number(lengths[id])) {
      setDrag(null);
      return;
    }
    place(id, drop);
    setDrag(null);
  }

  function earnMore() {
    setShowCheck(false);
    if (earn.phase === "done") {
      const next = blankEarn(savedLevels, earn.seed + 1, earn.book, earn.day, Math.min(queenPost.rounds.length - 1, earn.round + 1));
      setEarn(next);
      setReveal(null);
    }
    setStage("earn");
  }

  function earnAfterWreck() {
    const built = testedRound(numericLengths(lengths));
    const next = blankEarn(savedLevels, earn.seed + 1, earn.book, earn.day, Math.min(queenPost.rounds.length - 1, built + 1));
    setEarn(next);
    setReveal(null);
    setStage("earn");
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
    if (start !== "wreck") {
      onKitProfile?.({
        grade: kitProfile?.grade ?? grade,
        levels: kitProfile?.levels ?? savedLevels ?? {},
        history: kitProfile?.history ?? [],
        notes: kitProfile?.notes ?? [],
        lastRunMs: kitProfile?.lastRunMs,
        skills: kitProfile?.skills,
        seenIntro: kitProfile?.seenIntro,
        session: kitProfile?.session,
        build: { lengths, placed },
        built: true,
        dunks: (kitProfile?.dunks ?? 0) + 1,
      });
    }
  }

  function layPlank(id: string) {
    const measuring = savedLevels?.measuring ?? kitProfile?.levels.measuring ?? 4;
    const length = preCut(measuring) ? "1" : lengths.planks || "1";
    setLengths((current) => ({ ...current, [id]: length }));
    setPlaced((current) => ({ ...current, [id]: true }));
  }

  useEffect(() => {
    if (!guideOn) {
      return;
    }
    const steps = queenPost.guide.filter((step) => (queenPost.rounds[earn.round]?.groups ?? []).includes(pieceGroup(step.piece)));
    const step = steps[guideStep];
    if (!step) {
      return;
    }
    const done = step.piece === "gussets" ? Boolean(placed.gussets) : Boolean(placed[step.piece]);
    if (!done) {
      return;
    }
    if (guideStep + 1 >= steps.length) {
      setGuideOn(false);
      return;
    }
    setGuideStep(guideStep + 1);
  }, [placed, guideOn, guideStep, earn.round]);

  const shown = result;
  const active = stage === "wreck" ? "drive" : stage === "explain" || stage === "practice" ? "earn" : stage;
  const roundGroups = new Set(queenPost.rounds[earn.round]?.groups ?? []);
  const leftIds = [
    ...TRAY.filter((id) => !placed[id] && roundGroups.has(pieceGroup(id))),
    ...plankSlots()
      .map((slot) => slot.id)
      .filter((id) => !placed[id] && roundGroups.has("planks")),
  ];
  const trayLeft = leftIds.length;
  const measuringLevel = savedLevels?.measuring ?? kitProfile?.levels.measuring ?? 4;
  const cut = !preCut(measuringLevel);
  const roundGuide = queenPost.guide.filter((step) => roundGroups.has(pieceGroup(step.piece)));
  const guide = guideOn ? (roundGuide[guideStep] ?? null) : null;
  const unfinished = earn.round < queenPost.rounds.length - 1;

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
          onHelp={askHelp}
        />
      ) : stage === "profile" ? (
        <ProfileView
          marks={marks}
          units={units}
          onUnits={onUnits}
          profile={screenProfile(unplaced, kitProfile, level, lesson)}
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
              onHelp={askHelp}
              onPractice={() => {
                setEarn(startPractice(earn));
                setTyped("");
              }}
              onEasier={() => {
                const question = currentQuestion(earn);
                const next = easierPiece(earn, levelsNow);
                if (Object.keys(next.levels).length > 0) {
                  setLiveLevels(next.levels);
                }
                setEarn(next.state);
                setTyped("");
                if (question) {
                  remember(question, false, next.levels, next.note, kitProfile?.lastRunMs, next.state.book);
                }
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
              leftNote={trayNote(leftIds)}
              cut={cut}
              guide={guide}
              showCheck={showCheck}
              unfinished={unfinished}
              round={earn.round}
              geometryLevel={savedLevels?.geometry ?? kitProfile?.levels.geometry ?? 4}
              onLength={(id, value) => setLengths((current) => ({ ...current, [id]: value }))}
              onDrag={setDrag}
              onUp={onTrayUp}
              onTap={tapPlace}
              onLay={layPlank}
              onSend={() => setShowCheck(true)}
              onSendNow={() => {
                setShowCheck(false);
                sendGoat(40);
              }}
              onLook={() => setShowCheck(false)}
              onEarn={earnMore}
              onGuide={() => {
                setGuideStep(0);
                setGuideOn(true);
              }}
            />
          ) : null}
          {stage === "drive" && shown ? (
            <DriveView
              result={shown}
              lengths={numericLengths(lengths)}
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
              stareNow={stareNow}
              pose={pose}
              onAgain={() => setStage("drive")}
              onBack={() => setStage("assemble")}
              offerNext={testedRound(numericLengths(lengths)) < queenPost.rounds.length - 1}
              onEarn={earnAfterWreck}
              onTry={() => setStage("assemble")}
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
  onHelp,
  onPractice,
  onEasier,
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
  onHelp: () => void;
  onPractice: () => void;
  onEasier: () => void;
  onLearn: () => void;
  onBuild: () => void;
  earned: string[];
}) {
  const question = earn.phase === "done" ? null : currentQuestion(earn);
  const groupId = question?.groupId ?? earn.current.groupId;
  const picture = question ? earnPicture(question) : null;
  const hint = question ? earnHint(question) : "";
  const keys = question ? keysFor(question.answer, question.truth) : [];
  if (earn.phase === "done") {
    return (
      <div className="gk-body">
        <div className="gk-earn">
          <div className="gk-card">
            <h2 className="gk-prompt">This round is earned.</h2>
            {earn.speedLine ? <p className="gk-speed">{earn.speedLine}</p> : null}
            <button className="gk-check" type="button" onClick={onBuild}>
              Build it
            </button>
          </div>
          <EarnedBar steps={earn.steps} round={earn.round} short={earn.short} />
          <RoundMark round={earn.round} />
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
            <Worked steps={explained.steps} />
            <p>{explained.why}</p>
            <button className="gk-check" type="button" onClick={onLearn}>
              Try 3 questions
            </button>
          </div>
          <EarnedBar steps={earn.steps} round={earn.round} short={earn.short} />
          <RoundMark round={earn.round} />
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
            <Worked steps={explained.steps} />
            <p>{explained.why}</p>
            <div className="gk-actions">
              <button className="gk-check" type="button" onClick={onPractice}>
                Try again
              </button>
              {earn.roundsFailed >= 1 ? (
                <button className="gk-light" type="button" onClick={onEasier}>
                  Try an easier one
                </button>
              ) : null}
            </div>
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
          ? `${earn.runGot + 1} of ${WARMUP_COUNT}`
          : earn.phase === "guided"
            ? `${earn.runGot + 1} of 3`
            : `${earn.runGot + 1} of ${runLength(groupId, earn.short)}`;
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
          <button className="gk-idk" type="button" onClick={onHelp}>
            I don't know
          </button>
        </div>
        <EarnedBar steps={earn.steps} round={earn.round} short={earn.short} />
        <RoundMark round={earn.round} />
        <GoatWait />
      </div>
      <KitPanel earned={earned} current={groupId} pulse={pulse} />
    </div>
  );
}

function keysFor(answer: string, truth?: number): string[] {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
  if (answer.includes(".") || (truth != null && !Number.isInteger(truth))) {
    keys.push(".");
  }
  if (answer.startsWith("-")) {
    keys.push("−");
  }
  keys.push("←");
  return keys;
}

function EarnedBar({ steps, round, short }: { steps: number; round: number; short: boolean }) {
  const total = kitQuestionTotal(round, short);
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

function RoundMark({ round }: { round: number }) {
  const total = queenPost.rounds.length;
  return (
    <div className="gk-rounds" data-round={round + 1}>
      <span>
        Round {round + 1} of {total}
      </span>
      <div className="gk-dots">
        {queenPost.rounds.map((item, index) => (
          <i key={item.trial} className={index === round ? "on" : index < round ? "done" : ""} />
        ))}
      </div>
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

function Worked({ steps }: { steps: ExplainStep[] }) {
  return (
    <div className="gk-steps">
      {steps.map((step, index) => (
        <div className="gk-step" key={`${step.picture}-${index}`} data-step={step.picture}>
          <StepPicture step={step} />
          <p className="gk-note">{step.text}</p>
        </div>
      ))}
    </div>
  );
}

function StepPicture({ step }: { step: ExplainStep }) {
  if (step.picture === "triangle") {
    return (
      <svg className="gk-step-pic" data-picture="triangle" viewBox="0 0 140 84" width="140" height="84">
        <polygon points="12,72 128,72 128,16" fill="#f6d34d" stroke="#22201c" strokeWidth="2" />
        <text x="58" y="80" fontSize="12">{step.a}</text>
        <text x="130" y="48" fontSize="12">{step.b}</text>
      </svg>
    );
  }
  if (step.picture === "squares") {
    return (
      <div className="gk-step-pic gk-square-row" data-picture="squares">
        <SquareBlock count={step.a ?? 1} />
        <SquareBlock count={step.b ?? 1} />
      </div>
    );
  }
  if (step.picture === "rows") {
    const rows = Math.max(1, step.rows ?? 1);
    const each = Math.max(1, step.each ?? 1);
    return (
      <div className="gk-step-pic gk-bolt-rows" data-picture="rows" style={{ gridTemplateRows: `repeat(${rows}, 12px)` }}>
        {Array.from({ length: rows * each }, (_, index) => (
          <i key={index} />
        ))}
      </div>
    );
  }
  const count = Math.max(1, Math.min(24, step.count ?? step.each ?? 1));
  return (
    <div className="gk-step-pic gk-bolt-pile" data-picture={step.picture}>
      {Array.from({ length: count }, (_, index) => (
        <i key={index} />
      ))}
    </div>
  );
}

function SquareBlock({ count }: { count: number }) {
  const side = Math.max(1, Math.round(Math.sqrt(count)));
  const cells = side * side;
  return (
    <div className="gk-square-grid" data-squares={cells} style={{ gridTemplateColumns: `repeat(${side}, 10px)` }}>
      {Array.from({ length: cells }, (_, index) => (
        <i key={index} />
      ))}
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
        {picture.ruler && !picture.tape ? <RulerStrip /> : null}
        {picture.bits.map((bit, index) => (
          <img
            key={`${bit.sprite}-${index}`}
            className={bit.mark ? "gk-bit on" : undefined}
            alt=""
            src={art(bit.sprite)}
            style={{
              position: "absolute",
              left: bit.x,
              top: bit.y,
              width: bit.w,
              height: bit.h,
              transform: bit.rotate ? `rotate(${bit.rotate}deg)` : undefined,
              transformOrigin: bit.rotate ? "0 50%" : undefined,
            }}
          />
        ))}
        {picture.tape ? (
          <>
            <div className="gk-tape" style={{ left: picture.tape.x, top: picture.tape.y, width: picture.tape.w, height: picture.tape.h }} />
            {picture.tape.ticks.map((tick) => (
              <span key={`tick-${tick.x}`} className="gk-tick" style={{ left: tick.x, top: picture.tape?.y }}>
                {tick.label ? <span>{tick.label}</span> : null}
              </span>
            ))}
            {picture.tape.goat ? (
              <img className="gk-tape-goat" alt="" src={art("goat-idle.png")} style={{ left: picture.tape.goat.x, top: picture.tape.goat.y }} />
            ) : null}
          </>
        ) : null}
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
  leftNote,
  cut,
  guide,
  showCheck,
  unfinished,
  round,
  geometryLevel,
  onLength,
  onDrag,
  onUp,
  onTap,
  onLay,
  onSend,
  onSendNow,
  onLook,
  onEarn,
  onGuide,
}: {
  lengths: Record<string, string>;
  placed: Record<string, boolean>;
  drag: string | null;
  trayLeft: number;
  leftNote: string | null;
  cut: boolean;
  guide: { piece: string; say: string } | null;
  showCheck: boolean;
  unfinished: boolean;
  round: number;
  geometryLevel: number;
  onLength: (id: string, value: string) => void;
  onDrag: (id: string | null) => void;
  onUp: (event: ReactPointerEvent<HTMLElement>, id: string) => void;
  onTap: (id: string) => void;
  onLay: (id: string) => void;
  onSend: () => void;
  onSendNow: () => void;
  onLook: () => void;
  onEarn: () => void;
  onGuide: () => void;
}) {
  const numbers = numericLengths(lengths);
  const lines = TRAY.flatMap((id) => {
    const slot = slotById(id);
    const line = typedLine(slot?.name ?? id, lengths[id] ?? "");
    return line ? [{ id, line }] : [];
  });
  const groups = new Set(queenPost.rounds[round]?.groups ?? []);
  const trayRows = [...TRAY, "planks"].filter((id) => groups.has(pieceGroup(id)));
  const rows = guide
    ? trayRows.filter((id) => id === guide.piece || (guide.piece.startsWith("plank") && id === "planks") || (guide.piece === "gussets" && id === "gussets"))
    : trayRows;
  return (
    <div className="gk-body">
      <div className="gk-scene-col">
        <BridgeScene
          placed={placed}
          lengths={numbers}
          drops
          preview={cut}
          holes={round === 1}
          hot={guide?.piece ?? null}
          geometryLevel={geometryLevel}
          goat={{ src: "goat-idle.png", left: 120, top: 205, width: 149, height: 150 }}
        />
        <div className="gk-strip">
          {guide ? <p className="gk-say">{guide.say}</p> : <p className="gk-known">{knownLine()}</p>}
          {lines.map((item) => (
            <p className="gk-work" key={item.id}>
              {item.line}
            </p>
          ))}
          <div className="gk-actions">
            <button className="gk-send" type="button" onClick={onSend}>
              Send the goat
            </button>
            <span className="gk-caption">{trayLeft === 0 ? "The tray is empty." : `${trayLeft} pieces still in the tray`}</span>
            {guide ? null : (
              <button className="gk-again" type="button" onClick={onGuide}>
                Show me again
              </button>
            )}
          </div>
        </div>
      </div>
      {showCheck ? (
        <div className="gk-check-card" role="dialog">
          {unfinished ? (
            <p>The bridge is not finished yet. Send him anyway?</p>
          ) : (
            <>
              <p>Finished? If the bridge is right, the goat crosses. If it is wrong, he goes in the river.</p>
              {leftNote ? <p className="gk-say">{leftNote}</p> : null}
            </>
          )}
          <button className="gk-check" type="button" onClick={onSendNow}>
            Send him
          </button>
          {unfinished ? (
            <button className="gk-light" type="button" onClick={onEarn}>
              Earn more pieces first
            </button>
          ) : (
            <button className="gk-light" type="button" onClick={onLook}>
              Let me look again
            </button>
          )}
        </div>
      ) : null}
      <aside className="gk-panel" data-drag={drag ?? ""}>
        <h2>Kit tray</h2>
        <p className="gk-muted">{guide ? "This piece next." : "Tap a piece to place it, or drag it onto its dotted line."}</p>
        {rows.map((id) => {
          if (id === "planks") {
            const laid = plankSlots().filter((slot) => placed[slot.id]).length;
            return (
              <div
                key="planks"
                className="gk-row"
                onPointerUp={() => onTap("planks")}
              >
                <img src={art("plank-side.png")} alt="" />
                <div>
                  <b>Plank ×8</b>
                  <span>{laid} of 8 laid</span>
                </div>
                {cut ? (
                  <input
                    className={lengths.planks ? "gk-len" : "gk-len empty"}
                    aria-label="Plank length"
                    value={lengths.planks ?? ""}
                    placeholder="?"
                    onPointerDown={(event) => event.stopPropagation()}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        onTap("planks");
                      }
                    }}
                    onChange={(event) => onLength("planks", event.target.value)}
                  />
                ) : (
                  <span className="gk-printed">{formatLength(1)}</span>
                )}
              </div>
            );
          }
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
                event.currentTarget.dataset.x = String(event.clientX);
                event.currentTarget.dataset.y = String(event.clientY);
              }}
              onPointerUp={(event) => {
                const startX = Number(event.currentTarget.dataset.x ?? event.clientX);
                const startY = Number(event.currentTarget.dataset.y ?? event.clientY);
                const moved = Math.hypot(event.clientX - startX, event.clientY - startY) > 8;
                if (!moved) {
                  onTap(id);
                  onDrag(null);
                  return;
                }
                onTrayUpSafe(event, id, placed, onUp);
              }}
            >
              <img src={art(sprite)} alt="" />
              <div>
                <b>{name}</b>
                <span>{placed[id] ? "on the bridge" : "in the tray"}</span>
              </div>
              {cut && slot && slot.length != null && !slot.bonus ? (
                <input
                  className={lengths[id] ? "gk-len" : "gk-len empty"}
                  aria-label={`${name} length`}
                  value={lengths[id] ?? ""}
                  placeholder="?"
                  onPointerDown={(event) => event.stopPropagation()}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      onTap(id);
                    }
                  }}
                  onChange={(event) => onLength(id, event.target.value)}
                />
              ) : !cut && slot && slot.length != null && !slot.bonus ? (
                <span className="gk-printed">{formatLength(slot.length)}</span>
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
  lengths,
  seek,
  onHeavy,
  onNext,
  onSettled,
}: {
  result: CrossingResult;
  lengths: Record<string, number>;
  seek: number | null;
  onHeavy: () => void;
  onNext: () => void;
  onSettled: () => void;
}) {
  const held = seek == null ? null : frameNear(result.frames, seek);
  const frame = usePlayback(result, held, onSettled);
  const rows = pieceRows(lengths, result.cause, result.broke);
  const calm = rows.every((row) => row.state === "fit") && result.peakForce < 1000 * 0.6;
  return (
    <div className="gk-body">
      <div className="gk-scene-col">
        <CrossingPicture frame={frame} />
        <div className="gk-strip">
          <p>
            {frame.goatX >= 8 ? "The goat is across." : calm ? "Every piece fit, nothing is bending." : "The goat is on the bridge."}
          </p>
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
        {rows.map((row) => (
          <div key={row.id} className={`gk-row ${row.state === "fit" ? "earned" : ""}`}>
            <div>
              <b>{row.name}</b>
              <span className={row.state === "fit" ? "gk-good" : "gk-bad"}>{rowLabel(row)}</span>
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
  stareNow,
  pose,
  offerNext,
  onAgain,
  onBack,
  onEarn,
  onTry,
}: {
  result: CrossingResult;
  lengths: Record<string, string>;
  badge: boolean;
  stareNow?: boolean;
  pose?: string | null;
  offerNext?: boolean;
  onAgain: () => void;
  onBack: () => void;
  onEarn: () => void;
  onTry: () => void;
}) {
  const resting = result.frames[result.frames.length - 1];
  const held = pose ? framePose(result.frames, pose) : stareNow ? framePose(result.frames, "glare") : null;
  const [blink, setBlink] = useState<CrossingFrame | null>(resting ?? null);
  useEffect(() => {
    if (held || import.meta.env.VITEST || !resting || resting.mode !== "glare") {
      return;
    }
    const started = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const elapsed = (now - started) / 1000;
      setBlink({ ...resting, walkFrame: 1 + (Math.floor(elapsed / 0.8) % 2) });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [held, resting]);
  const frame = held ?? (import.meta.env.VITEST ? resting : blink);
  const own = numericLengths(lengths);
  const numbers = own.top == null && own["post-a"] == null ? own : { ...numericLengths(filledLengths()), ...own };
  const rows = pieceRows(numbers, result.cause, result.broke);
  const line = stareLine(numbers, result.cause);
  const hint = causeHint(result.cause, numbers);
  const glaring = frame?.mode === "glare";
  return (
    <div className="gk-body">
      <div className="gk-scene-col">
        {frame ? <CrossingPicture frame={frame} /> : null}
        <div className="gk-strip">
          <p>{causeText(result.cause)}</p>
          {glaring ? (
            <div className="gk-stare">
              <p className="gk-say">{line}</p>
            </div>
          ) : null}
          <div className="gk-actions">
            {offerNext ? <p className="gk-say">Want to earn the next round of pieces?</p> : null}
            {offerNext ? (
              <button className="gk-dark" type="button" onClick={onEarn}>
                Earn pieces
              </button>
            ) : (
              <button className="gk-dark" type="button" onClick={onBack}>
                Back to the kit
              </button>
            )}
            {offerNext ? (
              <button className="gk-light" type="button" onClick={onTry}>
                Try again
              </button>
            ) : (
              <button className="gk-light" type="button" onClick={onAgain}>
                Watch it again
              </button>
            )}
          </div>
        </div>
      </div>
      <aside className="gk-panel" data-wreck="panel">
        <h2>What went wrong</h2>
        <p>{causeText(result.cause)}</p>
        {hint ? <p className="gk-note">{hint}</p> : null}
        {rows
          .filter((row) => row.state !== "fit")
          .map((row) => (
            <div key={row.id} className="gk-row">
              <div>
                <b>{row.name}</b>
                <span>{row.caused ? rowLabel(row) : `${rowLabel(row)}, wrong, but not what broke`}</span>
              </div>
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

function roundLengths(round: number | null): Record<string, number> | null {
  if (round === 1) {
    return { "bottom-a": 4, "bottom-b": 4 };
  }
  if (round === 2) {
    const lengths = numericLengths(filledLengths());
    for (const slot of queenPost.slots) {
      if (slot.kind === "plank" || slot.kind === "rail" || slot.group === "bolts") {
        delete lengths[slot.id];
      }
    }
    return lengths;
  }
  return null;
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
    return fitLevels(all);
  }
  if (saved && Object.keys(saved).length > 0) {
    return fitLevels(saved);
  }
  return null;
}

function openingEarn(levels: Record<string, number> | null, start: Open, lesson: string | null, saved: SkillBook | null | undefined): EarnState {
  if (lesson === "loop" || lesson === "easier") {
    const held = explainHold("geometry", levels?.geometry ?? 9, 1);
    const using = levels ?? Object.fromEntries(KIT_STRANDS.map((id) => [id, held.current.level]));
    return lesson === "easier" ? easierPiece(held, using).state : held;
  }
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

function screenProfile(unplaced: boolean, profile: KitProfile | null, level: number | null, lesson?: string | null): KitProfile {
  if (unplaced) {
    return { grade: null, levels: {}, history: [], notes: [] };
  }
  const base = profile ?? { grade: null, levels: {}, history: [], notes: [] };
  if (lesson === "easier") {
    const rung = level ?? base.levels.geometry ?? 9;
    const using = strandLevels(rung, undefined) ?? {};
    const next = easierPiece(explainHold("geometry", rung, 1), using);
    return {
      ...base,
      grade: base.grade ?? 3,
      levels: next.levels,
      notes: next.note ? [...base.notes.filter((item) => item !== next.note), next.note] : base.notes,
      skills: next.state.book,
    };
  }
  if (level != null) {
    const levels = strandLevels(level, undefined) ?? {};
    return { ...base, grade: base.grade ?? 3, levels, skills: skillsFromLevels(levels) };
  }
  if (Object.keys(base.levels).length === 0) {
    return base;
  }
  const levels = fitLevels(base.levels);
  return { ...base, levels, skills: base.skills ?? skillsFromLevels(levels) };
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
  onHelp,
}: {
  marks: number;
  units: UnitSystem;
  onUnits: (units: UnitSystem) => void;
  onProfile: () => void;
  run: AdaptiveRun;
  typed: string;
  setTyped: (value: string) => void;
  onCheck: () => void;
  onHelp: () => void;
}) {
  const ask = adaptiveAsk(run);
  const question = questionForStrand(ask.strandId, ask.level, ask.number);
  const keys = keysFor(question.answer, question.truth);
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
            <button className="gk-idk" type="button" onClick={onHelp}>
              I don't know
            </button>
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
        {profile.notes.map((note) => (
          <p className="gk-note" key={note} data-log="level">
            {note}
          </p>
        ))}
        <ol className="gk-ladder">
          {KIT_STRANDS.map((id) => (
            <li key={id}>
              <span>{strandName(id)}</span>
              <b>Level {profile.levels[id]}</b>
            </li>
          ))}
        </ol>
        <p className="gk-dunks">
          <img src={art("goat-idle.png")} alt="" />
          Goat dunks: {profile.dunks ?? 0}
        </p>
        <p>
          Earned so far:{" "}
          {queenPost.groups
            .filter((group) => (profile.skills?.earned ?? []).includes(group.id))
            .map((group) => group.name)
            .join(", ") || "nothing yet"}
        </p>
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
                        <span>{progress?.struggling ? "struggling" : state}</span>
                        {progress?.recent.slice(-10).map((item, index) => (
                          <small key={`${item.prompt}-${index}`}>
                            {item.prompt} {item.help ? "asked for help" : item.correct ? "right" : "wrong"}
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
        <button className="gk-light" type="button" onClick={onRetake}>
          Retake
        </button>
        <h2>Last answers</h2>
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
                    <b>{item.help ? "asked for help" : item.correct ? "right" : "wrong"}</b>
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

