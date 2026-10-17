import { BoxShape, CircleShape, RevoluteJoint, Vec2, WeldJoint, World, type Body, type Joint } from "planck";
import { beamLengthMeters, type BridgeDesign, type DesignBeam } from "./catalog";

const GRAVITY = 10;
const DECK_Y = 5;
const CLIFF_WIDTH = 4;
const TIME_STEP = 1 / 60;
const THICKNESS = 0.28;
const LIMIT_SCALE = 4;
const BEAM_CATEGORY = 0x0002;
const GROUND_CATEGORY = 0x0001;
const REST = 0.4;

export type BridgeStatus = "ready" | "driving" | "crossed" | "collapsed";
export type FailureKind = "weak" | "long" | "fold";
export type BodyRole = "cliff" | "plank" | "truck" | "wheel" | "joint" | "support";

type MemberRef = {
  beamId: string;
  limit: number;
  vertical: boolean;
};

type BodyMeta = {
  role: BodyRole;
  halfWidth: number;
  halfHeight: number;
  radius: number;
  beamId: string;
  name: string;
};

export type DrawBody = {
  role: BodyRole;
  x: number;
  y: number;
  angle: number;
  halfWidth: number;
  halfHeight: number;
  radius: number;
  stress: number;
  broken: boolean;
  name: string;
};

export type BridgeFailure = {
  beamId: string;
  name: string;
  kind: FailureKind;
  text: string;
};

export type BridgeSnapshot = {
  status: BridgeStatus;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  bodies: DrawBody[];
  brokenJoints: number;
  stress: Record<string, number>;
  failure: BridgeFailure | null;
};

export type BridgeSimulation = {
  step: () => void;
  spawnTruck: () => void;
  status: () => BridgeStatus;
  snapshot: () => BridgeSnapshot;
  brokenJoints: () => number;
  failure: () => BridgeFailure | null;
};

export function failureText(name: string, kind: FailureKind): string {
  if (kind === "long") {
    return `${name} was too long for the load. Try adding a support or a triangle.`;
  }
  if (kind === "fold") {
    return "This shape can fold. Add a triangle so it stays stiff.";
  }
  return `${name} was not strong enough for the truck.`;
}

function meta(body: Body): BodyMeta {
  return body.getUserData() as BodyMeta;
}

function nodeKey(x: number, y: number): string {
  return `${Math.round(x * 20)}:${Math.round(y * 20)}`;
}

function hasTriangle(beams: DesignBeam[]): boolean {
  const neighbors = new Map<string, Set<string>>();
  const link = (left: string, right: string) => {
    const list = neighbors.get(left) ?? new Set<string>();
    list.add(right);
    neighbors.set(left, list);
  };
  for (const beam of beams) {
    const start = nodeKey(beam.x0, beam.y0);
    const end = nodeKey(beam.x1, beam.y1);
    link(start, end);
    link(end, start);
  }
  for (const [start, next] of neighbors) {
    for (const mid of next) {
      const far = neighbors.get(mid);
      if (!far) {
        continue;
      }
      for (const last of far) {
        if (last !== start && neighbors.get(last)?.has(start)) {
          return true;
        }
      }
    }
  }
  return false;
}

