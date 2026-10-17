import { BoxShape, RevoluteJoint, Vec2, WeldJoint } from "planck";
import type { DesignPart, EngineeringModel, ModelReport } from "../../engine/model";
import { createWorld, stepWorld } from "../../engine/physics";

export const GRAVITY = 10;

export const LEVER_ASSUMPTIONS = [
  {
    text: "A moment is mass times distance from the pivot. Torque in newton-meters uses a gravity of 10, so it is 10 times the kilogram-meter moment.",
  },
  {
    text: "The plank is a rigid body on a revolute joint. Balance means the moments match. The physics angle is compared with that result.",
  },
  {
    text: "Class 1 has the pivot between the load and the effort. Class 2 has the load between the pivot and the effort. Class 3 has the effort between the pivot and the load.",
  },
  {
    text: "Mechanical advantage is the effort arm divided by the load arm. Two levers in a row multiply their advantages. This ignores friction and the plank's own weight.",
  },
];

export function moment(mass: number, distance: number): number {
  return mass * distance;
}

export function torque(mass: number, distance: number): number {
  return mass * GRAVITY * distance;
}

export function effortFor(load: number, loadArm: number, effortArm: number): number {
  return (load * loadArm) / effortArm;
}

function num(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

function mainPart(design: readonly DesignPart[]): DesignPart | undefined {
  return design.find((part) => part.slot === "main");
}

function finish(ok: boolean, partId: string, text: string, numbers: ModelReport["numbers"]): ModelReport {
  return {
    ok,
    failures: ok ? [] : [{ partId, text, followUp: "How could you measure the arms again?" }],
    numbers,
    assumptions: LEVER_ASSUMPTIONS,
  };
}

export const leverModel: EngineeringModel = {
  id: "lever",
  assumptions: LEVER_ASSUMPTIONS,
  evaluate(design, scene) {
    const part = mainPart(design);
    if (!part) {
      return finish(false, "", "The lever has no piece yet.", []);
    }
    const extra = design.find((item) => item.slot === "extra");
    const ask = scene.ask;
    if (ask === 1 || ask === 2) {
      const left = moment(scene.leftMass, scene.leftDistance);
      const rightMass = ask === 2 ? part.spec : scene.rightMass;
      const rightDistance = ask === 1 ? part.spec : scene.rightDistance;
      const right = moment(rightMass, rightDistance);
      const numbers = [
        { label: "Left moment", value: `${num(left)} kg m` },
        { label: "Right moment", value: `${num(right)} kg m` },
        { label: "Left torque", value: `${num(torque(scene.leftMass, scene.leftDistance))} N m` },
        { label: "Right torque", value: `${num(torque(rightMass, rightDistance))} N m` },
      ];
      if (Math.abs(left - right) > 0.001) {
        const side = left > right ? "left" : "right";
        return finish(false, part.id, `The ${side} moment is larger (${num(Math.max(left, right))} against ${num(Math.min(left, right))}).`, numbers);
      }
      return finish(true, part.id, "", numbers);
    }
    const loadArm = scene.loadArm;
    const effortArm = extra?.kind === "arm" ? scene.effortArm + extra.spec : scene.effortArm;
    const single = effortFor(scene.load, loadArm, effortArm);
    const effort = scene.ask === 4 ? effortFor(single, 1, scene.secondMa) : single;
    const numbers = [
      { label: "Mechanical advantage", value: num(scene.load / effort) },
      { label: "Effort", value: `${num(effort)}` },
      { label: "Load", value: num(scene.load) },
    ];
    if (Math.abs(part.spec - effort) > 0.001) {
      return finish(
        false,
        part.id,
        `The effort that balances this load is ${num(effort)}. Yours is ${num(part.spec)}.`,
        numbers,
      );
    }
    return finish(true, part.id, "", numbers);
  },
  settle(design, scene) {
    const part = mainPart(design);
    if (!part) {
      return { ok: false, text: "Drop the piece on the plank." };
    }
    if ((scene.ask === 1 || scene.ask === 2) && part.spec > scene.plank + 0.001) {
      return { ok: false, text: "That load is past the end of the plank, so it slides back to the tray." };
    }
    return { ok: true, text: "" };
  },
  simulate(design, scene) {
    const part = mainPart(design);
    const rightMass = scene.ask === 2 ? (part?.spec ?? scene.rightMass) : scene.rightMass;
    const rightDistance = scene.ask === 1 ? (part?.spec ?? scene.rightDistance) : (scene.rightDistance ?? 1);
    const world = createWorld(GRAVITY);
    const stand = world.createBody({ position: new Vec2(0, 0) });
    const plank = world.createDynamicBody({ position: new Vec2(0, 1), angularDamping: 4, linearDamping: 1 });
    plank.createFixture(new BoxShape(scene.plank / 2, 0.08), { density: 0.05, friction: 0.4 });
    world.createJoint(
      new RevoluteJoint({
        bodyA: stand,
        bodyB: plank,
        localAnchorA: new Vec2(0, 1),
        localAnchorB: new Vec2(0, 0),
        collideConnected: false,
      }),
    );
    const left = world.createDynamicBody({ position: new Vec2(-scene.leftDistance, 1) });
    left.createFixture(new BoxShape(0.15, 0.15), { density: scene.leftMass / 0.09 });
    const right = world.createDynamicBody({ position: new Vec2(rightDistance, 1) });
    right.createFixture(new BoxShape(0.15, 0.15), { density: Math.max(0.2, rightMass) / 0.09 });
    world.createJoint(
      new WeldJoint({
        bodyA: plank,
        bodyB: left,
        localAnchorA: new Vec2(-scene.leftDistance, 0),
        localAnchorB: new Vec2(0, 0),
        collideConnected: false,
      }),
    );
    world.createJoint(
      new WeldJoint({
        bodyA: plank,
        bodyB: right,
        localAnchorA: new Vec2(rightDistance, 0),
        localAnchorB: new Vec2(0, 0),
        collideConnected: false,
      }),
    );
    const frames = [];
    for (let index = 0; index < 40; index += 1) {
      stepWorld(world, 6);
      const at = plank.getPosition();
      frames.push({
        bodies: [
          { id: "stand", x: 0, y: 0.5, angle: 0, w: 0.3, h: 1, fill: "#6b3a1f" },
          { id: "plank", x: at.x, y: at.y, angle: plank.getAngle(), w: scene.plank, h: 0.16, fill: "#c47b3a" },
          { id: "left", x: left.getPosition().x, y: left.getPosition().y, angle: left.getAngle(), w: 0.4, h: 0.4, fill: "#e85d4c" },
          { id: "right", x: right.getPosition().x, y: right.getPosition().y, angle: right.getAngle(), w: 0.4, h: 0.4, fill: "#3d6ea8" },
        ],
      });
    }
    return frames;
  },
};
