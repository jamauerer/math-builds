import type { Challenge } from "../machines/types";
import type { MasteryRecord } from "../curriculum/mastery";

export type StarName = "Fewest parts" | "Under budget" | "Elegant support" | "Right predict";

export function awardStars(input: {
  passed: boolean;
  usedExtra: boolean;
  predictRight: boolean;
  spec: number;
  answer: number;
}): StarName[] {
  if (!input.passed) {
    return [];
  }
  const stars: StarName[] = [];
  stars.push(input.usedExtra ? "Elegant support" : "Fewest parts");
  if (Math.abs(input.spec - input.answer) < 0.001) {
    stars.push("Under budget");
  }
  if (input.predictRight) {
    stars.push("Right predict");
  }
  return stars;
}

export function successPlate(
  machine: string,
  scene: Record<string, number>,
  numbers: readonly { label: string; value: string }[],
): string {
  const load = scene.load > 0 ? scene.load : 20;
  if (machine === "gears") {
    const force = numbers.find((item) => item.label === "Crank force");
    if (force) {
      return `Your winch lifted ${load} kg with a ${force.value} kg push.`;
    }
    const turns = numbers.find((item) => item.label === "Output turns per input turn");
    return turns ? `Your gears turned the job at ${turns.value} output turns per crank.` : "Your gears did the job.";
  }
  if (machine === "bridge") {
    const sag = numbers.find((item) => item.label === "Sag");
    if (sag) {
      return `Your bridge held ${load} kg with ${sag.value} of sag.`;
    }
    return `Your bridge held ${load} kg.`;
  }
  const moment = numbers.find((item) => item.label === "Left moment");
  return moment ? `Your lever balanced ${moment.value}.` : "Your lever did the job.";
}

export function failureLine(text: string): string {
  const sentence = text.split(".").filter((part) => part.trim().length > 0)[0] ?? "The build did not hold.";
  return `${sentence.trim()}.`;
}

export type CameraFrame = { x: number; scale: number; caption: string };

/** Small pan so the moving job stays in view. Pull back on the result. */
export function cameraFrame(sceneId: string, progress: number, moment: "play" | "slow" | "hold" | "result"): CameraFrame {
  if (moment === "result") {
    return { x: 0, scale: 0.94, caption: "The whole build" };
  }
  const follow = sceneId.startsWith("winch") || sceneId.startsWith("hoist") || sceneId === "crane-hoist" ? 18 : 28;
  const x = (0.5 - progress) * follow;
  if (moment === "slow") {
    return { x, scale: 1.12, caption: "Slow motion" };
  }
  if (moment === "hold") {
    return { x: 0, scale: 1, caption: "Holding the last frame." };
  }
  return { x, scale: 1.04, caption: "Watch the test." };
}

export function xpFor(record: MasteryRecord): number {
  let xp = 0;
  if (record.challengeDone) {
    xp += 10;
  }
  if (record.transferPassed) {
    xp += 25;
  }
  if (record.recallPassed) {
    xp += 50;
  }
  return xp;
}

export function rankFor(completed: number): { name: string; because: string } {
  if (completed >= 20) {
    return { name: "Master Builder", because: "20 finished builds on this machine" };
  }
  if (completed >= 13) {
    return { name: "Engineer", because: "13 finished builds on this machine" };
  }
  if (completed >= 6) {
    return { name: "Builder", because: "6 finished builds on this machine" };
  }
  if (completed >= 1) {
    return { name: "Apprentice", because: "the first finished build" };
  }
  return { name: "Apprentice", because: "finish one build to earn it" };
}

export type Feat = { id: string; title: string };

export function featBadges(challenge: Pick<Challenge, "machine" | "family" | "scene">, passed: boolean, stars: readonly string[]): Feat[] {
  if (!passed) {
    return [];
  }
  const feats: Feat[] = [];
  if (challenge.scene.ask === 5) {
    feats.push({ id: "first-truss", title: "First truss that holds" });
  }
  if (challenge.machine === "gears" && Math.abs((challenge.scene.goal || 0) - 1 / 12) < 0.02) {
    feats.push({ id: "train-12", title: "A 12:1 train" });
  }
  if (challenge.family === "Three loads") {
    feats.push({ id: "three-loads", title: "Balance with three loads" });
  }
  if (stars.includes("Under budget")) {
    feats.push({ id: "under-budget", title: "Under budget" });
  }
  return feats;
}

export function weeklyId(ids: readonly string[], now: number): string {
  const list = ids.filter((id) => id.includes("-l"));
  const pool = list.length > 0 ? list : [...ids];
  const week = Math.floor(now / (7 * 24 * 60 * 60 * 1000));
  return pool[Math.abs(week) % pool.length] ?? pool[0];
}

export type Prize = { id: string; kind: "finish" | "background" | "skin" | "decoration"; title: string; needs: string };

export const PRIZES: readonly Prize[] = [
  { id: "enamel-shine", kind: "finish", title: "Enamel shine", needs: "rank:Builder" },
  { id: "night-paper", kind: "background", title: "Night paper", needs: "badge:first-truss" },
  { id: "red-wagon", kind: "skin", title: "Red wagon", needs: "rank:Engineer" },
  { id: "brass-lamp", kind: "decoration", title: "Brass lamp", needs: "badge:train-12" },
];

/** Cosmetic skins never change the numbers the model grades. */
export function skinColor(base: string, skin: string | undefined): string {
  if (skin === "red-wagon") {
    return "#c8450a";
  }
  if (skin === "enamel-shine") {
    return "#1f8a8c";
  }
  return base;
}

export type Snapshot = {
  id: string;
  machine: string;
  challengeId: string;
  title: string;
  image: string;
  at: number;
};

export function rememberSnapshot(gallery: readonly Snapshot[], shot: Snapshot): Snapshot[] {
  const next = [shot, ...gallery.filter((item) => item.id !== shot.id)];
  return next.slice(0, 12);
}

export function showcaseFor(gallery: readonly Snapshot[]): Snapshot[] {
  const best = new Map<string, Snapshot>();
  for (const shot of gallery) {
    const current = best.get(shot.machine);
    if (!current || shot.at > current.at) {
      best.set(shot.machine, shot);
    }
  }
  return [...best.values()];
}
