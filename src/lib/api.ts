import type {
  StartPayload,
  StartResponse,
  TurnResponse,
  FullResults,
  RadarScores,
  FinalReport,
  Transcript,
} from "./types";

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
  answer: string
): Promise<TurnResponse> {
  return request<TurnResponse>("/api/interview/turn", {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId, user_answer: answer }),
  });
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
