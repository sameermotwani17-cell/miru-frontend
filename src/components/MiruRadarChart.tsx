"use client";

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { RadarScores } from "@/lib/types";
import { DIMENSION_LABELS } from "@/lib/types";

interface MiruRadarChartProps {
  scores: RadarScores;
}

const IDEAL_SCORES: RadarScores = {
  wa_teamwork: 9,
  loyalty_commitment: 9,
  humility: 8,
  kaizen_growth: 8,
  cultural_fit: 9,
};

export default function MiruRadarChart({ scores }: MiruRadarChartProps) {
  const data = (Object.keys(scores) as (keyof RadarScores)[]).map((key) => ({
    dimension: DIMENSION_LABELS[key],
    candidate: Number(scores[key] ?? 0),
    ideal: IDEAL_SCORES[key],
    fullMark: 10,
  }));

  return (
    <div>
      <p
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 15,
          fontWeight: 700,
          color: "var(--text-primary)",
          marginBottom: 12,
          textAlign: "center",
        }}
      >
        Japanese Hiring Signal Profile
      </p>

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 16,
          marginBottom: 8,
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--text-secondary)" }}>
          <span style={{ color: "#8884d8", marginRight: 6 }}>●</span>
          Ideal Japanese Candidate
        </span>
        <span style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--text-secondary)" }}>
          <span style={{ color: "#00C49F", marginRight: 6 }}>●</span>
          Your Interview Signals
        </span>
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <RadarChart data={data} margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
          <PolarGrid gridType="polygon" stroke="rgba(108,99,255,0.15)" />
          <PolarAngleAxis
            dataKey="dimension"
            tick={{
              fill: "var(--text-secondary)",
              fontSize: 11,
              fontFamily: "var(--font-body)",
            }}
          />
          <Tooltip
            formatter={(value, name) => {
              const numeric = typeof value === "number" ? value : Number(value);
              const formattedValue = Number.isFinite(numeric) ? numeric.toFixed(1) : "-";
              const label = String(name) === "candidate" ? "Your Score" : "Ideal Score";
              return [formattedValue, label];
            }}
            labelFormatter={(label) => `Dimension: ${String(label ?? "")}`}
            contentStyle={{
              background: "rgba(13,13,20,0.95)",
              border: "1px solid var(--border-subtle)",
              borderRadius: 8,
              color: "var(--text-primary)",
              fontFamily: "var(--font-body)",
            }}
          />
          <Radar
            name="Ideal Japanese Candidate"
            dataKey="ideal"
            stroke="#8884d8"
            fill="#8884d8"
            fillOpacity={0.1}
            dot={false}
          />
          <Radar
            name="Your Interview Signals"
            dataKey="candidate"
            stroke="#00C49F"
            fill="#00C49F"
            fillOpacity={0.55}
            dot={{
              r: 4,
              fill: "#00C49F",
              strokeWidth: 0,
            }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
