import { NextRequest } from "next/server";

const BACKEND_URL = (process.env.API_URL || "http://localhost:8000").replace(/\/$/, "");

export async function GET(request: NextRequest) {
  const topic = request.nextUrl.searchParams.get("topic");

  if (!topic) {
    return new Response(JSON.stringify({ error: "topic is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Proxy the SSE stream from FastAPI — API_URL never touches the browser
  const backendResponse = await fetch(
    `${BACKEND_URL}/api/research/stream?topic=${encodeURIComponent(topic)}`,
    {
      headers: { Accept: "text/event-stream" },
    }
  );

  if (!backendResponse.ok || !backendResponse.body) {
    return new Response(JSON.stringify({ error: "Backend unreachable" }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Stream the response back to the browser as SSE
  return new Response(backendResponse.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
