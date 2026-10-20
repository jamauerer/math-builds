import type { LadderItem } from "./generate";
import { ladderStep } from "./steps";
import type { SkillStateName } from "../machines/bridge/kits/skills";
import { formatCount } from "../units";

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
      return `What do you add to ${formatCount(a)} to make 10?`;
    }
    if (c != null) {
      return `${formatCount(a)} and ${formatCount(b)} and ${formatCount(c)} go together. How many is that?`;
    }
    return `${formatCount(a)} and ${formatCount(b)} more. How many is that?`;
  }
  if (step.op === "S") {
    return `Start with ${formatCount(a)}. Take away ${formatCount(b)}. How many left?`;
  }
  if (step.op === "M") {
    return `${formatCount(a)} groups of ${formatCount(b)}. How many is that?`;
  }
  if (step.n === 6) {
    return `Share ${formatCount(a)} into groups of ${formatCount(b)}. How many groups, and how many left?`;
  }
  return `Share ${formatCount(a)} into ${formatCount(b)} equal groups. How many in each?`;
}
