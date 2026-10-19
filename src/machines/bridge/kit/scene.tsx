import type { CSSProperties } from "react";
import { kitNode, nodePixel, queenPost, type KitSlot } from "../kits/kit";

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
  wreck,
  goat,
  drops,
}: {
  placed: Record<string, boolean>;
  lengths: Record<string, number>;
  wreck?: boolean;
  goat: { src: string; left: number; top: number; width: number; height: number };
  drops?: boolean;
}) {
  const structural = queenPost.slots.filter((slot) => slot.structural || slot.kind === "gusset" || slot.kind === "rail");
  const missing = structural.filter((slot) => !placed[slot.id] && slot.kind !== "gusset" && slot.kind !== "rail");
  return (
    <div className="gk-scene" data-scene="bridge">
      <img className="banks" src={art("banks.png")} alt="" />
      <img src={art("signpost.png")} alt="" style={{ position: "absolute", left: 40, top: 263, width: 90, height: 92 }} />
      <img src={art("flag.png")} alt="" style={{ position: "absolute", left: 760, top: 245, width: 112, height: 110 }} />
      <img src={art("grass.png")} alt="" style={{ position: "absolute", left: 880, top: 315, width: 70, height: 40 }} />
      {!wreck ? <Blueprint missing={missing} /> : null}
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
      {wreck ? <WreckArt /> : null}
      {!wreck
        ? queenPost.slots
            .filter((slot) => placed[slot.id])
            .map((slot) => (
              <img
                key={slot.id}
                className="gk-piece"
                alt=""
                src={art(slot.sprite)}
                style={memberStyle(slot, lengths[slot.id] ?? slot.length ?? 1)}
              />
            ))
        : null}
      {goat.src.startsWith("goat-walk") ? (
        <div className="gk-frames" style={{ left: goat.left, top: goat.top, width: goat.width, height: goat.height }}>
          {[1, 2, 3, 4, 5].map((frame) => (
            <img key={frame} src={art(`goat-walk-${frame}.png`)} alt="" />
          ))}
        </div>
      ) : (
        <img src={art(goat.src)} alt="" style={{ position: "absolute", left: goat.left, top: goat.top, width: goat.width, height: goat.height }} />
      )}
      {!wreck ? <Ruler /> : null}
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

function WreckArt() {
  return (
    <>
      <img className="gk-piece" alt="" src={art("beam-side.png")} style={{ left: 292, top: 355, width: 200, height: 22 }} />
      <img className="gk-piece" alt="" src={art("post.png")} style={{ left: 376, top: 255, width: 32, height: 100 }} />
      <img className="gk-piece" alt="" src={art("beam-half.png")} style={{ left: 292, top: 344, width: 141, height: 15, transform: "rotate(-45deg)", transformOrigin: "0 50%" }} />
      <img className="gk-piece" alt="" src={art("beam-side.png")} style={{ left: 392, top: 247, width: 150, height: 16 }} />
      <img className="gk-piece" alt="" src={art("gusset-small.png")} style={{ left: 377, top: 352, width: 30, height: 27 }} />
      <img className="gk-piece" alt="" src={art("gusset-small.png")} style={{ left: 477, top: 352, width: 30, height: 27 }} />
      <img className="gk-piece" alt="" src={art("gusset-small.png")} style={{ left: 377, top: 242, width: 30, height: 27 }} />
      <img className="gk-piece" alt="" src={art("beam-broken-left.png")} style={{ left: 486, top: 359, width: 150, height: 32, transform: "rotate(28deg)" }} />
      <img className="gk-piece" alt="" src={art("beam-broken-right.png")} style={{ left: 622, top: 415, width: 120, height: 31, transform: "rotate(-40deg)" }} />
      <img className="gk-piece" alt="" src={art("post.png")} style={{ left: 602, top: 395, width: 32, height: 100, transform: "rotate(62deg)" }} />
      <img className="gk-piece" alt="" src={art("gusset-small.png")} style={{ left: 642, top: 475, width: 30, height: 27, transform: "rotate(20deg)" }} />
      <img className="gk-piece" alt="" src={art("bolt.png")} style={{ left: 542, top: 505, width: 30, height: 17, transform: "rotate(-30deg)" }} />
      <img className="gk-piece" alt="" src={art("splash.png")} style={{ left: 402, top: 465, width: 320, height: 130, opacity: 0.9 }} />
      <svg viewBox="0 0 1000 620" width="1000" height="620" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <line x1="542" y1="255" x2="592" y2="255" stroke="#2E7FB0" strokeWidth="3" strokeDasharray="9 7" />
        <g transform="translate(520 228)">
          <rect width="78" height="22" rx="11" fill="#fff" stroke="#B4432B" />
          <text x="39" y="15" textAnchor="middle" fontFamily="Figtree, sans-serif" fontSize="12" fontWeight="700" fill="#B4432B">
            1 m short
          </text>
        </g>
      </svg>
    </>
  );
}

export function TrussThumb() {
  const scale = 0.42;
  return (
    <div className="gk-thumb" aria-hidden="true">
      <img src={art("banks.png")} alt="" style={{ position: "absolute", left: 40, top: 48, width: 1158 * scale, height: 386 * scale }} />
      {queenPost.slots
        .filter((slot) => slot.structural || slot.kind === "gusset")
        .map((slot) => {
          const style = memberStyle(slot, slot.length ?? 1);
          const left = Number(style.left ?? 0) * scale + 70;
          const top = Number(style.top ?? 0) * scale - 40;
          return (
            <img
              key={slot.id}
              alt=""
              src={art(slot.sprite)}
              style={{
                position: "absolute",
                left,
                top,
                width: Number(style.width ?? 0) * scale,
                height: Number(style.height ?? 0) * scale,
                transform: style.transform,
                transformOrigin: style.transformOrigin,
              }}
            />
          );
        })}
    </div>
  );
}
