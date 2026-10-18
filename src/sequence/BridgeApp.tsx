import { useEffect, useMemo, useRef, useState, type PointerEvent, type RefObject } from "react";
import type { LearnerMap } from "../engine/placement";
import {
  DISCLAIMER,
  METERS_SET,
  SIMPLER_ITEM,
  STEPS,
  TIERS,
  allowance,
  beamLength,
  designCost,
  designFitsBrief,
  discoveryScript,
  emptyNotes,
  failureLine,
  hintCard,
  makeResults,
  materialOf,
  neededKg,
  noteAttempt,
  numbersMatch,
  placementConclusion,
  practiceSet,
  qualityFor,
  representationFor,
  resultPlate,
  sameBuild,
  sceneFrame,
  shareReady,
  shortfallText,
  shouldPause,
  tierById,
  type AnswerQuality,
  type Attempt,
  type BridgeTier,
  type BuildSnapshot,
  type CodexPage,
  type NotebookEntry,
  type PracticeItem,
  type Representation,
  type SequenceSave,
} from "./logic";
import { paintRiver, type RiverPainter } from "./river";

type Phase =
  | "welcome"
  | "choices"
  | "arrive"
  | "starter-ask"
  | "starter-build"
  | "starter-cart"
  | "starter-reflect"
  | "learn"
  | "prove"
  | "share"
  | "invest"
  | "build"
  | "test"
  | "reflect"
  | "codex";

type Session = {
  phase: Phase;
  theme: "day" | "dusk";
  narration: boolean;
  tierId: string;
  representation: Representation;
  beat: number;
  notebook: NotebookEntry[];
  notebookOpen: boolean;
  marks: number;
  proveIndex: number;
  hintsUsed: number;
  misses: number;
  paused: boolean;
  attempts: Attempt[];
  materials: string[];
  beamSpec: number | null;
  deck: boolean;
  braces: number;
  versions: string[];
  drive: number;
  driving: boolean;
  showResult: boolean;
  frames: number;
  results: CodexPage["results"] | null;
  handwriting: string;
  reflection: string;
  explainAnswer: string;
  notes: ReturnType<typeof emptyNotes>;
  shareDone: boolean;
  blocksPlaced: number;
  typed: string;
  stars: number;
  simpler: boolean;
};

const STARTER_GAP = 4;
const STARTER_BEARING = 1;
const STARTER_LENGTH = 6;

function freshSession(map: LearnerMap, save: SequenceSave): Session {
  return {
    phase: "welcome",
    theme: "day",
    narration: save.narration,
    tierId: "bridge-04",
    representation: representationFor(map),
    beat: 0,
    notebook: [],
    notebookOpen: false,
    marks: save.marks,
    proveIndex: 0,
    hintsUsed: 0,
    misses: 0,
    paused: false,
    attempts: [],
    materials: [],
    beamSpec: null,
    deck: false,
    braces: 0,
    versions: [],
    drive: 0,
    driving: false,
    showResult: false,
    frames: 0,
    results: null,
    handwriting: "",
    reflection: "",
    explainAnswer: "",
    notes: emptyNotes(),
    shareDone: shareReady(map),
    blocksPlaced: 0,
    typed: "",
    stars: 0,
    simpler: false,
  };
}

function snapshot(session: Session): BuildSnapshot {
  return { beamSpec: session.beamSpec, deck: session.deck, braces: session.braces, materials: session.materials };
}

function stepIndex(phase: Phase): number {
  if (phase === "learn" || phase === "arrive" || phase === "starter-ask") return 0;
  if (phase === "prove" || phase === "share") return 1;
  if (phase === "invest") return 2;
  if (phase === "build" || phase === "starter-build") return 3;
  if (phase === "test" || phase === "starter-cart") return 4;
  if (phase === "reflect" || phase === "codex" || phase === "starter-reflect") return 5;
  return 0;
}

