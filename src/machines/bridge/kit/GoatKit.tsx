import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { LearnerMap } from "../../../engine/placement";
import {
  fitLevels,
  learnStartLevels,
  withGradeBias,
  KIT_STRANDS,
  strandLine,
  strandName,
  type GradeChoice,
  type GradeSystem,
} from "../../../engine/strand-placement";
import { beginLadderPlace, ladderPlaceAnswer, ladderPlaceAsk, settleLadder, type LadderPlace } from "../../../ladder/place";
import { LADDER_VERSION } from "../../../ladder/steps";
import type { LadderLayout } from "../../../ladder/generate";
import {
  countryByCode,
  countryFromLocale,
  defaultsForCountry,
  filterCountries,
  flagEmoji,
  gradeSystemLabel,
} from "../../../locale/countries";
import { guestKitProfile, needsLadderPlace, profileGradeSystem, type KitProfile } from "../../../storage/progress";
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
  freshKit,
  roundEndHold,
  kitQuestionTotal,
  lessonFrame,
  picturedHold,
  runLength,
  WARMUP_COUNT,
  skillHold,
  startGuided,
  startPractice,
  type EarnQuestion,
  type EarnState,
} from "../kits/earn";
import type { ActionKind, ChoiceOption } from "../../../skills/generate";
import { cancelSpeech, speakText, speechLang } from "../../../locale/speech";
import {
  demoFluentBook,
  demoReviewBook,
  medianAnswerMs,
  skillIsDue,
  SKILL_STATE_LABEL,
  type SkillStateName,
} from "../kits/skills";
import {
  causeHint,
  causeText,
  gussetSlots,
  knownLine,
  nextGusset,
  pieceGroup,
  pieceRows,
  plankSlots,
  preCut,
  queenPost,
  rowLabel,
  slotFact,
  stareLine,
  testedRound,
  trayNote,
} from "../kits/kit";
import type { ExplainStep } from "../kits/explain";
import { KIT_SKILLS, skillsFromLevels, type SkillBook } from "../kits/skills";
import { skillLearnLine } from "../../../skills/generate";
import { BIG_GOAT_MASS, CELEBRATE_S, SMALL_GOAT_MASS, framePose, simulateCrossing, type CrossingFrame, type CrossingResult } from "../kits/simulate";
import "./goat.css";
import { bicycle, catapult, ramp, teeter, winch } from "./pick-svgs";
import { art, BridgeScene, CrossingPicture, frameNear, TrussThumb } from "./scene";

type Stage = "pick" | "intro" | "earn" | "assemble" | "drive" | "wreck" | "live" | "grade" | "place" | "place2" | "explain" | "practice" | "profile" | "where";
type Open = Stage | "faster";

function needsCountry(profile: KitProfile | null | undefined): boolean {
  return !profile?.country;
}

