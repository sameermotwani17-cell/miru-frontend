export interface SpeechRecognitionEventLike extends Event {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
      isFinal: boolean;
      length: number;
    };
    length: number;
  };
}

export interface SpeechRecognitionErrorEventLike extends Event {
  error: string;
}

export interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onstart: (() => void) | null;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

export interface StartSpeechRecognitionOptions {
  lang?: string;
  interimResults?: boolean;
  silenceTimeoutMs?: number;
  onError?: (message: string) => void;
  onEnd?: () => void;
}

// How long silence must persist (after the minimum speech window) before we
// auto-stop. 1800ms gives natural pause tolerance between sentences.
const DEFAULT_SILENCE_TIMEOUT_MS = 1800;

// For the first MIN_SPEECH_WINDOW_MS after speech begins, silence cannot end
// the session — prevents mid-sentence cutoffs on brief pauses.
const MIN_SPEECH_WINDOW_MS = 2000;

export function startSpeechRecognition(
  onResult: (text: string) => void,
  options: StartSpeechRecognitionOptions = {}
): SpeechRecognitionInstance | null {
  if (typeof window === "undefined") {
    return null;
  }

  const speechWindow = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };

  const SpeechRecognition =
    speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    options.onError?.("Speech recognition not supported. Please use Chrome.");
    return null;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = options.lang ?? "en-US";
  recognition.interimResults = options.interimResults ?? true;

  const silenceTimeoutMs = options.silenceTimeoutMs ?? DEFAULT_SILENCE_TIMEOUT_MS;
  let silenceTimer: ReturnType<typeof setTimeout> | null = null;
  let hasDetectedSpeech = false;
  // Timestamp of the first speech result — used to enforce minimum speech window
  let speechStartTime: number | null = null;

  const clearSilenceTimer = () => {
    if (!silenceTimer) {
      return;
    }
    clearTimeout(silenceTimer);
    silenceTimer = null;
  };

  const resetSilenceTimer = () => {
    if (!hasDetectedSpeech) {
      return;
    }
    clearSilenceTimer();

    const now = Date.now();
    const speechElapsed = speechStartTime !== null ? now - speechStartTime : 0;

    // If we are still inside the minimum speech window, extend the effective
    // timeout so it expires no earlier than MIN_SPEECH_WINDOW_MS from when
    // speech first started. This acts as both the minimum window AND the
    // resume buffer — any new speech resets this same timer.
    const effectiveTimeout =
      speechElapsed < MIN_SPEECH_WINDOW_MS
        ? silenceTimeoutMs + (MIN_SPEECH_WINDOW_MS - speechElapsed)
        : silenceTimeoutMs;

    silenceTimer = setTimeout(() => {
      recognition.stop();
    }, effectiveTimeout);
  };

  recognition.onstart = () => {
    hasDetectedSpeech = false;
    speechStartTime = null;
    clearSilenceTimer();
  };

  recognition.onresult = (event: SpeechRecognitionEventLike) => {
    const latestResult = event.results[event.results.length - 1];
    const text = latestResult?.[0]?.transcript?.trim();
    if (text) {
      if (!hasDetectedSpeech) {
        hasDetectedSpeech = true;
        speechStartTime = Date.now();
      }
      onResult(text);
      resetSilenceTimer();
    }
  };

  recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
    clearSilenceTimer();
    if (event.error !== "aborted") {
      options.onError?.(`Recording error: ${event.error}`);
    }
  };

  recognition.onend = () => {
    clearSilenceTimer();
    options.onEnd?.();
  };

  recognition.start();
  return recognition;
}
