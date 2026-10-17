import type { PartRole } from "./catalog";
import type { BridgeStatus } from "./simulate";

export type GridSlot = { col: number; row: 0 | 1 };

export type PlacedBlock = { col: number; row: 0 | 1; partId: string };

export const DRIVE_SUCCESS = "The car crossed. This bridge is complete.";

export type DrivePhase = "playing" | "holding" | "result";

export function stockLeft(tray: Record<string, number>, placed: readonly PlacedBlock[], partId: string): number {
  const used = placed.filter((item) => item.partId === partId).length;
  return Math.max(0, (tray[partId] ?? 0) - used);
}

export function dropPiece(
  placed: readonly PlacedBlock[],
  tray: Record<string, number>,
  partId: string,
  role: PartRole,
  slot: GridSlot,
): { placed: PlacedBlock[]; accepted: boolean } {
  const same = { placed: [...placed], accepted: false };
  if (role === "ramp" || stockLeft(tray, placed, partId) <= 0) {
    return same;
  }
  if (placed.some((item) => item.col === slot.col && item.row === slot.row)) {
    return same;
  }
  if (slot.row === 0 && role !== "deck") {
    return same;
  }
  if (slot.row === 1 && role !== "pillar") {
    return same;
  }
  if (slot.row === 1 && !placed.some((item) => item.col === slot.col && item.row === 0)) {
    return same;
  }
  return { placed: [...placed, { col: slot.col, row: slot.row, partId }], accepted: true };
}

export function removePiece(placed: readonly PlacedBlock[], slot: GridSlot): PlacedBlock[] {
  return placed.filter((item) => item.col !== slot.col || item.row !== slot.row);
}

export function nextDrivePhase(phase: DrivePhase, status: BridgeStatus): DrivePhase {
  if (phase === "result") {
    return "result";
  }
  if (status === "crossed" || status === "collapsed") {
    return phase === "holding" ? "result" : "holding";
  }
  return "playing";
}

export function driveMessage(phase: DrivePhase, status: BridgeStatus, failure: string): string {
  if (phase !== "result") {
    return "";
  }
  if (status === "crossed") {
    return DRIVE_SUCCESS;
  }
  return failure;
}
