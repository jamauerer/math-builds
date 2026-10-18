/** Sound is off until the learner turns it on. A muted call does nothing. */
export function playTone(enabled: boolean, kind: "snap" | "drop" | "success" | "fail"): boolean {
  if (!enabled || typeof window === "undefined") {
    return false;
  }
  const audioWindow = window as Window & { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
  const Context = audioWindow.AudioContext ?? audioWindow.webkitAudioContext;
  if (!Context) {
    return false;
  }
  const context = new Context();
  const osc = context.createOscillator();
  const gain = context.createGain();
  const pitch = kind === "success" ? 660 : kind === "fail" ? 180 : kind === "drop" ? 240 : 480;
  osc.frequency.value = pitch;
  gain.gain.value = 0.04;
  osc.connect(gain);
  gain.connect(context.destination);
  osc.start();
  osc.stop(context.currentTime + 0.08);
  window.setTimeout(() => void context.close(), 200);
  return true;
}

export function tap(enabled: boolean): boolean {
  if (!enabled || typeof navigator === "undefined" || typeof navigator.vibrate !== "function") {
    return false;
  }
  navigator.vibrate(12);
  return true;
}
