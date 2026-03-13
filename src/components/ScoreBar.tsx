"use client";

import { motion } from "framer-motion";

interface ScoreBarProps {
  label: string;
  score: number;
  delay?: number;
  highlight?: boolean;
}

function getScoreColor(score: number): string {
  if (score >= 7) return "var(--accent-green)";
  if (score >= 4) return "var(--accent-gold)";
  return "var(--accent-warm)";
}

export default function ScoreBar({
  label,
  score,
  delay = 0,
  highlight = false,
}: ScoreBarProps) {
  const color = getScoreColor(score);
  const pct = (score / 10) * 100;

  return (
    <div
      style={{
        padding: "14px 18px",
        borderRadius: 10,
        background: highlight
          ? "rgba(255,107,107,0.05)"
          : "rgba(13,13,20,0.5)",
        border: `1px solid ${highlight ? "rgba(255,107,107,0.2)" : "var(--border-subtle)"}`,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 13,
            color: highlight ? "var(--accent-warm)" : "var(--text-secondary)",
            fontWeight: highlight ? 600 : 400,
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 16,
            fontWeight: 700,
            color,
          }}
        >
          {score.toFixed(1)}
        </span>
      </div>

      <div className="score-bar-track">
        <motion.div
          initial={{ width: 0 }}
          whileInView={{ width: `${pct}%` }}
          viewport={{ once: true }}
          transition={{
            duration: 0.8,
            delay,
            ease: [0.16, 1, 0.3, 1],
          }}
          style={{
            height: "100%",
            background: color,
            borderRadius: 999,
            boxShadow: `0 0 8px ${color}60`,
          }}
        />
      </div>
    </div>
  );
}
