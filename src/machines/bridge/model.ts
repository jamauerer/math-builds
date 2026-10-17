import { BoxShape, Vec2, WeldJoint } from "planck";
import type { DesignPart, EngineeringModel, ModelReport, SimFrame } from "../../engine/model";
import { createWorld, stepWorld } from "../../engine/physics";

export const BRIDGE_ASSUMPTIONS = [
  {
    text: "Beams are rigid bodies with a bending limit from a simplified formula. Real beams also depend on material and how they are held.",
  },
  {
    text: "Sag uses a center load on a simply supported span: load times span cubed, divided by 4 times stiffness times depth cubed. A pier splits the span. Bending stress is 1.5 times load times span, divided by depth squared. These challenges break the beam when sag passes span divided by 20. A scene can also set a stress limit.",
  },
  {
    text: "A truss panel without a diagonal is treated as a square that folds. A diagonal makes a triangle. Member forces are from one center load.",
  },
  {
    text: "Arch thrust is load times span, divided by 4 times the rise. A flatter arch pushes harder on the abutments.",
  },
  {
    text: "Hanger lengths follow a parabola between the towers. The cable shape is assumed, not solved from stretch.",
  },
];

export function sag(load: number, span: number, depth: number, stiffness: number): number {
  return (load * span ** 3) / (4 * stiffness * depth ** 3);
}

export function sagLimit(span: number): number {
  return span / 20;
}

/** Simplified bending stress for a center load on a rectangular beam of unit width. */
export function beamStress(load: number, span: number, depth: number): number {
  return (1.5 * load * span) / depth ** 2;
}

export function trussForces(load: number, span: number, rise: number): { tie: number; rafter: number } {
  const tie = (load * span) / (4 * rise);
  const rafter = (load / 2) * (Math.hypot(span / 2, rise) / rise);
  return { tie, rafter };
}

export function archThrust(load: number, span: number, rise: number): number {
  return (load * span) / (4 * rise);
}

export function hangerDrop(cableSag: number, span: number, x: number): number {
  return (4 * cableSag * x * (span - x)) / (span * span);
}

