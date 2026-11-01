import { NextResponse } from "next/server";

export const maxDuration = 300;

const PIPELINE_URL = process.env.PIPELINE_URL ?? "http://127.0.0.1:8765";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { question?: unknown };
  const question = String(body.question ?? "").trim();
  if (!question) {
    return NextResponse.json({ error: "Question is required." }, { status: 400 });
  }

  try {
    const response = await fetch(`${PIPELINE_URL}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
      signal: AbortSignal.timeout(180_000),
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json(
      {
        error:
          "The retrieval pipeline is not running. In another terminal, run npm run pipeline.",
      },
      { status: 503 },
    );
  }
}
