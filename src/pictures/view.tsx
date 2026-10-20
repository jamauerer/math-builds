import type { Picture, PictureFigure } from "./parts";

const STAGE_W = 520;
const STAGE_H = 180;

export function pictureBoxSize(picture: Picture): { width: number; height: number } {
  if (picture.figure || picture.tape) {
    return { width: STAGE_W, height: STAGE_H };
  }
  const bits = picture.bits;
  if (bits.length === 0) {
    return { width: 0, height: 0 };
  }
  const right = Math.max(...bits.map((bit) => bit.x + bit.w), picture.measure ? picture.measure.x + picture.measure.w : 0);
  const bottom = Math.max(...bits.map((bit) => bit.y + bit.h));
  return { width: Math.max(1, right), height: Math.max(1, bottom) };
}

export function FigureSvg({ figure }: { figure: PictureFigure }) {
  if (figure.kind === "angle") {
    return <AngleSvg figure={figure} />;
  }
  if (figure.kind === "shape") {
    return <ShapeSvg name={figure.name} />;
  }
  if (figure.kind === "frac-tape") {
    return <FracTapeSvg figure={figure} />;
  }
  return <LineSvg figure={figure} />;
}

function AngleSvg({ figure }: { figure: { deg: number; ox: number; oy: number; arm: number } }) {
  const rad = (figure.deg * Math.PI) / 180;
  const x1 = figure.ox + figure.arm;
  const y1 = figure.oy;
  const x2 = figure.ox + Math.cos(rad) * figure.arm;
  const y2 = figure.oy - Math.sin(rad) * figure.arm;
  const r = 28;
  const large = figure.deg > 180 ? 1 : 0;
  const ax = figure.ox + r;
  const ay = figure.oy;
  const bx = figure.ox + Math.cos(rad) * r;
  const by = figure.oy - Math.sin(rad) * r;
  const right = Math.abs(figure.deg - 90) < 1;
  return (
    <svg className="gk-figure" data-figure="angle" data-deg={figure.deg} viewBox={`0 0 ${STAGE_W} ${STAGE_H}`} width={STAGE_W} height={STAGE_H} aria-hidden="true">
        <line x1={figure.ox} y1={figure.oy} x2={x1} y2={y1} stroke="#22201c" strokeWidth="7" strokeLinecap="round" />
      <line x1={figure.ox} y1={figure.oy} x2={x2} y2={y2} stroke="#22201c" strokeWidth="7" strokeLinecap="round" />
      <circle cx={figure.ox} cy={figure.oy} r="4" fill="#22201c" />
      {right ? (
        <rect x={figure.ox + 2} y={figure.oy - 22} width="20" height="20" fill="none" stroke="#22201c" strokeWidth="3" />
      ) : (
        <path d={`M ${ax} ${ay} A ${r} ${r} 0 ${large} 0 ${bx} ${by}`} fill="none" stroke="#8B5A2B" strokeWidth="4" />
      )}
    </svg>
  );
}

function ShapeSvg({ name }: { name: "triangle" | "square" | "circle" }) {
  return (
    <svg className="gk-figure" data-figure="shape" data-shape={name} viewBox={`0 0 ${STAGE_W} ${STAGE_H}`} width={STAGE_W} height={STAGE_H} aria-hidden="true">
      {name === "circle" ? (
        <circle cx="260" cy="90" r="58" fill="#f6d34d" stroke="#22201c" strokeWidth="4" />
      ) : name === "square" ? (
        <rect x="190" y="28" width="140" height="124" fill="#f6d34d" stroke="#22201c" strokeWidth="4" />
      ) : (
        <polygon points="260,24 360,152 160,152" fill="#f6d34d" stroke="#22201c" strokeWidth="4" />
      )}
    </svg>
  );
}

function FracTapeSvg({ figure }: { figure: { parts: number; marks: { at: number; letter?: string }[] } }) {
  const x = 40;
  const y = 88;
  const w = 440;
  const h = 28;
  const parts = Math.max(2, figure.parts);
  return (
    <svg className="gk-figure" data-figure="frac-tape" viewBox={`0 0 ${STAGE_W} ${STAGE_H}`} width={STAGE_W} height={STAGE_H} aria-hidden="true">
      <rect x={x} y={y} width={w} height={h} fill="#f6d34d" stroke="#22201c" strokeWidth="3" rx="3" />
      {Array.from({ length: parts + 1 }, (_, index) => {
        const px = x + (index / parts) * w;
        return <line key={index} x1={px} y1={y} x2={px} y2={y + h} stroke="#22201c" strokeWidth="2" />;
      })}
      {figure.marks.map((mark, index) => {
        const px = x + mark.at * w;
        return (
          <g key={`${mark.at}-${index}`}>
            <line x1={px} y1={y - 10} x2={px} y2={y + h + 10} stroke="#8B5A2B" strokeWidth="3" />
            {mark.letter ? (
              <text x={px} y={y - 16} textAnchor="middle" fontSize="18" fontWeight="700" fill="#22201c">
                {mark.letter}
              </text>
            ) : (
              <circle cx={px} cy={y - 12} r="6" fill="#8B5A2B" />
            )}
          </g>
        );
      })}
    </svg>
  );
}

function LineSvg({ figure }: { figure: { rise: number; run: number } }) {
  const x0 = 80;
  const y0 = 150;
  const run = Math.max(1, figure.run);
  const rise = figure.rise;
  const step = 48;
  return (
    <svg className="gk-figure" data-figure="line" viewBox={`0 0 ${STAGE_W} ${STAGE_H}`} width={STAGE_W} height={STAGE_H} aria-hidden="true">
      <line x1="60" y1="160" x2="480" y2="160" stroke="#22201c" strokeWidth="2" />
      <line x1="70" y1="20" x2="70" y2="168" stroke="#22201c" strokeWidth="2" />
      <line x1={x0} y1={y0} x2={x0 + run * step} y2={y0 - rise * step} stroke="#8B5A2B" strokeWidth="5" strokeLinecap="round" />
      <circle cx={x0} cy={y0} r="5" fill="#22201c" />
      <circle cx={x0 + run * step} cy={y0 - rise * step} r="5" fill="#22201c" />
    </svg>
  );
}