export function BridgeApp({
  map,
  sequence,
  onSequence,
  onSkillPass,
  initial,
}: {
  map: LearnerMap;
  sequence: SequenceSave;
  onSequence: (next: SequenceSave) => void;
  onSkillPass: (skillId: string, level: number) => void;
  initial?: Partial<Session>;
}) {
  const [session, setSession] = useState<Session>(() => ({ ...freshSession(map, sequence), ...initial }));
  const padRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);

  const tier = tierById(session.tierId);
  const frame = sceneFrame(session.phase.startsWith("starter") || session.phase === "arrive" ? STARTER_GAP : tier.gap, session.phase.startsWith("starter") || session.phase === "arrive" ? STARTER_BEARING : tier.bearing);
  const items = practiceSet(session.representation);
  const item = session.simpler ? SIMPLER_ITEM : items[Math.min(session.proveIndex, items.length - 1)] ?? METERS_SET[0];

  useEffect(() => {
    const canvas = sceneRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx || typeof ctx.fillRect !== "function") return;
    const length = session.phase.startsWith("starter") || session.phase === "arrive" ? STARTER_LENGTH : beamLength(tier.gap, tier.bearing);
    const material = session.materials[0] ? materialOf(tier, session.materials[0]) : null;
    const stress = material ? neededKg(tier) / material.capacityKg : session.drive;
    paintRiver(ctx as unknown as RiverPainter, {
      frame,
      theme: session.theme,
      truckX: 40 + session.drive * Math.max(80, frame.beamEnd - 120),
      beam: session.beamSpec != null || session.phase === "learn" || session.phase === "test",
      beamSpec: session.beamSpec ?? length,
      needed: length,
      stress,
      fail: session.showResult && session.results?.designWorked === false,
      celebrate: session.showResult && session.results?.designWorked === true,
      label: tier.unit === "m" && !session.phase.startsWith("starter") && session.phase !== "arrive" ? `${tier.gap} m` : `${STARTER_GAP} blocks`,
    });
  }, [session, frame, tier]);

  useEffect(() => {
    if (!session.driving) return;
    const slow = Math.abs(session.drive - 0.5) < 0.06;
    const timer = window.setTimeout(() => {
      setSession((current) => {
        const next = Math.min(1, current.drive + (slow ? 0.03 : 0.08));
        const done = next >= 1;
        return { ...current, drive: next, frames: current.frames + 1, driving: !done, showResult: done ? current.frames + 1 > 0 : false };
      });
    }, slow ? 280 : 70);
    return () => window.clearTimeout(timer);
  }, [session.driving, session.drive]);

  useEffect(() => {
    if (!session.results || session.stars >= 3) return;
    const timer = window.setTimeout(() => setSession((current) => ({ ...current, stars: current.stars + 1 })), 180);
    return () => window.clearTimeout(timer);
  }, [session.results, session.stars]);

  useEffect(() => {
    if (!session.narration) return;
    const text = document.querySelector("[data-narration]")?.textContent ?? "";
    if (!text || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  }, [session.phase, session.beat, session.narration]);

  function patch(partial: Partial<Session>) {
    setSession((current) => ({ ...current, ...partial }));
  }

  function toggleNotebook() {
    setSession((current) => {
      const before = snapshot(current);
      const next = { ...current, notebookOpen: !current.notebookOpen };
      if (!sameBuild(before, snapshot(next))) {
        return current;
      }
      return next;
    });
  }

  function speakLine(text: string) {
    patch({ typed: text });
  }

  const script = useMemo(() => discoveryScript(session.representation, tier), [session.representation, tier]);

  function openNotebookEntry(entry: NotebookEntry) {
    setSession((current) => {
      const before = snapshot(current);
      const notebook = current.notebook.some((item) => item.id === entry.id) ? current.notebook : [...current.notebook, entry];
      const next = { ...current, notebook, notebookOpen: true };
      return sameBuild(before, snapshot(next)) ? next : current;
    });
  }

  function submitProve(source: PracticeItem, raw: string) {
    const given = Number(raw);
    const correct = numbersMatch(given, source.answer);
    if (!correct) {
      const misses = session.misses + 1;
      patch({ misses, hintsUsed: misses, paused: shouldPause(misses) && source.id !== SIMPLER_ITEM.id, simpler: false, typed: "" });
      return;
    }
    const quality = qualityFor(true, session.hintsUsed) as AnswerQuality;
    const attempts = [...session.attempts, { itemId: source.id, quality }];
    if (source.id === SIMPLER_ITEM.id || session.paused) {
      patch({ paused: false, simpler: false, misses: 0, hintsUsed: 0, typed: "", attempts, proveIndex: Math.min(items.length, session.proveIndex + 1) });
      return;
    }
    const proveIndex = session.proveIndex + 1;
    if (proveIndex >= items.length) {
      const marks = allowance(attempts);
      patch({ attempts, proveIndex, marks, phase: session.shareDone ? "invest" : "share", misses: 0, hintsUsed: 0, typed: "" });
      onSequence({ ...sequence, marks, narration: session.narration });
      return;
    }
    patch({ attempts, proveIndex, misses: 0, hintsUsed: 0, typed: "", paused: false });
  }

  function cutBeam() {
    const spec = Number(session.typed);
    if (!numbersMatch(spec, beamLength(tier.gap, tier.bearing))) {
      patch({ beamSpec: null, versions: [...session.versions, shortfallText(tier, Number.isFinite(spec) ? spec : 0)], typed: "" });
      return;
    }
    patch({ beamSpec: spec, typed: "", versions: [...session.versions, `Cut ${spec} ${tier.unit}.`] });
  }

  function finishTest(explained: boolean) {
    const materialId = session.materials[0] ?? tier.passId;
    const designWorked = designFitsBrief(tier, materialId) && session.beamSpec === beamLength(tier.gap, tier.bearing) && session.deck;
    const results = makeResults(designWorked, session.attempts, explained);
    patch({ results, showResult: true, driving: false, drive: 1, frames: Math.max(session.frames, 1) });
  }

  function saveCodex(reflection: string) {
    const canvas = sceneRef.current;
    const image = canvas ? canvas.toDataURL() : session.handwriting;
    const materialId = session.materials[0] ?? "";
    const results = session.results ?? makeResults(false, session.attempts, false);
    const nextTier = TIERS.find((item) => item.project === tier.project + 1);
    const page: CodexPage = {
      id: `${tier.id}-${sequence.codex.length + 1}`,
      title: tier.title,
      image,
      handwriting: session.handwriting || image,
      gap: tier.gap,
      bearing: tier.bearing,
      loadKg: tier.loadKg,
      budget: tier.budget,
      beamLength: beamLength(tier.gap, tier.bearing),
      materials: session.materials,
      alternatives: tier.materials.map((item) => item.id).filter((id) => id !== materialId),
      changes: session.versions,
      results,
      reflection,
      next: nextTier ? `${nextTier.title} opens from the skill graph.` : "The sandbox is next.",
      disclaimer: DISCLAIMER,
    };
    const completedTiers = sequence.completedTiers.includes(tier.id) ? sequence.completedTiers : [...sequence.completedTiers, tier.id];
    onSequence({ ...sequence, narration: session.narration, marks: session.marks, completedTiers, codex: [...sequence.codex, page] });
    patch({ phase: "codex", reflection });
  }

  function buy(id: string) {
    const cost = designCost(tier, id);
    if (cost > tier.budget || cost > session.marks) return;
    patch({
      materials: Array.from({ length: tier.beams }, () => id),
      versions: [...session.versions, `Bought ${tier.beams} ${id} for ${cost} marks.`],
      phase: "build",
      beamSpec: null,
      deck: false,
    });
  }

  const hint = hintCard(session.misses);
  const showBar = session.phase !== "welcome" && session.phase !== "choices";

  return (
    <div className="bridge-app" data-phase={session.phase} data-beam={session.beamSpec ?? ""} data-notebook={session.notebookOpen ? "open" : "closed"}>
      <header className="wb-bar">
        <button type="button" className="wb-text" onPointerUp={() => patch({ phase: "welcome" })}>Builds</button>
        <div className="wb-title">Math Builds</div>
        {showBar ? (
          <ol className="wb-steps">
            {STEPS.map((step, index) => (
              <li key={step} className={index === stepIndex(session.phase) ? "on" : ""}>{step}</li>
            ))}
          </ol>
        ) : <div className="wb-steps" />}
        <button type="button" className="wb-text" onPointerUp={toggleNotebook}>Notebook</button>
        <div className="wb-marks">{session.marks} marks</div>
      </header>
      <div className="wb-main">
        {session.phase === "welcome" ? <Welcome onPick={() => patch({ phase: "choices" })} /> : null}
        {session.phase === "choices" ? (
          <Choices
            narration={session.narration}
            theme={session.theme}
            onNarration={(narration) => {
              patch({ narration });
              onSequence({ ...sequence, narration });
            }}
            onTheme={(theme) => patch({ theme })}
            onGo={() => patch({ phase: "arrive" })}
          />
        ) : null}
        {session.phase === "arrive" ? (
          <article className="wb-copy">
            <canvas ref={sceneRef} className="wb-scene" width={900} height={340} data-scene="starter" />
            <p className="wb-narration" data-narration>Can you see how wide the gap is?</p>
            <p className="wb-note">Look with the ruler. This look is not scored.</p>
            <button type="button" className="wb-go" onPointerUp={() => patch({ phase: "starter-ask" })}>The gap is four blocks</button>
          </article>
        ) : null}
        {session.phase === "starter-ask" ? (
          <article className="wb-copy">
            <canvas ref={sceneRef} className="wb-scene" width={900} height={340} />
            <p className="wb-narration" data-narration>The gap is four blocks wide. Our beam needs to rest on both banks. How many blocks long should it be?</p>
            <BlockRow count={session.blocksPlaced} onAdd={() => patch({ blocksPlaced: session.blocksPlaced + 1 })} />
            <AnswerRow typed={session.typed} onType={(typed) => patch({ typed })} onSpeak={() => speakLine(String(session.blocksPlaced || ""))} />
            <button type="button" className="wb-go" onPointerUp={() => {
              const given = Number(session.typed || session.blocksPlaced);
              const correct = given === STARTER_LENGTH;
              const notes = noteAttempt(session.notes, correct, correct, false);
              if (!correct) {
                const short = STARTER_LENGTH - (Number.isFinite(given) ? given : 0);
                const line = short === 1 ? "We're one block short on this side. Let's look at the gap again." : `${short} blocks short across both banks.`;
                patch({ notes, versions: [line], beamSpec: null, typed: "", blocksPlaced: 0 });
                return;
              }
              const found = placementConclusion(notes);
              if (found) onSkillPass(found.skillId, found.level);
              patch({ notes, phase: "starter-build", beamSpec: STARTER_LENGTH, typed: "" });
            }}>Cut and place</button>
            {session.versions.at(-1) ? <p className="wb-fail">{session.versions.at(-1)}</p> : null}
          </article>
        ) : null}
        {session.phase === "starter-build" ? (
          <article className="wb-copy">
            <canvas ref={sceneRef} className="wb-scene" width={900} height={340} />
            <p data-narration>The beam matches. Place the deck, then send a small cart.</p>
            <button type="button" className="wb-go" onPointerUp={() => patch({ deck: true, phase: "starter-cart", driving: true, drive: 0, frames: 0 })}>Place the deck and send the cart</button>
          </article>
        ) : null}
        {session.phase === "starter-cart" ? (
          <article className="wb-copy">
            <div className="wb-camera" style={{ transform: `translateX(${(0.5 - session.drive) * 24}px)` }}>
              <canvas ref={sceneRef} className="wb-scene" width={900} height={340} data-frames={session.frames} />
            </div>
            <p>{session.drive > 0.4 && session.drive < 0.7 ? "Slow motion" : "The cart is crossing."}</p>
            <button type="button" className="wb-go" disabled={session.drive < 1} onPointerUp={() => patch({ phase: "starter-reflect" })}>What helped?</button>
          </article>
        ) : null}
        {session.phase === "starter-reflect" ? (
          <article className="wb-copy">
            <p data-narration>What helped your bridge reach both banks?</p>
            {["Counting both banks", "The ruler", "Trying a longer beam"].map((choice) => (
              <button key={choice} type="button" className="wb-choice" onPointerUp={() => {
                onSequence({ ...sequence, narration: session.narration, completedTiers: sequence.completedTiers });
                patch({ reflection: choice, phase: "learn", tierId: "bridge-04", representation: representationFor(map) });
              }}>{choice}</button>
            ))}
          </article>
        ) : null}
        {session.phase === "learn" ? (
          <article className="wb-split">
            <canvas ref={sceneRef} className="wb-scene" width={900} height={340} data-scene={tier.id} />
            <div>
              <p className="wb-kicker">{tier.title}</p>
              <h1>{script[session.beat]?.title}</h1>
              <p className="wb-narration" data-narration>{script[session.beat]?.body}</p>
              <div className="wb-row">
                {(["blocks", "meters", "mechanism"] as Representation[]).map((rep) => (
                  <button key={rep} type="button" className={rep === session.representation ? "wb-chip on" : "wb-chip"} onPointerUp={() => patch({ representation: rep, beat: 0 })}>{rep}</button>
                ))}
              </div>
              <button type="button" className="wb-go" onPointerUp={() => {
                const entry = script[session.beat];
                if (entry) openNotebookEntry(entry);
                if (session.beat < script.length - 1) patch({ beat: session.beat + 1 });
                else patch({ phase: "prove", proveIndex: 0, misses: 0, hintsUsed: 0 });
              }}>{session.beat < script.length - 1 ? "Next" : "Now you try"}</button>
            </div>
          </article>
        ) : null}
        {session.phase === "prove" ? (
          <ProveView item={item} index={session.proveIndex} total={items.length} hint={hint} paused={session.paused} typed={session.typed} banks={hint?.step === "nudge"} onType={(typed) => patch({ typed })} onSubmit={() => submitProve(item, session.typed)} onSimpler={() => patch({ paused: false, simpler: true, misses: 0, hintsUsed: 0, typed: "" })} onDiscovery={() => patch({ phase: "learn", beat: 0, paused: false, simpler: false, misses: 0 })} />
        ) : null}
        {session.phase === "share" ? (
          <article className="wb-copy">
            <h1>Share the load</h1>
            <p data-narration>The truck's weight is shared equally by the two beams. 600 kg shared by 2 is how many kilograms each?</p>
            <AnswerRow typed={session.typed} onType={(typed) => patch({ typed })} onSpeak={() => patch({ typed: "300" })} />
            <button type="button" className="wb-go" onPointerUp={() => {
              if (!numbersMatch(Number(session.typed), 300)) {
                patch({ versions: [...session.versions, "Each beam carries half. 600 divided by 2."] });
                return;
              }
              onSkillPass("ratio-shares", 1);
              patch({ shareDone: true, phase: "invest", typed: "" });
            }}>Check the share</button>
          </article>
        ) : null}
        {session.phase === "invest" ? (
          <Invest tier={tier} marks={session.marks} onBuy={buy} />
        ) : null}
        {session.phase === "build" ? (
          <article className="wb-split">
            <div className="wb-camera">
              <canvas ref={sceneRef} className="wb-scene" width={900} height={340} />
            </div>
            <div>
              <h1>How long must the beam be to rest {tier.bearing} {tier.unit} on each bank of the {tier.gap} {tier.unit} gap?</h1>
              <p className="wb-note">Your working stays on the page.</p>
              <canvas ref={padRef} className="wb-pad" width={420} height={120} data-pad
                onPointerDown={(event) => { drawing.current = true; drawDot(padRef.current, event); }}
                onPointerMove={(event) => { if (drawing.current) drawDot(padRef.current, event); }}
                onPointerUp={() => { drawing.current = false; const url = padRef.current?.toDataURL() ?? ""; patch({ handwriting: url }); }}
              />
              <AnswerRow typed={session.typed} onType={(typed) => patch({ typed })} onSpeak={() => patch({ typed: String(beamLength(tier.gap, tier.bearing)) })} />
              <button type="button" className="wb-go" onPointerUp={cutBeam}>Cut and place</button>
              {session.beamSpec == null && session.versions.at(-1)?.includes("short") ? <p className="wb-fail">{session.versions.at(-1)} The piece is back in the pile.</p> : null}
              {session.beamSpec != null ? <button type="button" className="wb-go" onPointerUp={() => patch({ deck: true, phase: "test", drive: 0, frames: 0, driving: false, showResult: false, stars: 0 })}>Place the supplied deck</button> : null}
              <button type="button" className="wb-text" onPointerUp={() => openNotebookEntry(script[1] ?? script[0])}>Open the worked example</button>
            </div>
          </article>
        ) : null}
        {session.phase === "test" ? (
          <TestView session={session} tier={tier} sceneRef={sceneRef} onStart={() => patch({ driving: true, drive: 0, frames: 0, showResult: false, stars: 0, results: null })} onSkip={() => patch({ driving: false, drive: 1, frames: Math.max(1, session.frames), showResult: true })} onResults={() => finishTest(numbersMatch(Number(session.explainAnswer), 1))} onExplain={(explainAnswer) => patch({ explainAnswer })} onReplay={() => patch({ driving: true, drive: 0, frames: 0, showResult: false, stars: 0, results: null })} onReflect={() => patch({ phase: "reflect" })} onInvest={() => patch({ phase: "invest", materials: [], beamSpec: null, deck: false, showResult: false, results: null })} />
        ) : null}
        {session.phase === "reflect" ? (
          <article className="wb-copy">
            <h1>What I discovered</h1>
            <textarea className="wb-write" value={session.reflection} onChange={(event) => patch({ reflection: event.target.value })} placeholder="Write, or pick a caption below." />
            <button type="button" className="wb-choice" onPointerUp={() => saveCodex(session.reflection || "Both banks have to hold the beam.")}>Save this design</button>
            {["Both banks count.", "Pine was too light.", "The reserve is part of the model."].map((choice) => (
              <button key={choice} type="button" className="wb-choice" onPointerUp={() => saveCodex(choice)}>{choice}</button>
            ))}
          </article>
        ) : null}
        {session.phase === "codex" ? <CodexView page={sequence.codex.at(-1) ?? null} onProjects={() => patch({ phase: "welcome" })} /> : null}
      </div>
      <footer className="wb-foot">{DISCLAIMER}</footer>
      {session.notebookOpen ? (
        <aside className="wb-notebook" data-notebook-panel>
          <button type="button" onPointerUp={toggleNotebook}>Close</button>
          <h2>Notebook</h2>
          {session.notebook.length === 0 ? <p>Worked examples land here.</p> : session.notebook.map((entry) => (
            <article key={entry.id}><h3>{entry.title}</h3><p>{entry.body}</p></article>
          ))}
          <button type="button" className="wb-text" onPointerUp={() => patch({ notebookOpen: false, phase: "prove" })}>More practice</button>
        </aside>
      ) : null}
    </div>
  );
}

