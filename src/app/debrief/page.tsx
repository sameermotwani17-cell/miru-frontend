"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
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
          color: "var(--accent-secondary)",
          letterSpacing: "0.14em",
          fontFamily: "var(--font-body)",
          marginBottom: 6,
        }}
      >
        {label}
      </p>
      <h2
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "clamp(22px, 4vw, 32px)",
          fontWeight: 700,
          color: "var(--text-primary)",
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
  const [results, setResults] = useState<FullResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const id = session.getSessionId();
    if (!id) {
      router.push("/");
      return;
    }

    const stored = session.getResults();
    if (stored) {
      setResults(stored);
    } else {
      setError("No results found. Please complete an interview first.");
    }
    setLoading(false);
  }, [router]);

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
            color: "var(--text-secondary)",
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

  return (
    <div style={{ minHeight: "100vh" }}>
      {/* Nav */}
      <nav
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
            onClick={() => window.print()}
            className="no-print"
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
            Download Report
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
          maxWidth: 860,
          margin: "0 auto",
          padding: "60px 24px 100px",
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
              color: "var(--accent-secondary)",
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
              color: "var(--text-primary)",
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
                color: "var(--text-secondary)",
              }}
            >
              / 10 overall
            </span>
          </div>
        </motion.div>

        {/* Section 1 — Score Overview */}
        <section style={{ marginBottom: 80 }}>
          <SectionHeader label="SECTION 01" title="Score Overview" />

          <div className="glass-card" style={{ padding: 32, marginBottom: 28 }}>
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
              color: "var(--text-secondary)",
              marginBottom: 28,
              lineHeight: 1.6,
            }}
          >
            What the interviewer was silently thinking — question by question.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {feedback.turns.map((turn, i) => (
              <DebriefCard key={turn.question_id} turn={turn} index={i} />
            ))}
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
                color: "var(--text-secondary)",
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

        {/* Section 4 — Company Flag */}
        <section style={{ marginBottom: 80 }}>
          <SectionHeader label="SECTION 04" title="Company Flag" />
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            style={{
              padding: "28px 32px",
              borderRadius: 16,
              border: "1px solid rgba(59,130,246,0.3)",
              background: "rgba(59,130,246,0.05)",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: 2,
                background: "linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))",
              }}
            />
            <p
              style={{
                fontSize: 11,
                color: "var(--accent-secondary)",
                letterSpacing: "0.1em",
                fontFamily: "var(--font-body)",
                fontWeight: 600,
                marginBottom: 12,
              }}
            >
              {session.getCompany()?.toUpperCase()} SPECIFIC INSIGHT
            </p>
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 16,
                color: "var(--text-primary)",
                lineHeight: 1.7,
              }}
            >
              {report.company_flag}
            </p>
          </motion.div>
        </section>

        {/* Section 5 — Summary + CTA */}
        <section style={{ marginBottom: 80 }}>
          <SectionHeader label="SECTION 05" title="Summary & Next Steps" />

          {/* Strengths + improvements */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 20,
              marginBottom: 28,
            }}
          >
            <div className="glass-card" style={{ padding: 24 }}>
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
                    <span
                      style={{
                        position: "absolute",
                        left: 0,
                        color: "var(--accent-green)",
                      }}
                    >
                      ·
                    </span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>

            <div className="glass-card" style={{ padding: 24 }}>
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
                    <span
                      style={{
                        position: "absolute",
                        left: 0,
                        color: "var(--accent-warm)",
                      }}
                    >
                      ·
                    </span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Recommended focus */}
          {report.recommended_focus && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="glass-card"
              style={{
                padding: "20px 24px",
                marginBottom: 36,
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
                  fontSize: 14,
                  color: "var(--text-primary)",
                  lineHeight: 1.6,
                }}
              >
                {report.recommended_focus}
              </p>
            </motion.div>
          )}

          {/* CTA buttons */}
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <motion.button
              onClick={handlePracticeAgain}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              style={{
                flex: 1,
                padding: "15px 24px",
                borderRadius: 12,
                background:
                  "linear-gradient(135deg, var(--accent-primary), #8B5CF6)",
                border: "none",
                color: "#fff",
                fontFamily: "var(--font-body)",
                fontSize: 15,
                fontWeight: 600,
                cursor: "pointer",
                minWidth: 180,
              }}
            >
              Practice Again
            </motion.button>
            <motion.button
              onClick={handleDifferentCompany}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              style={{
                flex: 1,
                padding: "15px 24px",
                borderRadius: 12,
                border: "1px solid var(--border-active)",
                background: "rgba(108,99,255,0.08)",
                color: "var(--text-primary)",
                fontFamily: "var(--font-body)",
                fontSize: 15,
                fontWeight: 600,
                cursor: "pointer",
                minWidth: 180,
              }}
            >
              Try a Different Company
            </motion.button>
          </div>
        </section>
      </div>
    </div>
  );
}
