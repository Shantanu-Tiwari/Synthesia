// frontend/src/app/api/research/refine/route.ts
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { report, feedback } = body;

  if (!report || !feedback) {
    return new Response(JSON.stringify({ error: "Report and feedback are required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const backendUrl = process.env.API_URL || "http://localhost:8000";

  try {
    const response = await fetch(`${backendUrl}/api/research/refine`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ report, feedback }),
    });

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
