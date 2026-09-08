// frontend/src/app/api/research/route.ts
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const topic = searchParams.get("topic");

  if (!topic) {
    return new Response(JSON.stringify({ error: "Topic is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const backendUrl = process.env.API_URL || "http://localhost:8000";

  try {
    const response = await fetch(`${backendUrl}/api/research/stream?topic=${encodeURIComponent(topic)}`);

    // If FastAPI returns an error (like a 429 or 500), safely pass it through as text
    if (!response.ok) {
      const errorText = await response.text();
      return new Response(
        `data: ${JSON.stringify({ step: "error", message: errorText || "Backend failure" })}\n\n`,
        { headers: { "Content-Type": "text/event-stream" } }
      );
    }

    return new Response(response.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
      },
    });
  } catch (error: any) {
    console.error("Proxy connection error:", error);
    return new Response(
      `data: ${JSON.stringify({ step: "error", message: "Failed to connect to backend server." })}\n\n`,
      { headers: { "Content-Type": "text/event-stream" } }
    );
  }
}