import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { createTask, listTasks, updateTask } from "@/lib/db";
import { saveUploadedFile } from "@/lib/files";
import { createSession, sendPrompt } from "@/lib/opencode";

export async function GET() {
  const tasks = listTasks();
  return NextResponse.json(tasks);
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const title = formData.get("title") as string;
  const instructions = formData.get("instructions") as string | null;
  const files = formData.getAll("files") as File[];

  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  if (files.length === 0) {
    return NextResponse.json({ error: "At least one file is required" }, { status: 400 });
  }

  const taskId = uuidv4();
  const savedFiles: string[] = [];

  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const filePath = await saveUploadedFile(taskId, file.name, buffer);
    savedFiles.push(filePath);
  }

  const task = createTask({
    id: taskId,
    title,
    instructions: instructions || undefined,
    input_files: savedFiles,
  });

  // Launch the OpenCode session asynchronously
  launchTask(taskId, title, instructions, savedFiles).catch((err) => {
    console.error(`Failed to launch task ${taskId}:`, err);
    updateTask(taskId, { status: "failed", error: err.message });
  });

  return NextResponse.json(task, { status: 201 });
}

async function launchTask(
  taskId: string,
  title: string,
  instructions: string | null,
  files: string[],
) {
  const session = await createSession(`Task: ${title}`);
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
    const message = err instanceof Error ? err.message : "Unknown error";
    updateTask(taskId, { status: "failed", error: message });
  }
}
