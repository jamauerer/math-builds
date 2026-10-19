import type { CSSProperties } from "react";
import { formatLength, lengthAbbrev } from "../../../units";
import {
  abutmentTopPx,
  BEAM_THICK_PX,
  kitNode,
  nodePixel,
  PLANK_THICK_PX,
  plankSlots,
  plankStart,
  queenPost,
  slotNodes,
  slotRunLabel,
  waterPixel,
  waterWorld,
  type KitSlot,
} from "../kits/kit";
import type { CrossingFrame, GoatMode, PiecePose } from "../kits/simulate";

const ART = "/art";

export function art(file: string): string {
  return `${ART}/${file}`;
}

export function memberStyle(slot: KitSlot, typed: number): CSSProperties {
  if (slot.kind === "gusset" && slot.at) {
    const node = kitNode(slot.at);
    const point = nodePixel(node);
    return {
      position: "absolute",
      left: point.x - 15,
      top: node.h === 0 ? point.y - 3 : point.y - 13,
      width: 30,
      height: 27,
    };
  }
  if (slot.kind === "plank") {
    const width = Math.max(8, typed * queenPost.pxPerMetre);
    return {
      position: "absolute",
      left: queenPost.scene.originX + plankStart(slot) * queenPost.pxPerMetre,
      top: queenPost.scene.deckY,
      width,
      height: PLANK_THICK_PX,
    };
  }
  if (slot.kind === "bolt") {
    return { position: "absolute", left: 542, top: 330, width: 30, height: 17 };
  }
  if (slot.kind === "post" && slot.from) {
    const point = nodePixel(kitNode(slot.from));
    const height = Math.max(8, typed * queenPost.pxPerMetre);
    return { position: "absolute", left: point.x - 16, top: point.y - height, width: 32, height };
  }
  if (!slot.from || !slot.to) {
    return { position: "absolute" };
  }
  const fromNode = kitNode(slot.from);
  const toNode = kitNode(slot.to);
  const from = nodePixel(fromNode);
  const to = nodePixel(toNode);
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const height = slot.kind === "brace" ? 15 : slot.kind === "rail" ? 28 : 22;
  const width = Math.max(8, typed * queenPost.pxPerMetre);
  const alongDeck = slot.kind === "beam" && fromNode.h === 0 && Math.abs(angle) < 0.2;
  const top = alongDeck
    ? queenPost.scene.deckY + PLANK_THICK_PX
    : from.y - (slot.kind === "brace" ? 11 : height / 2);
  return {
    position: "absolute",
    left: from.x,
    top,
    width,
    height: alongDeck ? BEAM_THICK_PX : height,
    transform: `rotate(${angle}rad)`,
    transformOrigin: alongDeck ? "0 0%" : "0 50%",
  };
}

function braceGiven(slot: KitSlot, geometryLevel: number): boolean {
  return slot.kind === "brace" && geometryLevel < 9;
}

function slotLabelText(slot: KitSlot, placed: boolean, typed: number | undefined, geometryLevel: number): { text: string; given: boolean } {
  if (braceGiven(slot, geometryLevel)) {
    return { text: "2.83", given: true };
  }
  if (placed && typed != null && Number.isFinite(typed)) {
    return { text: formatLength(typed), given: false };
  }
  return { text: `? ${lengthAbbrev()}`, given: false };
}

function Blueprint({ missing, hot }: { missing: KitSlot[]; hot?: string | null }) {
  return (
    <svg viewBox="0 0 1000 620" width="1000" height="620" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {missing.map((slot) => {
        if (!slot.from || !slot.to || slot.bonus) {
          return null;
        }
        const from = nodePixel(kitNode(slot.from));
        const to = nodePixel(kitNode(slot.to));
        const on = slot.id === hot;
        return (
          <line
            key={slot.id}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            stroke={on ? "#E0661A" : "#2E7FB0"}
            strokeWidth={on ? 7 : 3}
            strokeDasharray="9 7"
          />
        );
      })}
      {hot === "planks" || hot?.startsWith("plank")
        ? queenPost.slots
            .filter((slot) => slot.kind === "plank" && (hot === "planks" || slot.id === hot))
            .map((slot) => {
              const x = queenPost.scene.originX + plankStart(slot) * queenPost.pxPerMetre;
              return <rect key={slot.id} x={x} y={queenPost.scene.deckY} width={queenPost.pxPerMetre} height={PLANK_THICK_PX} fill="none" stroke="#E0661A" strokeWidth="4" strokeDasharray="6 4" />;
            })
        : null}
    </svg>
  );
}

