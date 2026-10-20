import type { LadderItem } from "./generate";
import { ladderStep } from "./steps";
import type { SkillStateName } from "../machines/bridge/kits/skills";

export function wordAllowed(state: SkillStateName | undefined): boolean {
  return state === "practicing" || state === "fluent" || state === "mastered";
}

export function wordPrompt(item: LadderItem): string {
  const [a, b, c] = item.operands;
  const step = ladderStep(item.stepId);
  if (!step) {
    return item.prompt;
  }
  if (step.op === "A") {
    if (step.n === 4) {
      return `What do you add to ${a} to make 10?`;
    }
    if (c != null) {
      return `${a} and ${b} and ${c} go together. How many is that?`;
    }
    return `${a} and ${b} more. How many is that?`;
  }
  if (step.op === "S") {
    return `Start with ${a}. Take away ${b}. How many left?`;
  }
  if (step.op === "M") {
    return `${a} groups of ${b}. How many is that?`;
  }
  if (step.n === 6) {
    return `Share ${a} into groups of ${b}. How many groups, and how many left?`;
  }
  return `Share ${a} into ${b} equal groups. How many in each?`;
}
