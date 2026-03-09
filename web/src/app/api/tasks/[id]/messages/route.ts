import { NextRequest, NextResponse } from "next/server";
import { getTask } from "@/lib/db";
import { getSessionMessages } from "@/lib/opencode";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const task = getTask(id);

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  if (!task.session_id) {
    return NextResponse.json([]);
  }

  try {
    const messages = await getSessionMessages(task.session_id);
    return NextResponse.json(messages);
  } catch {
    return NextResponse.json([]);
  }
}