function SlotLabels({
  placed,
  lengths,
  geometryLevel,
}: {
  placed: Record<string, boolean>;
  lengths: Record<string, number>;
  geometryLevel: number;
}) {
  return (
    <>
      {queenPost.slots.map((slot) => {
        const nodes = slotNodes(slot);
        if (!nodes || slot.bonus || slot.kind === "gusset" || slot.kind === "bolt") {
          return null;
        }
        const from = nodePixel(nodes.from);
        const to = nodePixel(nodes.to);
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const span = Math.hypot(dx, dy) || 1;
        const midX = (from.x + to.x) / 2 + (-dy / span) * 26;
        const midY = (from.y + to.y) / 2 + (dx / span) * 26;
        const placedNow = Boolean(placed[slot.id]);
        const label = placedNow
          ? slotLabelText(slot, true, lengths[slot.id], geometryLevel)
          : { text: slotRunLabel(slot), given: false };
        return (
          <span key={slot.id} className={label.given ? "gk-given" : "gk-slot-label"} data-slot-label={slot.id} style={{ left: midX - 40, top: midY - 14 }}>
            {label.text}
          </span>
        );
      })}
    </>
  );
}

export function BridgeScene({
  placed,
  lengths,
  goat,
  drops,
  geometryLevel = 4,
  hot = null,
  focus = null,
  corners = false,
  flyGusset = null,
  preview = false,
  holes = false,
  onFocus,
}: {
  placed: Record<string, boolean>;
  lengths: Record<string, number>;
  goat: { src: string; left: number; top: number; width: number; height: number };
  drops?: boolean;
  geometryLevel?: number;
  hot?: string | null;
  focus?: string | null;
  corners?: boolean;
  flyGusset?: { id: string; at: string } | null;
  preview?: boolean;
  holes?: boolean;
  onFocus?: (id: string) => void;
}) {
  const structural = queenPost.slots.filter((slot) => slot.structural || slot.kind === "gusset" || slot.kind === "rail");
  const missing = structural.filter((slot) => !placed[slot.id] && slot.kind !== "gusset" && slot.kind !== "rail");
  const lit = focus ?? hot;
  return (
    <div className="gk-scene-scale">
    <div className="gk-scene" data-scene="bridge">
      <img className="banks" src={art("banks.png")} alt="" />
      <Abutments />
      <img src={art("signpost.png")} alt="" style={{ position: "absolute", left: 40, top: 263, width: 90, height: 92 }} />
      <img src={art("flag.png")} alt="" style={{ position: "absolute", left: 760, top: 245, width: 112, height: 110 }} />
      <img src={art("grass.png")} alt="" style={{ position: "absolute", left: 880, top: 315, width: 70, height: 40 }} />
      <Blueprint missing={missing} hot={lit} />
      {holes ? <PlankHoles placed={placed} /> : null}
      <SlotLabels placed={placed} lengths={lengths} geometryLevel={geometryLevel} />
      {corners ? <CornerPulses placed={placed} /> : null}
      {flyGusset?.at ? (
        <img
          className="gk-fly-gusset"
          data-fly-gusset={flyGusset.id}
          alt=""
          src={art("gusset-small.png")}
          style={{
            left: nodePixel(kitNode(flyGusset.at)).x - 15,
            top: nodePixel(kitNode(flyGusset.at)).y - 13,
          }}
        />
      ) : null}
      {drops
        ? queenPost.slots
            .filter((slot) => slot.structural && !placed[slot.id])
            .map((slot) => {
              const style = memberStyle(slot, slot.length ?? 1);
              return (
                <div
                  key={slot.id}
                  className="gk-hit"
                  data-drop={slot.id}
                  data-slot={slot.id}
                  style={{ ...style, height: 36, pointerEvents: "auto" }}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    onFocus?.(slot.id);
                  }}
                />
              );
            })
        : null}
      {drops
        ? queenPost.nodes.map((node) => {
            const point = nodePixel(node);
            return (
              <div
                key={node.id}
                data-drop={`node-${node.id}`}
                data-corner={node.id}
                style={{ position: "absolute", left: point.x - 18, top: point.y - 18, width: 36, height: 36 }}
              />
            );
          })
        : null}
      {queenPost.slots
        .filter((slot) => placed[slot.id] || (preview && lengths[slot.id] != null && slot.kind !== "gusset" && slot.kind !== "bolt" && slot.kind !== "rail"))
        .map((slot) => {
          const typed = lengths[slot.id] ?? slot.length ?? 1;
          const style = memberStyle(slot, typed);
          return (
            <span key={`${slot.id}:${typed}`}>
              <img className="gk-piece" alt="" data-piece={slot.id} data-length={typed} src={art(slot.sprite)} style={style} />
            </span>
          );
        })}
      {goat.src.startsWith("goat-walk") ? (
        <div className="gk-frames" style={{ left: goat.left, top: goat.top, width: goat.width, height: goat.height }}>
          {[1, 2, 3, 4, 5].map((frame) => (
            <img key={frame} src={art(`goat-walk-${frame}.png`)} alt="" />
          ))}
        </div>
      ) : (
        <img src={art(goat.src)} alt="" style={{ position: "absolute", left: goat.left, top: goat.top, width: goat.width, height: goat.height }} />
      )}
      <Ruler focus={lit} />
    </div>
    </div>
  );
}

