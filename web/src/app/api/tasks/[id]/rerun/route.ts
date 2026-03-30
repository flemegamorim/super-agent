import { NextRequest, NextResponse } from "next/server";
import { getTask, updateTask } from "@/lib/db";
import { listOutputFiles } from "@/lib/files";
import { sendTaskNotificationEmail } from "@/lib/email";
import { launchTask } from "@/app/api/tasks/route";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const task = getTask(id);

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  if (task.status === "running") {
    return NextResponse.json({ error: "Task is already running" }, { status: 400 });
  }

  const updated = updateTask(id, { status: "running", error: null, retry_attempt: 0, next_retry_at: null });

  launchTask(id, task.title, task.instructions, task.input_files, 0, task.retry_count, task.retry_interval_minutes).catch(async (err) => {
    console.error(`Failed to re-run task ${id}:`, err);
    const hasOutput = listOutputFiles(id).length > 0;
    if (hasOutput) {
      updateTask(id, { status: "completed" });
    } else {
      const message = err instanceof Error
        ? [err.message, err.stack].filter(Boolean).join("\n\n")
        : String(err);
      updateTask(id, { status: "failed", error: message });
    }
    const updatedTask = getTask(id);
    if (updatedTask) await sendTaskNotificationEmail(updatedTask);
  });

  return NextResponse.json(updated);
}
