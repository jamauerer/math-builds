import { BoxShape, Vec2, World, type Body } from "planck";

export const TIME_STEP = 1 / 60;

export function createWorld(gravity = 10): World {
  return new World({ gravity: new Vec2(0, -gravity) });
}

export function stepWorld(world: World, steps: number): void {
  for (let index = 0; index < steps; index += 1) {
    world.step(TIME_STEP);
  }
}

export function bodySpeed(body: Body): number {
  return body.getLinearVelocity().length() + Math.abs(body.getAngularVelocity());
}

/** True when every body is nearly still. */
export function isSettled(world: World, limit = 0.08): boolean {
  for (let body = world.getBodyList(); body; body = body.getNext()) {
    if (body.isStatic()) {
      continue;
    }
    if (bodySpeed(body) > limit) {
      return false;
    }
  }
  return true;
}

export function runUntilSettled(world: World, maxSteps = 240): { steps: number; settled: boolean } {
  for (let index = 0; index < maxSteps; index += 1) {
    world.step(TIME_STEP);
    if (index > 20 && isSettled(world)) {
      return { steps: index + 1, settled: true };
    }
  }
  return { steps: maxSteps, settled: isSettled(world) };
}

/** A box dropped onto a static floor comes to rest on it. */
export function dropOntoFloor(): { settled: boolean; y: number } {
  const world = createWorld();
  const floor = world.createBody();
  floor.createFixture(new BoxShape(4, 0.2), { density: 0 });
  const box = world.createDynamicBody({ position: new Vec2(0, 2) });
  box.createFixture(new BoxShape(0.3, 0.3), { density: 1, friction: 0.6 });
  const result = runUntilSettled(world);
  return { settled: result.settled, y: box.getPosition().y };
}