function num(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

function unitName(sceneUnit: number): string {
  return sceneUnit === 1 ? "meters" : "blocks";
}

function report(ok: boolean, text: string, partId: string, numbers: ModelReport["numbers"]): ModelReport {
  return {
    ok,
    failures: ok ? [] : [{ partId, text, followUp: "How could you measure the gap again?" }],
    numbers,
    assumptions: BRIDGE_ASSUMPTIONS,
  };
}

function mainPart(design: readonly DesignPart[]): DesignPart | undefined {
  return design.find((part) => part.slot === "main");
}

export const bridgeModel: EngineeringModel = {
  id: "bridge",
  assumptions: BRIDGE_ASSUMPTIONS,
  evaluate(design, scene) {
    const part = mainPart(design);
    const extra = design.find((item) => item.slot === "extra");
    if (!part) {
      return report(false, "The span is empty.", "", []);
    }
    const ask = scene.ask;
    const gap = scene.gap;
    const bearing = scene.bearing ?? 0;
    const load = scene.load;
    const names: ModelReport["numbers"] = [];
    if (ask === 1) {
      const needed = gap + 2 * bearing;
      names.push({ label: "Beam length", value: `${num(part.spec)} ${unitName(scene.unit ?? 0)}` });
      names.push({ label: "Length that reaches", value: `${num(needed)} ${unitName(scene.unit ?? 0)}` });
      if (part.spec + 0.001 < needed) {
        return report(
          false,
          `Your beam is ${num(needed - part.spec)} ${unitName(scene.unit ?? 0)} short of the far edge.`,
          part.id,
          names,
        );
      }
    }
    if (ask === 2) {
      const beams = part.spec + (extra?.kind === "beam" ? extra.spec : 0);
      const capacity = beams * scene.stick;
      names.push({ label: "Beams", value: num(beams) });
      names.push({ label: "They hold", value: num(capacity) });
      names.push({ label: "Load", value: num(load) });
      if (capacity + 0.001 < load) {
        return report(false, `These beams hold ${num(capacity)}. The load is ${num(load)}.`, part.id, names);
      }
    }
    if (ask === 3 || ask === 4) {
      let span = gap;
      if (ask === 4) {
        const at = Math.min(gap, Math.max(0, part.spec));
        span = Math.max(at, gap - at);
        names.push({ label: "Longest open span", value: `${num(span)} meters` });
      }
      const depth = ask === 3 ? part.spec : scene.depth;
      const shared = extra?.kind === "beam" ? load / (1 + extra.spec) : load;
      const bend = sag(shared, span, depth, scene.stiffness);
      const limit = sagLimit(span);
      const stress = beamStress(shared, span, depth);
      names.push({ label: "Sag", value: num(bend) });
      names.push({ label: "Sag limit", value: num(limit) });
      names.push({ label: "Bending stress", value: num(stress) });
      if (scene.stressLimit > 0 && stress > scene.stressLimit + 0.001) {
        return report(
          false,
          `The bending stress is ${num(stress)}. The limit is ${num(scene.stressLimit)}.`,
          part.id,
          names,
        );
      }
      if (bend > limit + 0.0001) {
        return report(
          false,
          `The sag is ${num(bend)}. The limit for this span is ${num(limit)}.`,
          part.id,
          names,
        );
      }
    }
    if (ask === 5) {
      if (part.spec < 1) {
        return report(false, "A square folds. A triangle holds. This panel has no diagonal.", part.id, names);
      }
      const forces = trussForces(load, gap, scene.rise);
      names.push({ label: "Bottom tie (tension)", value: num(forces.tie) });
      names.push({ label: "Rafter (compression)", value: num(-forces.rafter) });
    }
    if (ask === 6) {
      const thrust = archThrust(load, gap, part.spec);
      names.push({ label: "Rise", value: `${num(part.spec)} meters` });
      names.push({ label: "Thrust", value: num(thrust) });
      names.push({ label: "Abutment holds", value: num(scene.abutment) });
      if (thrust > scene.abutment + 0.001) {
        return report(
          false,
          `The thrust is ${num(thrust)}. The abutment holds ${num(scene.abutment)}.`,
          part.id,
          names,
        );
      }
    }
    if (ask === 7) {
      const expected = hangerDrop(scene.sag, gap, scene.hang);
      names.push({ label: "Hanger from the cable", value: num(expected) });
      names.push({ label: "Hanger you cut", value: num(part.spec) });
      const miss = part.spec - expected;
      if (Math.abs(miss) > 0.05) {
        const word = miss > 0 ? "long" : "short";
        return report(false, `This hanger is ${num(Math.abs(miss))} too ${word}.`, part.id, names);
      }
    }
    if (extra) {
      names.push({ label: "Creative piece", value: `${extra.kind} ${num(extra.spec)}` });
    }
    return report(true, "", part.id, names);
  },
  settle(design, scene) {
    const part = mainPart(design);
    if (!part) {
      return { ok: false, text: "Drop a piece on the span." };
    }
    if (scene.ask === 1) {
      const needed = scene.gap + 2 * (scene.bearing ?? 0);
      if (part.spec + 0.001 < needed) {
        return { ok: false, text: "That beam does not reach the land, so it falls back to the tray." };
      }
    }
    return { ok: true, text: "" };
  },
  simulate(design, scene) {
    const part = mainPart(design);
    const length = scene.ask === 1 ? (part?.spec ?? 1) : scene.gap;
    const reaches = length + 0.001 >= scene.gap + 2 * (scene.bearing ?? 0);
    const world = createWorld();
    const ground = world.createBody();
    ground.createFixture(new BoxShape(30, 0.2, new Vec2(scene.gap / 2, -0.2)));
    const left = world.createBody({ position: new Vec2(-0.8, 1) });
    left.createFixture(new BoxShape(0.8, 1));
    const right = world.createBody({ position: new Vec2(scene.gap + 0.8, 1) });
    right.createFixture(new BoxShape(0.8, 1));
    const beam = world.createDynamicBody({ position: new Vec2(scene.gap / 2, 2.3) });
    beam.createFixture(new BoxShape(Math.max(length, 0.4) / 2, 0.2), { density: 1, friction: 0.8 });
    if (reaches) {
      world.createJoint(
        new WeldJoint({
          bodyA: left,
          bodyB: beam,
          localAnchorA: new Vec2(0.8, 1),
          localAnchorB: new Vec2(-length / 2, 0),
          collideConnected: false,
        }),
      );
      world.createJoint(
        new WeldJoint({
          bodyA: right,
          bodyB: beam,
          localAnchorA: new Vec2(-0.8, 1),
          localAnchorB: new Vec2(length / 2, 0),
          collideConnected: false,
        }),
      );
    }
    const frames: SimFrame[] = [];
    for (let index = 0; index < 24; index += 1) {
      stepWorld(world, 4);
      const at = beam.getPosition();
      frames.push({
        bodies: [
          { id: "left", x: -0.8, y: 1, angle: 0, w: 1.6, h: 2, fill: "#6b3a1f" },
          { id: "right", x: scene.gap + 0.8, y: 1, angle: 0, w: 1.6, h: 2, fill: "#6b3a1f" },
          { id: "beam", x: at.x, y: at.y, angle: beam.getAngle(), w: length, h: 0.4, fill: "#c47b3a" },
          { id: "water", x: scene.gap / 2, y: -0.2, angle: 0, w: scene.gap, h: 0.4, fill: "#3ec6e0" },
        ],
      });
    }
    return frames;
  },
};
