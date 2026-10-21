import type { CSSProperties } from "react";
import { formatLength, lengthAbbrev } from "../../../units";
import {
  BEAM_THICK_PX,
  deckBeamBox,
  kitNode,
  nodePixel,
  PLANK_THICK_PX,
  plankSlots,
  plankStart,
  queenPost,
  slotNodes,
  slotAlong,
  slotRunLabel,
  waterPixel,
  waterWorld,
  type KitSlot,
} from "../kits/kit";
import type { CrossingFrame, GoatMode, PiecePose } from "../kits/simulate";

export function art(file: string): string {
  const base = import.meta.env.BASE_URL.endsWith("/") ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
  return `${base}art/${file}`;
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
  if (alongDeck && (slot.id === "bottom-a" || slot.id === "bottom-b")) {
    const box = deckBeamBox(slot.id === "bottom-a" ? "left" : "right", typed);
    return {
      position: "absolute",
      left: box.left,
      top: box.top,
      width: box.width,
      height: box.height,
      transform: `rotate(${angle}rad)`,
      transformOrigin: "0 0%",
    };
  }
  const top = alongDeck
    ? queenPost.scene.bankTopY - BEAM_THICK_PX
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

function Blueprint({ missing, hot, guided }: { missing: KitSlot[]; hot?: string | null; guided?: boolean }) {
  const slots =
    guided && hot
      ? missing.filter(
          (slot) =>
            slot.id === hot ||
            (hot === "planks" && slot.kind === "plank") ||
            (hot.startsWith("plank") && slot.id === hot),
        )
      : missing;
  return (
    <svg viewBox="0 0 1000 620" width="1000" height="620" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {slots.map((slot) => {
        if (!slot.from || !slot.to || slot.bonus) {
          return null;
        }
        const from = nodePixel(kitNode(slot.from));
        const to = nodePixel(kitNode(slot.to));
        const on = !guided || slot.id === hot;
        return (
          <line
            key={slot.id}
            className={on ? "gk-slot-hot" : undefined}
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
            .filter((slot) => slot.kind === "plank" && (hot === "planks" || slot.id === hot) && (!guided || hot === "planks" || slot.id === hot))
            .map((slot) => {
              const x = queenPost.scene.originX + plankStart(slot) * queenPost.pxPerMetre;
              return <rect key={slot.id} className="gk-slot-hot" x={x} y={queenPost.scene.deckY} width={queenPost.pxPerMetre} height={PLANK_THICK_PX} fill="none" stroke="#E0661A" strokeWidth="4" strokeDasharray="6 4" />;
            })
        : null}
    </svg>
  );
}

function SlotLabels({
  placed,
  lengths,
  geometryLevel,
  only,
}: {
  placed: Record<string, boolean>;
  lengths: Record<string, number>;
  geometryLevel: number;
  only?: string | null;
}) {
  return (
    <>
      {queenPost.slots.map((slot) => {
        const nodes = slotNodes(slot);
        if (!nodes || slot.bonus || slot.kind === "gusset" || slot.kind === "bolt") {
          return null;
        }
        if (only) {
          if (only === "planks" || only.startsWith("plank")) {
            if (slot.kind !== "plank") {
              return null;
            }
          } else if (only === "gussets") {
            return null;
          } else if (slot.id !== only) {
            return null;
          }
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
  guided = false,
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
  guided?: boolean;
  flyGusset?: { id: string; at: string } | null;
  preview?: boolean;
  holes?: boolean;
  onFocus?: (id: string) => void;
}) {
  const structural = queenPost.slots.filter((slot) => slot.structural || slot.kind === "gusset" || slot.kind === "rail");
  const missing = structural.filter((slot) => !placed[slot.id] && slot.kind !== "gusset" && slot.kind !== "rail");
  const lit = hot ?? focus;
  const labelOnly = guided ? lit : null;
  return (
    <div className="gk-scene-scale">
    <div className="gk-scene" data-scene="bridge">
      <img className="banks" src={art(queenPost.banks ?? "banks.png")} alt="" />
      <BankGuides />
      <img src={art("signpost.png")} alt="" style={{ position: "absolute", left: 40, top: 263, width: 90, height: 92 }} />
      <img src={art("flag.png")} alt="" style={{ position: "absolute", left: 760, top: 245, width: 112, height: 110 }} />
      <img src={art("grass.png")} alt="" style={{ position: "absolute", left: 880, top: 315, width: 70, height: 40 }} />
      <Blueprint missing={missing} hot={lit} guided={guided} />
      {holes ? <PlankHoles placed={placed} /> : null}
      <SlotLabels placed={placed} lengths={lengths} geometryLevel={geometryLevel} only={labelOnly} />
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
              const style = memberStyle(slot, slotAlong(slot) ?? 1);
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
        .slice()
        .sort((left, right) => drawRank(left) - drawRank(right))
        .map((slot) => {
          const typed = lengths[slot.id] ?? slotAlong(slot) ?? 1;
          const style = { ...memberStyle(slot, typed), zIndex: drawRank(slot) };
          return (
            <span key={`${slot.id}:${typed}`}>
              <img className="gk-piece" alt="" data-piece={slot.id} data-kind={slot.kind} data-length={typed} src={art(slot.sprite)} style={style} />
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

function drawRank(slot: { id: string; kind: string }, layer: "far" | "near" = "near"): number {
  if (layer === "far") {
    return slot.kind === "brace" ? 1 : 2;
  }
  if (slot.kind === "plank") {
    return 3;
  }
  if (slot.kind === "beam" && slot.id !== "top") {
    return 5;
  }
  if (slot.kind === "post") {
    return 6;
  }
  if (slot.kind === "brace") {
    return 7;
  }
  if (slot.id === "top") {
    return 8;
  }
  if (slot.kind === "gusset") {
    return 9;
  }
  if (slot.kind === "bolt") {
    return 10;
  }
  if (slot.kind === "rail") {
    return 11;
  }
  return 5;
}

const GOAT_Z = 4;

function spriteFor(pose: PiecePose): string {
  if (pose.broken === "left") {
    return "beam-broken-left.png";
  }
  if (pose.broken === "right") {
    return "beam-broken-right.png";
  }
  if (pose.kind === "plank") {
    return "plank-side.png";
  }
  if (pose.kind === "post") {
    return "post.png";
  }
  if (pose.kind === "brace") {
    return "beam-half.png";
  }
  return "beam-side.png";
}

function poseStyle(pose: PiecePose, layer: "far" | "near" = "near"): CSSProperties {
  const px = queenPost.scene.originX + queenPost.pxPerMetre * pose.x;
  const py = queenPost.scene.deckY - queenPost.pxPerMetre * pose.y;
  const along = pose.length * queenPost.pxPerMetre;
  const vertical = pose.kind === "post";
  const plank = pose.kind === "plank";
  const width = vertical ? 32 : plank ? Math.max(8, along - 4) : along;
  const height = plank ? PLANK_THICK_PX : vertical ? along : pose.kind === "brace" ? 15 : 22;
  const rotation = vertical ? -pose.angle + Math.PI / 2 : -pose.angle;
  const deckBeam = pose.kind === "beam" && Math.abs(pose.angle) < 0.25;
  const onDeck = plank && Math.abs(pose.angle) < 0.35 && pose.y > -0.15;
  const leftTop = queenPost.scene.leftTopY ?? queenPost.scene.bankTopY;
  const rightTop = queenPost.scene.rightTopY ?? queenPost.scene.bankTopY;
  const seat = pose.x < queenPost.span / 2 ? leftTop : rightTop;
  let top = onDeck
    ? queenPost.scene.deckY
    : plank
      ? py - height / 2
      : deckBeam && pose.y > -0.2
        ? seat - BEAM_THICK_PX
        : py - height / 2;
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
    zIndex: drawRank(pose, layer),
    ...(layer === "far" ? { filter: "brightness(0.62)" } : {}),
  };
}

export function hopPixels(celebrate: number): number {
  const cycle = celebrate < 0.3 ? celebrate : celebrate < 0.6 ? celebrate - 0.3 : -1;
  if (cycle < 0) {
    return 0;
  }
  return Math.sin((cycle / 0.3) * Math.PI) * 20;
}

function fit(src: string, width: number, height: number) {
  return { src, width: Math.round(width * 0.5), height: Math.round(height * 0.5) };
}

function goatHeightPx(kind: "small" | "big"): number {
  const small = Math.round(3 * queenPost.pxPerMetre);
  return kind === "big" ? small * 2 : small;
}

function scaleTo(src: string, natW: number, natH: number, height: number) {
  return { src, width: Math.round((natW * height) / natH), height };
}

export function goatSprite(
  mode: GoatMode,
  walkFrame: number,
  kind: "small" | "big" = "small",
  celebrate = 0,
): { src: string; width: number; height: number } {
  if (kind === "big") {
    return bigGoatSprite(mode, walkFrame, celebrate);
  }
  if (mode === "arrived") {
    const frame = danceFrame(celebrate, 28, 12);
    if (frame) {
      return scaleTo(`goat-dance-${frame}.png`, 223, 240, goatHeightPx("small"));
    }
    return scaleTo("goat-arrived.png", 149, 150, goatHeightPx("small"));
  }
  if (mode === "walk") {
    return scaleTo(`goat-walk-${walkFrame}.png`, 145, 150, goatHeightPx("small"));
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
  return scaleTo("goat-idle.png", 149, 150, goatHeightPx("small"));
}

function danceFrame(celebrate: number, count: number, fps: number): number | null {
  if (celebrate <= 0) {
    return null;
  }
  const frame = 1 + Math.floor(celebrate * fps);
  return frame <= count ? frame : null;
}

function bigGoatSprite(mode: GoatMode, walkFrame: number, celebrate: number): { src: string; width: number; height: number } {
  const sized = (src: string, natW = 295, natH = 335) => scaleTo(src, natW, natH, goatHeightPx("big"));
  if (mode === "arrived") {
    const frame = danceFrame(celebrate, 15, 12);
    if (frame) {
      return sized(`biggoat-dance-${frame}.png`);
    }
    return sized("biggoat-idle.png", 1238, 1116);
  }
  if (mode === "walk") {
    return sized(`biggoat-walk-${Math.min(6, Math.max(1, walkFrame))}.png`);
  }
  if (mode === "slip") {
    return sized("biggoat-slip.png");
  }
  if (mode === "flail") {
    return sized("biggoat-leap.png");
  }
  if (mode === "fall") {
    return sized("biggoat-fall.png");
  }
  if (mode === "tumble") {
    return sized("biggoat-tumble.png");
  }
  if (mode === "splash") {
    return sized(walkFrame > 1 ? "biggoat-splash.png" : "biggoat-splash-in.png");
  }
  if (mode === "swim") {
    return sized(`biggoat-swim-${walkFrame === 2 ? 2 : 1}.png`);
  }
  if (mode === "drip") {
    return sized(`biggoat-drip-${Math.min(3, Math.max(1, walkFrame))}.png`);
  }
  if (mode === "shake") {
    return sized("biggoat-climb-out.png");
  }
  if (mode === "glare") {
    return sized("biggoat-swim-glare.png");
  }
  return sized("biggoat-idle.png", 1238, 1116);
}

export function frameNear(frames: CrossingFrame[], metres: number): CrossingFrame {
  if (metres >= queenPost.span && frames.some((frame) => frame.celebrate > 0)) {
    const target = metres - queenPost.span;
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

function BankGuides() {
  if (typeof window === "undefined" || new URLSearchParams(window.location.search).get("guides") !== "1") {
    return null;
  }
  const { leftEdge, rightEdge, bankTopY } = queenPost.scene;
  const line = (extra: CSSProperties): CSSProperties => ({
    position: "absolute",
    background: "#dc2020",
    pointerEvents: "none",
    zIndex: 20,
    ...extra,
  });
  return (
    <>
      <span data-guide="left-edge" style={line({ left: leftEdge, top: 0, width: 1, height: 620 })} />
      <span data-guide="right-edge" style={line({ left: rightEdge, top: 0, width: 1, height: 620 })} />
      <span data-guide="bank-top" style={line({ left: 0, top: bankTopY, width: 1000, height: 1 })} />
    </>
  );
}

const ROCKET_AT = [0, 0.3, 0.6];
const FW_COLORS = ["gold", "blue", "red", "rainbow", "purple", "green"] as const;

export function fireworkDraws(t: number): number {
  if (t <= 0) {
    return 0;
  }
  let count = t <= 2 ? 1 : 0;
  for (const start of ROCKET_AT) {
    const age = t - start;
    if (age < 0) {
      continue;
    }
    if (age < 0.5) {
      count += 2;
    } else if (age < 1.4) {
      count += 1;
    }
  }
  return count;
}

function rocketHue(index: number): (typeof FW_COLORS)[number] {
  return FW_COLORS[index % FW_COLORS.length];
}

function rocketPair(color: (typeof FW_COLORS)[number]): { rocket: string; trail: string } {
  const hue = color === "rainbow" ? "gold" : color;
  return { rocket: `fw-rocket-${hue}.png`, trail: `fw-trail-${hue}.png` };
}

function Fireworks({ t }: { t: number }) {
  if (t <= 0) {
    return null;
  }
  const origin = { x: 800, y: 268 };
  return (
    <>
      {ROCKET_AT.map((start, index) => {
        const age = t - start;
        if (age < 0 || age > 1.4) {
          return null;
        }
        const color = rocketHue(index);
        if (age < 0.5) {
          const rise = (age / 0.5) * 180;
          const pair = rocketPair(color);
          return (
            <span key={`rocket-${index}`} data-firework="rocket" style={{ position: "absolute", left: origin.x - 10, top: origin.y - rise, width: 28, height: 52, zIndex: 12 }}>
              <img src={art(pair.trail)} alt="" style={{ position: "absolute", left: 6, top: 18, width: 14, height: 34 }} />
              <img src={art(pair.rocket)} alt="" style={{ position: "absolute", left: 2, top: 0, width: 22, height: 28 }} />
            </span>
          );
        }
        const fadeAge = age - 0.5;
        const fade = 1 + Math.min(5, Math.floor((fadeAge / 0.9) * 6));
        const burst = fadeAge < 0.18;
        return (
          <img
            key={`burst-${index}`}
            data-firework={burst ? "burst" : "fade"}
            src={art(burst ? `fw-burst-${color}.png` : `fw-fade-${fade}.png`)}
            alt=""
            style={{ position: "absolute", left: origin.x - 72, top: origin.y - 180 - 72, width: 144, height: 144, zIndex: 13 }}
          />
        );
      })}
      {t <= 2 ? (
        <img
          data-firework="confetti"
          src={art("fw-confetti-sparse.png")}
          alt=""
          style={{ position: "absolute", left: 820, top: 170 + t * 36, width: 170, height: 130, opacity: Math.max(0.25, 1 - t / 2), zIndex: 12 }}
        />
      ) : null}
    </>
  );
}

/** Pieces and the goat drawn from one simulation frame. The camera does not move. */
export function CrossingPicture({ frame, extras = {} }: { frame: CrossingFrame; extras?: Record<string, number> }) {
  const goat = goatSprite(frame.mode, frame.walkFrame, frame.goat, frame.celebrate);
  const left = queenPost.scene.originX + queenPost.pxPerMetre * frame.goatX - goat.width / 2;
  const wet = frame.mode === "swim" || frame.mode === "splash";
  const belly = Math.round(goat.height * 0.62);
  let top = wet
    ? waterPixel() - belly
    : queenPost.scene.deckY - queenPost.pxPerMetre * (frame.mode === "arrived" ? 0 : frame.goatY) - goat.height;
  top = Math.min(top, BANK_BOTTOM - goat.height);
  const fittings = queenPost.slots.filter((slot) => (slot.kind === "gusset" || slot.kind === "bolt" || slot.kind === "rail") && extras[slot.id] != null);
  const far = frame.pieces.filter((pose) => pose.kind === "post" || pose.kind === "brace");
  const near = [...frame.pieces].sort((leftPose, rightPose) => drawRank(leftPose) - drawRank(rightPose));
  return (
    <div className="gk-scene-scale">
    <div className="gk-scene" data-scene="bridge" data-goat-x={frame.goatX.toFixed(2)} data-goat-mode={frame.mode} data-goat-kind={frame.goat}>
      <img className="banks" src={art(queenPost.banks ?? "banks.png")} alt="" />
      <img src={art("signpost.png")} alt="" style={{ position: "absolute", left: 40, top: 263, width: 90, height: 92 }} />
      <img src={art("flag.png")} alt="" style={{ position: "absolute", left: 760, top: 245, width: 112, height: 110, zIndex: 8 }} />
      <img src={art("grass.png")} alt="" style={{ position: "absolute", left: 880, top: 315, width: 70, height: 40 }} />
      <Fireworks t={frame.celebrate} />
      {far.map((pose) => (
        <img
          key={`far-${pose.id}`}
          className="gk-piece"
          alt=""
          data-piece={`far-${pose.id}`}
          data-kind={pose.kind}
          data-layer="far"
          src={art(spriteFor(pose))}
          style={poseStyle(pose, "far")}
        />
      ))}
      {near.map((pose) => (
        <img
          key={pose.id}
          className="gk-piece"
          alt=""
          data-piece={pose.id}
          data-kind={pose.kind}
          src={art(spriteFor(pose))}
          style={poseStyle(pose)}
        />
      ))}
      {fittings
        .slice()
        .sort((leftSlot, rightSlot) => drawRank(leftSlot) - drawRank(rightSlot))
        .map((slot) => (
          <img
            key={slot.id}
            className="gk-piece"
            alt=""
            data-piece={slot.id}
            data-kind={slot.kind}
            src={art(slot.sprite)}
            style={{ ...memberStyle(slot, slotAlong(slot) ?? 1), zIndex: drawRank(slot) }}
          />
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
              style={{ left: x, top: y, width: 320, height: 130, opacity: Math.max(0, 0.95 - age * 1.2), zIndex: 3 }}
            />
          );
        })}
      <img
        src={art(goat.src)}
        alt=""
        data-goat="lead"
        data-goat-kind={frame.goat}
        data-belly={wet ? waterPixel() : undefined}
        style={{ position: "absolute", left, top, width: goat.width, height: goat.height, zIndex: GOAT_Z }}
      />
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
