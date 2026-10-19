import { BoxShape, RevoluteJoint, Vec2, type Body, type Joint, type World } from "planck";
import { createWorld, TIME_STEP } from "../../../engine/physics";
import { kitNode, pieceEnd, queenPost, wreckLines, type KitSlot } from "./kit";

const JOIN_M = 0.15;
const BREAK_N = 400000;
const GOAT_MASS = 40;
const WALK_SPEED = 1;

export type MemberReport = {
  id: string;
  name: string;
  force: number;
  job: string;
};

export type CrossingSample = {
  t: number;
  x: number;
  y: number;
  failed: boolean;
  wet: boolean;
};

export type CrossingResult = {
  ok: boolean;
  goatX: number;
  goatY: number;
  goatInWater: boolean;
  massKg: number;
  loadPercent: number;
  members: MemberReport[];
  wreck: string[];
  samples: CrossingSample[];
  breakAt: number | null;
};

type EndPoint = {
  slotId: string;
  body: Body;
  local: Vec2;
  x: number;
  y: number;
};

function addBeam(world: World, slot: KitSlot, typed: number): { body: Body; ends: EndPoint[] } | null {
  if (!slot.from || !slot.to || slot.kind === "gusset" || slot.kind === "bolt") {
    return null;
  }
  const from = kitNode(slot.from);
  const end = pieceEnd(slot, typed);
  const length = Math.max(0.2, Math.hypot(end.m - from.m, end.h - from.h));
  const angle = Math.atan2(end.h - from.h, end.m - from.m);
  const body = world.createDynamicBody({
    position: new Vec2((from.m + end.m) / 2, (from.h + end.h) / 2),
    angle,
    linearDamping: 0.8,
    angularDamping: 0.9,
    allowSleep: false,
  });
  const thickness = slot.kind === "post" ? 0.16 : 0.1;
  body.createFixture(new BoxShape(length / 2, thickness / 2), { density: 12, friction: 0.9 });
  return {
    body,
    ends: [
      { slotId: slot.id, body, local: new Vec2(-length / 2, 0), x: from.m, y: from.h },
      { slotId: slot.id, body, local: new Vec2(length / 2, 0), x: end.m, y: end.h },
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

export function simulateCrossing(lengths: Record<string, number>, massKg = GOAT_MASS): CrossingResult {
  const world = createWorld(10);
  const banks: { id: string; body: Body; x: number; y: number }[] = [];
  for (const node of [
    { id: "n0", x: 0, y: 0 },
    { id: "n8", x: 8, y: 0 },
  ]) {
    const body = world.createBody({ position: new Vec2(node.x, node.y), type: "static" });
    const groundX = node.x === 0 ? -1.2 : 1.2;
    body.createFixture(new BoxShape(1.2, 0.25), { density: 0, friction: 0.9 });
    body.setPosition(new Vec2(node.x + groundX, -0.25));
    banks.push({ id: node.id, body, x: node.x, y: node.y });
  }

  const ends: EndPoint[] = [];
  const bodies = new Map<string, Body>();
  for (const slot of queenPost.slots) {
    if (!slot.structural || lengths[slot.id] == null) {
      continue;
    }
    const made = addBeam(world, slot, lengths[slot.id]);
    if (!made) {
      continue;
    }
    bodies.set(slot.id, made.body);
    ends.push(...made.ends);
  }

  const joints: { joint: Joint; a: string; b: string }[] = [];
  const paired = new Set<string>();
  for (let i = 0; i < ends.length; i += 1) {
    for (let j = i + 1; j < ends.length; j += 1) {
      if (ends[i].body === ends[j].body) {
        continue;
      }
      const dist = Math.hypot(ends[i].x - ends[j].x, ends[i].y - ends[j].y);
      if (dist > JOIN_M) {
        continue;
      }
      const key = `${i}-${j}`;
      if (paired.has(key)) {
        continue;
      }
      paired.add(key);
      const joint = world.createJoint(
        new RevoluteJoint({
          bodyA: ends[i].body,
          bodyB: ends[j].body,
          localAnchorA: ends[i].local,
          localAnchorB: ends[j].local,
          collideConnected: false,
        }),
      );
      if (joint) {
        joints.push({ joint, a: ends[i].slotId, b: ends[j].slotId });
      }
    }
    for (const bank of banks) {
      const dist = Math.hypot(ends[i].x - bank.x, ends[i].y - bank.y);
      if (dist > JOIN_M) {
        continue;
      }
      const joint = world.createJoint(
        new RevoluteJoint({
          bodyA: bank.body,
          bodyB: ends[i].body,
          localAnchorA: bank.body.getLocalPoint(new Vec2(ends[i].x, ends[i].y)),
          localAnchorB: ends[i].local,
          collideConnected: false,
        }),
      );
      if (joint) {
        joints.push({ joint, a: bank.id, b: ends[i].slotId });
      }
    }
  }

  const top = queenPost.slots.find((slot) => slot.id === "top");
  const topEnd = top && lengths.top != null ? pieceEnd(top, lengths.top) : null;
  const topTarget = kitNode("p6");
  const topReaches = topEnd != null && Math.hypot(topEnd.m - topTarget.m, topEnd.h - topTarget.h) <= JOIN_M;

  const goat = world.createKinematicBody({ position: new Vec2(-0.4, 0.7), allowSleep: false });
  goat.createFixture(new BoxShape(0.22, 0.18), { density: 1, friction: 0.4 });

  const force = new Map<string, number>();
  const samples: CrossingSample[] = [];
  let failed = false;
  let breakAt: number | null = null;
  let goatX = -0.4;
  let goatY = 0.7;
  const released = new Set<Joint>();

  for (let step = 0; step < 720; step += 1) {
    const t = step * TIME_STEP;
    if (!failed) {
      goatX = -0.4 + WALK_SPEED * t;
      goatY = 0.7;
      goat.setPosition(new Vec2(goatX, goatY));
      goat.setLinearVelocity(new Vec2(WALK_SPEED, 0));
      const deck = deckBodyUnder(bodies, goatX);
      if (deck) {
        deck.applyForce(new Vec2(0, -massKg * 10), new Vec2(goatX, 0.05), true);
      }
      for (const item of joints) {
        if (released.has(item.joint)) {
          continue;
        }
        const reaction = item.joint.getReactionForce(1 / TIME_STEP).length();
        force.set(item.a, Math.max(force.get(item.a) ?? 0, reaction));
        force.set(item.b, Math.max(force.get(item.b) ?? 0, reaction));
        const overload = reaction > BREAK_N;
        const openTop = !topReaches && goatX > 4 && item.joint.getAnchorA().x > 3.5;
        if (overload || openTop) {
          world.destroyJoint(item.joint);
          released.add(item.joint);
          if (breakAt == null) {
            breakAt = t;
          }
          failed = true;
        }
      }
      if (!topReaches && goatX > 4) {
        failed = true;
        if (breakAt == null) {
          breakAt = t;
        }
      }
      for (const body of bodies.values()) {
        if (body.getPosition().y < -0.35 && !topReaches) {
          failed = true;
          if (breakAt == null) {
            breakAt = t;
          }
        }
      }
    } else if (goat.isKinematic()) {
      goat.setDynamic();
      goat.setAwake(true);
      goat.setLinearVelocity(new Vec2(0.4, 0));
    }
    world.step(TIME_STEP);
    if (failed) {
      goatX = goat.getPosition().x;
      goatY = goat.getPosition().y;
    }
    if (step % 6 === 0) {
      samples.push({ t, x: goatX, y: goatY, failed, wet: goatY < 0 });
    }
    if (!failed && goatX >= 8.2) {
      break;
    }
    if (failed && goatY < -0.5 && t > (breakAt ?? 0) + 1.2) {
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

  const goatInWater = goat.getPosition().y < 0;
  const ok = !failed && goat.getPosition().x >= 8 && !goatInWater;
  return {
    ok,
    goatX: goat.getPosition().x,
    goatY: goat.getPosition().y,
    goatInWater,
    massKg,
    loadPercent: Math.max(6, Math.min(100, Math.round((massKg / 180) * 100))),
    members: unique,
    wreck: wreckLines(lengths),
    samples,
    breakAt,
  };
}

function deckBodyUnder(bodies: Map<string, Body>, x: number): Body | undefined {
  if (x < 4) {
    return bodies.get("bottom-a") ?? bodies.get("top");
  }
  return bodies.get("bottom-b") ?? bodies.get("bottom-a");
}
