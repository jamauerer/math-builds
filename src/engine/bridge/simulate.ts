import { BoxShape, CircleShape, RevoluteJoint, Vec2, WeldJoint, World, type Body, type Joint } from "planck";

const GRAVITY = 10;
const ROAD = 5;
const CLIFF = 3;
const TIME_STEP = 1 / 60;
const BLOCK = 1;
const OVERLAP = 0.12;
const BEAM_CATEGORY = 0x0002;
const GROUND_CATEGORY = 0x0001;

export type BlockPiece = {
  id: string;
  name: string;
  col: number;
  role: "deck" | "pillar";
  strengthKg: number;
};

export type BlockBridge = {
  gap: number;
  carKg: number;
  pieces: BlockPiece[];
};

export type BridgeStatus = "ready" | "driving" | "crossed" | "collapsed";

export type BridgeFailure = {
  blockId: string;
  name: string;
  text: string;
};

export type DrawBody = {
  role: "cliff" | "deck" | "pillar" | "car" | "wheel";
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

export type BridgeSnapshot = {
  status: BridgeStatus;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  failure: BridgeFailure | null;
  bodies: DrawBody[];
};

type MemberRef = { blockId: string; limit: number };
type BodyMeta = {
  role: DrawBody["role"];
  halfWidth: number;
  halfHeight: number;
  radius: number;
  blockId: string;
  name: string;
};

export type BridgeSimulation = {
  step: () => void;
  spawnCar: () => void;
  status: () => BridgeStatus;
  failure: () => BridgeFailure | null;
  snapshot: () => BridgeSnapshot;
};

export function blockFailureText(name: string, role: BlockPiece["role"]): string {
  if (role === "pillar") {
    return `The ${name.toLowerCase()} was too weak for the car. Add another pillar.`;
  }
  return `The ${name.toLowerCase()} was too weak for the car. Add a pillar under it.`;
}

export function createBlockSimulation(design: BlockBridge): BridgeSimulation {
  const massScale = design.carKg > 40 ? 0.05 : 1;
  const limitScale = design.carKg > 40 ? 12 : 4;
  const world = new World({ gravity: new Vec2(0, -GRAVITY) });
  const rightStart = CLIFF + design.gap;
  const worldMaxX = rightStart + CLIFF;
  const leftCliff = addCliff(world, 0, CLIFF);
  const rightCliff = addCliff(world, rightStart, worldMaxX);
  world.createBody({ type: "static", position: new Vec2(worldMaxX / 2, 0.15) }).createFixture(new BoxShape(worldMaxX / 2, 0.15), {
    friction: 0.4,
    filterCategoryBits: GROUND_CATEGORY,
    filterMaskBits: GROUND_CATEGORY,
  });

  const names = new Map<string, string>();
  const roles = new Map<string, BlockPiece["role"]>();
  const stress = new Map<string, number>();
  const broken = new Set<string>();
  const deck = new Map<number, Body>();

  const deckPieces = design.pieces
    .filter((piece) => piece.role === "deck" && piece.col >= 0 && piece.col < design.gap)
    .sort((left, right) => left.col - right.col);
  for (const piece of deckPieces) {
    const body = addDeck(world, piece);
    deck.set(piece.col, body);
    names.set(piece.id, piece.name);
    roles.set(piece.id, "deck");
    stress.set(piece.id, 0);
    const left = deck.get(piece.col - 1);
    if (left) {
      weld(world, left, body, CLIFF + piece.col, ROAD - BLOCK / 2, member(piece, limitScale));
    } else if (piece.col === 0) {
      weld(world, leftCliff, body, CLIFF, ROAD - BLOCK / 2, member(piece, limitScale));
    }
    if (piece.col === design.gap - 1) {
      weld(world, body, rightCliff, rightStart, ROAD - BLOCK / 2, member(piece, limitScale));
    }
  }

  for (const piece of design.pieces) {
    if (piece.role !== "pillar") {
      continue;
    }
    const beam = deck.get(piece.col);
    if (!beam) {
      continue;
    }
    const post = addPillar(world, piece);
    names.set(piece.id, piece.name);
    roles.set(piece.id, "pillar");
    stress.set(piece.id, 0);
    weld(world, beam, post, CLIFF + piece.col + 0.5, ROAD - BLOCK, member(piece, limitScale));
  }

  let car: Body | null = null;
  let status: BridgeStatus = "ready";
  let failure: BridgeFailure | null = null;
  let stuck = 0;

  function markBroken(ref: MemberRef) {
    if (failure) {
      broken.add(ref.blockId);
      return;
    }
    broken.add(ref.blockId);
    const name = names.get(ref.blockId) ?? "block";
    const role = roles.get(ref.blockId) ?? "deck";
    failure = { blockId: ref.blockId, name, text: blockFailureText(name, role) };
  }

  function refreshStatus() {
    if (status === "collapsed" || status === "crossed") {
      return;
    }
    const fallen = [...deck.values()].some((body) => body.getPosition().y < ROAD - 2.2);
    const carY = car?.getPosition().y;
    const carX = car?.getPosition().x;
    if (fallen || (carY != null && carY < ROAD - 1.6)) {
      status = "collapsed";
      if (!failure) {
        failure = {
          blockId: "",
          name: "Gap",
          text: "A block is missing from the gap. Fill every block.",
        };
      }
      return;
    }
    if (status === "driving" && carX != null && carX > rightStart + 1.1 && (carY ?? 0) > ROAD - 0.4) {
      status = "crossed";
      failure = null;
      return;
    }
    if (status === "driving" && failure && car && carX != null && carX > CLIFF && carX < rightStart) {
      stuck = Math.abs(car.getLinearVelocity().x) < 0.25 ? stuck + 1 : 0;
      if (stuck > 90) {
        status = "collapsed";
      }
    }
  }

  for (let index = 0; index < 30; index += 1) {
    settle(world, (ref, magnitude) => {
      stress.set(ref.blockId, Math.max(stress.get(ref.blockId) ?? 0, magnitude / Math.max(ref.limit, 1)));
    }, markBroken);
    refreshStatus();
  }

  return {
    step() {
      if (status === "crossed" || status === "collapsed") {
        return;
      }
      settle(world, (ref, magnitude) => {
        stress.set(ref.blockId, Math.max(stress.get(ref.blockId) ?? 0, magnitude / Math.max(ref.limit, 1)));
      }, markBroken);
      if (car && status === "driving") {
        const speed = car.getLinearVelocity().x;
        if (speed < 1.6) {
          car.applyForceToCenter(new Vec2(design.carKg * massScale * 8, 0), true);
        }
      }
      refreshStatus();
    },
    spawnCar() {
      if (car || status === "collapsed") {
        return;
      }
      car = addCar(world, design.carKg * massScale);
      status = "driving";
    },
    status: () => status,
    failure: () => failure,
    snapshot: () => ({
      status,
      minX: -0.2,
      maxX: worldMaxX + 0.2,
      minY: -0.2,
      maxY: ROAD + 3.2,
      failure,
      bodies: bodiesOf(world, stress, broken),
    }),
  };
}

function member(piece: BlockPiece, limitScale: number): MemberRef {
  return { blockId: piece.id, limit: piece.strengthKg * GRAVITY * limitScale };
}

function settle(
  world: World,
  onForce: (ref: MemberRef, magnitude: number) => void,
  onBreak: (ref: MemberRef) => void,
) {
  world.step(TIME_STEP, 8, 3);
  const doomed: { joint: Joint; ref: MemberRef }[] = [];
  for (let joint = world.getJointList(); joint; joint = joint.getNext()) {
    const ref = joint.getUserData() as MemberRef | string | undefined;
    if (!ref || typeof ref === "string" || ref.blockId == null) {
      continue;
    }
    const force = joint.getReactionForce(1 / TIME_STEP);
    const magnitude = Math.abs(force.y);
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

function addCliff(world: World, x0: number, x1: number) {
  const halfWidth = (x1 - x0) / 2;
  const halfHeight = 2.5;
  const body = world.createBody({
    type: "static",
    position: new Vec2((x0 + x1) / 2, ROAD - halfHeight),
    userData: meta("cliff", halfWidth, halfHeight, 0, "", "Cliff"),
  });
  body.createFixture(new BoxShape(halfWidth, halfHeight), {
    friction: 0.95,
    filterCategoryBits: GROUND_CATEGORY,
    filterMaskBits: 0xffff,
  });
  return body;
}

function addDeck(world: World, piece: BlockPiece): Body {
  const halfWidth = BLOCK / 2 + OVERLAP;
  const halfHeight = BLOCK / 2;
  const body = world.createDynamicBody({
    position: new Vec2(CLIFF + piece.col + 0.5, ROAD - halfHeight),
    linearDamping: 0.4,
    angularDamping: 0.8,
    userData: meta("deck", halfWidth, halfHeight, 0, piece.id, piece.name),
  });
  body.createFixture(new BoxShape(halfWidth, halfHeight), {
    density: 1.4,
    friction: 0.95,
    filterCategoryBits: BEAM_CATEGORY,
    filterMaskBits: GROUND_CATEGORY,
  });
  return body;
}

function addPillar(world: World, piece: BlockPiece): Body {
  const halfWidth = 0.22;
  const top = ROAD - BLOCK;
  const bottom = 0.3;
  const halfHeight = (top - bottom) / 2;
  const body = world.createBody({
    type: "static",
    position: new Vec2(CLIFF + piece.col + 0.5, bottom + halfHeight),
    userData: meta("pillar", halfWidth, halfHeight, 0, piece.id, piece.name),
  });
  body.createFixture(new BoxShape(halfWidth, halfHeight), {
    friction: 0.8,
    filterCategoryBits: GROUND_CATEGORY,
    filterMaskBits: 0,
  });
  return body;
}

function addCar(world: World, mass: number): Body {
  const halfWidth = 0.72;
  const halfHeight = 0.24;
  const wheelRadius = 0.28;
  const x = 1.5;
  const chassis = world.createDynamicBody({
    position: new Vec2(x, ROAD + wheelRadius + halfHeight + 0.04),
    bullet: true,
    linearDamping: 0.15,
    angularDamping: 0.4,
    userData: meta("car", halfWidth, halfHeight, 0, "", "Car"),
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
      position: new Vec2(x + side, ROAD + wheelRadius),
      userData: meta("wheel", 0, 0, wheelRadius, "", "Wheel"),
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

function weld(world: World, a: Body, b: Body, x: number, y: number, ref: MemberRef) {
  if (a === b) {
    return;
  }
  const anchor = new Vec2(x, y);
  world.createJoint(
    new WeldJoint({
      bodyA: a,
      bodyB: b,
      localAnchorA: a.getLocalPoint(anchor),
      localAnchorB: b.getLocalPoint(anchor),
      referenceAngle: b.getAngle() - a.getAngle(),
      collideConnected: false,
      userData: ref,
    }),
  );
}

function meta(
  role: DrawBody["role"],
  halfWidth: number,
  halfHeight: number,
  radius: number,
  blockId: string,
  name: string,
): BodyMeta {
  return { role, halfWidth, halfHeight, radius, blockId, name };
}

function bodiesOf(world: World, stress: Map<string, number>, broken: Set<string>): DrawBody[] {
  const bodies: DrawBody[] = [];
  for (let body = world.getBodyList(); body; body = body.getNext()) {
    const info = body.getUserData() as BodyMeta | undefined;
    if (!info || info.role == null) {
      continue;
    }
    const position = body.getPosition();
    bodies.push({
      role: info.role,
      x: position.x,
      y: position.y,
      angle: body.getAngle(),
      halfWidth: info.halfWidth,
      halfHeight: info.halfHeight,
      radius: info.radius,
      stress: stress.get(info.blockId) ?? 0,
      broken: broken.has(info.blockId),
      name: info.name,
    });
  }
  return bodies;
}
