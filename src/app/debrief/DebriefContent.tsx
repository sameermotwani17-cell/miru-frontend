"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import MiruLogo from "@/components/MiruLogo";
import MiruRadarChart from "@/components/MiruRadarChart";
import ScoreBar from "@/components/ScoreBar";
import { session } from "@/lib/session";
import type { FullResults, FeedbackObject, RadarScores } from "@/lib/types";
import { DIMENSION_LABELS } from "@/lib/types";
import { normalizeScores } from "@/lib/resultsNormalizer";
import { getSessionId } from "@/lib/getSessionId";

type DebriefApiResponse = Partial<FullResults> & {
  scores?: Partial<RadarScores>;
  turn_feedback?: unknown[];
};

const MAX_ATTEMPTS = 15;
const INTERVAL_MS = 2000;

async function pollForResults(
  sessionId: string,
  onAttempt: (attempt: number, maxAttempts: number) => void
): Promise<DebriefApiResponse> {
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const attempt = i + 1;
    onAttempt(attempt, MAX_ATTEMPTS);

    const res = await fetch(
      `/api/interview/results?session_id=${encodeURIComponent(sessionId)}`
    ).catch(() => null);

    if (res?.ok) {
      const data = (await res.json()) as DebriefApiResponse;
      if (Array.isArray(data?.turn_feedback) && data.turn_feedback.length > 0) {
        return data;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
  }

  throw new Error("Debrief generation timeout");
}

function SectionHeader({ label, title }: { label: string; title: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      style={{ marginBottom: 32 }}
    >
      <p
        style={{
          fontSize: 11,
          color: "var(--text-page-accent)",
          letterSpacing: "0.14em",
          fontFamily: "var(--font-body)",
          marginBottom: 6,
          fontWeight: 600,
        }}
      >
        {label}
      </p>
      <h2
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "clamp(22px, 4vw, 32px)",
          fontWeight: 700,
          color: "var(--text-page-heading)",
          lineHeight: 1.2,
        }}
      >
        {title}
      </h2>
    </motion.div>
  );
}

function getLowestDimension(scores: RadarScores): keyof RadarScores {
  return (Object.keys(scores) as (keyof RadarScores)[]).reduce((a, b) =>
    Number(scores[a] ?? 0) < Number(scores[b] ?? 0) ? a : b
  );
}

function getAvgScore(scores: RadarScores): number {
  const vals = Object.values(scores).map((v) => Number(v ?? 0));
  if (!vals.length) return 0;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function getScoreColor(score: number): string {
  if (score >= 7) return "var(--accent-green)";
  if (score >= 4) return "var(--accent-gold)";
  return "var(--accent-warm)";
}

function renderFeedback(fb: string | FeedbackObject | null | undefined) {
  if (!fb) {
    return (
      <p
        style={{
          fontFamily: "var(--font-body)",
          fontSize: 14,
          color: "var(--text-page-body)",
          lineHeight: 1.7,
        }}
      >
        No feedback available for this session.
      </p>
    );
  }

  if (typeof fb === "string") {
    return (
      <p
        style={{
          fontFamily: "var(--font-body)",
          fontSize: 14,
          color: "var(--text-page-body)",
          lineHeight: 1.7,
        }}
      >
        {fb}
      </p>
    );
  }

  const subsectionLabel = (text: string, color: string) => (
    <p
      style={{
        fontSize: 11,
        color,
        letterSpacing: "0.1em",
        fontFamily: "var(--font-body)",
        fontWeight: 600,
        marginBottom: 6,
        textTransform: "uppercase" as const,
      }}
    >
      {text}
    </p>
  );

  const bodyText = (text: string) => (
    <p
      style={{
        fontFamily: "var(--font-body)",
        fontSize: 14,
        color: "var(--text-page-body)",
        lineHeight: 1.7,
        marginBottom: 0,
      }}
    >
      {text}
    </p>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {fb.summary && (
        <div>
          {subsectionLabel("Summary", "var(--accent-gold)")}
          {bodyText(fb.summary)}
        </div>
      )}
      {fb.strengths && (
        <div>
          {subsectionLabel("Strengths", "var(--accent-green)")}
          {bodyText(fb.strengths)}
        </div>
      )}
      {fb.areas_for_improvement && (
        <div>
          {subsectionLabel("Areas for Improvement", "var(--accent-warm)")}
          {bodyText(fb.areas_for_improvement)}
        </div>
      )}
      {!fb.summary && !fb.strengths && !fb.areas_for_improvement && (
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 14,
            color: "var(--text-page-body)",
            lineHeight: 1.7,
          }}
        >
          No feedback available for this session.
        </p>
      )}
    </div>
  );
}

