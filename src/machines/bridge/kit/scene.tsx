import type { CSSProperties } from "react";
import { kitNode, nodePixel, queenPost, type KitSlot } from "../kits/kit";
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
  const top = alongDeck ? from.y : from.y - (slot.kind === "brace" ? 11 : height / 2);
  return {
    position: "absolute",
    left: from.x,
    top,
    width,
    height,
    transform: `rotate(${angle}rad)`,
    transformOrigin: "0 50%",
  };
}

function Blueprint({ missing }: { missing: KitSlot[] }) {
  return (
    <svg viewBox="0 0 1000 620" width="1000" height="620" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {missing.map((slot) => {
        if (!slot.from || !slot.to || slot.bonus) {
          return null;
        }
        const from = nodePixel(kitNode(slot.from));
        const to = nodePixel(kitNode(slot.to));
        const label = slot.length == null ? "" : slot.length >= 2.8 && slot.length < 3 ? "2.8 m" : `${slot.length} m`;
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const span = Math.hypot(dx, dy) || 1;
        const midX = (from.x + to.x) / 2 + (-dy / span) * 26;
        const midY = (from.y + to.y) / 2 + (dx / span) * 26;
        return (
          <g key={slot.id}>
            <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="#2E7FB0" strokeWidth="3" strokeDasharray="9 7" />
            <g transform={`translate(${midX - 28} ${midY - 28})`}>
              <rect width="56" height="22" rx="11" fill="#fff" stroke="#2E7FB0" />
              <text x="28" y="15" textAnchor="middle" fontFamily="Figtree, sans-serif" fontSize="12" fontWeight="700" fill="#2E7FB0">
                {label}?
              </text>
            </g>
          </g>
        );
      })}
    </svg>
  );
}

export function BridgeScene({
  placed,
  lengths,
  goat,
  drops,
}: {
  placed: Record<string, boolean>;
  lengths: Record<string, number>;
  goat: { src: string; left: number; top: number; width: number; height: number };
  drops?: boolean;
}) {
  const structural = queenPost.slots.filter((slot) => slot.structural || slot.kind === "gusset" || slot.kind === "rail");
  const missing = structural.filter((slot) => !placed[slot.id] && slot.kind !== "gusset" && slot.kind !== "rail");
  return (
    <div className="gk-scene-scale">
    <div className="gk-scene" data-scene="bridge">
      <img className="banks" src={art("banks.png")} alt="" />
      <img src={art("signpost.png")} alt="" style={{ position: "absolute", left: 40, top: 263, width: 90, height: 92 }} />
      <img src={art("flag.png")} alt="" style={{ position: "absolute", left: 760, top: 245, width: 112, height: 110 }} />
      <img src={art("grass.png")} alt="" style={{ position: "absolute", left: 880, top: 315, width: 70, height: 40 }} />
      <Blueprint missing={missing} />
      {drops
        ? queenPost.slots
            .filter((slot) => slot.structural && !placed[slot.id])
            .map((slot) => {
              const style = memberStyle(slot, slot.length ?? 1);
              return <div key={slot.id} className="gk-hit" data-drop={slot.id} style={{ ...style, height: 36, pointerEvents: "auto" }} />;
            })
        : null}
      {drops
        ? queenPost.nodes.map((node) => {
            const point = nodePixel(node);
            return (
              <div
                key={node.id}
                data-drop={`node-${node.id}`}
                style={{ position: "absolute", left: point.x - 18, top: point.y - 18, width: 36, height: 36 }}
              />
            );
          })
        : null}
      {queenPost.slots
        .filter((slot) => placed[slot.id])
        .map((slot) => (
          <img
            key={slot.id}
            className="gk-piece"
            alt=""
            src={art(slot.sprite)}
            style={memberStyle(slot, lengths[slot.id] ?? slot.length ?? 1)}
          />
        ))}
      {goat.src.startsWith("goat-walk") ? (
        <div className="gk-frames" style={{ left: goat.left, top: goat.top, width: goat.width, height: goat.height }}>
          {[1, 2, 3, 4, 5].map((frame) => (
            <img key={frame} src={art(`goat-walk-${frame}.png`)} alt="" />
          ))}
        </div>
      ) : (
        <img src={art(goat.src)} alt="" style={{ position: "absolute", left: goat.left, top: goat.top, width: goat.width, height: goat.height }} />
      )}
      <Ruler />
    </div>
    </div>
  );
}

