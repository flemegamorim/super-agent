import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import fs from "fs";
import path from "path";

const OPENCODE_PATH = path.join(process.cwd(), "..", "opencode.json");

const AVAILABLE_MODELS = [
  { id: "anthropic/claude-opus-4-6", name: "Claude Opus 4.6" },
  { id: "anthropic/claude-opus-4-6:thinking", name: "Claude Opus 4.6 (Thinking)" },
  { id: "anthropic/claude-sonnet-4-6", name: "Claude Sonnet 4.6" },
  { id: "anthropic/claude-sonnet-4-6:thinking", name: "Claude Sonnet 4.6 (Thinking)" },
  { id: "anthropic/claude-sonnet-4-20250514", name: "Claude Sonnet 4" },
  { id: "anthropic/claude-opus-4-20250514", name: "Claude Opus 4" },
];

function readConfig(): Record<string, unknown> {
  const raw = fs.readFileSync(OPENCODE_PATH, "utf-8");
  return JSON.parse(raw);
}

function writeConfig(config: Record<string, unknown>): void {
  fs.writeFileSync(OPENCODE_PATH, JSON.stringify(config, null, 2) + "\n");
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const config = readConfig();
  return NextResponse.json({
    model: config.model ?? "",
    available_models: AVAILABLE_MODELS,
  });
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const model = typeof body.model === "string" ? body.model.trim() : "";

  if (!model) {
    return NextResponse.json({ error: "Model is required" }, { status: 400 });
  }

  const config = readConfig();
  config.model = model;
  writeConfig(config);

  return NextResponse.json({
    model: config.model,
    available_models: AVAILABLE_MODELS,
  });
}
