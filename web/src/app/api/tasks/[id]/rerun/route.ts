import { NextRequest, NextResponse } from "next/server";
import { getTask, updateTask } from "@/lib/db";
import { listOutputFiles } from "@/lib/files";
import { createSession, sendPrompt } from "@/lib/opencode";
import { sendTaskNotificationEmail } from "@/lib/email";

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

  rerunTask(id, task.title, task.instructions, task.input_files).catch((err) => {
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
    if (updatedTask) sendTaskNotificationEmail(updatedTask);
  });

  const updated = updateTask(id, { status: "running", error: null });
  return NextResponse.json(updated);
}

async function rerunTask(
  taskId: string,
  title: string,
  instructions: string | null,
  files: string[],
) {
  const session = await createSession(`Re-run: ${title}`);
  if (!session) throw new Error("Failed to create OpenCode session");
  updateTask(taskId, { session_id: session.id, status: "running" });

  const fileList = files.map((f) => `- ${f}`).join("\n");
  const prompt = [
    `Process the following input files:\n${fileList}`,
    instructions ? `\nAdditional instructions: ${instructions}` : "",
    `\nWrite all output files to the ./output/${taskId}/ directory.`,
    `\nWhen done, list all generated output files.`,
  ].join("");

  try {
    await sendPrompt(session.id, prompt);
    updateTask(taskId, { status: "completed" });
  } catch (err: unknown) {
    const hasOutput = listOutputFiles(taskId).length > 0;
    if (hasOutput) {
      updateTask(taskId, { status: "completed" });
    } else {
      const message = err instanceof Error
        ? [err.message, err.stack].filter(Boolean).join("\n\n")
        : "Unknown error";
      updateTask(taskId, { status: "failed", error: message });
    }
  }

  const finalTask = getTask(taskId);
  if (finalTask) await sendTaskNotificationEmail(finalTask);
}
