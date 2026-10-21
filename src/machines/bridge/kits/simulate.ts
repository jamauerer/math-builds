import { BoxShape, RevoluteJoint, Vec2, type Body, type Joint, type World } from "planck";
import { createWorld, TIME_STEP } from "../../../engine/physics";
import { BEARING_FT, kitNode, pieceEnd, plankCovers, plankStart, queenPost, roundTrial, waterWorld, wreckLines, type KitSlot, type WreckCause } from "./kit";

const JOIN_M = 0.15;
const BREAK_N = 1000;

function bankHeight(m: number): number {
  const leftTop = queenPost.scene.leftTopY ?? queenPost.scene.bankTopY;
  const rightTop = queenPost.scene.rightTopY ?? queenPost.scene.bankTopY;
  return ((leftTop - rightTop) / queenPost.pxPerMetre) * (m / Math.max(1, queenPost.span));
}
export const SMALL_GOAT_MASS = 40;
export const BIG_GOAT_MASS = 120;
export const CELEBRATE_S = 2.6;
const GOAT_MASS = SMALL_GOAT_MASS;
const WALK_SPEED = 1;
const BIG_WALK_SPEED = 0.7;
const DECK_Y = 0;
const DRIFT = 0.3;

export type MemberReport = {
  id: string;
  name: string;
  force: number;
  job: string;
};

export type PiecePose = {
  id: string;
  x: number;
  y: number;
  angle: number;
  length: number;
  kind: string;
  broken: "left" | "right" | null;
};

export type SplashMark = { x: number; y: number; at: number };

export type GoatMode = "idle" | "walk" | "arrived" | "slip" | "flail" | "fall" | "tumble" | "splash" | "swim" | "drip" | "shake" | "glare";

export type CrossingFrame = {
  t: number;
  goatX: number;
  goatY: number;
  mode: GoatMode;
  walkFrame: number;
  pieces: PiecePose[];
  splashes: SplashMark[];
  celebrate: number;
  goat: "small" | "big";
  follower: { x: number; y: number; mode: GoatMode } | null;
};

export function framePose(frames: CrossingFrame[], pose: string): CrossingFrame | null {
  if (pose === "slip") {
    return frames.find((frame) => frame.mode === "slip") ?? null;
  }
  if (pose === "air") {
    return frames.find((frame) => frame.mode === "tumble") ?? frames.find((frame) => frame.mode === "fall") ?? null;
  }
  if (pose === "swim") {
    const open =
      frames.find(
        (frame) =>
          frame.mode === "swim" &&
          frame.goatX >= 3.2 &&
          frame.goatX <= 5.2 &&
          frame.splashes.every((mark) => frame.t - mark.at > 0.6),
      ) ?? null;
    return open ?? frames.find((frame) => frame.mode === "swim" && frame.goatX >= 3 && frame.goatX <= 5) ?? frames.find((frame) => frame.mode === "swim") ?? null;
  }
  if (pose === "glare") {
    return [...frames].reverse().find((frame) => frame.mode === "glare") ?? null;
  }
  return null;
}

export type CrossingResult = {
  ok: boolean;
  goatX: number;
  goatY: number;
  goatInWater: boolean;
  massKg: number;
  loadPercent: number;
  members: MemberReport[];
  wreck: string[];
  frames: CrossingFrame[];
  bodies: { id: string; y: number }[];
  breakAt: number | null;
  cause: WreckCause | null;
  peakForce: number;
  broke: string[];
};

type Piece = {
  id: string;
  body: Body;
  half: number;
  thick: number;
  length: number;
  kind: string;
  ax: number;
  ay: number;
  bx: number;
  by: number;
  broken: "left" | "right" | null;
};

type EndPoint = {
  piece: Piece;
  local: Vec2;
  x: number;
  y: number;
  side: "left" | "right";
};

