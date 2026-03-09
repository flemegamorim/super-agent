import { NextResponse } from "next/server";
import { listAgents } from "@/lib/opencode";

export async function GET() {
  try {
    const agents = await listAgents();
    return NextResponse.json(agents);
  } catch {
    return NextResponse.json(
      { error: "Could not connect to OpenCode server" },
      { status: 503 },
    );
  }
}
