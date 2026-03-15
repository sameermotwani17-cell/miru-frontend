import { NextRequest, NextResponse } from "next/server";

const BACKEND_BASE =
  process.env.NEXT_PUBLIC_API_URL ??
  "https://miru-backend-production.up.railway.app";

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("session_id")?.trim();
  const checkStatus = request.nextUrl.searchParams.get("check") === "status";

  if (!sessionId) {
    return NextResponse.json(
      { detail: "Missing required query param: session_id" },
      { status: 400 }
    );
  }

  // Debrief-status check: proxy to the backend status endpoint
  if (checkStatus) {
    try {
      const statusRes = await fetch(
        `${BACKEND_BASE}/api/interview/${encodeURIComponent(sessionId)}/debrief-status`,
        { method: "GET", cache: "no-store" }
      );
      const body = await statusRes.json().catch(() => null);
      return NextResponse.json(body ?? {}, { status: statusRes.status });
    } catch {
      return NextResponse.json({ detail: "Status check unavailable." }, { status: 502 });
    }
  }

  const candidateUrls = [
    `${BACKEND_BASE}/api/interview/results?session_id=${encodeURIComponent(sessionId)}`,
    `${BACKEND_BASE}/api/interview/${encodeURIComponent(sessionId)}/results`,
  ];

  let lastStatus = 502;
  let lastBody: unknown = { detail: "Failed to fetch interview results." };

  for (const url of candidateUrls) {
    try {
      const response = await fetch(url, {
        method: "GET",
        cache: "no-store",
      });

      const body = await response.json().catch(() => null);

      if (response.ok) {
        return NextResponse.json(body, { status: 200 });
      }

      lastStatus = response.status;
      lastBody = body ?? { detail: `Upstream error: ${response.status}` };
    } catch {
      lastStatus = 502;
      lastBody = { detail: "Upstream request failed." };
    }
  }

  return NextResponse.json(lastBody, { status: lastStatus });
}
