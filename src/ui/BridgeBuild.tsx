import { useEffect, useMemo, useRef, useState } from "react";
import { skills } from "../data/load-skills";
import { answersMatch } from "../engine/answers";
import {
  BRIDGE_INSTRUCTION,
  beamAngleDegrees,
  beamLengthMeters,
  designFromCounts,
  designFromPieceIds,
  designFromSegments,
  gapLabel,
  loadEstimateKg,
  modeForAge,
  partUnlocked,
  scenarioForMode,
  strengthLabel,
  truckLabel,
  unlockSkillName,
  workProblems,
  type BridgeDesign,
  type BridgePart,
  type Scenario,
} from "../engine/bridge/catalog";
import {
  createDesignSimulation,
  type BridgeSimulation,
  type BridgeSnapshot,
  type BridgeStatus,
  type DrawBody,
} from "../engine/bridge/simulate";
import type { LearnerMap } from "../engine/placement";
import { emptyScribble, type Scribble } from "../engine/scribble";
import { AnswerPanel } from "./AnswerPanel";
import { ProblemBoard } from "./ProblemBoard";

type Segment = { col0: number; row0: number; col1: number; row1: number };

type Props = {
  age: number;
  map: LearnerMap;
  completed: string[];
  onAge: (age: number) => void;
  onPractice: (skillId: string) => void;
  onComplete: (scenarioId: string) => void;
};

export function AgePrompt({ onAge }: { onAge: (age: number) => void }) {
  return (
    <section className="screen">
      <header className="screen-head">
        <h1>How old are you?</h1>
        <p>This chooses how you build the bridge.</p>
      </header>
      <div className="age-row">
        {AGES.map((choice) => (
          <button key={choice} type="button" className="choice" onPointerUp={() => onAge(choice)}>
            {choice}
          </button>
        ))}
      </div>
    </section>
  );
}

