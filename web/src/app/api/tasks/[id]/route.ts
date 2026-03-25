import { NextRequest, NextResponse } from "next/server";
import { getTask, deleteTask } from "@/lib/db";
import { deleteTaskDirs } from "@/lib/files";
import { deleteObjects, s3Key } from "@/lib/s3";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const task = getTask(id);
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  return NextResponse.json(task);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const task = getTask(id);
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  // Remove local input/output directories
  deleteTaskDirs(id);

  // Remove S3 input objects (best-effort)
  try {
    const s3Keys = task.input_files.map((f) => {
      const filename = f.split(/[\\/]/).pop() ?? f;
      return s3Key(id, filename);
    });
    await deleteObjects(s3Keys);
  } catch {
    // S3 cleanup is best-effort; proceed with DB deletion
  }

  const deleted = deleteTask(id);
  if (!deleted) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
