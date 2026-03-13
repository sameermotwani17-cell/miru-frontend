"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import MiruLogo from "@/components/MiruLogo";
import HRAvatar from "@/components/HRAvatar";
import VoiceInput from "@/components/VoiceInput";
import { session } from "@/lib/session";
import {
  COMPANY_QUESTIONS,
  DEFAULT_QUESTIONS,
  MIRU_REACTIONS,
  scoreAnswer,
  buildResults,
} from "@/lib/types";
import type { RadarScores } from "@/lib/types";

type InterviewState =
  | "idle"
  | "listening"
  | "processing"
  | "speaking"
  | "complete";

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition: new () => SpeechRecognitionInstance;
  }
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((ev: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

export default function InterviewPage() {
  const router = useRouter();

  const [interviewState, setInterviewState] = useState<InterviewState>("idle");
  const [questions, setQuestions] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [reaction, setReaction] = useState("");
  const [error, setError] = useState("");
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isDemo, setIsDemo] = useState(false);
  const [company, setCompany] = useState("");
  const [isComplete, setIsComplete] = useState(false);

  const answersRef = useRef<string[]>([]);
  const turnScoresRef = useRef<RadarScores[]>([]);
  const questionsRef = useRef<string[]>([]);
  const currentIndexRef = useRef(0);
  const transcriptRef = useRef("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const stateRef = useRef<InterviewState>("idle");
  stateRef.current = interviewState;

  useEffect(() => {
    const id = session.getSessionId();
    const comp = session.getCompany() ?? "";
    const name = session.getCandidateName() ?? "";
    const duration = session.getDurationMode();

    if (!id) {
      router.push("/onboarding");
      return;
    }

    setCompany(comp);
    const demo = duration === "demo";
    setIsDemo(demo);

    const allQuestions = COMPANY_QUESTIONS[comp] ?? DEFAULT_QUESTIONS;
    const qs = demo ? allQuestions.slice(0, 3) : allQuestions;
    setQuestions(qs);
    questionsRef.current = qs;

    // Store name for result building (referenced via session)
    void name;

    timerRef.current = setInterval(() => {
      setTimerSeconds((s) => s + 1);
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, [router]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const startRecording = useCallback(() => {
    setTranscript("");
    transcriptRef.current = "";
    setError("");

    const SpeechRecognition =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError("Speech recognition not supported. Please use Chrome.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (ev: SpeechRecognitionEvent) => {
      let final = "";
      for (let i = 0; i < ev.results.length; i++) {
        if (ev.results[i].isFinal) final += ev.results[i][0].transcript;
      }
      if (final) {
        setTranscript(final);
        transcriptRef.current = final;
      }
    };

    recognition.onerror = (ev: SpeechRecognitionErrorEvent) => {
      if (ev.error !== "aborted") setError(`Recording error: ${ev.error}`);
      setInterviewState("idle");
    };

    recognition.onend = () => {
      if (stateRef.current === "listening") setInterviewState("idle");
    };

    recognition.start();
    recognitionRef.current = recognition;
    setInterviewState("listening");
  }, []);

  const submitAnswer = useCallback(() => {
    const answer = transcriptRef.current || "[No speech detected]";
    const idx = currentIndexRef.current;
    const qs = questionsRef.current;

    const scores = scoreAnswer(answer);
    answersRef.current[idx] = answer;
    turnScoresRef.current[idx] = scores;

    const reactionText = MIRU_REACTIONS[idx % MIRU_REACTIONS.length];
    setReaction(reactionText);
    setInterviewState("speaking");

    const isLast = idx >= qs.length - 1;
    const delay = Math.max(2500, reactionText.length * 45);

    setTimeout(() => {
      if (isLast) {
        const comp = session.getCompany() ?? "";
        const name = session.getCandidateName() ?? "";
        const results = buildResults(
          qs,
          answersRef.current,
          turnScoresRef.current,
          comp,
          name
        );
        session.setResults(results);
        session.setInterviewComplete(true);

        if (timerRef.current) clearInterval(timerRef.current);
        setIsComplete(true);
        setTimeout(() => router.push("/debrief"), 2500);
      } else {
        const nextIdx = idx + 1;
        currentIndexRef.current = nextIdx;
        setCurrentIndex(nextIdx);
        setTranscript("");
        transcriptRef.current = "";
        setReaction("");
        setInterviewState("idle");
      }
    }, delay);
  }, [router]);

  const stopRecordingFull = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setInterviewState("processing");
    setTimeout(submitAnswer, 400);
  }, [submitAnswer]);

  const currentQuestion = questions[currentIndex] ?? "";

  return (
    <div
      style={{
        height: "100vh",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "18px 32px",
          borderBottom: "1px solid var(--border-subtle)",
          background: "rgba(5,5,8,0.8)",
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
              color: "var(--text-secondary)",
            }}
          >
            {company}
          </span>

          <span
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 13,
              color: "var(--accent-primary)",
              fontWeight: 600,
            }}
          >
            Q{currentIndex + 1} / {questions.length || "…"}
          </span>

          <span
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 14,
              color: "var(--text-secondary)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {formatTime(timerSeconds)}
          </span>

          {isDemo && (
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

      {/* Main content */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "32px 24px 40px",
          maxWidth: 700,
          margin: "0 auto",
          width: "100%",
        }}
      >
        <HRAvatar
          state={
            interviewState === "idle"
              ? "idle"
              : interviewState === "listening"
              ? "listening"
              : interviewState === "processing"
              ? "processing"
              : "speaking"
          }
        />

        <div style={{ textAlign: "center", maxWidth: 580, width: "100%" }}>
          <AnimatePresence mode="wait">
            {interviewState === "speaking" ? (
              <motion.div
                key="reaction"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              >
                <p
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: 11,
                    color: "var(--accent-secondary)",
                    letterSpacing: "0.12em",
                    marginBottom: 12,
                  }}
                >
                  MIRU SAYS
                </p>
                <p
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "clamp(16px, 2.5vw, 22px)",
                    color: "var(--text-primary)",
                    lineHeight: 1.55,
                    fontWeight: 400,
                  }}
                >
                  {reaction}
                </p>
              </motion.div>
            ) : (
              <motion.div
                key={`question-${currentIndex}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              >
                <p
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: 11,
                    color: "var(--text-dim)",
                    letterSpacing: "0.12em",
                    marginBottom: 12,
                  }}
                >
                  QUESTION {currentIndex + 1}
                </p>
                <p
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "clamp(18px, 2.8vw, 26px)",
                    color: "var(--text-primary)",
                    lineHeight: 1.5,
                    fontWeight: 500,
                  }}
                >
                  {currentQuestion}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {error && (
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
                maxWidth: 440,
                textAlign: "center",
              }}
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        <VoiceInput
          isRecording={interviewState === "listening"}
          transcript={transcript}
          onStartRecording={startRecording}
          onStopRecording={stopRecordingFull}
          disabled={interviewState === "processing" || interviewState === "speaking"}
        />
      </div>

      {/* Complete overlay */}
      <AnimatePresence>
        {isComplete && (
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
                  color: "var(--text-primary)",
                  marginBottom: 12,
                }}
              >
                Interview Complete
              </h2>
              <p
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 16,
                  color: "var(--text-secondary)",
                }}
              >
                Preparing your debrief{" "}
                <span style={{ fontFamily: "var(--font-japanese)" }}>
                  ミルの分析
                </span>
                …
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