export function BridgeBuild({ age, map, completed, onAge, onPractice, onComplete }: Props) {
  const mode = modeForAge(age);
  const scenario = scenarioForMode(mode);
  const [agesOpen, setAgesOpen] = useState(false);
  const [pieces, setPieces] = useState<string[]>([]);
  const [beamCount, setBeamCount] = useState(0);
  const [supportCount, setSupportCount] = useState(0);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [arm, setArm] = useState<{ col: number; row: number } | null>(null);
  const [partId, setPartId] = useState(scenario.parts.find((part) => partUnlocked(part, map))?.id ?? scenario.parts[0].id);
  const [question, setQuestion] = useState(0);
  const [scribble, setScribble] = useState<Scribble>(emptyScribble);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<BridgeStatus>("ready");
  const [failure, setFailure] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<BridgeSimulation | null>(null);
  const problems = useMemo(() => workProblems(scenario), [scenario]);
  const design = useMemo(
    () => currentDesign(scenario, pieces, beamCount, supportCount, segments, partId),
    [scenario, pieces, beamCount, supportCount, segments, partId],
  );
  const designKey = JSON.stringify(design);

  useEffect(() => {
    setPieces([]);
    setBeamCount(0);
    setSupportCount(0);
    setSegments([]);
    setArm(null);
    setQuestion(0);
    setScribble(emptyScribble());
    setNote("");
    const first = scenario.parts.find((part) => partUnlocked(part, map));
    setPartId(first?.id ?? scenario.parts[0].id);
  }, [scenario.id]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const sim = createDesignSimulation(design);
    simRef.current = sim;
    setStatus(sim.status());
    setFailure(sim.failure()?.text ?? "");
    const draw = () => paint(canvas, sim.snapshot(), sim.status() !== "ready");
    draw();
    window.addEventListener("resize", draw);
    return () => window.removeEventListener("resize", draw);
  }, [designKey]);

  function placePiece(id: string) {
    const part = scenario.parts.find((item) => item.id === id);
    if (!part || !partUnlocked(part, map)) {
      return;
    }
    const used = pieces.reduce((sum, pieceId) => sum + (scenario.parts.find((item) => item.id === pieceId)?.length ?? 0), 0);
    if (used + part.length > scenario.gap) {
      setNote("That piece does not fit in the gap.");
      return;
    }
    setPieces((current) => [...current, id]);
    setNote("");
  }

  function addSegment(col: number, row: number) {
    const part = scenario.parts.find((item) => item.id === partId);
    if (!part || !partUnlocked(part, map)) {
      return;
    }
    if (!arm) {
      setArm({ col, row });
      return;
    }
    if (arm.col === col && arm.row === row) {
      setArm(null);
      return;
    }
    setSegments((current) => [...current, { col0: arm.col, row0: arm.row, col1: col, row1: row }]);
    setArm(null);
  }

  function runTest() {
    const sim = simRef.current;
    const canvas = canvasRef.current;
    if (!sim || !canvas || sim.status() !== "ready" || design.beams.length === 0) {
      setNote("Build a bridge first.");
      return;
    }
    sim.spawnTruck();
    setStatus("driving");
    setFailure("");
    let last = performance.now();
    const loop = () => {
      const now = performance.now();
      const steps = Math.max(1, Math.min(90, Math.round((now - last) / (1000 / 60))));
      last = now;
      for (let index = 0; index < steps && sim.status() === "driving"; index += 1) {
        sim.step();
      }
      paint(canvas, sim.snapshot(), true);
      if (sim.status() === "driving") {
        window.setTimeout(loop, 16);
        return;
      }
      setStatus(sim.status());
      setFailure(sim.failure()?.text ?? "");
      if (sim.status() === "crossed") {
        onComplete(scenario.id);
      }
    };
    loop();
  }

  const filled = pieces.reduce((sum, id) => sum + (scenario.parts.find((part) => part.id === id)?.length ?? 0), 0);
  const strength = pieces.reduce((sum, id) => sum + (scenario.parts.find((part) => part.id === id)?.strength ?? 0), 0);
  const done = completed.includes(scenario.id);
  const latest = design.beams[design.beams.length - 1];

  return (
    <section className="screen bridge-screen">
      <header className="screen-head bridge-head">
        <div>
          <h1>{scenario.title}</h1>
          <p className="bridge-goal">{BRIDGE_INSTRUCTION}</p>
        </div>
        <button type="button" className="choice" onPointerUp={() => setAgesOpen((open) => !open)}>
          Age {age}
        </button>
      </header>
      {agesOpen ? (
        <div className="age-row">
          {AGES.map((choice) => (
            <button key={choice} type="button" className={choice === age ? "nav-button" : "choice"} onPointerUp={() => onAge(choice)}>
              {choice}
            </button>
          ))}
        </div>
      ) : null}
      <div className="bridge-layout">
        <div className="bridge-scene">
          <canvas ref={canvasRef} className="bridge-canvas" aria-label="Bridge scene" />
          <div className="bridge-labels">
            <span>Gap {gapLabel(scenario)}</span>
            <span>Truck weight {truckLabel(scenario)}</span>
            {scenario.mode === "pick" ? <span>Strength so far {strengthLabel(strength, scenario)}</span> : null}
          </div>
          <p className="bridge-result">
            {status === "crossed" ? "The truck crossed." : status === "collapsed" ? "The bridge fell." : status === "driving" ? "The truck is crossing." : "The truck is waiting on the left cliff."}
            {done && status === "crossed" ? " This bridge is complete." : ""}
          </p>
          {failure ? <p className="bridge-failure">{failure}</p> : null}
        </div>
        <div className="bridge-side">
          {scenario.mode === "pick" ? (
            <PickTray
              scenario={scenario}
              map={map}
              pieces={pieces}
              filled={filled}
              onPlace={placePiece}
              onRemove={(index) => setPieces((current) => current.filter((_, pieceIndex) => pieceIndex !== index))}
              onPractice={onPractice}
            />
          ) : null}
          {scenario.mode === "calculate" ? (
            <CalculatePanel
              scenario={scenario}
              map={map}
              problems={problems}
              question={question}
              scribble={scribble}
              note={note}
              beamCount={beamCount}
              supportCount={supportCount}
              onScribble={setScribble}
              onAnswer={(answer) => {
                const problem = problems[question];
                if (!problem) {
                  return;
                }
                if (!answersMatch(answer, problem.answer)) {
                  setNote("Try again.");
                  return;
                }
                setNote("");
                setScribble(emptyScribble());
                setQuestion((current) => current + 1);
              }}
              onBeams={setBeamCount}
              onSupports={setSupportCount}
              onPractice={onPractice}
            />
          ) : null}
          {scenario.mode === "free" ? (
            <FreePanel
              scenario={scenario}
              map={map}
              segments={segments}
              arm={arm}
              partId={partId}
              latestLength={latest ? beamLengthMeters(latest) : 0}
              latestAngle={latest ? beamAngleDegrees(latest) : 0}
              load={loadEstimateKg(design)}
              onPart={setPartId}
              onDot={addSegment}
              onRemove={(index) => setSegments((current) => current.filter((_, segmentIndex) => segmentIndex !== index))}
              onPractice={onPractice}
            />
          ) : null}
          <button type="button" className="primary" onPointerUp={runTest} disabled={status === "driving"}>
            Send the truck
          </button>
          {note ? <p>{note}</p> : null}
        </div>
      </div>
    </section>
  );
}

