import { CircleShape, GearJoint, RevoluteJoint, Vec2 } from "planck";
import type { DesignPart, EngineeringModel, ModelReport } from "../../engine/model";
import { createWorld, stepWorld } from "../../engine/physics";

export const GEAR_ASSUMPTIONS = [
  {
    text: "Gear radius is tooth count times the module, divided by 2. Teeth mesh when the center distance equals the two radii. Tooth-on-tooth collision is not simulated.",
  },
  {
    text: "Speed ratio of one mesh is driving teeth divided by driven teeth. Compound stages multiply. An idler changes direction and not the ratio.",
  },
  {
    text: "Direction reverses at every mesh. Torque goes up as speed goes down, with no friction loss in this model.",
  },
  {
    text: "A winch drum lifts the bucket by its circumference divided by the gear-down ratio. The crank force is the load divided by that ratio. The model is ideal: no friction.",
  },
];

export function bucketRise(circumference: number, ratio: number): number {
  return circumference / ratio;
}

export function crankForce(load: number, ratio: number): number {
  return load / ratio;
}

export function gearRadius(teeth: number): number {
  return teeth / 2;
}

export function meshes(teethA: number, teethB: number, distance: number): boolean {
  return Math.abs(distance - (gearRadius(teethA) + gearRadius(teethB))) <= 0.05;
}

export function speedRatio(driver: number, driven: number): number {
  return driver / driven;
}

export function directionSign(meshCount: number): number {
  return meshCount % 2 === 0 ? 1 : -1;
}

export function compoundRatio(stages: readonly { driver: number; driven: number }[]): number {
  return stages.reduce((ratio, stage) => ratio * speedRatio(stage.driver, stage.driven), 1);
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
    failures: ok ? [] : [{ partId, text, followUp: "How could you count the teeth again?" }],
    numbers,
    assumptions: GEAR_ASSUMPTIONS,
  };
}

