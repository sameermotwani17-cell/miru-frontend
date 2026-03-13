export interface RadarScores {
  wa_teamwork: number;
  loyalty_commitment: number;
  humility: number;
  kaizen_growth: number;
  cultural_fit: number;
}

export interface TurnFeedback {
  question_id: string;
  question: string;
  answer: string;
  feedback: string;
  rewrite: string;
  scores: RadarScores;
}

export interface FinalReport {
  overall_summary: string;
  strengths: string[];
  improvement_areas: string[];
  recommended_focus: string;
  company_flag: string;
  overall_scores: RadarScores;
}

export interface FullResults {
  radar: RadarScores;
  report: FinalReport;
  feedback: { turns: TurnFeedback[] };
  transcript: { turns: { question_id: string; question: string; answer: string }[] };
}

// Real backend schema for session start
export interface StartPayload {
  user_name: string;
  target_role: string;
  company: string;
  language_mode: string;
  duration_mins: number;
}

// Real backend response
export interface StartResponse {
  session_id: string;
  timer_end_epoch: number;
}

export interface TurnPayload {
  session_id: string;
  user_answer: string;
}

export interface TurnResponse {
  response: string;
  is_complete: boolean;
  question_number: number;
}

export interface Transcript {
  turns: { question_id: string; question: string; answer: string }[];
}

export type ScoreLevel = "high" | "mid" | "low";

export function getScoreLevel(score: number): ScoreLevel {
  if (score >= 7) return "high";
  if (score >= 4) return "mid";
  return "low";
}

export const DIMENSION_LABELS: Record<keyof RadarScores, string> = {
  wa_teamwork: "和・Teamwork",
  loyalty_commitment: "忠誠・Loyalty",
  humility: "謙虚・Humility",
  kaizen_growth: "改善・Growth",
  cultural_fit: "文化・Culture",
};

export const COMPANIES = [
  {
    id: "toyota",
    name: "Toyota",
    label: "トヨタ",
    descriptor: "Kaizen-first. Most traditional.",
    accent: "#e8b84b",
    bg: "rgba(232, 184, 75, 0.08)",
  },
  {
    id: "rakuten",
    name: "Rakuten",
    label: "楽天",
    descriptor: "English accepted. Most accessible.",
    accent: "#ef4444",
    bg: "rgba(239, 68, 68, 0.08)",
  },
  {
    id: "sony",
    name: "Sony",
    label: "ソニー",
    descriptor: "Creative-formal balance.",
    accent: "#a0aec0",
    bg: "rgba(160, 174, 192, 0.08)",
  },
  {
    id: "softbank",
    name: "SoftBank",
    label: "ソフトバンク",
    descriptor: "Bold vision. Tolerant of confidence.",
    accent: "#f97316",
    bg: "rgba(249, 115, 22, 0.08)",
  },
  {
    id: "uniqlo",
    name: "Uniqlo",
    label: "ユニクロ",
    descriptor: "Operational precision. Customer-first.",
    accent: "#3b82f6",
    bg: "rgba(59, 130, 246, 0.08)",
  },
] as const;

export type CompanyId = (typeof COMPANIES)[number]["id"];

// Per-company interview questions (used client-side since backend has no turn endpoint)
export const COMPANY_QUESTIONS: Record<string, string[]> = {
  Toyota: [
    "Please introduce yourself and explain why you applied to Toyota specifically.",
    "Describe a situation where you identified and improved an inefficient process. What steps did you take?",
    "At Toyota, we value long-term thinking. Describe a decision you made with long-term impact in mind.",
    "How do you respond when a senior colleague disagrees with your approach?",
    "What does 'quality first' mean to you, and how have you applied it in practice?",
  ],
  Rakuten: [
    "Please introduce yourself and explain why Rakuten's global mission resonates with you.",
    "Describe a time you worked in or led a cross-cultural team. What was the result?",
    "How do you approach setting and tracking ambitious targets?",
    "Rakuten values speed and execution. Tell me about your fastest successful project delivery.",
    "How would you improve one of Rakuten's existing services based on your own experience?",
  ],
  Sony: [
    "Please introduce yourself and tell me what creative project you're most proud of.",
    "Describe a time you balanced technical constraints with a creative vision.",
    "How do you stay current with technology and market trends?",
    "Tell me about a cross-functional collaboration that resulted in something truly innovative.",
    "What does 'Kando' — emotional connection — mean to you as a working professional?",
  ],
  SoftBank: [
    "Please introduce yourself and describe the boldest professional move you have made.",
    "SoftBank bets on transformative vision. What technology or trend would you invest in and why?",
    "Tell me about a time you convinced others to adopt an unconventional idea.",
    "How do you maintain motivation and momentum on very long-horizon goals?",
    "Describe a failure that taught you the most valuable lesson of your career.",
  ],
  Uniqlo: [
    "Please introduce yourself and explain your interest in Uniqlo's LifeWear philosophy.",
    "Tell me about a time you significantly improved a customer-facing process.",
    "How do you manage multiple competing priorities under pressure?",
    "Describe a time you had to adapt quickly to an unexpected change.",
    "What does operational precision mean to you, and how do you achieve it daily?",
  ],
};

// Default questions if company not found
export const DEFAULT_QUESTIONS = [
  "Please introduce yourself and explain your motivation for applying.",
  "Describe a professional challenge you faced and how you overcame it.",
  "How do you approach teamwork and collaboration in your work?",
  "Tell me about a time you demonstrated commitment to long-term goals.",
  "What are your key strengths and how do you apply them at work?",
];

