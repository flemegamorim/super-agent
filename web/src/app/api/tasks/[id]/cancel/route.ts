import { NextRequest, NextResponse } from "next/server";
import { getTask, updateTask } from "@/lib/db";
import { abortSession } from "@/lib/opencode";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const task = getTask(id);

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  if (task.status !== "running") {
    return NextResponse.json({ error: "Task is not running" }, { status: 400 });
  }

  if (task.session_id) {
    try {
      await abortSession(task.session_id);
    } catch (err) {
      console.error("Failed to abort session:", err);
    }
  }

  const updated = updateTask(id, { status: "cancelled" });
  return NextResponse.json(updated);
}
