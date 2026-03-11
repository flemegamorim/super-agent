import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserNotificationPrefs, updateUserNotificationPrefs } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const prefs = getUserNotificationPrefs(session.user.id);
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
  const email = typeof body.default_notification_email === "string"
    ? body.default_notification_email.trim() || null
    : null;

  updateUserNotificationPrefs(session.user.id, {
    default_notification_email: email,
    default_notify_on_success: !!body.default_notify_on_success,
    default_notify_on_error: !!body.default_notify_on_error,
  });

  const prefs = getUserNotificationPrefs(session.user.id);
  return NextResponse.json(prefs);
}