export function createDesignSimulation(design: BridgeDesign): BridgeSimulation {
  const world = new World({ gravity: new Vec2(0, -GRAVITY) });
  const rightStart = CLIFF_WIDTH + design.gap;
  const worldMaxX = rightStart + CLIFF_WIDTH;
  const leftCliff = addCliff(world, 0, CLIFF_WIDTH);
  const rightCliff = addCliff(world, rightStart, worldMaxX);
  const folded = !hasTriangle(design.beams) && design.beams.some((beam) => beam.y0 !== 0 || beam.y1 !== 0);
  const stiffDeck = design.beams.every((beam) => beam.y0 === 0 && beam.y1 === 0);
  const massScale = design.supports.length > 0 ? 0.05 : 1;
  const limitScale = design.supports.length > 0 ? 1.7 : LIMIT_SCALE;
  const names = new Map(design.beams.map((beam) => [beam.id, beam.name]));
  const lengths = new Map(design.beams.map((beam) => [beam.id, beamLengthMeters(beam)]));
  const stress = new Map<string, number>();
  const broken = new Set<string>();
  const nodes = new Map<string, Body>();

  function anchor(x: number, y: number): Body {
    if (x <= CLIFF_WIDTH + 0.08) {
      return leftCliff;
    }
    if (x >= rightStart - 0.08) {
      return rightCliff;
    }
    const key = nodeKey(x, y);
    const existing = nodes.get(key);
    if (existing) {
      return existing;
    }
    const body = world.createDynamicBody({
      position: new Vec2(x, y),
      linearDamping: 0.6,
      angularDamping: 0.8,
      userData: {
        role: "joint",
        halfWidth: 0,
        halfHeight: 0,
        radius: 0.12,
        beamId: "",
        name: "",
      } satisfies BodyMeta,
    });
    body.createFixture(new CircleShape(0.12), {
      density: 6,
      friction: 0.8,
      filterCategoryBits: 0x0004,
      filterMaskBits: 0,
    });
    nodes.set(key, body);
    return body;
  }

  const deckBeams: Body[] = [];
  for (const beam of design.beams) {
    const onDeck = beam.y0 === 0 && beam.y1 === 0;
    const x0 = CLIFF_WIDTH + beam.x0 - (onDeck && beam.x0 === 0 ? REST : 0);
    const x1 = CLIFF_WIDTH + beam.x1 + (onDeck && beam.x1 === design.gap ? REST : 0);
    const y0 = DECK_Y + beam.y0;
    const y1 = DECK_Y + beam.y1;
    const body = addMember(world, beam, x0, y0, x1, y1, stiffDeck);
    if (onDeck) {
      deckBeams.push(body);
    }
    const beamScale = design.supports.length > 0 ? 4 : limitScale;
    const limit = beam.strengthKg * massScale * GRAVITY * beamScale;
    const memberRef = { beamId: beam.id, limit, vertical: stiffDeck };
    if (design.supports.length === 0) {
      pinMember(world, body, anchor(x0, y0), x0, y0, memberRef, stiffDeck);
      pinMember(world, body, anchor(x1, y1), x1, y1, memberRef, stiffDeck);
    } else if (onDeck) {
      pinMember(world, body, anchor(x0, y0), x0, y0, memberRef, true);
      if (beam.x1 < design.gap - 0.01) {
        pinMember(world, body, anchor(x1, y1), x1, y1, memberRef, true);
      }
    } else {
      pinMember(world, body, anchor(x0, y0), x0, y0, memberRef, false);
      pinMember(world, body, anchor(x1, y1), x1, y1, memberRef, false);
    }
    stress.set(beam.id, 0);
  }

  for (const support of design.supports) {
    const x = CLIFF_WIDTH + support.x;
    const supportBody = addSupport(world, x, support.id);
    const beam = deckBeams.find((body) => {
      const position = body.getPosition();
      const info = meta(body);
      return Math.abs(position.y - (DECK_Y + THICKNESS / 2)) < 0.4 && Math.abs(position.x - x) <= info.halfWidth;
    });
    if (!beam) {
      continue;
    }
    names.set(support.id, "Support post");
    pinMember(
      world,
      beam,
      supportBody,
      x,
      DECK_Y,
      {
        beamId: support.id,
        limit: support.strengthKg * massScale * GRAVITY * limitScale,
        vertical: true,
      },
      true,
    );
    stress.set(support.id, 0);
  }

  let truck: Body | null = null;
  let status: BridgeStatus = "ready";
  let brokenJoints = 0;
  let failure: BridgeFailure | null = null;
  let stuck = 0;

  function noteForce(ref: MemberRef, magnitude: number) {
    const ratio = magnitude / Math.max(ref.limit, 1);
    stress.set(ref.beamId, Math.max(stress.get(ref.beamId) ?? 0, ratio));
  }

  function markBroken(ref: MemberRef) {
    if (broken.has(ref.beamId) || failure) {
      broken.add(ref.beamId);
      return;
    }
    broken.add(ref.beamId);
    const name = names.get(ref.beamId) ?? "This piece";
    const length = lengths.get(ref.beamId) ?? 0;
    const kind: FailureKind = folded ? "fold" : length > design.gap * 0.75 ? "long" : "weak";
    failure = { beamId: ref.beamId, name, kind, text: failureText(name, kind) };
  }

  function refreshStatus() {
    if (status === "collapsed" || status === "crossed") {
      return;
    }
    const fallen = deckBeams.some((beam) => beam.getPosition().y < DECK_Y - 2.2);
    const truckY = truck?.getPosition().y;
    const truckX = truck?.getPosition().x;
    if (fallen || (truckY != null && truckY < DECK_Y - 2.4)) {
      status = "collapsed";
      if (!failure) {
        const weakId = [...stress.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? "";
        const name = names.get(weakId) ?? "This piece";
        const kind: FailureKind = folded ? "fold" : "weak";
        failure = { beamId: weakId, name, kind, text: failureText(name, kind) };
      }
      return;
    }
    if (status === "driving" && truckX != null && truckX > rightStart + 1.3 && (truckY ?? 0) > DECK_Y - 0.2) {
      status = "crossed";
      failure = null;
      return;
    }
    if (status === "driving" && failure && truck && truckX != null && truckX > CLIFF_WIDTH && truckX < rightStart) {
      stuck = Math.abs(truck.getLinearVelocity().x) < 0.25 ? stuck + 1 : 0;
      if (stuck > 90) {
        status = "collapsed";
      }
    }
  }

  for (let index = 0; index < 40; index += 1) {
    settle(world, noteForce, (ref) => {
      brokenJoints += 1;
      markBroken(ref);
    });
    refreshStatus();
  }

  return {
    step() {
      if (status === "crossed" || status === "collapsed") {
        return;
      }
      settle(world, noteForce, (ref) => {
        brokenJoints += 1;
        markBroken(ref);
      });
      if (truck && status === "driving") {
        const speed = truck.getLinearVelocity().x;
        if (speed < 1.6) {
          const push = design.supports.length > 0 ? 12 : 7;
        truck.applyForceToCenter(new Vec2(design.truckKg * massScale * push, 0), true);
        }
      }
      refreshStatus();
    },
    spawnTruck() {
      if (truck || status === "collapsed") {
        return;
      }
      truck = addTruck(world, design.truckKg * massScale);
      status = "driving";
    },
    status: () => status,
    brokenJoints: () => brokenJoints,
    failure: () => failure,
    snapshot: () => ({
      status,
      minX: -0.4,
      maxX: worldMaxX + 0.4,
      minY: -0.4,
      maxY: DECK_Y + Math.max(3.4, design.gap * 0.45),
      brokenJoints,
      stress: Object.fromEntries(stress),
      failure,
      bodies: bodiesOf(world, stress, broken),
    }),
  };
}

function settle(world: World, onForce: (ref: MemberRef, magnitude: number) => void, onBreak: (ref: MemberRef) => void) {
  world.step(TIME_STEP, 8, 3);
  const doomed: { joint: Joint; ref: MemberRef }[] = [];
  for (let joint = world.getJointList(); joint; joint = joint.getNext()) {
    const ref = joint.getUserData() as MemberRef | string | undefined;
    if (!ref || typeof ref === "string" || ref.beamId == null) {
      continue;
    }
    const force = joint.getReactionForce(1 / TIME_STEP);
    const magnitude = ref.vertical ? Math.abs(force.y) : Math.hypot(force.x, force.y);
    onForce(ref, magnitude);
    if (magnitude > ref.limit) {
      doomed.push({ joint, ref });
    }
  }
  for (const item of doomed) {
    world.destroyJoint(item.joint);
    onBreak(item.ref);
  }
}

function addCliff(world: World, x0: number, x1: number): Body {
  const halfWidth = (x1 - x0) / 2;
  const halfHeight = 0.7;
  const body = world.createBody({
    type: "static",
    position: new Vec2((x0 + x1) / 2, DECK_Y - halfHeight),
    userData: {
      role: "cliff",
      halfWidth,
      halfHeight,
      radius: 0,
      beamId: "",
      name: "Cliff",
    } satisfies BodyMeta,
  });
  body.createFixture(new BoxShape(halfWidth, halfHeight), {
    friction: 0.95,
    filterCategoryBits: GROUND_CATEGORY,
    filterMaskBits: 0xffff,
  });
  return body;
}

function addSupport(world: World, x: number, id: string): Body {
  const halfWidth = 0.22;
  const halfHeight = (DECK_Y - 0.3) / 2;
  const body = world.createBody({
    type: "static",
    position: new Vec2(x, 0.3 + halfHeight),
    userData: {
      role: "support",
      halfWidth,
      halfHeight,
      radius: 0,
      beamId: id,
      name: "Support post",
    } satisfies BodyMeta,
  });
  body.createFixture(new BoxShape(halfWidth, halfHeight), {
    friction: 0.9,
    filterCategoryBits: GROUND_CATEGORY,
    filterMaskBits: 0xffff,
  });
  return body;
}

function addMember(world: World, beam: DesignBeam, x0: number, y0: number, x1: number, y1: number, flush: boolean): Body {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const length = Math.max(0.4, Math.hypot(dx, dy));
  const angle = Math.atan2(dy, dx);
  const halfWidth = length / 2;
  const halfHeight = THICKNESS / 2;
  const deck = Math.abs(y1 - y0) < 0.01;
  const seat = deck ? (flush ? -halfHeight : halfHeight) : 0;
  const body = world.createDynamicBody({
    position: new Vec2((x0 + x1) / 2, (y0 + y1) / 2 + seat),
    angle,
    linearDamping: 0.5,
    angularDamping: 0.9,
    userData: {
      role: "plank",
      halfWidth,
      halfHeight,
      radius: 0,
      beamId: beam.id,
      name: beam.name,
    } satisfies BodyMeta,
  });
  body.createFixture(new BoxShape(halfWidth, halfHeight), {
    density: 2.2,
    friction: 0.95,
    filterCategoryBits: BEAM_CATEGORY,
    filterMaskBits: GROUND_CATEGORY,
  });
  return body;
}

function pinMember(world: World, beam: Body, other: Body, x: number, y: number, ref: MemberRef, stiff: boolean) {
  if (beam === other) {
    return;
  }
  const anchor = new Vec2(x, y);
  const localAnchorA = beam.getLocalPoint(anchor);
  const localAnchorB = other.getLocalPoint(anchor);
  if (stiff) {
    world.createJoint(
      new WeldJoint({
        bodyA: beam,
        bodyB: other,
        localAnchorA,
        localAnchorB,
        referenceAngle: other.getAngle() - beam.getAngle(),
        collideConnected: false,
        userData: ref,
      }),
    );
    return;
  }
  world.createJoint(
    new RevoluteJoint({
      bodyA: beam,
      bodyB: other,
      localAnchorA,
      localAnchorB,
      collideConnected: false,
      userData: ref,
    }),
  );
}

function addTruck(world: World, mass: number): Body {
  const halfWidth = 0.72;
  const halfHeight = 0.24;
  const wheelRadius = 0.28;
  const x = 1.6;
  const chassisY = DECK_Y + wheelRadius * 2 + halfHeight + 0.05;
  const chassis = world.createDynamicBody({
    position: new Vec2(x, chassisY),
    bullet: true,
    linearDamping: 0.2,
    angularDamping: 0.4,
    userData: {
      role: "truck",
      halfWidth,
      halfHeight,
      radius: 0,
      beamId: "",
      name: "Truck",
    } satisfies BodyMeta,
  });
  chassis.createFixture(new BoxShape(halfWidth, halfHeight), {
    density: 1,
    friction: 0.6,
    filterCategoryBits: GROUND_CATEGORY,
    filterMaskBits: GROUND_CATEGORY | BEAM_CATEGORY,
  });
  const massData = { mass: 0, center: new Vec2(), I: 0 };
  chassis.getMassData(massData);
  chassis.setMassData({
    mass,
    center: massData.center,
    I: massData.I * (mass / Math.max(massData.mass, 0.001)),
  });
  for (const side of [-0.46, 0.46]) {
    const wheel = world.createDynamicBody({
      position: new Vec2(x + side, DECK_Y + wheelRadius + 0.02),
      userData: {
        role: "wheel",
        halfWidth: 0,
        halfHeight: 0,
        radius: wheelRadius,
        beamId: "",
        name: "Wheel",
      } satisfies BodyMeta,
    });
    wheel.createFixture(new CircleShape(wheelRadius), {
      density: 1.5,
      friction: 1.6,
      filterCategoryBits: GROUND_CATEGORY,
      filterMaskBits: GROUND_CATEGORY | BEAM_CATEGORY,
    });
    world.createJoint(
      new RevoluteJoint({
        bodyA: chassis,
        bodyB: wheel,
        localAnchorA: new Vec2(side, -halfHeight),
        localAnchorB: new Vec2(0, 0),
        enableMotor: true,
        motorSpeed: -8,
        maxMotorTorque: Math.max(40, mass * 0.8),
        collideConnected: false,
        userData: "wheel",
      }),
    );
  }
  return chassis;
}

function bodiesOf(world: World, stress: Map<string, number>, broken: Set<string>): DrawBody[] {
  const bodies: DrawBody[] = [];
  for (let body = world.getBodyList(); body; body = body.getNext()) {
    const info = meta(body);
    const position = body.getPosition();
    bodies.push({
      role: info.role,
      x: position.x,
      y: position.y,
      angle: body.getAngle(),
      halfWidth: info.halfWidth,
      halfHeight: info.halfHeight,
      radius: info.radius,
      stress: stress.get(info.beamId) ?? 0,
      broken: broken.has(info.beamId),
      name: info.name,
    });
  }
  return bodies;
}