// Canned HR reactions shown after each answer
export const MIRU_REACTIONS = [
  "I see. Thank you for sharing that perspective.",
  "Understood. Your experience is noted. Let us continue.",
  "Interesting. I will factor that into the overall assessment.",
  "Thank you. Moving on to the next topic.",
  "Good. Let us proceed.",
];

// Company-specific cultural insight shown in debrief
export const COMPANY_FLAGS: Record<string, string> = {
  Toyota: "Toyota evaluates candidates heavily on 'nemawashi' — building consensus before driving change. Showing awareness of this process, and patience with hierarchical approval, signals strong cultural alignment.",
  Rakuten: "Rakuten's Englishization policy means fluency and cross-cultural confidence are directly scored. Data literacy and clear ownership of KPIs are baseline expectations at all levels.",
  Sony: "Sony values the balance between creative risk-taking and structured delivery. Candidates who can articulate both their creative instincts AND a disciplined methodology stand out significantly.",
  SoftBank: "SoftBank HR evaluates 'vision boldness' — how concretely and confidently you articulate transformative ideas. Vague ambition scores low; specific, large-scale vision with clear rationale scores high.",
  Uniqlo: "Uniqlo values 'genchi genbutsu' — going directly to the source to understand reality. Hands-on problem-solving and direct customer empathy are valued far above abstract strategic thinking.",
};

// Score a single answer locally (used in interview page)
export function scoreAnswer(answer: string): RadarScores {
  const text = answer.toLowerCase().trim();
  const words = text.split(/\s+/).filter((w) => w.length > 2);
  const len = words.length;

  const base = len === 0 ? 2 : Math.min(7.5, 3 + len * 0.18);

  const kw = (keywords: string[]) =>
    Math.min(2.0, keywords.filter((k) => text.includes(k)).length * 0.6);

  const clamp = (v: number) => +Math.min(10, Math.max(1, v)).toFixed(1);

  return {
    wa_teamwork: clamp(base + kw(["team", "together", "colleague", "collaborate", "support", "group", "member", "shared"])),
    loyalty_commitment: clamp(base + kw(["commit", "dedicated", "long-term", "purpose", "mission", "contribute", "loyal", "stay"])),
    humility: clamp(base + kw(["learn", "mistake", "feedback", "appreciate", "guidance", "improve", "reflect", "listen"])),
    kaizen_growth: clamp(base + kw(["improve", "grow", "develop", "progress", "kaizen", "better", "efficiency", "optimize", "process"])),
    cultural_fit: clamp(base + kw(["japan", "japanese", "culture", "adapt", "respect", "harmony", "tradition", "value", "philosophy"])),
  };
}

// Build full results from local interview data
export function buildResults(
  questions: string[],
  answers: string[],
  turnScores: RadarScores[],
  company: string,
  name: string
): FullResults {
  const keys = Object.keys(turnScores[0]) as (keyof RadarScores)[];
  const radar = Object.fromEntries(
    keys.map((k) => [
      k,
      +(turnScores.reduce((s, t) => s + t[k], 0) / turnScores.length).toFixed(1),
    ])
  ) as RadarScores;

  const turns: TurnFeedback[] = questions.map((q, i) => {
    const scores = turnScores[i];
    const avg = Object.values(scores).reduce((a, b) => a + b, 0) / 5;
    const feedback =
      avg >= 7
        ? "Strong answer. Clear cultural alignment and specific framing. The interviewer noted this positively."
        : avg >= 5
        ? "Adequate response. Adding more concrete examples and culturally-resonant language would elevate this significantly."
        : "This answer needs more depth. Focus on specific situations, measurable outcomes, and explicit connection to company values.";

    const rewrite = `A stronger version of this answer would: (1) open with a specific, real example, (2) explicitly name how it connects to ${company}'s values, and (3) close with what you personally learned or contributed. Keep it concise — under 90 seconds.`;

    return {
      question_id: `q${i + 1}`,
      question: q,
      answer: answers[i] || "[No speech detected]",
      feedback,
      rewrite,
      scores,
    };
  });

  const allEntries = Object.entries(radar) as [keyof RadarScores, number][];
  const sorted = [...allEntries].sort((a, b) => b[1] - a[1]);
  const topDims = sorted.slice(0, 2).map(([k]) => DIMENSION_LABELS[k]);
  const weakDims = sorted.slice(-2).map(([k]) => DIMENSION_LABELS[k]);
  const avgOverall = Object.values(radar).reduce((a, b) => a + b, 0) / 5;

  const report: FinalReport = {
    overall_summary: `${name} demonstrated ${avgOverall >= 7 ? "strong" : avgOverall >= 5 ? "developing" : "early-stage"} cultural readiness for ${company}. Communication was ${avgOverall >= 6 ? "clear and structured with notable moments of alignment" : "present, but would benefit substantially from more specific examples and culturally-aware framing"}.`,
    strengths: topDims.map((d) => `${d} — shown through clear framing and relevant examples`),
    improvement_areas: weakDims.map((d) => `${d} — needs more culturally-aligned language and concrete specifics`),
    recommended_focus: `Practice framing all answers through ${company}'s core cultural lens. Your next session should focus on strengthening ${DIMENSION_LABELS[sorted[sorted.length - 1][0]]} alignment specifically.`,
    company_flag: COMPANY_FLAGS[company] ?? `Research ${company}'s cultural pillars deeply and weave them naturally into every answer.`,
    overall_scores: radar,
  };

  return {
    radar,
    report,
    feedback: { turns },
    transcript: {
      turns: questions.map((q, i) => ({
        question_id: `q${i + 1}`,
        question: q,
        answer: answers[i] || "",
      })),
    },
  };
}
