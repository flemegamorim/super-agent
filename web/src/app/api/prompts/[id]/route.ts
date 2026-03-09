import { NextRequest, NextResponse } from "next/server";
import { getPrompt, updatePrompt, deletePrompt } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const prompt = getPrompt(id);
  if (!prompt) {
    return NextResponse.json({ error: "Prompt not found" }, { status: 404 });
  }
  return NextResponse.json(prompt);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const prompt = getPrompt(id);
  if (!prompt) {
    return NextResponse.json({ error: "Prompt not found" }, { status: 404 });
  }

  const { name, body } = await request.json();
  const updated = updatePrompt(id, {
    name: name?.trim() || undefined,
    body: body?.trim() || undefined,
  });
  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const deleted = deletePrompt(id);
  if (!deleted) {
    return NextResponse.json({ error: "Prompt not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
