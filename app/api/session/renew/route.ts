import { NextRequest, NextResponse } from "next/server";
import { getAuthStore } from "@/lib/auth/auth-store";
import { createSession, isValidSession, SESSION_COOKIE_NAME, SESSION_LIFETIME_SECONDS } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const host = request.headers.get("host") ?? url.host;
  const protocol = request.headers.get("x-forwarded-proto") ?? url.protocol.slice(0, -1);
  if (request.headers.get("origin") !== `${protocol}://${host}`) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const auth = await getAuthStore().read();
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  // Validate at request time, not at the claimed activity time: expiry is final.
  if (!auth || !isValidSession(token, auth)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const activityAt = body?.activityAt;
  const now = Date.now();
  if (!Number.isSafeInteger(activityAt) || activityAt > now || activityAt < now - 60_000) {
    return NextResponse.json({ error: "Invalid activity time" }, { status: 400 });
  }
  // Reading the body/config may take time; never sign after the token expires.
  if (!isValidSession(token, auth)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const response = NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  const expiresAt = activityAt + SESSION_LIFETIME_SECONDS * 1_000;
  if (expiresAt > Number(token!.split(".")[0])) {
    response.cookies.set(SESSION_COOKIE_NAME, createSession(auth, activityAt), {
      expires: new Date(expiresAt),
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }
  return response;
}