function CornerPulses({ placed }: { placed: Record<string, boolean> }) {
  return (
    <svg viewBox="0 0 1000 620" width="1000" height="620" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {queenPost.slots
        .filter((slot) => slot.kind === "gusset" && slot.at && !placed[slot.id])
        .map((slot) => {
          const point = nodePixel(kitNode(slot.at!));
          return <circle key={slot.id} className="gk-corner-pulse" data-corner-pulse={slot.at} cx={point.x} cy={point.y} r="10" fill="#E0661A" opacity="0.55" />;
        })}
    </svg>
  );
}

function Ruler({ focus }: { focus?: string | null }) {
  const slot = focus ? queenPost.slots.find((item) => item.id === focus) : null;
  const nodes = slot ? slotNodes(slot) : null;
  const markM = (m: number) => queenPost.scene.originX + m * queenPost.pxPerMetre;
  let hi: { x1: number; x2: number } | null = null;
  if (nodes && Math.abs(nodes.from.h) < 0.02 && Math.abs(nodes.to.h) < 0.02) {
    hi = { x1: markM(Math.min(nodes.from.m, nodes.to.m)), x2: markM(Math.max(nodes.from.m, nodes.to.m)) };
  } else if (slot?.kind === "post" && slot.from) {
    const x = markM(kitNode(slot.from).m);
    hi = { x1: x - 6, x2: x + 6 };
  } else if (nodes) {
    const deck = nodes.from.h <= nodes.to.h ? nodes.from.m : nodes.to.m;
    const x = markM(deck);
    hi = { x1: x - 6, x2: x + 6 };
  }
  return (
    <svg viewBox="0 0 1000 620" width="1000" height="620" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <rect x="268" y="403" width="448" height="44" rx="10" fill="#fff" opacity="0.88" />
      <line x1="292" y1="415" x2="692" y2="415" stroke="#22201C" strokeWidth="2" />
      {hi ? <line x1={hi.x1} y1="415" x2={hi.x2} y2="415" stroke="#E0661A" strokeWidth="6" strokeLinecap="round" data-tape-hi="1" /> : null}
      {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((mark) => (
        <line key={mark} x1={292 + mark * 50} y1="415" x2={292 + mark * 50} y2={mark % 2 === 0 ? 428 : 422} stroke="#22201C" strokeWidth="1.5" />
      ))}
      {[0, 2, 4, 6, 8].map((mark) => (
        <text key={mark} x={292 + mark * 50} y="442" textAnchor="middle" fontFamily="Figtree, sans-serif" fontSize="12" fontWeight="700" fill="#22201C">
          {mark} {lengthAbbrev()}
        </text>
      ))}
    </svg>
  );
}

function PlankHoles({ placed }: { placed: Record<string, boolean> }) {
  return (
    <svg viewBox="0 0 1000 620" width="1000" height="620" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {plankSlots()
        .filter((slot) => !placed[slot.id])
        .map((slot) => {
          const x = queenPost.scene.originX + plankStart(slot) * queenPost.pxPerMetre;
          return (
            <rect
              key={slot.id}
              data-hole={slot.id}
              x={x}
              y={queenPost.scene.deckY}
              width={queenPost.pxPerMetre}
              height={PLANK_THICK_PX}
              fill="none"
              stroke="#9a9388"
              strokeWidth="2"
              strokeDasharray="5 4"
              opacity="0.85"
            />
          );
        })}
    </svg>
  );
}

const BANK_BOTTOM = 610;

