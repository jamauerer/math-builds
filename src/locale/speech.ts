/** Spoken language for pre-reader questions. German-speaking countries use de-DE. */
export function speechLang(country?: string | null): "en-US" | "de-DE" {
  const code = (country ?? "").toUpperCase();
  return code === "DE" || code === "AT" || code === "CH" ? "de-DE" : "en-US";
}

export function speakText(text: string, lang: "en-US" | "de-DE" = "en-US"): void {
  if (typeof window === "undefined" || !window.speechSynthesis || !text.trim()) {
    return;
  }
  window.speechSynthesis.cancel();
  const spoken = new SpeechSynthesisUtterance(text.trim());
  spoken.lang = lang;
  window.speechSynthesis.speak(spoken);
}

export function cancelSpeech(): void {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    return;
  }
  window.speechSynthesis.cancel();
}
