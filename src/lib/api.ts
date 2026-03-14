import type {
  StartPayload,
  StartResponse,
  TurnResponse,
  InterviewTurnResponse,
  FullResults,
  RadarScores,
  FinalReport,
  Transcript,
  TranscriptHistoryItem,
} from "./types";

function normalizeCompanyForBackend(company: string): string {
  const raw = company.trim().toLowerCase();
  const map: Record<string, string> = {
    toyota: "toyota",
    rakuten: "rakuten",
    sony: "sony",
    softbank: "softbank",
    uniqlo: "uniqlo",
  };

  return map[raw] ?? raw;
}

const BASE = process.env.NEXT_PUBLIC_API_URL;

class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      message = body.detail ?? body.message ?? message;
    } catch {
      // ignore parse errors
    }
    throw new ApiError(res.status, message);
  }

  return res.json() as Promise<T>;
}

export async function startInterview(
  payload: StartPayload
): Promise<StartResponse> {
  return request<StartResponse>("/api/session/start", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function submitTurn(
  sessionId: string,
  answer: string,
  languageMode: string
): Promise<TurnResponse> {
  return request<TurnResponse>("/api/interview/turn", {
    method: "POST",
    body: JSON.stringify({
      session_id: sessionId,
      user_answer: answer,
      language_mode: languageMode,
    }),
  });
}

export async function sendInterviewTurn(
  userAnswer: string,
  sessionId: string,
  company: string,
  cvContext: object,
  transcriptHistory: TranscriptHistoryItem[],
  language: "en" | "jp"
): Promise<InterviewTurnResponse> {
  const normalizedCompany = normalizeCompanyForBackend(company);
  const safeAnswer = userAnswer.trim().length === 0 ? "start" : userAnswer;

  const response = await fetch(
    "https://miru-backend-production.up.railway.app/api/interview/turn",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session_id: sessionId,
        user_answer: safeAnswer,
        cv_context: cvContext,
        transcript_history: transcriptHistory,
        language,
        company: normalizedCompany,
      }),
    }
  );

  if (!response.ok) {
    let messageText = `HTTP ${response.status}`;
    try {
      const body = await response.json();
      messageText = body.detail ?? body.message ?? messageText;
    } catch {
      // ignore parse errors
    }
    throw new ApiError(response.status, messageText);
  }

  return response.json() as Promise<InterviewTurnResponse>;
}

export async function getResults(sessionId: string): Promise<FullResults> {
  return request<FullResults>(`/api/interview/${sessionId}/results`);
}

export async function getRadar(sessionId: string): Promise<RadarScores> {
  return request<RadarScores>(`/api/interview/${sessionId}/radar`);
}

export async function getReport(sessionId: string): Promise<FinalReport> {
  return request<FinalReport>(`/api/interview/${sessionId}/report`);
}

export async function getFeedback(
  sessionId: string
): Promise<{ turns: import("./types").TurnFeedback[] }> {
  return request<{ turns: import("./types").TurnFeedback[] }>(
    `/api/interview/${sessionId}/feedback`
  );
}

export async function getTranscript(sessionId: string): Promise<Transcript> {
  return request<Transcript>(`/api/interview/${sessionId}/transcript`);
}
