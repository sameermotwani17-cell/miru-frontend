"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import MiruLogo from "@/components/MiruLogo";
import MiruRadarChart from "@/components/MiruRadarChart";
import ScoreBar from "@/components/ScoreBar";
import DebriefCard from "@/components/DebriefCard";
import RewriteComparison from "@/components/RewriteComparison";
import { session } from "@/lib/session";
import type { FullResults, RadarScores } from "@/lib/types";
import { DIMENSION_LABELS } from "@/lib/types";

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
    scores[a] < scores[b] ? a : b
  );
}

function getAvgScore(scores: RadarScores): number {
  const vals = Object.values(scores);
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function getScoreColor(score: number): string {
  if (score >= 7) return "var(--accent-green)";
  if (score >= 4) return "var(--accent-gold)";
  return "var(--accent-warm)";
}

export default function DebriefPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [results, setResults] = useState<FullResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const id = searchParams.get("session_id") ?? session.getSessionId();
    if (!id) {
      router.push("/");
      return;
    }

    session.setSessionId(id);

    const loadResults = async () => {
      try {
        const response = await fetch(`/api/interview/results?session_id=${encodeURIComponent(id)}`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = (await response.json()) as FullResults;
        setResults(data);
        session.setResults(data);
      } catch {
        const stored = session.getResults();
        if (stored) {
          setResults(stored);
        } else {
          setError("No results found. Please complete an interview first.");
        }
      } finally {
        setLoading(false);
      }
    };

    void loadResults();
  }, [router, searchParams]);

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
          Preparing your debrief…
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
          <button
            onClick={() => router.push("/")}
            style={{
              padding: "10px 24px",
              borderRadius: 8,
              border: "1px solid var(--border-active)",
              background: "transparent",
              color: "var(--text-primary)",
              fontFamily: "var(--font-body)",
              cursor: "pointer",
            }}
          >
            Return Home
          </button>
        </div>
      </div>
    );
  }

  const { radar, report, feedback } = results;
  const lowestDim = getLowestDimension(radar);
  const avgScore = getAvgScore(radar);
  const lowScoringTurns = feedback.turns.filter((t) => {
    const avg = Object.values(t.scores).reduce((a, b) => a + b, 0) / Object.values(t.scores).length;
    return avg < 7;
  });
  const company = session.getCompany() ?? "";
  const sessionId = session.getSessionId() ?? "";
  const companyFlag = report.company_flag?.trim() || null;

  return (
    <div className="page-light" style={{ minHeight: "100vh", paddingBottom: 120 }}>

      {/* Print-only header (hidden on screen) */}
      <div className="print-header">
        <h1>MIRU — Interview Report</h1>
        <p>
          Company: {company || "—"} · Date: {new Date().toLocaleDateString()} · Session: {sessionId.slice(0, 8)}
        </p>
      </div>

      {/* Nav */}
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

      <div
        style={{
          maxWidth: 900,
          margin: "0 auto",
          padding: "60px 24px 40px",
        }}
      >
        {/* Hero score */}
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

        {/* Section 1 — Score Overview */}
        <section style={{ marginBottom: 80 }}>
          <SectionHeader label="SECTION 01" title="Score Overview" />

          <div className="glass-card radar-chart-wrapper" style={{ padding: 32, marginBottom: 28 }}>
            <MiruRadarChart scores={radar} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {(Object.keys(radar) as (keyof RadarScores)[]).map((key, i) => (
              <ScoreBar
                key={key}
                label={DIMENSION_LABELS[key]}
                score={radar[key]}
                delay={i * 0.05}
                highlight={key === lowestDim}
              />
            ))}
          </div>
        </section>

        {/* Section 2 — HR Monologue */}
        <section style={{ marginBottom: 80 }}>
          <SectionHeader label="SECTION 02" title="Internal HR Monologue" />
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 14,
              color: "var(--text-page-body)",
              marginBottom: 28,
              lineHeight: 1.6,
            }}
          >
            What the interviewer was silently thinking — question by question.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {feedback.turns.length === 0 ? (
              <p style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--text-page-muted)", fontStyle: "italic" }}>
                No turn-by-turn feedback available for this session.
              </p>
            ) : (
              feedback.turns.map((turn, i) => (
                <DebriefCard key={turn.question_id} turn={turn} index={i} />
              ))
            )}
          </div>
        </section>

        {/* Section 3 — Rewrites */}
        {lowScoringTurns.length > 0 && (
          <section style={{ marginBottom: 80 }}>
            <SectionHeader label="SECTION 03" title="Answer Rewrites" />
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 14,
                color: "var(--text-page-body)",
                marginBottom: 28,
                lineHeight: 1.6,
              }}
            >
              Answers that scored below 7 — with culturally-tuned rewrites.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
              {lowScoringTurns.map((turn, i) => (
                <RewriteComparison key={turn.question_id} turn={turn} index={i} />
              ))}
            </div>
          </section>
        )}

        {/* Section 5 — Summary (2-column: left=radar+summary, right=insights) */}
        <section style={{ marginBottom: 80 }}>
          <SectionHeader label="SECTION 05" title="Full Assessment" />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1.1fr",
              gap: 28,
              alignItems: "start",
            }}
          >
            {/* LEFT — compact radar + overall summary */}
            <div>
              {/* Overall score pill */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 20,
                }}
              >
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

              {/* Compact radar */}
              <div
                className="glass-card radar-chart-wrapper"
                style={{ padding: "16px 16px 8px", marginBottom: 20, height: 280, overflow: "hidden" }}
              >
                <MiruRadarChart scores={radar} />
              </div>

              {/* Overall summary */}
              <div
                className="glass-card"
                style={{
                  padding: "20px 22px",
                  borderColor: "rgba(108,99,255,0.2)",
                }}
              >
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
                  OVERALL ASSESSMENT
                </p>
                <p
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: 13,
                    color: "var(--text-secondary)",
                    lineHeight: 1.7,
                  }}
                >
                  {report.overall_summary}
                </p>
              </div>
            </div>

            {/* RIGHT — strengths, improvements, focus, company flag */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Strengths */}
              <div className="glass-card" style={{ padding: 22 }}>
                <p
                  style={{
                    fontSize: 11,
                    color: "var(--accent-green)",
                    letterSpacing: "0.1em",
                    fontFamily: "var(--font-body)",
                    fontWeight: 600,
                    marginBottom: 12,
                  }}
                >
                  STRENGTHS
                </p>
                {report.strengths.length === 0 ? (
                  <p style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--text-secondary)", fontStyle: "italic" }}>
                    No specific strengths noted.
                  </p>
                ) : (
                  <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    {report.strengths.map((s, i) => (
                      <li
                        key={i}
                        style={{
                          fontFamily: "var(--font-body)",
                          fontSize: 13,
                          color: "var(--text-secondary)",
                          lineHeight: 1.6,
                          paddingBottom: 8,
                          borderBottom:
                            i < report.strengths.length - 1
                              ? "1px solid var(--border-subtle)"
                              : "none",
                          marginBottom: 8,
                          paddingLeft: 12,
                          position: "relative",
                        }}
                      >
                        <span style={{ position: "absolute", left: 0, color: "var(--accent-green)" }}>·</span>
                        {s}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Areas to Improve */}
              <div className="glass-card" style={{ padding: 22 }}>
                <p
                  style={{
                    fontSize: 11,
                    color: "var(--accent-warm)",
                    letterSpacing: "0.1em",
                    fontFamily: "var(--font-body)",
                    fontWeight: 600,
                    marginBottom: 12,
                  }}
                >
                  AREAS TO IMPROVE
                </p>
                {report.improvement_areas.length === 0 ? (
                  <p style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--text-secondary)", fontStyle: "italic" }}>
                    No improvement areas noted.
                  </p>
                ) : (
                  <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    {report.improvement_areas.map((s, i) => (
                      <li
                        key={i}
                        style={{
                          fontFamily: "var(--font-body)",
                          fontSize: 13,
                          color: "var(--text-secondary)",
                          lineHeight: 1.6,
                          paddingBottom: 8,
                          borderBottom:
                            i < report.improvement_areas.length - 1
                              ? "1px solid var(--border-subtle)"
                              : "none",
                          marginBottom: 8,
                          paddingLeft: 12,
                          position: "relative",
                        }}
                      >
                        <span style={{ position: "absolute", left: 0, color: "var(--accent-warm)" }}>·</span>
                        {s}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Recommended Focus */}
              {report.recommended_focus && (
                <div
                  className="glass-card"
                  style={{
                    padding: "18px 22px",
                    borderColor: "rgba(108,99,255,0.25)",
                  }}
                >
                  <p
                    style={{
                      fontSize: 11,
                      color: "var(--accent-primary)",
                      letterSpacing: "0.1em",
                      fontFamily: "var(--font-body)",
                      fontWeight: 600,
                      marginBottom: 8,
                    }}
                  >
                    RECOMMENDED FOCUS
                  </p>
                  <p
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: 13,
                      color: "var(--text-secondary)",
                      lineHeight: 1.6,
                    }}
                  >
                    {report.recommended_focus}
                  </p>
                </div>
              )}

              {/* Company Flag */}
              {loading ? (
                <div className="insight-card">
                  <div className="shimmer" style={{ height: 12, width: 120, marginBottom: 12 }} />
                  <div className="shimmer" style={{ height: 14, width: "90%", marginBottom: 8 }} />
                  <div className="shimmer" style={{ height: 14, width: "70%" }} />
                </div>
              ) : companyFlag ? (
                <div className="insight-card">
                  <span className="insight-label">{company.toUpperCase()} INSIGHT</span>
                  <p className="insight-body">{companyFlag}</p>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </div>

      {/* Fixed bottom-right PDF download FAB */}
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
          ↓ Download Report
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