function Ruler() {
  return (
    <svg viewBox="0 0 1000 620" width="1000" height="620" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <rect x="268" y="403" width="448" height="44" rx="10" fill="#fff" opacity="0.88" />
      <line x1="292" y1="415" x2="692" y2="415" stroke="#22201C" strokeWidth="2" />
      {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((mark) => (
        <line key={mark} x1={292 + mark * 50} y1="415" x2={292 + mark * 50} y2={mark % 2 === 0 ? 428 : 422} stroke="#22201C" strokeWidth="1.5" />
      ))}
      {[0, 2, 4, 6, 8].map((mark) => (
        <text key={mark} x={292 + mark * 50} y="442" textAnchor="middle" fontFamily="Figtree, sans-serif" fontSize="12" fontWeight="700" fill="#22201C">
          {mark} m
        </text>
      ))}
    </svg>
  );
}

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
  const width = vertical ? 32 : along;
  const height = vertical ? along : pose.kind === "brace" ? 15 : 22;
  const rotation = vertical ? -pose.angle + Math.PI / 2 : -pose.angle;
  return {
    position: "absolute",
    left: px - width / 2,
    top: py - height / 2,
    width,
    height,
    transform: `rotate(${rotation}rad)`,
    transformOrigin: "center center",
  };
}

function goatSprite(mode: GoatMode, walkFrame: number): { src: string; width: number; height: number } {
  if (mode === "idle") {
    return { src: "goat-idle.png", width: 149, height: 150 };
  }
  if (mode === "arrived") {
    return { src: "goat-arrived.png", width: 149, height: 150 };
  }
  if (mode === "startled") {
    return { src: "goat-startled.png", width: 149, height: 150 };
  }
  if (mode === "wet") {
    return { src: "goat-wet.png", width: 160, height: 121 };
  }
  return { src: `goat-walk-${walkFrame}.png`, width: 145, height: 150 };
}

export function frameNear(frames: CrossingFrame[], metres: number): CrossingFrame {
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

/** Pieces and the goat drawn from one simulation frame. The camera does not move. */
export function CrossingPicture({ frame }: { frame: CrossingFrame }) {
  const goat = goatSprite(frame.mode, frame.walkFrame);
  const left = queenPost.scene.originX + queenPost.pxPerMetre * frame.goatX - goat.width / 2;
  const top = queenPost.scene.deckY - queenPost.pxPerMetre * frame.goatY - goat.height;
  return (
    <div className="gk-scene-scale">
    <div className="gk-scene" data-scene="bridge" data-goat-x={frame.goatX.toFixed(2)} data-goat-mode={frame.mode}>
      <img className="banks" src={art("banks.png")} alt="" />
      <img src={art("signpost.png")} alt="" style={{ position: "absolute", left: 40, top: 263, width: 90, height: 92 }} />
      <img src={art("flag.png")} alt="" style={{ position: "absolute", left: 760, top: 245, width: 112, height: 110 }} />
      <img src={art("grass.png")} alt="" style={{ position: "absolute", left: 880, top: 315, width: 70, height: 40 }} />
      {frame.pieces.map((pose) => (
        <img key={pose.id} className="gk-piece" alt="" src={art(spriteFor(pose))} style={poseStyle(pose)} />
      ))}
      {frame.splashes.map((splash) => {
        const x = queenPost.scene.originX + queenPost.pxPerMetre * splash.x - 160;
        const y = queenPost.scene.deckY - queenPost.pxPerMetre * splash.y - 40;
        return <img key={`${splash.x.toFixed(2)}`} className="gk-piece" alt="" src={art("splash.png")} style={{ left: x, top: y, width: 320, height: 130, opacity: 0.9 }} />;
      })}
      <img src={art(goat.src)} alt="" style={{ position: "absolute", left, top, width: goat.width, height: goat.height, zIndex: 3 }} />
    </div>
    </div>
  );
}

export function TrussThumb() {
  const pieces = queenPost.slots.filter((slot) => slot.structural || slot.kind === "gusset");
  return (
    <div className="gk-thumb" aria-hidden="true">
      <div className="gk-scene">
        <img className="banks" src={art("banks.png")} alt="" />
        <img src={art("signpost.png")} alt="" style={{ position: "absolute", left: 40, top: 263, width: 90, height: 92 }} />
        <img src={art("flag.png")} alt="" style={{ position: "absolute", left: 760, top: 245, width: 112, height: 110 }} />
        <img src={art("grass.png")} alt="" style={{ position: "absolute", left: 880, top: 315, width: 70, height: 40 }} />
        {pieces.map((slot) => (
          <img key={slot.id} className="gk-piece" alt="" src={art(slot.sprite)} style={memberStyle(slot, slot.length ?? 1)} />
        ))}
      </div>
    </div>
  );
}
