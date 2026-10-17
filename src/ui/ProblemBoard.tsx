import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import {
  beginStroke,
  canvasPixelSize,
  clearScribble,
  extendStroke,
  undoStroke,
  type Scribble,
  type ScribblePoint,
  type ScribbleStroke,
} from "../engine/scribble";
import type { Problem } from "../engine/types";
import { ProblemView } from "./ProblemView";

export const PEN_COLORS = [
  { id: "dark", label: "Dark", value: "#1c1917" },
  { id: "blue", label: "Blue", value: "#1d4ed8" },
  { id: "red", label: "Red", value: "#dc2626" },
] as const;

type Props = {
  problem: Problem;
  scribble: Scribble;
  onScribble: (next: Scribble) => void;
};

export type ProblemBoardHandle = {
  image: () => string;
};

export const ProblemBoard = forwardRef<ProblemBoardHandle, Props>(function ProblemBoard(
  { problem, scribble, onScribble },
  ref,
) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const live = useRef(scribble);
  const drawing = useRef(false);
  const stylus = useRef(false);
  const activePointer = useRef<number | null>(null);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [color, setColor] = useState<(typeof PEN_COLORS)[number]["value"]>(PEN_COLORS[0].value);
  const toolRef = useRef(tool);
  const colorRef = useRef(color);
  toolRef.current = tool;
  colorRef.current = color;

  useImperativeHandle(ref, () => ({
    image: () => (canvasRef.current ? scribbleImage(canvasRef.current) : ""),
  }));

  useEffect(() => {
    stylus.current = false;
  }, [problem]);

  function redraw(current: Scribble) {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const stroke of current.strokes) {
      for (let index = 1; index < stroke.points.length; index += 1) {
        paintSegment(ctx, stroke.points[index - 1], stroke.points[index], stroke, dpr);
      }
    }
  }

  function fit() {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas) {
      return;
    }
    const box = stage.getBoundingClientRect();
    const width = Math.max(1, box.width);
    const height = Math.max(1, box.height);
    const dpr = window.devicePixelRatio || 1;
    const pixels = canvasPixelSize(width, height, dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    if (canvas.width === pixels.width && canvas.height === pixels.height) {
      return;
    }
    canvas.width = pixels.width;
    canvas.height = pixels.height;
    redraw(live.current);
  }

  useEffect(() => {
    live.current = scribble;
    if (!drawing.current) {
      redraw(scribble);
    }
  }, [scribble]);

  useEffect(() => {
    fit();
    const stage = stageRef.current;
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => fit());
    if (stage && observer) {
      observer.observe(stage);
    }
    window.addEventListener("resize", fit);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, []);

  function pointFrom(event: React.PointerEvent<HTMLCanvasElement>): ScribblePoint {
    const canvas = canvasRef.current;
    const box = canvas?.getBoundingClientRect();
    return {
      x: event.clientX - (box?.left ?? 0),
      y: event.clientY - (box?.top ?? 0),
    };
  }

  function ignorePointer(event: React.PointerEvent<HTMLCanvasElement>): boolean {
    if (event.pointerType === "pen") {
      stylus.current = true;
    }
    return stylus.current && event.pointerType !== "pen";
  }

  return (
    <div className="problem-row">
      <div className="draw-tools" role="toolbar" aria-label="Drawing tools">
        <button
          type="button"
          className={tool === "pen" ? "tool-active" : ""}
          onPointerUp={() => setTool("pen")}
        >
          Pen
        </button>
        <button
          type="button"
          className={tool === "eraser" ? "tool-active" : ""}
          onPointerUp={() => setTool("eraser")}
        >
          Eraser
        </button>
        <button type="button" onPointerUp={() => onScribble(undoStroke(live.current))}>
          Undo
        </button>
        <button type="button" onPointerUp={() => onScribble(clearScribble())}>
          Clear
        </button>
        {PEN_COLORS.map((swatch) => (
          <button
            key={swatch.id}
            type="button"
            className={color === swatch.value && tool === "pen" ? "tool-active color-swatch" : "color-swatch"}
            aria-label={swatch.label}
            style={{ background: swatch.value }}
            onPointerUp={() => {
              setTool("pen");
              setColor(swatch.value);
            }}
          />
        ))}
      </div>
      <div className="problem-stage" ref={stageRef}>
        <div className="problem-face">
          <ProblemView problem={problem} />
        </div>
        <canvas
          ref={canvasRef}
          className="scribble-layer"
          aria-label="Drawing space"
          onPointerDown={(event) => {
            if (ignorePointer(event)) {
              return;
            }
            event.preventDefault();
            const canvas = canvasRef.current;
            try {
              canvas?.setPointerCapture(event.pointerId);
            } catch {
              // A pointer that is already gone cannot be captured.
            }
            activePointer.current = event.pointerId;
            drawing.current = true;
            const point = pointFrom(event);
            const eraser = toolRef.current === "eraser";
            live.current = beginStroke(live.current, {
              color: colorRef.current,
              size: eraser ? 24 : 5,
              eraser,
              point,
            });
            const ctx = canvas?.getContext("2d");
            const started = live.current.strokes[live.current.strokes.length - 1];
            if (ctx && started) {
              paintSegment(ctx, point, point, started, window.devicePixelRatio || 1);
            }
          }}
          onPointerMove={(event) => {
            if (!drawing.current || event.pointerId !== activePointer.current || ignorePointer(event)) {
              return;
            }
            event.preventDefault();
            const point = pointFrom(event);
            const strokes = live.current.strokes;
            const stroke = strokes[strokes.length - 1];
            const previous = stroke?.points[stroke.points.length - 1];
            live.current = extendStroke(live.current, point);
            const canvas = canvasRef.current;
            const ctx = canvas?.getContext("2d");
            if (ctx && previous && stroke) {
              paintSegment(ctx, previous, point, { ...stroke, points: [] }, window.devicePixelRatio || 1);
            }
          }}
          onPointerUp={(event) => {
            if (event.pointerId !== activePointer.current) {
              return;
            }
            drawing.current = false;
            activePointer.current = null;
            onScribble(live.current);
          }}
          onPointerCancel={(event) => {
            if (event.pointerId !== activePointer.current) {
              return;
            }
            drawing.current = false;
            activePointer.current = null;
            onScribble(live.current);
          }}
        />
      </div>
    </div>
  );
});