const AGES = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];

function currentDesign(
  scenario: Scenario,
  pieces: string[],
  beamCount: number,
  supportCount: number,
  segments: Segment[],
  partId: string,
): BridgeDesign {
  if (scenario.mode === "pick") {
    return designFromPieceIds(scenario, pieces);
  }
  if (scenario.mode === "calculate") {
    return designFromCounts(scenario, beamCount, supportCount);
  }
  const part = scenario.parts.find((item) => item.id === partId) ?? scenario.parts[0];
  return designFromSegments(scenario, part, segments);
}

function PickTray({
  scenario,
  map,
  pieces,
  filled,
  onPlace,
  onRemove,
  onPractice,
}: {
  scenario: Scenario;
  map: LearnerMap;
  pieces: string[];
  filled: number;
  onPlace: (id: string) => void;
  onRemove: (index: number) => void;
  onPractice: (skillId: string) => void;
}) {
  return (
    <div>
      <p>Drag pieces into the gap. The lengths must add to {gapLabel(scenario)}. Add the strengths until they reach {truckLabel(scenario)}.</p>
      <div className="bridge-gap" aria-label="Gap">
        {pieces.map((id, index) => {
          const part = scenario.parts.find((item) => item.id === id);
          if (!part) {
            return null;
          }
          return (
            <button key={`${id}-${index}`} type="button" className="placed-piece" style={{ flexGrow: part.length }} onPointerUp={() => onRemove(index)}>
              {part.name}
              <span>Strength {strengthLabel(part.strength, scenario)}</span>
            </button>
          );
        })}
        {filled < scenario.gap ? <span className="gap-open">{scenario.gap - filled} open</span> : null}
      </div>
      <div className="part-tray">
        {scenario.parts.map((part) => (
          <PartButton key={part.id} part={part} scenario={scenario} map={map} onPlace={onPlace} onPractice={onPractice} />
        ))}
      </div>
    </div>
  );
}

