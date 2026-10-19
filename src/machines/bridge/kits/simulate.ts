import { BoxShape, RevoluteJoint, Vec2, type Body, type Joint, type World } from "planck";
import { createWorld, TIME_STEP } from "../../../engine/physics";
import { kitNode, pieceEnd, plankCovers, queenPost, roundTrial, waterWorld, wreckLines, type KitSlot, type WreckCause } from "./kit";

const JOIN_M = 0.15;
const BREAK_N = 1000;
const GOAT_MASS = 40;
const WALK_SPEED = 1;
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

export type SplashMark = { x: number; y: number };

export type GoatMode = "idle" | "walk" | "arrived" | "slip" | "flail" | "fall" | "tumble" | "splash" | "swim" | "drip" | "shake" | "glare";

export type CrossingFrame = {
  t: number;
  goatX: number;
  goatY: number;
  mode: GoatMode;
  walkFrame: number;
  pieces: PiecePose[];
  splashes: SplashMark[];
};

export function framePose(frames: CrossingFrame[], pose: string): CrossingFrame | null {
  if (pose === "slip") {
    return frames.find((frame) => frame.mode === "slip") ?? null;
  }
  if (pose === "air") {
    return frames.find((frame) => frame.mode === "tumble") ?? frames.find((frame) => frame.mode === "fall") ?? null;
  }
  if (pose === "swim") {
    return frames.find((frame) => frame.mode === "swim") ?? null;
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
  const length = Math.max(0.25, Math.hypot(end.m - from.m, end.h - from.h));
  const angle = Math.atan2(end.h - from.h, end.m - from.m);
  const thick = slot.kind === "post" ? 0.18 : 0.12;
  const body = world.createDynamicBody({
    position: new Vec2((from.m + end.m) / 2, (from.h + end.h) / 2),
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
    ax: from.m,
    ay: from.h,
    bx: end.m,
    by: end.h,
    broken: null,
  };
  return {
    piece,
    ends: [
      { piece, local: new Vec2(-length / 2, 0), x: from.m, y: from.h, side: "left" },
      { piece, local: new Vec2(length / 2, 0), x: end.m, y: end.h, side: "right" },
    ],
  };
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

export function simulateCrossing(lengths: Record<string, number>, massKg = GOAT_MASS): CrossingResult {
  const world = createWorld(10);
  const banks: { id: string; body: Body; x: number; y: number }[] = [];
  for (const node of [
    { id: "n0", x: 0, y: 0 },
    { id: "n8", x: 8, y: 0 },
  ]) {
    const body = world.createBody({ type: "static" });
    const shift = node.x === 0 ? -1.4 : 1.4;
    body.setPosition(new Vec2(node.x + shift, -0.2));
    body.createFixture(new BoxShape(1.4, 0.2), { friction: 0.9, filterCategoryBits: 0x0001, filterMaskBits: 0x0006 });
    banks.push({ id: node.id, body, x: node.x, y: node.y });
  }

  const waterY = waterWorld();
  const river = world.createBody({ type: "static", position: new Vec2(4, waterY) });
  river.createFixture(new BoxShape(6, 0.08), { isSensor: true, filterCategoryBits: 0x0001, filterMaskBits: 0x0006 });

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
      const joint = world.createJoint(
        new RevoluteJoint({
          bodyA: end.piece.body,
          bodyB: other.body,
          localAnchorA: end.local,
          localAnchorB: new Vec2(-other.half + along.t * other.length, 0),
          collideConnected: false,
        }),
      );
      if (joint) {
        joints.push({ joint, end });
      }
    }
    for (const bank of banks) {
      const dist = Math.hypot(end.x - bank.x, end.y - bank.y);
      if (dist > JOIN_M) {
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

  const trial = roundTrial(lengths);
  if (trial === "beams") {
    for (const piece of pieces) {
      piece.body.setStatic();
    }
  }
  let released = trial !== "beams";

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
  let climbing = false;

  const capture = (t: number) => {
    const cycle =
      mode === "swim" ? 1 + (Math.floor(swimTime * 6) % 5) : mode === "glare" ? 1 + (Math.floor(glareTime / 0.8) % 2) : 1 + (Math.floor(walkTime * 8) % 5);
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
    });
  };

  for (let step = 0; step < 1400; step += 1) {
    const t = step * TIME_STEP;
    if (!goatDynamic && t < 0.4) {
      mode = "idle";
      goatX = -1.1;
      feetY = 0;
      goat.setPosition(new Vec2(goatX, 0.45));
      goat.setLinearVelocity(new Vec2(0, 0));
    } else if (!goatDynamic && mode !== "arrived") {
      walkTime += TIME_STEP;
      const nextX = -1.1 + WALK_SPEED * walkTime;
      if (nextX <= 0) {
        goatX = nextX;
        feetY = 0;
        mode = "walk";
        goat.setPosition(new Vec2(goatX, 0.45));
        goat.setLinearVelocity(new Vec2(WALK_SPEED, 0));
      } else if (nextX < 8 && trial !== "beams" && !plankCovers(lengths, nextX)) {
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
        const support = deckUnder(pieces, Math.min(nextX, 8.2));
        if (support) {
          if (!released) {
            for (const piece of pieces) {
              piece.body.setDynamic();
              piece.body.setAwake(true);
            }
            released = true;
          }
          goatX = nextX;
          feetY = nextX >= 8 && support.y > -0.25 ? 0 : support.y;
          goat.setPosition(new Vec2(goatX, feetY + 0.28));
          goat.setLinearVelocity(new Vec2(WALK_SPEED, 0));
          support.piece.body.applyForce(new Vec2(0, -massKg * 10), new Vec2(Math.min(goatX, 8), feetY), true);
          if (support.y < -0.2) {
            goat.setDynamic();
            goat.setAwake(true);
            goat.setLinearVelocity(new Vec2(WALK_SPEED, -0.4));
            goat.setAngularVelocity(2.6);
            goatDynamic = true;
            mode = "slip";
            failed = true;
            note({ kind: "support", id: support.piece.id, name: support.piece.id });
            if (breakAt == null) {
              breakAt = t;
            }
          } else if (nextX >= 8) {
            mode = "arrived";
          } else {
            mode = "walk";
          }
        } else if (nextX >= 8 && feetY > -0.25) {
          goatX = nextX;
          feetY = 0;
          mode = "arrived";
          goat.setPosition(new Vec2(goatX, 0.45));
        } else {
          goat.setDynamic();
          goat.setAwake(true);
          goat.setLinearVelocity(new Vec2(WALK_SPEED, -0.2));
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
      if (reaction > BREAK_N) {
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

    for (const piece of pieces) {
      const pos = piece.body.getPosition();
      if (pos.y < waterY && !soaked.has(piece.id)) {
        soaked.add(piece.id);
        splashes.push({ x: pos.x, y: waterY });
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

    if (goatDynamic && !climbing) {
      const pos = goat.getPosition();
      goatX = pos.x;
      feetY = pos.y - 0.28;
      const angle = Math.abs(Math.atan2(Math.sin(goat.getAngle()), Math.cos(goat.getAngle())));
      const inWater = feetY < waterY;
      if (inWater && !soaked.has("goat")) {
        soaked.add("goat");
        wetX = goatX;
        splashes.push({ x: goatX, y: waterY });
        splashHold = 0.12;
        goat.setLinearDamping(12);
        goat.setAngularDamping(12);
      }
      if (inWater) {
        sinceWet += TIME_STEP;
      }
      if (sinceWet >= 1.5) {
        climbing = true;
      } else if (splashHold > 0) {
        mode = "splash";
        splashHold -= TIME_STEP;
        feetY = waterY;
        goat.setPosition(new Vec2(goatX, waterY));
        goat.setLinearVelocity(new Vec2(DRIFT, 0));
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
      const bankX = wetX < 4 ? -0.55 : 8.4;
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

    if (step % 2 === 0) {
      capture(t);
    }

    if (failed) {
      sinceFail += TIME_STEP;
    }
    const arrived = mode === "arrived" && goatX >= 8 && feetY > -0.3;
    if (arrived && walkTime > 9) {
      capture(t);
      break;
    }
    if (mode === "glare" && glareTime >= 0.8) {
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
  const ok = !failed && goatX >= 8 && feetY > -0.3;
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
