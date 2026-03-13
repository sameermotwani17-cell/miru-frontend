"use client";

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
} from "recharts";
import type { RadarScores } from "@/lib/types";
import { DIMENSION_LABELS } from "@/lib/types";

interface MiruRadarChartProps {
  scores: RadarScores;
}

export default function MiruRadarChart({ scores }: MiruRadarChartProps) {
  const data = (Object.keys(scores) as (keyof RadarScores)[]).map((key) => ({
    subject: DIMENSION_LABELS[key],
    score: scores[key],
    fullMark: 10,
  }));

  return (
    <ResponsiveContainer width="100%" height={320}>
      <RadarChart data={data} margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
        <PolarGrid
          gridType="polygon"
          stroke="rgba(108,99,255,0.15)"
        />
        <PolarAngleAxis
          dataKey="subject"
          tick={{
            fill: "var(--text-secondary)",
            fontSize: 11,
            fontFamily: "var(--font-body)",
          }}
        />
        {/* Ghost ideal */}
        <Radar
          name="ideal"
          dataKey="fullMark"
          stroke="rgba(108,99,255,0.15)"
          fill="rgba(108,99,255,0.05)"
          fillOpacity={1}
        />
        {/* Actual scores */}
        <Radar
          name="score"
          dataKey="score"
          stroke="var(--accent-primary)"
          fill="var(--accent-primary)"
          fillOpacity={0.28}
          dot={{
            r: 4,
            fill: "var(--accent-primary)",
            strokeWidth: 0,
          }}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
