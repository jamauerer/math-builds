import {
  BoxShape,
  CircleShape,
  RevoluteJoint,
  Vec2,
  World,
  type Body,
  type Joint,
} from "planck";

/** Newtons. Joints over this force snap. */
export const JOINT_BREAK_FORCE = 2600;

/** Kilograms. This is the truck chassis mass. */
export const TRUCK_MASS = 38;

const TIME_STEP = 1 / 60;
const DECK_Y = 5;
const GRAVITY = 10;
const PLANK_THICKNESS = 0.22;
const CLIFF_WIDTH = 4;

export type BridgePreset = "holds" | "collapses";
export type BridgeStatus = "ready" | "driving" | "crossed" | "collapsed";

type Role = "cliff" | "plank" | "truck" | "wheel";

type BodyMeta = {
  role: Role;
  halfWidth: number;
  halfHeight: number;
  radius: number;
};

export type DrawBody = {
  role: Role;
  x: number;
  y: number;
  angle: number;
  halfWidth: number;
  halfHeight: number;
  radius: number;
};

export type BridgeSnapshot = {
  status: BridgeStatus;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  bodies: DrawBody[];
  brokenJoints: number;
};

type PresetSpec = {
  gap: number;
  planks: number;
};

const PRESETS: Record<BridgePreset, PresetSpec> = {
  holds: { gap: 3.4, planks: 4 },
  collapses: { gap: 8.2, planks: 3 },
};

function meta(body: Body): BodyMeta {
  return body.getUserData() as BodyMeta;
}

export type BridgeSimulation = {
  step: () => void;
  spawnTruck: () => void;
  status: () => BridgeStatus;
  snapshot: () => BridgeSnapshot;
  brokenJoints: () => number;
};

export function createBridgeSimulation(preset: BridgePreset): BridgeSimulation {
  const spec = PRESETS[preset];
  const world = new World({ gravity: new Vec2(0, -GRAVITY) });
  const rightCliffStart = CLIFF_WIDTH + spec.gap;
  const worldMaxX = rightCliffStart + CLIFF_WIDTH;

  const leftCliff = addCliff(world, 0, CLIFF_WIDTH);
  const rightCliff = addCliff(world, rightCliffStart, worldMaxX);
    const planks = addDeck(world, spec, leftCliff, rightCliff, rightCliffStart);
    if (preset === "holds") {
      addPier(world, CLIFF_WIDTH + spec.gap / 2);
    }

  let truck: Body | null = null;
  let status: BridgeStatus = "ready";
  let brokenJoints = 0;

  for (let index = 0; index < 30; index += 1) {
    settle(world, () => {
      brokenJoints += 1;
    });
  }

  function refreshStatus() {
    if (status === "collapsed" || status === "crossed") {
      return;
    }
    const fallen = planks.some((plank) => plank.getPosition().y < DECK_Y - 1.2);
    const truckY = truck?.getPosition().y;
    const truckX = truck?.getPosition().x;
    if (fallen || (truckY != null && truckY < DECK_Y - 1.1)) {
      status = "collapsed";
      return;
    }
    if (status === "driving" && truckX != null && truckX > rightCliffStart + 1.2 && (truckY ?? 0) > DECK_Y) {
      status = "crossed";
    }
  }

  return {
    step() {
      if (status === "crossed" || status === "collapsed") {
        return;
      }
      settle(world, () => {
        brokenJoints += 1;
      });
      refreshStatus();
    },
    spawnTruck() {
      if (truck || status === "collapsed") {
        return;
      }
      truck = addTruck(world);
      status = "driving";
    },
    status: () => status,
    brokenJoints: () => brokenJoints,
    snapshot: () => ({
      status,
      minX: -0.4,
      maxX: worldMaxX + 0.4,
      minY: -1,
      maxY: 9,
      brokenJoints,
      bodies: bodiesOf(world),
    }),
  };
}

function settle(world: World, onBreak: () => void) {
  world.step(TIME_STEP, 8, 3);
  const doomed: Joint[] = [];
  for (let joint = world.getJointList(); joint; joint = joint.getNext()) {
    if (joint.getUserData() !== "bridge") {
      continue;
    }
    const force = joint.getReactionForce(1 / TIME_STEP);
    const magnitude = Math.hypot(force.x, force.y);
    if (magnitude > JOINT_BREAK_FORCE) {
      doomed.push(joint);
    }
  }
  for (const joint of doomed) {
    world.destroyJoint(joint);
    onBreak();
  }
}

function addPier(world: World, centerX: number) {
  const halfWidth = 0.35;
  const halfHeight = 0.55;
  const body = world.createBody({
    type: "static",
    position: new Vec2(centerX, DECK_Y - halfHeight),
    userData: { role: "cliff", halfWidth, halfHeight, radius: 0 } satisfies BodyMeta,
  });
  body.createFixture(new BoxShape(halfWidth, halfHeight), { friction: 0.95 });
  return body;
}

