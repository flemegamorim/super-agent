import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { createTask, getTask, listTasks, updateTask, getActiveSystemPrompt, getActiveRetryPrefs } from "@/lib/db";
import { listOutputFiles } from "@/lib/files";
import { createSession, sendPrompt } from "@/lib/opencode";
import { sendTaskNotificationEmail } from "@/lib/email";
import { downloadToLocal } from "@/lib/s3";

interface CreateTaskBody {
  title: string;
  instructions?: string;
  s3Keys: string[];
  notification_email?: string;
  notify_on_success?: boolean;
  notify_on_error?: boolean;
}

export async function GET() {
  const tasks = listTasks();
  return NextResponse.json(tasks);
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as CreateTaskBody;

  if (!body.title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  if (!Array.isArray(body.s3Keys) || body.s3Keys.length === 0) {
    return NextResponse.json(
      { error: "At least one file is required" },
      { status: 400 },
    );
  }

  const taskId = uuidv4();

  const savedFiles = await Promise.all(
    body.s3Keys.map((key) => downloadToLocal(key, taskId)),
  );

  const retryPrefs = getActiveRetryPrefs();

  const task = createTask({
    id: taskId,
    title: body.title,
    instructions: body.instructions,
    input_files: savedFiles,
    notification_email: body.notification_email,
    notify_on_success: body.notify_on_success ?? false,
    notify_on_error: body.notify_on_error ?? false,
    retry_count: retryPrefs.default_retry_count,
    retry_interval_minutes: retryPrefs.default_retry_interval_minutes,
  });

  launchTask(taskId, body.title, body.instructions ?? null, savedFiles, 0, retryPrefs.default_retry_count, retryPrefs.default_retry_interval_minutes).catch(
    async (err) => {
      console.error(`Failed to launch task ${taskId}:`, err);
      const hasOutput = listOutputFiles(taskId).length > 0;
      if (hasOutput) {
        updateTask(taskId, { status: "completed" });
      } else {
        const message =
          err instanceof Error
            ? [err.message, err.stack].filter(Boolean).join("\n\n")
            : String(err);
        updateTask(taskId, { status: "failed", error: message });
      }
      const updatedTask = getTask(taskId);
      if (updatedTask) await sendTaskNotificationEmail(updatedTask);
    },
  );

  return NextResponse.json(task, { status: 201 });
}

export async function launchTask(
  taskId: string,
  title: string,
  instructions: string | null,
  files: string[],
  attempt: number,
  retryCount: number,
  retryIntervalMinutes: number,
) {
  const session = await createSession(`Task: ${title}`);
  if (!session) throw new Error("Failed to create OpenCode session");
  updateTask(taskId, { session_id: session.id, status: "running", next_retry_at: null });

  const systemPrompt = getActiveSystemPrompt();
  const fileList = files.map((f) => `- ${f}`).join("\n");
  const prompt = [
    systemPrompt ? `${systemPrompt}\n\n---\n\n` : "",
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

      if (attempt < retryCount) {
        const nextRetryAt = new Date(Date.now() + retryIntervalMinutes * 60_000).toISOString();
        updateTask(taskId, { status: "failed", error: message, retry_attempt: attempt, next_retry_at: nextRetryAt });
        setTimeout(() => {
          updateTask(taskId, { retry_attempt: attempt + 1, next_retry_at: null, status: "running" });
          launchTask(taskId, title, instructions, files, attempt + 1, retryCount, retryIntervalMinutes).catch(async (retryErr) => {
            console.error(`Auto-retry ${attempt + 1} failed for task ${taskId}:`, retryErr);
            const hasOutputOnRetry = listOutputFiles(taskId).length > 0;
            if (hasOutputOnRetry) {
              updateTask(taskId, { status: "completed" });
            } else {
              const retryMessage = retryErr instanceof Error
                ? [retryErr.message, retryErr.stack].filter(Boolean).join("\n\n")
                : String(retryErr);
              updateTask(taskId, { status: "failed", error: retryMessage, next_retry_at: null });
            }
            const finalTask = getTask(taskId);
            if (finalTask) await sendTaskNotificationEmail(finalTask);
          });
        }, retryIntervalMinutes * 60_000);

        const scheduledTask = getTask(taskId);
        if (scheduledTask) await sendTaskNotificationEmail(scheduledTask);
        return;
      }

      updateTask(taskId, { status: "failed", error: message, next_retry_at: null });
    }
  }

  const finalTask = getTask(taskId);
  if (finalTask) await sendTaskNotificationEmail(finalTask);
}
