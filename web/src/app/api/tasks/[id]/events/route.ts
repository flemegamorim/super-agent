import { NextRequest } from "next/server";
import { getTask } from "@/lib/db";

const OPENCODE_URL = process.env.OPENCODE_URL || "http://127.0.0.1:4096";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const task = getTask(id);

  if (!task || !task.session_id) {
    return new Response("Task not found or no session", { status: 404 });
  }

  const sessionId = task.session_id;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const response = await fetch(`${OPENCODE_URL}/event`, {
          headers: { Accept: "text/event-stream" },
        });

        if (!response.body) {
          controller.close();
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data:")) continue;

            try {
              const data = JSON.parse(line.slice(5).trim());
              if (
                data.properties?.sessionID === sessionId ||
                data.type === "session.status"
              ) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
                );
              }
            } catch {
              // skip non-JSON lines
            }
          }
        }
      } catch (err) {
        console.error("SSE proxy error:", err);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