function PartButton({
  part,
  scenario,
  map,
  onPlace,
  onPractice,
}: {
  part: BridgePart;
  scenario: Scenario;
  map: LearnerMap;
  onPlace: (id: string) => void;
  onPractice: (skillId: string) => void;
}) {
  const open = partUnlocked(part, map);
  const drag = useRef<string | null>(null);
  if (!open) {
    return (
      <div className="part locked">
        <span>{part.name}</span>
        <span>
          Unlocks with {unlockSkillName(part, skills)}, level {part.unlock.level}
        </span>
        <button type="button" className="choice" onPointerUp={() => onPractice(part.unlock.skillId)}>
          Practice
        </button>
      </div>
    );
  }
  return (
    <button
      type="button"
      className="part"
      onPointerDown={(event) => {
        drag.current = part.id;
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerUp={(event) => {
        const hit = document.elementFromPoint(event.clientX, event.clientY);
        if (drag.current && hit?.closest(".bridge-gap, .bridge-canvas, .bridge-scene")) {
          onPlace(part.id);
        } else {
          onPlace(part.id);
        }
        drag.current = null;
      }}
    >
      {part.name}
      <span>
        {part.length > 0 ? `${part.length} long. ` : ""}
        Strength {strengthLabel(part.strength, scenario)}
      </span>
    </button>
  );
}

function CalculatePanel({
  scenario,
  map,
  problems,
  question,
  scribble,
  note,
  beamCount,
  supportCount,
  onScribble,
  onAnswer,
  onBeams,
  onSupports,
  onPractice,
}: {
  scenario: Scenario;
  map: LearnerMap;
  problems: ReturnType<typeof workProblems>;
  question: number;
  scribble: Scribble;
  note: string;
  beamCount: number;
  supportCount: number;
  onScribble: (next: Scribble) => void;
  onAnswer: (answer: string) => void;
  onBeams: (count: number) => void;
  onSupports: (count: number) => void;
  onPractice: (skillId: string) => void;
}) {
  const ready = question >= problems.length;
  const problem = problems[question];
  return (
    <div>
      {problem && !ready ? (
        <div className="work bridge-work">
          <ProblemBoard problem={problem} scribble={scribble} onScribble={onScribble} />
          <AnswerPanel key={question} problem={problem} locked={false} onSubmit={onAnswer} onSkip={() => onAnswer("")} />
        </div>
      ) : (
        <p>Use the numbers you found. Pick the beams and supports.</p>
      )}
      {note ? <p>{note}</p> : null}
      <div className="count-row">
        <Counter label="Beams" value={beamCount} disabled={!ready} onChange={onBeams} />
        <Counter label="Supports" value={supportCount} disabled={!ready} onChange={onSupports} />
      </div>
      {scenario.parts.filter((part) => !partUnlocked(part, map)).map((part) => (
        <div key={part.id} className="part locked">
          <span>{part.name}</span>
          <span>
            Unlocks with {unlockSkillName(part, skills)}, level {part.unlock.level}
          </span>
          <button type="button" className="choice" onPointerUp={() => onPractice(part.unlock.skillId)}>
            Practice
          </button>
        </div>
      ))}
    </div>
  );
}

function Counter({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div className="counter">
      <span>{label}</span>
      <button type="button" disabled={disabled || value <= 0} onPointerUp={() => onChange(value - 1)}>
        Less
      </button>
      <strong>{value}</strong>
      <button type="button" disabled={disabled || value >= 8} onPointerUp={() => onChange(value + 1)}>
        More
      </button>
    </div>
  );
}

function FreePanel({
  scenario,
  map,
  segments,
  arm,
  partId,
  latestLength,
  latestAngle,
  load,
  onPart,
  onDot,
  onRemove,
  onPractice,
}: {
  scenario: Scenario;
  map: LearnerMap;
  segments: Segment[];
  arm: { col: number; row: number } | null;
  partId: string;
  latestLength: number;
  latestAngle: number;
  load: number;
  onPart: (id: string) => void;
  onDot: (col: number, row: number) => void;
  onRemove: (index: number) => void;
  onPractice: (skillId: string) => void;
}) {
  const cols = Math.round(scenario.gap / scenario.cell) + 1;
  return (
    <div>
      <p>Tap two dots to place a beam. Triangles hold. A square can fold.</p>
      <div className="truss-grid" style={{ gridTemplateColumns: `repeat(${cols}, 48px)` }}>
        {Array.from({ length: 2 }, (_, row) =>
          Array.from({ length: cols }, (_, col) => {
            const selected = arm?.col === col && arm?.row === row;
            return (
              <button
                key={`${col}-${row}`}
                type="button"
                className={selected ? "nav-button grid-dot" : "choice grid-dot"}
                aria-label={row === 0 ? `Top dot ${col + 1}` : `Deck dot ${col + 1}`}
                onPointerUp={() => onDot(col, 1 - row)}
              >
                •
              </button>
            );
          }),
        )}
      </div>
      <div className="calc-panel">
        <p>Length {latestLength.toFixed(1)} m</p>
        <p>Angle {latestAngle} degrees</p>
        <p>Load estimate {load} kg</p>
      </div>
      <div className="part-tray">
        {scenario.parts.map((part) =>
          partUnlocked(part, map) ? (
            <button key={part.id} type="button" className={part.id === partId ? "nav-button" : "choice"} onPointerUp={() => onPart(part.id)}>
              {part.name}. Strength {strengthLabel(part.strength, scenario)}
            </button>
          ) : (
            <div key={part.id} className="part locked">
              <span>{part.name}</span>
              <span>
                Unlocks with {unlockSkillName(part, skills)}, level {part.unlock.level}
              </span>
              <button type="button" className="choice" onPointerUp={() => onPractice(part.unlock.skillId)}>
                Practice
              </button>
            </div>
          ),
        )}
      </div>
      {segments.map((segment, index) => (
        <button key={`${segment.col0}-${segment.row0}-${segment.col1}-${segment.row1}-${index}`} type="button" className="choice" onPointerUp={() => onRemove(index)}>
          Remove beam {index + 1}
        </button>
      ))}
    </div>
  );
}

function paint(canvas: HTMLCanvasElement, shot: BridgeSnapshot, colorize: boolean) {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }
  const width = canvas.clientWidth || 640;
  const height = canvas.clientHeight || 420;
  const pixelRatio = window.devicePixelRatio || 1;
  if (canvas.width !== Math.floor(width * pixelRatio) || canvas.height !== Math.floor(height * pixelRatio)) {
    canvas.width = Math.floor(width * pixelRatio);
    canvas.height = Math.floor(height * pixelRatio);
  }
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#bae6fd";
  ctx.fillRect(0, 0, width, height);
  const spanX = shot.maxX - shot.minX;
  const spanY = shot.maxY - shot.minY;
  const scale = Math.min(width / spanX, height / spanY);
  const originX = (width - spanX * scale) / 2;
  const originY = (height - spanY * scale) / 2;
  const toX = (x: number) => originX + (x - shot.minX) * scale;
  const toY = (y: number) => originY + (shot.maxY - y) * scale;
  const waterTop = toY(2.2);
  ctx.fillStyle = "#0284c7";
  ctx.fillRect(0, waterTop, width, height - waterTop);
  const cliffs = shot.bodies.filter((body) => body.role === "cliff");
  for (const body of shot.bodies) {
    drawBody(ctx, body, toX, toY, scale, colorize);
  }
  const left = cliffs.reduce((best, body) => (body.x < best.x ? body : best), cliffs[0]);
  const right = cliffs.reduce((best, body) => (body.x > best.x ? body : best), cliffs[0]);
  if (left && !shot.bodies.some((body) => body.role === "truck")) {
    drawTruck(ctx, toX(left.x), toY(left.y + left.halfHeight + 0.45), scale);
  }
  if (right) {
    drawFlag(ctx, toX(right.x), toY(right.y + right.halfHeight));
  }
}

function drawTruck(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  ctx.fillStyle = "#1d4ed8";
  ctx.fillRect(x - 0.7 * scale, y - 0.24 * scale, 1.4 * scale, 0.48 * scale);
  ctx.fillStyle = "#1c1917";
  ctx.beginPath();
  ctx.arc(x - 0.4 * scale, y + 0.24 * scale, 0.22 * scale, 0, Math.PI * 2);
  ctx.arc(x + 0.4 * scale, y + 0.24 * scale, 0.22 * scale, 0, Math.PI * 2);
  ctx.fill();
}

function drawFlag(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.strokeStyle = "#1c1917";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - 46);
  ctx.stroke();
  ctx.fillStyle = "#dc2626";
  ctx.beginPath();
  ctx.moveTo(x, y - 46);
  ctx.lineTo(x + 28, y - 36);
  ctx.lineTo(x, y - 26);
  ctx.fill();
}

