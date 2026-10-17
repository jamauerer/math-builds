import { useEffect, useRef, useState } from "react";
import { referenceDesigns, scenarioForMode } from "../engine/bridge/catalog";
import {
  createDesignSimulation,
  type BridgeSimulation,
  type BridgeSnapshot,
  type BridgeStatus,
  type DrawBody,
} from "../engine/bridge/simulate";

type BridgePreset = "holds" | "collapses";

const PRESET_LABEL: Record<BridgePreset, string> = {
  holds: "Holds",
  collapses: "Collapses",
};

const RESULT: Record<BridgeStatus, string> = {
  ready: "Ready.",
  driving: "The truck is crossing.",
  crossed: "The truck crossed.",
  collapsed: "The bridge collapsed.",
};

export function BridgeTest() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<BridgeSimulation | null>(null);
  const [preset, setPreset] = useState<BridgePreset>("holds");
  const [status, setStatus] = useState<BridgeStatus>("ready");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const designs = referenceDesigns(scenarioForMode("pick"));
    const sim = createDesignSimulation(preset === "holds" ? designs.correct : designs.weak);
    simRef.current = sim;
    setStatus("ready");
    paint(canvas, sim.snapshot());
  }, [preset]);

  function runTest() {
    const sim = simRef.current;
    const canvas = canvasRef.current;
    if (!sim || !canvas || sim.status() !== "ready") {
      return;
    }
    sim.spawnTruck();
    setStatus("driving");
    let last = performance.now();
    const loop = () => {
      const now = performance.now();
      const steps = Math.max(1, Math.min(120, Math.round((now - last) / (1000 / 60))));
      last = now;
      for (let index = 0; index < steps && sim.status() === "driving"; index += 1) {
        sim.step();
      }
      paint(canvas, sim.snapshot());
      if (sim.status() === "driving") {
        window.setTimeout(loop, 16);
      } else {
        setStatus(sim.status());
      }
    };
    loop();
  }

  return (
    <section className="screen">
      <header className="screen-head">
        <h1>Bridge test</h1>
        <p>Pick a bridge, then send the truck across.</p>
      </header>
      <div className="bridge-controls">
        {(Object.keys(PRESET_LABEL) as BridgePreset[]).map((name) => (
          <button
            key={name}
            type="button"
            className={name === preset ? "nav-button" : "choice"}
            onPointerUp={() => setPreset(name)}
          >
            {PRESET_LABEL[name]}
          </button>
        ))}
        <button
          type="button"
          className="primary"
          onPointerUp={runTest}
        >
          Test
        </button>
      </div>
      <canvas ref={canvasRef} className="bridge-canvas" />
      <p className="bridge-result">{RESULT[status]}</p>
    </section>
  );
}

function paint(canvas: HTMLCanvasElement, shot: BridgeSnapshot) {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const pixelRatio = window.devicePixelRatio || 1;
  if (canvas.width !== Math.floor(width * pixelRatio) || canvas.height !== Math.floor(height * pixelRatio)) {
    canvas.width = Math.floor(width * pixelRatio);
    canvas.height = Math.floor(height * pixelRatio);
  }
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#dbeafe";
  ctx.fillRect(0, 0, width, height);

  const spanX = shot.maxX - shot.minX;
  const spanY = shot.maxY - shot.minY;
  const scale = Math.min(width / spanX, height / spanY);
  const originX = (width - spanX * scale) / 2;
  const originY = (height - spanY * scale) / 2;
  const toX = (x: number) => originX + (x - shot.minX) * scale;
  const toY = (y: number) => originY + (shot.maxY - y) * scale;

  ctx.fillStyle = "#44403c";
  ctx.fillRect(toX(shot.minX), toY(5), width, height);

  for (const body of shot.bodies) {
    drawBody(ctx, body, toX, toY, scale);
  }
}

function drawBody(
  ctx: CanvasRenderingContext2D,
  body: DrawBody,
  toX: (x: number) => number,
  toY: (y: number) => number,
  scale: number,
) {
  ctx.save();
  ctx.translate(toX(body.x), toY(body.y));
  ctx.rotate(-body.angle);
  ctx.fillStyle = body.role === "truck" ? "#1d4ed8" : body.role === "wheel" ? "#1c1917" : body.role === "plank" ? "#d97706" : "#78716c";
  if (body.role === "wheel") {
    ctx.beginPath();
    ctx.arc(0, 0, body.radius * scale, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const w = body.halfWidth * 2 * scale;
    const h = body.halfHeight * 2 * scale;
    ctx.fillRect(-w / 2, -h / 2, w, h);
  }
  ctx.restore();
}
