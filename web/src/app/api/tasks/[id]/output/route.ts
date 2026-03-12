import { NextRequest, NextResponse } from "next/server";
import { getTask } from "@/lib/db";
import { listOutputFiles } from "@/lib/files";
import path from "path";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const task = getTask(id);
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const filePaths = listOutputFiles(id);
  const files = filePaths.map((filePath) => {
    const name = path.basename(filePath);
    return {
      name,
      downloadUrl: `/api/tasks/${id}/output/${encodeURIComponent(name)}`,
    };
  });

  return NextResponse.json(files);
}