function Welcome({ onPick }: { onPick: () => void }) {
  return (
    <section className="wb-pick">
      <h1>Welcome, inventor. What would you like to build?</h1>
      <p className="wb-note">Pick one. Prove the math it needs, earn marks, buy materials, build it, test it.</p>
      <div className="wb-cards">
        <button type="button" className="wb-card" onPointerUp={onPick}>
          <span className="wb-card-art river" />
          <strong>The River Bridge</strong>
          <em>13 projects</em>
        </button>
        <article className="wb-card soon"><span className="wb-card-art lever" /><strong>The Teeter Totter</strong><em>Coming soon</em></article>
        <article className="wb-card soon"><span className="wb-card-art winch" /><strong>The Well Winch</strong><em>Coming soon</em></article>
      </div>
    </section>
  );
}

function Choices({ narration, theme, onNarration, onTheme, onGo }: { narration: boolean; theme: "day" | "dusk"; onNarration: (value: boolean) => void; onTheme: (theme: "day" | "dusk") => void; onGo: () => void }) {
  return (
    <section className="wb-copy">
      <h1>Before the river</h1>
      <p>Theme and narration only. No grade and no age question.</p>
      <div className="wb-row">
        <button type="button" className={theme === "day" ? "wb-chip on" : "wb-chip"} onPointerUp={() => onTheme("day")}>Day</button>
        <button type="button" className={theme === "dusk" ? "wb-chip on" : "wb-chip"} onPointerUp={() => onTheme("dusk")}>Dusk</button>
        <button type="button" className={narration ? "wb-chip on" : "wb-chip"} onPointerUp={() => onNarration(!narration)}>{narration ? "Narration on" : "Narration off"}</button>
      </div>
      <button type="button" className="wb-go" onPointerUp={onGo}>Go to the river</button>
    </section>
  );
}

