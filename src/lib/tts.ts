export function speak(texts: string | string[], lang: string = "en-US") {
  if (typeof window === "undefined" || !window.speechSynthesis) return;

  const list = (Array.isArray(texts) ? texts : [texts]).filter((t) => t?.trim());
  if (!list.length) return;

  window.speechSynthesis.cancel();

  const speakNext = (i: number) => {
    if (i >= list.length) return;
    const utt = new SpeechSynthesisUtterance(list[i]);
    utt.lang = lang;
    utt.rate = 1;
    utt.pitch = 1;
    utt.onend = () => speakNext(i + 1);
    window.speechSynthesis.speak(utt);
  };

  speakNext(0);
}

export function stopSpeech() {
  if (typeof window !== "undefined") {
    window.speechSynthesis?.cancel();
  }
}