function spriteFor(pose: PiecePose): string {
  if (pose.broken === "left") {
    return "beam-broken-left.png";
  }
  if (pose.broken === "right") {
    return "beam-broken-right.png";
  }
  if (pose.kind === "post") {
    return "post.png";
  }
  if (pose.kind === "brace") {
    return "beam-half.png";
  }
  return "beam-side.png";
}

function poseStyle(pose: PiecePose): CSSProperties {
  const px = queenPost.scene.originX + queenPost.pxPerMetre * pose.x;
  const py = queenPost.scene.deckY - queenPost.pxPerMetre * pose.y;
  const along = pose.length * queenPost.pxPerMetre;
  const vertical = pose.kind === "post";
  const plank = pose.kind === "plank";
  const width = vertical ? 32 : along;
  const height = plank ? 14 : vertical ? along : pose.kind === "brace" ? 15 : 22;
  const rotation = vertical ? -pose.angle + Math.PI / 2 : -pose.angle;
  const deckBeam = pose.kind === "beam" && Math.abs(pose.angle) < 0.25;
  let top = plank ? py - height : deckBeam ? py + queenPost.pxPerMetre * 0.06 - height : py - height / 2;
  if (!deckBeam && !plank && pose.y <= waterWorld() + 0.02) {
    top = Math.max(top, waterPixel() - height / 2);
  }
  top = Math.min(top, BANK_BOTTOM - height);
  return {
    position: "absolute",
    left: px - width / 2,
    top,
    width,
    height,
    transform: `rotate(${rotation}rad)`,
    transformOrigin: "center center",
  };
}

function fit(src: string, width: number, height: number) {
  return { src, width: Math.round(width * 0.5), height: Math.round(height * 0.5) };
}

export function goatSprite(mode: GoatMode, walkFrame: number): { src: string; width: number; height: number } {
  if (mode === "arrived") {
    return { src: "goat-arrived.png", width: 149, height: 150 };
  }
  if (mode === "walk") {
    return { src: `goat-walk-${walkFrame}.png`, width: 145, height: 150 };
  }
  if (mode === "slip") {
    return fit("goat-slip.png", 282, 266);
  }
  if (mode === "flail") {
    return fit("goat-flail.png", 350, 275);
  }
  if (mode === "fall") {
    return fit("goat-fall.png", 288, 277);
  }
  if (mode === "tumble") {
    return fit("goat-tumble.png", 211, 290);
  }
  if (mode === "splash") {
    return fit("goat-splash-in.png", 367, 265);
  }
  if (mode === "swim") {
    return fit(`goat-swim-${walkFrame}.png`, 306, 184);
  }
  if (mode === "drip") {
    return fit("goat-drip.png", 295, 311);
  }
  if (mode === "shake") {
    return fit("goat-shake.png", 418, 326);
  }
  if (mode === "glare") {
    return fit(walkFrame === 2 ? "goat-glare-2.png" : "goat-glare-1.png", walkFrame === 2 ? 347 : 353, walkFrame === 2 ? 293 : 322);
  }
  return { src: "goat-idle.png", width: 149, height: 150 };
}

export function frameNear(frames: CrossingFrame[], metres: number): CrossingFrame {
  if (metres >= 8 && frames.some((frame) => frame.celebrate > 0)) {
    const target = metres - 8;
    let best = frames[0];
    let bestDist = Infinity;
    for (const frame of frames) {
      const dist = Math.abs(frame.celebrate - target);
      if (dist < bestDist) {
        best = frame;
        bestDist = dist;
      }
    }
    return best;
  }
  let best = frames[0];
  let bestDist = Infinity;
  for (const frame of frames) {
    const dist = Math.abs(frame.goatX - metres);
    if (dist < bestDist) {
      best = frame;
      bestDist = dist;
    }
  }
  return best;
}

function Abutments() {
  const top = abutmentTopPx();
  const span = queenPost.scene.originX + 8 * queenPost.pxPerMetre;
  const width = 110;
  const height = 70;
  const style = (left: number): CSSProperties => ({
    position: "absolute",
    left,
    top,
    width,
    height,
  });
  return (
    <>
      <img className="gk-piece" data-piece="abutment-left" alt="" src={art("brick-side.png")} style={style(queenPost.scene.originX - width)} />
      <img className="gk-piece" data-piece="abutment-right" alt="" src={art("brick-side.png")} style={style(span)} />
    </>
  );
}