function paintSegment(
  ctx: CanvasRenderingContext2D,
  from: ScribblePoint,
  to: ScribblePoint,
  stroke: ScribbleStroke,
  dpr: number,
) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = stroke.size * dpr;
  ctx.globalCompositeOperation = stroke.eraser ? "destination-out" : "source-over";
  ctx.strokeStyle = stroke.color;
  ctx.beginPath();
  if (from.x === to.x && from.y === to.y) {
    ctx.arc(to.x * dpr, to.y * dpr, Math.max(1, (stroke.size * dpr) / 2), 0, Math.PI * 2);
    ctx.fillStyle = stroke.color;
    ctx.fill();
  } else {
    ctx.moveTo(from.x * dpr, from.y * dpr);
    const controlX = ((from.x + to.x) / 2) * dpr;
    const controlY = ((from.y + to.y) / 2) * dpr;
    ctx.quadraticCurveTo(controlX, controlY, to.x * dpr, to.y * dpr);
    ctx.stroke();
  }
  ctx.restore();
}

export function scribbleImage(canvas: HTMLCanvasElement): string {
  const maxWidth = 280;
  const scale = Math.min(1, maxWidth / Math.max(1, canvas.width));
  const copy = document.createElement("canvas");
  copy.width = Math.max(1, Math.round(canvas.width * scale));
  copy.height = Math.max(1, Math.round(canvas.height * scale));
  const ctx = copy.getContext("2d");
  if (!ctx) {
    return "";
  }
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, copy.width, copy.height);
  ctx.drawImage(canvas, 0, 0, copy.width, copy.height);
  return copy.toDataURL("image/jpeg", 0.65);
}
