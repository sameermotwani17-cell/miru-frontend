import type { RadarScores } from "./types";

export function normalizeScores(data: any): RadarScores {
  const raw = data?.radar_scores ?? data?.scores ?? {};

  return {
    wa_teamwork: Number(raw.wa_teamwork ?? 0),
    loyalty_commitment: Number(raw.loyalty_commitment ?? 0),
    humility: Number(raw.humility ?? 0),
    kaizen_growth: Number(raw.kaizen_growth ?? 0),
    cultural_fit: Number(raw.cultural_fit ?? 0),
  };
}