function needsGrade(profile: KitProfile | null | undefined): boolean {
  return profile?.grade == null;
}

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
  heavy = false,
  seedCountry = null,
  focusSlot = null,
  flyGusset: flyGussetId = null,
  skill = null,
  skillSeed = null,
  seedGrade = null,
  placeAsked = 0,
  kitProfile = null,
  onKitProfile,
  demo = null,
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
  heavy?: boolean;
  seedCountry?: string | null;
  focusSlot?: string | null;
  flyGusset?: string | null;
  skill?: string | null;
  skillSeed?: number | null;
  seedGrade?: GradeChoice | null;
  placeAsked?: number;
  kitProfile?: KitProfile | null;
  onKitProfile?: (profile: KitProfile) => void;
  demo?: string | null;
}) {
  setUnitSystem(units);
  void map;
  const savedLevels = strandLevels(level, kitProfile?.levels);
  const [liveLevels, setLiveLevels] = useState<Record<string, number> | null>(savedLevels);
  const hasPlacement = !unplaced && (level != null || Object.keys(kitProfile?.levels ?? {}).length > 0);
  const staleLadder = needsLadderPlace(kitProfile);
  const impliedGrade: GradeChoice | null =
    seedGrade ?? kitProfile?.grade ?? (level != null ? level : start === "place" || start === "place2" || start === "profile" ? 3 : 13);
  const [stage, setStage] = useState<Stage>(() => {
    if (demo === "fluent") {
      return "profile";
    }
    if (skill) {
      return "earn";
    }
    const opened = start === "place2" ? "place" : start === "faster" ? "earn" : start;
    if (staleLadder && !lesson && !skill && (opened === "earn" || opened === "intro" || opened === "where")) {
      return "place";
    }
    if (opened === "where" && !hasPlacement) {
      return needsCountry(kitProfile) && !seedCountry ? "live" : "grade";
    }
    if (!hasPlacement && !lesson && (opened === "earn" || start === "explain" || start === "practice")) {
      return needsCountry(kitProfile) && !seedCountry ? "live" : "grade";
    }
    return opened;
  });
  const [earn, setEarn] = useState<EarnState>(() => {
    if (demo === "review") {
      return blankEarn(savedLevels ?? Object.fromEntries(KIT_STRANDS.map((id) => [id, 4])), 1, demoReviewBook(), "2026-10-20");
    }
    if (skill) {
      const held = skillHold(skill, skillSeed ?? 3);
      return start === "explain" ? { ...held, phase: "explain", returnPhase: "plain" } : held;
    }
    if (picture) {
      return picturedHold(picture, savedLevels?.[picture] ?? level ?? 4);
    }
    if (round != null) {
      return blankEarn(savedLevels, 1, kitProfile?.skills, "2026-10-19", Math.max(0, round - 1));
    }
    if (word && piece) {
      const held = earnAtWord(savedLevels, piece);
      return start === "explain" ? { ...held, phase: "explain", returnPhase: "plain" } : held;
    }
    if (!lesson && start !== "faster" && start !== "explain" && start !== "practice" && kitProfile?.session) {
      return kitProfile.session;
    }
    return openingEarn(savedLevels, start, lesson, kitProfile?.skills, impliedGrade, placeAsked);
  });
  const [reveal, setReveal] = useState<EarnState | null>(null);
  const [celebrate, setCelebrate] = useState<string[] | null>(moment === "spin" && piece ? [piece] : null);
  const [pulse, setPulse] = useState<string | null>(moment === "lit" ? piece : null);
  const [roundDance, setRoundDance] = useState(false);
  const [run, setRun] = useState<LadderPlace | null>(() => {
    const opened = start === "place2" ? "place" : start === "faster" ? "earn" : start;
    if (staleLadder && !lesson && !skill && (opened === "earn" || opened === "intro" || opened === "where")) {
      return openingPlace("place", impliedGrade, placeAsked);
    }
    return openingPlace(start, impliedGrade, placeAsked);
  });
  const [grade, setGrade] = useState<GradeChoice | null>(impliedGrade);
  const seeded = seedCountry && countryByCode(seedCountry) ? seedCountry.toUpperCase() : null;
  const [gradeSystem, setGradeSystem] = useState<GradeSystem>(() => {
    if (kitProfile?.gradeSystem) {
      return kitProfile.gradeSystem;
    }
    if (seeded) {
      return defaultsForCountry(seeded).gradeSystem;
    }
    return profileGradeSystem(kitProfile);
  });
  useEffect(() => {
    if (kitProfile?.gradeSystem) {
      setGradeSystem(kitProfile.gradeSystem);
      return;
    }
    if (seeded) {
      setGradeSystem(defaultsForCountry(seeded).gradeSystem);
    }
  }, [kitProfile?.gradeSystem, seeded]);
  const [typed, setTyped] = useState("");
  const profileRef = useRef(kitProfile);
  profileRef.current = kitProfile;

  function writeProfile(patch: Partial<KitProfile>) {
    if (!onKitProfile) {
      return;
    }
    const current = profileRef.current;
    const next = {
      grade: current?.grade ?? grade,
      country: current?.country ?? seeded ?? undefined,
      gradeSystem: current?.gradeSystem ?? gradeSystem,
      kitVersion: queenPost.version,
      levels: current?.levels ?? {},
      history: current?.history ?? [],
      notes: current?.notes ?? [],
      lastRunMs: current?.lastRunMs,
      skills: current?.skills,
      seenIntro: current?.seenIntro,
      session: current?.session,
      build: current?.build,
      built: current?.built,
      dunks: current?.dunks,
      placedAt: current?.placedAt,
      ladderAt: current?.ladderAt,
      ladderSteps: current?.ladderSteps,
      fastRuns: current?.fastRuns,
      ...patch,
    };
    profileRef.current = next;
    onKitProfile(next);
  }

  function applyCountry(code: string, nextStage: Stage = "grade") {
    const country = code.toUpperCase();
    if (!countryByCode(country)) {
      return;
    }
    const defaults = defaultsForCountry(country);
    setGradeSystem(defaults.gradeSystem);
    onUnits(defaults.units);
    writeProfile({ country, gradeSystem: defaults.gradeSystem });
    setStage(nextStage);
  }
  const [lengths, setLengths] = useState<Record<string, string>>(() => {
    if (round != null && Object.keys(drops).length === 0) {
      const values = roundLengths(round);
      if (values) {
        return Object.fromEntries(Object.entries(values).map(([id, value]) => [id, String(value)]));
      }
    }
    const base = Object.keys(drops).length > 0 ? drops : { ...(kitProfile?.build?.lengths ?? {}), ...faultLengths(start, fault) };
    if (beam) {
      base["bottom-a"] = beam;
    }
    if (start === "drive" && Object.keys(base).length === 0) {
      return filledLengths();
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
  const [focus, setFocus] = useState<string | null>(focusSlot);
  const [flyGusset, setFlyGusset] = useState<{ id: string; at: string } | null>(() => {
    if (!flyGussetId) {
      return null;
    }
    const slot = gussetSlots().find((item) => item.id === flyGussetId || item.at === flyGussetId);
    return slot?.at ? { id: slot.id, at: slot.at } : null;
  });
  const layingRef = useRef(false);
  const [result, setResult] = useState<CrossingResult | null>(() => {
    const fromDrops = Object.keys(drops).length > 0 ? numericLengths(drops) : null;
    const startMass = heavy ? BIG_GOAT_MASS : SMALL_GOAT_MASS;
    if (start === "drive") {
      return simulateCrossing(fromDrops ?? roundLengths(round) ?? numericLengths(filledLengths()), startMass);
    }
    if (start === "wreck" || fault) {
      return simulateCrossing(fromDrops ?? roundLengths(round) ?? scenarioLengths(start, fault), startMass);
    }
    return null;
  });
  const [mass, setMass] = useState(heavy ? BIG_GOAT_MASS : SMALL_GOAT_MASS);
  const [badge, setBadge] = useState(start === "wreck");
  const designAwarded = useRef(false);
  const heavyAwarded = useRef(false);
  useEffect(() => {
    if (start !== "drive" || !result?.ok || import.meta.env.VITEST || designAwarded.current) {
      return;
    }
    if (sessionStorage.getItem("mb-cross-award") === "1") {
      return;
    }
    sessionStorage.setItem("mb-cross-award", "1");
    designAwarded.current = true;
    const heavyMarks = mass >= BIG_GOAT_MASS ? (queenPost.rounds[2]?.marks ?? 0) : 0;
    onMarks(marks + (queenPost.rounds[1]?.marks ?? queenPost.marks) + heavyMarks);
  }, [start, result, mass, marks, onMarks]);
  const askedAt = useRef(Date.now());
  const levelsNow = liveLevels ?? savedLevels ?? {};
  const view = reveal ?? earn;
  const earnedGroups =
    moment === "lit" && piece ? [...new Set([...view.earned, piece])] : view.earned;
  const promptKey = `${view.phase}:${view.groupIndex}:${view.runGot}:${view.practiceIndex}:${view.current?.answer ?? ""}`;

  useEffect(() => {
    askedAt.current = Date.now();
  }, [promptKey]);

  function resetKit() {
    const next = freshKit(savedLevels, kitProfile?.skills ?? earn.book);
    setEarn(next);
    setLengths({});
    setPlaced({});
    setGuideStep(0);
    setResult(null);
    writeProfile({
      levels: Object.keys(kitProfile?.levels ?? {}).length > 0 ? (kitProfile?.levels ?? {}) : (savedLevels ?? {}),
      lastRunMs: kitProfile?.lastRunMs,
      skills: next.book,
      seenIntro: true,
      session: undefined,
      build: { lengths: {}, placed: {} },
      built: false,
    });
    return next;
  }

  function startGuest() {
    const guest = guestKitProfile();
    writeProfile({
      ...guest,
      session: undefined,
      build: { lengths: {}, placed: {} },
      built: false,
    });
    setGrade(3);
    setGradeSystem("us");
    setLiveLevels(guest.levels);
    onUnits("us");
    setEarn(blankEarn(guest.levels, 1, guest.skills, guest.placedAt, 0, 3));
    setLengths({});
    setPlaced({});
    setGuideStep(0);
    setResult(null);
    setReveal(null);
    setStage("earn");
  }

  function openEarn() {
    if (staleLadder || !hasPlacement) {
      if (staleLadder && (grade != null || kitProfile?.grade != null)) {
        setRun(beginLadderPlace(grade ?? kitProfile?.grade ?? 3));
        setStage("place");
        return;
      }
      setStage(needsCountry(kitProfile) ? "live" : "grade");
      return;
    }
    if (!kitProfile?.seenIntro && !kitProfile?.session) {
      setStage("intro");
      return;
    }
    if (earn.phase === "done" || kitProfile?.built) {
      resetKit();
      setStage("earn");
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
    writeProfile({
      levels: Object.keys(kitProfile?.levels ?? {}).length > 0 ? (kitProfile?.levels ?? {}) : (savedLevels ?? {}),
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

  useEffect(() => {
    if (start !== "faster" && (stage === "earn" || stage === "explain" || stage === "practice") && earn.phase === "done" && !celebrate && !roundDance) {
      setStage("assemble");
    }
  }, [stage, earn.phase, celebrate, roundDance]);

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
    writeProfile({
      levels,
      history,
      notes,
      lastRunMs,
      skills: skills ?? kitProfile?.skills,
    });
  }

  function finishMoment() {
    setCelebrate((current) => {
      if (!current || current.length === 0) {
        return null;
      }
      if (earn.phase === "done" && current.length === 1) {
        setRoundDance(true);
        window.setTimeout(() => setRoundDance(false), 750);
      } else {
        setPulse(current[0]);
      }
      if (current.length === 1) {
        setReveal(null);
        return null;
      }
      return current.slice(1);
    });
  }

  function submitAnswer(help?: boolean, attempt?: string) {
    const question = currentQuestion(earn);
    const given = attempt ?? typed;
    const elapsed = earn.phase === "plain" ? Math.max(0, Date.now() - askedAt.current) : 0;
    const asked = help === true;
    const next = answerEarn(earn, given, levelsNow, elapsed, kitProfile?.lastRunMs ?? null, asked);
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
    const asked = ladderPlaceAsk(run, grade ?? 3, run.asked);
    const correct = acceptsAnswer(typed, asked.answer);
    const stepped = ladderPlaceAnswer(run, grade ?? 3, correct);
    setTyped("");
    const history = [
      ...(kitProfile?.history ?? []),
      { strandId: asked.strandId, level: asked.level, prompt: asked.prompt, correct },
    ].slice(-80);
    if (stepped.done) {
      const settled = settleLadder(stepped, grade ?? 3);
      const levels = learnStartLevels(withGradeBias(settled.levels, grade ?? "unsure", gradeSystem));
      const placedAt = new Date().toISOString().slice(0, 10);
      writeProfile({
        grade: grade ?? "unsure",
        levels,
        history,
        skills: skillsFromLevels(levels, placedAt),
        placedAt,
        fastRuns: {},
        ladderAt: LADDER_VERSION,
        ladderSteps: {
          adding: settled.adding,
          subtracting: settled.subtracting,
          multiplying: settled.multiplying,
          dividing: settled.dividing,
        },
      });
      setEarn(blankEarn(levels, 1, null, "2026-10-19", 0, grade ?? 3));
      setStage("where");
      return;
    }
    writeProfile({ grade: grade ?? "unsure", history });
    setRun(stepped);
  }

  function askHelp() {
    if (stage !== "place" || !run) {
      submitAnswer(true);
      return;
    }
    const asked = ladderPlaceAsk(run, grade ?? 3, run.asked);
    const stepped = ladderPlaceAnswer(run, grade ?? 3, false);
    setTyped("");
    const history = [
      ...(kitProfile?.history ?? []),
      { strandId: asked.strandId, level: asked.level, prompt: asked.prompt, correct: false, help: true },
    ].slice(-80);
    if (stepped.done) {
      const settled = settleLadder(stepped, grade ?? 3);
      const levels = learnStartLevels(withGradeBias(settled.levels, grade ?? "unsure", gradeSystem));
      const placedAt = new Date().toISOString().slice(0, 10);
      writeProfile({
        grade: grade ?? "unsure",
        levels,
        history,
        skills: skillsFromLevels(levels, placedAt),
        placedAt,
        fastRuns: {},
        ladderAt: LADDER_VERSION,
        ladderSteps: {
          adding: settled.adding,
          subtracting: settled.subtracting,
          multiplying: settled.multiplying,
          dividing: settled.dividing,
        },
      });
      setEarn(blankEarn(levels, 1, null, "2026-10-19", 0, grade ?? 3));
      setStage("where");
      return;
    }
    writeProfile({ grade: grade ?? "unsure", history });
    setRun(stepped);
  }

  function placeGusset(slotId: string) {
    const slot = gussetSlots().find((item) => item.id === slotId);
    if (!slot) {
      return;
    }
    if (slot.at) {
      setFlyGusset({ id: slot.id, at: slot.at });
      window.setTimeout(() => setFlyGusset(null), 450);
    }
    setPlaced((current) => {
      if (current[slot.id]) {
        return current;
      }
      const next = { ...current, [slot.id]: true };
      if (gussetSlots().every((item) => item.id === slot.id || next[item.id])) {
        next.gussets = true;
      }
      return next;
    });
    setLengths((current) => ({ ...current, [slot.id]: "1" }));
    setFocus(slot.id);
  }

  function placeAllGussets() {
    const pending = gussetSlots().filter((slot) => !placed[slot.id]);
    if (pending.length === 0) {
      return;
    }
    setFocus("gussets");
    pending.forEach((slot, index) => {
      window.setTimeout(() => placeGusset(slot.id), index * 90);
    });
  }

  function place(id: string, drop: string | null) {
    if (!drop) {
      return;
    }
    if (id === "gussets") {
      if (drop.startsWith("node-")) {
        const nodeId = drop.slice(5);
        const slot = gussetSlots().find((item) => item.at === nodeId && !placed[item.id]);
        if (slot) {
          placeGusset(slot.id);
        }
        return;
      }
      const next = nextGusset(placed);
      if (next) {
        placeGusset(next.id);
      }
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
      setFocus(id);
      return;
    }
    if (preCut(measuring) && drop) {
      const home = slotById(id);
      const pieceLength = home?.length;
      setPlaced((current) => ({ ...current, [id]: true, [drop]: true }));
      setFocus(drop);
      if (pieceLength != null) {
        setLengths((current) => ({ ...current, [drop]: String(pieceLength) }));
      }
    }
  }

  function layAllPlanks() {
    if (layingRef.current) {
      return;
    }
    const measuring = savedLevels?.measuring ?? kitProfile?.levels.measuring ?? 4;
    const cutting = !preCut(measuring);
    if (cutting && !Number(lengths.planks)) {
      return;
    }
    const pending = plankSlots().filter((slot) => !placed[slot.id]);
    if (pending.length === 0) {
      return;
    }
    layingRef.current = true;
    setFocus("planks");
    pending.forEach((slot, index) => {
      window.setTimeout(() => {
        layPlank(slot.id);
        if (index === pending.length - 1) {
          layingRef.current = false;
        }
      }, index * 150);
    });
  }

  function tapPlace(id: string) {
    if (id === "planks") {
      layAllPlanks();
      return;
    }
    if (id === "gussets") {
      placeAllGussets();
      return;
    }
    setFocus(id);
    if (placed[id]) {
      return;
    }
    const measuring = savedLevels?.measuring ?? kitProfile?.levels.measuring ?? 4;
    const cutting = !preCut(measuring);
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
    for (const slot of gussetSlots()) {
      if (placed[slot.id] || placed.gussets) {
        numbers[slot.id] = 1;
      }
    }
    if (placed.bolts) {
      numbers.bolts = 1;
    }
    if (placed["rail-a"] || placed.rails) {
      numbers["rail-a"] = numbers["rail-a"] ?? 8;
      numbers["rail-b"] = numbers["rail-b"] ?? 8;
    }
    const crossing = simulateCrossing(numbers, nextMass);
    setMass(nextMass);
    setResult(crossing);
    setStage("drive");
    if (crossing.ok) {
      let add = 0;
      if (!designAwarded.current) {
        designAwarded.current = true;
        add += queenPost.rounds[1]?.marks ?? queenPost.marks;
      }
      if (nextMass >= BIG_GOAT_MASS && !heavyAwarded.current) {
        heavyAwarded.current = true;
        add += queenPost.rounds[2]?.marks ?? 0;
      }
      if (add > 0) {
        onMarks(marks + add);
      }
      // First full crossing unlocks the free tray; guided stays default until then.
      if (start !== "wreck") {
        onKitProfile?.({
          grade: kitProfile?.grade ?? grade,
          kitVersion: queenPost.version,
          levels: kitProfile?.levels ?? savedLevels ?? {},
          history: kitProfile?.history ?? [],
          notes: kitProfile?.notes ?? [],
          lastRunMs: kitProfile?.lastRunMs,
          skills: kitProfile?.skills,
          seenIntro: kitProfile?.seenIntro,
          session: kitProfile?.session,
          build: { lengths, placed },
          built: true,
          dunks: kitProfile?.dunks ?? 0,
        });
      }
      return;
    }
    if (!badge) {
      setBadge(true);
    }
    if (start !== "wreck") {
      onKitProfile?.({
        grade: kitProfile?.grade ?? grade,
        kitVersion: queenPost.version,
        levels: kitProfile?.levels ?? savedLevels ?? {},
        history: kitProfile?.history ?? [],
        notes: kitProfile?.notes ?? [],
        lastRunMs: kitProfile?.lastRunMs,
        skills: kitProfile?.skills,
        seenIntro: kitProfile?.seenIntro,
        session: kitProfile?.session,
        build: { lengths, placed },
        built: kitProfile?.built ?? false,
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
    const done =
      step.piece === "gussets"
        ? gussetSlots().every((slot) => placed[slot.id]) || Boolean(placed.gussets)
        : step.piece === "planks"
          ? plankSlots().every((slot) => placed[slot.id])
          : Boolean(placed[step.piece]);
    if (!done) {
      return;
    }
    if (guideStep + 1 >= steps.length) {
      // Stay guided until the first full crossing unlocks the free tray; ready to send.
      setGuideStep(steps.length);
      return;
    }
    setGuideStep(guideStep + 1);
  }, [placed, guideOn, guideStep, earn.round]);

  useEffect(() => {
    if (!guideOn) {
      return;
    }
    const steps = queenPost.guide.filter((step) => (queenPost.rounds[earn.round]?.groups ?? []).includes(pieceGroup(step.piece)));
    const step = steps[guideStep];
    if (step) {
      setFocus(step.piece);
    }
  }, [guideOn, guideStep, earn.round]);

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
  // Free tray whenever guide is off (after a crossing, or Show me again turned off). Guided is the default until built.
  const freeTray = !guideOn;
  const guide = guideOn && guideStep < roundGuide.length ? (roundGuide[guideStep] ?? null) : null;
  const guidedReady = guideOn && guideStep >= roundGuide.length;
  const unfinished = earn.round < queenPost.rounds.length - 1;

  return (
    <div className="goat-kit" data-stage={stage}>
      {stage === "pick" ? (
        <Pick
          marks={marks}
          units={units}
          onUnits={onUnits}
          onProfile={() => setStage(needsCountry(kitProfile) ? "live" : needsGrade(kitProfile) ? "grade" : "profile")}
          onOpen={openEarn}
          onTry={startGuest}
        />
      ) : stage === "live" ? (
        <LivePick
          marks={marks}
          units={units}
          onUnits={onUnits}
          onProfile={() => setStage("pick")}
          selected={kitProfile?.country ?? seeded ?? countryFromLocale()}
          onChoose={(code) => applyCountry(code, needsGrade(kitProfile) || start === "live" ? "grade" : "profile")}
        />
      ) : stage === "grade" ? (
        <GradePick
          marks={marks}
          units={units}
          onUnits={onUnits}
          gradeSystem={gradeSystem}
          onProfile={() => setStage("pick")}
          onChoose={(choice) => {
            setGrade(choice);
            writeProfile({ grade: choice, gradeSystem });
            setRun(beginLadderPlace(choice));
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
          grade={grade ?? 3}
          typed={typed}
          setTyped={setTyped}
          onCheck={submitPlace}
          onHelp={askHelp}
          note={staleLadder ? "We made the questions better. A quick check first." : null}
        />
      ) : stage === "where" ? (
        <WhereView
          marks={marks}
          units={units}
          onUnits={onUnits}
          gradeSystem={gradeSystem}
          levels={Object.keys(kitProfile?.levels ?? {}).length > 0 ? (kitProfile?.levels ?? {}) : (savedLevels ?? {})}
          steps={kitProfile?.ladderSteps}
          onProfile={() => setStage("profile")}
          onStart={() => setStage(kitProfile?.seenIntro ? "earn" : "intro")}
        />
      ) : stage === "profile" ? (
        <ProfileView
          marks={marks}
          units={units}
          onUnits={onUnits}
          profile={screenProfile(unplaced, kitProfile, level, lesson, seeded, demo)}
          gradeSystem={gradeSystem}
          onGradeSystem={(system) => {
            setGradeSystem(system);
            writeProfile({ gradeSystem: system });
          }}
          onCountry={() => setStage("live")}
          onRetake={() => setStage(needsCountry(kitProfile) ? "live" : "grade")}
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
              <div className="gk-sub">
                {stage === "assemble"
                  ? cut
                    ? "Every piece needs a number."
                    : "Pieces come cut to size. Put each one on its dotted line."
                  : subtitle(stage)}
              </div>
            </div>
            <div className="gk-chips">
              {(["pick", "earn", "assemble", "drive"] as const).map((chip) => (
                <button
                  key={chip}
                  className={chip === active || (chip === "earn" && active === "earn") ? `gk-chip${chip === active ? " on" : ""}` : "gk-chip"}
                  type="button"
                  onClick={() => {
                    if (chip === "pick") {
                      if (earn.phase === "done" || kitProfile?.built) {
                        resetKit();
                      }
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
                  {chip === "pick" ? "Pick" : chip === "earn" ? "Earn pieces" : chip === "assemble" ? "Assemble" : "Test"}
                </button>
              ))}
            </div>
            <Account
              marks={marks}
              units={units}
              onUnits={onUnits}
              onProfile={() => setStage(needsCountry(kitProfile) ? "live" : needsGrade(kitProfile) ? "grade" : "profile")}
            />
          </header>
          {stage === "intro" ? (
            <IntroView
              precut={!cut}
              onStart={() => {
                resetKit();
                setStage("earn");
              }}
            />
          ) : null}
          {stage === "earn" || stage === "explain" || stage === "practice" ? (
            <EarnView
              earn={view}
              typed={typed}
              setTyped={setTyped}
              country={kitProfile?.country ?? seeded ?? undefined}
              countingLevel={levelsNow.counting ?? 1}
              fading={celebrate != null}
              pulse={pulse}
              dance={roundDance || earn.phase === "done"}
              onCheck={(attempt) => submitAnswer(false, attempt)}
              onHelp={askHelp}
              onPractice={() => {
                setEarn(startPractice(earn, levelsNow));
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
                const next = startGuided(earn, levelsNow);
                setEarn(next);
                onKitProfile?.({
                  grade: kitProfile?.grade ?? grade,
      kitVersion: queenPost.version,
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
              freeTray={freeTray}
              guidedReady={guidedReady}
              focus={focus}
              flyGusset={flyGusset}
              showCheck={showCheck}
              unfinished={unfinished}
              round={earn.round}
              geometryLevel={savedLevels?.geometry ?? kitProfile?.levels.geometry ?? 4}
              onLength={(id, value) => setLengths((current) => ({ ...current, [id]: value }))}
              onDrag={setDrag}
              onUp={onTrayUp}
              onTap={tapPlace}
              onFocus={setFocus}
              onLay={layAllPlanks}
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
              onHeavy={() => sendGoat(BIG_GOAT_MASS)}
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
    return "Pieces come cut to size. Put each one on its dotted line.";
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
  const [shown, setShown] = useState(marks);
  useEffect(() => {
    if (import.meta.env.VITEST) {
      setShown(marks);
      return;
    }
    const delta = Math.max(1, Math.abs(marks - shown));
    const stepMs = Math.max(16, Math.round(1000 / delta));
    const timer = window.setInterval(() => {
      setShown((current) => {
        if (current === marks) {
          window.clearInterval(timer);
          return current;
        }
        return current < marks ? current + 1 : current - 1;
      });
    }, stepMs);
    return () => window.clearInterval(timer);
  }, [marks]);
  return (
    <>
      <div className="gk-marks" data-marks={shown}>
        <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
          <circle cx="14" cy="14" r="12" fill="#F2B544" />
          <circle cx="14" cy="14" r="8" fill="none" stroke="#9A6A12" strokeWidth="1.5" />
          <text x="14" y="18" textAnchor="middle" fontFamily="Fraunces, serif" fontSize="12" fontWeight="800" fill="#9A6A12">
            M
          </text>
        </svg>
        {shown} marks
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
  onTry,
}: {
  marks: number;
  units: UnitSystem;
  onUnits: (units: UnitSystem) => void;
  onProfile: () => void;
  onOpen: () => void;
  onTry: () => void;
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
        <button className="gk-check gk-try" type="button" onClick={onTry}>
          Try it
        </button>
        <div className="gk-strands">
          <span className="gk-strand" style={{ background: "#E8F3EA", color: "#1F6B3A" }}>
            Measuring: strong
          </span>
          <span className="gk-strand" style={{ background: "#E8F3EA", color: "#1F6B3A" }}>
            Adding: strong
          </span>
          <span className="gk-strand" style={{ background: "#E8F3EA", color: "#1F6B3A" }}>
            Dividing: getting there
          </span>
          <span className="gk-strand" style={{ background: "#FFF3DA", color: "#9A6A12" }}>
            Fractions: getting there
          </span>
          <span className="gk-strand" style={{ background: "#F1EFEA", color: "#6B6459" }}>
            Ratios: new to you
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
          <LockedCard title="The Teeter Totter" note="Comparing, multiplying, balance. Later moments and unknown masses." pill="Later" thumb={teeterThumb()} />
          <LockedCard title="The Well Winch" note="Counting teeth, ratios, fractions of a turn. Later torque and clockwork." pill="Not started" thumb={winch} />
          <LockedCard title="The Mountain Ramp" note="Rise over run, angles, how steep a car can climb. Later speed and energy." pill="Not started" thumb={ramp} />
          <LockedCard title="The Bicycle" note="Gear ratios, wheel size, how far one pedal turn takes you." pill="Later" locked thumb={bicycle} />
          <LockedCard title="The Catapult" note="Arm ratios, angles, how far it flies. Later trajectories." pill="Later" locked thumb={catapult} />
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
  dance,
  onCheck,
  onHelp,
  onPractice,
  onEasier,
  onLearn,
  onBuild,
  earned,
  country,
  countingLevel,
}: {
  earn: EarnState;
  typed: string;
  setTyped: (value: string) => void;
  country?: string;
  countingLevel: number;
  fading?: boolean;
  pulse?: string | null;
  dance?: boolean;
  onCheck: (attempt?: string) => void;
  onHelp: () => void;
  onPractice: () => void;
  onEasier: () => void;
  onLearn: () => void;
  onBuild: () => void;
  earned: string[];
}) {
  const question = earn.phase === "done" ? null : currentQuestion(earn);
  const groupId = question?.groupId ?? earn.current?.groupId;
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
            <button className="gk-check" type="button" data-action="primary" onClick={onBuild}>
              Build it
            </button>
          </div>
          <EarnedBar steps={earn.steps} round={earn.round} short={earn.short} />
          <RoundMark round={earn.round} />
          <GoatWait />
        </div>
        <KitPanel earned={earned} pulse={pulse} dance={dance} />
      </div>
    );
  }
  if (earn.phase === "learn") {
    const explained = explainQuestion(earn.current);
    const skill = KIT_SKILLS.find((item) => item.id === earn.current.skillId);
    const learn = earn.current.skillId ? skillLearnLine(earn.current.skillId, earn.seed) : null;
    const draw = learn?.draw ?? (earn.current.fact.kind === "plain" ? earn.current.fact.draw : null);
    const line = learn?.line ?? (draw ? notationLine(draw, earn.current.answer) : `${earnPrompt(earn.current).replace("?", earn.current.answer)}`);
    return (
      <div className="gk-body">
        <div className="gk-earn">
          <div className="gk-card">
            <div className="gk-kicker">
              <span>Learn</span>
            </div>
            <SpokenPrompt
              text={`${learn?.title ?? skill?.name}. ${line}`}
              label={learn?.title ?? skill?.name}
              country={country}
              parent={earn.current.level <= 2}
              skillId={skill?.id ?? ""}
            />
            <LearnSketch draw={draw ?? null} line={line} />
            <p className={earn.current.level <= 2 ? "gk-parent-words" : undefined}>{explained.why}</p>
            <button className="gk-check" type="button" data-action="primary" onClick={onLearn}>
              Now you try
            </button>
          </div>
          <EarnedBar steps={earn.steps} round={earn.round} short={earn.short} />
          <RoundMark round={earn.round} />
          <GoatWait />
        </div>
        <KitPanel earned={earned} current={earn.current.groupId} pulse={pulse} dance={dance} />
      </div>
    );
  }
  if (!question) {
    return (
      <div className="gk-body">
        <div className="gk-earn">
          <div className="gk-card">
            <p>Loading the next question.</p>
          </div>
          <EarnedBar steps={earn.steps} round={earn.round} short={earn.short} />
          <RoundMark round={earn.round} />
        </div>
        <KitPanel earned={earned} pulse={pulse} dance={dance} />
      </div>
    );
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
              <button className="gk-check" type="button" data-action="primary" onClick={onPractice}>
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
        <KitPanel earned={earned} current={groupId} pulse={pulse} dance={dance} />
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
            ? `${earn.streak + 1} right in a row`
            : `${earn.runGot + 1} of ${runLength(groupId, earn.short)}`;
  const openHint = earn.phase === "guided" ? earn.current.hint || hint : hint;
  const dueReview = Boolean(question.skillId && skillIsDue(earn.book.skills[question.skillId], earn.day));
  const action = questionAction(question, countingLevel);
  return (
    <div className="gk-body">
      <div className="gk-earn">
        <div className={fading ? "gk-card is-fading" : "gk-card"}>
          <div className="gk-kicker gk-kicker-stack">
            <span>{counter}</span>
            <span className="gk-qstrand">{strandName(question.strandId)}</span>
            {earn.phase === "warmup" && dueReview ? <span data-review="due">Review</span> : null}
          </div>
          <div className="gk-work">
            <div className="gk-card-main">
          <SpokenPrompt text={earnPrompt(question)} country={country} parent={question.level <= 2} />
          {question.level <= 2 && question.fact.kind === "plain" && question.fact.draw && !question.word && action !== "drag-count" && action !== "order" ? (
            <OperandMarks draw={question.fact.draw} />
          ) : null}
          {picture ? <EarnSketch question={question} /> : null}
          {openHint ? <p className={question.level <= 2 ? "gk-hint gk-parent-words" : "gk-hint"}>{openHint}</p> : null}
          <AnswerPad
            phase={earn.phase}
            typed={typed}
            answer={question.answer}
            truth={question.truth}
            level={question.level}
            resetKey={`${earn.phase}:${earnPrompt(question)}:${earn.runGot}`}
            unit={earnMeasure(question) === "weight" ? weightAbbrev() : earnMeasure(question) === "length" ? lengthAbbrev() : ""}
            keys={keys}
            choices={question.choices}
            action={action}
            sizes={question.sizes}
            draw={question.fact.kind === "plain" ? question.fact.draw : undefined}
            showDots={countingLevel < 3}
            onType={setTyped}
            onCommit={(attempt) => onCheck(attempt)}
            onHelp={onHelp}
          />
            </div>
            <ScratchPad
              resetKey={`${earn.phase}:${earnPrompt(question)}:${earn.runGot}`}
              layout={question.layout}
              marks={new URLSearchParams(window.location.search).get("marks") === "borrow" ? "borrow" : new URLSearchParams(window.location.search).get("marks") === "carry" ? "carry" : undefined}
            />
          </div>
        </div>
        <EarnedBar steps={earn.steps} round={earn.round} short={earn.short} />
        <RoundMark round={earn.round} />
        <GoatWait />
      </div>
      <KitPanel earned={earned} current={groupId} pulse={pulse} dance={dance} />
    </div>
  );
}

function notationLine(draw: { op: string; a: number; b: number; c?: number }, answer: string): string {
  if (draw.op === "mul" || draw.op === "groups" || draw.op === "area") {
    return `${draw.a} × ${draw.b} = ${answer}`;
  }
  if (draw.op === "div") {
    const sign = draw.c === -1 ? "−" : "";
    return `${sign}${draw.a} ÷ ${draw.b} = ${answer}`;
  }
  if (draw.op === "add") {
    return `${draw.a} + ${draw.b} = ${answer}`;
  }
  if (draw.op === "sub" || draw.op === "compare") {
    return `${draw.a} − ${draw.b} = ${answer}`;
  }
  if (draw.op === "frac") {
    return `${draw.a}/${draw.b} of ${draw.c ?? ""} = ${answer}`;
  }
  if (draw.op === "eq") {
    return `${draw.a}x + ${draw.b} = ${draw.c ?? ""}, x = ${answer}`;
  }
  if (draw.op === "square") {
    return `√${draw.a} = ${answer}`;
  }
  if (draw.op === "hyp") {
    return `√(${draw.a}² + ${draw.b}²) = ${answer}`;
  }
  return `${draw.a}, ${draw.b} = ${answer}`;
}

function LearnSketch({ draw, line }: { draw: { op: string; a: number; b: number; c?: number } | null; line: string }) {
  const rows = draw && (draw.op === "mul" || draw.op === "groups" || draw.op === "area") ? Math.min(8, Math.max(1, draw.a)) : 0;
  const each = draw && rows > 0 ? Math.min(12, Math.max(1, draw.b)) : 0;
  return (
    <div className="gk-learn-pic" data-rows={rows || undefined} data-each={each || undefined}>
      {rows > 0
        ? Array.from({ length: rows }, (_, row) => (
            <span key={row}>
              {Array.from({ length: each }, (_, dot) => (
                <i key={dot} />
              ))}
            </span>
          ))
        : null}
      <p className="gk-note" data-learn-line="">
        {line}
      </p>
    </div>
  );
}

function OperandMarks({ draw }: { draw: { op: string; a: number; b: number } }) {
  const bolt = draw.op === "mul" || draw.op === "div" || draw.op === "groups";
  const groups = [draw.a, draw.b].filter((count) => count > 0 && count <= 12);
  if (groups.length === 0) {
    return null;
  }
  return (
    <div className="gk-dots" data-marks="1">
      {groups.map((count, index) => (
        <span key={index} data-count={count}>
          {Array.from({ length: count }, (_, dot) => (
            <i key={dot} className={bolt ? "bolt" : ""} />
          ))}
        </span>
      ))}
    </div>
  );
}

function questionAction(question: EarnQuestion, countingLevel: number): ActionKind {
  if (question.choices && question.choices.length > 0) {
    return "tap-choice";
  }
  if (question.action === "drag-count" || question.action === "order" || question.action === "drag-goat") {
    return question.action;
  }
  if (question.level <= 1) {
    return "drag-count";
  }
  const value = Number(question.answer);
  if (question.level === 2 && Number.isInteger(value) && value >= 0 && value <= 10) {
    return "numeral-strip";
  }
  void countingLevel;
  return question.action ?? "keypad";
}

function SpokenPrompt({
  text,
  label,
  country,
  parent,
  skillId,
}: {
  text: string;
  label?: string;
  country?: string;
  parent?: boolean;
  skillId?: string;
}) {
  const lang = speechLang(country);
  useEffect(() => {
    speakText(text, lang);
    return () => cancelSpeech();
  }, [text, lang]);
  return (
    <div className="gk-spoken">
      <h2 className={parent ? "gk-prompt is-parent" : "gk-prompt"} data-skill={skillId ?? ""}>
        {label ?? text}
      </h2>
      <button className="gk-speak" type="button" data-speak="replay" aria-label="Hear it again" onClick={() => speakText(text, lang)}>
        Hear it
      </button>
    </div>
  );
}

function NumeralDots({ count }: { count: number }) {
  const n = Math.max(0, Math.min(10, count));
  return (
    <span className="gk-num-dots" data-dots={n}>
      {Array.from({ length: n }, (_, index) => (
        <i key={index} />
      ))}
    </span>
  );
}

function DragCountPad({
  answer,
  draw,
  resetKey,
  onCommit,
}: {
  answer: string;
  draw?: { op: string; a: number; b: number };
  resetKey: string;
  onCommit: (attempt: string) => void;
}) {
  const target = Number(answer);
  const left = draw && draw.b > 0 ? Math.max(1, draw.a) : Math.max(target, 10);
  const right = draw && draw.b > 0 ? Math.max(1, draw.b) : 0;
  const [inBox, setInBox] = useState(0);
  useEffect(() => {
    setInBox(0);
  }, [resetKey]);
  useEffect(() => {
    if (inBox !== target || !Number.isFinite(target) || target <= 0) {
      return;
    }
    const timer = window.setTimeout(() => onCommit(String(inBox)), 300);
    return () => window.clearTimeout(timer);
  }, [inBox, target, onCommit]);
  const remainLeft = Math.max(0, left - Math.min(inBox, left));
  const remainRight = Math.max(0, right - Math.max(0, inBox - left));
  return (
    <div className="gk-drag-count" data-action="drag-count">
      <div className="gk-drag-tray">
        {Array.from({ length: remainLeft }, (_, index) => (
          <button key={`a-${index}`} type="button" className="gk-drag-bolt" aria-label="Bolt" onClick={() => setInBox((count) => count + 1)}>
            <img src={art("bolt.png")} alt="" />
          </button>
        ))}
        {Array.from({ length: remainRight }, (_, index) => (
          <button key={`b-${index}`} type="button" className="gk-drag-bolt" aria-label="Bolt" onClick={() => setInBox((count) => count + 1)}>
            <img src={art("bolt.png")} alt="" />
          </button>
        ))}
      </div>
      <div
        className="gk-drag-box"
        data-count={inBox}
        onClick={() => {
          if (inBox > 0) {
            setInBox((count) => count - 1);
          }
        }}
      >
        {Array.from({ length: inBox }, (_, index) => (
          <img key={index} src={art("bolt.png")} alt="" />
        ))}
        <span>Box</span>
      </div>
    </div>
  );
}

function OrderPad({
  sizes,
  resetKey,
  onCommit,
}: {
  sizes?: number[];
  resetKey: string;
  onCommit: (attempt: string) => void;
}) {
  const pieces = sizes && sizes.length > 0 ? sizes : [2, 4, 6];
  const [order, setOrder] = useState(() => [...pieces].reverse());
  useEffect(() => {
    setOrder([...pieces].reverse());
  }, [resetKey, pieces.join(",")]);
  useEffect(() => {
    const wanted = [...pieces].sort((left, right) => left - right).join(",");
    if (order.join(",") === wanted) {
      const timer = window.setTimeout(() => onCommit(wanted), 300);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [order, pieces, onCommit]);
  function move(index: number, dir: -1 | 1) {
    const next = index + dir;
    if (next < 0 || next >= order.length) {
      return;
    }
    const copy = order.slice();
    const [item] = copy.splice(index, 1);
    copy.splice(next, 0, item);
    setOrder(copy);
  }
  return (
    <div className="gk-order" data-action="order">
      {order.map((size, index) => (
        <div key={`${size}-${index}`} className="gk-order-piece" data-size={size} style={{ width: 36 + size * 14 }}>
          <button type="button" aria-label="Move left" onClick={() => move(index, -1)}>
            ←
          </button>
          <span />
          <button type="button" aria-label="Move right" onClick={() => move(index, 1)}>
            →
          </button>
        </div>
      ))}
    </div>
  );
}

function AnswerPad({
  phase,
  typed,
  answer,
  truth,
  level: _level,
  resetKey,
  unit,
  keys,
  choices,
  action,
  sizes,
  draw,
  showDots,
  onType,
  onCommit,
  onHelp,
}: {
  phase: string;
  action?: ActionKind;
  sizes?: number[];
  draw?: { op: string; a: number; b: number };
  showDots?: boolean;
  typed: string;
  answer: string;
  truth?: number;
  level: number;
  resetKey: string;
  unit: string;
  keys: string[];
  choices?: ChoiceOption[];
  onType: (value: string) => void;
  onCommit: (attempt?: string) => void;
  onHelp: () => void;
}) {
  void _level;
  const [flash, setFlash] = useState<"" | "right" | "wrong">("");
  const [held, setHeld] = useState<string | null>(null);
  const moving = useRef(false);
  useEffect(() => {
    setFlash("");
    setHeld(null);
    moving.current = false;
  }, [resetKey]);
  const commitRef = useRef(onCommit);
  commitRef.current = onCommit;
  useEffect(() => {
    if (choices && choices.length > 0) {
      return;
    }
    if (phase !== "plain" || moving.current || held != null || !typed) {
      return;
    }
    if (!acceptsAnswer(typed, answer, truth)) {
      return;
    }
    moving.current = true;
    setFlash("right");
    const attempt = typed;
    const timer = window.setTimeout(() => commitRef.current(attempt), 300);
    return () => {
      window.clearTimeout(timer);
      moving.current = false;
    };
  }, [typed, resetKey, phase, answer, truth, held, choices]);

  function pickChoice(value: string) {
    if (moving.current) {
      return;
    }
    if (phase !== "plain") {
      onCommit(value);
      return;
    }
    if (acceptsAnswer(value, answer, truth)) {
      moving.current = true;
      setFlash("right");
      setHeld(value);
      window.setTimeout(() => onCommit(value), 300);
      return;
    }
    moving.current = true;
    setFlash("wrong");
    setHeld(answer);
    window.setTimeout(() => onCommit(value), 1000);
  }

  function commit() {
    if (moving.current) {
      return;
    }
    if (phase !== "plain") {
      onCommit(typed);
      return;
    }
    if (acceptsAnswer(typed, answer, truth)) {
      moving.current = true;
      setFlash("right");
      window.setTimeout(() => onCommit(typed), 300);
      return;
    }
    moving.current = true;
    setFlash("wrong");
    setHeld(answer);
    const attempt = typed;
    window.setTimeout(() => onCommit(attempt), 1000);
  }
  function press(key: string) {
    if (moving.current) {
      return;
    }
    if (key === "←") {
      onType(typed.slice(0, -1));
      return;
    }
    if (key === "−") {
      onType(typed.startsWith("-") ? typed.slice(1) : `-${typed}`);
      return;
    }
    onType(`${typed}${key}`);
  }

  if (action === "drag-count") {
    return (
      <>
        <DragCountPad answer={answer} draw={draw} resetKey={resetKey} onCommit={(value) => onCommit(value)} />
        <button className="gk-idk" type="button" onClick={onHelp}>
          I don't know
        </button>
      </>
    );
  }
  if (action === "order") {
    return (
      <>
        <OrderPad sizes={sizes} resetKey={resetKey} onCommit={(value) => onCommit(value)} />
        <button className="gk-idk" type="button" onClick={onHelp}>
          I don't know
        </button>
      </>
    );
  }
  if (action === "numeral-strip") {
    return (
      <>
        <div className="gk-strip" data-strip="1" role="group" aria-label="Numbers" style={{ display: "grid", gridTemplateColumns: "repeat(6, 58px)", gap: 8 }}>
          {Array.from({ length: 11 }, (_, value) => (
            <button key={value} type="button" className="gk-strip-num" data-num={value} onClick={() => pickChoice(String(value))}>
              <b>{value}</b>
              {showDots ? <NumeralDots count={value} /> : null}
            </button>
          ))}
        </div>
        <button className="gk-idk" type="button" onClick={onHelp}>
          I don't know
        </button>
      </>
    );
  }
  if (choices && choices.length > 0) {
    return (
      <>
        <div className="gk-choices" data-choices={choices.length} role="group" aria-label="Choices">
          {choices.map((option, index) => {
            const lit = held === option.value;
            const cls =
              flash === "right" && lit ? "is-right" : flash === "wrong" && lit ? "is-right" : flash === "wrong" && held !== option.value ? "is-dim" : "";
            return (
              <button
                key={option.value}
                type="button"
                className={`gk-choice ${cls}`}
                data-choice={option.value}
                data-kind={option.kind}
                data-action={index === 0 ? "primary" : undefined}
                disabled={moving.current}
                onClick={() => pickChoice(option.value)}
              >
                <ChoiceFace option={option} />
              </button>
            );
          })}
        </div>
        <button className="gk-idk" type="button" onClick={onHelp}>
          I don't know
        </button>
      </>
    );
  }

  return (
    <>
      <div className="gk-answer">
        <input
          aria-label="Answer"
          className={flash === "right" ? "is-right" : flash === "wrong" ? "is-wrong" : ""}
          value={held ?? typed}
          onChange={(event) => onType(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit();
            }
          }}
        />
        <span className="gk-unit">{unit}</span>
        {phase === "plain" ? null : (
          <button className="gk-check" type="button" data-action="primary" onClick={commit}>
            Check
          </button>
        )}
      </div>
      <div className="gk-keys">
        {keys.map((key) => (
          <button key={key} type="button" onClick={() => press(key)}>
            {key}
          </button>
        ))}
      </div>
      <button className="gk-idk" type="button" onClick={onHelp}>
        I don't know
      </button>
    </>
  );
}

function ChoiceFace({ option }: { option: ChoiceOption }) {
  if (option.kind === "picture" && option.draw) {
    return <ChoicePicture draw={option.draw} />;
  }
  if (option.kind === "number") {
    const value = Number(option.value);
    return (
      <span className="gk-choice-num">
        {option.label ?? option.value}
        {Number.isInteger(value) && value >= 0 && value <= 10 ? <NumeralDots count={value} /> : null}
      </span>
    );
  }
  return <span className="gk-choice-label">{option.label ?? option.value}</span>;
}

function ChoicePicture({ draw }: { draw: { op: string; a: number; b: number; c?: number } }) {
  if (draw.op === "groups" || (draw.op === "add" && draw.b === 0 && draw.a <= 12)) {
    const count = Math.max(1, Math.min(12, draw.a));
    return (
      <span className="gk-choice-pic" data-pic="bolts">
        {Array.from({ length: count }, (_, index) => (
          <img key={index} src={art("bolt.png")} alt="" />
        ))}
      </span>
    );
  }
  if (draw.op === "frac") {
    const unequal = (draw.c ?? 0) < 0;
    const parts = Math.max(1, Math.min(8, Math.abs(draw.c ?? draw.b)));
    const widths = unequal
      ? [38, 62]
      : Array.from({ length: parts }, () => Math.floor(100 / parts));
    return (
      <span className="gk-choice-pic" data-pic="plank-parts" data-parts={unequal ? 2 : parts}>
        {widths.map((pct, index) => (
          <span key={`${pct}-${index}`} className="gk-plank-part" style={{ flex: `${pct} 1 0` }}>
            <img src={art("plank-side.png")} alt="" />
          </span>
        ))}
      </span>
    );
  }
  if (draw.op === "compare") {
    const width = draw.b === 0 ? Math.min(160, 24 + draw.a * 14) : Math.min(160, 24 + Math.min(draw.a, draw.b || draw.a) * 14);
    return (
      <span className="gk-choice-pic" data-pic="beam">
        <img src={art("beam-side.png")} alt="" style={{ width, height: 22 }} />
      </span>
    );
  }
  if (draw.op === "hyp") {
    return (
      <span className="gk-choice-pic" data-pic="brace">
        <img src={art("beam-half.png")} alt="" style={{ width: 92, height: 18, transform: "rotate(-35deg)" }} />
      </span>
    );
  }
  if (draw.op === "line") {
    return (
      <span className="gk-choice-pic" data-pic="post">
        <img src={art("post.png")} alt="" style={{ width: 22, height: 70 }} />
      </span>
    );
  }
  if (draw.op === "angle") {
    return <ShapeChoice sides={draw.a} />;
  }
  return <span className="gk-choice-label">{draw.a}</span>;
}

function ShapeChoice({ sides }: { sides: number }) {
  if (sides <= 0) {
    return (
      <span className="gk-choice-pic" data-pic="circle">
        <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden="true">
          <circle cx="36" cy="36" r="24" fill="none" stroke="#8B5A2B" strokeWidth="8" />
        </svg>
      </span>
    );
  }
  if (sides === 4) {
    return (
      <span className="gk-choice-pic" data-pic="square">
        <img src={art("plank-side.png")} alt="" style={{ position: "absolute", width: 56, height: 10, top: 14, left: 8 }} />
        <img src={art("plank-side.png")} alt="" style={{ position: "absolute", width: 56, height: 10, bottom: 14, left: 8 }} />
        <img src={art("post.png")} alt="" style={{ position: "absolute", width: 10, height: 44, top: 14, left: 8 }} />
        <img src={art("post.png")} alt="" style={{ position: "absolute", width: 10, height: 44, top: 14, right: 8 }} />
      </span>
    );
  }
  return (
    <span className="gk-choice-pic" data-pic="triangle">
      <img src={art("beam-side.png")} alt="" style={{ position: "absolute", width: 64, height: 10, bottom: 12, left: 4 }} />
      <img src={art("beam-half.png")} alt="" style={{ position: "absolute", width: 42, height: 10, top: 18, left: 4, transform: "rotate(-52deg)" }} />
      <img src={art("beam-half.png")} alt="" style={{ position: "absolute", width: 42, height: 10, top: 18, right: 4, transform: "rotate(52deg)" }} />
    </span>
  );
}

function teeterThumb(): string {
  const goat = art("teeter-totter/goat-trot-1.png");
  const elephant = art("teeter-totter/elephant-sit-1.png");
  if (!goat || !elephant) {
    return teeter;
  }
  return `<div class="gk-teeter-thumb" data-teeter="sprites"><img src="${goat}" alt="" /><img src="${elephant}" alt="" /></div>`;
}

function ScratchPad({
  resetKey,
  layout,
  marks,
}: {
  level?: number;
  resetKey: string;
  layout?: LadderLayout;
  marks?: "carry" | "borrow";
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const tool = useRef<"pencil" | "eraser">("pencil");
  const [mode, setMode] = useState<"pencil" | "eraser">("pencil");
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (canvas && context) {
      context.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, [resetKey]);
  function point(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) {
      return { x: 0, y: 0 };
    }
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / Math.max(rect.width, 1)) * canvas.width,
      y: ((event.clientY - rect.top) / Math.max(rect.height, 1)) * canvas.height,
    };
  }
  function start(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!context) {
      return;
    }
    drawing.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    const at = point(event);
    context.globalCompositeOperation = tool.current === "eraser" ? "destination-out" : "source-over";
    context.strokeStyle = "#22201c";
    context.lineWidth = tool.current === "eraser" ? 12 : 2;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(at.x, at.y);
  }
  function move(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) {
      return;
    }
    const context = canvasRef.current?.getContext("2d");
    if (!context) {
      return;
    }
    const at = point(event);
    context.lineTo(at.x, at.y);
    context.stroke();
  }
  function clear() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (canvas && context) {
      context.clearRect(0, 0, canvas.width, canvas.height);
    }
  }
  return (
    <div className="gk-scratch" data-sketch="on">
      {layout ? <StackLayout layout={layout} marks={marks} /> : null}
      <canvas
        ref={canvasRef}
        width={640}
        height={280}
        aria-label="Work it out"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={() => {
          drawing.current = false;
        }}
        onPointerLeave={() => {
          drawing.current = false;
        }}
      />
      <div className="gk-scratch-tools">
        <button
          type="button"
          className={mode === "pencil" ? "is-on" : undefined}
          onClick={() => {
            tool.current = "pencil";
            setMode("pencil");
          }}
        >
          Pencil
        </button>
        <button
          type="button"
          className={mode === "eraser" ? "is-on" : undefined}
          onClick={() => {
            tool.current = "eraser";
            setMode("eraser");
          }}
        >
          Eraser
        </button>
        <button type="button" onClick={clear}>
          Clear
        </button>
      </div>
    </div>
  );
}

function StackLayout({ layout, marks }: { layout: LadderLayout; marks?: "carry" | "borrow" }) {
  if (layout.kind === "long-division") {
    return (
      <div className="gk-longdiv" aria-hidden="true">
        <span className="gk-longdiv-quot" />
        <div className="gk-longdiv-row">
          <span className="gk-longdiv-div">{layout.bottom}</span>
          <span className="gk-longdiv-bracket">
            <i />
            <b>{layout.top}</b>
          </span>
        </div>
      </div>
    );
  }
  const top = layout.top.replace(/,/g, "");
  const bottom = layout.bottom.replace(/,/g, "");
  const width = Math.max(top.length, bottom.length);
  const topPad = top.padStart(width, " ");
  const botPad = bottom.padStart(width, " ");
  return (
    <div className="gk-stack" data-op={layout.op} aria-hidden="true">
      <div className="gk-stack-row gk-stack-carry">
        {Array.from({ length: width }, (_, index) => (
          <span key={`c-${index}`} className="gk-stack-cell">
            {marks === "carry" && index === width - 2 ? "1" : ""}
          </span>
        ))}
      </div>
      <div className="gk-stack-row">
        {Array.from(topPad).map((char, index) => (
          <span key={`t-${index}`} className="gk-stack-cell">
            {marks === "borrow" && index === width - 1 && char !== " " ? `${10 + Number(char)}` : marks === "borrow" && index === width - 2 ? <s>{char === " " ? "" : char}</s> : char === " " ? "" : char}
          </span>
        ))}
      </div>
      <div className="gk-stack-row">
        <span className="gk-stack-op">{layout.op}</span>
        {Array.from(botPad).map((char, index) => (
          <span key={`b-${index}`} className="gk-stack-cell">
            {char === " " ? "" : char}
          </span>
        ))}
      </div>
      <div className="gk-stack-line" />
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
  const shown = Math.min(steps, total);
  return (
    <div>
      <div className="gk-kicker">EARNED SO FAR</div>
      <div className="gk-bar">
        <i style={{ width: `${total === 0 ? 0 : (shown / total) * 100}%` }} />
      </div>
      <p className="gk-muted">
        {shown} of {total}
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

function IntroView({ onStart, precut }: { onStart: () => void; precut: boolean }) {
  return (
    <div className="gk-intro">
      <BridgeScene placed={{}} lengths={{}} goat={{ src: "goat-idle.png", left: 120, top: 205, width: 149, height: 150 }} />
      <div className="gk-intro-card">
        <p>{queenPost.intro}</p>
        {precut ? <p data-precut="">Your pieces come already cut. You will cut them yourself later.</p> : null}
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
  if (step.picture === "triangle" || step.picture === "root") {
    return (
      <svg className="gk-step-pic" data-picture={step.picture} viewBox="0 0 140 84" width="140" height="84">
        <polygon points="12,72 128,72 128,16" fill="#f6d34d" stroke="#22201c" strokeWidth="2" />
        <text x="58" y="80" fontSize="12">
          {step.a}
        </text>
        <text x="130" y="48" fontSize="12">
          {step.b}
        </text>
        {step.picture === "root" && step.count != null ? (
          <text x="70" y="48" fontSize="14" fontWeight="700">
            {step.count}
          </text>
        ) : null}
      </svg>
    );
  }
  if (step.picture === "squares" || step.picture === "sum" || step.picture === "area" || step.picture === "area-fill") {
    return (
      <div className="gk-step-pic gk-square-row" data-picture={step.picture}>
        <SquareBlock count={step.a ?? 1} />
        {step.b != null ? <SquareBlock count={step.b} /> : null}
      </div>
    );
  }
  if (step.picture.startsWith("plank")) {
    const parts = step.picture === "plank" ? 1 : step.picture === "plank-thirds" ? 3 : Math.max(2, Math.min(8, step.b ?? 2));
    const apart = step.picture === "plank-apart" || step.picture === "plank-thirds";
    if (apart) {
      return (
        <div className="gk-step-pic gk-step-planks is-apart" data-picture={step.picture} data-parts={parts}>
          {Array.from({ length: parts }, (_, index) => (
            <span key={index} className="gk-step-plank">
              <img src={art("plank-side.png")} alt="" />
            </span>
          ))}
        </div>
      );
    }
    const cuts = step.picture === "plank-cut" ? Array.from({ length: parts - 1 }, (_, index) => ((index + 1) / parts) * 100) : [];
    return (
      <div className="gk-step-pic gk-step-plank-one" data-picture={step.picture} data-parts={parts}>
        <img src={art("plank-side.png")} alt="" />
        {cuts.map((pct) => (
          <i key={pct} className="gk-step-cut-line" style={{ left: `${pct}%` }} />
        ))}
      </div>
    );
  }
  if (step.picture === "beam" || step.picture === "beams-pair" || step.picture === "brace-angle") {
    const long = Math.min(160, 40 + (step.a ?? 4) * 10);
    const short = Math.min(120, 28 + (step.b ?? 2) * 10);
    return (
      <div className="gk-step-pic gk-step-beams" data-picture={step.picture}>
        <img src={art("beam-side.png")} alt="" style={{ width: long, height: 18 }} />
        {step.picture !== "beam" ? <img src={art("beam-side.png")} alt="" style={{ width: short, height: 18 }} /> : null}
        {step.picture === "brace-angle" ? (
          <svg viewBox="0 0 80 48" width="80" height="48" aria-hidden="true">
            <polyline points="8,40 8,8 64,40" fill="none" stroke="#22201c" strokeWidth="4" />
          </svg>
        ) : null}
      </div>
    );
  }
  if (step.picture === "tape" || step.picture === "tape-marks" || step.picture === "number-line") {
    return (
      <div className="gk-step-pic gk-step-tape" data-picture={step.picture}>
        <span className="gk-step-tape-bar" />
        <i style={{ left: "20%" }} />
        <i style={{ left: "50%" }} />
        <i style={{ left: "80%" }} />
        {step.a != null ? <b>{step.a}</b> : null}
      </div>
    );
  }
  if (step.picture === "balance" || step.picture === "sign" || step.picture === "grid" || step.picture === "symbol") {
    return (
      <div className="gk-step-pic gk-step-symbol" data-picture={step.picture}>
        {step.picture === "balance" ? "=" : step.picture === "sign" ? "±" : step.picture === "grid" ? "▦" : "→"}
        {step.a != null ? <span>{step.a}</span> : null}
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

function KitPanel({ earned, current, pulse, dance }: { earned: string[]; current?: string; pulse?: string | null; dance?: boolean }) {
  const [step, setStep] = useState(1);
  useEffect(() => {
    if (!dance) {
      return;
    }
    setStep(1);
    let frame = 1;
    const timer = window.setInterval(() => {
      frame += 1;
      if (frame > 8) {
        window.clearInterval(timer);
        return;
      }
      setStep(frame);
    }, Math.round(1000 / 12));
    return () => window.clearInterval(timer);
  }, [dance]);
  return (
    <aside className="gk-panel">
      {dance ? <img className="gk-kit-dance" data-kit-dance={step} src={art(`goat-dance-${step}.png`)} alt="" /> : null}
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
  freeTray,
  guidedReady,
  focus,
  flyGusset,
  showCheck,
  unfinished,
  round,
  geometryLevel,
  onLength,
  onDrag,
  onUp,
  onTap,
  onFocus,
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
  freeTray: boolean;
  guidedReady: boolean;
  focus: string | null;
  flyGusset: { id: string; at: string } | null;
  showCheck: boolean;
  unfinished: boolean;
  round: number;
  geometryLevel: number;
  onLength: (id: string, value: string) => void;
  onDrag: (id: string | null) => void;
  onUp: (event: ReactPointerEvent<HTMLElement>, id: string) => void;
  onTap: (id: string) => void;
  onFocus: (id: string) => void;
  onLay: () => void;
  onSend: () => void;
  onSendNow: () => void;
  onLook: () => void;
  onEarn: () => void;
  onGuide: () => void;
}) {
  const numbers = numericLengths(lengths);
  const groups = new Set(queenPost.rounds[round]?.groups ?? []);
  const trayRows = [...TRAY, "planks"].filter((id) => groups.has(pieceGroup(id)));
  const guided = Boolean(guide) || guidedReady;
  const rows = guide
    ? trayRows.filter(
        (id) =>
          id === guide.piece ||
          (guide.piece === "planks" && id === "planks") ||
          (guide.piece.startsWith("plank") && id === "planks") ||
          (guide.piece === "gussets" && id === "gussets"),
      )
    : guidedReady
      ? []
      : trayRows;
  const rowDone = (id: string) =>
    id === "planks"
      ? plankSlots().every((slot) => placed[slot.id])
      : id === "gussets"
        ? gussetSlots().every((slot) => placed[slot.id]) || Boolean(placed.gussets)
        : Boolean(placed[id]);
  const canPlace = (id: string) => !rowDone(id);
  const ordered = freeTray ? [...rows].sort((a, b) => Number(rowDone(a)) - Number(rowDone(b))) : rows;
  const laid = plankSlots().filter((slot) => placed[slot.id]).length;
  const guideSlot =
    guide?.piece === "planks"
      ? plankSlots()[0]
      : guide?.piece === "gussets"
        ? gussetSlots()[0]
        : guide
          ? slotById(guide.piece)
          : null;
  const focused = focus
    ? (slotById(focus) ??
      (focus === "planks" ? plankSlots()[0] : focus.startsWith("gusset") ? gussetSlots().find((slot) => slot.id === focus) : null))
    : null;
  const factSlot = guideSlot ?? (focus === "planks" ? plankSlots()[0] : focus === "gussets" || focused?.kind === "gusset" ? (focused ?? gussetSlots()[0]) : focused);
  const fact = factSlot ? slotFact(factSlot, !cut) : null;
  const currentRow = guide?.piece === "planks" || guide?.piece?.startsWith("plank") ? "planks" : guide?.piece ?? null;
  const showSend = freeTray || guidedReady;
  return (
    <div className="gk-body">
      <div className="gk-scene-col">
        <BridgeScene
          placed={placed}
          lengths={numbers}
          drops
          preview={cut}
          holes={Boolean(guide?.piece === "planks" || (freeTray && groups.has("planks")))}
          hot={guide?.piece ?? (freeTray ? focus : null)}
          focus={focus}
          guided={guided && !guidedReady}
          flyGusset={flyGusset}
          onFocus={onFocus}
          geometryLevel={geometryLevel}
          goat={{ src: "goat-idle.png", left: 120, top: 205, width: 149, height: 150 }}
        />
        <div className="gk-strip">
          {(() => {
            const line = guide ? [guide.say, fact].filter(Boolean).join(" ") : fact ?? knownLine();
            return (
              <p className="gk-say" data-slot-fact={guide?.piece ?? focus ?? ""}>
                {line}
              </p>
            );
          })()}
          <div className="gk-actions">
            {showSend ? (
              <button className="gk-send" type="button" data-action="primary" onClick={onSend}>
                Send the goat
              </button>
            ) : null}
            {freeTray ? (
              <span className="gk-caption">{trayLeft === 0 ? "The tray is empty." : `${trayLeft} pieces still in the tray`}</span>
            ) : null}
            {freeTray || guidedReady ? (
              <button className="gk-again" type="button" onClick={onGuide}>
                Show me again
              </button>
            ) : null}
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
        <p className="gk-muted">
          {guide ? "This piece next." : guidedReady ? "Ready to send the goat." : "Tap a piece to place it, or drag it onto its dotted line."}
        </p>
        {ordered.map((id) => {
          const soft =
            currentRow === id ||
            (freeTray && (focus === id || (id === "gussets" && Boolean(focus?.startsWith("gusset"))) || (focus === "planks" && id === "planks")));
          if (id === "planks") {
            return (
              <div
                key="planks"
                className={`gk-row ${soft ? "focus" : ""}`}
                onPointerUp={() => {
                  onFocus("planks");
                  if (!guide) {
                    onTap("planks");
                  }
                }}
              >
                <span className="gk-thumb">
                  <img src={art("plank-side.png")} alt="" />
                  {!cut ? <em className="gk-stamp">{formatLength(1)}</em> : null}
                </span>
                <div className="gk-row-copy">
                  <b>8 planks</b>
                  <span>{laid === 8 ? "on the bridge" : "in the tray"}</span>
                </div>
                {cut ? (
                  <label className="gk-cut" onPointerDown={(event) => event.stopPropagation()}>
                    <input
                      className={lengths.planks ? "gk-len" : "gk-len empty"}
                      aria-label="Plank length"
                      value={lengths.planks ?? ""}
                      placeholder="?"
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          onLay();
                        }
                      }}
                      onChange={(event) => onLength("planks", event.target.value)}
                    />
                    <span className="gk-unit">{lengthAbbrev()}</span>
                  </label>
                ) : null}
                {canPlace("planks") ? (
                  <button className="gk-place" type="button" data-action="primary" onPointerDown={(event) => event.stopPropagation()} onClick={() => onLay()}>
                    Lay planks
                  </button>
                ) : null}
              </div>
            );
          }
          const slot = id === "gussets" || id === "bolts" || id === "rails" ? null : slotById(id);
          const group = queenPost.groups.find((item) => item.id === (slot?.group ?? id));
          const sprite = slot?.sprite ?? group?.sprite ?? "beam-side.png";
          const name = id === "gussets" ? "Gusset plate ×5" : id === "bolts" ? "Bolts ×10" : id === "rails" ? "Railing ×2" : slot?.name;
          const stamp = !cut && slot && slot.length != null && !slot.bonus ? formatLength(slot.length) : null;
          const placeLabel = id === "gussets" ? "Put on the gussets" : "Place";
          return (
            <div
              key={id}
              className={`gk-row ${placed[id] || (id === "gussets" && rowDone("gussets")) ? "earned" : ""} ${soft ? "focus" : ""}`}
              draggable={false}
              onPointerDown={(event) => {
                if (id !== "gussets" && id !== "bolts" && id !== "rails") {
                  onFocus(id);
                } else if (id === "gussets") {
                  onFocus("gussets");
                }
                if (guide) {
                  return;
                }
                if (placed[id] && id !== "gussets") {
                  return;
                }
                if (id === "gussets" && rowDone("gussets")) {
                  return;
                }
                onDrag(id);
                event.currentTarget.setPointerCapture(event.pointerId);
                event.currentTarget.dataset.x = String(event.clientX);
                event.currentTarget.dataset.y = String(event.clientY);
              }}
              onPointerUp={(event) => {
                if (guide) {
                  return;
                }
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
              <span className="gk-thumb">
                <img src={art(sprite)} alt="" />
                {stamp ? <em className="gk-stamp">{stamp}</em> : null}
              </span>
              <div className="gk-row-copy">
                <b>{name}</b>
                <span>{rowDone(id) ? "on the bridge" : "in the tray"}</span>
              </div>
              {cut && slot && slot.length != null && !slot.bonus ? (
                <label className="gk-cut" onPointerDown={(event) => event.stopPropagation()}>
                  <input
                    className={lengths[id] ? "gk-len" : "gk-len empty"}
                    aria-label={`${name} length`}
                    value={lengths[id] ?? ""}
                    placeholder="?"
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        onTap(id);
                      }
                    }}
                    onChange={(event) => onLength(id, event.target.value)}
                  />
                  <span className="gk-unit">{lengthAbbrev()}</span>
                </label>
              ) : null}
              {canPlace(id) ? (
                <button className="gk-place" type="button" data-action="primary" onPointerDown={(event) => event.stopPropagation()} onClick={() => onTap(id)}>
                  {placeLabel}
                </button>
              ) : null}
            </div>
          );
        })}
        {freeTray && queenPost.rounds[round]?.coming ? (
          <p className="gk-coming">Coming in round {round + 2}: {queenPost.rounds[round]?.coming}</p>
        ) : null}
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
  const [skipped, setSkipped] = useState(false);
  const last = result.frames[result.frames.length - 1] ?? result.frames[0];
  const held = skipped && result.ok ? last : seek == null ? null : frameNear(result.frames, seek);
  const frame = usePlayback(result, held, onSettled);
  const rows = pieceRows(lengths, result.cause, result.broke);
  const calm = rows.every((row) => row.state === "fit") && result.peakForce < 1000 * 0.6;
  const madeIt = result.ok && frame.mode === "arrived";
  const showButtons = import.meta.env.VITEST || skipped || frame.celebrate >= CELEBRATE_S;
  const big = result.massKg >= BIG_GOAT_MASS;
  return (
    <div className="gk-body">
      <div
        className="gk-scene-col"
        data-skip-celebrate={madeIt ? "1" : undefined}
        onClick={() => {
          if (madeIt) {
            setSkipped(true);
          }
        }}
      >
        <CrossingPicture frame={frame} extras={lengths} />
        <div className="gk-strip">
          <p>
            {madeIt ? "He made it. Not a drop on him." : frame.goatX >= 8 ? "The goat is across." : calm ? "Every piece fit, nothing is bending." : "The goat is on the bridge."}
          </p>
          {showButtons ? (
            <div className="gk-actions">
              <button className="gk-light" type="button" onClick={onHeavy}>
                Add a heavier goat
              </button>
              <button className="gk-dark" type="button" data-action="primary" onClick={onNext}>
                Next design
              </button>
            </div>
          ) : null}
        </div>
      </div>
      <aside className="gk-panel">
        <h2>How it is doing</h2>
        <div className="gk-load">
          <small>LOAD ON THE BRIDGE</small>
          <strong>{formatWeight(result.massKg)}</strong>
          <span className="gk-muted">{big ? "the big goat" : "one goat"}</span>
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
  const line = stareLine(numbers, result.cause, result.massKg >= BIG_GOAT_MASS);
  const hint = causeHint(result.cause, numbers);
  const glaring = frame?.mode === "glare";
  return (
    <div className="gk-body">
      <div className="gk-scene-col">
        {frame ? <CrossingPicture frame={frame} extras={numbers} /> : null}
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
              <button className="gk-dark" type="button" data-action="primary" onClick={onEarn}>
                Earn pieces
              </button>
            ) : (
              <button className="gk-dark" type="button" data-action="primary" onClick={onBack}>
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
    const lengths: Record<string, number> = { "bottom-a": 4, "bottom-b": 4 };
    for (const slot of queenPost.slots) {
      if (slot.kind === "plank") {
        lengths[slot.id] = 1;
      }
    }
    return lengths;
  }
  if (round === 2) {
    const lengths = numericLengths(filledLengths());
    for (const slot of queenPost.slots) {
      if (slot.kind === "rail" || slot.group === "bolts") {
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
    } else if (slot.kind === "gusset" || slot.kind === "bolt") {
      lengths[slot.id] = "1";
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

function openingEarn(
  levels: Record<string, number> | null,
  start: Open,
  lesson: string | null,
  saved: SkillBook | null | undefined,
  grade: GradeChoice | null = 13,
  asked = 0,
): EarnState {
  if (lesson === "last") {
    return roundEndHold(levels, 0);
  }
  if (lesson === "loop" || lesson === "easier") {
    const held = explainHold("geometry", levels?.geometry ?? 9, 1);
    const using = levels ?? Object.fromEntries(KIT_STRANDS.map((id) => [id, held.current.level]));
    return lesson === "easier" ? easierPiece(held, using).state : held;
  }
  if (lesson === "warmup" || lesson === "learn" || lesson === "guided" || lesson === "mixed") {
    return lessonFrame(lesson, levels);
  }
  if (lesson === "step") {
    const base = blankEarn(levels, 1, saved, "2026-10-19", 0, grade);
    return answerEarn(base, base.current.answer, levels ?? {}).state;
  }
  if (start === "faster") {
    return finishedEarn("12 s faster than last time");
  }
  const base = blankEarn(levels, 1, saved, "2026-10-19", 0, grade);
  if (start === "explain") {
    return answerEarn(base, "nope", levels ?? {}).state;
  }
  if (start === "practice") {
    return startPractice(answerEarn(base, "nope", levels ?? {}).state);
  }
  let state = base;
  for (let index = 1; index < asked && state.phase !== "done"; index += 1) {
    if (state.phase === "learn") {
      state = startGuided(state, levels ?? {});
      continue;
    }
    const answer = state.current?.answer;
    if (!answer) {
      break;
    }
    state = answerEarn(state, answer, levels ?? {}).state;
  }
  return state;
}

function openingPlace(start: Open, grade: GradeChoice | null, asked = 0): LadderPlace | null {
  if (start !== "place" && start !== "place2") {
    return null;
  }
  let begun = beginLadderPlace(grade ?? 3);
  if (start === "place2") {
    begun = ladderPlaceAnswer(begun, grade ?? 3, true);
  }
  const extra = Math.max(0, asked - (start === "place2" ? 2 : 1));
  for (let index = 0; index < extra; index += 1) {
    begun = ladderPlaceAnswer(begun, grade ?? 3, index % 3 !== 0);
  }
  return begun;
}

function screenProfile(
  unplaced: boolean,
  profile: KitProfile | null,
  level: number | null,
  lesson?: string | null,
  seedCountry?: string | null,
  demo?: string | null,
): KitProfile {
  if (unplaced && demo !== "fluent") {
    return { grade: null, levels: {}, history: [], notes: [] };
  }
  const base = profile ?? { grade: null, levels: {}, history: [], notes: [] };
  if (demo === "fluent") {
    const levels = Object.keys(base.levels).length > 0 ? base.levels : Object.fromEntries(KIT_STRANDS.map((id) => [id, 4]));
    return {
      ...base,
      grade: base.grade ?? 3,
      country: base.country ?? seedCountry ?? "US",
      levels,
      skills: demoFluentBook(),
    };
  }
  const country = base.country ?? (seedCountry && countryByCode(seedCountry) ? seedCountry.toUpperCase() : undefined);
  const gradeSystem = base.gradeSystem ?? (country ? defaultsForCountry(country).gradeSystem : undefined);
  if (lesson === "easier") {
    const rung = level ?? base.levels.geometry ?? 9;
    const using = strandLevels(rung, undefined) ?? {};
    const next = easierPiece(explainHold("geometry", rung, 1), using);
    return {
      ...base,
      country,
      gradeSystem,
      grade: base.grade ?? 3,
      levels: next.levels,
      notes: next.note ? [...base.notes.filter((item) => item !== next.note), next.note] : base.notes,
      skills: next.state.book,
    };
  }
  if (level != null) {
    const levels = strandLevels(level, undefined) ?? {};
    return { ...base, country, gradeSystem, grade: base.grade ?? 3, levels, skills: skillsFromLevels(levels) };
  }
  if (Object.keys(base.levels).length === 0) {
    return { ...base, country, gradeSystem };
  }
  const levels = fitLevels(base.levels);
  return { ...base, country, gradeSystem, levels, skills: base.skills ?? skillsFromLevels(levels) };
}

function LivePick({
  marks,
  units,
  onUnits,
  onProfile,
  selected,
  onChoose,
}: {
  marks: number;
  units: UnitSystem;
  onUnits: (units: UnitSystem) => void;
  onProfile: () => void;
  selected: string;
  onChoose: (code: string) => void;
}) {
  const [query, setQuery] = useState("");
  const matches = filterCountries(query);
  const highlighted = countryByCode(selected);
  return (
    <>
      <header className="gk-header">
        <button className="gk-codex" type="button" onClick={onProfile}>
          Codex
        </button>
        <div>
          <div className="gk-title">Where do you live?</div>
          <div className="gk-sub">This sets your units and grade names. You can change them later.</div>
        </div>
        <Account marks={marks} units={units} onUnits={onUnits} onProfile={onProfile} />
      </header>
      <div className="gk-pick">
        <label className="gk-country-search">
          <span>Search countries</span>
          <input
            aria-label="Search countries"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={highlighted ? `${flagEmoji(highlighted.code)} ${highlighted.name}` : "Country"}
            autoFocus
          />
        </label>
        <div className="gk-countries" role="listbox" aria-label="Countries">
          {matches.map((country) => (
            <button
              key={country.code}
              type="button"
              role="option"
              aria-selected={country.code === selected}
              className={country.code === selected ? "on" : ""}
              onClick={() => onChoose(country.code)}
            >
              <span className="gk-flag" aria-hidden="true">
                {flagEmoji(country.code)}
              </span>
              <span>{country.name}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function GradePick({
  marks,
  units,
  onUnits,
  gradeSystem,
  onProfile,
  onChoose,
}: {
  marks: number;
  units: UnitSystem;
  onUnits: (units: UnitSystem) => void;
  gradeSystem: GradeSystem;
  onProfile: () => void;
  onChoose: (grade: GradeChoice) => void;
}) {
  const europe = gradeSystem === "europe";
  const grades: GradeChoice[] = europe
    ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, "unsure"]
    : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, "unsure"];
  function gradeLabel(choice: GradeChoice): string {
    if (choice === "unsure") {
      return "Not sure";
    }
    if (europe) {
      return choice === 0 ? "Vorschule" : `Klasse ${choice}`;
    }
    return choice === 0 ? "K" : String(choice);
  }
  return (
    <>
      <header className="gk-header">
        <button className="gk-codex" type="button" onClick={onProfile}>
          Codex
        </button>
        <div>
          <div className="gk-title">{europe ? "Which Klasse?" : "What grade are you in?"}</div>
          <div className="gk-sub">Not sure is fine. This only picks where the questions start. Using {gradeSystemLabel(gradeSystem)}.</div>
        </div>
        <Account marks={marks} units={units} onUnits={onUnits} onProfile={onProfile} />
      </header>
      <div className="gk-pick" data-grade-system={gradeSystem}>
        <div className="gk-grades">
          {grades.map((choice) => (
            <button key={String(choice)} type="button" onClick={() => onChoose(choice)}>
              {gradeLabel(choice)}
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
  grade,
  typed,
  setTyped,
  onCheck,
  onHelp,
  note,
}: {
  marks: number;
  units: UnitSystem;
  onUnits: (units: UnitSystem) => void;
  onProfile: () => void;
  run: LadderPlace;
  grade: GradeChoice;
  typed: string;
  setTyped: (value: string) => void;
  onCheck: () => void;
  onHelp: () => void;
  note: string | null;
}) {
  const question = ladderPlaceAsk(run, grade, run.asked);
  const keys = keysFor(question.answer);
  return (
    <>
      <header className="gk-header">
        <button className="gk-codex" type="button" onClick={onProfile}>
          Codex
        </button>
        <div>
          <div className="gk-title">A few questions</div>
          <div className="gk-sub">{question.stepId ?? "Adding"}</div>
        </div>
        <Account marks={marks} units={units} onUnits={onUnits} onProfile={onProfile} />
      </header>
      <div className="gk-body">
        <div className="gk-earn">
          {note ? <p className="gk-note">{note}</p> : null}
          <div className="gk-work">
            <div className="gk-card">
              <div className="gk-kicker gk-kicker-stack">
                <span>QUESTION {run.asked + 1}</span>
                <span className="gk-qstrand">{question.stepId}</span>
              </div>
              <div className="gk-bar thin">
                <i style={{ width: `${(run.asked / 12) * 100}%` }} />
              </div>
              <h2 className="gk-prompt">{question.prompt}</h2>
              <div className="gk-answer">
                <input aria-label="Answer" value={typed} onChange={(event) => setTyped(event.target.value)} />
                <button className="gk-check" type="button" data-action="primary" onClick={onCheck}>
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
            <ScratchPad level={1} resetKey={`${run.asked}:${question.prompt}`} layout={question.item?.layout} />
          </div>
        </div>
      </div>
    </>
  );
}

function WhereView({
  marks,
  units,
  onUnits,
  gradeSystem,
  levels,
  steps,
  onProfile,
  onStart,
}: {
  marks: number;
  units: UnitSystem;
  onUnits: (units: UnitSystem) => void;
  gradeSystem: GradeSystem;
  levels: Record<string, number>;
  steps?: { adding: string; subtracting: string; multiplying?: string; dividing?: string };
  onProfile: () => void;
  onStart: () => void;
}) {
  return (
    <>
      <header className="gk-header">
        <button className="gk-codex" type="button" onClick={onProfile}>
          Codex
        </button>
        <div>
          <div className="gk-title">The Goat Bridge</div>
          <div className="gk-sub">Placement is done</div>
        </div>
        <Account marks={marks} units={units} onUnits={onUnits} onProfile={onProfile} />
      </header>
      <div className="gk-body">
        <div className="gk-earn">
          <div className="gk-card">
            <h1 className="gk-prompt">Here is where you are</h1>
            <p className="gk-sub" data-grade-system={gradeSystem}>
              Using {gradeSystemLabel(gradeSystem)}.
            </p>
            <ul className="gk-where">
              {steps?.adding ? (
                <>
                  <li>Adding {steps.adding}</li>
                  <li>Subtracting {steps.subtracting}</li>
                  {steps.multiplying ? <li>Multiplying {steps.multiplying}</li> : null}
                  {steps.dividing ? <li>Dividing {steps.dividing}</li> : null}
                </>
              ) : (
                KIT_STRANDS.map((id) => (
                  <li key={id}>{strandLine(id, levels[id] ?? 1)}</li>
                ))
              )}
            </ul>
            <button className="gk-check" type="button" data-action="primary" onClick={onStart}>
              Start
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
  gradeSystem,
  onGradeSystem,
  onCountry,
  onRetake,
  onBack,
}: {
  marks: number;
  units: UnitSystem;
  onUnits: (units: UnitSystem) => void;
  profile: KitProfile;
  gradeSystem: GradeSystem;
  onGradeSystem: (system: GradeSystem) => void;
  onCountry: () => void;
  onRetake: () => void;
  onBack: () => void;
}) {
  const country = countryByCode(profile.country);
  const gradeText =
    profile.grade === "unsure"
      ? "not sure"
      : profile.grade === 0
        ? gradeSystem === "europe"
          ? "Vorschule"
          : "K"
        : profile.grade == null
          ? "not set"
          : gradeSystem === "europe"
            ? `Klasse ${profile.grade}`
            : String(profile.grade);
  return (
    <>
      <header className="gk-header">
        <button className="gk-codex" type="button" onClick={onBack}>
          Codex
        </button>
        <div>
          <div className="gk-title">Maya</div>
          <div className="gk-sub">
            {gradeSystemLabel(gradeSystem)} · {gradeText}
          </div>
        </div>
        <Account marks={marks} units={units} onUnits={onUnits} onProfile={onBack} />
      </header>
      <div className="gk-pick">
        <button className="gk-country-chip" type="button" onClick={onCountry}>
          <span className="gk-flag" aria-hidden="true">
            {country ? flagEmoji(country.code) : "🌍"}
          </span>
          <span>{country?.name ?? "Where do you live?"}</span>
        </button>
        {Object.keys(profile.levels).length === 0 ? (
          <>
            <h1>Not placed yet, take the placement</h1>
            <button className="gk-check" type="button" onClick={onRetake}>
              Take the placement
            </button>
          </>
        ) : (
          <>
        <h1>Here is where you are</h1>
        <p className="gk-sub">Marks never move these. Only answers do.</p>
        <p className="gk-sub" data-grade-system={gradeSystem}>
          Using {gradeSystemLabel(gradeSystem)}.
        </p>
        <p className="gk-sub" data-cut-mode="">
          {preCut(profile.levels.measuring ?? 1)
            ? `Pre-cut pieces (measuring level ${profile.levels.measuring ?? 1}). Lengths are stamped on each piece until measuring reaches level 4.`
            : `Cut it yourself (measuring level ${profile.levels.measuring ?? 1}). Type each length before you place the piece.`}
        </p>
        {profile.notes.filter((note) => !/level\s+\d/i.test(note)).map((note) => (
          <p className="gk-note" key={note} data-log="level">
            {note}
          </p>
        ))}
        <ul className="gk-where">
          {KIT_STRANDS.map((id) => (
            <li key={id}>{strandLine(id, profile.levels[id] ?? 1)}</li>
          ))}
        </ul>
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
        <div className="gk-unit-toggle" role="group" aria-label="Grade system">
          {([
            ["us", "US grades"],
            ["europe", "Klasse"],
          ] as const).map(([choice, label]) => (
            <button key={choice} type="button" className={choice === gradeSystem ? "on" : ""} onClick={() => onGradeSystem(choice)}>
              {label}
            </button>
          ))}
        </div>
        <div className="gk-skill-board" data-profile="skills">
          {KIT_STRANDS.map((id) => {
            const levels = [...new Set(KIT_SKILLS.filter((skill) => skill.strandId === id).map((skill) => skill.level))].sort((a, b) => a - b);
            return (
              <section key={id}>
                <h2>{strandName(id)}</h2>
                {levels.map((level) => {
                  const skills = KIT_SKILLS.filter((skill) => skill.strandId === id && skill.level === level);
                  return (
                    <div key={`${id}-${level}`} className="gk-skill-level">
                      <h3>Level {level}</h3>
                      <div className="gk-skill-grid">
                        {skills.map((skill) => {
                          const progress = profile.skills?.skills[skill.id];
                          const state = (progress?.state ?? "new") as SkillStateName;
                          const median = medianAnswerMs(progress);
                          const times = (progress?.recent ?? []).map((item) => item.ms).filter((ms): ms is number => typeof ms === "number");
                          return (
                            <div key={skill.id} className={`gk-skill ${state}`} data-state={state}>
                              <b>{skill.name}</b>
                              <span>{progress?.struggling ? "struggling" : SKILL_STATE_LABEL[state]}</span>
                              {median != null ? (
                                <small data-median={median}>
                                  Median {Math.round(median / 100) / 10}s
                                  {times.length > 1 ? ` · ${times.map((ms) => `${Math.round(ms / 100) / 10}`).join(" ")}` : ""}
                                </small>
                              ) : null}
                              {progress?.recent.slice(-10).map((item, index) => (
                                <small key={`${item.prompt}-${index}`}>
                                  {item.prompt} {item.help ? "asked for help" : item.correct ? "right" : "wrong"}
                                </small>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
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

