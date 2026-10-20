import { curriculumSkill } from "../skills";
import { ladderStep } from "../ladder/steps";

export type PictureHelp = "fill-box" | "count-tray" | "compare-piles" | "pattern-gap";

const HAND_KEY = "mb-hand-seen";

export function isPreReader(input: { stepId?: string; skillId?: string; level?: number }): boolean {
  const stepId = (input.stepId ?? "").toUpperCase();
  if (/^A[1-4]$/.test(stepId) || /^S[1-4]$/.test(stepId)) {
    return true;
  }
  const skillId = input.skillId ?? "";
  const step = skillId ? ladderStep(skillId) : undefined;
  if (step && ((step.op === "A" && step.n <= 4) || (step.op === "S" && step.n <= 4))) {
    return true;
  }
  const skill = skillId ? curriculumSkill(skillId) : undefined;
  if (skill?.level === 1) {
    return true;
  }
  return input.level === 1;
}

export function pictureHelpFor(input: { stepId?: string; skillId?: string; fact?: { kind: string; draw?: { op: string; a: number; b: number } } }): PictureHelp {
  const skillId = (input.skillId ?? "").toLowerCase();
  const step = (input.stepId ?? ladderStep(skillId)?.id ?? "").toUpperCase();
  const draw = input.fact?.kind === "plain" ? input.fact.draw : undefined;
  if (skillId.includes("pattern") || skillId.includes("sort-size") || skillId.includes("shapes")) {
    return "pattern-gap";
  }
  if (skillId.includes("compare") || skillId.includes("heavier") || skillId.includes("longer")) {
    return "compare-piles";
  }
  if (step.startsWith("S") || draw?.op === "sub" || /\.s[1-4]$/.test(skillId)) {
    return "count-tray";
  }
  if (skillId.includes("to-10") || skillId.includes("numerals")) {
    return "count-tray";
  }
  if (step.startsWith("A") || skillId.includes("adding")) {
    return "fill-box";
  }
  if (draw?.op === "add" && draw.b === 0) {
    return "count-tray";
  }
  return "fill-box";
}

export function silentAction(help: PictureHelp, fallback?: string): "drag-count" | "tap-choice" | "order" {
  if (help === "pattern-gap" && fallback === "order") {
    return "order";
  }
  if (help === "compare-piles" || help === "pattern-gap") {
    return "tap-choice";
  }
  return "drag-count";
}

export function seenHands(): string[] {
  if (typeof localStorage === "undefined") {
    return [];
  }
  try {
    const raw = localStorage.getItem(HAND_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function hasSeenHand(kind: PictureHelp): boolean {
  return seenHands().includes(kind);
}

export function markSeenHand(kind: PictureHelp): void {
  if (typeof localStorage === "undefined") {
    return;
  }
  localStorage.setItem(HAND_KEY, JSON.stringify([...new Set([...seenHands(), kind])]));
}

export function resetHands(): void {
  if (typeof localStorage === "undefined") {
    return;
  }
  localStorage.removeItem(HAND_KEY);
}

export function showHand(kind: PictureHelp, force = false): boolean {
  return force || !hasSeenHand(kind);
}