function addPiece(world: World, slot: KitSlot, typed: number): { piece: Piece; ends: EndPoint[] } | null {
  if (!slot.from || !slot.to || slot.kind === "gusset" || slot.kind === "bolt") {
    return null;
  }
  const from = kitNode(slot.from);
  const end = pieceEnd(slot, typed);
  const shift0 = slot.id === "bottom-a" ? -BEARING_FT : 0;
  const shift1 = slot.id === "bottom-b" ? BEARING_FT : 0;
  const ax = from.m + shift0;
  const bx = end.m + shift1;
  const deck = slot.kind === "beam" && Math.abs(end.h - from.h) < 0.02;
  const ay = from.h + bankHeight(ax);
  const by = end.h + bankHeight(bx);
  const length = Math.max(0.25, Math.hypot(bx - ax, by - ay));
  const angle = Math.atan2(by - ay, bx - ax);
  const thick = slot.kind === "post" ? 0.18 : 0.12;
  const lift = deck ? thick / 2 : 0;
  const body = world.createDynamicBody({
    position: new Vec2((ax + bx) / 2, (ay + by) / 2 + lift),
    angle,
    linearDamping: 0.35,
    angularDamping: 0.45,
    allowSleep: false,
  });
  body.createFixture(new BoxShape(length / 2, thick / 2), {
    density: slot.kind === "brace" ? 6 : 10,
    friction: 0.8,
    filterCategoryBits: 0x0002,
    filterMaskBits: 0x0001,
  });
  const piece: Piece = {
    id: slot.id,
    body,
    half: length / 2,
    thick,
    length,
    kind: slot.kind,
    ax,
    ay,
    bx,
    by,
    broken: null,
  };
  return {
    piece,
    ends: [
      { piece, local: new Vec2(-length / 2, deck ? -thick / 2 : 0), x: ax, y: ay, side: "left" },
      { piece, local: new Vec2(length / 2, deck ? -thick / 2 : 0), x: bx, y: by, side: "right" },
    ],
  };
}

type PlankRide = { plank: Piece; beamId: string; along: number };

/** Plank deck boards as bodies that ride their beam (fall with a fold) without stiffening the truss. */
function addPlankBodies(world: World, pieces: Piece[], lengths: Record<string, number>): PlankRide[] {
  const rides: PlankRide[] = [];
  const thick = 0.08;
  for (const slot of queenPost.slots) {
    if (slot.kind !== "plank" || lengths[slot.id] == null) {
      continue;
    }
    const typed = Math.max(0.25, lengths[slot.id]);
    const start = plankStart(slot);
    const mid = start + typed / 2;
    const beam = pieces.find(
      (piece) =>
        piece.kind === "beam" &&
        piece.id.startsWith("bottom") &&
        mid >= Math.min(piece.ax, piece.bx) - 0.05 &&
        mid <= Math.max(piece.ax, piece.bx) + 0.05,
    );
    const beamTop = beam ? beam.body.getPosition().y + beam.thick / 2 : 0.12;
    // Kinematic so planks ride the beam for drawing/fold without loading the truss joints.
    const body = world.createKinematicBody({
      position: new Vec2(mid, beamTop + thick / 2),
      angle: beam?.body.getAngle() ?? 0,
      allowSleep: false,
    });
    body.createFixture(new BoxShape(typed / 2, thick / 2), {
      density: 0,
      friction: 0.9,
      isSensor: true,
      filterCategoryBits: 0x0002,
      filterMaskBits: 0x0000,
    });
    const plank: Piece = {
      id: slot.id,
      body,
      half: typed / 2,
      thick,
      length: typed,
      kind: "plank",
      ax: start,
      ay: 0,
      bx: start + typed,
      by: 0,
      broken: null,
    };
    pieces.push(plank);
    if (beam) {
      const along = mid - (beam.ax + beam.bx) / 2;
      rides.push({ plank, beamId: beam.id, along });
    }
  }
  return rides;
}

function syncPlankRides(rides: PlankRide[], pieces: Piece[]) {
  for (const ride of rides) {
    const beam = pieces.find((piece) => piece.id === ride.beamId);
    if (!beam) {
      continue;
    }
    const local = new Vec2(ride.along, beam.thick / 2 + ride.plank.thick / 2 + 0.1);
    const world = beam.body.getWorldPoint(local);
    ride.plank.body.setTransform(world, beam.body.getAngle());
    ride.plank.body.setLinearVelocity(beam.body.getLinearVelocity());
    ride.plank.body.setAngularVelocity(beam.body.getAngularVelocity());
  }
}

function jobFor(slotId: string): string {
  if (slotId === "top") {
    return "squashed";
  }
  if (slotId.startsWith("bottom")) {
    return "stretched";
  }
  if (slotId.startsWith("brace")) {
    return "pushing";
  }
  return "holding";
}

function closestOnSegment(ax: number, ay: number, bx: number, by: number, px: number, py: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const length2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / length2));
  const x = ax + t * dx;
  const y = ay + t * dy;
  return { t, x, y, dist: Math.hypot(px - x, py - y) };
}

