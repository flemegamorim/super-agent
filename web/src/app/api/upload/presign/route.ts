import { NextRequest, NextResponse } from "next/server";
import { generatePresignedUploadUrl, s3Key } from "@/lib/s3";

interface PresignRequest {
  taskId: string;
  files: { name: string }[];
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as PresignRequest;

  if (!body.taskId || !Array.isArray(body.files) || body.files.length === 0) {
    return NextResponse.json(
      { error: "taskId and files[] are required" },
      { status: 400 },
    );
  }

  const result = await Promise.all(
    body.files.map(async (f) => {
      const key = s3Key(body.taskId, f.name);
      const uploadUrl = await generatePresignedUploadUrl(key);
      return { name: f.name, key, uploadUrl };
    }),
  );

  return NextResponse.json({ files: result });
}
