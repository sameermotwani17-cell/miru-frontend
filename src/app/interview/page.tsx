"use client";

import { useState, useEffect, useRef, useReducer, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import MiruLogo from "@/components/MiruLogo";
import HRAvatar from "@/components/HRAvatar";
import VoiceInput from "@/components/VoiceInput";
import { session } from "@/lib/session";
import { speak } from "@/lib/tts";
import { sendInterviewTurn } from "@/lib/api";
import {
  startSpeechRecognition,
  type SpeechRecognitionInstance,
} from "@/lib/voice";
import {
  buildResults,
  mapInterviewScoresToRadar,
  scoreAnswer,
  type InterviewScores,
  type RadarScores,
} from "@/lib/types";

type MachineStatus =
  | "IDLE"
  | "STARTING"
  | "QUESTION"
  | "LISTENING"
  | "TRANSCRIBING"
  | "WAITING_RESPONSE"
  | "WRAP_UP"
  | "COMPLETED"
  | "ERROR";

type ChatMessage = {
  role: "user" | "agent";
  text: string;
};

type MachineState = {
  status: MachineStatus;
  sessionId: string;
  company: string;
  languageMode: string;
  messages: ChatMessage[];
  latestScores: InterviewScores | null;
  error: string;
  turnCount: number;
};

type MachineAction =
  | { type: "SET_CONTEXT"; sessionId: string; company: string; languageMode: string }
  | { type: "STARTING" }
  | { type: "QUESTION_READY"; agentText: string; scores?: InterviewScores; isFirst: boolean }
  | { type: "LISTENING" }
  | { type: "TRANSCRIBING" }
  | { type: "WAITING_RESPONSE"; userText: string; appendUser: boolean }
  | { type: "WRAP_UP" }
  | { type: "COMPLETED" }
  | { type: "ERROR"; error: string }
  | { type: "RETRY_FROM_ERROR" };

const initialMachineState: MachineState = {
  status: "IDLE",
  sessionId: "",
  company: "rakuten",
  languageMode: "en",
  messages: [],
  latestScores: null,
  error: "",
  turnCount: 0,
};

const RETRY_BASE_DELAY_MS = 450;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function interviewReducer(state: MachineState, action: MachineAction): MachineState {
  switch (action.type) {
    case "SET_CONTEXT":
      return {
        ...state,
        sessionId: action.sessionId,
        company: action.company,
        languageMode: action.languageMode,
      };
    case "STARTING":
      return {
        ...state,
        status: "STARTING",
        error: "",
      };
    case "QUESTION_READY":
      return {
        ...state,
        status: "QUESTION",
        error: "",
        latestScores: action.scores ?? state.latestScores,
        messages: action.isFirst
          ? [{ role: "agent", text: action.agentText }]
          : [...state.messages, { role: "agent", text: action.agentText }],
      };
    case "LISTENING":
      return {
        ...state,
        status: "LISTENING",
        error: "",
      };
    case "TRANSCRIBING":
      return {
        ...state,
        status: "TRANSCRIBING",
        error: "",
      };
    case "WAITING_RESPONSE":
      return {
        ...state,
        status: "WAITING_RESPONSE",
        error: "",
        turnCount: action.appendUser ? state.turnCount + 1 : state.turnCount,
        messages: action.appendUser
          ? [...state.messages, { role: "user", text: action.userText }]
          : state.messages,
      };
    case "WRAP_UP":
      return {
        ...state,
        status: "WRAP_UP",
      };
    case "COMPLETED":
      return {
        ...state,
        status: "COMPLETED",
      };
    case "ERROR":
      return {
        ...state,
        status: "ERROR",
        error: action.error,
      };
    case "RETRY_FROM_ERROR":
      return {
        ...state,
        status: state.messages.length ? "QUESTION" : "STARTING",
        error: "",
      };
    default:
      return state;
  }
}

export default function InterviewPage() {
  const router = useRouter();
  const [machine, dispatch] = useReducer(interviewReducer, initialMachineState);

  const [transcript, setTranscript] = useState("");
  const [lastTranscript, setLastTranscript] = useState("");
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerMaxSecs, setTimerMaxSecs] = useState(0);
  const [durationId, setDurationId] = useState("");

  const askedQuestionsRef = useRef<string[]>([]);
  const answersRef = useRef<string[]>([]);
  const turnScoresRef = useRef<RadarScores[]>([]);

  const transcriptRef = useRef("");
  const statusRef = useRef<MachineStatus>("IDLE");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const submitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transcriptPreviewTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  const startedRef = useRef(false);
  const completingRef = useRef(false);
  const requestInFlightRef = useRef(false);
  const pendingRequestRef = useRef<{ kind: "start" | "answer"; answer: string } | null>(null);

  useEffect(() => {
    statusRef.current = machine.status;
  }, [machine.status]);

  const sendTurnWithRetry = useCallback(
    async (userMessage: string) => {
      const maxAttempts = 3;
      let lastError: unknown = null;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          return await sendInterviewTurn(userMessage, machine.sessionId, machine.company);
        } catch (err) {
          lastError = err;
          if (attempt === maxAttempts) {
            break;
          }
          const jitter = Math.floor(Math.random() * 120);
          const delay = RETRY_BASE_DELAY_MS * 2 ** (attempt - 1) + jitter;
          await sleep(delay);
        }
      }

      throw lastError instanceof Error
        ? lastError
        : new Error("Turn request failed after retries.");
    },
    [machine.sessionId, machine.company]
  );

  const finalizeInterview = useCallback(() => {
    if (completingRef.current) {
      return;
    }
    completingRef.current = true;

    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (!askedQuestionsRef.current.length && machine.messages.length) {
      askedQuestionsRef.current = machine.messages
        .filter((m) => m.role === "agent")
        .map((m) => m.text);
    }

    if (askedQuestionsRef.current.length > answersRef.current.length) {
      const missing = askedQuestionsRef.current.length - answersRef.current.length;
      for (let i = 0; i < missing; i++) {
        answersRef.current.push("[No speech detected]");
      }
    }

    if (!turnScoresRef.current.length && answersRef.current.length) {
      turnScoresRef.current = answersRef.current.map((a) => scoreAnswer(a));
    }

    const results = buildResults(
      askedQuestionsRef.current.length
        ? askedQuestionsRef.current
        : ["Interview"],
      answersRef.current.length
        ? answersRef.current
        : ["[No speech detected]"],
      turnScoresRef.current.length
        ? turnScoresRef.current
        : [scoreAnswer("[No speech detected]")],
      machine.company,
      session.getCandidateName() ?? ""
    );

    session.setResults(results);
    session.setInterviewComplete(true);
    dispatch({ type: "COMPLETED" });
  }, [machine.messages, machine.company]);

  const executeStartTurn = useCallback(async () => {
    if (requestInFlightRef.current || startedRef.current || !machine.sessionId) {
      return;
    }

    startedRef.current = true;
    requestInFlightRef.current = true;
    pendingRequestRef.current = { kind: "start", answer: "start" };
    dispatch({ type: "STARTING" });

    try {
      const res = await sendTurnWithRetry("start");
      const firstPrompt = res.agent_text?.trim() || "Please introduce yourself.";
      askedQuestionsRef.current = [firstPrompt];

      dispatch({
        type: "QUESTION_READY",
        agentText: firstPrompt,
        scores: res.scores,
        isFirst: true,
      });

      speak(firstPrompt, machine.languageMode === "jp" ? "ja-JP" : "en-US");

      if (res.is_wrapping_up) {
        dispatch({ type: "WRAP_UP" });
        finalizeInterview();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to start interview.";
      dispatch({ type: "ERROR", error: msg });
      startedRef.current = false;
    } finally {
      requestInFlightRef.current = false;
    }
  }, [machine.sessionId, machine.languageMode, sendTurnWithRetry, finalizeInterview]);

  const executeAnswerTurn = useCallback(
    async (answer: string, appendUser: boolean) => {
      if (
        requestInFlightRef.current ||
        !machine.sessionId ||
        machine.status === "WRAP_UP" ||
        machine.status === "COMPLETED"
      ) {
        return;
      }

      const safeAnswer = answer.trim() || "[No speech detected]";
      requestInFlightRef.current = true;
      pendingRequestRef.current = { kind: "answer", answer: safeAnswer };

      if (appendUser) {
        setLastTranscript(safeAnswer);
        if (transcriptPreviewTimeoutRef.current) {
          clearTimeout(transcriptPreviewTimeoutRef.current);
        }
        transcriptPreviewTimeoutRef.current = setTimeout(() => {
          setLastTranscript("");
        }, 2800);
      }

      dispatch({ type: "WAITING_RESPONSE", userText: safeAnswer, appendUser });

      if (appendUser) {
        answersRef.current.push(safeAnswer);
      }

      try {
        const res = await sendTurnWithRetry(safeAnswer);
        const nextPrompt = res.agent_text?.trim() || "Thank you.";

        askedQuestionsRef.current.push(nextPrompt);

        const mappedScores = res.scores
          ? mapInterviewScoresToRadar(res.scores)
          : scoreAnswer(safeAnswer);
        if (appendUser) {
          turnScoresRef.current.push(mappedScores);
        }

        dispatch({
          type: "QUESTION_READY",
          agentText: nextPrompt,
          scores: res.scores,
          isFirst: false,
        });

        if (!res.is_wrapping_up) {
          speak(nextPrompt, machine.languageMode === "jp" ? "ja-JP" : "en-US");
        } else {
          dispatch({ type: "WRAP_UP" });
          finalizeInterview();
        }

        setTranscript("");
        transcriptRef.current = "";
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Temporary network issue. Please try again.";
        dispatch({ type: "ERROR", error: msg });
      } finally {
        requestInFlightRef.current = false;
      }
    },
    [machine.sessionId, machine.status, machine.languageMode, sendTurnWithRetry, finalizeInterview]
  );

  useEffect(() => {
    let id = session.getSessionId();
    const company = session.getCompany() ?? "rakuten";
    const languageMode = session.getLanguageMode() ?? "en";
    const durId = session.getDurationMode() ?? "demo";

    if (!id) {
      id = `miru-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      session.setSessionId(id);
    }

    if (!session.getCompany()) {
      session.setCompany(company);
    }

    dispatch({
      type: "SET_CONTEXT",
      sessionId: id,
      company,
      languageMode,
    });

    setDurationId(durId);

    const maxSecs =
      durId === "demo" ? 180 :
      durId === "15min" ? 900 :
      durId === "30min" ? 1800 :
      durId === "45min" ? 2700 : 0;

    setTimerMaxSecs(maxSecs);

    if (maxSecs > 0) {
      setTimerSeconds(maxSecs);
      timerRef.current = setInterval(() => {
        setTimerSeconds((s) => Math.max(0, s - 1));
      }, 1000);
    } else {
      setTimerSeconds(0);
      timerRef.current = setInterval(() => {
        setTimerSeconds((s) => s + 1);
      }, 1000);
    }

    return () => {
      if (submitTimeoutRef.current) clearTimeout(submitTimeoutRef.current);
      if (transcriptPreviewTimeoutRef.current) clearTimeout(transcriptPreviewTimeoutRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      if (recognitionRef.current) recognitionRef.current.stop();
      if (typeof window !== "undefined") {
        window.speechSynthesis?.cancel();
      }
    };
  }, []);

  useEffect(() => {
    if (machine.status === "IDLE" && machine.sessionId) {
      void executeStartTurn();
    }
  }, [machine.status, machine.sessionId, executeStartTurn]);

  useEffect(() => {
    if (timerMaxSecs > 0 && timerSeconds === 0 && machine.status !== "COMPLETED") {
      dispatch({ type: "WRAP_UP" });
      finalizeInterview();
    }
  }, [timerSeconds, timerMaxSecs, machine.status, finalizeInterview]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [machine.messages, machine.status]);

  const startRecording = useCallback(() => {
    if (machine.status !== "QUESTION") {
      return;
    }

    setTranscript("");
    transcriptRef.current = "";
    dispatch({ type: "LISTENING" });

    const recognition = startSpeechRecognition(
      (text) => {
        setTranscript(text);
        transcriptRef.current = text;
      },
      {
        lang: machine.languageMode === "jp" ? "ja-JP" : "en-US",
        onError: (message) => {
          dispatch({ type: "ERROR", error: message });
        },
        onEnd: () => {
          if (statusRef.current === "LISTENING") {
            dispatch({ type: "TRANSCRIBING" });
            submitTimeoutRef.current = setTimeout(() => {
              void executeAnswerTurn(transcriptRef.current, true);
            }, 220);
          }
        },
      }
    );

    if (!recognition) {
      return;
    }

    recognitionRef.current = recognition;
  }, [machine.status, machine.languageMode, executeAnswerTurn]);

  const stopRecordingFull = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }

    if (statusRef.current === "LISTENING") {
      dispatch({ type: "TRANSCRIBING" });
      submitTimeoutRef.current = setTimeout(() => {
        void executeAnswerTurn(transcriptRef.current, true);
      }, 160);
    }
  }, [executeAnswerTurn]);

  const retryFailedRequest = useCallback(() => {
    const pending = pendingRequestRef.current;
    if (!pending || requestInFlightRef.current) {
      return;
    }

    dispatch({ type: "RETRY_FROM_ERROR" });

    if (pending.kind === "start") {
      startedRef.current = false;
      void executeStartTurn();
      return;
    }

    void executeAnswerTurn(pending.answer, false);
  }, [executeStartTurn, executeAnswerTurn]);

  const openDebrief = useCallback(() => {
    router.push("/debrief");
  }, [router]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const isTimerWarning = timerMaxSecs > 0 && timerSeconds <= 60 && timerSeconds > 0;
  const isTimerCritical = timerMaxSecs > 0 && timerSeconds <= 20 && timerSeconds > 0;

  const isThinking = machine.status === "STARTING" || machine.status === "WAITING_RESPONSE";
  const inputDisabled =
    machine.status === "STARTING" ||
    machine.status === "TRANSCRIBING" ||
    machine.status === "WAITING_RESPONSE" ||
    machine.status === "WRAP_UP" ||
    machine.status === "COMPLETED";

  const avatarState =
    machine.status === "LISTENING"
      ? "listening"
      : machine.status === "TRANSCRIBING" || machine.status === "WAITING_RESPONSE" || machine.status === "STARTING"
      ? "processing"
      : machine.status === "QUESTION"
      ? "speaking"
      : "idle";

  const statusText =
    machine.status === "LISTENING"
      ? "Listening..."
      : machine.status === "TRANSCRIBING"
      ? "Transcribing..."
      : machine.status === "WAITING_RESPONSE" || machine.status === "STARTING"
      ? "MIRU is thinking..."
      : "Tap mic and speak";

  return (
    <div
      className="page-dark"
      style={{
        height: "100vh",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        backgroundColor: "#050508",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "18px 32px",
          borderBottom: "1px solid var(--border-subtle)",
          background: "rgba(5,5,8,0.85)",
          backdropFilter: "blur(20px)",
          flexShrink: 0,
          zIndex: 10,
        }}
      >
        <MiruLogo size="sm" />

        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <span
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 13,
              color: "#8888aa",
            }}
          >
            {machine.company}
          </span>

          <span
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 13,
              color: "var(--accent-primary)",
              fontWeight: 600,
            }}
          >
            Turns: {machine.turnCount}
          </span>

          <span
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 14,
              color: isTimerCritical
                ? "#ef4444"
                : isTimerWarning
                ? "#ffb347"
                : "var(--text-secondary)",
              fontVariantNumeric: "tabular-nums",
              fontWeight: isTimerWarning ? 700 : 400,
              transition: "color 0.3s",
            }}
          >
            {timerMaxSecs > 0 ? "Time left: " : "Elapsed: "}
            {formatTime(timerSeconds)}
          </span>

          {durationId === "demo" && (
            <span
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                background: "rgba(255,179,71,0.15)",
                border: "1px solid rgba(255,179,71,0.3)",
                color: "var(--accent-gold)",
                fontSize: 11,
                fontFamily: "var(--font-body)",
                fontWeight: 600,
                letterSpacing: "0.08em",
              }}
            >
              DEMO
            </span>
          )}
        </div>
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "24px",
          maxWidth: 760,
          margin: "0 auto",
          width: "100%",
          gap: 14,
        }}
      >
        <HRAvatar state={avatarState} />

        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 13,
            color: "#a8a9c7",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          {statusText}
        </p>

        <div
          className="glass-card"
          style={{
            width: "100%",
            flex: 1,
            overflowY: "auto",
            padding: "16px",
            borderRadius: 14,
            border: "1px solid var(--border-subtle)",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {machine.messages.map((m, idx) => (
            <div
              key={`${m.role}-${idx}`}
              style={{
                alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "80%",
                padding: "10px 14px",
                borderRadius: 12,
                background:
                  m.role === "user"
                    ? "rgba(108,99,255,0.18)"
                    : "rgba(255,255,255,0.06)",
                border:
                  m.role === "user"
                    ? "1px solid rgba(108,99,255,0.35)"
                    : "1px solid rgba(255,255,255,0.1)",
                color: "#f0f0ff",
                fontFamily: "var(--font-body)",
                fontSize: 14,
                lineHeight: 1.5,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  letterSpacing: "0.08em",
                  color: "#9fa0c3",
                  marginBottom: 4,
                }}
              >
                {m.role === "user" ? "YOU" : "MIRU"}
              </div>
              {m.text}
            </div>
          ))}

          {isThinking && (
            <div
              style={{
                alignSelf: "flex-start",
                maxWidth: "70%",
                padding: "10px 14px",
                borderRadius: 12,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#a8a9c7",
                fontFamily: "var(--font-body)",
                fontSize: 13,
              }}
            >
              MIRU is thinking...
            </div>
          )}

          <div ref={chatBottomRef} />
        </div>

        {lastTranscript && (
          <div
            className="glass-card"
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.12)",
              color: "#c8c9e6",
              fontFamily: "var(--font-body)",
              fontSize: 13,
            }}
          >
            <span style={{ color: "#9fa0c3", marginRight: 8 }}>You said:</span>
            &quot;{lastTranscript}&quot;
          </div>
        )}

        {machine.latestScores && (
          <div
            className="glass-card"
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid var(--border-subtle)",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: 10,
              fontFamily: "var(--font-body)",
              fontSize: 13,
              color: "#c8c9e6",
            }}
          >
            <div>Self PR: {machine.latestScores.jiko_pr}</div>
            <div>Motivation: {machine.latestScores.shibou_douki}</div>
            <div>Teamwork: {machine.latestScores.kyouchousei}</div>
            <div>Growth: {machine.latestScores.seichou_iyoku}</div>
            <div>Culture fit: {machine.latestScores.bunka_tekigou}</div>
          </div>
        )}

        <AnimatePresence>
          {machine.status === "ERROR" && machine.error && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="glass-card"
              style={{
                padding: "12px 18px",
                borderColor: "rgba(255,107,107,0.3)",
                color: "var(--accent-warm)",
                fontSize: 13,
                fontFamily: "var(--font-body)",
                maxWidth: 620,
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <span>{machine.error}</span>
              <button
                onClick={retryFailedRequest}
                style={{
                  alignSelf: "center",
                  padding: "8px 14px",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.2)",
                  background: "rgba(255,255,255,0.08)",
                  color: "#f0f0ff",
                  fontSize: 12,
                  fontFamily: "var(--font-body)",
                  cursor: "pointer",
                }}
              >
                Retry Request
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <VoiceInput
          isRecording={machine.status === "LISTENING"}
          transcript={transcript}
          onStartRecording={startRecording}
          onStopRecording={stopRecordingFull}
          disabled={inputDisabled}
        />
      </div>

      <AnimatePresence>
        {machine.status === "COMPLETED" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(5,5,8,0.92)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 100,
              backdropFilter: "blur(12px)",
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              style={{ textAlign: "center" }}
            >
              <div style={{ fontSize: 48, marginBottom: 20 }}>✓</div>
              <h2
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 32,
                  fontWeight: 700,
                  color: "#f0f0ff",
                  marginBottom: 12,
                }}
              >
                Interview finished
              </h2>

              {machine.latestScores && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, minmax(150px, 1fr))",
                    gap: 8,
                    color: "#c8c9e6",
                    fontFamily: "var(--font-body)",
                    fontSize: 13,
                    textAlign: "left",
                    marginBottom: 16,
                  }}
                >
                  <div>Self PR: {machine.latestScores.jiko_pr}</div>
                  <div>Motivation: {machine.latestScores.shibou_douki}</div>
                  <div>Teamwork: {machine.latestScores.kyouchousei}</div>
                  <div>Growth: {machine.latestScores.seichou_iyoku}</div>
                  <div>Culture fit: {machine.latestScores.bunka_tekigou}</div>
                </div>
              )}

              <button
                onClick={openDebrief}
                style={{
                  padding: "10px 16px",
                  borderRadius: 10,
                  border: "1px solid rgba(108,99,255,0.55)",
                  background: "rgba(108,99,255,0.2)",
                  color: "#f0f0ff",
                  fontFamily: "var(--font-body)",
                  cursor: "pointer",
                }}
              >
                View Debrief
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