function Fireworks({ t }: { t: number }) {
  if (t <= 0) {
    return null;
  }
  const colors = ["#E0661A", "#2E7FB0", "#3C7A2B", "#F2B544"];
  const origin = { x: 816, y: 250 };
  const bursts = [0.05, 0.55, 1.05];
  return (
    <>
      {bursts.map((start, index) => {
        const age = t - start;
        if (age < 0 || age > 0.55) {
          return null;
        }
        const spread = 16 + age * 80;
        return Array.from({ length: 6 }, (_, dot) => {
          const angle = (dot / 6) * Math.PI * 2 + index * 0.4;
          return (
            <span
              key={`${index}-${dot}`}
              data-firework="1"
              style={{
                position: "absolute",
                left: origin.x + Math.cos(angle) * spread,
                top: origin.y + Math.sin(angle) * spread - age * 36,
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: colors[(dot + index) % colors.length],
              }}
            />
          );
        });
      })}
    </>
  );
}

/** Pieces and the goat drawn from one simulation frame. The camera does not move. */
export function CrossingPicture({ frame }: { frame: CrossingFrame }) {
  const goat = goatSprite(frame.mode, frame.walkFrame);
  const left = queenPost.scene.originX + queenPost.pxPerMetre * frame.goatX - goat.width / 2;
  const wet = frame.mode === "swim" || frame.mode === "splash";
  const belly = Math.round(goat.height * 0.62);
  let top = wet ? waterPixel() - belly : queenPost.scene.deckY - queenPost.pxPerMetre * frame.goatY - goat.height;
  top = Math.min(top, BANK_BOTTOM - goat.height);
  return (
    <div className="gk-scene-scale">
    <div className="gk-scene" data-scene="bridge" data-goat-x={frame.goatX.toFixed(2)} data-goat-mode={frame.mode}>
      <img className="banks" src={art("banks.png")} alt="" />
      <Abutments />
      <img src={art("signpost.png")} alt="" style={{ position: "absolute", left: 40, top: 263, width: 90, height: 92 }} />
      <img src={art("flag.png")} alt="" style={{ position: "absolute", left: 760, top: 245, width: 112, height: 110 }} />
      <img src={art("grass.png")} alt="" style={{ position: "absolute", left: 880, top: 315, width: 70, height: 40 }} />
      <Fireworks t={frame.celebrate} />
      {frame.pieces.map((pose) => (
        <img key={pose.id} className="gk-piece" alt="" src={art(spriteFor(pose))} style={poseStyle(pose)} />
      ))}
      {frame.splashes
        .filter((splash) => frame.t - splash.at <= 0.6)
        .map((splash) => {
          const age = frame.t - splash.at;
          const x = queenPost.scene.originX + queenPost.pxPerMetre * splash.x - 160;
          const y = waterPixel() - 8;
          return (
            <img
              key={`${splash.x.toFixed(2)}-${splash.at.toFixed(2)}`}
              className="gk-piece"
              data-splash="1"
              alt=""
              src={art("splash.png")}
              style={{ left: x, top: y, width: 320, height: 130, opacity: Math.max(0, 0.95 - age * 1.2) }}
            />
          );
        })}
      <img src={art(goat.src)} alt="" data-goat="lead" data-belly={wet ? waterPixel() : undefined} style={{ position: "absolute", left, top, width: goat.width, height: goat.height, zIndex: 3 }} />
      {frame.follower
        ? (() => {
            const second = goatSprite(frame.follower.mode, frame.walkFrame);
            const wetSecond = frame.follower.mode === "swim" || frame.follower.mode === "splash";
            const secondLeft = queenPost.scene.originX + queenPost.pxPerMetre * frame.follower.x - second.width / 2;
            let secondTop = wetSecond ? waterPixel() - Math.round(second.height * 0.62) : queenPost.scene.deckY - queenPost.pxPerMetre * frame.follower.y - second.height;
            secondTop = Math.min(secondTop, BANK_BOTTOM - second.height);
            return (
              <img
                src={art(second.src)}
                alt=""
                data-goat="follow"
                style={{ position: "absolute", left: secondLeft, top: secondTop, width: second.width, height: second.height, zIndex: 3 }}
              />
            );
          })()
        : null}
    </div>
    </div>
  );
}

const idleGoat = { src: "goat-idle.png", left: 120, top: 205, width: 149, height: 150 };

export function TrussThumb() {
  return (
    <div className="gk-thumb" aria-hidden="true">
      <div className="gk-thumb-fit">
        <BridgeScene placed={{}} lengths={{}} goat={idleGoat} />
      </div>
    </div>
  );
}
