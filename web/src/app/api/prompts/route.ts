import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { createPrompt, listPrompts } from "@/lib/db";

export async function GET() {
  const prompts = listPrompts();
  return NextResponse.json(prompts);
}

export async function POST(request: NextRequest) {
  const { name, body } = await request.json();

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (!body?.trim()) {
    return NextResponse.json({ error: "Body is required" }, { status: 400 });
  }

  const prompt = createPrompt({ id: uuidv4(), name: name.trim(), body: body.trim() });
  return NextResponse.json(prompt, { status: 201 });
}
