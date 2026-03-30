import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserRetryPrefs, updateUserRetryPrefs } from "@/lib/db";

const VALID_RETRY_COUNTS = [0, 1, 2, 3];
const VALID_INTERVALS = [5, 10, 15, 20, 25, 30];

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const prefs = getUserRetryPrefs(session.user.id);
  if (!prefs) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json(prefs);
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const retryCount = Number(body.default_retry_count);
  const intervalMinutes = Number(body.default_retry_interval_minutes);

  if (!VALID_RETRY_COUNTS.includes(retryCount)) {
    return NextResponse.json({ error: "Invalid retry count" }, { status: 400 });
  }
  if (!VALID_INTERVALS.includes(intervalMinutes)) {
    return NextResponse.json({ error: "Invalid retry interval" }, { status: 400 });
  }

  updateUserRetryPrefs(session.user.id, {
    default_retry_count: retryCount,
    default_retry_interval_minutes: intervalMinutes,
  });

  const prefs = getUserRetryPrefs(session.user.id);
  return NextResponse.json(prefs);
}