function BlockRow({ count, onAdd }: { count: number; onAdd: () => void }) {
  return (
    <div className="wb-blocks">
      <button type="button" className="wb-block" onPointerDown={onAdd}>Drag a block</button>
      <div className="wb-placed" data-blocks={count}>{Array.from({ length: count }, (_, index) => <i key={index} />)}</div>
    </div>
  );
}

function AnswerRow({ typed, onType, onSpeak }: { typed: string; onType: (value: string) => void; onSpeak: () => void }) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", ".", "clear"];
  return (
    <div>
      <output className="wb-typed">{typed || " "}</output>
      <div className="wb-keys">
        {keys.map((key) => (
          <button key={key} type="button" className="pad-key" onPointerUp={() => onType(key === "clear" ? "" : `${typed}${key}`)}>{key}</button>
        ))}
        <button type="button" className="wb-text" onPointerUp={onSpeak}>Speak</button>
      </div>
    </div>
  );
}

function ProveView({ item, index, total, hint, paused, typed, banks, onType, onSubmit, onSimpler, onDiscovery }: {
  item: PracticeItem;
  index: number;
  total: number;
  hint: ReturnType<typeof hintCard>;
  paused: boolean;
  typed: string;
  banks: boolean;
  onType: (value: string) => void;
  onSubmit: () => void;
  onSimpler: () => void;
  onDiscovery: () => void;
}) {
  return (
    <article className="wb-copy" data-question={item.id}>
      <p className="wb-kicker">Question {Math.min(index + 1, total)} of {total}{item.kind === "transfer" ? " · transfer" : ""}{item.kind === "explain" ? " · explain" : ""}</p>
      <h1>{item.prompt}</h1>
      {item.sceneGap == null ? <p className="wb-note">No bridge in this picture. The same length rule still holds.</p> : null}
      <div className={banks ? "wb-banks on" : "wb-banks"} aria-hidden="true"><span>Bank</span><span>Gap</span><span>Bank</span></div>
      {hint ? <p className="wb-hint" data-hint={hint.step}>{hint.text}</p> : null}
      {paused ? (
        <div>
          <p>Let's pause this one. A simpler gap, or the discovery again. This question will not repeat.</p>
          <button type="button" className="wb-go" onPointerUp={onSimpler}>Try 6 + 0.5 + 0.5</button>
          <button type="button" className="wb-text" onPointerUp={onDiscovery}>See the discovery</button>
        </div>
      ) : (
        <>
          <AnswerRow typed={typed} onType={onType} onSpeak={() => onType(typed)} />
          <button type="button" className="wb-go" onPointerUp={onSubmit}>Check</button>
        </>
      )}
    </article>
  );
}

