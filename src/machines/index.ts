import { bridgeModel } from "./bridge/model";
import { bridgeMachine } from "./bridge/definition";
import { gearModel } from "./gears/model";
import { gearMachine } from "./gears/definition";
import { leverModel } from "./lever/model";
import { leverMachine } from "./lever/definition";
import type { EngineeringModel } from "../engine/model";
import type { MachineDefinition } from "./types";

export const machines: MachineDefinition[] = [bridgeMachine, leverMachine, gearMachine];

export const models: Record<string, EngineeringModel> = {
  bridge: bridgeModel,
  lever: leverModel,
  gears: gearModel,
};

export function machineById(id: string): MachineDefinition {
  const found = machines.find((machine) => machine.id === id);
  if (!found) {
    throw new Error(`Unknown machine ${id}`);
  }
  return found;
}
