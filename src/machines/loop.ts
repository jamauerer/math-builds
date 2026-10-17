import type { DesignPart } from "../engine/model";
import { sameSpec } from "../engine/model";
import type { Challenge, MachineQuestion } from "./types";

export function numbersMatch(given: string, expected: number): boolean {
  const typed = Number(given.trim());
  return Number.isFinite(typed) && Math.abs(typed - expected) < 0.001;
}

/** The part spec is the typed number, whether or not it is right. */
export function specFromAnswer(given: string): number | null {
  const typed = Number(given.trim());
  if (!Number.isFinite(typed)) {
    return null;
  }
  return typed;
}

export function correctAnswers(challenge: Challenge): Record<string, number> {
  const answers: Record<string, number> = {};
  for (const question of challenge.questions) {
    answers[question.id] = question.answer;
  }
  return answers;
}

export function piecesFor(challenge: Challenge, answers: Record<string, number>): DesignPart[] {
  const parts: DesignPart[] = [];
  for (const question of challenge.questions) {
    if (question.kind !== "part" || !question.produces) {
      continue;
    }
    const spec = answers[question.id] ?? question.answer;
    parts.push({ id: question.id, kind: question.produces, spec, slot: "main" });
  }
  if (challenge.spare) {
    const part = challenge.questions.find((question) => question.kind === "part");
    if (part?.produces) {
      parts.push({ id: `${part.id}-spare`, kind: part.produces, spec: part.answer, slot: "main" });
    }
  }
  parts.push({ id: "decoy", kind: challenge.decoy.kind, spec: challenge.decoy.spec, slot: "main" });
  if (challenge.creative) {
    parts.push({
      id: "creative",
      kind: challenge.creative.kind,
      spec: challenge.creative.spec,
      slot: "extra",
    });
  }
  return parts;
}

export function referenceDesign(challenge: Challenge): DesignPart[] {
  return challenge.questions
    .filter((question) => question.kind === "part" && question.produces)
    .map((question) => ({
      id: question.id,
      kind: question.produces as string,
      spec: question.answer,
      slot: "main",
    }));
}

export function wrongDesign(challenge: Challenge): DesignPart[] {
  const part = challenge.questions.find((question) => question.kind === "part");
  return [
    {
      id: part?.id ?? "decoy",
      kind: challenge.decoy.kind,
      spec: challenge.decoy.spec,
      slot: "main",
    },
  ];
}

export function stockAllows(challenge: Challenge): boolean {
  const needed = referenceDesign(challenge);
  const available = piecesFor(challenge, correctAnswers(challenge)).filter((part) => part.slot === "main");
  const left = available.map((part) => ({ ...part }));
  return needed.every((part) => {
    const index = left.findIndex((item) => item.kind === part.kind && sameSpec(item.spec, part.spec));
    if (index < 0) {
      return false;
    }
    left.splice(index, 1);
    return true;
  });
}

export function predictsChecked(questions: readonly MachineQuestion[], attempts: Record<string, boolean>): boolean {
  return questions.filter((question) => question.kind === "predict").every((question) => attempts[question.id] === true);
}

/** A failed test gives every placed part back. Nothing is destroyed. */
export function returnFailed<T>(placed: readonly T[]): { placed: T[]; tray: T[] } {
  return { placed: [], tray: [...placed] };
}

export function craftStars(usedCreative: boolean, passed: boolean): string[] {
  if (!passed) {
    return [];
  }
  return usedCreative ? ["Elegant support"] : ["Fewest parts"];
}