function Invest({ tier, marks, onBuy }: { tier: BridgeTier; marks: number; onBuy: (id: string) => void }) {
  const needed = Math.round(neededKg(tier));
  return (
    <article className="wb-copy" data-brief>
      <p className="wb-kicker">Project {String(tier.project).padStart(2, "0")}</p>
      <h1>{tier.title}</h1>
      <p>Gap {tier.gap} {tier.unit}. Bearing {tier.bearing} {tier.unit} per side. Truck {tier.loadKg} kg. Budget {tier.budget} marks. Two main beams, one each side of the deck. Deck and railings supplied. Each beam {beamLength(tier.gap, tier.bearing)} {tier.unit} and must meet capacity.</p>
      <p className="wb-note">The truck's weight is shared equally by the two beams ({tier.loadKg / tier.beams} kg each) with a 25 percent design reserve ({needed} kg needed). This tier uses that simplified model.</p>
      <p>{marks} marks from Learn and Prove. Harder questions do not pay more.</p>
      <div className="wb-shop">
        {tier.materials.map((material) => {
          const cost = material.marks * tier.beams;
          const over = cost > tier.budget;
          return (
            <button key={material.id} type="button" className="wb-card" disabled={over || cost > marks} onPointerUp={() => onBuy(material.id)}>
              <strong>{material.name}</strong>
              <span>{material.capacityKg} kg · {material.marks} marks each</span>
              <em>{over ? "Over budget" : `${cost} marks for ${tier.beams}`}</em>
            </button>
          );
        })}
      </div>
    </article>
  );
}

