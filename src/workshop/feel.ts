export function tap(enabled: boolean): boolean {
  if (!enabled || typeof navigator === "undefined" || typeof navigator.vibrate !== "function") {
    return false;
  }
  navigator.vibrate(12);
  return true;
}