export default function DebriefContent() {
  const router = useRouter();
  const [results, setResults] = useState<FullResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [error, setError] = useState("");

  const loadResults = useCallback(async () => {
    setLoading(true);
    setError("");
    setLoadingMessage(`MIRU is analyzing your interview... Attempt 1 / ${MAX_ATTEMPTS}`);

    const id = getSessionId();
    if (!id) {
      setError("Session not found. Please start a new interview.");
      setLoading(false);
      return;
    }

    session.setSessionId(id);

    try {
      const raw = await pollForResults(id, (attempt, maxAttempts) => {
        setLoadingMessage(`MIRU is analyzing your interview... Attempt ${attempt} / ${maxAttempts}`);
      });

      const normalized: FullResults = {
        radar_scores: normalizeScores(raw),
        transcript: Array.isArray(raw.transcript) ? raw.transcript : [],
        feedback: raw.feedback ?? "",
        hiring_signal: raw.hiring_signal ?? "",
      };

      setResults(normalized);
    } catch {
      setError("Debrief generation took longer than expected.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadResults();
  }, [loadResults]);

  const handlePracticeAgain = () => {
    session.clearForNewSession();
    router.push("/onboarding");
  };

  const handleDifferentCompany = () => {
    session.removeCompany();
    router.push("/onboarding");
  };

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 20,
        }}
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            border: "2px solid var(--border-subtle)",
            borderTopColor: "var(--accent-primary)",
          }}
        />
        <p
          style={{
            fontFamily: "var(--font-body)",
            color: "var(--text-page-body)",
            fontSize: 14,
          }}
        >
          {loadingMessage}
        </p>
      </div>
    );
  }

  if (error || !results) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <div
          className="glass-card"
          style={{
            padding: 32,
            maxWidth: 480,
            textAlign: "center",
          }}
        >
          <p
            style={{
              color: "var(--accent-warm)",
              fontFamily: "var(--font-body)",
              marginBottom: 16,
            }}
          >
            {error || "No results found."}
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <button
              onClick={loadResults}
              style={{
                padding: "10px 24px",
                borderRadius: 8,
                border: "1px solid var(--border-active)",
                background: "rgba(108,99,255,0.1)",
                color: "var(--text-primary)",
                fontFamily: "var(--font-body)",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Retry
            </button>
            <button
              onClick={() => router.push("/")}
              style={{
                padding: "10px 24px",
                borderRadius: 8,
                border: "1px solid var(--border-subtle)",
                background: "transparent",
                color: "var(--text-secondary)",
                fontFamily: "var(--font-body)",
                cursor: "pointer",
              }}
            >
              Return Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  const safeScores = normalizeScores(results);
  const transcript = results.transcript ?? [];
  const feedback = results.feedback ?? null;
  const hiringSignal = results.hiring_signal ?? "";

  const radarKeys = Object.keys(safeScores) as (keyof RadarScores)[];
  const lowestDim = radarKeys.length
    ? getLowestDimension(safeScores)
    : ("wa_teamwork" as keyof RadarScores);
  const avgScore = radarKeys.length ? getAvgScore(safeScores) : 0;
  const company = session.getCompany() ?? "";
  const sessionId = session.getSessionId() ?? "";

  return (
    <div className="page-light" style={{ minHeight: "100vh", paddingBottom: 120 }}>
      <div className="print-header">
        <h1>MIRU - Interview Report</h1>
        <p>
          Company: {company || "-"} · Date: {new Date().toLocaleDateString()} · Session: {sessionId.slice(0, 8)}
        </p>
      </div>

      <nav
        className="no-print dark-surface"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          padding: "16px 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid var(--border-subtle)",
          background: "rgba(5,5,8,0.85)",
          backdropFilter: "blur(20px)",
        }}
      >
        <MiruLogo size="sm" />
        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={handleDifferentCompany}
            style={{
              padding: "8px 18px",
              borderRadius: 8,
              border: "1px solid var(--border-subtle)",
              background: "transparent",
              color: "var(--text-secondary)",
              fontFamily: "var(--font-body)",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Try Different Company
          </button>
          <button
            onClick={handlePracticeAgain}
            style={{
              padding: "8px 18px",
              borderRadius: 8,
              border: "1px solid var(--border-active)",
              background: "rgba(108,99,255,0.1)",
              color: "var(--text-primary)",
              fontFamily: "var(--font-body)",
              fontSize: 13,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Practice Again
          </button>
        </div>
      </nav>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "60px 24px 40px" }}>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          style={{ textAlign: "center", marginBottom: 72 }}
        >
          <p
            style={{
              fontFamily: "var(--font-japanese)",
              fontSize: 14,
              color: "var(--text-page-accent)",
              marginBottom: 16,
            }}
          >
            面接フィードバック
          </p>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(32px, 6vw, 56px)",
              fontWeight: 700,
              color: "var(--text-page-heading)",
              marginBottom: 12,
            }}
          >
            Your Debrief
          </h1>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 24px",
              borderRadius: 999,
              border: `1px solid ${getScoreColor(avgScore)}40`,
              background: `${getScoreColor(avgScore)}0D`,
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 28,
                fontWeight: 800,
                color: getScoreColor(avgScore),
              }}
            >
              {avgScore.toFixed(1)}
            </span>
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 13,
                color: "var(--text-page-body)",
              }}
            >
              / 10 overall
            </span>
          </div>
        </motion.div>

        <section style={{ marginBottom: 80 }}>
          <SectionHeader label="SECTION 01" title="Score Overview" />

          <div className="glass-card radar-chart-wrapper" style={{ padding: 32, marginBottom: 28 }}>
            <MiruRadarChart scores={safeScores} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {(Object.keys(safeScores) as (keyof RadarScores)[]).map((key, i) => (
              <ScoreBar
                key={key}
                label={DIMENSION_LABELS[key]}
                score={safeScores[key]}
                delay={i * 0.05}
                highlight={key === lowestDim}
              />
            ))}
          </div>
        </section>

        <section style={{ marginBottom: 80 }}>
          <SectionHeader label="SECTION 02" title="Interviewer Feedback" />

          <div className="glass-card" style={{ padding: "28px 32px", borderColor: "rgba(245,158,11,0.3)" }}>
            <p
              style={{
                fontSize: 11,
                color: "var(--accent-gold)",
                letterSpacing: "0.1em",
                fontFamily: "var(--font-body)",
                fontWeight: 600,
                marginBottom: 16,
              }}
            >
              OVERALL ASSESSMENT
            </p>
            {renderFeedback(feedback)}
          </div>
        </section>

        {transcript && transcript.length > 0 && (
          <section style={{ marginBottom: 80 }}>
            <SectionHeader label="SECTION 03" title="Interview Transcript" />
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 14,
                color: "var(--text-page-body)",
                marginBottom: 28,
                lineHeight: 1.6,
              }}
            >
              Full record of questions asked and your responses.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {transcript.map((turn, i) => (
                <motion.div
                  key={turn.question_id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.5, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                  className="glass-card"
                  style={{ padding: "28px 28px" }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: 11,
                      color: "var(--text-dim)",
                      letterSpacing: "0.1em",
                      display: "block",
                      marginBottom: 12,
                    }}
                  >
                    QUESTION {i + 1}
                  </span>
                  <p
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: 16,
                      fontWeight: 600,
                      color: "var(--text-primary)",
                      marginBottom: 12,
                      lineHeight: 1.4,
                    }}
                  >
                    {turn.question}
                  </p>
                  <div
                    style={{
                      padding: "12px 14px",
                      borderRadius: 8,
                      background: "rgba(255,255,255,0.02)",
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    <p
                      style={{
                        fontSize: 11,
                        color: "var(--text-dim)",
                        letterSpacing: "0.08em",
                        marginBottom: 6,
                        fontFamily: "var(--font-body)",
                      }}
                    >
                      YOU SAID
                    </p>
                    <p
                      style={{
                        fontFamily: "var(--font-body)",
                        fontSize: 13,
                        color: "var(--text-secondary)",
                        lineHeight: 1.6,
                      }}
                    >
                      {turn.user_answer || "[No speech detected]"}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        <section style={{ marginBottom: 80 }}>
          <SectionHeader label="SECTION 04" title="Hiring Signal" />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.1fr", gap: 28, alignItems: "start" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 18px",
                    borderRadius: 999,
                    border: `1px solid ${getScoreColor(avgScore)}50`,
                    background: `${getScoreColor(avgScore)}12`,
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: 22,
                      fontWeight: 800,
                      color: getScoreColor(avgScore),
                    }}
                  >
                    {avgScore.toFixed(1)}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: 12,
                      color: "var(--text-page-muted)",
                    }}
                  >
                    / 10
                  </span>
                </div>
                <span
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: 12,
                    color: "var(--text-page-muted)",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase" as const,
                  }}
                >
                  Overall Score
                </span>
              </div>

              <div
                className="glass-card radar-chart-wrapper"
                style={{ padding: "16px 16px 8px", marginBottom: 20, height: 280, overflow: "hidden" }}
              >
                <MiruRadarChart scores={safeScores} />
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="glass-card" style={{ padding: "20px 22px", borderColor: "rgba(108,99,255,0.2)" }}>
                <p
                  style={{
                    fontSize: 10,
                    color: "var(--accent-primary)",
                    letterSpacing: "0.1em",
                    fontFamily: "var(--font-body)",
                    fontWeight: 700,
                    marginBottom: 10,
                  }}
                >
                  HIRING SIGNAL
                </p>
                <p
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: 13,
                    color: "var(--text-secondary)",
                    lineHeight: 1.7,
                  }}
                >
                  {hiringSignal || "Assessment pending."}
                </p>
              </div>

              {company && (
                <div className="insight-card">
                  <span className="insight-label">{company.toUpperCase()} INTERVIEW</span>
                  <p className="insight-body">Session ID: {sessionId.slice(0, 8)}</p>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      <div
        className="no-print"
        style={{
          position: "fixed",
          bottom: 32,
          right: 32,
          zIndex: 100,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <motion.button
          onClick={() => window.print()}
          whileHover={{ scale: 1.04, boxShadow: "0 0 28px rgba(108,99,255,0.45)" }}
          whileTap={{ scale: 0.97 }}
          style={{
            padding: "13px 22px",
            borderRadius: 12,
            background: "linear-gradient(135deg, var(--accent-primary), #8B5CF6)",
            border: "none",
            color: "#fff",
            fontFamily: "var(--font-body)",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: "0 4px 24px rgba(108,99,255,0.3)",
            letterSpacing: "0.02em",
          }}
        >
          Download Report
        </motion.button>
        <motion.button
          onClick={handlePracticeAgain}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          style={{
            padding: "11px 22px",
            borderRadius: 12,
            border: "1px solid var(--border-active)",
            background: "rgba(13,13,20,0.85)",
            backdropFilter: "blur(12px)",
            color: "var(--text-secondary)",
            fontFamily: "var(--font-body)",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Start Again
        </motion.button>
      </div>
    </div>
  );
}