function drawBody(
  ctx: CanvasRenderingContext2D,
  body: DrawBody,
  toX: (x: number) => number,
  toY: (y: number) => number,
  scale: number,
  colorize: boolean,
) {
  ctx.save();
  ctx.translate(toX(body.x), toY(body.y));
  ctx.rotate(-body.angle);
  if (body.role === "plank") {
    ctx.fillStyle = colorize ? stressColor(body.stress, body.broken) : "#d97706";
  } else if (body.role === "truck") {
    ctx.fillStyle = "#1d4ed8";
  } else if (body.role === "wheel") {
    ctx.fillStyle = "#1c1917";
  } else if (body.role === "support") {
    ctx.fillStyle = "#57534e";
  } else if (body.role === "joint") {
    ctx.fillStyle = "#44403c";
  } else {
    ctx.fillStyle = "#78716c";
  }
  if (body.role === "wheel" || body.role === "joint") {
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(body.radius, body.role === "joint" ? 0.08 : 0) * scale, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const w = body.halfWidth * 2 * scale;
    const h = body.halfHeight * 2 * scale;
    ctx.fillRect(-w / 2, -h / 2, w, h);
  }
  ctx.restore();
}

function stressColor(stress: number, broken: boolean): string {
  if (broken || stress >= 0.9) {
    return "#dc2626";
  }
  if (stress >= 0.6) {
    return "#ca8a04";
  }
  return "#16a34a";
}