function TestView({ session, tier, sceneRef, onStart, onSkip, onResults, onExplain, onReplay, onReflect, onInvest }: {
  session: Session;
  tier: BridgeTier;
  sceneRef: RefObject<HTMLCanvasElement | null>;
  onStart: () => void;
  onSkip: () => void;
  onResults: () => void;
  onExplain: (value: string) => void;
  onReplay: () => void;
  onReflect: () => void;
  onInvest: () => void;
}) {
  const materialId = session.materials[0] ?? tier.passId;
  const slow = session.driving && Math.abs(session.drive - 0.5) < 0.08;
  return (
    <article className="wb-split">
      <div className="wb-camera" style={{ transform: session.showResult ? "scale(0.96)" : `translateX(${(0.5 - session.drive) * 28}px)` }}>
        <canvas ref={sceneRef} className="wb-scene" width={900} height={340} data-frames={session.frames} data-progress={session.drive} />
      </div>
      <div>
        {!session.driving && !session.showResult ? <button type="button" className="wb-go" onPointerUp={onStart}>Send the truck</button> : null}
        {session.driving ? <p data-narration>{slow ? "Slow motion" : "Watch the test."}</p> : null}
        {session.driving ? <button type="button" className="wb-text" onPointerUp={onSkip}>Skip</button> : null}
        {session.showResult && session.results ? (
          <div data-plate>
            <p className="wb-plate">{session.results.designWorked ? resultPlate(tier, materialId) : failureLine(tier, materialId)}</p>
            <ul className="wb-results" data-results>
              <li>Design: {session.results.designWorked ? "It worked." : "It did not hold."}</li>
              <li>Math: {session.results.mathUse}</li>
              <li>Explain: {session.results.explained ? "You can transfer it." : "Not yet."}</li>
            </ul>
            <div className="wb-stars">{Array.from({ length: session.stars }, (_, index) => <span key={index} className="star-drop">Craft star</span>)}</div>
            {!session.results.designWorked ? <button type="button" className="wb-go" onPointerUp={onReplay}>Replay</button> : null}
            {!session.results.designWorked ? <button type="button" className="wb-text" onPointerUp={onInvest}>Return the beams and buy again</button> : null}
            <button type="button" className="wb-go" onPointerUp={onReflect}>Reflect</button>
          </div>
        ) : null}
        {!session.driving && session.drive >= 1 && !session.results ? (
          <div>
            <label className="wb-explain">Can you explain it? A 12 m beam centered over a 10 m gap. How much bearing on each side?
              <AnswerRow typed={session.explainAnswer} onType={onExplain} onSpeak={() => onExplain("1")} />
            </label>
            <button type="button" className="wb-go" onPointerUp={onResults}>Show the three results</button>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function CodexView({ page, onProjects }: { page: CodexPage | null; onProjects: () => void }) {
  if (!page) return <p>No page yet.</p>;
  return (
    <article className="wb-codex" data-codex>
      <h1>{page.title}</h1>
      <img src={page.image} alt="The build you tested" />
      <img src={page.handwriting} alt="Your handwritten working" />
      <p>Gap {page.gap}. Bearing {page.bearing}. Load {page.loadKg} kg. Budget {page.budget}. Beam {page.beamLength}.</p>
      <p>Materials: {page.materials.join(", ") || "none"}. Considered: {page.alternatives.join(", ")}.</p>
      <p>What changed: {page.changes.join(" ") || "First version."}</p>
      <ul data-results>
        <li>Design worked: {page.results.designWorked ? "yes" : "no"}</li>
        <li>Math: {page.results.mathUse}</li>
        <li>Explain: {page.results.explained ? "yes" : "no"}</li>
      </ul>
      <h2>What I discovered</h2>
      <p>{page.reflection}</p>
      <h2>What comes next</h2>
      <p>{page.next}</p>
      <button type="button" className="wb-go" onPointerUp={onProjects}>Back to builds</button>
    </article>
  );
}

function drawDot(canvas: HTMLCanvasElement | null, event: PointerEvent<HTMLCanvasElement>) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const rect = canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
  const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
  ctx.fillStyle = "#2A4E7A";
  ctx.beginPath();
  ctx.arc(x, y, 2, 0, Math.PI * 2);
  ctx.fill();
}
