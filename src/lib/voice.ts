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

  const silenceTimeoutMs = options.silenceTimeoutMs ?? 1500;
  let silenceTimer: ReturnType<typeof setTimeout> | null = null;
  let hasDetectedSpeech = false;

  const resetSilenceTimer = () => {
    if (!hasDetectedSpeech) {
      return;
    }
    if (silenceTimer) {
      clearTimeout(silenceTimer);
    }
    silenceTimer = setTimeout(() => {
      recognition.stop();
    }, silenceTimeoutMs);
  };

  const clearSilenceTimer = () => {
    if (!silenceTimer) {
      return;
    }
    clearTimeout(silenceTimer);
    silenceTimer = null;
  };

  recognition.onstart = () => {
    hasDetectedSpeech = false;
    clearSilenceTimer();
  };

  recognition.onresult = (event: SpeechRecognitionEventLike) => {
    const latestResult = event.results[event.results.length - 1];
    const text = latestResult?.[0]?.transcript?.trim();
    if (text) {
      hasDetectedSpeech = true;
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