function deckUnder(pieces: Piece[], x: number): { piece: Piece; y: number } | null {
  let best: { piece: Piece; y: number } | null = null;
  for (const piece of pieces) {
    if (piece.kind !== "beam" || !piece.id.startsWith("bottom")) {
      continue;
    }
    const pos = piece.body.getPosition();
    const angle = piece.body.getAngle();
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    const dx = x - pos.x;
    const dy = 0 - pos.y;
    const localX = dx * cosine + dy * sine;
    if (localX < -piece.half - 0.05 || localX > piece.half + 0.05) {
      continue;
    }
    const clamped = Math.max(-piece.half, Math.min(piece.half, localX));
    const centerY = pos.y + clamped * sine;
    const surface = centerY + Math.cos(angle) * (piece.thick / 2);
    const centerX = pos.x + clamped * cosine;
    if (Math.abs(centerX - x) > 0.35) {
      continue;
    }
    if (!best || surface > best.y) {
      best = { piece, y: surface };
    }
  }
  return best;
}

export function simulateCrossing(lengths: Record<string, number>, massKg = GOAT_MASS, trial = roundTrial(lengths)): CrossingResult {
  const span = queenPost.span;
  const world = createWorld(10);
  const banks: { id: string; body: Body; x: number; y: number; side: "left" | "right" }[] = [];
  for (const bank of [
    { id: "n0", x: -1.5, side: "left" as const },
    { id: "far", x: span + 1.5, side: "right" as const },
  ]) {
    const top = bankHeight(bank.side === "left" ? 0 : span);
    const body = world.createBody({ type: "static" });
    body.setPosition(new Vec2(bank.x, top - 0.1));
    body.createFixture(new BoxShape(1.5, 0.1), { friction: 0.9, filterCategoryBits: 0x0001, filterMaskBits: 0x0006 });
    banks.push({ id: bank.id, body, x: bank.side === "left" ? 0 : span, y: top, side: bank.side });
  }

  const waterY = waterWorld();
  const river = world.createBody({ type: "static", position: new Vec2(span / 2, waterY) });
  river.createFixture(new BoxShape(span / 2 + 2, 0.08), { isSensor: true, filterCategoryBits: 0x0001, filterMaskBits: 0x0006 });

  const pieces: Piece[] = [];
  const ends: EndPoint[] = [];
  for (const slot of queenPost.slots) {
    if (!slot.structural || lengths[slot.id] == null) {
      continue;
    }
    const made = addPiece(world, slot, lengths[slot.id]);
    if (!made) {
      continue;
    }
    pieces.push(made.piece);
    ends.push(...made.ends);
  }

  const joints: { joint: Joint; end: EndPoint }[] = [];
  const linked = new Set<string>();
  for (const end of ends) {
    for (const other of pieces) {
      if (other === end.piece) {
        continue;
      }
      const along = closestOnSegment(other.ax, other.ay, other.bx, other.by, end.x, end.y);
      if (along.dist > JOIN_M) {
        continue;
      }
      const key = [end.piece.id, other.id].sort().join(":") + `:${along.x.toFixed(2)},${along.y.toFixed(2)}`;
      if (linked.has(key)) {
        continue;
      }
      linked.add(key);
      const otherDeck = other.kind === "beam" && Math.abs(other.ay - other.by) < 0.02;
      const joint = world.createJoint(
        new RevoluteJoint({
          bodyA: end.piece.body,
          bodyB: other.body,
          localAnchorA: end.local,
          localAnchorB: new Vec2(-other.half + along.t * other.length, otherDeck ? -other.thick / 2 : 0),
          collideConnected: false,
        }),
      );
      if (joint) {
        joints.push({ joint, end });
      }
    }
    for (const bank of banks) {
      const onBank = bank.side === "left" ? end.x <= 0.05 : end.x >= span - 0.05;
      if (!onBank || Math.abs(end.y - bankHeight(end.x)) > 0.25) {
        continue;
      }
      const joint = world.createJoint(
        new RevoluteJoint({
          bodyA: bank.body,
          bodyB: end.piece.body,
          localAnchorA: bank.body.getLocalPoint(new Vec2(end.x, end.y)),
          localAnchorB: end.local,
          collideConnected: false,
        }),
      );
      if (joint) {
        joints.push({ joint, end });
      }
    }
  }

  // After structural joints: planks ride beams so they draw and fold without joining the truss.
  const plankRides = addPlankBodies(world, pieces, lengths);

  const heavy = massKg >= BIG_GOAT_MASS || queenPost.goat === "big";
  const bolted = lengths.bolts != null;
  const scale = Math.max(1, span / 8);
  const breakN = bolted ? 4000 * scale : trial === "heavy" ? 200 : trial === "fold" ? BREAK_N : 2500 * scale;
  if (trial === "fold") {
    for (const piece of pieces) {
      piece.body.setStatic();
    }
  }
  syncPlankRides(plankRides, pieces);
  let released = trial !== "fold";

  const goat = world.createKinematicBody({ position: new Vec2(-1.1, 0.55), allowSleep: false });
  goat.createFixture(new BoxShape(0.28, 0.22), {
    density: 1,
    friction: 0.6,
    filterCategoryBits: 0x0004,
    filterMaskBits: 0x0001,
  });

  const force = new Map<string, number>();
  const frames: CrossingFrame[] = [];
  const splashes: SplashMark[] = [];
  const soaked = new Set<string>();
  const gone = new Set<Joint>();
  let breakAt: number | null = null;
  let failed = false;
  let cause: WreckCause | null = null;
  let peakForce = 0;
  const brokeIds: string[] = [];
  const note = (next: WreckCause) => {
    if (!cause) {
      cause = next;
    }
  };
  let goatDynamic = false;
  let goatX = -1.1;
  let feetY = 0;
  let mode: GoatMode = "idle";
  let walkTime = 0;
  let sinceFail = 0;
  let sinceWet = 0;
  let wetX = 0;
  let swimTime = 0;
  let glareTime = 0;
  let splashHold = 0;
  let entryX = span / 2;
  let driftLeft = 0;
  let climbing = false;
  let celebrate = 0;
  const walkSpeed = heavy ? BIG_WALK_SPEED : WALK_SPEED;

  const capture = (t: number) => {
    const climb = Math.max(0, sinceWet - 1.5);
    const cycle = heavy
      ? mode === "swim"
        ? 1 + (Math.floor(swimTime * 4) % 2)
        : mode === "drip"
          ? 1 + (Math.floor(climb * 6) % 3)
          : mode === "walk" || mode === "idle"
            ? 1 + (Math.floor(walkTime * 6) % 6)
            : 1
      : mode === "swim"
        ? 1 + (Math.floor(swimTime * 6) % 5)
        : mode === "glare"
          ? 1 + (Math.floor(glareTime / 0.8) % 2)
          : 1 + (Math.floor(walkTime * 8) % 5);
    frames.push({
      t,
      goatX,
      goatY: feetY,
      mode,
      walkFrame: cycle,
      pieces: pieces.map((piece) => {
        const pos = piece.body.getPosition();
        return {
          id: piece.id,
          x: pos.x,
          y: pos.y,
          angle: piece.body.getAngle(),
          length: piece.length,
          kind: piece.kind,
          broken: piece.broken,
        };
      }),
      splashes: splashes.map((mark) => ({ ...mark })),
      celebrate,
      goat: heavy ? "big" : "small",
      follower: null,
    });
  };

  const maxSteps = Math.max(1400, Math.ceil(((span + 6) / walkSpeed + CELEBRATE_S + 4) / TIME_STEP));
  for (let step = 0; step < maxSteps; step += 1) {
    const t = step * TIME_STEP;
    if (!goatDynamic && t < 0.4) {
      mode = "idle";
      goatX = -1.1;
      feetY = 0;
      goat.setPosition(new Vec2(goatX, 0.45));
      goat.setLinearVelocity(new Vec2(0, 0));
    } else if (!goatDynamic && mode !== "arrived") {
      walkTime += TIME_STEP;
      const nextX = -1.1 + walkSpeed * walkTime;
      if (nextX <= 0) {
        goatX = nextX;
        feetY = 0;
        mode = "walk";
        goat.setPosition(new Vec2(goatX, 0.45));
        goat.setLinearVelocity(new Vec2(walkSpeed, 0));
      } else if (nextX < span && !plankCovers(lengths, nextX)) {
        goat.setDynamic();
        goat.setAwake(true);
        goat.setLinearVelocity(new Vec2(0, -0.2));
        goat.setAngularVelocity(2.6);
        goatDynamic = true;
        mode = "slip";
        failed = true;
        goatX = nextX;
        note({ kind: "planks", id: "planks", name: "Planks" });
        if (breakAt == null) {
          breakAt = t;
        }
      } else {
        const support = deckUnder(pieces, Math.min(nextX, span + 0.2));
        if (support) {
          if (!released) {
            for (const piece of pieces) {
              piece.body.setDynamic();
              piece.body.setAwake(true);
            }
            released = true;
          }
          goatX = nextX;
          feetY = nextX >= span && support.y > -0.25 ? 0 : support.y;
          goat.setPosition(new Vec2(goatX, feetY + 0.28));
          goat.setLinearVelocity(new Vec2(walkSpeed, 0));
          support.piece.body.applyForce(new Vec2(0, -massKg * 10), new Vec2(Math.min(goatX, span), feetY), true);
          if (support.y < bankHeight(nextX) - 0.35 * scale) {
            goat.setDynamic();
            goat.setAwake(true);
            goat.setLinearVelocity(new Vec2(walkSpeed, -0.4));
            goat.setAngularVelocity(2.6);
            goatDynamic = true;
            mode = "slip";
            failed = true;
            note({ kind: "support", id: support.piece.id, name: support.piece.id });
            if (breakAt == null) {
              breakAt = t;
            }
          } else if (nextX >= span) {
            mode = "arrived";
            goatX = span;
            feetY = bankHeight(span);
          } else {
            mode = "walk";
          }
        } else if (nextX >= span && feetY > bankHeight(span) - 0.35 * scale) {
          goatX = span;
          feetY = 0;
          mode = "arrived";
          goat.setPosition(new Vec2(goatX, 0.45));
        } else {
          goat.setDynamic();
          goat.setAwake(true);
          goat.setLinearVelocity(new Vec2(walkSpeed, -0.2));
          goat.setAngularVelocity(2.6);
          goatDynamic = true;
          mode = "slip";
          failed = true;
          note({ kind: "support", id: "deck", name: "The deck" });
          if (breakAt == null) {
            breakAt = t;
          }
        }
      }
    }

    for (const item of joints) {
      if (gone.has(item.joint)) {
        continue;
      }
      const reaction = item.joint.getReactionForce(1 / TIME_STEP).length();
      peakForce = Math.max(peakForce, reaction);
      force.set(item.end.piece.id, Math.max(force.get(item.end.piece.id) ?? 0, reaction));
      if (reaction > breakN && !(mode === "arrived" && !failed)) {
        if (item.end.piece.kind === "beam" && item.end.piece.broken == null) {
          item.end.piece.broken = item.end.side;
        }
        if (!brokeIds.includes(item.end.piece.id)) {
          brokeIds.push(item.end.piece.id);
        }
        const slot = queenPost.slots.find((itemSlot) => itemSlot.id === item.end.piece.id);
        note({ kind: "joint", id: item.end.piece.id, name: slot?.name ?? item.end.piece.id });
        world.destroyJoint(item.joint);
        gone.add(item.joint);
        failed = true;
        if (breakAt == null) {
          breakAt = t;
        }
      }
    }

    world.step(TIME_STEP);
    syncPlankRides(plankRides, pieces);

    for (const piece of pieces) {
      if (piece.kind === "plank") {
        continue;
      }
      const pos = piece.body.getPosition();
      if (pos.y < waterY && !soaked.has(piece.id)) {
        soaked.add(piece.id);
        splashes.push({ x: pos.x, y: waterY, at: t });
        piece.body.setLinearDamping(16);
        piece.body.setAngularDamping(16);
        failed = true;
        if (breakAt == null) {
          breakAt = t;
        }
      }
      if (soaked.has(piece.id)) {
        const bob = Math.abs(Math.sin(t * 3 + piece.half)) * 0.03;
        piece.body.setPosition(new Vec2(pos.x, waterY - bob));
        piece.body.setLinearVelocity(new Vec2(0.05, 0));
        piece.body.setAngularVelocity(0);
      }
    }
    // Keep riding planks in the water splash list when their beam is soaked.
    syncPlankRides(plankRides, pieces);

    if (goatDynamic && !climbing) {
      const pos = goat.getPosition();
      goatX = pos.x;
      feetY = pos.y - 0.28;
      const angle = Math.abs(Math.atan2(Math.sin(goat.getAngle()), Math.cos(goat.getAngle())));
      const inWater = feetY < waterY;
      if (inWater && !soaked.has("goat")) {
        soaked.add("goat");
        wetX = goatX;
        entryX = goatX;
        driftLeft = 0.5;
        splashHold = 0.5;
        splashes.push({ x: goatX, y: waterY, at: t });
        goat.setLinearDamping(12);
        goat.setAngularDamping(12);
      }
      if (inWater) {
        sinceWet += TIME_STEP;
      }
      if (sinceWet >= 1.5) {
        climbing = true;
      } else if (driftLeft > 0) {
        mode = "splash";
        const spent = 0.5 - driftLeft;
        const u = Math.min(1, spent / 0.5);
        goatX = entryX + (span / 2 - entryX) * u;
        driftLeft -= TIME_STEP;
        splashHold = Math.max(0, splashHold - TIME_STEP);
        feetY = waterY;
        goat.setPosition(new Vec2(goatX, waterY));
        goat.setLinearVelocity(new Vec2(0, 0));
        goat.setAngularVelocity(0);
      } else if (inWater) {
        mode = "swim";
        swimTime += TIME_STEP;
        goatX += DRIFT * TIME_STEP;
        const bob = Math.abs(Math.sin(swimTime * 3)) * 0.03;
        feetY = waterY - bob;
        goat.setPosition(new Vec2(goatX, feetY));
        goat.setLinearVelocity(new Vec2(DRIFT, 0));
        goat.setAngularVelocity(0);
      } else if (feetY > waterY + 0.7) {
        mode = angle > 0.45 ? "flail" : "slip";
      } else {
        mode = angle > 0.9 ? "tumble" : "fall";
      }
    }
    if (climbing) {
      sinceWet += TIME_STEP;
      const bankX = wetX < span / 2 ? -1 : span + 1;
      goatX += (bankX - goatX) * 0.14;
      feetY += (0.05 - feetY) * 0.22;
      goat.setPosition(new Vec2(goatX, feetY + 0.45));
      goat.setLinearVelocity(new Vec2(0, 0));
      goat.setAngularVelocity(0);
      const climb = sinceWet - 1.5;
      if (climb < 0.4) {
        mode = "drip";
      } else if (climb < 0.8) {
        mode = "shake";
      } else {
        mode = "glare";
        glareTime = climb - 0.8;
      }
    }

    if (mode === "arrived" && !failed && goatX >= span) {
      celebrate += TIME_STEP;
      feetY = 0;
      goat.setPosition(new Vec2(span, 0.45));
      goat.setLinearVelocity(new Vec2(0, 0));
    }

    if (step % 2 === 0) {
      capture(t);
    }

    if (failed) {
      sinceFail += TIME_STEP;
    }
    const arrived = mode === "arrived" && goatX >= span && !failed;
    if (arrived && celebrate >= CELEBRATE_S) {
      capture(t);
      break;
    }
    const lastSplash = splashes.reduce((latest, mark) => Math.max(latest, mark.at), 0);
    if (mode === "glare" && glareTime >= 0.8 && t >= lastSplash + 2) {
      capture(t);
      break;
    }
    if (failed && sinceWet === 0 && sinceFail > 6) {
      capture(t);
      break;
    }
  }

  const members: MemberReport[] = queenPost.slots
    .filter((slot) => slot.structural)
    .map((slot) => ({
      id: slot.id,
      name: slot.id === "top" ? "Top beam" : slot.id.startsWith("bottom") ? "Bottom beams" : slot.id.startsWith("brace") ? "Braces" : slot.name,
      force: force.get(slot.id) ?? 0,
      job: jobFor(slot.id),
    }));
  const seen = new Set<string>();
  const unique = members.filter((item) => {
    if (seen.has(item.name)) {
      return false;
    }
    seen.add(item.name);
    return true;
  });
  unique.sort((a, b) => b.force - a.force);

  const goatInWater = feetY < DECK_Y;
  const ok = !failed && goatX >= span && feetY > bankHeight(span) - 0.35 * scale;
  return {
    ok,
    goatX,
    goatY: feetY,
    goatInWater,
    massKg,
    loadPercent: Math.max(6, Math.min(100, Math.round((massKg / 180) * 100))),
    members: unique,
    wreck: wreckLines(lengths),
    frames,
    bodies: pieces.map((piece) => ({ id: piece.id, y: piece.body.getPosition().y })),
    breakAt,
    cause,
    peakForce,
    broke: brokeIds,
  };
}
