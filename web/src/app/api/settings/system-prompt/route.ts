import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSystemPrompt, updateSystemPrompt } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const prompt = getSystemPrompt(session.user.id);
  return NextResponse.json({ system_prompt: prompt });
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const prompt = typeof body.system_prompt === "string"
    ? body.system_prompt.trim() || null
    : null;

  updateSystemPrompt(session.user.id, prompt);
  return NextResponse.json({ system_prompt: prompt });
}