function addCliff(world: World, x0: number, x1: number): Body {
  const halfWidth = (x1 - x0) / 2;
  const halfHeight = 0.55;
  const body = world.createBody({
    type: "static",
    position: new Vec2((x0 + x1) / 2, DECK_Y - halfHeight),
    userData: { role: "cliff", halfWidth, halfHeight, radius: 0 } satisfies BodyMeta,
  });
  body.createFixture(new BoxShape(halfWidth, halfHeight), { friction: 0.95 });
  return body;
}

function addDeck(
  world: World,
  spec: PresetSpec,
  leftCliff: Body,
  rightCliff: Body,
  rightCliffStart: number,
): Body[] {
  const halfThickness = PLANK_THICKNESS / 2;
  const start = CLIFF_WIDTH - 0.55;
  const end = rightCliffStart + 0.55;
  const span = end - start;
  const overlap = 0.28;
  const length = (span + overlap * (spec.planks - 1)) / spec.planks;
  const step = spec.planks === 1 ? 0 : (span - length) / (spec.planks - 1);
  const planks: Body[] = [];
  const centers: number[] = [];

  for (let index = 0; index < spec.planks; index += 1) {
    const center = start + length / 2 + index * step;
    centers.push(center);
    const halfWidth = length / 2;
    const body = world.createDynamicBody({
      position: new Vec2(center, DECK_Y + halfThickness),
      linearDamping: 0.4,
      angularDamping: 0.8,
      userData: { role: "plank", halfWidth, halfHeight: halfThickness, radius: 0 } satisfies BodyMeta,
    });
    body.createFixture(new BoxShape(halfWidth, halfThickness), { density: 1.4, friction: 0.9 });
    planks.push(body);
  }

  pin(world, leftCliff, planks[0], start, DECK_Y + halfThickness);
  for (let index = 0; index < planks.length - 1; index += 1) {
    const jointX = (centers[index] + length / 2 + centers[index + 1] - length / 2) / 2;
    pin(world, planks[index], planks[index + 1], jointX, DECK_Y + halfThickness);
  }
  pin(world, planks[planks.length - 1], rightCliff, end, DECK_Y + halfThickness);
  return planks;
}

function pin(world: World, bodyA: Body, bodyB: Body, worldX: number, worldY: number) {
  const anchor = new Vec2(worldX, worldY);
  world.createJoint(
    new RevoluteJoint({
      bodyA,
      bodyB,
      localAnchorA: bodyA.getLocalPoint(anchor),
      localAnchorB: bodyB.getLocalPoint(anchor),
      collideConnected: false,
      userData: "bridge",
    }),
  );
}

function addTruck(world: World): Body {
  const halfWidth = 0.72;
  const halfHeight = 0.24;
  const wheelRadius = 0.28;
  const x = 1.7;
  const chassisY = DECK_Y + wheelRadius * 2 + halfHeight + 0.08;
  const chassis = world.createDynamicBody({
    position: new Vec2(x, chassisY),
    linearDamping: 0.05,
    angularDamping: 0.2,
    userData: { role: "truck", halfWidth, halfHeight, radius: 0 } satisfies BodyMeta,
  });
  chassis.createFixture(new BoxShape(halfWidth, halfHeight), { density: 1, friction: 0.5 });
  const massData = { mass: 0, center: new Vec2(), I: 0 };
  chassis.getMassData(massData);
  chassis.setMassData({
    mass: TRUCK_MASS,
    center: massData.center,
    I: massData.I * (TRUCK_MASS / Math.max(massData.mass, 0.001)),
  });

  for (const side of [-0.48, 0.48]) {
    const wheel = world.createDynamicBody({
      position: new Vec2(x + side, DECK_Y + wheelRadius + 0.02),
      userData: { role: "wheel", halfWidth: 0, halfHeight: 0, radius: wheelRadius } satisfies BodyMeta,
    });
    wheel.createFixture(new CircleShape(wheelRadius), { density: 1.2, friction: 1.4 });
    world.createJoint(
      new RevoluteJoint({
        bodyA: chassis,
        bodyB: wheel,
        localAnchorA: new Vec2(side, -halfHeight * 0.2),
        localAnchorB: new Vec2(0, 0),
        enableMotor: true,
        motorSpeed: -14,
        maxMotorTorque: 90,
        collideConnected: false,
        userData: "wheel",
      }),
    );
  }
  return chassis;
}

function bodiesOf(world: World): DrawBody[] {
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
    });
  }
  return bodies;
}