export const gearModel: EngineeringModel = {
  id: "gears",
  assumptions: GEAR_ASSUMPTIONS,
  evaluate(design, scene) {
    const part = mainPart(design);
    if (!part) {
      return finish(false, "", "No gear is on the board.", []);
    }
    const extra = design.find((item) => item.slot === "extra");
    const ask = scene.ask;
    if (ask === 2) {
      const meshesUsed = part.spec + 1 + (extra?.kind === "idler" ? extra.spec : 0);
      const sign = directionSign(meshesUsed);
      const numbers = [
        { label: "Meshes", value: num(meshesUsed) },
        { label: "Direction", value: sign === 1 ? "same way" : "opposite way" },
      ];
      const want = scene.same;
      if ((sign === 1 ? 1 : 0) !== want) {
        return finish(
          false,
          part.id,
          sign === 1
            ? "The output turns the same way as the crank. This challenge needs the opposite way."
            : "The output turns the opposite way. Add an idler if you need the same way.",
          numbers,
        );
      }
      return finish(true, part.id, "", numbers);
    }
    if (ask === 3) {
      const slower = scene.driven / scene.driver;
      const torque = scene.torqueIn * slower;
      const numbers = [
        { label: "Times slower", value: num(slower) },
        { label: "Output torque", value: num(torque) },
      ];
      if (scene.drum > 0 && scene.driver > 0) {
        const slower = scene.driven / scene.driver;
        numbers.push({ label: "Bucket height per crank", value: `${num(bucketRise(scene.drum, slower))} m` });
        numbers.push({ label: "Crank force", value: num(crankForce(scene.load, slower)) });
      }
      if (Math.abs(part.spec - torque) > 0.001) {
        return finish(false, part.id, `The output torque is ${num(torque)}. Yours is ${num(part.spec)}.`, numbers);
      }
      return finish(true, part.id, "", numbers);
    }
    const driven = part.spec;
    const mate = scene.mate > 0 ? scene.mate : scene.driver;
    const fit = meshes(mate, driven, scene.distance);
    const stages =
      scene.driver2 > 0
        ? [
            { driver: scene.driver, driven: scene.mid },
            { driver: scene.driver2, driven },
          ]
        : [{ driver: scene.driver, driven }];
    const ratio = compoundRatio(stages);
    const numbers = [
      { label: "Output turns per input turn", value: num(ratio) },
      { label: "Times slower", value: num(1 / ratio) },
      { label: "Direction", value: directionSign(stages.length + (extra?.kind === "idler" ? 1 : 0)) === 1 ? "same way" : "opposite way" },
    ];
    if (!fit) {
      return finish(
        false,
        part.id,
        `These teeth do not meet. The centers are ${num(scene.distance)} and the radii add to ${num(gearRadius(mate) + gearRadius(driven))}.`,
        numbers,
      );
    }
    if (scene.goal > 0 && Math.abs(ratio - scene.goal) > 0.001) {
      return finish(false, part.id, `The output turns ${num(ratio)} times for each input turn. This challenge needs ${num(scene.goal)}.`, numbers);
    }
    if (scene.drum > 0 && ratio > 0) {
      const slower = 1 / ratio;
      numbers.push({ label: "Bucket height per crank", value: `${num(bucketRise(scene.drum, slower))} m` });
      numbers.push({ label: "Crank force", value: num(crankForce(scene.load, slower)) });
    }
    if (scene.hourDriver > 0 && scene.hourDriven > 0) {
      const hour = speedRatio(scene.hourDriver, scene.hourDriven);
      numbers.push({ label: "Minute train", value: num(1 / ratio) });
      numbers.push({ label: "Hour hand turns per minute turn", value: num(hour) });
      if (Math.abs(hour - 1 / 12) > 0.001) {
        return finish(false, part.id, `The hour hand turns ${num(hour)} times per minute-hand turn. It needs 12 to 1.`, numbers);
      }
    }
    return finish(true, part.id, "", numbers);
  },
  settle(design, scene) {
    const part = mainPart(design);
    if (!part) {
      return { ok: false, text: "Drop a gear on an axle." };
    }
    const mate = scene.mate > 0 ? scene.mate : scene.driver;
    if (scene.ask === 1 && !meshes(mate, part.spec, scene.distance)) {
      return { ok: false, text: "Those teeth do not meet, so the gear goes back to the tray." };
    }
    return { ok: true, text: "" };
  },
  simulate(design, scene) {
    const driven = scene.ask === 1 ? (design.find((part) => part.slot === "main")?.spec ?? scene.driven) : scene.driven;
    const driverTeeth = scene.driver || 12;
    const drivenTeeth = driven || driverTeeth;
    const world = createWorld(0);
    const board = world.createBody();
    const driver = world.createDynamicBody({ position: new Vec2(0, 0) });
    driver.createFixture(new CircleShape(gearRadius(driverTeeth) * 0.05), { density: 1 });
    const follower = world.createDynamicBody({ position: new Vec2(2, 0) });
    follower.createFixture(new CircleShape(gearRadius(drivenTeeth) * 0.05), { density: 1 });
    const jointA = world.createJoint(
      new RevoluteJoint({
        bodyA: board,
        bodyB: driver,
        localAnchorA: new Vec2(0, 0),
        localAnchorB: new Vec2(0, 0),
        enableMotor: true,
        motorSpeed: 2,
        maxMotorTorque: 40,
        collideConnected: false,
      }),
    );
    const jointB = world.createJoint(
      new RevoluteJoint({
        bodyA: board,
        bodyB: follower,
        localAnchorA: new Vec2(2, 0),
        localAnchorB: new Vec2(0, 0),
        collideConnected: false,
      }),
    );
    world.createJoint(
      new GearJoint({
        bodyA: driver,
        bodyB: follower,
        joint1: jointA as RevoluteJoint,
        joint2: jointB as RevoluteJoint,
        ratio: drivenTeeth / driverTeeth,
      }),
    );
    const frames = [];
    for (let index = 0; index < 16; index += 1) {
      stepWorld(world, 4);
      const bodies = [
        { id: "driver", x: 0, y: 0, angle: driver.getAngle(), w: gearRadius(driverTeeth), h: gearRadius(driverTeeth), fill: "#e85d4c" },
        { id: "driven", x: 2, y: 0, angle: follower.getAngle(), w: gearRadius(drivenTeeth), h: gearRadius(drivenTeeth), fill: "#3d6ea8" },
      ];
      if (scene.hourDriven > 0) {
        bodies.push({
          id: "hour",
          x: 4,
          y: 0,
          angle: follower.getAngle() * (scene.hourDriver / scene.hourDriven),
          w: 1,
          h: 1,
          fill: "#f0d090",
        });
      }
      frames.push({ bodies });
    }
    return frames;
  },
};
